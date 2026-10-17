# Implementation Plan: Panel de analítica de CitaClara

**Branch**: `004-citaclara-analitica` | **Date**: 2026-10-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/004-citaclara-analitica/spec.md`

## Summary

Una única página de solo lectura (`/analitica`), añadida a la misma aplicación de
`001-agenda-core`, que muestra a Sara, con la misma clave de clínica que usa recepción, cuatro
cifras para la conversación de renovación: ocupación semanal por profesional, tasa de no
asistencia por profesional, ingresos por servicio (solo citas completadas, al céntimo) y la
evolución de las últimas 8 semanas. No se añade ninguna tabla ni dependencia: se reutiliza el
esquema, el acceso y el stack de 001, y se calcula todo al vuelo sobre las citas ya existentes.
La garantía de "no escribe NADA" (FR-003, SC-002) se sostiene con dos defensas — igual filosofía
que el Cero Solapes de 001 — una conexión de solo lectura con autorizador de SQLite además de un
módulo de dominio que solo emite `SELECT`. Decisiones y alternativas en [research.md](research.md).

## Technical Context

**Language/Version**: JavaScript (módulos ES) sobre Node.js 24; mismo runtime que 001-agenda-core, sin compilación

**Primary Dependencies**: ninguna nueva; reutiliza `express` (única dependencia de producción ya presente) y la biblioteca estándar de Node (`node:sqlite`, `node:test`, `Intl`)

**Storage**: el mismo fichero SQLite de 001 (`data/citaclara.db`), sin tablas ni columnas nuevas; una segunda conexión `DatabaseSync` de solo lectura (autorizador SQLite) usada exclusivamente por esta feature

**Testing**: `node:test` + `node:assert`; unitarias del cálculo de las 4 cifras contra la semilla con ancla fija, integración HTTP de `/analitica`, suite dedicada de "cero escrituras"; `scripts/trazabilidad.js` generalizado para cubrir también esta spec

**Target Platform**: mismo servidor Node.js de 001 (una sola máquina); navegadores modernos de ordenador portátil y de teléfono móvil

**Project Type**: aplicación web de un solo proyecto; se añade una ruta a la aplicación ya existente, no un proyecto ni un servicio nuevo

**Performance Goals**: cálculos sobre el mismo volumen que 001 (unos pocos miles de citas, 1 clínica de demo); cada carga de la página responde de forma inmediata, sin objetivo de carga distinto al de una lectura normal

**Constraints**: cero escrituras bajo cualquier camino, incluidos los de error (SC-002); mismas reglas de importes al céntimo y horas en `Europe/Madrid` que 001 (Principio II); ningún texto visible fuera del español de España; sin desplazamiento horizontal en móvil; sin dependencias nuevas de producción (Principio IV)

**Scale/Scope**: 1 página nueva con 4 bloques, sobre los datos ya existentes de 1 clínica de demostración (3 profesionales, 4 servicios); ningún dato ni pantalla nuevos más allá de esos 4 bloques

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Dónde |
|---|---|---|
| I. Spec First | La spec está en `specs/004-citaclara-analitica/spec.md`, con sus dos ambigüedades cerradas en la sesión de clarificación del 2026-10-13. Propietario Camilo, `Status: Aprobada (2026-10-13)`, registrado en `specs/MAPA.md` (T001). | spec.md (Clarifications, Status); specs/MAPA.md |
| II. Precisión Numérica y Temporal | Céntimos enteros reutilizados de `domain/dinero.js`; periodo de 8 semanas calculado con `domain/tiempo.js` (mismo módulo que 001, ninguna fecha nueva calculada a mano). | research D4, D5; data-model (Periodo analizado) |
| III. Cero Solapes | No aplica directamente: esta feature no escribe en la agenda de ningún profesional. Se cuida, en cambio, de no interferir con quien sí escribe: usa una conexión de lectura independiente, de modo que leer `/analitica` nunca bloquea ni retrasa un alta o un cambio de estado en `/agenda` (Edge Cases de spec.md). | research D2 |
| IV. Simplicidad y Cero Alcance Fantasma | Cero dependencias de producción nuevas; sin tablas nuevas; gráficos en SVG de servidor en vez de una librería de cliente; una sola página, sin sub-pantallas. | research D1, D3, D9 |
| V. Datos reproducibles | Todas las cifras de ejemplo de `spec.md` y `quickstart.md` están calculadas sobre la semilla real de 001 con la ancla de pruebas (2026-09-28) y quedan fijadas como aserciones de prueba. | quickstart.md; research D7 |
| VI. Tests con la spec | `scripts/trazabilidad.js` se generaliza para recorrer todas las specs (hoy solo cubría 001), de modo que también exige cobertura de los FR y escenarios de la 004. | research D6 |
| VII. Interfaz clara y moderna | Gráficos con cifra en texto junto a cada barra/punto (nunca solo color); misma hoja de estilos responsive de 001; "Sin datos en este periodo" en vez de ceros engañosos. | research D3; contracts/panel-analitica.md |
| VIII. Español de España | Reutiliza `src/web/textos.js`, ampliándolo con los textos de esta página, sin un módulo de textos paralelo. | contracts/panel-analitica.md |

**Resultado previo a la investigación**: pasa. La condición de gobierno (I) quedó resuelta el
2026-10-13 (T001: propietario y Status en `specs/MAPA.md` y `spec.md`).

**Re-comprobación tras el diseño**: pasa. El diseño no introduce ninguna violación; la segunda
conexión de solo lectura (IV) se justifica directamente por FR-003/SC-002 (Principio III ya
estableció en 001 que una defensa en la propia base de datos, además de en el código, es
proporcional cuando la regla es innegociable) y no es complejidad añadida a discreción.

## Project Structure

### Documentation (this feature)

```text
specs/004-citaclara-analitica/
├── plan.md              # Este fichero
├── research.md          # Decisiones técnicas
├── data-model.md         # Cifras derivadas y periodo analizado (sin entidades nuevas)
├── quickstart.md         # Guía de validación
├── contracts/
│   └── panel-analitica.md   # Contrato de la ruta /analitica
├── checklists/
│   └── requirements.md
└── tasks.md              # Lo generará /speckit-tasks
```

### Source Code (repository root)

Esta feature **añade** ficheros a la aplicación de 001-agenda-core; no crea un proyecto nuevo.
Ficheros nuevos marcados con `+`; el resto ya existe y no cambia de comportamiento salvo donde se
indica.

```text
package.json                         # sin cambios de dependencias (D1/D9)
src/
├── server.js
├── app.js                           # añade rutasAnalitica() y la conexión de solo lectura al contexto
├── config.js
├── db/
│   ├── connection.js                # + abrirBaseSoloLectura(rutaBase): segunda conexión con autorizador (D2)
│   └── schema.sql                   # sin cambios: ninguna tabla ni columna nueva
├── domain/
│   ├── tiempo.js                    # sin cambios: se reutiliza tal cual (D4)
│   ├── dinero.js                    # formatearEuros: + useGrouping: 'always' (ver "Decisiones del plan")
│   ├── citas.js / agenda.js / pacientes.js / clinicas.js   # sin cambios
│   └── analitica.js                 # + cálculo de las 4 cifras (D5), solo SELECT, sin HTTP ni HTML
├── web/
│   ├── sesion.js                    # sin cambios: se reutiliza exigirSesion tal cual
│   ├── rutas/
│   │   ├── acceso.js / agenda.js / citas.js   # sin cambios
│   │   └── analitica.js             # + GET /analitica (exigirSesion, sin ningún POST)
│   ├── vistas/
│   │   ├── base.js                  # añade el enlace "Analítica" a la navegación existente
│   │   ├── agenda.js / alta-cita.js / acceso.js   # sin cambios
│   │   └── analitica.js             # + plantilla de la página y helpers de SVG (D3)
│   ├── textos.js                    # ampliado con los textos de esta página (sin módulo paralelo)
│   └── publico/estilos.css          # ampliado con las reglas de los nuevos bloques/gráficos
└── seed/                            # sin cambios: esta feature no toca los datos de demostración

scripts/
└── trazabilidad.js                  # generalizado para recorrer specs/*/spec.md (D6)

tests/
├── unitarias/
│   └── analitica.test.js            # + cálculo de las 4 cifras contra la semilla (D7)
├── integracion/
│   └── analitica.test.js            # + HTTP de /analitica (sesión, aislamiento, contenido)
├── solo-lectura/
│   └── analitica.test.js            # + autorizador rechaza una escritura; cero cambios en las tablas (D2)
└── ayudas/fixture.js                # iniciarServidor() abre también dbSoloLectura (mismo fichero); el resto, sin cambios
```

**Structure Decision**: se extiende el único proyecto Node de 001-agenda-core en vez de crear uno
nuevo. El cálculo vive en `src/domain/analitica.js`, sin conocer HTTP ni HTML (igual patrón que
`domain/agenda.js`), y se puede probar directamente contra la semilla. `src/web/rutas/analitica.js`
solo traduce entre HTTP y ese dominio, reutilizando la sesión y los textos ya existentes. La
única pieza verdaderamente nueva de infraestructura es la segunda conexión de solo lectura
(`abrirBaseSoloLectura`), que vive junto a la conexión existente en `src/db/connection.js` para
mantener en un único módulo todo el código que abre `node:sqlite` (mismo criterio que ya
documentó 001 D2 para aislar el riesgo de ese módulo experimental).

## Decisiones del plan que conviene revisar

1. **Corrección descubierta durante la implementación: separador de millares en los importes
   (2026-10-13).** `Intl.NumberFormat('es-ES', {style:'currency'})` de Node, con su
   `useGrouping` por defecto ('auto'), solo agrupa los millares a partir de 5 cifras: formateaba
   3.400,00 € como "3400,00 €" (sin punto), inconsistente con importes mayores como
   "14.120,00 €" en la misma página. 001-agenda-core nunca lo notó porque ninguno de sus precios
   llega a 1.000 €. Se corrigió en `domain/dinero.js` (`formatearEuros`) añadiendo
   `useGrouping: 'always'`, sin cambiar la salida visible de 001 (todos sus importes son < 1.000
   y ya se agrupaban bien). Test de regresión: `tests/unitarias/analitica.test.js`
   (`[004-FR-006]`). Verificado también contra la aplicación real arrancada con `npm start`
   (ver `quickstart.md`, "Resultado del recorrido").
2. **Accesibilidad y diseño adaptable: revisión por código, no por herramienta (2026-10-13).**
   A diferencia de 001 (que corrió Chrome headless + axe-core), este entorno no tenía esas
   herramientas disponibles y no se ha añadido una dependencia nueva solo para esta revisión
   (Principio IV). La revisión se hizo leyendo el CSS nuevo: los bloques y gráficos SVG escalan
   con `width: 100%` sin anchos mínimos, el enlace de navegación nuevo respeta el alto táctil de
   44 px ya exigido al resto de controles, y los textos de los gráficos reutilizan los mismos
   colores de texto que 001 ya validó con axe-core (0 incidencias AA) a 375 px y 1366 px. Queda
   pendiente, como mejora, repetir una pasada real de axe-core sobre `/analitica` cuando se
   disponga de esas herramientas (ver quickstart.md).

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

Sin violaciones de la constitución que justificar. La única pieza que podría parecer
"complejidad añadida" — la segunda conexión SQLite con autorizador — es la defensa de solo
lectura exigida directamente por FR-003/SC-002 de la propia spec, no una elección de
implementación discrecional.
