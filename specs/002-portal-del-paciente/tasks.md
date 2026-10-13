---

description: "Lista de tareas de la 002: Portal del paciente"
---

# Tasks: Portal del paciente

**Input**: Documentos de diseño en `/specs/002-portal-del-paciente/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/interfaz-portal.md](contracts/interfaz-portal.md), [quickstart.md](quickstart.md)

**Gobierno (Constitución, Principio I)**: resuelto el 2026-10-13 (T001): Camilo es propietario de la 002 en `specs/MAPA.md` y aprueba la convivencia con la 001. Ya no hay bloqueo para implementar.

**Tests**: INCLUIDOS. Obligatorios por la Constitución (Principio VI) y, para todo lo que toca la agenda, por el Principio III (pruebas que intentan provocar un solape, también simultáneas).

**Convención de trazabilidad**: los identificadores de la 002 coinciden con los de la 001 (`FR-001`, `US1-E2`…), así que en los tests de la 002 se **prefijan con `002:`** entre corchetes: `[002:FR-011][002:US2-E4] no ofrece cancelar a menos de 24 h`. Identificadores válidos: `002:FR-0xx`, `002:US<n>-E<m>` (escenario `m` de la historia `n` de la spec) y `002:SC-0xx`. Los tests de la 001 conservan sus etiquetas sin prefijo. `npm run trazabilidad` (T002) falla si algún FR o escenario de la 002 no aparece en algún test. Los SC de uso medidos por personas (SC-001 a SC-004, SC-007 en parte) se verifican a mano en el [quickstart](quickstart.md) y no entran en el script.

**Datos de pruebas con la semilla**: salvo que se diga otra cosa, los tests de integración de la 002 cargan `cargarSemilla(db, { ancla: '2026-09-28' })` y fijan el reloj en jueves 1 de octubre de 2026, 10:00 (`crearReloj('2026-10-01', '10:00')`). Casos: Claudia Rodríguez Pérez = ficha 8 (39 citas: 10 reservadas, 24 completadas, 3 canceladas, 2 no asistidas); Claudia Ruiz Romero = ficha 13; cita 805 (lunes 5 de octubre, 9:00, Lucía); cita 798 (lunes 5, 16:30, María); cita 960 (jueves 15, 17:45, María); cita 735 (cancelada, 23 de septiembre, 11:00, Jorge).

**Organization**: Tareas agrupadas por historia de usuario. Orden por prioridad: US1 (P1) → US3 (P1) → US2 (P2). **El MVP útil es US1 + US3** (ver citas con un acceso real); US2 (cancelar) añade lo que ahorra las llamadas a recepción.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (ficheros distintos, sin dependencias pendientes)
- **[Story]**: historia a la que pertenece (US1 a US3)
- Todas las rutas son relativas a la raíz del repositorio, según [plan.md](plan.md)

---

## Phase 1: Setup (Gobierno y herramientas)

**Purpose**: Cerrar el requisito de gobierno y preparar la trazabilidad

- [x] T001 Cumplir el requisito de gobierno del Principio I: asignar propietario a `002-portal-del-paciente` en `specs/MAPA.md` (hoy "Sin asignar"), cambiar su estado a "Aprobada" con fecha, y dejar constancia de que Camilo (propietario de la 001) aprueba la relación 002 → 001 ya declarada allí y las tres adiciones aditivas (`cita.cancelada_por_paciente`, `clinica.telefono`, pantalla de pacientes). Actualizar el `Status` de `specs/002-portal-del-paciente/spec.md`. Hecho el 2026-10-13: propietario Camilo, spec aprobada (Principio I).
- [ ] T002 Ampliar `scripts/trazabilidad.js` para comprobar también `specs/002-portal-del-paciente/spec.md`: parametrizar el análisis por spec con un prefijo de etiqueta (`''` para la 001, `002:` para la 002); para la 002, extraer los `FR-0xx` (formato `- **FR-001**:`, sin alias RN) y los escenarios `US<n>-E<m>` con las mismas reglas que la 001 y exigir que el nombre de algún test contenga `[002:<id>]`; el script termina con código distinto de 0 si falta cobertura en cualquiera de las dos specs. Mantener el comportamiento actual para la 001. Ampliar `tests/unitarias/trazabilidad.test.js` con `[SC-008]`-equivalente `[002:SC-009]`: una spec de ejemplo con prefijo y un identificador sin cubrir falla; con todos cubiertos pasa; una etiqueta `[FR-011]` sin prefijo no cubre `FR-011` de la 002.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestructura común que DEBE estar completa antes de cualquier historia

**⚠️ CRITICAL**: Ninguna historia puede empezar hasta terminar esta fase

- [ ] T003 Añadir la migración mínima a `src/db/connection.js` (research D9): tras aplicar `schema.sql`, función idempotente `migrar(db)` que consulta `PRAGMA table_info` y ejecuta `ALTER TABLE … ADD COLUMN` solo si falta: `paciente.acceso_hash TEXT`, `cita.cancelada_por_paciente INTEGER NOT NULL DEFAULT 0 CHECK (cancelada_por_paciente IN (0, 1))` y `clinica.telefono TEXT`; crear el índice único parcial `CREATE UNIQUE INDEX IF NOT EXISTS paciente_acceso_hash ON paciente (acceso_hash) WHERE acceso_hash IS NOT NULL`; ignorar el error "duplicate column name" si otro proceso gana la carrera. Crear `tests/unitarias/migracion.test.js`: `[002:FR-001]` sobre una base creada con el esquema de la 001 (sin las columnas) la migración añade las tres columnas y conserva las filas existentes con `cancelada_por_paciente = 0`; ejecutarla dos veces no falla; dos aperturas simultáneas de la misma base antigua (procesos hijos) terminan sin error.
- [ ] T004 [P] Ampliar `src/domain/clinicas.js`: `crearClinica(db, { nombre, clave, telefono })` admite `telefono` opcional (se normaliza con `normalizarTelefono` de `src/domain/pacientes.js`; uno inválido se rechaza) y añadir `obtenerClinica(db, clinicaId)` → `{ id, nombre, telefono }`. Crear `tests/unitarias/clinicas-telefono.test.js`: `[002:FR-009]` el teléfono se guarda normalizado y se recupera; una clínica sin teléfono devuelve `telefono: null`; un teléfono inválido se rechaza.
- [ ] T005 [P] Ampliar `src/config.js` con `urlPublica` desde `CITACLARA_URL_PUBLICA` (opcional; sin ella, nulo) y documentarlo en `README.md` más adelante (T032).
- [ ] T006 Crear `src/domain/enlaces.js` (research D1, D2): `FORMATO_SECRETO = /^[A-Za-z0-9_-]{43}$/`; `huellaDeSecreto(secreto)` (SHA-256 en hex); `crearOrenovarEnlace(db, { clinicaId, pacienteId })` → `{ ok: true, secreto }` (32 bytes aleatorios en base64url; `UPDATE paciente SET acceso_hash = ? WHERE id = ? AND clinica_id = ?`; `{ ok: false, codigo: 'no_encontrado' }` si la ficha no es de esa clínica); `resolverEnlace(db, secreto)` → `{ pacienteId, clinicaId, nombre, clinica: { nombre, telefono } }` o `null` (secreto con formato incorrecto → `null` sin consultar la base); `tieneEnlace(db, pacienteId)`. El secreto en claro nunca se guarda. Crear `tests/unitarias/enlaces.test.js`: `[002:FR-001]` crear devuelve un secreto de 43 caracteres que resuelve a su paciente; `[002:FR-004][002:US3-E4]` renovar hace que el secreto anterior deje de resolver y el nuevo resuelva; `[002:FR-003][002:US3-E2]` secreto de otra longitud, con caracteres ajenos o desconocido → `null`; `[002:FR-002][002:US3-E3]` alterar un solo carácter de un secreto válido no resuelve a ningún paciente; `[002:FR-004]` ninguna columna de la base contiene el secreto en claro; el paciente de otra clínica no se puede enlazar con la clínica equivocada.
- [ ] T007 [P] Ampliar `src/web/textos.js` con todos los textos nuevos en español de España (sin jerga), según la sección "Textos nuevos" de [contracts/interfaz-portal.md](contracts/interfaz-portal.md): bloque `portal` (saludo, "Próximas citas", "Historial", "Cancelar cita", "Sí, cancelar la cita", "No, volver", "Ver más citas", "Todavía no tienes citas", "Este enlace no es válido…", explicación de plazo "A menos de 24 horas…", los cuatro avisos, teléfono de la clínica; el aviso de cancelación incluye "Cita cancelada: <día y hora>. Si necesitas otra cita, contacta con la clínica."), bloque `pacientes` ("Pacientes", "Crear enlace", "Renovar enlace", "Con enlace", "Sin enlace", aviso de "no volverá a mostrarse") y `estados.cancelada_paciente` = "Cancelada por el paciente" con su icono.
- [ ] T008 Crear `src/web/rutas/portal.js` con el esqueleto del portal (sin acciones todavía): `Router` en `/p/:secreto` que **no usa la sesión de recepción**, un middleware de privacidad que añade `Cache-Control: no-store`, `Referrer-Policy: no-referrer` y `X-Robots-Tag: noindex` a toda respuesta de `/p/…` (research D3), y un middleware que resuelve el secreto con `resolverEnlace`; si es `null`, responde 404 con la página "Este enlace no es válido" (misma respuesta para formato incorrecto, desconocido, renovado u otra clínica) y no continúa. Crear `src/web/vistas/portal.js` con `paginaPortal({ titulo, contenido, clinica })` (cabecera con el nombre de la clínica y sin "Cerrar sesión", `<meta name="robots" content="noindex">`, pie con nombre y teléfono de la clínica o solo el nombre si no tiene) y `vistaEnlaceNoValido()`. Montar `rutasPortal(contexto)` en `src/app.js` **antes** de `cargarSesion` y comprobar que ninguna ruta de recepción cambia. Dentro de `/p/…` el portal tiene sus propias páginas de error (404 para cualquier subruta o método desconocido, y 500 para un fallo interno) con las cabeceras de privacidad, el layout del paciente, el texto "Llama a la clínica" y **sin enlaces a recepción ni a `/agenda`**; ninguna respuesta de error de `/p/…` ni ningún registro del servidor incluye la ruta o URL completa (el secreto no se registra).
- [ ] T009 [P] Ampliar `tests/ayudas/fixture.js`: `crearEntorno` acepta `telefonoClinica`; helper `crearEnlaceDePrueba(e, pacienteId)` → secreto; cliente HTTP sin cookie para `/p/…` (`e.portal.get(ruta)`, `e.portal.post(ruta)`) que no envía ni guarda la cookie de recepción; helper `entornoConSemilla()` → entorno con archivo temporal, `cargarSemilla(db, { ancla: '2026-09-28' })` y reloj en jueves 1 de octubre de 2026, 10:00; y un helper `secretoDemo(n)` que importa `secretoDeDemostracion` de `src/seed/datos.js` (T010 lo crea; T009 se ejecuta después de T010).
- [ ] T010 Datos de demostración (research D7, Principio V): en `src/seed/datos.js` añadir `CLINICA.telefono` (número ficticio de demostración) y `secretoDeDemostracion(n)` = `base64url(SHA-256("citaclara-demo:" + SEMILLA + ":" + n))` (43 caracteres); en `src/seed/seed.js` guardar `telefono` al crear la clínica y, para cada ficha `n` (1–40, en el orden de creación), `acceso_hash = huellaDeSecreto(secretoDeDemostracion(n))`; mostrar en la salida de `npm run seed` el enlace de Claudia Rodríguez Pérez (ficha 8) como `http://localhost:3000/p/<secreto>`. Ampliar `tests/semilla/semilla.test.js`: `[002:FR-020]` tras la carga las 40 fichas tienen enlace, todos distintos y reproducibles entre dos cargas; la clínica tiene teléfono; ninguna cita tiene `cancelada_por_paciente = 1`; los recuentos de la 001 no cambian (996 citas: 793 de historia y 203 reservadas); `[002:FR-020]` la ficha 8 es Claudia Rodríguez Pérez con 39 citas (10 reservadas, 24 completadas, 3 canceladas, 2 no asistidas).

**Checkpoint**: la base, el enlace, el esqueleto de rutas y los datos de demostración están listos; las historias pueden empezar.

---

## Phase 3: User Story 1 - Ver mis citas (Priority: P1) 🎯 MVP (con US3)

**Goal**: el paciente abre su página personal en el móvil y ve sus próximas citas y su historial, sin poder ver las de nadie más.

**Independent Test**: con la semilla (ancla 2026-09-28, reloj jueves 1 de octubre de 2026, 10:00), abrir la página con el enlace de Claudia Rodríguez Pérez y comprobar que sus citas coinciden con los casos conocidos (el enlace se crea en la prueba con `crearEnlaceDePrueba`, sin la pantalla de recepción).

### Tests for User Story 1

- [ ] T011 [P] [US1] Crear `tests/unitarias/portal-citas.test.js` sobre la semilla: `[002:FR-006][002:US1-E1]` Claudia (ficha 8) tiene 10 próximas, la primera la cita 805 (lunes 5 de octubre, 9:00, Lucía) y la última la 960 (jueves 15, 17:45, María), por inicio ascendente; `[002:FR-006][002:FR-007][002:US1-E2]` su historial tiene 29 citas (24 completadas, 3 canceladas, 2 no asistidas), la primera la 768 (viernes 25 de septiembre, 9:45, completada), incluida la 735 cancelada; `[002:US1-E3]` las citas 967 (Jorge, 17:30) y 960 (María, 17:45) del 15 de octubre aparecen ambas, sin ocultar ninguna; `[002:FR-008]` una cita cancelada con fecha futura va al historial y no a "Próximas"; `[002:FR-006]` una cita reservada cuyo inicio ya pasó va al historial; `[002:FR-002][002:US1-E4]` las citas de la ficha 8 nunca incluyen citas de la ficha 13 (Claudia Ruiz Romero) ni de la 26; `[002:FR-010][002:US1-E5]` un paciente sin citas devuelve dos listas vacías; `[002:FR-007]` el historial paginado de 10 en 10 devuelve las 29 sin repetir ni saltar ninguna.
- [ ] T012 [P] [US1] Crear `tests/integracion/portal-ver.test.js` con el cliente sin cookie: `[002:FR-006][002:US1-E1]` `GET /p/<secreto de Claudia>` muestra "Próximas citas" con 10 tarjetas y la primera "lunes 5 de octubre de 2026, 9:00 · Lucía · Consulta de nutrición"; `[002:FR-007][002:FR-018]` fechas con el formato `es-ES` y "hora de España" sin ambigüedad, estado con texto e icono y ningún precio ni texto en inglés; `[002:FR-007]` el historial muestra 10 citas y el enlace "Ver más citas" (`?h=20`, `?h=30` muestran 20 y 29); `[002:FR-009]` el teléfono y el nombre de la clínica aparecen en la página; `[002:FR-010][002:US1-E5]` un paciente sin citas ve "Todavía no tienes citas" y el teléfono de la clínica; `[002:US1-E4]` el enlace de Claudia Ruiz Romero no muestra ninguna cita de Claudia Rodríguez Pérez; `[002:FR-019][002:US1-E6]` la página incluye `<meta name="viewport" content="width=device-width, initial-scale=1">` y ningún elemento con anchura fija en píxeles mayor que 360 en la hoja de estilos del portal (la comprobación visual a 375 px y 1366 px es manual: T034).

### Implementation for User Story 1

- [ ] T013 [US1] Crear `src/domain/portal.js` con `citasDelPaciente(db, { pacienteId, clinicaId }, ahora, { limiteHistorial = 10 } = {})` → `{ proximas, historial, totalHistorial, hayMas }` (research D5, [data-model.md](data-model.md)): próximas = `estado = 'reservada'` e `inicio > ahora`, por `inicio` ascendente; historial = el resto, por `inicio` descendente, recortado a `limiteHistorial`; cada cita lleva `id`, `inicio`, `fin`, `estado`, `canceladaPorPaciente`, nombre del profesional y del servicio (sin precio), y las próximas llevan `sePuedeCancelar` (se calcula aquí para que la lista se construya de una vez; solo lo usa la US2) (`inicio − ahora ≥ 24 h`, inclusivo) calculado con el reloj inyectado. Toda consulta filtra por `paciente_id` y `clinica_id`.
- [ ] T014 [US1] Crear la vista de la página personal en `src/web/vistas/portal.js`: `vistaPaginaPortal({ paciente, clinica, citas, aviso, limite })` según [contracts/interfaz-portal.md](contracts/interfaz-portal.md): saludo con el primer nombre, bloque "Próximas citas" (tarjetas con día y hora con `formatoFechaHora` de `src/domain/tiempo.js`, profesional, servicio y estado con texto e icono reutilizando `textos.estados`; el botón "Cancelar cita" o la explicación del plazo con el teléfono se añaden en T030), bloque "Historial" con "Ver más citas" (`?h=<n+10>`) y el mensaje de "Todavía no tienes citas". Todo texto desde `src/web/textos.js`; todo valor escapado con `esc`.
- [ ] T015 [US1] Añadir `GET /p/:secreto` en `src/web/rutas/portal.js`: lee `h` (entero positivo múltiplo de 10; cualquier otro valor → 10; sin tope: se acota al total del historial, para poder recorrerlo completo, FR-007), llama a `citasDelPaciente` con el reloj inyectado y responde con `vistaPaginaPortal`. Aceptar `aviso` solo de la lista cerrada del contrato; otro valor se ignora.
- [ ] T016 [P] [US1] Añadir los estilos del portal a `src/web/publico/estilos.css`: una columna (máximo 40 rem), tarjetas por cita, estado con borde e icono, botones de al menos 44 px de alto, contraste AA, saludo y pie con el teléfono de la clínica legibles desde 360 px, sin anchuras fijas mayores que 360 px y sin desplazamiento horizontal; reutilizar las variables de color y tipografía de la 001.

**Checkpoint**: US1 funciona y se puede probar sola con enlaces creados desde las pruebas.

---

## Phase 4: User Story 3 - Entrar sin cuenta ni contraseña (Priority: P1)

**Goal**: recepción da a cada paciente su enlace personal y puede renovarlo; el paciente entra sin cuenta; nadie ve datos de otro.

**Independent Test**: en recepción, crear el enlace de Claudia Rodríguez Pérez, abrirlo y ver su página; renovarlo y comprobar que el anterior deja de funcionar; cambiar un carácter del enlace y no ver ningún dato.

### Tests for User Story 3

- [ ] T017 [P] [US3] Crear `tests/integracion/portal-acceso.test.js` con el cliente sin cookie: `[002:FR-001][002:US3-E1]` el enlace de Claudia abre su página sin teclear nada ni enviar cookie; `[002:FR-003][002:US3-E2]` secreto inventado, de longitud errónea, con caracteres ajenos o renovado → 404 con "Este enlace no es válido" y "Llama a la clínica", y **el mismo cuerpo** en los cuatro casos (comparación de HTML exacta); `[002:FR-002][002:US3-E3]` alterar un carácter del enlace de Claudia nunca devuelve datos de otra paciente (recorrer las 43 posiciones); la página de enlace no válido no contiene ningún nombre de paciente ni de clínica; `[002:FR-002][002:SC-006]` el enlace de una clínica no abre fichas de otra (segunda clínica del fixture); `[002:FR-005][002:US3-E5]` todas las respuestas de `/p/…` (200, 404, confirmación) llevan `Cache-Control: no-store`, `Referrer-Policy: no-referrer` y `X-Robots-Tag: noindex`, y las páginas incluyen `<meta name="robots" content="noindex">`; `[002:FR-001]` ninguna respuesta de `/p/…` incluye `Set-Cookie`; `[002:FR-005][002:FR-003]` una subruta desconocida (`/p/<s>/otra`, `/p/`) y un fallo interno forzado devuelven las páginas de error del portal, sin enlace a `/agenda` ni a recepción y sin el secreto en el cuerpo; el registro de errores del servidor no contiene el secreto; la cookie de recepción válida no da acceso a `/p/…` ni cambia su resultado.
- [ ] T018 [P] [US3] Crear `tests/integracion/pacientes-enlace.test.js` con el cliente de recepción: `[002:FR-004]` sin sesión, `GET /pacientes` y `POST /pacientes/:id/enlace` redirigen a `/acceso` (303) y no devuelven datos; `[002:FR-004]` un `POST` sin token CSRF devuelve 403; `[002:FR-004][002:US3-E1]` `GET /pacientes` lista los pacientes de la clínica por nombre con "Con enlace"/"Sin enlace" y el buscador `q` filtra sin distinguir tildes ni mayúsculas ("rodriguez perez" encuentra a Claudia Rodríguez Pérez); `[002:FR-004][002:US3-E4]` `POST /pacientes/:id/enlace` responde 200 (sin redirección) con el enlace completo `…/p/<secreto>` y el aviso de que no volverá a mostrarse, el enlace abre la página de ese paciente y, tras renovarlo, el anterior da 404 y el nuevo funciona; `[002:FR-004]` el secreto no vuelve a aparecer en `GET /pacientes` ni en ninguna otra pantalla; `[002:FR-004]` un paciente de la otra clínica o inexistente devuelve 404 y no cambia ningún enlace; `[002:FR-004]` el enlace usa `CITACLARA_URL_PUBLICA` si existe y el host de la petición si no.

### Implementation for User Story 3

- [ ] T019 [US3] Ampliar `src/domain/pacientes.js` con `listarPacientes(db, clinicaId, { q } = {})` → pacientes por nombre con `{ id, nombre, telefono, email, conEnlace }`; la búsqueda normaliza tildes y mayúsculas (`normalize('NFD')`) y busca en el nombre. Test en `tests/unitarias/pacientes.test.js`: `[002:FR-004]` filtro por nombre con y sin tildes, orden por nombre, `conEnlace` correcto y aislamiento por clínica.
- [ ] T020 [P] [US3] Crear `src/web/vistas/pacientes.js`: `vistaPacientes({ pacientes, q, sesion, aviso })` (lista con nombre, teléfono, email, "Con enlace"/"Sin enlace", buscador y botón "Crear enlace" o "Renovar enlace" por fila, utilizable a 375 px), `vistaConfirmarRenovar({ paciente, sesion })` ("Renovar el enlace deja de valer el anterior. ¿Continuar?") y `vistaEnlaceCreado({ paciente, enlace, sesion })` (enlace completo en un campo de solo lectura, texto "Este enlace no volverá a mostrarse. Si se pierde, renuévalo"). Usar `pagina()` de `src/web/vistas/base.js` y los textos de T007.
- [ ] T021 [US3] Crear `src/web/rutas/pacientes.js` según el contrato (`exigirSesion`, y `exigirCsrf` en el `POST`): `GET /pacientes`, `GET /pacientes/:id/enlace` (confirmación si ya tiene enlace; formulario de creación si no) y `POST /pacientes/:id/enlace` (llama a `crearOrenovarEnlace`; 200 con la pantalla del enlace, sin redirección; paciente ajeno o inexistente → 404). Componer el enlace con `config.urlPublica` o, si no existe, con `req.protocol` y `req.get('host')`. Montar `rutasPacientes(contexto)` en `src/app.js` tras `cargarSesion` y añadir el enlace "Pacientes" a la cabecera de recepción en `src/web/vistas/base.js`.

**Checkpoint**: US1 y US3 juntas son el MVP: recepción da el enlace, el paciente ve sus citas y nadie ve las de otro.

---

## Phase 5: User Story 2 - Cancelar una cita futura (Priority: P2)

**Goal**: el paciente cancela una cita futura (hasta 24 h antes) con confirmación explícita; el hueco queda libre y recepción ve que cancelaron el paciente.

**Independent Test**: con la semilla, cancelar la cita 798 de Claudia desde el portal con el reloj en jueves 1 de octubre, 10:00: la cita pasa a "cancelada", sale de "Próximas", el tramo de María del lunes 5 de octubre de 16:30 a 17:15 aparece libre en recepción con "Cancelada por el paciente" y se puede reservar de nuevo.

### Tests for User Story 2 (incluidas las pruebas de solape del Principio III)

- [ ] T022 [P] [US2] Crear `tests/unitarias/portal-cancelar.test.js` sobre la semilla: `[002:FR-013][002:US2-E1]` cancelar la 798 la deja `cancelada` con `cancelada_por_paciente = 1` y la saca de "Próximas"; `[002:FR-011][002:US2-E4]` con el reloj en domingo 4 de octubre de 2026, 10:00, la 805 (23 h) se rechaza con `fuera_de_plazo` y no cambia, y la 798 (30 h 30 min) se acepta; `[002:FR-011]` límite inclusivo: exactamente 24 h antes se acepta y 24 h menos un minuto se rechaza; `[002:FR-011]` el plazo se mide en tiempo real transcurrido: una cita del lunes 26 de octubre de 2026 a las 9:00 cancelada el sábado 24 a las 9:00 (hora de España, cruzando el cambio de hora del 25 de octubre, 49 h reales) se acepta y la misma cancelada el domingo 25 a las 9:30 (23,5 h reales) se rechaza (crear esas citas en el entorno de pruebas); `[002:US2-E5]` una cita `completada`, `cancelada` o `no_asistida` devuelve `no_reservada` y no cambia; `[002:FR-002]` una cita de otro paciente (la 805 pedida con el enlace de Claudia Ruiz Romero), de otra clínica o inexistente devuelve `no_encontrada` y no cambia; `[002:FR-013]` el portal no puede producir ningún estado distinto de `cancelada` ni cambiar horarios, profesional o servicio de la cita; `[002:FR-015][002:US2-E6]` cancelar dos veces seguidas: la primera `ok`, la segunda `no_reservada`, la cita sigue cancelada una sola vez.
- [ ] T023 [P] [US2] Crear `tests/integracion/portal-cancelar.test.js` con el cliente sin cookie: `[002:FR-012][002:US2-E3]` `GET /p/<s>/citas/798/cancelar` muestra la confirmación con día, hora, profesional y servicio, y **no cancela** (la cita sigue reservada); "No, volver" apunta a `/p/<s>`; `[002:FR-013][002:FR-016][002:US2-E1][002:US2-E8]` `POST` → 303 a `?aviso=cancelada&cita=798`, y la página muestra "Cita cancelada" con día y hora y el texto "Si necesitas otra cita, contacta con la clínica", y la cita en el historial como "Cancelada" y fuera de "Próximas"; `[002:FR-011][002:US2-E4]` con el reloj en domingo 4 de octubre 10:00, la 805 no muestra "Cancelar cita", muestra la explicación de 24 h con el teléfono de la clínica, y `GET`/`POST` directos sobre ella redirigen con `aviso=fuera-de-plazo` sin cambiar nada; `[002:US2-E5]` las citas del historial no ofrecen ninguna acción y un `POST` directo sobre ellas devuelve el aviso correspondiente sin cambios; `[002:FR-015][002:FR-016][002:US2-E6][002:US2-E7]` si recepción cancela la cita entre la confirmación y el `POST`, el `POST` redirige con `aviso=ya-cancelada` y la lista muestra su estado real; si recepción la marca completada, muestra que ya no se puede cancelar desde aquí; `[002:FR-002]` `GET`/`POST` sobre una cita de otra paciente → `aviso=no-disponible`, sin cambios ni datos de la cita; `[002:FR-016]` ningún camino muestra "cancelada" si la cita no lo está.
- [ ] T024 [P] [US2] Crear `tests/integracion/agenda-cancelada-por-paciente.test.js` con el cliente de recepción: `[002:FR-017][002:US2-E2]` tras cancelar la 798 desde el portal, la agenda de María del lunes 5 de octubre de 2026 muestra el tramo de 16:30 a 17:15 libre y reservable, y su histórico del día dice "Cancelada por el paciente"; `[002:FR-017]` una cita cancelada por recepción (p. ej. la 859) sigue mostrando "Cancelada" a secas; `[002:FR-017]` las 3 canceladas históricas de la semilla muestran "Cancelada"; `[002:US2-E2][002:FR-014]` recepción puede dar de alta una cita nueva en ese hueco y queda registrada; `[002:FR-017]` ningún botón ni paso nuevo aparece en la agenda de recepción.
- [ ] T025 [US2] Crear `tests/concurrencia/trabajador-portal.js` (proceso hijo, hermano de `tests/concurrencia/trabajador.js`, que no entra en el glob de `npm test`): recibe `{ ruta, clinicaId, ahora, arranque, tipo, ... }`, espera al instante `arranque`, abre la misma base y ejecuta `cancelarComoPaciente`, `cambiarEstado` (recepción) o `crearCita` según `tipo`, e imprime el resultado en JSON. Crear `tests/concurrencia/cancelacion-simultanea.test.js` (misma mecánica de `lanzarJuntos` que `alta-simultanea.test.js`): `[002:SC-005][002:FR-015]` 20 o más procesos cancelan la misma cita 798 a la vez → exactamente 1 `ok` y el resto `no_reservada`, la cita queda `cancelada` y `haySolapes` es falso; `[002:FR-015]` cancelación del paciente contra `cambiarEstado` de recepción sobre la misma cita (a `completada`, `no_asistida` y `cancelada`, en tres rondas con el reloj en el instante de inicio) → solo una gana, el estado final coincide con el ganador y la otra recibe el rechazo de "no reservada"; `[002:FR-014][002:SC-005]` (Principio III) cancelación de la 798 contra 20 o más altas de recepción para el hueco de María de 16:30 a 17:15 y para huecos parcialmente solapados (16:15, 16:45) → al terminar, `haySolapes` es falso, como mucho una cita nueva ocupa el hueco y, si alguna alta ganó, la cancelación ya se había aplicado; `[002:FR-014]` cancelaciones de dos citas distintas de la misma paciente a la vez → ambas se aplican (no se bloquean entre sí).

### Implementation for User Story 2

- [ ] T026 [US2] Ampliar `src/domain/portal.js` con `cancelarComoPaciente(db, { pacienteId, clinicaId, citaId }, ahora)` (research D4): dentro de `enTransaccionInmediata`, leer la cita por `id`, `paciente_id` y `clinica_id` (si no existe → `{ ok: false, codigo: 'no_encontrada' }`); exigir `estado = 'reservada'` (si no → `no_reservada`, devolviendo el estado real); exigir `inicio − ahora ≥ 24 h` en milisegundos (si no → `fuera_de_plazo`); ejecutar `UPDATE cita SET estado = 'cancelada', cancelada_por_paciente = 1 WHERE id = ? AND estado = 'reservada'` y comprobar `changes` (0 → `no_reservada`). Devolver `{ ok: true, cita }` con inicio, profesional y servicio para el mensaje de confirmación. No reutiliza `cambiarEstado` (justificación en research D4).
- [ ] T027 [P] [US2] Ampliar `src/domain/agenda.js`: la consulta del día incluye `c.cancelada_por_paciente AS canceladaPorPaciente` para las citas del histórico del día. Sin cambiar ninguna regla de huecos libres.
- [ ] T028 [P] [US2] Ampliar `src/web/vistas/agenda.js`: una cita `cancelada` con `canceladaPorPaciente` se muestra con la insignia "Cancelada por el paciente" (texto e icono, de `textos.estados.cancelada_paciente`); el resto de las canceladas no cambia (FR-017). Sin controles nuevos.
- [ ] T029 [US2] Ampliar `src/web/vistas/portal.js` con `vistaConfirmarCancelacion({ cita, secreto, clinica })` (día y hora, profesional, servicio, "¿Seguro que quieres cancelar esta cita?", formulario `POST` "Sí, cancelar la cita" y enlace "No, volver" a `/p/<secreto>`; sin JavaScript) y los cuatro avisos del contrato; ampliar `vistaPaginaPortal` (T014): en cada próxima con `sePuedeCancelar`, un enlace con aspecto de botón "Cancelar cita" a `/p/<secreto>/citas/<id>/cancelar`; si no, la explicación del plazo con el teléfono de la clínica (FR-011).
- [ ] T030 [US2] Añadir en `src/web/rutas/portal.js` `GET /p/:secreto/citas/:id/cancelar` (muestra la confirmación solo si la cita es de la paciente, está reservada y dentro del plazo; si no, 303 a `/p/:secreto?aviso=…` con la causa; **nunca cancela**) y `POST /p/:secreto/citas/:id/cancelar` (llama a `cancelarComoPaciente` y redirige 303 según la tabla de resultados del contrato: `cancelada`, `ya-cancelada`, `fuera-de-plazo`, `no-disponible`). Identificador de cita no numérico → `no-disponible`. Sin CSRF propio (research D3): la credencial es el secreto de la ruta.
- [ ] T031 [P] [US2] Ampliar `tests/integracion/textos.test.js` (existente de la 001): `[002:FR-018][002:SC-008]` ninguna página del portal ni la pantalla de pacientes contiene palabras en inglés ni jerga técnica ("token", "hash", "ID", "error 404", "null", "undefined"), todas las fechas usan el formato `es-ES` y las horas llevan su contexto de hora de España; y que todos los textos de las vistas nuevas salen de `src/web/textos.js`.

**Checkpoint**: las tres historias funcionan juntas; el Cero Solapes se mantiene con el portal, recepción y las altas.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Documentación, revisión de interfaz y cierre

- [ ] T032 [P] Actualizar `README.md`: sección del portal del paciente (ruta `/p/<enlace>`, pantalla "Pacientes" para crear y renovar enlaces, aviso de que el enlace solo se ve al crearlo o renovarlo), la variable `CITACLARA_URL_PUBLICA`, el enlace de demostración de Claudia Rodríguez Pérez (el que imprime `npm run seed`), y el aviso de que los enlaces de la semilla son solo de demostración. Enlazar la spec 002 y su quickstart.
- [ ] T033 Ejecutar `npm run seed`, copiar el enlace de Claudia Rodríguez Pérez al `quickstart.md` en lugar de `<secreto-de-la-ficha-8>` y comprobar uno por uno los casos de su tabla (ancla 2026-09-28).
- [ ] T034 Revisión manual de interfaz con Chrome headless y axe-core (WCAG 2 A/AA, 2.1 AA, 2.2 AA), como en la 001, sobre mi página (con y sin aviso), confirmación de cancelación, enlace no válido y pantalla de pacientes, a 375 px y 1366 px (y 360 px como mínimo): 0 incidencias, sin desplazamiento horizontal, controles de al menos 44 px, capturas revisadas a mano. Registrar el resultado en `plan.md` junto a las "Decisiones del plan que conviene revisar", con control negativo (`[002:FR-019][002:US1-E6]` cubre la parte automatizable en T012).
- [ ] T035 Recorrido manual del [quickstart](quickstart.md) sección 2 (pasos 1 a 7) y de la sección 4 (SC-001 y SC-002: cancelar en menos de 1 minuto y localizar la próxima cita en menos de 10 segundos con una persona que no conozca el portal, desde el móvil); anotar los tiempos en el quickstart.
- [ ] T036 Ejecutar `npm test` y `npm run trazabilidad`: todo en verde y todos los FR y escenarios de la 002 con test que los nombre. Confirmar que no se ha modificado el comportamiento de la 001 (los tests de la 001 pasan sin cambios en sus aserciones) y que no hay dependencias nuevas en `package.json`.
- [ ] T037 Revisión de cumplimiento (Gobierno de la Constitución): completar la tabla "Constitution Check" de `plan.md` con la evidencia final (III: resultados de T025; V: recuentos de T010; VI: salida de T036), actualizar `specs/MAPA.md` (estado de la 002 a "Cerrada" con fecha) y el `Status` de la spec, y dejar a Sonia y a Sara el seguimiento de SC-003 y SC-004 (8 semanas tras el despliegue).

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: T001 (gobierno) está resuelta; T002 abre la fase.
- **Foundational (Phase 2)**: depende de T001. Bloquea todas las historias.
- **User Stories (Phase 3+)**: dependen de la Phase 2. US1 y US3 (ambas P1) son el MVP; US2 depende de poder ver las citas (T013, T014) y de la ruta base (T015).
- **Polish (Phase 6)**: depende de las historias que se vayan a entregar.

### Dentro de Phase 2

- T003 (migración) antes que T004, T006, T010 (usan las columnas nuevas).
- T006 (enlaces) antes que T008 (ruta) y T009/T010 (fixture y semilla usan la huella).
- T007 (textos) antes que T008.
- T010 antes que T009 (el fixture usa `secretoDeDemostracion`); ambos antes de cualquier test de integración de las historias.

### User Story Dependencies

- **US1 (P1)**: tras la Phase 2. No depende de otras historias.
- **US3 (P1)**: tras la Phase 2. Independiente de US1 (se prueba con la pantalla de recepción y el enlace); juntas forman el MVP.
- **US2 (P2)**: tras la Phase 2 y T013–T015 (necesita mostrar la página para ofrecer el botón). T026–T028 son independientes de US3.

### Dentro de cada historia

- Los tests se escriben antes y deben fallar antes de implementar (los de la historia, no los de Foundational).
- Dominio (`portal.js`) → vistas → rutas.
- Mismo fichero = secuencial: `src/web/rutas/portal.js` (T008, T015, T030), `src/web/vistas/portal.js` (T008, T014, T029), `src/domain/portal.js` (T013, T026).

### Parallel Opportunities

- Phase 2: T004, T005, T007 en paralelo tras T003; T010 tras T006 (T009 va después de T010).
- US1: T011 y T012 (tests) en paralelo; T016 (CSS) en paralelo con T013–T015.
- US3: T017 y T018 en paralelo; T019 con T020.
- US2: T022, T023, T024 en paralelo; T027 y T028 en paralelo con T026; T031 al final.
- US1 y US3 pueden desarrollarse en paralelo por personas distintas tras la Phase 2.

### Ejemplo de ejecución en paralelo (US2)

```text
En paralelo: T022 (unitarias de cancelar), T023 (integración del portal), T024 (agenda de recepción)
Después: T026 (dominio) → T029 (vistas) → T030 (rutas)
En paralelo con T026: T027 (consulta de agenda) y T028 (etiqueta en la agenda de recepción)
Al final: T025 (concurrencia, necesita T026) y T031 (textos)
```

---

## Implementation Strategy

### MVP primero (US1 + US3)

1. T001 ya cerrada; hacer T002.
2. Phase 2 completa (T003–T010).
3. US1 (T011–T016) y US3 (T017–T021).
4. **Parar y validar**: quickstart sección 2, pasos 1 a 3. Es ya útil: el paciente consulta sus citas sin llamar.

### Entrega incremental

1. Añadir US2 (T022–T031) y validar los pasos 4 a 7 y la concurrencia (SC-005).
2. Polish (T032–T037).

### Trabajo por varias personas o agentes

Tras la Phase 2, una persona hace US1 y otra US3; US2 empieza cuando T013–T015 estén integradas. Toda tarea que escriba en la agenda (T026, T025) se revisa contra la Constitución III con las pruebas de T025 antes de fusionar.

## Notes

- `[P]` = ficheros distintos y sin dependencias pendientes.
- Commit al terminar cada tarea o grupo lógico; parar en cada checkpoint para validar la historia.
- Si durante la implementación aparece un comportamiento no cubierto por la spec, se detiene el trabajo y se actualiza antes la spec (Principio I).
