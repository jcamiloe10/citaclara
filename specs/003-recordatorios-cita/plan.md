# Implementation Plan: Recordatorios de cita

**Branch**: `003-citaclara-recordatorios` | **Date**: 2026-10-13 | **Spec**: [spec.md](spec.md)

**Input**: Feature specification from `/specs/003-recordatorios-cita/spec.md`

## Summary

Un proceso diario (`npm run recordatorios`) recorre las citas reservadas que empiezan entre 24 y 48 horas después del instante de ejecución y genera un recordatorio por email para cada una, una sola vez, aunque se ejecute varias veces o a la vez. En el modo simulado (el único de la v1) cada recordatorio es un fichero `.eml` en `datos/salida-correo/`. El email lleva los datos de la cita y un enlace personal e inadivinable; el enlace abre una página pública de dos pasos (ver y confirmar) que cancela la cita si faltan 24 horas o más, y si no, indica que hay que llamar a la clínica. La cancelación solo libera hueco, así que no puede crear solapes. Recepción ve en la agenda del día qué citas canceló el paciente y cuáles no pudieron recordarse por falta de email. Sin dependencias nuevas: se reutilizan Node.js 24, Express, `node:sqlite` y `node:crypto`. Decisiones y alternativas en [research.md](research.md).

## Technical Context

**Language/Version**: JavaScript (módulos ES) sobre Node.js 24; sin compilación (igual que la 001)

**Primary Dependencies**: ninguna nueva. `express` (ya existente) para la página pública; `node:sqlite`, `node:crypto`, `node:fs` y `node:test` de la biblioteca estándar

**Storage**: la misma base SQLite de la 001. Dos tablas nuevas (`recordatorio`, `clinica_contacto`), creadas con `CREATE TABLE IF NOT EXISTS`, sin tocar las tablas de la 001. Ficheros `.eml` en `datos/salida-correo/` (no versionados)

**Testing**: `node:test` + `node:assert`, igual que la 001: unitarias (ventana, mensaje, token), integración HTTP del enlace, concurrencia con procesos hijos (dos ejecuciones simultáneas; cancelación frente a reserva), y comprobación de trazabilidad spec ↔ pruebas ampliada a la 003

**Target Platform**: servidor Node.js en una sola máquina (Windows en desarrollo); el paciente abre el enlace en cualquier navegador, sobre todo de teléfono móvil

**Project Type**: aplicación web de un solo proyecto (la de la 001) más un programa de línea de comandos que se programa en el planificador del sistema

**Performance Goals**: el proceso diario termina en unos segundos para unos pocos cientos de citas (clínica de 2-5 profesionales); la página del enlace responde de forma inmediata. Sin objetivos de carga más allá de SC-002 (10 ejecuciones seguidas y simultáneas, 0 duplicados)

**Constraints**: cero duplicados con ejecuciones simultáneas; cancelar nunca crea solape; horas ligadas a `Europe/Madrid`; todo texto en español de España; el enlace no contiene datos personales ni permite deducir otra cita; sin dependencias nuevas

**Scale/Scope**: 1 clínica en la demo (modelo multi-clínica), ~203 citas futuras en la semilla; 1 pantalla pública nueva (con 2 pasos), 1 comando, 2 tablas, 1 ampliación de la agenda del día

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principio | Cumplimiento | Dónde |
|---|---|---|
| I. Spec First | La spec está en `specs/003-recordatorios-cita/` con propietario (Camilo) en [specs/MAPA.md](../MAPA.md), y la relación con la 001 y la 002 declarada allí. La 001 está cerrada: la 003 no cambia su comportamiento; solo añade tablas y un indicador en la agenda del día. | [spec.md](spec.md) (Status, FR-023, Assumptions) |
| II. Precisión numérica y temporal | La ventana y el margen de 24 h se calculan en instantes absolutos; toda hora mostrada pasa por `src/domain/tiempo.js` en `Europe/Madrid` (una sola fuente de formato, incluido el cambio de hora). No hay importes en esta feature. | research D2, D9 |
| III. Cero solapes | Cancelar solo cambia `reservada → cancelada` con una transacción inmediata y una condición `estado = 'reservada'` en el `UPDATE`: libera ocupación, nunca la crea. Pruebas con procesos reales que cancelan y reservan el mismo hueco a la vez (el disparador de la 001 sigue siendo la red de seguridad). | research D5; data-model |
| IV. Simplicidad y cero alcance fantasma | Cero dependencias; sin planificador propio dentro del servidor (lo programa el sistema); sin servicio de correo real, sin SMS/WhatsApp, sin editar el teléfono por pantalla; solo lo que pide la spec. | research D1, D3, D8 |
| V. Datos reproducibles | La semilla de la 001 se amplía solo con el teléfono de la clínica; los recuentos esperados de recordatorios se publican en el quickstart con un instante de referencia fijado. | research D10; quickstart |
| VI. Tests con la spec | Cada FR, escenario y SC lleva su prueba con el identificador entre corchetes; `npm run trazabilidad` pasa a comprobar también la 003 (con etiquetas propias para no mezclar con la 001). | research D11 |
| VII. Interfaz clara y moderna | La página del enlace reutiliza la plantilla y el CSS de la 001: móvil primero, botones ≥ 44 px, texto y icono en cada resultado, sin jerga. | research D6; contrato |
| VIII. Español de España | Los textos del email y de la página están en módulos de textos centralizados; fechas con el formato largo sin ambigüedad de la 001. | research D6, D9 |

**Resultado previo a la investigación**: pasa.

**Re-comprobación tras el diseño**: pasa. El diseño no introduce ninguna violación. Los dos mecanismos contra duplicados (transacción inmediata + restricción única en la base) siguen el mismo patrón de doble defensa de la 001 y se justifican en D4, no son complejidad añadida a discreción.

## Project Structure

### Documentation (this feature)

```text
specs/003-recordatorios-cita/
├── plan.md              # Este fichero
├── research.md          # Decisiones técnicas
├── data-model.md        # Tablas nuevas, reglas de integridad, estados
├── quickstart.md        # Guía de validación
├── contracts/
│   ├── enlace-cancelacion.md   # Páginas públicas del paciente
│   ├── proceso-diario.md       # Comando, salida y códigos de salida
│   └── correo-eml.md           # Formato y contenido del fichero .eml
├── checklists/
│   └── requirements.md
└── tasks.md             # Lo generará /speckit-tasks
```

### Source Code (repository root)

Se añade a la estructura de la 001 (solo lo nuevo o modificado):

```text
package.json                     # + script "recordatorios"
.gitignore                       # + datos/ (ya añadido)
src/
├── config.js                    # MOD: urlPublica, carpetaCorreo, remitente
├── app.js                       # MOD: monta las rutas públicas del enlace (sin sesión)
├── db/schema.sql                # MOD: tablas recordatorio y clinica_contacto
├── domain/
│   ├── recordatorios.js         # NUEVO: ventana, generar (idempotente), consultar y cancelar por enlace
│   ├── enlaces.js               # NUEVO: token aleatorio y su huella (SHA-256)
│   └── agenda.js                # MOD: la agenda del día incluye el estado del recordatorio de cada cita
├── correo/
│   ├── mensaje.js               # NUEVO: compone el mensaje (asunto, cuerpo) y lo serializa como .eml
│   ├── salida-simulada.js       # NUEVO: escribe el .eml de forma atómica en la carpeta de salida
│   └── textos.js                # NUEVO: textos del email en español de España
├── recordatorios/
│   └── ejecutar.js              # NUEVO: comando del proceso diario (npm run recordatorios)
├── web/
│   ├── rutas/enlace.js          # NUEVO: GET/POST /cancelar/:token (públicas)
│   ├── vistas/enlace.js         # NUEVO: páginas del paciente
│   ├── vistas/agenda.js         # MOD: etiquetas "Cancelada por el paciente" y "Sin email"
│   └── textos.js                # MOD: textos de la página del enlace y de las etiquetas
└── seed/
    ├── datos.js                 # MOD: teléfono de la clínica de demostración
    └── seed.js                  # MOD: carga el teléfono y borra los recordatorios al recargar

scripts/
└── trazabilidad.js              # MOD: comprueba cada spec contra sus pruebas (001 y 003)

tests/
├── recordatorios/               # NUEVO: todas las pruebas de la 003 (etiquetas propias)
│   ├── unitarias/               # ventana, token, mensaje .eml, textos
│   ├── integracion/             # proceso diario, enlace, agenda
│   └── concurrencia/            # dos ejecuciones a la vez; cancelar frente a reservar
└── ayudas/fixture.js            # MOD: ayudas para recordatorios y reloj

README.md                        # MOD: comando, programación diaria y aviso del modo simulado
```

**Structure Decision**: se mantiene el proyecto único de la 001. La lógica vive en `src/domain/` sin conocer HTTP, HTML ni ficheros; `src/correo/` es el único sitio que sabe de `.eml` y de la carpeta de salida (si algún día hay correo real, solo cambia ahí); `src/web/` solo traduce HTTP ↔ dominio; `src/recordatorios/ejecutar.js` es un programa fino que arma reloj, base y salida y llama al dominio. Las pruebas de la 003 van en su propia carpeta para que la trazabilidad no mezcle identificadores con los de la 001 (D11).

## Decisiones del plan que conviene revisar

1. **El proceso debe ejecutarse todos los días, también sábado y domingo.** Con la ventana 24-48 h y la apertura a las 09:00, las citas del lunes solo entran en la ventana de la ejecución del domingo por la mañana. Si ese día no se ejecuta, las citas del lunes no recibirían recordatorio. Se recomienda programarlo cada día antes de las 09:00 (p. ej. 07:00). Una ejecución tardía solo avisa de las citas que aún caen en la ventana (las demás ya no tienen margen de 24 h para cancelar).
2. **Un recordatorio por cita y hora de inicio.** Si la hora de la cita cambia (en la 001, cancelar y crear otra; en el futuro, reprogramar), la cita en su nueva hora recibe su propio recordatorio y el enlace anterior deja de valer (spec FR-017/FR-018).
3. **Teléfono de la clínica como dato nuevo.** La 001 no lo guarda; se añade la tabla `clinica_contacto`. No hay pantalla para editarlo en la v1 (cero alcance fantasma): la semilla lo carga y una clínica real lo fija en la base. Queda anotado en la spec (Assumptions).
4. **Carpeta `datos/` frente a `data/`.** La 001 guarda la base en `data/` (en inglés); la spec fija `datos/salida-correo/` para los correos. Se respeta la spec y se añade `datos/` al `.gitignore` (contiene datos personales de la demostración). Unificar los nombres de carpeta queda fuera de esta spec.
5. **La página del enlace es pública y no usa la sesión de recepción.** Se protege con un token de 256 bits, `no-store`, `no-referrer` y `noindex`; abrir el enlace no cambia nada (los gestores de correo y antivirus pueden abrirlo por su cuenta). No se añade limitación de intentos (el token no es adivinable); si hace falta, será una spec propia.

## Complexity Tracking

Sin violaciones de la constitución que justificar.
