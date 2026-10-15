# Hoja de verificación manual: Recordatorios de cita (003)

Cierra los pendientes T034 y T035 del [tasks.md](tasks.md). Las pruebas automáticas ya pasan (261 tests); esta hoja comprueba lo que solo una persona puede juzgar: cómo se ve el correo, cómo se usa el enlace en un móvil y cuánto se tarda.

**Quién**: una persona que prepara el entorno (apartado 1) y, para los apartados 3 y 4, otras **dos personas sin formación** sobre CitaClara (una para cada prueba). **Duración**: unos 20 minutos.

## 1. Preparar el entorno (quien conoce el proyecto)

Desde la carpeta del proyecto, con Node.js 24 o superior:

```text
npm install
npm run seed
```

Anota el instante de referencia: **el domingo anterior al primer lunes con reservas** de los datos de demostración (la semana en curso queda sin citas, las reservas empiezan el lunes siguiente). Ejemplo: si hoy es martes 13 o miércoles 14 de octubre de 2026, las reservas empiezan el lunes 19 de octubre y el instante es `2026-10-18T12:00`.

Para que el enlace funcione desde un teléfono, la dirección del ordenador debe ser alcanzable (mismo wifi). Sustituye `192.168.1.20` por la IP del ordenador (`ipconfig`):

```text
# Windows (PowerShell)
$env:CITACLARA_URL_PUBLICA = "http://192.168.1.20:3000"
npm run recordatorios -- --ahora=2026-10-18T12:00
npm start
```

Debe decir "modo simulado" y "Generados: 18" (esa cifra solo sale con el instante del ejemplo; con otra fecha cambia). Los correos quedan en `datos/salida-correo/`.

**Importante**: el enlace solo permite cancelar si la cita está a **24 horas o más del momento real**. Si ya queda menos (por ejemplo, el domingo por la tarde para una cita del lunes por la mañana), la página dirá que se llame a la clínica; es el comportamiento correcto, pero para esta prueba elige un instante de referencia más lejano (por ejemplo, el domingo siguiente) y vuelve a ejecutar el comando.

- [ ] Entorno listo: comando ejecutado, correos generados, servidor en marcha.

## 2. El correo en un cliente real (T034)

Abre uno de los `.eml` de `datos/salida-correo/` con un cliente de correo (doble clic en Windows abre el predeterminado; Thunderbird también sirve).

| Comprobación | Resultado |
|---|---|
| El asunto se lee bien, con tildes: "Recordatorio de tu cita en Clínica Eleva: lunes 19 de octubre de 2026, 15:00" | ☐ Sí ☐ No |
| El remitente aparece como "Clínica Eleva" | ☐ Sí ☐ No |
| El cuerpo tiene clínica, paciente, día y hora con "(hora de España)", profesional y servicio, sin caracteres raros (tildes y eñes) | ☐ Sí ☐ No |
| El enlace se reconoce como enlace (clicable o en una línea propia) y no está partido | ☐ Sí ☐ No |
| El texto sobre cancelar y sobre llamar a la clínica (con el teléfono) se entiende sin explicación | ☐ Sí ☐ No |
| No aparece nada técnico ni en inglés | ☐ Sí ☐ No |

Observaciones: ______________________________________________

## 3. El enlace en el teléfono (T034) y SC-003

Abre el enlace del correo en un teléfono real (copia la línea del enlace y envíatela, o escribe la dirección en el navegador). Si no hay teléfono, usa el navegador del ordenador con la ventana estrechada a unos 375 px de ancho.

| Comprobación | Resultado |
|---|---|
| La página se ve entera, sin desplazamiento horizontal | ☐ Sí ☐ No |
| Aparecen los datos de la cita y el botón "Cancelar mi cita" | ☐ Sí ☐ No |
| El botón es fácil de pulsar con el pulgar (grande, con espacio alrededor) | ☐ Sí ☐ No |
| Al abrir la página **no** se cancela nada (volver a abrir el enlace sigue ofreciendo cancelar) | ☐ Sí ☐ No |
| Tras pulsar el botón, el mensaje deja claro que la cita queda cancelada | ☐ Sí ☐ No |
| Al abrir de nuevo el mismo enlace, dice que la cita ya está cancelada y nada más cambia | ☐ Sí ☐ No |
| Un enlace con una letra cambiada muestra "Este enlace no es válido" sin datos de nadie | ☐ Sí ☐ No |

**SC-003: tiempo y pasos.** Una persona que no conoce CitaClara recibe solo el correo (sin explicaciones) y cancela la cita desde el teléfono. Cronometra desde que abre el enlace hasta que ve la confirmación.

| Objetivo | Medido |
|---|---|
| Menos de 1 minuto | Tiempo: ______ s |
| Como máximo 3 pasos (abrir, pulsar, ver el resultado) | Pasos: ______ |
| Sin pedir ayuda | ☐ Sí ☐ No |

## 4. La agenda de recepción (T035) y SC-006

En el ordenador, entra en `http://localhost:3000` con la clave `eleva-demo` y ve al día de la cita cancelada en el apartado 3 (usa "Día siguiente" hasta llegar).

Para tener también una cita **sin email**, antes de esta prueba quien prepara el entorno puede dejar sin email válido a un paciente con cita reservada en ese día y volver a ejecutar `npm run recordatorios` con el mismo instante. Esa operación se hace directamente en la base de datos (la interfaz no permite fichas sin email válido), por lo que es una preparación de la prueba, no un uso normal.

**SC-006: localizar.** Otra persona, que no ha visto el apartado 3, mira **solo la agenda del día** y señala:

| Qué debe encontrar | Tiempo | ¿Acertó? |
|---|---|---|
| La cita cancelada por el paciente (etiqueta "Cancelada por el paciente") | ______ s | ☐ Sí ☐ No |
| La cita reservada que no pudo recordarse (etiqueta "Sin email: sin recordatorio") | ______ s | ☐ Sí ☐ No |
| El hueco que dejó la cita cancelada, libre para reservar | ______ s | ☐ Sí ☐ No |

Objetivo: **menos de 10 segundos** cada uno.

## 5. Resultado y cierre

- [ ] Todos los apartados cumplen. Anotar en [quickstart.md](quickstart.md) (sección 5) la fecha, los tiempos y quién lo hizo.
- [ ] Alguna comprobación falla: describir qué y abrir un cambio de spec o de código antes de cerrar.

Tras cumplirse todos los apartados y confirmar con Sara el punto A3 (las reservas con menos de 24 h de antelación no reciben recordatorio), cambiar el estado de la 003 a "Cerrada" con fecha en `spec.md` y en `specs/MAPA.md` (tarea T036).

Persona que verifica: ____________________ Fecha: ______________
