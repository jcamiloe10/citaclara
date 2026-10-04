# CitaClara

Núcleo de agenda para clínicas pequeñas (2-5 profesionales). La recepción gestiona la agenda: ve el día de cada profesional, reserva citas sin solapes y las cierra como completadas, canceladas o no asistidas.

Es un proyecto Spec-Driven: la fuente de verdad son las specs de [specs/](specs/) (propietarios en [specs/MAPA.md](specs/MAPA.md)) y los principios de [.specify/memory/constitution.md](.specify/memory/constitution.md). La spec vigente es [001-agenda-core](specs/001-agenda-core/spec.md).

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

## Estructura

```text
src/domain/    reglas de negocio (tiempo, dinero, citas, agenda, pacientes, clínicas)
src/db/        conexión SQLite y esquema (con el disparador anti-solape)
src/web/       rutas, vistas, textos en español y hoja de estilos
src/seed/      generador determinista de datos de demostración
tests/         unitarias, integración HTTP, concurrencia y semilla
scripts/       comprobación de trazabilidad spec ↔ tests
```
