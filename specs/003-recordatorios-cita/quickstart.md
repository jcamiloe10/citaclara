# Guía de validación rápida: Recordatorios de cita

Guía para comprobar de extremo a extremo que la 003 funciona. Los comandos son los previstos en el plan; se crearán al implementar las tareas.

## Requisitos previos

- Node.js 24 o superior y npm (como en la 001).
- Dependencias instaladas: `npm install`.
- Datos de demostración de la 001 cargados **con la ancla de pruebas** para que las cifras coincidan: reservas del lunes 19 al viernes 30 de octubre de 2026. La carga normal (`npm run seed`) usa la semana en curso; las cifras de más abajo se obtienen fijando el instante con `--ahora`, y solo coinciden si la ancla es el lunes 2026-10-12 (las pruebas la fijan; manualmente, cargar la semilla ese lunes o usar la base de pruebas).

## 1. Cifras esperadas (Principio V)

Con la semilla por defecto y la ancla del lunes 2026-10-12:

| Instante de referencia (hora de España) | Ventana | Recordatorios esperados |
|---|---|---|
| domingo 2026-10-18 12:00 | lunes 19 12:00 → martes 20 12:00 | **18** |
| lunes 2026-10-19 12:00 | martes 20 12:00 → miércoles 21 12:00 | **19** |
| jueves 2026-10-22 10:00 | viernes 23 10:00 → sábado 24 10:00 | **21** |
| viernes 2026-10-23 12:00 | sábado 24 12:00 → domingo 25 12:00 | **0** |

Estos recuentos están fijados en `tests/recordatorios/integracion/` (SC-001). Todas las citas de la semilla tienen un email válido, así que `sin_email` es 0 en la demostración; los casos sin email se prueban con un paciente creado en la propia prueba.

## 2. Generar los recordatorios (historia 1)

```text
npm run recordatorios -- --ahora=2026-10-18T12:00
```

Debe mostrar "modo simulado", "Generados: 18" y la carpeta `datos/salida-correo/`, y dejar 18 ficheros `.eml` en ella.

1. **Abrir uno**: abrirlo en un cliente de correo (o con un editor de texto). Debe tener asunto, destinatario, clínica, paciente, profesional, servicio, día y hora con "(hora de España)" y el enlace `…/cancelar/<token>` (SC-009, FR-007, FR-008).
2. **Sin duplicados** (US1-E4, SC-002): ejecutar de nuevo el mismo comando → "Generados: 0" y "Ya recordadas antes: 18"; siguen siendo 18 ficheros. Repetirlo 10 veces seguidas, y lanzar dos a la vez, sin cambiar el recuento.
3. **Fuera de la ventana** (US1-E2, E3): con `--ahora=2026-10-23T12:00` no se genera nada. Una cita ya cancelada, completada o no asistida dentro de la ventana no recibe recordatorio.
4. **Paciente sin email** (FR-006): dar de alta una cita con un paciente nuevo sin email válido es imposible por la interfaz (la 001 valida el email); la prueba lo fuerza en la base y comprueba "Sin email: 1", ningún fichero para esa cita y la etiqueta en la agenda.
5. **Fallo de escritura** (FR-005): con una carpeta de salida no escribible, el comando termina con código 1, deja la cita como fallida y la siguiente ejecución, ya con la carpeta arreglada, la genera.

## 3. Cancelar desde el enlace (historia 2)

```text
npm start
```

1. Con el servidor en marcha, abrir en el navegador el enlace de un `.eml` (cambiando el puerto si hace falta). Debe verse la cita y el botón "Cancelar mi cita" (nada se cancela al abrir: US2-E1, FR-010).
2. Pulsar el botón → "Tu cita queda cancelada". En `/agenda` (acceso con la clave `eleva-demo`) la cita aparece como cancelada **por el paciente** y el hueco figura libre (US2-E7, FR-016).
3. Abrir otra vez el mismo enlace → "Esta cita ya está cancelada." y nada más cambia (US2-E2, FR-013).
4. Un enlace con una letra cambiada, o inventado → "Este enlace no es válido" y ningún dato (US2-E4, FR-015).
5. **Margen de 24 h** (US2-E5, E6, FR-012): ejecutar el servidor con el reloj de pruebas o la prueba de integración, fijando el instante exactamente 24 h antes de la cita (se puede cancelar) y 23 h 59 min antes (no se puede: "Llama a la clínica" con el teléfono de la clínica de demostración).
6. **Cita sustituida** (US3-E1, E2): cancelar una cita desde recepción y crear otra del mismo paciente en otro hueco → el enlace antiguo da "ya no se puede cancelar"; el nuevo recordatorio sale en la ejecución correspondiente.
7. **Móvil**: abrir el enlace en un teléfono o con la ventana a unos 375 px: sin desplazamiento horizontal, botón ≥ 44 px (SC-003).

## 4. Pruebas automáticas

```text
npm test                  # toda la suite, 001 y 003
npm run trazabilidad      # cada FR y escenario de la 001 y de la 003 tiene un test que lo referencia
```

Las pruebas de la 003 están en `tests/recordatorios/` (unitarias, integración y concurrencia) con identificadores `[R3-…]` (research D11). Incluyen: 20 ejecuciones simultáneas sin duplicados (SC-002), cancelación por enlace frente a reserva del mismo hueco desde procesos distintos sin solapes (SC-004, Principio III), enlaces manipulados (SC-005) y el cambio de hora de octubre (SC-007).

## 5. Verificación manual de uso (SC-003, SC-006)

1. Con un cronómetro, que una persona sin formación abra el enlace en el móvil y cancele: menos de 1 minuto y como máximo 3 pasos (abrir, pulsar, ver el resultado).
2. Que otra persona, mirando solo la agenda del día, identifique en menos de 10 segundos la cita cancelada por el paciente y la reservada sin email.

## 6. Programar el proceso diario (documentado en el README)

Una vez al día, todos los días de la semana, antes de las 09:00. Ejemplo para Windows y para `cron` en el README al implementar; recordar que el domingo es necesario para avisar de las citas del lunes.
