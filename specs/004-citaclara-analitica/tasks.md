---

description: "Lista de tareas de la 004: Panel de analítica de CitaClara"
---

# Tasks: Panel de analítica de CitaClara

**Input**: Documentos de diseño en `/specs/004-citaclara-analitica/`

**Prerequisites**: [plan.md](plan.md), [spec.md](spec.md), [research.md](research.md), [data-model.md](data-model.md), [contracts/panel-analitica.md](contracts/panel-analitica.md), [quickstart.md](quickstart.md)

**Tests**: INCLUIDOS. Son obligatorios por la Constitución (Principio VI: cada FR y escenario de aceptación tiene un test que lo referencia) y por SC-002 (garantía de cero escrituras).

**Convención de trazabilidad**: el nombre de cada test lleva entre corchetes los identificadores que cubre, **con el prefijo `004-`** (p. ej. `[004-FR-004][004-US1-E1]`), porque esta spec reinicia su numeración de `FR-001` y colisionaría con la de 001-agenda-core si no se distingue (research.md, D6; solo la 001 conserva sus etiquetas sin prefijo, por ser anterior y estar cerrada). Identificadores válidos de esta spec: `004-FR-0xx`, `004-SC-0xx` y `004-US<n>-E<m>`. `npm run trazabilidad` (T007) falla si falta alguno. SC-003 (tiempo de uso medido con una persona) y SC-004 (comprobación en móvil) se verifican a mano en el quickstart y no entran en el script.

**Organization**: Tareas agrupadas por historia de usuario para poder implementar y probar cada una de forma independiente.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: se puede ejecutar en paralelo (ficheros distintos, sin dependencias pendientes)
- **[Story]**: historia a la que pertenece (US1, US2)
- Todas las rutas son relativas a la raíz del repositorio, según la estructura de [plan.md](plan.md)

---

## Phase 1: Setup (Governance)

**Purpose**: Resolver la condición de gobierno pendiente antes de que pueda empezar la implementación (Principio I; ver plan.md, Constitution Check)

- [X] T001 En `specs/MAPA.md`, añadir una fila para `004-citaclara-analitica` con su propietario y su relación con `001-agenda-core` (de quien solo lee); actualizar `**Status**` en `specs/004-citaclara-analitica/spec.md` de `Draft` a `Aprobada` con la fecha. Sin esto, `/speckit-implement` no debe escribir código (Principio I). Hecho el 2026-10-13: propietario Camilo (igual que 001), spec aprobada.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Infraestructura común que DEBE estar completa antes de cualquier historia

**⚠️ CRITICAL**: Ninguna historia puede empezar hasta terminar esta fase

- [X] T002 [P] En `src/db/connection.js`, añadir `abrirBaseSoloLectura(rutaBase)`: abre una segunda `DatabaseSync` sobre el mismo fichero y configura `setAuthorizer` para permitir únicamente acciones de lectura (`SQLITE_SELECT`, `SQLITE_READ`, `SQLITE_FUNCTION`, `SQLITE_RECURSIVE` y las necesarias para `ORDER BY`/agregados) y denegar cualquier otra (`SQLITE_INSERT`, `SQLITE_UPDATE`, `SQLITE_DELETE`, `SQLITE_CREATE_*`, `SQLITE_DROP_*`, `SQLITE_ALTER_TABLE`, `SQLITE_TRANSACTION` de escritura, etc.) devolviendo `SQLITE_DENY` (research.md, D2).
- [X] T003 [P] Crear `tests/solo-lectura/autorizador.test.js`: `[004-FR-003]` sobre la conexión de `abrirBaseSoloLectura`, un `INSERT`, un `UPDATE` y un `DELETE` directos sobre `cita` (y sobre `clinica`) son rechazados por el autorizador; las consultas `SELECT` con `JOIN`, `ORDER BY` y funciones agregadas (`SUM`, `COUNT`) de las que necesitará `domain/analitica.js` funcionan con normalidad.
- [X] T004 [P] En `src/domain/analitica.js` (fichero nuevo), crear `ventanaDeOchoSemanas(ahora)`: devuelve `{ inicio, fin, semanas }` — el lunes de hace 8 semanas laborales completas y el lunes de la semana en curso (exclusivo), usando `lunesDeLaSemana` y `sumarDias` de `domain/tiempo.js` (data-model.md, "Periodo analizado"); si la clínica tiene menos historia, `semanas` refleja las que realmente existen (se ajusta en T011/T018, no aquí). Añadir `tests/unitarias/analitica.test.js` con un primer test `[004-FR-007]` de esta función con fechas conocidas.
- [X] T005 Crear `src/web/rutas/analitica.js` con el esqueleto `GET /analitica` (`exigirSesion`, lee `req.sesion.clinicaId`, por ahora renderiza una página vacía); registrar la ruta en `src/app.js` (que ahora recibe también `dbSoloLectura` en el contexto, abierta con T002 junto a `db`); añadir el enlace "Analítica" a la navegación de `src/web/vistas/base.js`, visible con sesión activa, y un enlace "Volver a la agenda" previsto en la futura vista de analítica.
- [X] T006 [P] Añadir a `src/web/textos.js` los textos compartidos de esta página: título "Analítica de la clínica", "Volver a la agenda", "Sin datos en este periodo", y la frase del periodo exacto (p. ej. "del 3 de agosto al 25 de septiembre de 2026"), sin tocar los textos de 001-agenda-core.
- [X] T007 [P] Generalizar `scripts/trazabilidad.js` para recorrer todos los ficheros que encuentre con el patrón `specs/*/spec.md` (hoy solo lee `specs/001-agenda-core/spec.md`) y acumular los identificadores sin cobertura de cada uno en un único informe; actualizar `tests/unitarias/trazabilidad.test.js` para cubrir el nuevo comportamiento multi-spec (research.md, D6). `npm run trazabilidad` debe seguir siendo un único comando y seguir pasando sobre 001-agenda-core. **Ampliado**: al generalizar se descubrió que la numeración `FR-NNN` colisiona entre specs (cada una reinicia en FR-001); se resolvió exigiendo el prefijo `004-` en las etiquetas de los tests de esta spec (001 queda grandfathered sin prefijo) y haciendo la exclusión de identificadores "sin comportamiento que probar" (como FR-008) específica de cada spec en vez de global.

**Checkpoint**: Conexión de solo lectura, ruta vacía con navegación y trazabilidad multi-spec listas; ya se pueden construir las historias.

---

## Phase 3: User Story 1 - Ver de un vistazo cuánto le ahorra CitaClara a la clínica (Priority: P1) 🎯 MVP

**Goal**: Mostrar, en `/analitica`, la ocupación semanal y la tasa de no asistencia por profesional y los ingresos por servicio, con cifras exactas y aisladas por clínica.

**Independent Test**: Con la semilla cargada con la ancla de pruebas (2026-09-28), entrar con la clave de Clínica Eleva y comprobar que los tres bloques coinciden con los números de `spec.md` (FR-004 a FR-006) y que una segunda clínica sin datos ve "Sin datos en este periodo".

### Tests for User Story 1

> Escribir primero y comprobar que FALLAN antes de implementar.

- [X] T008 [P] [US1] En `tests/unitarias/analitica.test.js`, añadir: `[004-FR-004]` ocupación por profesional sobre la semilla (ancla 2026-09-28) → María 43,0 %, Jorge 40,8 %, Lucía 34,6 %; `[004-FR-005]` tasa de no asistencia → María 10,2 %, Jorge 7,3 %, Lucía 11,9 %; `[004-FR-006]` ingresos por servicio → 14.120,00 € / 3.400,00 € / 5.565,00 € / 3.195,00 € (total 26.280,00 €); `[004-FR-008]` un profesional o servicio sin ninguna cita en el periodo (entorno de prueba aislado, sin semilla) devuelve "sin datos" (`undefined`), no `0` ni `NaN`.
- [X] T009 [P] [US1] Crear `tests/integracion/analitica.test.js`: `[004-US1-E3][004-FR-001]` sin sesión, `GET /analitica` redirige a `/acceso` (303) sin datos; `[004-US1-E1][004-FR-009]` con sesión, la página incluye los tres bloques con las cifras de T008; `[004-US1-E4][004-FR-002]` una segunda clínica (fixture) solo ve sus propias cifras; `[004-US1-E5][004-FR-008]` un profesional sin citas en el periodo muestra "Sin datos en este periodo"; `[004-SC-005]` los importes se muestran en formato `es-ES` ("14.120,00 €").
- [X] T010 [P] [US1] Crear `tests/solo-lectura/analitica.test.js`: `[004-SC-002]` captura un resumen (recuento de filas y suma de `id`) de `clinica`, `profesional`, `servicio`, `paciente` y `cita`; ejercita `GET /analitica` con sesión válida, sin sesión, con sesión caducada y con una clínica sin datos; comprueba que el resumen es idéntico antes y después en todos los casos.

### Implementation for User Story 1

- [X] T011 [US1] En `src/domain/analitica.js`, implementar `ocupacionYNoAsistenciaPorProfesional(db, clinicaId, ahora)`: usa `ventanaDeOchoSemanas` (T004), consulta las citas `completada`/`no_asistida`/`cancelada` de cada profesional en el periodo y devuelve, por profesional, `ocupacion` (minutos `completada`+`no_asistida` ÷ `semanas × 3300`) y `tasaNoAsistencia` (`no_asistida` ÷ total), ambos `undefined` si no hay citas (data-model.md).
- [X] T012 [US1] En `src/domain/analitica.js`, implementar `ingresosPorServicio(db, clinicaId, ahora)`: para cada servicio de la clínica, cuenta sus citas `completada` del periodo y multiplica por `precio_centimos`; usa `formatearEuros` de `domain/dinero.js` solo para la presentación, nunca para el cálculo.
- [X] T013 [US1] Crear `src/web/vistas/analitica.js` con un helper de barra SVG (porcentaje o importe + etiqueta en texto junto a la barra, nunca solo color) y renderizar los bloques "Ocupación semanal por profesional", "Tasa de no asistencia por profesional" e "Ingresos por servicio", con la frase del periodo exacto (T006) y "Sin datos en este periodo" donde corresponda (contracts/panel-analitica.md).
- [X] T014 [US1] Completar `src/web/rutas/analitica.js` (creado en T005) para llamar a T011/T012 con `dbSoloLectura` y `req.sesion.clinicaId`, y renderizar la vista de T013 con esos tres bloques.
- [X] T015 [US1] Ampliar `src/web/publico/estilos.css` con las reglas de las barras y bloques de analítica: contraste AA, sin depender solo del color, rejilla responsive igual criterio que la agenda (pila vertical en móvil, sin desplazamiento horizontal).

**Checkpoint**: `/analitica` muestra los tres bloques de la US1, aislados por clínica y sin ninguna escritura; demostrable por sí sola.

---

## Phase 4: User Story 2 - Ver la tendencia de las últimas 8 semanas (Priority: P2)

**Goal**: Añadir a `/analitica` la evolución semanal de ingresos y no asistencia de las últimas 8 semanas.

**Independent Test**: Con la semilla cargada, comprobar que la evolución tiene 8 puntos ordenados de más antiguo a más reciente y que el punto de la semana del 2026-08-24 muestra 2.875,00 € y 16,5 %.

### Tests for User Story 2

- [X] T016 [P] [US2] En `tests/unitarias/analitica.test.js`, añadir: `[004-FR-007][004-US2-E1]` la evolución semanal sobre la semilla (ancla 2026-09-28) tiene 8 filas ordenadas de la más antigua a la más reciente; `[004-US2-E2]` la fila de la semana del 2026-08-24 tiene `ingresosCentimos = 287500` y `tasaNoAsistencia ≈ 16,5 %`; `[004-US2-E3]` con un entorno de prueba con menos de 8 semanas de historia, la serie solo incluye las semanas que realmente tienen citas, sin filas vacías inventadas.
- [X] T017 [P] [US2] En `tests/integracion/analitica.test.js`, añadir: `[004-US2-E1][004-FR-007]` la página muestra el bloque de evolución con 8 puntos (o los disponibles) y, junto al gráfico, una tabla equivalente con las cifras exactas de cada semana (contracts/panel-analitica.md, bloque 5); `[004-US2-E3]` una clínica nueva con menos de 8 semanas de historia no muestra semanas vacías.

### Implementation for User Story 2

- [X] T018 [US2] En `src/domain/analitica.js`, implementar `evolucionSemanal(db, clinicaId, ahora)`: para cada semana laboral completa de `ventanaDeOchoSemanas` (o las que realmente tengan citas si la clínica es más joven), agrega de toda la clínica los ingresos de las citas `completada` y la tasa de no asistencia (`no_asistida` ÷ (`completada`+`no_asistida`+`cancelada`)) de esa semana.
- [X] T019 [US2] En `src/web/vistas/analitica.js`, añadir el bloque "Evolución de las últimas 8 semanas": una polilínea SVG (ingresos y no asistencia) con marcadores, más una tabla accesible con el valor exacto de cada semana; cablear este bloque en `src/web/rutas/analitica.js` junto a los de la US1.
- [X] T020 [US2] Extender `tests/solo-lectura/analitica.test.js` (T010) para ejercitar también el bloque de evolución, incluida una clínica con menos de 8 semanas de historia, y comprobar que el resumen de las tablas sigue sin cambios.

**Checkpoint**: Las dos historias funcionan juntas: página completa con los cuatro bloques (FR-009), todavía sin ninguna escritura.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Cierre de calidad y gobierno

- [X] T021 [P] Ejecutar `npm test` y `npm run trazabilidad`: corregir cualquier FR o escenario de `specs/004-citaclara-analitica/spec.md` sin cobertura, y confirmar que 001-agenda-core sigue en verde tras la generalización de T007 (Principio VI).
- [X] T022 [P] Revisar los textos nuevos de `src/web/textos.js` y de `src/web/vistas/analitica.js`: español de España, sin jerga ni formatos de fecha ambiguos (Principio VIII); extender el test `[FR-028][SC-007]` de términos prohibidos de 001 (`tests/integracion/textos.test.js`) para que también recorra `/analitica`, o crear uno equivalente etiquetado `[004-FR-010]` si no es reutilizable directamente.
- [X] T023 Ejecutar el recorrido manual completo de [quickstart.md](quickstart.md), incluida la comprobación a ~375 px (SC-004) y la verificación de cero escrituras con `sqlite3`/recuento de filas; anotar el resultado en el propio quickstart (igual que hizo 001).
- [X] T024 [P] Comprobar manualmente contraste y tamaño de los elementos de `/analitica` (objetivo AA, igual criterio que 001) y registrar el resultado en `plan.md`.
- [X] T025 Actualizar `README.md`: mencionar `specs/004-citaclara-analitica` junto a 001 como spec vigente, añadir `/analitica` a la estructura descrita y una línea sobre la garantía de solo lectura.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: sin dependencias técnicas, pero T001 es precondición de gobierno para que cualquier tarea de implementación pueda fusionarse (Principio I); no bloquea escribir y hacer pasar los tests en un entorno de trabajo, pero sí cerrar la feature.
- **Foundational (Phase 2)**: depende de Setup; BLOQUEA ambas historias.
- **US1 (Phase 3)**: depende de Foundational. Es el MVP.
- **US2 (Phase 4)**: depende de Foundational; añade código a los mismos ficheros que toca US1 (`domain/analitica.js`, `web/vistas/analitica.js`, `web/rutas/analitica.js`), así que en la práctica conviene completar US1 antes de empezar US2 aunque sus cifras sean independientes.
- **Polish (Phase 5)**: depende de ambas historias.

### Dentro de cada historia

- Los tests se escriben primero y deben fallar antes de implementar.
- Dominio (T011/T012/T018) antes que la vista (T013/T019) y la ruta (T014/T019); vista y ruta comparten fichero con la otra historia, así que T019 edita lo que T013/T014 ya crearon en vez de sustituirlo.

### Parallel Opportunities

- Foundational: T002, T003, T004, T006 y T007 en paralelo (ficheros distintos); T005 depende de T002 (necesita `abrirBaseSoloLectura` en el contexto de `app.js`).
- US1: T008, T009 y T010 (tests) en paralelo; T011 y T012 en paralelo entre sí, ambos antes de T013/T014.
- US2: T016 y T017 (tests) en paralelo; T018 antes de T019; T020 después de T019.

### Parallel Example: User Story 1

```text
Task: "T008 [P] [US1] Tests de ocupación/no-asistencia/ingresos en tests/unitarias/analitica.test.js"
Task: "T009 [P] [US1] Tests HTTP en tests/integracion/analitica.test.js"
Task: "T010 [P] [US1] Test de cero escrituras en tests/solo-lectura/analitica.test.js"
```

---

## Implementation Strategy

### MVP First (solo User Story 1)

1. Phase 1 (T001, gobierno) y Phase 2 completas.
2. Phase 3 (US1): tests en rojo, implementación, tests en verde.
3. **PARAR y VALIDAR**: `npm test` en verde, incluida la prueba de cero escrituras; los tres bloques correctos con la clave de demostración.

### Entrega incremental

1. Setup + Foundational → conexión de solo lectura y ruta vacía listas.
2. US1 → ocupación, no asistencia e ingresos (MVP, lo que más importa para la reunión de renovación).
3. US2 → evolución de 8 semanas (refuerza el argumento, no bloquea la demo si falta tiempo).
4. Polish → trazabilidad, textos, recorrido manual, accesibilidad y README.

### Notas

- [P] = ficheros distintos, sin dependencias pendientes.
- Hacer commit tras cada tarea o grupo lógico.
- Detenerse en cada checkpoint para validar la historia por separado.
- Si una tarea revela un comportamiento no cubierto por la spec (p. ej. una cuarta forma de definir ocupación), parar y actualizar primero la spec (Principio I), no decidirlo en el código.
