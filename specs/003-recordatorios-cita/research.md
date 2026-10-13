# Research: Recordatorios de cita

Decisiones técnicas del plan. Cada una resuelve una pregunta que la spec deja abierta a propósito (la spec dice qué, no cómo) y se justifica con los principios de la constitución.

## D1. Cómo se ejecuta el proceso diario

- **Decisión**: un comando independiente, `npm run recordatorios` (`src/recordatorios/ejecutar.js`), que abre la base, procesa la ventana y termina. Lo programa el sistema operativo (Programador de tareas de Windows o `cron`) **dos veces al día, todos los días** antes de las 09:00 (la segunda ejecución reintenta la primera). Admite `--ahora=AAAA-MM-DDTHH:MM` (hora de España) para fijar el instante en pruebas y demostraciones.
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

## D5. Cancelación por enlace (reutiliza la 002)

- **Decisión**: la 003 **no reimplementa** la regla de cancelación del paciente: la ejecuta la función `cancelarComoPaciente(db, { pacienteId, clinicaId, citaId }, ahora)` de la 002 (`src/domain/portal.js`), que ya comprueba cita reservada, margen de 24 h inclusivo, transición `reservada → cancelada` y `cancelada_por_paciente = 1` en una transacción inmediata. Solo se añade `cancelarPorEnlace(db, secreto, ahora)` en `src/domain/recordatorios.js`: resuelve el recordatorio por la huella del secreto, comprueba `resultado = 'generado'` y `cita.inicio = recordatorio.inicio_cita` (FR-017), toma `pacienteId`, `clinicaId` y `citaId` de la cita y llama a la función de la 002. Traduce sus códigos a los de la 003 (`cancelada`, `ya_cancelada`, `no_reservada`, `sin_margen`, `no_valido`). La lectura previa (`consultarEnlace`) es solo de consulta.
- **Por qué**: una única regla de cancelación del paciente para los dos accesos (portal y email) evita que diverjan el plazo, el origen de la cancelación y los mensajes (spec, Assumptions; Principio IV). El cero solapes (Principio III) lo sigue garantizando esa única función y los disparadores de la 001: la transición solo libera ocupación.
- **Atomicidad**: la comprobación `cita.inicio = recordatorio.inicio_cita` se hace antes de llamar a la función de la 002 y no en su misma transacción. Es seguro porque ni la 001 ni la 002 permiten cambiar la hora de una cita; si una spec futura lo permite, esta comprobación debe pasar a la misma transacción (anotado para esa spec).
- **Idempotencia (FR-013)**: repetir devuelve `ya_cancelada` sin tocar nada (lo da la función de la 002).
- **Alternativas**: reimplementar la cancelación en la 003 (dos reglas que mantener y una segunda etiqueta de origen); abrir el portal de la 002 desde el email (el secreto del portal solo se conoce en claro al crearlo y no puede ir en un email que se genera después).

## D6. El enlace y la página pública

- **Decisión**: `GET /cancelar/:token` muestra los datos de la cita y un botón "Cancelar mi cita"; `POST /cancelar/:token` la cancela. Sin cookie de sesión de recepción ni CSRF (el token del enlace es la credencial y no hay sesión que atacar). Cabeceras `Cache-Control: no-store`, `Referrer-Policy: no-referrer`, `X-Robots-Tag: noindex`. Un token inválido da 404 con un mensaje genérico (FR-015). Reutiliza `pagina()` y el CSS de la 001; textos en `src/web/textos.js`.
- **Por qué dos pasos**: un `GET` nunca cambia nada, así que los escáneres de enlaces de los gestores de correo no pueden cancelar citas por accidente (FR-010).
- **Alternativas**: cancelar directamente al abrir (riesgo de cancelaciones por escáneres); firmar el enlace con HMAC en vez de guardar el token (no permitiría invalidarlo al cambiar la cita sin guardar estado igualmente).

## D7. Secreto del enlace (formato de la 002)

- **Decisión**: se usa el mismo formato de la 002: 32 bytes aleatorios de `crypto.randomBytes` en base64url (43 caracteres), validados con `FORMATO_SECRETO` y con huella `huellaDeSecreto` (SHA-256 en hexadecimal) de `src/domain/enlaces.js`. Si ese módulo aún no expone un generador de secretos reutilizable, se extrae allí (cambio mínimo, sin duplicar código). En la base solo se guarda la huella (`recordatorio.token_huella`, índice único); el secreto en claro solo existe en el `.eml`. Sin caducidad por tiempo: deja de valer cuando la cita deja de estar reservada o cambia su hora de inicio.
- **Por qué**: 256 bits no son adivinables, no contienen datos personales (edge case de la spec) ni permiten deducir otra cita (FR-010), y guardar solo la huella evita que una copia de la base permita cancelar citas. Es la misma elección que la 002, con las mismas pruebas.
- **Alternativas**: id de cita firmado (permite probar ids y no se invalida al mover la cita); un módulo de enlaces propio (duplicaría el de la 002).

## D8. Teléfono de la clínica (de la 002)

- **Decisión**: se usa `clinica.telefono`, que añade la 002 (y rellena su semilla), con `obtenerClinica` de `src/domain/clinicas.js` y `formatearTelefono` para mostrarlo. La 003 no crea ningún dato de contacto propio. Si una clínica no tiene teléfono (nulo), el email y la página dicen "llama a la clínica" sin número (no se inventa).
- **Por qué**: FR-009 y FR-012 piden indicar cómo contactar; el dato ya lo introduce la 002, aprobada y anterior en el orden de implementación. Evita una segunda fuente del mismo dato (Principio IV).
- **Alternativas**: una tabla propia `clinica_contacto` (duplicaría `clinica.telefono`); una variable de entorno (no sirve con varias clínicas).

## D9. Formato del email

- **Decisión**: mensaje de texto plano UTF-8, codificado en base64 en el cuerpo y con asunto y nombre del remitente en palabras codificadas (RFC 2047), cabeceras `From`, `To`, `Subject`, `Date`, `Message-ID`, `MIME-Version`, `Content-Type`, `Content-Transfer-Encoding`. Fecha y hora de la cita con las funciones de `src/domain/tiempo.js` ("viernes 16 de octubre de 2026, 10:00" más la indicación "hora de España"). El enlace va en su propia línea para que cualquier cliente lo detecte. Contenido exacto en [contracts/correo-eml.md](contracts/correo-eml.md).
- **Por qué**: texto plano evita HTML y sus riesgos de escape; base64 evita problemas con tildes y líneas largas, y se abre en cualquier cliente (SC-009).
- **Alternativas**: HTML con estilos (más superficie y sin necesidad en la v1); quoted-printable (más difícil de depurar a mano).

## D10. Datos de demostración y cifras esperadas

- **Decisión**: la 003 no añade datos a la semilla: el teléfono de Clínica Eleva ya lo carga la 002. Solo se amplía el borrado al recargar la semilla (antes de borrar `cita`, borrar los `recordatorio` de la clínica, por las claves foráneas). No cambia ni una cita: los recuentos de la 001 se mantienen.
- **Cifras para los tests y el quickstart**, calculadas con la semilla y la ancla del lunes 2026-10-12 (reservas del lunes 19 al viernes 30 de octubre): con `ahora` = domingo 2026-10-18 12:00 → **18** recordatorios; con `ahora` = lunes 2026-10-19 12:00 → **19**; con `ahora` = viernes 2026-10-23 12:00 → **0** (la ventana cae en fin de semana); con `ahora` = jueves 2026-10-22 10:00 → **21**.
- **Por qué**: Principio V: cualquier persona obtiene los mismos números con la misma semilla y el mismo instante.

## D11. Trazabilidad con dos specs

- **Decisión**: las pruebas de la 003 van en `tests/recordatorios/` y llevan sus identificadores entre corchetes con prefijo `R3-` (por ejemplo `[R3-FR-004]`, `[R3-US2-E3]`). `scripts/trazabilidad.js` se amplía para comprobar cada spec contra su carpeta de pruebas: la 001 contra `tests/` excluyendo `tests/recordatorios/`, y la 003 contra `tests/recordatorios/` leyendo los identificadores con el prefijo. `npm run trazabilidad` falla si cualquiera de las dos queda sin cobertura.
- **Por qué**: sin prefijo, `[FR-004]` de la 003 daría por cubierto el `FR-004` de la 001 y al revés (los identificadores se repiten entre specs). Principio VI.
- **Alternativas**: renumerar los requisitos de la 003 (`FR-301…`: rompe la convención del equipo); un solo conjunto sin prefijo (cobertura falsa).

## D12. Qué ve recepción

- **Decisión**: la etiqueta "Cancelada por el paciente" ya la muestra la agenda del día de la 002 a partir de `cita.cancelada_por_paciente`; al cancelar desde el email se pone a 1 y aparece sin código nuevo (FR-016). La 003 solo añade a `agendaDelDia` si el recordatorio de cada cita reservada es `sin_email` y la etiqueta "Sin email: sin recordatorio", con texto e icono (FR-006, SC-006). No hay pantalla nueva.
- **Por qué**: es lo mínimo que piden la spec y SC-006; reutiliza la agenda del día y la etiqueta que recepción ya usa.
- **Alternativas**: una pantalla nueva de "recordatorios" (alcance no pedido); una segunda etiqueta de origen propia (duplicaría la de la 002).
