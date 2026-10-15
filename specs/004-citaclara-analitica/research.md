# Research: Panel de analítica de CitaClara

Decisiones técnicas de la 004. Siguen la Constitución (Principio IV: lo más simple que cumpla la
spec) y reutilizan al máximo lo ya construido en `001-agenda-core`, de la que esta feature solo
lee.

## D1. Mismo stack que 001-agenda-core, sin dependencias nuevas

- **Decisión**: Node.js 24, JavaScript (módulos ES), Express, `node:sqlite`, HTML generado en
  servidor y el CSS propio ya existente (`src/web/publico/estilos.css`). Ninguna dependencia de
  producción nueva.
- **Razón**: Principio IV. La 004 añade una página a una aplicación que ya existe; introducir un
  segundo stack (p. ej. un *bundler* o un framework de cliente) no está justificado por nada de
  la spec.
- **Alternativas**: proyecto/servicio separado para "analítica" — rejected: duplicaría acceso,
  sesión y conexión a datos sin ninguna necesidad; esta feature ni siquiera escribe, así que no
  hay razón de aislamiento de escritura entre servicios.

## D2. Garantía de solo lectura (FR-003, SC-002): dos defensas, igual filosofía que el Cero Solapes de 001

- **Decisión**:
  1. **Disciplina del módulo de dominio**: `src/domain/analitica.js` solo contiene instrucciones
     `SELECT`; ninguna función de esta feature puede importar ni invocar las funciones de
     escritura de `domain/citas.js`, `domain/pacientes.js` ni `domain/clinicas.js`.
  2. **Autorizador de SQLite como red de seguridad**: una segunda conexión `DatabaseSync` abierta
     sobre el mismo fichero (`src/db/connection.js`, nueva función `abrirBaseSoloLectura`), con
     `db.setAuthorizer(...)` configurado para permitir únicamente las acciones de lectura
     (`SQLITE_SELECT`, `SQLITE_READ`, `SQLITE_FUNCTION`, `SQLITE_RECURSIVE`, …) y denegar
     cualquier otra (`SQLITE_INSERT`, `SQLITE_UPDATE`, `SQLITE_DELETE`, `SQLITE_CREATE_*`,
     `SQLITE_DROP_*`, `SQLITE_ALTER_TABLE`, etc.). Esta conexión es la única que usa la ruta
     `/analitica`; la conexión de 001 (lectura y escritura) no se toca.
  - **Razón**: igual que el disparador anti-solape de 001 es la red de seguridad del Principio
    III aunque el servicio ya comprueba el solape, aquí el autorizador es la red de seguridad del
    "no escribe NADA" aunque el dominio ya solo tenga `SELECT`: si un cambio futuro de código
    introdujera por error una escritura en este camino, la propia base la rechaza.
  - **Prueba**: una conexión distinta en las pruebas intenta deliberadamente un `INSERT` a través
    de las funciones de `domain/analitica.js` (helper de prueba) y se comprueba que el
    autorizador la bloquea; además, una prueba de "cero escrituras" registra un resumen
    (recuento de filas y suma de los `id` por tabla) de `clinica`, `profesional`, `servicio`,
    `paciente` y `cita` antes y después de ejercitar cada ruta de `/analitica` (camino normal y
    los de error: sin sesión, sesión caducada, periodo sin datos) y exige que sea idéntico.
  - **Alternativas**: abrir el fichero en modo solo lectura del sistema operativo — rejected
    porque `node:sqlite` (`DatabaseSync`) no expone hoy una opción de solo lectura estable y
    documentada, y complicaría abrir una base `:memory:` en las pruebas; el autorizador da una
    garantía equivalente, verificable con una prueba dedicada, sin depender de esa API.

## D3. Gráficos: SVG generado en el servidor, sin librería de gráficos

- **Decisión**: los cuatro bloques (ocupación por profesional, no asistencia por profesional,
  ingresos por servicio, evolución de 8 semanas) se dibujan como SVG en línea, generado por
  funciones de plantilla igual que el resto de `src/web/vistas/`. Barras para los tres primeros,
  una polilínea con marcadores para la evolución. Cada marca lleva además la cifra exacta como
  texto y una etiqueta, para no depender solo del color (reutiliza el criterio del Principio VII
  ya aplicado en 001 a los estados de una cita).
- **Razón**: Principio IV. Son 4 gráficos sencillos con pocos puntos (como mucho 8, en la
  evolución); una librería de gráficos de cliente (Chart.js, D3, etc.) sería una dependencia
  nueva sin que la spec lo exija, y además obligaría a enviar los datos como JSON y ejecutar
  JavaScript en el cliente, algo que 001 evitó deliberadamente (D6 de 001-agenda-core).
- **Alternativas**: librería de gráficos de cliente — rejected (dependencia nueva, D1); imágenes
  generadas en servidor (PNG/Canvas) — rejected: SVG en línea es texto, no necesita una
  dependencia de renderizado de imágenes y escala sin pixelarse en móvil.

## D4. Ventana de 8 semanas y minutos disponibles: reutilizar `domain/tiempo.js`, sin inventar un horario nuevo

- **Decisión**: la ventana de "últimas 8 semanas" se calcula con las mismas funciones que ya usa
  el generador de datos de demostración de 001 (`lunesDeLaSemana`, `sumarDias`): las 8 semanas
  laborales completas (lunes a viernes) anteriores a la semana que contiene `ahora()`, sin incluir
  la semana en curso. El tiempo disponible de un profesional en una semana laboral es el horario
  continuo que ya fija RN3/FR-020b de 001-agenda-core — 09:00 a 20:00, lunes a viernes, **sin
  ninguna pausa** — es decir, 660 minutos × 5 días = 3.300 minutos por semana.
- **Aclaración importante** (corrige un primer cálculo hecho al redactar la spec): el hueco de
  mediodía que se observa en los datos de demostración (`src/seed/seed.js`,
  `ALMUERZO_INICIO`/`ALMUERZO_FIN`) es solo un rasgo del generador para que la agenda de ejemplo
  parezca realista; **no** es una regla de negocio de 001-agenda-core, que no define ningún
  descanso (su spec y su `research.md` no mencionan una pausa). Restar esa hora al tiempo
  disponible produciría una ocupación artificialmente alta e incoherente con el horario que la
  propia agenda ofrece como reservable. FR-004 y su ejemplo en `spec.md` usan el horario
  completo de 09:00 a 20:00.
- **Razón**: Principio V (reproducibilidad) y Principio IV (ninguna regla de horario nueva: se
  reutiliza exactamente RN3). Evita que 004 introduzca, por su cuenta, una noción de "horario
  disponible" distinta de la que ya gobierna la agenda real.

## D5. Un único módulo de cálculo, sin HTTP ni HTML

- **Decisión**: `src/domain/analitica.js` expone funciones puras parametrizadas por `db`,
  `clinicaId` y `ahora` (reloj inyectado, igual patrón que `domain/agenda.js`): una para la
  ocupación y la no asistencia por profesional, otra para los ingresos por servicio y otra para
  la serie de evolución semanal. Reutiliza `formatearEuros` (`domain/dinero.js`) y las funciones
  de fecha de `domain/tiempo.js`; no duplica ningún cálculo ya existente.
- **Razón**: Principio IV y el mismo patrón arquitectónico que 001 (dominio sin conocer HTTP,
  para probarlo directamente; `src/web/` solo traduce entre HTTP y dominio).

## D6. Trazabilidad multi-spec (Principio VI, SC-008 de esta spec)

- **Decisión**: generalizar `scripts/trazabilidad.js`, que hoy solo lee
  `specs/001-agenda-core/spec.md`, para que recorra **todas** las carpetas `specs/*/spec.md` y
  acumule los identificadores sin cobertura de cada una. `npm run trazabilidad` sigue siendo un
  único comando, pero a partir de esta feature cubre también `specs/004-citaclara-analitica/spec.md`.
- **Razón**: la Constitución (Principio VI) exige esta trazabilidad para "cada spec", no solo
  para la primera; sin este cambio, la 004 no tendría ninguna comprobación automática de que sus
  FR y escenarios tienen prueba. Es una generalización mínima (un bucle sobre los directorios),
  no una reescritura (Principio IV).
- **Colisión descubierta al generalizar (y su arreglo)**: cada spec reinicia su propia numeración
  de `FR-001` en adelante (es la convención de la plantilla, que ya usaba la 001). Al poner a
  convivir dos specs, una comprobación ingenua da un falso positivo: el `[FR-003]` de un test de
  001-agenda-core "cubre" también el `FR-003` de la 004, aunque sean requisitos distintos. La
  solución, sin tocar ni renumerar la spec de 001 (cerrada y ajena a esta feature): a partir de
  la 004, los tests de una spec deben etiquetar sus identificadores con el prefijo numérico de su
  carpeta, por ejemplo `[004-FR-004]`, `[004-US1-E1]`; solo la 001 conserva sus etiquetas sin
  prefijo (`[FR-004]`), por ser la única spec cuando se escribieron sus ~110 tests y estar cerrada
  (Principio I: no se reabre una spec cerrada para renombrar sus pruebas sin necesidad). La
  exclusión de identificadores sin comportamiento que probar (como el FR-008 "fuera de alcance"
  de la 001) también pasa a resolverse por spec, nunca de forma global, porque el FR-008 de la
  004 sí tiene comportamiento que probar ("sin datos en el periodo") y no debe excluirse.
- **Alternativas**: un script de trazabilidad distinto por spec — rejected: duplicaría la lógica
  de `extraerRequisitos`/`extraerEtiquetas` sin necesidad; renumerar los FR de la 004 para que no
  colisionen con los de la 001 — rejected: cambiaría spec.md, data-model.md, contracts/ y
  tasks.md sin aportar nada que el prefijo en las etiquetas de los tests no resuelva ya.

## D7. Pruebas (Principio VI)

- **Decisión**: `node:test`, mismo patrón de nombres con el identificador entre corchetes
  (`[FR-004]`, `[US1-E2]`…) que ya usa 001. Capas: unitarias de `domain/analitica.js` contra la
  semilla cargada con la ancla de pruebas (`2026-09-28`), comparando contra los números exactos
  publicados en `spec.md`; integración HTTP de `/analitica` (sesión exigida, aislamiento por
  clínica, contenido de cada bloque); y una suite dedicada de solo lectura (D2).
- **Interfaz**: verificación por HTTP igual que 001; la revisión de accesibilidad y de móvil se
  hace a mano y se documenta en `quickstart.md`, como ya hizo 001 (sin añadir un navegador
  automatizado, Principio IV).

## D8. Punto de entrada a la página

- **Decisión**: un enlace "Analítica" en la cabecera/navegación ya existente de la agenda
  (`src/web/vistas/base.js`), visible con sesión activa, y un enlace "Volver a la agenda" en la
  propia página de analítica. No se modifica ningún otro comportamiento de 001.
- **Razón**: FR-009 solo exige que las cuatro cifras vivan en una sola página; sin un enlace
  desde la agenda, Sara no tendría forma de llegar a ella salvo escribiendo la URL a mano.

## D9. Dependencias de producción

Ninguna dependencia nueva. Se sigue usando solo `express` (ya en `package.json`); todo lo demás
(segunda conexión SQLite, autorizador, SVG, fechas e importes) viene de Node o de módulos ya
existentes en `src/domain/`.
