# Implementation Plan: Portal del paciente

**Branch**: `002-portal-del-paciente` | **Date**: 2026-10-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/002-portal-del-paciente/spec.md`

## Summary

Página personal del paciente, sin cuentas ni contraseñas, donde ve sus próximas citas y su historial y cancela una cita futura hasta 24 horas antes. El acceso es un enlace personal secreto (256 bits aleatorios, en la ruta `/p/<secreto>`); en la base solo se guarda su huella, así que el enlace completo solo se ve al crearlo o renovarlo. Recepción lo crea y renueva desde una pantalla nueva de pacientes. La cancelación es una transición `reservada → cancelada` en su propia transacción de escritura inmediata (misma garantía que la 001), que además marca la cita como cancelada por el paciente para que la agenda de recepción lo muestre. Se mantiene el stack de la 001 (Node 24, Express, `node:sqlite`, HTML generado en servidor, CSS propio), sin dependencias nuevas. Decisiones y alternativas en [research.md](research.md).

## Technical Context

**Language/Version**: JavaScript (módulos ES) sobre Node.js 24; sin compilación (igual que la 001)

**Primary Dependencies**: `express` (única de producción); `node:crypto` para el secreto y su huella; sin dependencias nuevas

**Storage**: SQLite existente. Tres columnas nuevas mediante una migración mínima e idempotente: `paciente.acceso_hash`, `cita.cancelada_por_paciente`, `clinica.telefono` (ver [data-model.md](data-model.md))

**Testing**: `node:test`, igual que la 001: unitarias del dominio, integración HTTP, concurrencia con procesos hijos, semilla, y `npm run trazabilidad` ampliado a esta spec

**Target Platform**: el mismo servidor Node; navegadores de móvil desde 360 px y de ordenador

**Project Type**: aplicación web de un solo proyecto (se amplía la de la 001)

**Performance Goals**: pensado para unas pocas decenas de pacientes concurrentes por clínica; cada página y la cancelación responden de forma inmediata para el usuario. Único objetivo duro: SC-005 (≥ 20 cancelaciones simultáneas de la misma cita, exactamente 1 aplicada, 0 solapes)

**Constraints**: cero fugas entre pacientes (SC-006); cero solapes combinando portal, recepción y altas; horas en `Europe/Madrid`; textos en español de España; sin desplazamiento horizontal desde 360 px; sin envío de correos ni mensajes; sin JavaScript obligatorio en el portal

**Scale/Scope**: 3 pantallas de paciente (mi página, confirmar cancelación, enlace no válido) y 1 de recepción (pacientes, con crear/renovar enlace); unas 30–40 citas por paciente en la demo

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Dónde |
|---|---|---|
| I. Spec First | Spec en `specs/002-portal-del-paciente/` con las decisiones de Sara incorporadas. Propietario (Camilo) y convivencia con la 001 aprobados el 2026-10-13 en `specs/MAPA.md`. | [spec.md](spec.md) (Status), `specs/MAPA.md` |
| II. Precisión numérica y temporal | El plazo de 24 h se mide entre instantes UTC (tiempo real transcurrido, también en el cambio de hora); todo lo mostrado usa los formateadores `es-ES`/`Europe/Madrid` de `tiempo.js`. No hay importes nuevos (el portal no muestra precios). | research D5; contrato |
| III. Cero solapes | La cancelación solo libera huecos (FR-019 de la 001) y se ejecuta en `BEGIN IMMEDIATE` con `UPDATE … WHERE estado = 'reservada'`; el disparador de la 001 sigue activo. Pruebas con procesos reales: ≥ 20 cancelaciones simultáneas, cancelación contra cambio de recepción, y cancelación contra altas de recepción sobre el hueco liberado. | research D4; data-model; quickstart |
| IV. Simplicidad y cero alcance fantasma | Cero dependencias nuevas; sin JavaScript en el portal; sin correo; sin cuentas, sesiones ni CSRF propios del paciente (el enlace secreto es la credencial); paginación del historial por parámetro de URL. | research D1–D8 |
| V. Datos reproducibles | La semilla fija el teléfono de la clínica y un enlace por paciente derivado de la semilla (solo demostración); los recuentos citados en la spec salen de ahí. | research D7; quickstart |
| VI. Tests con la spec | Cada FR, escenario y SC lleva prueba que lo nombra; `npm run trazabilidad` pasa a comprobar también la 002. | research D8; quickstart |
| VII. Interfaz clara y moderna | Misma hoja de estilos y mismos criterios que la 001 (objetivos ≥ 44 px, contraste AA, estado con texto e icono); diseño de una columna pensado primero para móvil. | research D6; contrato |
| VIII. Español de España | Textos nuevos en `textos.js`, sin jerga ("enlace", "cita", "cancelar"). | contrato |

**Resultado previo a la investigación**: pasa. El requisito de gobierno de I (propietario y convivencia con la 001) quedó resuelto el 2026-10-13.

**Re-comprobación tras el diseño**: pasa. El diseño no introduce violaciones; la única desviación de la 001 (el portal no reutiliza `cambiarEstado`) está justificada en research D4 y no añade complejidad.

## Project Structure

### Documentation (this feature)

```text
specs/002-portal-del-paciente/
├── plan.md              # Este fichero
├── research.md          # Decisiones técnicas
├── data-model.md        # Columnas nuevas, reglas y transiciones
├── quickstart.md        # Guía de validación
├── contracts/
│   └── interfaz-portal.md   # Rutas del paciente y pantalla de pacientes de recepción
├── checklists/
│   └── requirements.md
└── tasks.md             # Lo generará /speckit-tasks
```

### Source Code (repository root)

Solo se listan los ficheros nuevos (+) o modificados (~) respecto a la 001.

```text
src/
├── app.js                       ~ monta las rutas del portal y las de pacientes
├── config.js                    ~ URL pública opcional (CITACLARA_URL_PUBLICA)
├── db/
│   ├── connection.js            ~ ejecuta la migración mínima tras el esquema
│   └── schema.sql               ~ (sin cambios de tablas; las columnas nuevas van por migración)
├── domain/
│   ├── enlaces.js               + crear/renovar enlace, resolver el secreto a un paciente
│   ├── portal.js                + citas del paciente (próximas / historial) y cancelación
│   ├── clinicas.js              ~ crearClinica admite teléfono opcional
│   └── agenda.js                ~ la consulta del día incluye cancelada_por_paciente
├── web/
│   ├── rutas/
│   │   ├── portal.js            + /p/:secreto … (sin sesión)
│   │   └── pacientes.js         + /pacientes, /pacientes/:id/enlace (con sesión y CSRF)
│   ├── vistas/
│   │   ├── portal.js            + mi página, confirmar cancelación, enlace no válido
│   │   ├── pacientes.js         + lista y enlace recién creado
│   │   ├── agenda.js            ~ etiqueta "Cancelada por el paciente"
│   │   └── base.js              ~ enlace "Pacientes" en la cabecera de recepción
│   ├── textos.js                ~ textos del portal y de pacientes
│   └── publico/estilos.css      ~ estilos del portal
└── seed/
    ├── datos.js                 ~ teléfono demo de la clínica
    └── seed.js                  ~ un enlace determinista por paciente (solo demostración)

scripts/trazabilidad.js          ~ cubre también specs/002
README.md                        ~ comandos y aviso sobre el enlace personal

tests/
├── unitarias/                   + enlaces, portal-citas, portal-cancelar
├── integracion/                 + portal (ver, cancelar, acceso inválido, cabeceras), pacientes-enlace, agenda-cancelada-por-paciente
├── concurrencia/                + cancelacion-simultanea (procesos hijos)
└── semilla/                     ~ recuentos del portal con Claudia Rodríguez Pérez
```

**Structure Decision**: el portal se añade al mismo proyecto y reutiliza `tiempo.js`, `textos.js`, `base.js` y la hoja de estilos. La lógica va en `src/domain/` sin conocer HTTP; `src/web/rutas/portal.js` no usa la sesión de recepción (el secreto de la ruta es la credencial), por lo que queda aislado de las rutas de la 001: ninguna ruta de recepción se ve afectada y ninguna ruta del portal acepta la cookie de recepción.

## Decisiones del plan que conviene revisar

1. **El enlace solo se ve al crearlo o renovarlo.** Guardar el secreto en claro permitiría a recepción volver a copiarlo, pero una filtración de la base expondría todas las páginas de pacientes (datos de salud). Se guarda solo su huella; si se pierde, se renueva (coherente con lo que decidió Sara: "recepción debe poder renovarlo si se pierde"). Coste: un paso más para recepción al reenviar.
2. **Se toca la 001 en tres puntos**, todos aditivos: columna `cita.cancelada_por_paciente` (la agenda muestra una etiqueta nueva), columna `clinica.telefono` y una pantalla nueva en recepción. Ninguna regla de la 001 cambia; Camilo debe aprobarlo (ver `MAPA.md`).
3. **Pantalla de pacientes nueva en recepción.** La spec habla de "ficha del paciente", pero la 001 no tiene pantalla de pacientes (solo se crean al dar de alta una cita). Se añade la pantalla mínima (lista con buscador por nombre y botón de enlace); no edita ni borra pacientes.
4. **URL del enlace.** Se compone con `CITACLARA_URL_PUBLICA` si existe y, si no, con el host de la petición de recepción. En una instalación real hay que fijar la variable para que el enlace apunte a la dirección pública.
5. **Cabeceras de privacidad.** Las páginas del portal salen con `Cache-Control: no-store`, `Referrer-Policy: no-referrer` y `X-Robots-Tag: noindex` (FR-005), pero el secreto en la URL puede quedar en el historial del navegador del paciente: es inherente a la opción A elegida por Sara.

## Complexity Tracking

Sin violaciones de la Constitución que justificar.
