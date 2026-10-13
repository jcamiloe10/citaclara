# CitaClara

Núcleo de agenda para clínicas pequeñas (2-5 profesionales). La recepción gestiona la agenda: ve el día de cada profesional, reserva citas sin solapes y las cierra como completadas, canceladas o no asistidas.

Es un proyecto Spec-Driven: la fuente de verdad son las specs de [specs/](specs/) (propietarios en [specs/MAPA.md](specs/MAPA.md)) y los principios de [.specify/memory/constitution.md](.specify/memory/constitution.md). Las specs vigentes son [001-agenda-core](specs/001-agenda-core/spec.md) y [002-portal-del-paciente](specs/002-portal-del-paciente/spec.md).

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

Variables opcionales: `PORT` (3000 por defecto), `CITACLARA_URL_PUBLICA` (dirección pública con la que se componen los enlaces de los pacientes; sin ella se usa la de la petición), `CITACLARA_BASE` (ruta de la base SQLite, `data/citaclara.db` por defecto) y `CITACLARA_SECRETO` (secreto de firma de las sesiones; sin él, las sesiones se pierden al reiniciar).

## Datos de demostración

`npm run seed` crea "Clínica Eleva" con María y Jorge (fisioterapia), Lucía (nutrición), 4 servicios, 40 pacientes, 8 semanas de historia y 2 semanas de reservas futuras. El resultado es siempre el mismo (ver recuentos exactos en [quickstart.md](specs/001-agenda-core/quickstart.md)).

**Clave de acceso de demostración: `eleva-demo`.** Es solo para los datos de demostración; en una clínica real la clave se fija fuera del código.

Tras cargar los datos, la semana en curso queda sin citas: las reservas empiezan el lunes siguiente a la semana actual.

## Portal del paciente

Cada paciente puede ver sus citas y cancelar las futuras (hasta 24 horas antes) desde su móvil, sin cuenta ni contraseña, con un **enlace personal secreto** (`/p/<enlace>`). Recepción lo crea y lo renueva en la pantalla **Pacientes**; el enlace completo solo se muestra al crearlo o renovarlo (en la base solo se guarda su huella), y al renovarlo el anterior deja de valer. Cuando el paciente cancela, el hueco queda libre y la agenda de recepción lo muestra como "Cancelada por el paciente".

Los enlaces de los datos de demostración son deterministas, así que cualquiera puede calcularlos: son solo para demostración. `npm run seed` imprime el de Claudia Rodríguez Pérez. Más en [specs/002-portal-del-paciente/quickstart.md](specs/002-portal-del-paciente/quickstart.md).

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
