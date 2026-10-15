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
npm run recordatorios  # genera los recordatorios de las citas de las próximas 24-48 horas (modo simulado)
npm test               # ejecuta todas las pruebas
npm run trazabilidad   # comprueba que cada regla, requisito y escenario de la spec tiene un test
```

Variables opcionales: `PORT` (3000 por defecto), `CITACLARA_URL_PUBLICA` (dirección pública con la que se componen los enlaces de los pacientes; sin ella se usa la de la petición), `CITACLARA_BASE` (ruta de la base SQLite, `data/citaclara.db` por defecto) `CITACLARA_SECRETO` (secreto de firma de las sesiones; sin él, las sesiones se pierden al reiniciar), `CITACLARA_SALIDA_CORREO` (carpeta de los correos simulados, `datos/salida-correo/` por defecto) y `CITACLARA_REMITENTE` (dirección del remitente de los recordatorios).

## Datos de demostración

`npm run seed` crea "Clínica Eleva" con María y Jorge (fisioterapia), Lucía (nutrición), 4 servicios, 40 pacientes, 8 semanas de historia y 2 semanas de reservas futuras. El resultado es siempre el mismo (ver recuentos exactos en [quickstart.md](specs/001-agenda-core/quickstart.md)).

**Clave de acceso de demostración: `eleva-demo`.** Es solo para los datos de demostración; en una clínica real la clave se fija fuera del código.

Tras cargar los datos, la semana en curso queda sin citas: las reservas empiezan el lunes siguiente a la semana actual.

## Portal del paciente

Cada paciente puede ver sus citas y cancelar las futuras (hasta 24 horas antes) desde su móvil, sin cuenta ni contraseña, con un **enlace personal secreto** (`/p/<enlace>`). Recepción lo crea y lo renueva en la pantalla **Pacientes**; el enlace completo solo se muestra al crearlo o renovarlo (en la base solo se guarda su huella), y al renovarlo el anterior deja de valer. Cuando el paciente cancela, el hueco queda libre y la agenda de recepción lo muestra como "Cancelada por el paciente".

Los enlaces de los datos de demostración son deterministas, así que cualquiera puede calcularlos: son solo para demostración. `npm run seed` imprime el de Claudia Rodríguez Pérez. Más en [specs/002-portal-del-paciente/quickstart.md](specs/002-portal-del-paciente/quickstart.md).

## Recordatorios de cita

`npm run recordatorios` genera un recordatorio por email para cada cita reservada que empieza entre 24 y 48 horas después del momento de la ejecución. Cada cita se recuerda una sola vez, aunque el proceso se ejecute varias veces o a la vez. El email incluye los datos de la cita (hora de España) y un **enlace personal** (`/cancelar/<enlace>`) con el que el paciente puede cancelar hasta 24 horas antes; a menos de 24 horas se le indica que llame a la clínica. Para pruebas y demostraciones: `npm run recordatorios -- --ahora=2026-10-18T12:00` (hora de España).

**El correo es simulado.** No hay envío real: cada recordatorio es un fichero `.eml` en `datos/salida-correo/` (no se versiona) que se puede abrir con cualquier cliente de correo. La salida del comando lo recuerda siempre ("modo simulado").

**Programación.** El proceso debe ejecutarse **todos los días de la semana, también sábado y domingo, y dos veces antes de las 09:00** (por ejemplo a las 06:30 y a las 08:00): las citas del lunes solo se recuerdan en las ejecuciones del domingo, y la segunda ejecución reintenta lo que hubiera fallado en la primera. Las citas que ya empiezan en menos de 24 horas no se recuerdan. Si algún recordatorio falla, el comando termina con código 1.

```text
# Windows (Programador de tareas), desde la carpeta del proyecto:
schtasks /Create /SC DAILY /ST 06:30 /TN "CitaClara recordatorios 1" /TR "cmd /c cd /d C:utacitaclara && npm run recordatorios"
schtasks /Create /SC DAILY /ST 08:00 /TN "CitaClara recordatorios 2" /TR "cmd /c cd /d C:utacitaclara && npm run recordatorios"

# Linux/macOS (cron):
30 6 * * *  cd /ruta/citaclara && npm run recordatorios
0 8 * * *   cd /ruta/citaclara && npm run recordatorios
```

Recepción ve en la agenda del día qué citas canceló el paciente ("Cancelada por el paciente") y cuáles no pudieron recordarse por falta de email ("Sin email: sin recordatorio"). Más en [specs/003-recordatorios-cita/quickstart.md](specs/003-recordatorios-cita/quickstart.md).

## Aviso: autenticación simplificada (deuda consciente)

La versión 1 protege el panel con una única clave por clínica. No hay cuentas de usuario, recuperación de clave ni bloqueo por intentos fallidos. Es suficiente para demostración y uso piloto, y está declarada como deuda a sustituir en una spec propia.

## Garantía de cero solapes

Un profesional nunca tiene dos citas reservadas o completadas a la vez, tampoco si dos reservas del mismo hueco llegan a la vez. Se garantiza con una transacción de escritura inmediata y con un disparador en la propia base de datos. Las pruebas lo comprueban con procesos distintos que atacan el mismo fichero (`tests/concurrencia/`).

## Estructura

```text
src/domain/    reglas de negocio (tiempo, dinero, citas, agenda, pacientes, clínicas, portal, recordatorios)
src/correo/    mensaje .eml del recordatorio y salida de correo simulada
src/recordatorios/  comando del proceso diario
src/db/        conexión SQLite y esquema (con el disparador anti-solape)
src/web/       rutas, vistas, textos en español y hoja de estilos
src/seed/      generador determinista de datos de demostración
tests/         unitarias, integración HTTP, concurrencia y semilla
scripts/       comprobación de trazabilidad spec ↔ tests
```
