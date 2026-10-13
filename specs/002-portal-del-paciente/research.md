# Research: Portal del paciente

Decisiones técnicas de la 002. El stack ya lo fijó la 001 y no se cambia (Principio IV). No quedaban `NEEDS CLARIFICATION`: las tres decisiones de negocio las tomó Sara (ver Clarifications de la spec). Aquí se concreta el cómo.

## D1. Credencial: secreto aleatorio en la ruta, huella en la base

- **Decisión**: el enlace es `<URL pública>/p/<secreto>`, con `<secreto>` = 32 bytes aleatorios de `crypto.randomBytes` en base64url (43 caracteres). En `paciente.acceso_hash` se guarda `SHA-256(secreto)` en hexadecimal, con índice único. Resolver un enlace es calcular la huella y buscarla.
- **Razón**: con 256 bits de entropía no hay ataque por fuerza bruta ni hace falta limitar intentos, y una huella rápida basta (no es una contraseña elegida por una persona; `scrypt` no aporta nada). Guardar solo la huella protege los datos si se filtra la base. La búsqueda por índice evita recorrer pacientes.
- **Formato inválido**: antes de tocar la base se descarta todo lo que no cumpla `^[A-Za-z0-9_-]{43}$`; el resultado visible es el mismo que con un secreto desconocido (FR-003).
- **Alternativas**: secreto en claro (permite reenseñarlo, pero una filtración lo expone todo); JWT/firma HMAC sin estado en base (no se puede invalidar al renovar sin guardar algo, y entonces no es más simple); código de un solo uso por email y teléfono + email (descartadas por Sara).

## D2. Renovar invalida al instante

- **Decisión**: crear y renovar son la misma operación: genera un secreto nuevo y sobrescribe `acceso_hash` en un único `UPDATE`. El secreto anterior deja de resolver en cuanto se confirma la escritura (FR-004, escenario 3.4).
- **Razón**: no hay lista de enlaces antiguos que gestionar ni caducidades (Sara: "sigue valiendo hasta que recepción lo renueve").

## D3. Rutas del portal sin sesión, sin CSRF propio y con cabeceras de privacidad

- **Decisión**: `/p/:secreto` (GET) muestra la página; `/p/:secreto/citas/:id/cancelar` (GET) pide confirmación y (POST) cancela. No leen ni emiten cookies y no usan `exigirSesion`. Todas responden con `Cache-Control: no-store`, `Referrer-Policy: no-referrer` y `X-Robots-Tag: noindex`, y las páginas llevan `<meta name="robots" content="noindex">` (FR-005).
- **CSRF**: no se añade token. La petición de cancelar solo prospera si el atacante conoce el secreto, y quien conoce el secreto ya puede cancelar sin necesidad de forzar a nadie. Lo que sí se exige es el segundo paso explícito (FR-012): el `GET` nunca cancela.
- **Sin JavaScript**: confirmar es una página propia, no un cuadro emergente. Funciona en cualquier móvil y es comprobable por HTTP.
- **Razón**: Principio IV; reutiliza el modelo "formulario + redirección" de la 001.
- **Alternativas**: cookie de sesión de paciente tras abrir el enlace (más piezas, y el secreto seguiría en la URL de entrada); `confirm()` de JavaScript (no verificable sin navegador automatizado).

## D4. Cancelación: transacción propia, no `cambiarEstado` de la 001

- **Decisión**: `cancelarComoPaciente(db, { pacienteId, citaId }, ahora)` en `src/domain/portal.js`. Dentro de `enTransaccionInmediata`: lee la cita por `id` **y** `paciente_id` (si no es suya, "no encontrada"); exige `estado = 'reservada'`; exige `inicio − ahora ≥ 24 h` (inclusivo); y ejecuta `UPDATE cita SET estado = 'cancelada', cancelada_por_paciente = 1 WHERE id = ? AND estado = 'reservada'`, comprobando `changes`. Códigos de rechazo: `no_encontrada`, `no_reservada`, `fuera_de_plazo`.
- **Por qué no reutilizar `cambiarEstado`**: ese método recibe la clínica, no el paciente; tendría que ampliarse con paciente, plazo y marca de origen, y además abre su propia transacción (no se puede anidar). Ampliarlo cambiaría código de una spec cerrada. Duplicar tres líneas de `UPDATE` es más barato que acoplar ambas specs; la regla compartida (solo `reservada → cancelada`, solo con `WHERE estado = 'reservada'`) queda cubierta por pruebas en ambos lados.
- **Cero solapes**: la transición solo libera un hueco; el disparador de la 001 no se activa porque el nuevo estado no es `reservada` ni `completada`. Aun así, las pruebas intentan deliberadamente romperlo (ver D8).
- **Plazo**: se compara el instante de inicio (UTC) con `ahora()` más 24 horas en milisegundos; mide tiempo real transcurrido, también en el cambio de hora (edge case de la spec). El reloj es el mismo `ahora()` inyectado de la 001.

## D5. Qué es "próxima" y qué es "historial"

- **Decisión**: próxima = `estado = 'reservada'` y `inicio > ahora`, orden ascendente. Historial = el resto de citas del paciente, orden descendente por inicio. Una cita reservada ya empezada va al historial sin acción (edge case de la spec). Una cita cancelada con fecha futura va al historial (FR-008).
- **Presentación**: se reutilizan `formatoFechaHora`/`formatoRango` de `tiempo.js`; todo en hora de España. El historial muestra 10 citas y un enlace "Ver más citas" (`?h=<n>`, múltiplos de 10, con un máximo razonable); sin JavaScript (FR-007).
- **Plazo visible**: el botón "Cancelar cita" se ofrece solo si el plazo se cumple; si no, se explica "A menos de 24 horas de la cita no se puede cancelar desde aquí. Llama a la clínica" con el teléfono (FR-009, FR-011).

## D6. Interfaz

- **Decisión**: una columna, tarjetas por cita, el estado con texto e icono (reutiliza `textos.estados`), botón "Cancelar cita" de ≥ 44 px, cabecera con el nombre de la clínica y pie con su teléfono siempre visible. Reutiliza `estilos.css` y `base.js` (variante de cabecera sin "Cerrar sesión"). Se verifica a 360 px y a 1366 px, como en la 001 (axe-core con Chrome headless en la revisión manual del quickstart; sin navegador automatizado en la suite).
- **Recepción**: pantalla `/pacientes` con buscador por nombre (parámetro `q`), tabla/lista con teléfono, "Con enlace"/"Sin enlace" y un botón "Crear enlace" o "Renovar enlace" por fila. Tras pulsarlo se muestra una pantalla con el enlace completo, un campo de solo lectura para copiarlo y el aviso de que no volverá a mostrarse. Renovar pide confirmación explícita porque deja de valer el anterior.
- **Agenda de recepción**: las citas con `cancelada_por_paciente = 1` muestran "Cancelada por el paciente" (texto e icono) en el histórico del día (FR-017). Las demás canceladas siguen mostrando "Cancelada". No añade ningún paso a recepción: el hueco ya aparece libre (001).

## D7. Datos de demostración

- **Decisión**: la semilla fija `clinica.telefono` (número ficticio de demostración) y genera un enlace por paciente con `secreto = base64url(SHA-256("citaclara-demo:" + SEMILLA + ":" + n))`, donde `n` es el orden de la ficha (1–40). Se guardan solo las huellas, como en producción; el secreto de cada ficha se calcula de nuevo con la misma fórmula, así que es reproducible (Principio V). El quickstart publica el enlace de Claudia Rodríguez Pérez.
- **Razón**: la spec cita casos reales de la semilla y las pruebas necesitan entrar como Claudia sin pasar por recepción. Son enlaces **solo de demostración** (deterministas y por tanto adivinables); la misma advertencia que la clave `eleva-demo`. En una clínica real los enlaces se crean desde la pantalla de pacientes con secretos aleatorios.
- **`ancla` y "ahora"**: los ejemplos de la spec fijan ancla 2026-09-28 y "ahora" = jueves 1 de octubre de 2026, 10:00 (semana sin citas); las pruebas inyectan ese reloj.

## D8. Pruebas (Principio VI)

- **Decisión**: igual que la 001: `node:test`, nombre de cada prueba con su identificador (`FR-011`, `US2-E4`, `SC-005`…) y `npm run trazabilidad` ampliado para leer también `specs/002-portal-del-paciente/spec.md`.
- **Pruebas que intentan romper la regla capital (III)**, en `tests/concurrencia/` con procesos hijos sobre el mismo fichero:
  1. ≥ 20 procesos cancelan la misma cita a la vez: exactamente 1 `ok`, el resto `no_reservada`; la cita queda `cancelada` una sola vez (SC-005).
  2. Cancelación del paciente contra `cambiarEstado` de recepción (completada, no asistida, cancelada) sobre la misma cita: solo una gana y el estado final es coherente (FR-015).
  3. Cancelación del paciente contra ≥ 20 altas de recepción para el hueco liberado y para huecos parcialmente solapados: después de todo, ninguna agenda tiene solapes, y como mucho una cita nueva ocupa el hueco.
- **Aislamiento (SC-006)**: pruebas de integración que piden la cita de Claudia Rodríguez Pérez (ficha 8) con el enlace de Claudia Ruiz Romero (ficha 13) y viceversa, enlaces manipulados (un carácter cambiado, longitud errónea), renovado y de otra clínica: respuesta idéntica de "enlace no válido" y ningún dato.
- **Verificación manual**: SC-001, SC-002, SC-003, SC-004 y SC-007 se comprueban a mano o en producción según el quickstart.

## D9. Migración mínima

- **Decisión**: tras ejecutar `schema.sql`, `abrirBase` llama a una función idempotente que consulta `PRAGMA table_info` y ejecuta `ALTER TABLE … ADD COLUMN` solo si falta la columna; si varios procesos abren a la vez una base antigua y uno pierde la carrera, se ignora el error "duplicate column". Las columnas nuevas admiten valores por defecto, así que las bases existentes siguen funcionando y las citas antiguas quedan con `cancelada_por_paciente = 0`.
- **Razón**: la base de la 001 ya existe en instalaciones de piloto y `CREATE TABLE IF NOT EXISTS` no añade columnas. Sin librería de migraciones (IV): son tres columnas.
- **Alternativa**: meter las tres columnas directamente en `schema.sql` (obligaría a borrar las bases existentes).

## D10. Dependencias de producción

Ninguna nueva. `node:crypto` (aleatoriedad y huella), `node:sqlite`, `node:test` e `Intl` ya estaban.
