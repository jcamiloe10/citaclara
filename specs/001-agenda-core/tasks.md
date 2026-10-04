---

description: "Lista de tareas de la 001: Núcleo de agenda de CitaClara"
---

# Tasks: Núcleo de agenda de CitaClara

**Input**: Documentos de diseño en `/specs/001-agenda-core/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/interfaz-recepcion.md](contracts/interfaz-recepcion.md), [quickstart.md](quickstart.md)

**Tests**: INCLUIDOS. Son obligatorios por la Constitución (Principio VI: cada regla y criterio de aceptación tiene un test que lo referencia) y por el Principio III (pruebas de solape, incluidas las simultáneas).

**Convención de trazabilidad**: el nombre de cada test lleva entre corchetes los identificadores que cubre, por ejemplo `[RN1][US1-E2] rechaza solape con cita reservada`. Identificadores válidos: `RN1` a `RN4`, `FR-0xx` (con sufijo opcional: `FR-002b`, `FR-008b`, `FR-020b`, `FR-020c`), `SC-0xx` y `US<n>-E<m>` (escenario `m` de la historia `n` de la spec). Alias de la spec: RN1 = FR-016, RN2 = FR-020, RN3 = FR-020b, RN4 = FR-020c (etiquetar con cualquiera de los dos cubre ambos). `npm run trazabilidad` (T008) falla si alguna RN, FR o escenario no aparece en algún test. Los SC de uso medidos por personas (SC-002, SC-003) se verifican a mano en el quickstart y no entran en el script.

**Organization**: Tareas agrupadas por historia de usuario para poder implementar y probar cada una de forma independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (ficheros distintos, sin dependencias pendientes)
- **[Story]**: historia a la que pertenece (US1 a US4)
- Todas las rutas son relativas a la raíz del repositorio, según la estructura de [plan.md](plan.md)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Gobierno e inicialización del proyecto

- [x] T001 Crear `specs/MAPA.md` con una fila por spec y su propietario, y asignar propietario a `001-agenda-core`. Hecho el 2026-10-02: propietario Camilo, spec aprobada (Principio I).
- [x] T002 Crear `package.json` (tipo `module`, motor `node >=24`, única dependencia de producción `express`) con los scripts `start`, `seed`, `test` (`node --test "tests/**/*.test.js"`, con glob explícito para no recoger `trabajador.js` ni ayudas) y `trazabilidad`; crear `.gitignore` (`node_modules/`, `data/`); ejecutar `npm install`.
- [x] T003 [P] Crear la estructura de carpetas vacía del plan: `src/db`, `src/domain`, `src/web/rutas`, `src/web/vistas`, `src/web/publico`, `src/seed`, `scripts`, `tests/unitarias`, `tests/integracion`, `tests/concurrencia`, `tests/semilla`, `tests/ayudas`.
- [x] T004 [P] Crear `src/config.js`: puerto (por defecto 3000), ruta de la base (por defecto `data/citaclara.db`) y secreto de firma desde `CITACLARA_SECRETO` (si falta, generar uno aleatorio por proceso).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestructura común que DEBE estar completa antes de cualquier historia

**⚠️ CRITICAL**: Ninguna historia puede empezar hasta terminar esta fase

- [x] T005 Crear `src/db/schema.sql` con las tablas `clinica`, `profesional`, `servicio`, `paciente` y `cita` exactamente como en [data-model.md](data-model.md) (claves foráneas, `CHECK` de `duracion_min > 0`, `precio_centimos >= 0`, `fin > inicio`, estados permitidos), los tres índices, y el disparador `BEFORE INSERT` y `BEFORE UPDATE` sobre `cita` que hace `RAISE(ABORT, 'solape')` si otra cita `reservada` o `completada` del mismo profesional cumple `a.inicio < nuevo.fin AND nuevo.inicio < a.fin` (solo cuando la fila nueva queda `reservada` o `completada`; excluye la propia fila en el `UPDATE`).
- [x] T006 Crear `src/db/connection.js`: única apertura de `node:sqlite`; función `abrirBase(ruta)` que activa claves foráneas, `journal_mode = WAL`, `busy_timeout` de 10 s y aplica `schema.sql` si la base está vacía; helper `enTransaccionInmediata(db, fn)` que ejecuta `BEGIN IMMEDIATE` / `COMMIT` / `ROLLBACK`. Admite ruta `:memory:` y ficheros temporales para pruebas.
- [x] T007 [P] Crear `src/domain/tiempo.js` (zona `Europe/Madrid`, solo con `Intl`): `ahora()` inyectable (reloj sustituible en pruebas), `aInstanteUTC(dia, hora)` y `aLocal(instante)` con partes (día, hora, día de la semana), `esDiaLaborable`, `dentroDeHorario(inicio, fin)` (lunes a viernes, `09:00 ≤ inicio` y `fin ≤ 20:00`), `esMultiploDe15(inicio)` (minutos locales de Madrid múltiplos de 15, RN4), `inicioDelDia` y `finDelDia`, y formateadores `es-ES` ("viernes 2 de octubre de 2026, 10:00", "10:00–10:45", "2 de octubre").
- [x] T008 [P] Crear `scripts/trazabilidad.js`: lee `specs/001-agenda-core/spec.md`, extrae `RN1`..`RN4`, todos los `FR-0xx` (con sufijo de letra opcional) y los escenarios de aceptación de cada historia (`US<n>-E<m>`, por la numeración de cada lista), resuelve los alias RN↔FR (RN1 = FR-016, RN2 = FR-020, RN3 = FR-020b, RN4 = FR-020c; se extraen de las líneas "RN<n> / FR-xxx" de la spec), busca esos identificadores entre corchetes en los nombres de los tests bajo `tests/`, y termina con código distinto de 0 listando los que no tienen cobertura. Excluye FR-008 (límite de alcance, sin comportamiento que probar) y no exige los `SC-0xx` (los de uso, SC-002 y SC-003, se verifican a mano). Añadir un test `[SC-008]` para el propio script en `tests/unitarias/trazabilidad.test.js` (spec de ejemplo con un identificador sin cubrir → falla; todos cubiertos → pasa).
- [x] T009 [P] Crear `src/domain/dinero.js` (`formatearEuros(centimos)` → "40,00 €" con `Intl.NumberFormat('es-ES')`, y rechazo de valores no enteros o negativos) y `tests/unitarias/dinero.test.js` con los precios de la semilla: `[FR-015] 4000 → "40,00 €"`, `5000`, `3500`, `4500`, y `[FR-006]` un importe con decimales o negativo se rechaza.
- [x] T010 [P] Crear `tests/unitarias/tiempo.test.js`: `[FR-028]` formatos `es-ES` sin ambigüedad; `[RN3]` horario (09:00 válido, 08:59 no, fin 20:00 válido, fin 20:01 no, sábado y domingo no); `[RN4]` `esMultiploDe15` (10:00, 10:15, 10:30, 10:45 sí; 10:07 y 10:01 no); `[RN3]` conversión Madrid↔UTC en verano e invierno y en los días de cambio de hora de 2026 (29 de marzo y 25 de octubre) sin ambigüedad en citas de 09:00–20:00.
- [x] T011 Crear `src/domain/pacientes.js`: `validarPaciente({nombre, telefono, email})` (nombre obligatorio y no vacío; teléfono español de 9 dígitos con prefijo `+34` opcional y espacios admitidos, normalizado; email con formato válido) devolviendo errores por campo, y `crearPaciente(db, clinicaId, datos)`. Test en `tests/unitarias/pacientes.test.js`: `[FR-008b]` validaciones (faltan datos, teléfono y email inválidos, normalización) y `[FR-007]` alta correcta.
- [x] T012 Crear `tests/ayudas/fixture.js`: `crearEntorno({ahora})` → base temporal aislada con una clínica "Clínica Eleva" (clave de prueba), María, Jorge y Lucía, los 4 servicios del plan (4000, 5000, 3500 y 4500 céntimos) y 3 pacientes, con reloj fijo (`2026-10-02T08:00` Madrid por defecto); más una **segunda clínica** con otra clave y otros datos (para FR-003 y US2-E8), más `crearApp` y un cliente HTTP mínimo con cookie y CSRF para los tests de integración. No depende del generador de semilla.
- [x] T013 [P] Crear `src/domain/clinicas.js` (`crearClinica(db, {nombre, clave})`, que rechaza una clave ya usada por otra clínica verificándola contra los *hash* existentes, y `identificarPorClave(db, clave)`, que devuelve la clínica cuya clave coincide o nada; FR-003) y `src/web/sesion.js`: `hashClave`/`verificarClave` con `scrypt` y sal (comparación en tiempo constante), emisión y verificación de la cookie de sesión firmada con HMAC (clínica + caducidad a 12 horas, `HttpOnly`, `SameSite=Lax`), token CSRF ligado a la sesión, y middleware `exigirSesion` (sin sesión → 303 a `/acceso`, sin datos) y `exigirCsrf` (falta o no coincide → 403 con mensaje en español).
- [x] T014 [P] Crear `src/web/textos.js` (todos los textos visibles en español de España, sin jerga técnica: mensajes de error por regla, etiquetas de estados "Reservada/Completada/Cancelada/No asistida", botones, avisos) y `src/web/vistas/base.js` (plantilla de página: `<html lang="es">`, `<meta viewport>`, cabecera con nombre de la clínica y botón "Cerrar sesión", función de escape HTML).
- [x] T015 [P] Crear `src/web/publico/estilos.css`: variables de color con contraste AA, tipografía del sistema, botones y controles de ≥ 44 px, rejilla de columnas por profesional que pasa a pila vertical en móvil (sin desplazamiento horizontal), estilos de tramos ocupados/libres y de cada estado (con icono y texto, no solo color), formularios y avisos.
- [x] T016 Crear `src/app.js` (recibe `{db, ahora, secreto}` y construye la aplicación Express: analizador de formularios, estáticos, rutas, manejador de errores en español) y `src/server.js` (abre la base, construye la app y escucha en el puerto de `config.js`). Rutas de acceso en `src/web/rutas/acceso.js`: `GET /acceso`, `POST /acceso` (la clínica se identifica solo por la clave con `identificarPorClave`; clave correcta → cookie y 303 a `/agenda`; incorrecta → 401 con "La clave no es correcta" y sin datos), `POST /salir`; vista del formulario en `src/web/vistas/acceso.js`. `GET /` redirige a `/agenda`.

**Checkpoint**: Base de datos, tiempo, sesión y estructura de página listos; ya se pueden construir las historias.

---

## Phase 3: User Story 1 - Reservar una cita sin solapes (Priority: P1) 🎯 MVP

**Goal**: Dar de alta una cita (con paciente existente o nuevo) que respete RN1, RN2 y RN3, también bajo concurrencia.

**Independent Test**: Con el entorno de prueba, reservar en un hueco libre (fin = inicio + duración), intentar un solape (rechazo, agenda intacta) y lanzar 20 altas simultáneas del mismo hueco (exactamente 1 queda registrada).

### Tests for User Story 1

> Escribir primero y comprobar que FALLAN antes de implementar.

- [x] T017 [P] [US1] Crear `tests/unitarias/citas-alta.test.js` (dominio, sin HTTP): `[US1-E1][FR-010]` alta en hueco libre, fin = inicio + 45 min y estado `reservada`; `[US1-E2][RN1]` solape con reservada; `[US1-E3][RN1]` solape con completada; `[US1-E4][RN1]` adyacente (inicio = fin de otra) se acepta, incluida la que termina justo cuando empieza la otra; `[US1-E5][FR-017]` cancelada y no asistida no bloquean; `[US1-E6][RN2]` en el pasado y con inicio igual a ahora; `[US1-E8][RN3]` antes de las 09:00, terminando después de las 20:00 (primera visita de 60 min a las 19:30) y en fin de semana; `[US1-E9][RN3]` termina exactamente a las 20:00 se acepta; `[US1-E13][RN4]` inicio a las 10:07 se rechaza y a las 10:15 se acepta; `[FR-011]` toda cita nueva nace `reservada`; `[US1-E12]` mismo horario con profesionales distintos; `[FR-009]` profesional, servicio o paciente de otra clínica o inexistente; `[FR-021]` tras cada rechazo la tabla `cita` queda idéntica; solape parcial por delante y por detrás y cita que envuelve a otra.
- [x] T018 [P] [US1] Crear `tests/unitarias/disparador-solape.test.js`: `[RN1][FR-016]` saltándose el servicio, un `INSERT` directo que solapa es rechazado por el disparador; un `UPDATE` de horario o de estado que crearía solape también; los casos adyacentes y los estados `cancelada`/`no_asistida` no disparan. (Prueba de la segunda defensa del Principio III.)
- [x] T019 [P] [US1] Crear `tests/concurrencia/alta-simultanea.test.js` y su trabajador `tests/concurrencia/trabajador.js`: lanza procesos hijos reales contra el mismo fichero de base. `[SC-001][FR-018][US1-E7]` 20 procesos reservan el mismo hueco → exactamente 1 cita registrada y 19 rechazos por "hueco ocupado"; `[FR-018]` 20 procesos con intervalos parcialmente solapados (10:00, 10:15, 10:30… para el mismo profesional) → ningún par solapado en la base; `[US1-E12]` altas simultáneas a la misma hora para profesionales distintos → todas aceptadas; tras cada ronda, verificación global de que no hay solapes en `cita`.
- [x] T020 [P] [US1] Crear `tests/integracion/alta-cita.test.js` (HTTP con sesión): `[US1-E1]` `POST /citas` correcto → 303 a `/agenda` y cita reservada; `[US1-E2][FR-021]` hueco ocupado → 409 con "Ese hueco ya está ocupado", datos conservados en el formulario y sin cita; `[RN2]` 422 pasado; `[RN3]` 422 fuera de horario con su mensaje; `[RN4][US1-E13]` 422 con hora no múltiplo de 15; `[SC-004]` cada rechazo (hueco, pasado, horario, hora, datos incompletos) muestra un motivo y deja la tabla de citas intacta; `[FR-021]` datos incompletos → 422 con mensaje por campo; `[US1-E10][FR-008b]` paciente nuevo → ficha y cita creadas; `[US1-E11][FR-008b]` paciente nuevo con hueco ocupado → rechazo, ficha conservada y preseleccionada, sin duplicar al reintentar; `[FR-025]` `GET /citas/nueva` con `profesional`, `dia` y `hora` precarga el formulario y muestra el fin calculado; sin token CSRF → 403.

### Implementation for User Story 1

- [x] T021 [US1] Crear `src/domain/citas.js` con `crearCita(db, {clinicaId, profesionalId, servicioId, pacienteId, inicio}, ahora)`: valida pertenencia a la clínica, calcula `fin`, aplica RN2 y RN3 con `tiempo.js`, y dentro de `enTransaccionInmediata` comprueba el solape (`a.inicio < fin AND inicio < a.fin`, estados `reservada`/`completada`, mismo profesional) y hace el `INSERT`; devuelve resultado tipado (`ok` o código de rechazo: `ocupado`, `pasado`, `fuera_de_horario`, `datos`, `no_encontrado`). Si el disparador aborta, se traduce a `ocupado`. Depende de T005, T006, T007.
- [x] T022 [US1] Crear la consulta de datos del formulario en `src/domain/agenda.js` (`opcionesAlta(db, clinicaId)`: profesionales, servicios con duración y precio formateado, pacientes con nombre, teléfono y email para distinguir homónimos) y la vista `src/web/vistas/alta-cita.js` (formulario de alta con paciente existente o nuevo, hora de inicio como selector en saltos de 15 minutos de 09:00 a 19:45, fin calculado visible, errores por campo y mensajes de `textos.js`; el bloque de paciente nuevo funciona sin JavaScript, con un fragmento mínimo opcional para mostrarlo u ocultarlo).
- [x] T023 [US1] Crear `src/web/rutas/citas.js` con `GET /citas/nueva` y `POST /citas` según el contrato (códigos 303/409/422, conservar datos y ficha del paciente nuevo tras un rechazo) y registrarlas en `src/app.js` con `exigirSesion` y `exigirCsrf`. La ficha del paciente nuevo se crea en su propia transacción antes de intentar la cita, para que sobreviva al rechazo.

**Checkpoint**: Se pueden reservar citas por HTTP con todas las reglas; la historia 1 es probable y demostrable por sí sola (MVP).

---

## Phase 4: User Story 2 - Ver la agenda del día por profesional (Priority: P2)

**Goal**: Pantalla de agenda del día con tramos ocupados y libres por profesional, protegida por la clave de clínica.

**Independent Test**: Entrar con la clave, abrir un día con citas conocidas del entorno de prueba y comprobar que ocupados, libres, estados y navegación coinciden.

### Tests for User Story 2

- [x] T024 [P] [US2] Crear `tests/integracion/acceso.test.js`: `[US2-E1][FR-001]` sin sesión `GET /agenda` y `POST /citas` redirigen o rechazan y no devuelven datos de la clínica; `[US2-E2][FR-002]` clave incorrecta → 401, mensaje claro y sin datos; `[FR-002b]` clave correcta → cookie `HttpOnly` y acceso; `[US2-E5][FR-002b]` con el reloj avanzado más de 12 horas se vuelve a pedir la clave, y `POST /salir` invalida la sesión; `[FR-003][US2-E8]` cada clínica entra con su propia clave y solo ve sus datos (segunda clínica del fixture), y `crearClinica` con una clave ya usada se rechaza; `[FR-004]` la clave se guarda como hash, nunca en claro.
- [x] T025 [P] [US2] Crear `tests/unitarias/agenda.test.js`: `[FR-022]` tramos de 09:00 a 20:00 por profesional con ocupados y libres calculados a partir de citas conocidas (incluida una cita de 60 min que cruza una hora); `[US2-E4]` canceladas y no asistidas no ocupan tramo pero aparecen como histórico; `[US2-E6]` día sin citas → todo libre; fin de semana → sin tramos reservables; los huecos libres de menos duración que cualquier servicio siguen apareciendo como libres; `[RN4][FR-025]` todos los huecos libres empiezan en múltiplos de 15 minutos y el enlace de cada hueco lleva como hora precargada su inicio.
- [x] T026 [P] [US2] Crear `tests/integracion/agenda.test.js`: `[US2-E3][FR-022][FR-023]` `GET /agenda?dia=…` muestra a María, Jorge y Lucía con horario, paciente, servicio y estado en texto; `[FR-024]` enlaces "Día anterior", "Hoy" y "Día siguiente", y día inicial = hoy; día inválido → 400 con enlace a "Hoy"; `[FR-028]` fechas en formato español sin ambigüedad; `[FR-015]` importes "40,00 €" donde se muestran; `[US2-E7][FR-029][SC-006]` (comprobación estática de apoyo; la comprobación real en móvil es manual, paso 9 del quickstart) la página incluye `<meta viewport>` y la hoja de estilos define la rejilla responsive y no fija anchos mínimos que fuercen desplazamiento horizontal; `[FR-025]` cada hueco libre enlaza al alta con profesional, día y hora precargados.

### Implementation for User Story 2

- [x] T027 [US2] Completar `src/domain/agenda.js` con `agendaDelDia(db, clinicaId, dia)`: por profesional, lista ordenada de tramos de la franja 09:00–20:00 (ocupado con su cita, o libre con inicio y fin) y lista de citas canceladas o no asistidas del día como histórico; usa `tiempo.js` para los límites del día en Madrid.
- [x] T028 [US2] Crear la vista `src/web/vistas/agenda.js` (una columna por profesional en ordenador y pila en móvil, tramos con horario, paciente, servicio y estado con icono y texto, hueco libre como enlace al alta, navegación de días, aviso de "La clínica no abre este día" en fin de semana, avisos de resultado) y la ruta `GET /agenda` en `src/web/rutas/agenda.js`, registrada en `src/app.js` con `exigirSesion`.
- [x] T029 [US2] Revisar `src/web/publico/estilos.css` con la agenda real: estados distinguibles sin depender del color, objetivos táctiles ≥ 44 px, contraste AA, sin desplazamiento horizontal a 375 px; ajustar lo que haga falta.

**Checkpoint**: Historias 1 y 2 funcionan juntas: ver la agenda, pulsar un hueco libre y reservar.

---

## Phase 5: User Story 3 - Cerrar el ciclo de una cita (Priority: P3)

**Goal**: Marcar citas reservadas como completada, cancelada o no asistida respetando las transiciones y liberando huecos.

**Independent Test**: Con citas reservadas pasadas y futuras del entorno de prueba, aplicar cada acción y comprobar estado, hueco y rechazos.

### Tests for User Story 3

- [x] T030 [P] [US3] Crear `tests/unitarias/citas-estado.test.js`: `[US3-E1][FR-012]` completada desde el instante de inicio (inclusive) y sigue ocupando; `[US3-E2][FR-012]` cancelada libera el hueco (se puede reservar de nuevo), también una cita en curso; `[US3-E3][FR-013]` no asistida con inicio pasado libera el hueco; `[US3-E4][FR-013][FR-014]` completada o no asistida antes del inicio → rechazo; `[US3-E5][FR-012]` desde completada, cancelada o no asistida no se puede cambiar de estado (todas las combinaciones); `[FR-019]` ninguna transición crea solape (verificación global tras recorrer todas); `[FR-012]` dos cambios simultáneos sobre la misma cita (procesos hijos) → solo el primero se aplica, el segundo recibe "ya no está reservada".
- [x] T031 [P] [US3] Crear `tests/integracion/estado-cita.test.js`: `[US3-E1]` `POST /citas/:id/estado` correcto → 303 con aviso; `[US3-E4]` 422 "Todavía no ha empezado la cita"; `[US3-E5]` 409 "Esa cita ya no está reservada"; 404 con cita inexistente o de otra clínica `[FR-003]`; estado no permitido → 422; `[FR-026]` la agenda ofrece los tres botones solo en citas reservadas y muestra "Completada" y "No asistida" desactivados, con "Disponible cuando empiece la cita", antes del inicio; `[FR-027]` tras la acción la agenda refleja el cambio (hueco liberado tras cancelar).

### Implementation for User Story 3

- [x] T032 [US3] Añadir a `src/domain/citas.js` `cambiarEstado(db, {clinicaId, citaId, estado}, ahora)`: en `enTransaccionInmediata`, `UPDATE cita SET estado = ? WHERE id = ? AND clinica_id = ? AND estado = 'reservada'` (si no cambia ninguna fila → `no_reservada` o `no_encontrado`), con la regla de inicio para `completada` y `no_asistida`; códigos de rechazo `no_reservada`, `no_ha_empezado`, `estado_invalido`, `no_encontrado`.
- [x] T033 [US3] Añadir la ruta `POST /citas/:id/estado` en `src/web/rutas/citas.js` (códigos 303/404/409/422 del contrato) y los botones de acción por cita reservada en `src/web/vistas/agenda.js` (formularios con CSRF, estado desactivado con explicación antes del inicio), usando `textos.js`.

**Checkpoint**: Ciclo completo de una cita: reservar, ver y cerrar.

---

## Phase 6: User Story 4 - Explorar con datos de demostración (Priority: P3)

**Goal**: Generador determinista e idempotente de "Clínica Eleva" con historia y reservas futuras.

**Independent Test**: Cargar dos veces en bases limpias y comparar contenido idéntico, recuentos y proporciones, ausencia de solapes.

### Tests for User Story 4

- [x] T034 [P] [US4] Crear `tests/semilla/semilla.test.js` con ancla y reloj fijos (la fecha ancla se pasa por parámetro): `[US4-E1][FR-030][FR-031][FR-005]` clínica "Clínica Eleva", María y Jorge (fisioterapia), Lucía (nutrición), los 4 servicios con duración y precio exactos y 40 pacientes con nombre, teléfono y email válidos; `[US4-E2][FR-032]` 8 semanas de historia (40 días laborables) con exactamente el 10 % de `no_asistida` y el 8 % de `cancelada` por cuota (el resto `completada`), y `[SC-005]` dentro de ±2 puntos; `[US4-E3][FR-032]` 2 semanas futuras solo con `reservada`, repartidas entre los tres profesionales y todas posteriores al momento de la carga; `[FR-033]` ninguna cita solapa con otra del mismo profesional, todas dentro del horario de la clínica (RN3), ninguna cita `reservada` en el pasado y todos los estados coherentes con FR-012/013; `[US4-E4][FR-034]` dos cargas en bases distintas producen contenido idéntico (mismas citas, mismos pacientes, mismos estados); `[US4-E5][FR-034]` cargar dos veces sobre la misma base deja el mismo resultado sin duplicados; los recuentos exactos (total de citas y por estado) quedan fijados en el test con la ancla de prueba.
- [x] T035 [P] [US4] Crear `tests/integracion/semilla-agenda.test.js`: `[US4-E3][FR-022]` con la semilla cargada y la clave de demostración, la agenda de un día de la parte futura muestra a los tres profesionales con citas reservadas y huecos libres, y una de la historia muestra los estados cerrados; y `[FR-025]` el alta en un hueco libre de la semilla se completa con una sola petición de formulario cumplimentada (el tiempo de uso, SC-002, se mide a mano en el quickstart).

### Implementation for User Story 4

- [x] T036 [P] [US4] Crear `src/seed/prng.js` (`mulberry32(semilla)` con helpers `entero(min, max)`, `elegir(lista)` y `barajar(lista)`, sin `Math.random` ni reloj).
- [x] T037 [P] [US4] Crear `src/seed/datos.js`: clínica "Clínica Eleva" con clave de demostración `eleva-demo`, profesionales, los 4 servicios (en céntimos: 4000, 5000, 3500, 4500, duraciones 45, 60, 30 y 45), listas de nombres y apellidos españoles para generar 40 pacientes con teléfono de 9 dígitos y email, y las reglas de qué servicios atiende cada profesional (fisioterapia: sesión y primera visita; nutrición: consulta y primera).
- [x] T038 [US4] Crear `src/seed/seed.js` con `cargarSemilla(db, {ancla, semilla})`: en una sola transacción vacía los datos de la clínica demo y los recrea; ancla por defecto = lunes de la semana en curso en Madrid; historia = 8 semanas laborales completas anteriores a la ancla, futuro = 2 semanas laborales completas que empiezan el lunes siguiente a la semana en curso; para cada día y profesional rellena huecos libres de forma determinista (sin pasar por `crearCita`, sin solapes por construcción y dentro de 09:00–20:00); asigna estados históricos por cuota exacta (10 % `no_asistida`, 8 % `cancelada`, resto `completada`) barajando con el PRNG, y deja todas las futuras `reservada`. Añadir el script ejecutable `npm run seed` (abre la base de `config.js`, carga e imprime los recuentos). Depende de T036 y T037.
- [x] T039 [US4] Tras la primera ejecución real de `npm run seed` con una ancla de referencia, completar en [quickstart.md](quickstart.md) los recuentos exactos (total de citas y por estado) en el punto 1 (Principio V) y comprobar que coinciden con los fijados en `tests/semilla/semilla.test.js`.

**Checkpoint**: Las cuatro historias funcionan; la demo se carga con un comando.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Cierre de calidad y gobierno

- [x] T040 [P] Ejecutar `npm test` y `npm run trazabilidad`: corregir cualquier identificador sin cobertura (RN1 a RN4, FR y cada `US<n>-E<m>`) añadiendo o renombrando tests, no desactivándolos (Principio VI).
- [x] T041 [P] Revisar todos los textos de `src/web/textos.js` y de las vistas: español de España, sin jerga técnica, sin formatos de fecha ambiguos y sin anglicismos evitables (Principio VIII, FR-028); añadir un test `[FR-028][SC-007]` que recorra las páginas principales y falle si aparecen términos prohibidos (p. ej. "error 4", "token", "CSRF", "undefined") o fechas numéricas tipo `02/10`.
- [ ] T042 Ejecutar el recorrido manual completo de [quickstart.md](quickstart.md), incluido el paso 9 en un ancho de ~375 px, y anotar en el propio quickstart cualquier desviación respecto a lo observado. **Parcial (2026-10-02)**: pasos 1 a 8 hechos por HTTP contra la aplicación real y paso 9 comprobado a 375 px con Chrome emulando móvil (sin desbordamiento horizontal, capturas revisadas); faltan las mediciones de uso de SC-002 y SC-003 con una persona y, opcionalmente, un móvil físico.
- [x] T043 [P] Comprobar manualmente el contraste y el tamaño de los elementos con las herramientas del navegador (objetivo AA) y registrar el resultado como nota en [plan.md](plan.md), apartado "Decisiones del plan". Hecho el 2026-10-02 con Chrome (modo headless, puppeteer-core) y axe-core sobre acceso, agenda del día, historia y alta, a 375 px y 1366 px: 0 incidencias WCAG 2 A/AA, 2.1 AA, 2.2 AA y buenas prácticas, y 0 controles por debajo de 44 px. Detalle en plan.md, decisión 4.
- [x] T044 Crear o actualizar `README.md` en la raíz con los comandos (`npm install`, `npm run seed`, `npm start`, `npm test`, `npm run trazabilidad`), la clave de demostración y la advertencia de que la autenticación v1 es una deuda consciente.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias. T001 es precondición de implementación para todo el resto (Principio I).
- **Foundational (Phase 2)**: depende de Setup; BLOQUEA todas las historias.
- **US1 (Phase 3)**: depende de Foundational. Es el MVP.
- **US2 (Phase 4)**: depende de Foundational; usa `src/domain/citas.js` solo en pruebas (el fixture inserta citas directamente), de modo que puede avanzar en paralelo con US1.
- **US3 (Phase 5)**: depende de US1 (`citas.js`) y de US2 (`agenda.js` y su vista, donde se añaden los botones).
- **US4 (Phase 6)**: depende de Foundational (esquema y conexión); independiente de US1 a US3 salvo T035, que usa la agenda de US2.
- **Polish (Phase 7)**: depende de todas las historias.

### Dentro de cada historia

- Los tests se escriben primero y deben fallar antes de implementar.
- Dominio antes que rutas; rutas antes que vistas, cuando comparten fichero.
- `src/domain/citas.js` lo tocan T021 (US1) y T032 (US3), y `src/web/rutas/citas.js` lo tocan T023 y T033, y `src/web/vistas/agenda.js` lo tocan T028 y T033: no son paralelizables entre sí.

### Parallel Opportunities

- Setup: T003 y T004 en paralelo.
- Foundational: T007, T008, T009, T010, T013, T014 y T015 en paralelo (ficheros distintos); T011 tras T006; T012 tras T005 a T007; T016 tras T013 a T015.
- US1: T017, T018, T019 y T020 (tests) en paralelo; T021 antes de T022 y T023.
- US2: T024, T025 y T026 en paralelo; T027 antes de T028.
- US4: T034 y T035 en paralelo; T036 y T037 en paralelo; T038 tras ambos.
- US1 y US2 pueden asignarse a dos personas o agentes distintos tras Foundational; US4 también. Dos agentes que escriban en la agenda deben respetar la Regla III (los tests de solape de T018 y T019 se vuelven a ejecutar al integrar).

### Parallel Example: User Story 1

```text
Task: "T017 [P] [US1] Tests de alta en tests/unitarias/citas-alta.test.js"
Task: "T018 [P] [US1] Tests del disparador en tests/unitarias/disparador-solape.test.js"
Task: "T019 [P] [US1] Tests de concurrencia en tests/concurrencia/alta-simultanea.test.js"
Task: "T020 [P] [US1] Tests HTTP en tests/integracion/alta-cita.test.js"
```

---

## Implementation Strategy

### MVP First (solo User Story 1)

1. Phase 1 (con T001 resuelto) y Phase 2 completas.
2. Phase 3 (US1): tests en rojo, implementación, tests en verde.
3. **PARAR y VALIDAR**: `npm test` en verde, incluida la prueba de 20 altas simultáneas; reserva demostrable por HTTP.

### Entrega incremental

1. Setup + Foundational → base lista.
2. US1 → reservas sin solapes (MVP).
3. US2 → agenda visible y reserva desde un hueco libre.
4. US3 → ciclo de vida completo de la cita.
5. US4 → demo reproducible con cifras publicadas.
6. Polish → trazabilidad, textos, recorrido manual y README.

### Notas

- [P] = ficheros distintos, sin dependencias pendientes.
- Hacer commit tras cada tarea o grupo lógico.
- Detenerse en cada checkpoint para validar la historia por separado.
- Si una tarea revela un comportamiento no cubierto por la spec, parar y actualizar primero la spec (Principio I).
