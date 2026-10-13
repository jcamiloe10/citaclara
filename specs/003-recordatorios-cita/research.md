# Research: Recordatorios de cita

Decisiones técnicas del plan. Cada una resuelve una pregunta que la spec deja abierta a propósito (la spec dice qué, no cómo) y se justifica con los principios de la constitución.

## D1. Cómo se ejecuta el proceso diario

- **Decisión**: un comando independiente, `npm run recordatorios` (`src/recordatorios/ejecutar.js`), que abre la base, procesa la ventana y termina. Lo programa el sistema operativo (Programador de tareas de Windows o `cron`) una vez al día, **todos los días**. Admite `--ahora=AAAA-MM-DDTHH:MM` (hora de España) para fijar el instante en pruebas y demostraciones.
- **Por qué**: la spec pide "un proceso diario" y poder ejecutarlo bajo demanda con instante fijado. Un comando es lo más simple (Principio IV), se prueba sin servidor y sobrevive a reinicios del servidor web.
- **Alternativas**: un temporizador dentro del servidor Express (se duplicaría si hay dos procesos del servidor y dejaría de ejecutarse si el servidor está parado); una dependencia de planificación (alcance fantasma).
- **Consecuencia**: hay que ejecutarlo también sábado y domingo (ver plan, decisión 1).

## D2. Ventana de recordatorio

- **Decisión**: una cita entra si está `reservada` y `inicio >= ahora + 24 h` y `inicio < ahora + 48 h`, con 24 y 48 horas **absolutas** (86 400 y 172 800 segundos). El mismo `ahora` se usa para toda la ejecución.
- **Por qué**: la spec fija 24-48 h y un margen de cancelación de 24 h; con instantes absolutos el margen es el mismo en los días de cambio de hora y la comparación es una sola resta (Principio II). Los instantes se guardan en UTC (como en la 001), así que la comparación es sobre texto ISO ordenable o sobre `Date`.
- **Efecto del cambio de hora**: el día del cambio, "24 horas" puede caer una hora antes o después en el reloj de pared; el email muestra siempre la hora real de la cita en hora de España, así que no hay error para el paciente.
- **Alternativas**: ventana por día natural ("mañana"): daría margen distinto según la hora de ejecución y no respetaría "24 h".

## D3. Correo: solo modo simulado, y quién lo sabe

- **Decisión**: `src/correo/` es el único módulo que conoce el formato `.eml` y la carpeta de salida. El dominio le pasa un mensaje (destinatario, asunto, cuerpo) y recibe el nombre del fichero escrito. La v1 no tiene transporte real: el modo se guarda en cada recordatorio (`modo = 'simulado'`) y el comando lo escribe en su salida, para no confundir un fichero con un envío (FR-021).
- **Por qué**: Principio IV (no hay SMTP en la v1; la spec lo deja para después). Aislar el correo en un módulo cumple lo mismo que `src/db/connection.js` en la 001: si algún día se añade un envío real, solo cambia ahí.
- **Alternativas**: añadir una librería de correo y un modo SMTP desactivado (código sin uso, alcance fantasma).

## D4. Un recordatorio por cita: cómo se evitan duplicados

- **Decisión**: dos defensas, como en la 001. (1) Cada cita se procesa dentro de una transacción de escritura inmediata (`BEGIN IMMEDIATE`) que primero consulta si ya hay recordatorio resuelto para (cita, hora de inicio). (2) La tabla `recordatorio` tiene restricción `UNIQUE (cita_id, inicio_cita)`, que impide la segunda fila aunque la primera defensa fallara. Si el recordatorio existe con resultado `generado` o `sin_email`, se omite; si existe como `fallido`, se reintenta actualizando la fila.
- **Por qué**: FR-004 y SC-002 exigen 0 duplicados también con ejecuciones simultáneas; es el mismo patrón que protege el cero solapes. Bloquear la escritura mientras se escribe un fichero pequeño es aceptable a esta escala.
- **Orden dentro de la transacción**: componer el mensaje y su token → escribir el `.eml` (atómico) → guardar la fila `generado`. Si escribir falla, se guarda la fila `fallido` con el motivo (no se da por recordada) y se sigue con la siguiente cita (FR-005). Si el proceso muere entre escribir y guardar, no hay fila: la siguiente ejecución regenera el mismo fichero (mismo nombre, token nuevo) y el enlace anterior deja de valer, sin duplicados.
- **Alternativas**: marcar la cita antes de escribir (si fallase la escritura, la cita quedaría "recordada" sin fichero, contra FR-005); solo la restricción única (provocaría error en vez de omitir de forma limpia).

## D5. Cancelación por enlace

- **Decisión**: función de dominio `cancelarPorEnlace(db, token, ahora)` con una única transacción inmediata: localizar el recordatorio por la huella del token → comprobar que la cita sigue con el mismo `inicio` que cuando se generó el recordatorio (FR-017) → comprobar `estado = 'reservada'` → comprobar `inicio - ahora >= 24 h` (inclusive, FR-012) → `UPDATE cita SET estado = 'cancelada' WHERE id = ? AND estado = 'reservada'` y anotar `cancelada_en` en el recordatorio. Cualquier otra rama devuelve un código de rechazo sin cambiar nada.
- **Por qué no reutilizar `cambiarEstado` de la 001**: abre su propia transacción inmediata y las transacciones no se anidan; llamarlo fuera de la transacción dejaría la cancelación y la anotación del origen como dos pasos (FR-016 podría perderse si el proceso muere entre ambos). Se repite una sola sentencia `UPDATE`, con la misma condición de estado que la 001.
- **Cero solapes (Principio III)**: la transición `reservada → cancelada` solo libera ocupación; no puede crear solape y los disparadores de la 001 siguen activos. La prueba de concurrencia lanza cancelaciones por enlace y altas del mismo hueco desde procesos distintos y comprueba que nunca hay dos citas activas solapadas.
- **Idempotencia (FR-013)**: repetir devuelve `ya_cancelada` sin tocar nada.
- **Alternativas**: dos pasos separados (cancelar y luego anotar); comprobar el margen en la ruta HTTP en lugar del dominio (la regla se probaría solo por HTTP).

## D6. El enlace y la página pública

- **Decisión**: `GET /cancelar/:token` muestra los datos de la cita y un botón "Cancelar mi cita"; `POST /cancelar/:token` la cancela. Sin cookie de sesión de recepción ni CSRF (el token del enlace es la credencial y no hay sesión que atacar). Cabeceras `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`. Un token inválido da 404 con un mensaje genérico (FR-015). Reutiliza `pagina()` y el CSS de la 001; textos en `src/web/textos.js`.
- **Por qué dos pasos**: un `GET` nunca cambia nada, así que los escáneres de enlaces de los gestores de correo no pueden cancelar citas por accidente (FR-010).
- **Alternativas**: cancelar directamente al abrir (riesgo de cancelaciones por escáneres); firmar el enlace con HMAC en vez de guardar el token (no permitiría invalidarlo al cambiar la cita sin guardar estado igualmente).

## D7. Token del enlace

- **Decisión**: 32 bytes aleatorios de `crypto.randomBytes`, codificados en base64url (43 caracteres). En la base solo se guarda su huella SHA-256 (hex) con índice único; el token en claro solo existe en el `.eml`. Sin caducidad por tiempo: deja de valer cuando la cita deja de estar reservada o cambia su hora de inicio.
- **Por qué**: 256 bits no son adivinables, no contienen datos personales (edge case de la spec) ni permiten deducir otra cita (FR-010), y guardar solo la huella evita que una copia de la base permita cancelar citas. Como el token es aleatorio de entropía alta, una huella SHA-256 sin sal es suficiente (no es una contraseña).
- **Alternativas**: id de cita firmado (permite probar ids y no se invalida al mover la cita); UUID v4 (menos entropía que 32 bytes y sin ventaja).

## D8. Teléfono de la clínica

- **Decisión**: tabla nueva `clinica_contacto (clinica_id, telefono)`, cargada por la semilla para la clínica de demostración; la 001 no se modifica. Si una clínica no tiene teléfono, el email y la página dicen "llama a la clínica" sin número (no se inventa).
- **Por qué**: FR-009 y FR-012 piden indicar cómo contactar. Añadir una columna a `clinica` exigiría migrar bases ya creadas (el esquema de la 001 solo usa `CREATE TABLE IF NOT EXISTS`). No hay pantalla para editarlo: no la pide ninguna spec (Principio IV).
- **Alternativas**: variable de entorno (no sirve con varias clínicas); columna nueva con `ALTER TABLE` (migración sin necesidad).

## D9. Formato del email

- **Decisión**: mensaje de texto plano UTF-8, codificado en base64 en el cuerpo y con asunto y nombre del remitente en palabras codificadas (RFC 2047), cabeceras `From`, `To`, `Subject`, `Date`, `Message-ID`, `MIME-Version`, `Content-Type`, `Content-Transfer-Encoding`. Fecha y hora de la cita con las funciones de `src/domain/tiempo.js` ("viernes 16 de octubre de 2026, 10:00" más la indicación "hora de España"). El enlace va en su propia línea para que cualquier cliente lo detecte. Contenido exacto en [contracts/correo-eml.md](contracts/correo-eml.md).
- **Por qué**: texto plano evita HTML y sus riesgos de escape; base64 evita problemas con tildes y líneas largas, y se abre en cualquier cliente (SC-009).
- **Alternativas**: HTML con estilos (más superficie y sin necesidad en la v1); quoted-printable (más difícil de depurar a mano).

## D10. Datos de demostración y cifras esperadas

- **Decisión**: la semilla solo añade el teléfono de la clínica (un dato ficticio de demostración) y, al recargarse, borra antes los recordatorios y el contacto de la clínica (las claves foráneas lo exigen). No cambia ni una cita: los recuentos de la 001 se mantienen.
- **Cifras para los tests y el quickstart**, calculadas con la semilla y la ancla del lunes 2026-10-12 (reservas del lunes 19 al viernes 30 de octubre): con `ahora` = domingo 2026-10-18 12:00 → **18** recordatorios; con `ahora` = lunes 2026-10-19 12:00 → **19**; con `ahora` = viernes 2026-10-23 12:00 → **0** (la ventana cae en fin de semana); con `ahora` = jueves 2026-10-22 10:00 → **21**.
- **Por qué**: Principio V: cualquier persona obtiene los mismos números con la misma semilla y el mismo instante.

## D11. Trazabilidad con dos specs

- **Decisión**: las pruebas de la 003 van en `tests/recordatorios/` y llevan sus identificadores entre corchetes con prefijo `R3-` (por ejemplo `[R3-FR-004]`, `[R3-US2-E3]`). `scripts/trazabilidad.js` se amplía para comprobar cada spec contra su carpeta de pruebas: la 001 contra `tests/` excluyendo `tests/recordatorios/`, y la 003 contra `tests/recordatorios/` leyendo los identificadores con el prefijo. `npm run trazabilidad` falla si cualquiera de las dos queda sin cobertura.
- **Por qué**: sin prefijo, `[FR-004]` de la 003 daría por cubierto el `FR-004` de la 001 y al revés (los identificadores se repiten entre specs). Principio VI.
- **Alternativas**: renumerar los requisitos de la 003 (`FR-301…`: rompe la convención del equipo); un solo conjunto sin prefijo (cobertura falsa).

## D12. Qué ve recepción

- **Decisión**: `agendaDelDia` añade a cada cita el estado de su recordatorio (si existe para la misma hora de inicio): origen de la cancelación (`cancelada_en` ≠ nulo) y `sin_email`. La vista muestra, con texto e icono (no solo color): "Cancelada por el paciente" en las citas canceladas desde el enlace y "Sin email: sin recordatorio" en las reservadas sin email. No hay pantalla nueva (FR-016, FR-006, SC-006).
- **Por qué**: es lo mínimo que piden la spec y SC-006; reutiliza la agenda del día que recepción ya usa.
- **Alternativas**: una pantalla nueva de "recordatorios" (alcance no pedido).
