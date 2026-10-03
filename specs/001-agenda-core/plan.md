# Implementation Plan: Núcleo de agenda de CitaClara

**Branch**: `001-agenda-core` | **Date**: 2026-10-02 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/001-agenda-core/spec.md`

## Summary

Aplicación web de recepción para clínicas pequeñas: acceso con clave de clínica, agenda del día por profesional con huecos libres y ocupados, alta de cita (con paciente nuevo en el mismo paso) y cierre de citas como completada, cancelada o no asistida. La regla capital (cero solapes por profesional, también con reservas simultáneas) se garantiza con dos defensas: comprobación y alta en una única transacción de escritura inmediata, y un disparador en la propia base de datos. Stack mínimo: Node.js 24, Express (única dependencia de producción), SQLite integrado en Node, HTML generado en servidor con CSS propio responsive. Datos de demostración deterministas con generador de semilla fija. Decisiones y alternativas en [research.md](research.md).

## Technical Context

**Language/Version**: JavaScript (módulos ES) sobre Node.js 24; sin compilación

**Primary Dependencies**: `express` (única de producción); el resto, de la biblioteca estándar de Node (`node:sqlite`, `node:crypto`, `node:test`, `Intl`)

**Storage**: SQLite en fichero (`data/citaclara.db`) mediante `node:sqlite`; instantes en UTC, importes en céntimos enteros

**Testing**: `node:test` + `node:assert`; unitarias, integración HTTP contra base temporal, concurrencia con procesos hijos, semilla; comprobación de trazabilidad spec ↔ pruebas

**Target Platform**: servidor Node.js en una sola máquina (Windows en desarrollo); navegadores modernos de ordenador portátil y de teléfono móvil

**Project Type**: aplicación web de un solo proyecto (servidor que genera las páginas)

**Performance Goals**: uso por 1–2 personas de recepción en una clínica de 2–5 profesionales; cada página y cada acción responde de forma inmediata para el usuario (sin objetivo de carga más allá de SC-001: ≥ 20 altas simultáneas sobre el mismo hueco, exactamente 1 registrada)

**Constraints**: cero solapes con concurrencia entre procesos; horas ligadas a `Europe/Madrid`; importes exactos al céntimo; todo texto visible en español de España; sin desplazamiento horizontal en móvil; sin dependencias externas en tiempo de ejecución (fuentes, CDN)

**Scale/Scope**: 1 clínica en la demo (modelo multi-clínica desde el principio), 3 profesionales, 4 servicios, 40 pacientes, unos pocos miles de citas; 3 pantallas (acceso, agenda del día, alta de cita)

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Dónde |
|---|---|---|
| I. Spec First | La spec está aprobada en `specs/001-agenda-core/` y su propietario (Camilo) figura en [specs/MAPA.md](../MAPA.md). | [spec.md](spec.md) (Status y Assumptions) |
| II. Precisión numérica y temporal | Céntimos enteros; instantes en UTC; reglas y presentación en `Europe/Madrid`; un único módulo de fechas; formatos `es-ES` sin ambigüedad. | research D4, D5; contrato (Textos y formato) |
| III. Cero solapes | Transacción inmediata + disparador en la base; pruebas con procesos reales que intentan el solape (≥ 20 simultáneas, solape parcial); el disparador se prueba por separado saltándose el servicio. | research D3; data-model (reglas de integridad) |
| IV. Simplicidad y cero alcance fantasma | Una dependencia de producción; sin SPA, sin ORM, sin TypeScript, sin navegador automatizado; solo lo que pide la spec. | research D1–D10 |
| V. Datos reproducibles | Generador con PRNG de semilla fija, fecha ancla explícita, cuotas exactas, sin reloj ni aleatoriedad del sistema; los recuentos se publican en el quickstart. | research D8 |
| VI. Tests con la spec | Nombre de cada prueba lleva su RN/FR/escenario; `npm run trazabilidad` falla si falta cobertura. | research D9; quickstart |
| VII. Interfaz clara y moderna | CSS propio responsive, objetivos táctiles ≥ 44 px, contraste AA, estados con texto e icono, sin jerga. | research D6; contrato |
| VIII. Español de España | Todos los textos centralizados en un módulo; `es-ES` para fechas e importes. | research D6 |

**Resultado previo a la investigación**: pasa. El requisito de gobierno de I (propietario en `specs/MAPA.md`) quedó resuelto el 2026-10-02.

**Re-comprobación tras el diseño**: pasa. El diseño no introduce ninguna violación; las dos defensas de III se justifican por el propio principio (no son complejidad añadida a discreción).

## Project Structure

### Documentation (this feature)

```text
specs/001-agenda-core/
├── plan.md              # Este fichero
├── research.md          # Decisiones técnicas
├── data-model.md        # Entidades, reglas de integridad, transiciones
├── quickstart.md        # Guía de validación
├── contracts/
│   └── interfaz-recepcion.md   # Pantallas y formularios
├── checklists/
│   └── requirements.md
└── tasks.md             # Lo generará /speckit-tasks
```

### Source Code (repository root)

```text
package.json
src/
├── server.js                # Arranque: configura Express y escucha
├── app.js                   # Construye la aplicación (recibe base y reloj; reutilizable en pruebas)
├── config.js                # Puerto, ruta de la base, secreto de firma
├── db/
│   ├── connection.js        # Única apertura de node:sqlite, PRAGMAs, busy_timeout
│   └── schema.sql           # Tablas, índices y disparador anti-solape
├── domain/
│   ├── tiempo.js            # Europe/Madrid: conversión, horario de la clínica, formatos
│   ├── dinero.js            # Céntimos ↔ "40,00 €"
│   ├── citas.js             # Alta con RN1/RN2/RN3, cambios de estado; transacción inmediata
│   ├── agenda.js            # Consulta del día: tramos ocupados y libres por profesional
│   ├── pacientes.js         # Alta de ficha y validación de teléfono/email
│   └── clinicas.js          # Alta de clínica con clave única e identificación por clave
├── web/
│   ├── sesion.js            # Cookie firmada (12 h), hash de clave, CSRF
│   ├── rutas/               # acceso.js, agenda.js, citas.js
│   ├── vistas/              # Funciones de plantilla (HTML) y escape
│   ├── textos.js            # Todos los textos visibles en español de España
│   └── publico/estilos.css  # CSS responsive propio
└── seed/
    ├── prng.js              # mulberry32 con semilla fija
    ├── datos.js             # Nombres, servicios y reglas de la clínica demo
    └── seed.js              # Generador determinista e idempotente (npm run seed)

scripts/
└── trazabilidad.js          # Comprueba cobertura RN/escenarios ↔ pruebas

tests/
├── unitarias/               # tiempo, dinero, solape, transiciones
├── integracion/             # HTTP contra base temporal: acceso, agenda, alta, estados
├── concurrencia/            # procesos hijos contra el mismo fichero
├── semilla/                 # recuentos, proporciones, sin solapes, idempotencia
└── ayudas/                  # fixture de pruebas y cliente HTTP mínimo

README.md                    # Comandos, clave de demostración y aviso de la auth v1
.gitignore                   # node_modules/ y data/ (la base de datos no se versiona)
data/                        # Base SQLite local (creada al arrancar; no versionada)
```

**Structure Decision**: un único proyecto Node. La lógica de negocio vive en `src/domain/` sin conocer HTTP ni HTML, para probarla directamente; `src/web/` solo traduce entre HTTP y dominio. `src/app.js` recibe base de datos y reloj por parámetro: las pruebas fijan la hora y usan una base temporal sin tocar nada global.

## Decisiones del plan que conviene revisar

1. **La semana en curso queda sin citas en la demo (confirmado por el propietario el 2026-10-02).** La ancla (lunes de la semana en curso) hace que la historia sean las 8 semanas anteriores y el futuro las 2 semanas siguientes a la actual. Es lo que permite recuentos idénticos en cualquier día de carga (Principio V), pero la agenda de "hoy" aparece vacía en una demo recién cargada. Alternativa si molesta: fijar una fecha ancla absoluta para pruebas y demo (el generador ya la admite como parámetro).
2. **Clave de demostración en el repositorio** (`eleva-demo`): aceptable para datos de demostración; en cualquier despliegue real la clave de una clínica se fija fuera del código.
3. **`node:sqlite`** es un módulo integrado cuya estabilidad aún se considera limitada; el riesgo queda aislado en `src/db/connection.js`.

4. **Accesibilidad y diseño adaptable (2026-10-02, T043)**: revisión con Chrome headless y axe-core (WCAG 2 A/AA, 2.1 AA, 2.2 AA y buenas prácticas) sobre acceso, agenda del día, agenda de historia y alta de cita, a 375 px (móvil emulado) y 1366 px (portátil). Resultado: 0 incidencias en las 8 combinaciones, ancho de página igual al de la ventana (sin desplazamiento horizontal), ningún control interactivo por debajo de 44 px, y capturas revisadas a mano. Control negativo: axe sí detecta un texto de bajo contraste y un encabezado ausente en una página de prueba. Antes de esta revisión se calcularon los ratios WCAG y se oscureció el borde de los huecos libres (de 2,52:1 a 4,38:1). Observaciones menores: (a) los botones desactivados «Completada» y «No asistida» se ven atenuados a propósito (WCAG exime a los controles inactivos; la explicación «Disponible cuando empiece la cita» sí tiene contraste suficiente); (b) el campo de día es el selector nativo del navegador y muestra la fecha con el formato del sistema (p. ej. 06/10/2026), no el formato largo del resto de la interfaz; se deja como está para no añadir un componente propio (Principio IV) y puede revisarse en una spec posterior; (c) se acortó el texto de la opción «Paciente nuevo (datos abajo)» porque se cortaba en móvil.

## Complexity Tracking

Sin violaciones de la constitución que justificar.
