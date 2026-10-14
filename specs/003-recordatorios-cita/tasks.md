---

description: "Lista de tareas de la 003: Recordatorios de cita"
---

# Tasks: Recordatorios de cita

**Input**: Documentos de diseño en `/specs/003-recordatorios-cita/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/](contracts/) ([enlace-cancelacion.md](contracts/enlace-cancelacion.md), [proceso-diario.md](contracts/proceso-diario.md), [correo-eml.md](contracts/correo-eml.md)), [quickstart.md](quickstart.md)

**Tests**: INCLUIDOS. Son obligatorios por la Constitución (Principio VI) y por el Principio III (pruebas que intentan provocar un solape, también con procesos simultáneos).

**Convención de trazabilidad**: el nombre de cada test lleva entre corchetes los identificadores que cubre **con el prefijo `003:`**, por ejemplo `[003:FR-004][003:US1-E4] no duplica el recordatorio al ejecutar dos veces`. Identificadores válidos: `003:FR-0xx`, `003:SC-0xx` y `003:US<n>-E<m>` (escenario `m` de la historia `n` de la spec 003). El prefijo (el mismo esquema que usa la 002 con `002:`) evita confundirlos con los de la 001 y la 002 (research D11). `npm run trazabilidad` (T008) falla si algún FR o escenario de la 003 no aparece en algún test (el script busca por etiqueta en todo `tests/`; las pruebas de la 003 se organizan en `tests/recordatorios/`). Quedan fuera del script `003:FR-022` y `003:FR-023` (límite de alcance y gobierno, sin comportamiento que probar) y los SC medidos por personas (`SC-003`, `SC-006`), que se verifican a mano en el quickstart.

**Organization**: Tareas agrupadas por historia de usuario para poder implementar y probar cada una de forma independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (ficheros distintos, sin dependencias pendientes)
- **[Story]**: historia a la que pertenece (US1 a US3)
- Todas las rutas son relativas a la raíz del repositorio, según la estructura de [plan.md](plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Inicialización de la feature sobre el proyecto de la 001

- [ ] T001 Comprobar los prerrequisitos de gobierno (Principio I): `specs/MAPA.md` con la 003 aprobada y su propietario (Camilo), y su orden respecto a la 002 y la 001 declarado allí y en la nota de la spec 001. **La 002 ya está implementada y fusionada en `main` (verificado el 2026-10-14); esta rama debe tener `main` fusionado antes de empezar T004**, porque la 003 reutiliza sus columnas (`cita.cancelada_por_paciente`, `clinica.telefono`), su función `cancelarComoPaciente` y su módulo `src/domain/enlaces.js`; ya verificadas las firmas (hallazgo N1): `cancelarComoPaciente(db, { pacienteId, clinicaId, citaId }, ahora)` devuelve `{ ok: true, cita }` o `{ ok: false, codigo }` con `no_encontrada | no_reservada (con estado) | fuera_de_plazo`; `enlaces.js` expone `FORMATO_SECRETO` y `huellaDeSecreto` pero **no** un generador de secretos (T005 lo extrae). Al empezar a implementar, cambiar el estado de la 003 en el MAPA a "En implementación".
- [ ] T002 [P] Crear la estructura de carpetas vacía del plan: `src/correo`, `src/recordatorios`, `tests/recordatorios/unitarias`, `tests/recordatorios/integracion`, `tests/recordatorios/concurrencia`.
- [ ] T003 [P] Ampliar `src/config.js` con `urlPublica` (`CITACLARA_URL_PUBLICA`, por defecto `http://localhost:<puerto>`), `carpetaCorreo` (`CITACLARA_SALIDA_CORREO`, por defecto `datos/salida-correo` resuelta desde la raíz) y `remitente` (`CITACLARA_REMITENTE`, por defecto `no-responder@citaclara.invalid`). Añadir al `package.json` el script `"recordatorios": "node --disable-warning=ExperimentalWarning src/recordatorios/ejecutar.js"`. Sin dependencias nuevas.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Esquema, utilidades, trazabilidad y semilla que necesitan todas las historias

**⚠️ CRITICAL**: Ninguna historia puede empezar hasta terminar esta fase

- [ ] T004 Ampliar `src/db/schema.sql` con la tabla `recordatorio` exactamente como en [data-model.md](data-model.md) (`CREATE TABLE IF NOT EXISTS`; `UNIQUE (cita_id, inicio_cita)`; índice único sobre `token_huella`; `CHECK` de `resultado` y de la regla R3; claves foráneas). No modificar ninguna otra tabla ni disparador y **no** añadir columnas: `cancelada_por_paciente` y `telefono` ya los aporta la 002.
- [ ] T005 [P] Reutilizar `src/domain/enlaces.js` de la 002 (`FORMATO_SECRETO`, `huellaDeSecreto`); si no expone un generador de secretos reutilizable, extraerlo allí (cambio mínimo, sin duplicar código ni cambiar el comportamiento de la 002). Test en `tests/recordatorios/unitarias/enlaces.test.js`: `[003:FR-010]` los secretos generados son distintos entre sí (1000 muestras), cumplen `FORMATO_SECRETO` y no contienen datos legibles; `[003:FR-010]` la huella es determinista y distinta del secreto; `[003:FR-015]` formatos no válidos se rechazan sin lanzar error.
- [ ] T006 [P] Crear `src/correo/textos.js` con todos los textos del email en español de España (asunto, saludo, bloque de datos, frase del enlace, frase del teléfono con y sin número, despedida), sin jerga técnica (Principios VII y VIII). Es el único sitio donde viven estos textos.
- [ ] T007 [P] Ampliar `tests/ayudas/fixture.js` (tras T004): ayudas para la 003 sin cambiar las existentes: `crearCitaReservada(entorno, {dia, hora, paciente, servicio, profesional})` para insertar citas directamente, `crearCarpetaSalida()` (carpeta temporal de salida de correo, con limpieza) y uso del teléfono de la clínica que ya acepta el fixture de la 002 (`telefonoClinica`).
- [ ] T008 Añadir la 003 a `scripts/trazabilidad.js` (que la 002 ya generalizó con la lista `SPECS` y prefijos): una entrada `{ ruta: 'specs/003-recordatorios-cita/spec.md', prefijo: '003:', excluidos: new Set(['FR-022', 'FR-023']) }` (alcance y gobierno, sin comportamiento que probar; los SC medidos por personas no se exigen porque el script solo exige RN, FR y escenarios). Sin otros cambios en el script; `npm run trazabilidad` comprueba entonces las tres specs. Crear `tests/recordatorios/unitarias/trazabilidad-003.test.js` con un test `[003:SC-008]` (siguiendo el de la 002): una spec de ejemplo con un identificador `003:` sin cubrir falla, con todos cubiertos pasa, y una etiqueta sin prefijo o con `002:` **no** cubre el identificador de la 003 (ni al revés).
- [ ] T009 [P] Ampliar `src/seed/seed.js` para borrar los `recordatorio` de la clínica antes de borrar sus `cita` al recargar (las claves foráneas lo exigen). Sin cambios en `src/seed/datos.js`: el teléfono de la clínica ya lo aporta la 002. Crear `tests/recordatorios/integracion/semilla-recordatorios.test.js` con `[003:SC-001]`: recargar la semilla con recordatorios existentes no falla y los recuentos de la 001 se mantienen (996 citas, 203 reservadas).

**Checkpoint**: Esquema, token, textos, fixture, trazabilidad y semilla listos; ya se pueden construir las historias.

---

## Phase 3: User Story 1 - El paciente recibe un recordatorio de su cita (Priority: P1) 🎯 MVP

**Goal**: Un proceso diario genera un recordatorio por email (fichero `.eml` en modo simulado) por cada cita reservada de la ventana de 24 a 48 horas, una sola vez, y recepción ve qué citas no pudieron recordarse por falta de email.

**Independent Test**: Con los datos de demostración y `--ahora=2026-10-18T12:00` (ancla 2026-10-12), `npm run recordatorios` genera 18 `.eml`; una segunda ejecución no genera nada nuevo; las citas fuera de la ventana o no reservadas no reciben recordatorio.

### Tests for User Story 1

- [ ] T010 [P] [US1] Crear `tests/recordatorios/unitarias/ventana.test.js` para `ventanaDeRecordatorio(ahora)`: `[003:FR-002]` devuelve `[ahora + 24 h, ahora + 48 h)` en instantes absolutos; `[003:FR-002]` el límite inferior está incluido y el superior excluido; `[003:SC-007]` el domingo 25 de octubre de 2026 (cambio de hora) la ventana sigue siendo de 24 h absolutas y la hora mostrada de una cita del lunes 26 a las 09:00 es "09:00".
- [ ] T011 [P] [US1] Crear `tests/recordatorios/unitarias/mensaje.test.js` para la composición y serialización del `.eml` ([contracts/correo-eml.md](contracts/correo-eml.md)): `[003:FR-007]` el cuerpo incluye clínica, paciente, profesional, servicio y "viernes 16 de octubre de 2026, 10:00 (hora de España)"; `[003:FR-008]` incluye el enlace `<url>/cancelar/<token>` en su propia línea y la frase de que cancelar libera el hueco; `[003:FR-009]` incluye cómo contactar para cambiar la cita, con teléfono y sin él ("llama a la clínica"); `[003:FR-019]` cabeceras `From`, `To`, `Subject`, `Date`, `Message-ID`, `MIME-Version`, `Content-Type`, `Content-Transfer-Encoding: base64`, `X-CitaClara-Modo: simulado`; `[003:SC-009]` el asunto y el nombre del remitente con tildes y eñes se codifican y el cuerpo decodificado en base64 recupera el texto exacto; nombres con saltos de línea o comillas no inyectan cabeceras; `[003:FR-020]` el nombre del fichero es `cita-<id>-<AAAAMMDD>T<HHMM>Z.eml` y no contiene nombres ni emails.
- [ ] T012 [P] [US1] Crear `tests/recordatorios/integracion/proceso-diario.test.js` con el entorno de pruebas y una carpeta de salida temporal: `[003:US1-E1][003:FR-001]` una cita reservada de la ventana con email genera un `.eml` con los datos de la cita; `[003:US1-E2][003:FR-003]` citas fuera de la ventana (más lejanas, ya pasadas, justo en 48 h) no generan recordatorio; `[003:US1-E3][003:FR-003]` citas completadas, canceladas y no asistidas dentro de la ventana no generan recordatorio; `[003:US1-E4][003:FR-004]` una segunda ejecución con la misma ventana no genera nada nuevo y no cambia los ficheros; `[003:US1-E5]` un paciente con dos citas en la ventana recibe dos recordatorios, cada uno con los datos de su cita; `[003:US1-E6]` la hora del fichero está en hora de España con formato largo; `[003:FR-006]` un paciente sin email válido deja la fila `sin_email`, no escribe ningún fichero y no impide procesar al resto; `[003:FR-005]` con la carpeta de salida no escribible la cita queda `fallido`, el resto se procesa, el comando termina con código 1 y una ejecución posterior cuya ventana aún incluye la cita (carpeta arreglada) la genera; `[003:US1-E7][003:FR-003]` una cita que empieza en menos de 24 h en el momento de la ejecución (incluida una `fallido` cuya ventana ya pasó y la de un día en que no se ejecutó el proceso) no recibe recordatorio y no se reintenta; `[003:FR-019][003:FR-021]` la salida del comando dice "modo simulado" y cada fila guarda `modo = 'simulado'`.
- [ ] T013 [P] [US1] Crear `tests/recordatorios/integracion/cifras-demo.test.js` con la semilla de la 001 y la ancla 2026-10-12: `[003:SC-001]` con `ahora` = 2026-10-18 12:00 salen **18** recordatorios; 2026-10-19 12:00 → **19**; 2026-10-22 10:00 → **21**; 2026-10-23 12:00 → **0** (cifras de [research.md](research.md) D10 y del quickstart); `[003:SC-002]` ejecutar el proceso 10 veces seguidas deja exactamente un recordatorio por cita.
- [ ] T014 [P] [US1] Crear `tests/recordatorios/concurrencia/dos-ejecuciones.test.js` (con un `trabajador.js` en la misma carpeta, igual que la 001): `[003:FR-004][003:SC-002]` 20 procesos hijos ejecutan el proceso diario a la vez contra el mismo fichero de base y la misma carpeta; resultado: una fila y un fichero por cita, ningún error de restricción sin tratar y 0 duplicados.
- [ ] T015 [P] [US1] Crear `tests/recordatorios/integracion/agenda-sin-email.test.js`: `[003:FR-006][003:SC-006]` en la agenda del día de una cita reservada sin email recordada, aparece la etiqueta "Sin email: sin recordatorio" (texto e icono); una cita recordada con éxito no la muestra; la agenda sigue funcionando para clínicas sin recordatorios.

### Implementation for User Story 1

- [ ] T016 [US1] Crear `src/correo/mensaje.js`: `componerRecordatorio({ clinica, telefono, paciente, cita, urlPublica, token, generadoEn, remitente })` → `{ nombreFichero, contenido }` según [contracts/correo-eml.md](contracts/correo-eml.md): cabeceras, asunto y remitente en palabras codificadas (RFC 2047), cuerpo de texto plano en UTF-8 codificado en base64 con líneas de 76 caracteres, fechas y horas con `src/domain/tiempo.js` y textos de `src/correo/textos.js`; eliminar saltos de línea de los datos que van en cabeceras. Pasa T011.
- [ ] T017 [US1] Crear `src/correo/salida-simulada.js`: `escribirSimulado(carpeta, nombreFichero, contenido)` que crea la carpeta si no existe, escribe en un fichero temporal de la misma carpeta y lo renombra al nombre final (escritura atómica), y devuelve el nombre del fichero; si falla, lanza un error con mensaje claro (lo usa la ejecución para guardar `fallido`).
- [ ] T018 [US1] Crear `src/domain/recordatorios.js` con `ventanaDeRecordatorio(ahora)`, `citasParaRecordar(db, ahora)` (consulta de [data-model.md](data-model.md): reservadas con `inicio` en `[ahora + 24 h, ahora + 48 h)` sin recordatorio `generado` o `sin_email` para esa hora, con paciente, servicio, profesional, clínica y teléfono) y `generarRecordatorios(db, { ahora, salida, urlPublica, remitente })`. Por cada cita, dentro de `enTransaccionInmediata` (research D4): releer si ya hay recordatorio resuelto; si el email no es válido (mismo criterio que `validarPaciente`) guardar `sin_email`; si no, generar token, componer, escribir el `.eml` por la `salida` recibida y guardar `generado` (modo `simulado`, huella del token, fichero); si la escritura falla, guardar `fallido` con el motivo y seguir. Devuelve `{ generados, sinEmail, fallidos, yaRecordadas }`. Pasa T010 y T012 a T014.
- [ ] T019 [US1] Crear `src/recordatorios/ejecutar.js` ([contracts/proceso-diario.md](contracts/proceso-diario.md)): lee `--ahora=AAAA-MM-DDTHH:MM` (hora de España; mal formado → código 2 sin tocar nada), abre la base de `config.js`, llama a `generarRecordatorios` con la carpeta de salida simulada, escribe el resumen en español (incluida la línea "modo simulado" y la ventana con fechas largas) y termina con 0, 1 (algún `fallido`) o 2 (argumento no válido o base no abierta).
- [ ] T020 [US1] Ampliar `src/domain/agenda.js` para que cada cita de `agendaDelDia` incluya `recordatorio` = `{ resultado, canceladaPorPaciente }` de la fila de `recordatorio` con el mismo `inicio_cita` (o `null`), y `src/web/vistas/agenda.js` + `src/web/textos.js` para mostrar la etiqueta "Sin email: sin recordatorio" (texto e icono, no solo color) en las citas reservadas cuyo recordatorio es `sin_email`. Sin pantallas ni rutas nuevas. Pasa T015.

**Checkpoint**: La historia 1 es independiente: `npm run recordatorios` genera los `.eml` sin duplicados y recepción ve las citas sin email.

---

## Phase 4: User Story 2 - El paciente cancela desde el email para liberar el hueco (Priority: P2)

**Goal**: El enlace del email abre una página pública de dos pasos (ver y confirmar) que cancela la cita si faltan 24 horas o más; si no, indica que hay que llamar a la clínica. Recepción ve la cancelación como hecha por el paciente y el hueco libre.

**Independent Test**: Tomar el enlace de un `.eml`, abrirlo (no cambia nada), confirmar (la cita queda cancelada y el hueco admite una nueva reserva) y repetir (inocuo).

### Tests for User Story 2

- [ ] T021 [P] [US2] Crear `tests/recordatorios/unitarias/cancelar-enlace.test.js` para `cancelarPorEnlace` y `consultarEnlace` del dominio, con reloj fijo: `[003:US2-E1][003:FR-011]` cita reservada con margen → `cancelada`, estado `cancelada` y `cancelada_por_paciente = 1`; `[003:US2-E2][003:FR-013]` repetir devuelve `ya_cancelada` sin cambios; `[003:US2-E3][003:FR-011]` cita completada, no asistida o cancelada por recepción → `no_reservada`, sin cambios; `[003:US2-E5][003:FR-012]` a 23 h 59 min del inicio → `sin_margen`, sin cambios; `[003:US2-E6][003:FR-012]` a exactamente 24 h → `cancelada` (límite inclusivo); `[003:FR-012]` cita que ya empezó → `sin_margen`; `[003:FR-017]` secreto de un recordatorio cuya cita cambió de hora → `no_valido`; `[003:US2-E4][003:FR-015]` secreto desconocido, con formato inválido o de otra clínica → `no_valido` sin ningún dato; `[003:FR-011]` la cancelación por enlace y por el portal de la 002 dan el mismo resultado sobre la misma cita (una única regla).
- [ ] T022 [P] [US2] Crear `tests/recordatorios/integracion/enlace-http.test.js` (entorno de pruebas, servidor real contra base temporal, sin cookie ni clave): `[003:US2-E1][003:FR-010]` `GET /cancelar/<token>` muestra los datos de la cita y el botón "Cancelar mi cita" y **no** cambia la cita; `[003:US2-E1][003:FR-011]` `POST` cancela y muestra la confirmación; `[003:US2-E2][003:FR-013]` repetir `GET` y `POST` informa "ya está cancelada" con 200; `[003:US2-E3]` cita no reservada → "ya no se puede cancelar"; `[003:US2-E5][003:FR-012]` con menos de 24 h no hay botón y se muestra el teléfono de la clínica (sin teléfono, "llama a la clínica"); `[003:US2-E4][003:FR-015][003:SC-005]` token inventado, con una letra cambiada, vacío o muy largo → 404 con el mismo mensaje genérico, sin datos de ninguna cita ni paciente, y ninguna cita cambia (batería de intentos); `[003:FR-010]` cabeceras `Cache-Control: no-store`, `Referrer-Policy: no-referrer` y `X-Robots-Tag: noindex`; `[003:SC-007]` textos en español de España y hora con "(hora de España)"; `[003:SC-003]` la página sirve el viewport móvil y el botón no está desactivado ni fuera de la plantilla.
- [ ] T023 [P] [US2] Crear `tests/recordatorios/integracion/agenda-cancelada-paciente.test.js`: `[003:US2-E7][003:FR-016]` tras cancelar por enlace, la agenda del día (con sesión de recepción) muestra la cita cancelada con la etiqueta "Cancelada por el paciente" (la de la 002) y el hueco libre y reservable; una cancelación hecha por recepción no lleva la etiqueta.
- [ ] T024 [P] [US2] Crear `tests/recordatorios/concurrencia/cancelar-frente-a-reservar.test.js` (con procesos hijos sobre el mismo fichero, Principio III): `[003:US2-E8][003:FR-014][003:SC-004]` 20 procesos intentan a la vez cancelar por enlace la cita y reservar ese mismo hueco para otro paciente; en todos los órdenes el resultado es consistente y **nunca** quedan dos citas reservadas o completadas solapadas del mismo profesional; y `[003:FR-013]` varias confirmaciones simultáneas del mismo enlace dejan la cita cancelada una sola vez.

### Implementation for User Story 2

- [ ] T025 [US2] Ampliar `src/domain/recordatorios.js` con `consultarEnlace(db, secreto, ahora)` (solo lectura, devuelve datos de la cita y la situación) y `cancelarPorEnlace(db, secreto, ahora)` según research D5: resolver el recordatorio por la huella, comprobar `resultado = 'generado'` y `cita.inicio = recordatorio.inicio_cita` (FR-017) y llamar a `cancelarComoPaciente` de la 002 con el paciente, la clínica y la cita; traducir sus códigos: `ok` → `cancelada`; `no_reservada` con `estado = 'cancelada'` → `ya_cancelada`; otro `no_reservada` → `no_reservada`; `fuera_de_plazo` → `sin_margen`; `no_encontrada` → `no_valido`. No reimplementar la regla ni el `UPDATE`. Pasa T021.
- [ ] T026 [US2] Crear `src/web/rutas/enlace.js` (`GET` y `POST /cancelar/:token`, públicas, con las cabeceras de [contracts/enlace-cancelacion.md](contracts/enlace-cancelacion.md); sin sesión ni CSRF), `src/web/vistas/enlace.js` (páginas con `pagina()` de la 001: datos de la cita, botón, mensajes de cada resultado, teléfono de la clínica) y los textos en `src/web/textos.js`; montar `rutasEnlace(contexto)` en `src/app.js` **antes** de las rutas con sesión. Un token no válido devuelve 404 con "Este enlace no es válido." Pasa T022.
- [ ] T027 [US2] Verificar que la etiqueta "Cancelada por el paciente" de la agenda de la 002 aparece para las citas canceladas desde el enlace (sin código de vista nuevo); si no aparece, corregir la causa en la cancelación y no duplicar la etiqueta. Pasa T023.
- [ ] T028 [P] [US2] Añadir al CSS `src/web/publico/estilos.css` los estilos de la página del enlace y de la etiqueta "Sin email" (contraste AA, botones de al menos 44 px, resultado con icono y texto, sin desplazamiento horizontal en móvil), reutilizando las clases de la 002 donde existan.

**Checkpoint**: Las historias 1 y 2 funcionan juntas: el paciente recibe el recordatorio y puede liberar su hueco desde el email.

---

## Phase 5: User Story 3 - Qué hace el sistema cuando la cita cambia (Priority: P3)

**Goal**: Una cita movida (cancelada y creada de nuevo) se trata como cualquier otra: el enlace del recordatorio anterior no cancela la cita nueva y la cita en su nueva hora recibe su propio recordatorio.

**Independent Test**: Con un recordatorio generado, cancelar la cita desde recepción y crear otra para el mismo paciente en otro hueco; el enlace antiguo informa de que ya no vale y la cita nueva recibe su recordatorio en la ejecución correspondiente.

### Tests for User Story 3

- [ ] T029 [P] [US3] Crear `tests/recordatorios/integracion/cita-movida.test.js`: `[003:US3-E1][003:FR-017]` cancelar por recepción la cita con recordatorio y crear otra del mismo paciente → el enlace antiguo da "ya no se puede cancelar" y nunca cancela la cita nueva; `[003:US3-E1][003:FR-018]` la cita nueva recibe su propio recordatorio (otro fichero y otro token) al entrar en la ventana; `[003:US3-E2][003:FR-018]` una cita cuyo `inicio` cambia directamente en la base (simulación de una futura reprogramación) se trata como cita en su nueva hora: nuevo recordatorio con el mismo `cita_id` y otro `inicio_cita`, y el enlace anterior da `no_valido`; `[003:FR-017]` un recordatorio de una cita ya no reservada no afecta a ninguna otra cita.

### Implementation for User Story 3

- [ ] T030 [US3] Revisar `generarRecordatorios` y `cancelarPorEnlace` (T018, T025) para confirmar que la clave de unicidad `(cita_id, inicio_cita)` y la comprobación `cita.inicio = recordatorio.inicio_cita` ya cubren los cambios de hora; corregir lo que haga falta para pasar T029. No añadir ninguna regla especial de reenvío (spec FR-018).

**Checkpoint**: Las tres historias son independientes y completas.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentación, comprobación de principios y validación final

- [ ] T031 [P] Actualizar `README.md`: comando `npm run recordatorios` (con `--ahora`), variables `CITACLARA_URL_PUBLICA`, `CITACLARA_SALIDA_CORREO` y `CITACLARA_REMITENTE`, aviso de que el correo es **simulado** (los ficheros de `datos/salida-correo/` no son envíos reales) y cómo programar el proceso **todos los días, también sábado y domingo, dos veces antes de las 09:00 (p. ej. 06:30 y 08:00)** (ejemplo del Programador de tareas de Windows y línea de `cron`).
- [ ] T032 [P] Añadir tests de textos en `tests/recordatorios/unitarias/textos.test.js`: `[003:SC-007]` ningún texto del email ni de la página del enlace contiene jerga técnica ("token", "ID", "error 404", "SQL", "null") ni variantes no españolas; fechas con el formato largo y la indicación "hora de España".
- [ ] T033 Ejecutar `npm test` y `npm run trazabilidad`: toda la suite en verde (001 y 003, sin desactivar tests) y cobertura completa de ambas specs. Corregir lo que falle.
- [ ] T034 Seguir [quickstart.md](quickstart.md) de principio a fin: cifras esperadas (18, 19, 21 y 0), apertura de un `.eml` real en un cliente de correo (`[003:SC-009]`), recorrido manual del enlace en un navegador y en un móvil o a 375 px (sin desplazamiento horizontal, botón de al menos 44 px), carpeta `datos/salida-correo/` fuera de git. Anotar cualquier desviación en `research.md` o en la spec antes de dar la feature por terminada (Principio I).
- [ ] T035 Verificación manual de uso (`SC-003`, `SC-006`) según quickstart sección 5; registrar el resultado en `quickstart.md`.
- [ ] T036 Comprobación final de la constitución con las evidencias: Principio II (horas en hora de España y cambio de hora de octubre probados), III (concurrencia de T024 en verde), IV (sin dependencias nuevas ni alcance extra), V (cifras de T013), VI (trazabilidad de T033), VII (T022/T028), VIII (T032); actualizar el estado de la 003 en `specs/MAPA.md` y el `Status` de la spec.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Prerrequisito externo** (cumplido: la 002 está en `main`; traer `main` a esta rama): aporta `cita.cancelada_por_paciente`, `clinica.telefono`, `cancelarComoPaciente` y `src/domain/enlaces.js` (T001).
- **Setup (Fase 1)**: depende del prerrequisito externo.
- **Foundational (Fase 2)**: depende de Setup; T007 y T009 dependen además de T004; **bloquea** todas las historias.
- **US1 (Fase 3)**: depende de Foundational. Es el MVP.
- **US2 (Fase 4)**: depende de Foundational y de `src/domain/recordatorios.js` y del `.eml` de US1 (necesita un recordatorio generado con su token). Se puede probar con recordatorios creados directamente en la base por la fixture mientras US1 no esté terminada.
- **US3 (Fase 5)**: depende de US1 y US2 (reutiliza generación y cancelación).
- **Polish (Fase 6)**: depende de las historias que se vayan a entregar.

### Within Each User Story

- Los tests se escriben primero y deben fallar antes de implementar.
- Dentro de US1: T016 y T017 (correo) antes de T018 (dominio) antes de T019 (comando); T020 (agenda) es independiente de T016 a T019 salvo para la prueba T015.
- Dentro de US2: T025 (dominio) antes de T026 (rutas) y T027 (agenda); T028 (CSS) es independiente.

### Parallel Opportunities

- Setup: T002 y T003 en paralelo.
- Foundational: T005, T006, T007 y T009 en paralelo (ficheros distintos); T004 antes de T009; T008 es independiente.
- US1: los tests T010 a T015 son ficheros distintos y van en paralelo; T016 y T017 también.
- US2: los tests T021 a T024 en paralelo; T028 en paralelo con T026.
- Con varios agentes: uno en US1 (T016 a T020) y otro preparando los tests de US2 (T021 a T024) mientras tanto.

---

## Implementation Strategy

### MVP First (solo la historia 1)

1. Fase 1 y Fase 2.
2. Fase 3 (US1): el proceso diario genera los `.eml` sin duplicados.
3. **Parar y validar**: quickstart secciones 1 y 2. El paciente ya recibe el aviso, aunque todavía no pueda cancelar desde el email.

### Entrega incremental

1. US1 → recordatorios sin duplicados (valor inmediato contra la no asistencia).
2. US2 → cancelación desde el email (convierte un no-show en un hueco libre).
3. US3 → coherencia cuando la cita cambia.
4. Polish → documentación, trazabilidad y validación final.

### Notas

- `[P]` = ficheros distintos, sin dependencias.
- No tocar el comportamiento de la 001: solo se añaden tablas y una etiqueta en la agenda del día (spec FR-023).
- Parar en cada checkpoint para validar la historia por separado.
- Si una tarea revela un comportamiento no cubierto por la spec, detener la implementación y actualizar primero la spec (Principio I).
