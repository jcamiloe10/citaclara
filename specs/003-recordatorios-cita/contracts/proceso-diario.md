# Contrato: proceso diario de recordatorios

Comando: `npm run recordatorios` (ejecuta `src/recordatorios/ejecutar.js`).

## Entrada

| Elemento | Obligatorio | Significado |
|---|---|---|
| `--ahora=AAAA-MM-DDTHH:MM` | No | Instante de referencia en hora de España, para pruebas y demostraciones. Sin él se usa el reloj real. Un valor mal formado termina con error (código 2) sin tocar nada. |
| `CITACLARA_BASE` | No | Ruta de la base SQLite (igual que la 001). |
| `CITACLARA_URL_PUBLICA` | No | Dirección base del enlace de cancelación. Por defecto `http://localhost:<PORT o 3000>`. |
| `CITACLARA_SALIDA_CORREO` | No | Carpeta de salida de los `.eml`. Por defecto `datos/salida-correo/`. |
| `CITACLARA_REMITENTE` | No | Dirección del remitente de los correos. Por defecto `no-responder@citaclara.invalid`. |

El proceso trata todas las clínicas de la base.

## Qué hace

1. Fija `ahora` una sola vez. Calcula la ventana `[ahora + 24 h, ahora + 48 h)` (research D2).
2. Para cada cita `reservada` de la ventana que no tenga recordatorio resuelto (`generado` o `sin_email`) para su hora de inicio, en orden de `inicio, id`:
   - Paciente con email válido (mismo criterio que la ficha de la 001): compone el mensaje, escribe el `.eml` y guarda `generado` (modo `simulado`).
   - Paciente sin email válido: guarda `sin_email`; no escribe nada.
   - Fallo al escribir: guarda `fallido` con el motivo y **continúa** con la siguiente cita.
3. Escribe el resumen y termina.

Es idempotente: ejecutarlo de nuevo con la misma ventana no genera nada nuevo salvo los `fallido`, que reintenta (FR-004, FR-005). Dos ejecuciones simultáneas no duplican (research D4).

## Salida (consola, en español)

```text
Recordatorios de citas · modo simulado (los correos se escriben como ficheros, no se envían)
Instante de referencia: domingo 18 de octubre de 2026, 12:00 (hora de España)
Ventana: del lunes 19 de octubre de 2026, 12:00 al martes 20 de octubre de 2026, 12:00
Generados: 18
Sin email: 0
Fallidos: 0
Ya recordadas antes: 0
Carpeta de salida: datos/salida-correo/
```

Los números del ejemplo son los de [quickstart.md](../quickstart.md). La palabra "simulado" aparece siempre mientras no haya correo real (FR-021).

## Códigos de salida

| Código | Significado |
|---|---|
| 0 | Terminó; ninguna cita falló. |
| 1 | Terminó, pero al menos un recordatorio quedó `fallido` (el planificador puede avisar). |
| 2 | Argumento no válido o la base no se pudo abrir; no se tocó nada. |

## Programación recomendada

Dos veces al día (p. ej. 06:30 y 08:00), **todos los días de la semana** (sábado y domingo incluidos), antes de las 09:00 hora de España. La segunda ejecución reintenta lo que fallara en la primera y recoge reservas de última hora; ambas son idempotentes. Las citas del lunes solo entran en la ventana de las ejecuciones del domingo (plan, decisión 1). Una cita que ya queda a menos de 24 h no recibe recordatorio (spec US1-E7). El README documenta la orden del Programador de tareas de Windows y la línea de `cron`.
