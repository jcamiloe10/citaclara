# CitaClara

Núcleo de agenda para clínicas pequeñas (2-5 profesionales). La recepción gestiona la agenda: ve el día de cada profesional, reserva citas sin solapes y las cierra como completadas, canceladas o no asistidas. Un panel de analítica de solo lectura muestra, para la reunión de renovación, la ocupación y la no asistencia por profesional, los ingresos por servicio y su evolución en las últimas 8 semanas.

Es un proyecto Spec-Driven: la fuente de verdad son las specs de [specs/](specs/) (propietarios en [specs/MAPA.md](specs/MAPA.md)) y los principios de [.specify/memory/constitution.md](.specify/memory/constitution.md). Specs vigentes: [001-agenda-core](specs/001-agenda-core/spec.md) (agenda, acceso y datos de demostración) y [004-citaclara-analitica](specs/004-citaclara-analitica/spec.md) (panel de analítica, solo lectura sobre los datos de la 001).

## Requisitos

- Node.js 24 o superior y npm.

## Comandos

```text
npm install            # instala las dependencias (solo express en producción)
npm run seed           # carga los datos de demostración de Clínica Eleva (repetible)
npm start              # arranca la aplicación en http://localhost:3000
npm test               # ejecuta todas las pruebas
npm run trazabilidad   # comprueba que cada regla, requisito y escenario de la spec tiene un test
```

Variables opcionales: `PORT` (3000 por defecto), `CITACLARA_BASE` (ruta de la base SQLite, `data/citaclara.db` por defecto) y `CITACLARA_SECRETO` (secreto de firma de las sesiones; sin él, las sesiones se pierden al reiniciar).

## Datos de demostración

`npm run seed` crea "Clínica Eleva" con María y Jorge (fisioterapia), Lucía (nutrición), 4 servicios, 40 pacientes, 8 semanas de historia y 2 semanas de reservas futuras. El resultado es siempre el mismo (ver recuentos exactos en [quickstart.md](specs/001-agenda-core/quickstart.md)).

**Clave de acceso de demostración: `eleva-demo`.** Es solo para los datos de demostración; en una clínica real la clave se fija fuera del código.

Tras cargar los datos, la semana en curso queda sin citas: las reservas empiezan el lunes siguiente a la semana actual.

## Aviso: autenticación simplificada (deuda consciente)

La versión 1 protege el panel con una única clave por clínica. No hay cuentas de usuario, recuperación de clave ni bloqueo por intentos fallidos. Es suficiente para demostración y uso piloto, y está declarada como deuda a sustituir en una spec propia.

## Garantía de cero solapes

Un profesional nunca tiene dos citas reservadas o completadas a la vez, tampoco si dos reservas del mismo hueco llegan a la vez. Se garantiza con una transacción de escritura inmediata y con un disparador en la propia base de datos. Las pruebas lo comprueban con procesos distintos que atacan el mismo fichero (`tests/concurrencia/`).

## Panel de analítica (solo lectura)

`/analitica` (enlace "Analítica" en la cabecera, con la misma clave de clínica que la agenda) muestra la ocupación semanal y la tasa de no asistencia por profesional, los ingresos por servicio y su evolución en las últimas 8 semanas. Es estrictamente de solo lectura: no existe ningún formulario ni acción que escriba en la agenda, la clínica, los profesionales, los servicios o los pacientes. Esa garantía tiene dos defensas (igual filosofía que el cero solapes de la 001): el dominio de esta feature solo emite `SELECT`, y además lee a través de una segunda conexión SQLite con un autorizador que rechaza cualquier escritura, aunque el código se equivocara. Detalle en [specs/004-citaclara-analitica](specs/004-citaclara-analitica/spec.md).

## Estructura

```text
src/domain/    reglas de negocio (tiempo, dinero, citas, agenda, pacientes, clínicas, analítica)
src/db/        conexión SQLite y esquema (con el disparador anti-solape y la conexión de solo lectura)
src/web/       rutas (agenda, citas, analítica), vistas, textos en español y hoja de estilos
src/seed/      generador determinista de datos de demostración
tests/         unitarias, integración HTTP, concurrencia, semilla y solo-lectura
scripts/       comprobación de trazabilidad spec ↔ tests (todas las specs de specs/)
```
