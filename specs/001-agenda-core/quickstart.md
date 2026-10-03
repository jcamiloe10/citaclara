# Guía de validación rápida: Núcleo de agenda

Guía para comprobar de extremo a extremo que la 001 funciona. Los comandos son los previstos en el plan; se crearán al implementar las tareas.

## Requisitos previos

- Node.js 24 o superior y npm.
- Instalar dependencias: `npm install`.

## 1. Cargar los datos de demostración

```text
npm run seed
```

- Crea "Clínica Eleva" con María y Jorge (fisioterapia), Lucía (nutrición), 4 servicios y 40 pacientes, más 8 semanas de historia y 2 semanas de reservas futuras (ver [data-model.md](data-model.md) y [research.md](research.md), D8).
- Es repetible: ejecutarlo de nuevo deja exactamente el mismo contenido (FR-034, escenario 4.5).
- Clave de acceso de demostración: `eleva-demo`.
- **Recuentos exactos** (Principio V), con la semilla por defecto y cualquier día de carga. Con la ancla de las pruebas (lunes 2026-09-28) y con la ancla por defecto el 2026-10-03 salen estos mismos números; solo cambian las fechas:

  | Concepto | Recuento |
  |---|---|
  | Pacientes | 40 |
  | Citas en total | 996 |
  | Historia (8 semanas, 40 días laborables) | 793: 651 completadas, 79 no asistidas (10,0 %), 63 canceladas (7,9 %) |
  | Futuro (2 semanas, 10 días laborables) | 203 reservadas |

  Con la ancla de las pruebas, la historia va del lunes 3 de agosto al viernes 25 de septiembre de 2026 y las reservas, del lunes 5 al viernes 16 de octubre de 2026. Estos recuentos están fijados en `tests/semilla/semilla.test.js`.

## 2. Arrancar la aplicación

```text
npm start
```

Abrir `http://localhost:3000`. Sin clave debe mostrar solo el formulario de acceso.

## 3. Recorrido manual (historias 1 a 3)

1. **Acceso** (US2): clave incorrecta → mensaje "La clave no es correcta" y ningún dato. Clave `eleva-demo` → agenda de hoy.
2. **Navegar**: ir a la primera semana con reservas (la que empieza el lunes siguiente a la semana en curso) con "Día siguiente". Comprobar las tres columnas, los huecos libres y los tramos ocupados.
3. **Alta correcta** (US1-E1): pulsar un hueco libre de María → alta con profesional, día y hora precargados. Elegir "Sesión de fisioterapia" y un paciente → cita reservada con fin 45 minutos después.
4. **Solape** (US1-E2): repetir el alta a una hora que pise esa cita → "Ese hueco ya está ocupado" y la agenda no cambia. Probar justo al terminar la anterior (debe aceptarse).
5. **Pasado, horario y hora** (US1-E6, E8, E13): intentar un día pasado, las 08:30, las 19:30 con "Primera visita de fisioterapia" (60 min) y un sábado → mensajes distintos, sin citas creadas. El selector de hora solo ofrece saltos de 15 minutos; un envío manual con 10:07 se rechaza.
6. **Paciente nuevo** (US1-E10, E11): alta con paciente nuevo en un hueco ocupado → rechazo; al elegir otro hueco, la ficha ya está creada.
7. **Estados** (US3): "Cancelada" en una cita futura → hueco libre. "Completada" y "No asistida" aparecen desactivadas hasta que empiece la cita.
8. **Cerrar sesión** (US2-E5): botón "Cerrar sesión" → vuelve el formulario de clave.
9. **Móvil**: estrechar la ventana a unos 375 px o usar un teléfono. Sin desplazamiento horizontal de la página (SC-006); botones táctiles y legibles.

## 3b. Verificación manual de uso (SC-002, SC-003)

Con una persona que no conozca la aplicación y sin darle instrucciones:

- **SC-002**: cronometrar desde que abre la agenda del día hasta dar de alta una cita. Objetivo: menos de 1 minuto.
- **SC-003**: preguntarle si un profesional concreto tiene hueco a una hora dada, mirando solo la agenda del día. Objetivo: menos de 10 segundos.

Anotar aquí el resultado de la prueba (fecha, tiempos observados) al realizarla.

## 4. Pruebas automáticas

```text
npm test
```

- Dominio (tiempo, dinero, solape, transiciones), integración HTTP, concurrencia con procesos hijos (al menos 20 altas simultáneas del mismo hueco → exactamente 1 cita, SC-001) y semilla (recuentos, proporciones, sin solapes, dos cargas idénticas).
- `npm run trazabilidad`: comprueba que RN1 a RN4, cada requisito funcional y cada escenario de aceptación de [spec.md](spec.md) tienen al menos una prueba que los referencia (SC-008, Principio VI). Falla si falta alguna. SC-002 y SC-003 se verifican a mano (apartado 3b).

## Resultado del recorrido (2026-10-02)

Recorrido de los pasos 1 a 8 contra la aplicación real (`npm run seed` y `npm start` sobre una base nueva), lanzado como script de peticiones HTTP: todos los pasos dieron el resultado esperado. Desviación observada: el recorrido se hizo a las 22:44 en Colombia, que en España ya era sábado 3 de octubre, así que "hoy" abrió en sábado ("La clínica no abre este día"); es el comportamiento correcto, porque el día se calcula en hora de España.

**Paso 9 (móvil)**: comprobado el 2026-10-02 a 375 px con Chrome emulando un móvil táctil, sobre acceso, agenda y alta: sin desplazamiento horizontal, botones táctiles de al menos 44 px y capturas revisadas. Además, auditoría de accesibilidad con axe-core sin incidencias (ver [plan.md](plan.md), decisión 4).

**Pendiente de verificar a mano**: las mediciones de uso de SC-002 y SC-003 del apartado 3b, que requieren a una persona que no conozca la aplicación, y, si se desea, una prueba en un teléfono físico.

## Criterio de "hecho"

Todo el recorrido manual correcto, `npm test` y `npm run trazabilidad` en verde, y los recuentos de la semilla publicados en este documento.

## Referencias

- Contrato de pantallas y formularios: [contracts/interfaz-recepcion.md](contracts/interfaz-recepcion.md)
- Modelo de datos y reglas de integridad: [data-model.md](data-model.md)
- Decisiones técnicas: [research.md](research.md)
