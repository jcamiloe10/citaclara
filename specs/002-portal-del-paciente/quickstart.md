# Guía de validación rápida: Portal del paciente

Comprueba de extremo a extremo que la 002 funciona.

## Requisitos previos

- Node.js 24 o superior y npm; `npm install`.
- Los de la [001](../001-agenda-core/quickstart.md).

## 1. Cargar los datos de demostración

```text
npm run seed
```

Además de lo de la 001, deja el teléfono ficticio de Clínica Eleva y un enlace personal por cada una de las 40 fichas (solo demostración; fórmula en [research.md](research.md), D7). El enlace de Claudia Rodríguez Pérez (ficha 8) es: `http://localhost:3000/p/FGkUJEVddchqH1LYJUsFz8l2LBzQvg4OZOyS6Efg3oQ` (también lo imprime `npm run seed`). Los recuentos de la 001 no cambian (996 citas).

Casos de la spec, con ancla 2026-09-28 (el reloj de las pruebas se fija en jueves 1 de octubre de 2026, 10:00):

| Caso | Dato |
|---|---|
| Claudia Rodríguez Pérez (ficha 8) | 39 citas: 10 reservadas, 24 completadas, 3 canceladas, 2 no asistidas |
| Primera próxima | cita 805: lunes 5 de octubre de 2026, 09:00 · Lucía · Consulta de nutrición |
| Última próxima | cita 960: jueves 15 de octubre de 2026, 17:45 · María · Sesión de fisioterapia |
| Dos citas el 15 de octubre | 967 (Jorge, 17:30) y 960 (María, 17:45) |
| Más reciente del historial | cita 768: viernes 25 de septiembre de 2026, 09:45 · María · Completada |
| Cancelada | cita 735: miércoles 23 de septiembre de 2026, 11:00 · Jorge · Sesión de fisioterapia |
| Mismo nombre de pila | Claudia Ruiz Romero (ficha 13) y Claudia Jiménez Ruiz (ficha 26): nunca ven las citas de Claudia Rodríguez Pérez |
| Plazo, "ahora" = domingo 4 de octubre, 10:00 | cita 798 (lunes 5, 16:30, 30 h 30 min): se puede cancelar; cita 805 (lunes 5, 9:00, 23 h): no |

## 2. Arrancar y recorrer (historias 1 a 3)

```text
npm start
```

1. **Recepción crea un enlace** (US3-E4): entrar en `http://localhost:3000` con `eleva-demo` → "Pacientes" → buscar "Rodríguez Pérez" → "Renovar enlace" y confirmar. Aparece el enlace completo y el aviso de que no volverá a mostrarse. El enlace de demostración anterior deja de funcionar.
2. **Ver citas** (US1): abrir el enlace nuevo en el móvil (o a unos 375 px de ancho). "Próximas citas" muestra 10; "Historial", 10 con "Ver más citas" hasta las 29. Sin desplazamiento horizontal. Teléfono de la clínica visible.
3. **Enlace no válido** (US3-E2, E3): cambiar un carácter del secreto, acortarlo o usar el antiguo → "Este enlace no es válido", sin datos.
4. **Cancelar** (US2-E1, E3): "Cancelar cita" en una cita con más de 24 h → confirmación → "No, volver" no cambia nada; "Sí, cancelar la cita" → aviso y cita en el historial como cancelada.
5. **Hueco libre** (US2-E2): en recepción, agenda de ese día → el tramo está libre, el histórico dice "Cancelada por el paciente" y se puede reservar de nuevo.
6. **Plazo** (US2-E4): con una cita a menos de 24 h no hay botón y se explica por qué. (Con el reloj real hay que preparar una cita a menos de 24 h; las pruebas automáticas fijan el reloj.)
7. **Cierre por recepción** (US2-E7): abrir la confirmación de una cita, cancelarla desde recepción y pulsar "Sí, cancelar la cita" en el portal → "Esa cita ya estaba cancelada".

## 3. Pruebas automáticas

```text
npm test                 # incluye unitarias, integración, concurrencia y semilla de la 002
npm run trazabilidad     # cada FR, escenario y SC de la 002 tiene al menos una prueba
```

Cobertura que debe pasar, entre otras:

- **SC-005 / Constitución III**: ≥ 20 cancelaciones simultáneas de la misma cita → exactamente 1 aplicada; cancelación contra cambio de recepción → una sola gana; cancelación contra ≥ 20 altas de recepción sobre el hueco liberado y huecos parcialmente solapados → 0 solapes.
- **SC-006**: enlaces inventados, manipulados, renovados o de otra paciente → respuesta idéntica y 0 datos ajenos; Claudia Rodríguez Pérez nunca ve citas de Claudia Ruiz Romero y viceversa.
- **FR-005**: cabeceras `no-store`, `no-referrer` y `noindex` en todas las rutas `/p/…`.
- **FR-016**: nunca se muestra "cancelada" si la cita no lo está.

## 4. Verificación manual de uso

> **Estado (2026-10-14)**: SC-001 y SC-002 **no se han medido con personas**. Camilo, propietario de la spec, la cerró sin esa prueba. Si se mide más adelante, se anotan aquí los tiempos.

- **Medir SC-003 (origen de las cancelaciones)**: `SELECT SUM(cancelada_por_paciente) AS desde_portal, COUNT(*) AS total FROM cita WHERE estado = 'cancelada' AND inicio >= ?` sobre la base de la clínica; las cancelaciones hechas por teléfono las registra recepción y cuentan con `cancelada_por_paciente = 0`.

- **SC-001**: una persona que no conoce el portal encuentra y cancela una cita en menos de 1 minuto, desde el móvil.
- **SC-002**: identifica cuál es su próxima cita en menos de 10 segundos.
- **SC-007 y SC-008**: 375 px sin desplazamiento horizontal; todo texto, fecha y hora en español de España y en hora de España (también en una cita cercana al cambio de hora del domingo 25 de octubre de 2026).
- **SC-003 y SC-004**: tras 8 semanas en producción, Sonia mide las cancelaciones hechas desde el portal frente a las telefónicas y el tiempo de recepción al teléfono, frente a la línea de base de la semana tipo.
