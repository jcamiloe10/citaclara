# Mapa de specs de CitaClara

Fuente única de verdad sobre la propiedad de cada spec (Constitución, Principio I). Cada spec tiene exactamente un propietario, que decide y aprueba los cambios sobre ella. Una spec sin propietario aquí no está lista para implementarse.

| Spec | Propietario | Estado | Zona de comportamiento que toca |
|------|-------------|--------|---------------------------------|
| [001-agenda-core](001-agenda-core/spec.md) | Camilo | Cerrada (2026-10-03) | Agenda de cada profesional (escribe citas); acceso de recepción; datos de demostración |
| [004-citaclara-analitica](004-citaclara-analitica/spec.md) | Camilo | Aprobada (2026-10-13) | Panel de analítica de solo lectura (ocupación, no asistencia, ingresos, evolución); no escribe nada |

## Relaciones entre specs

Toda spec futura que escriba en la agenda de un profesional deberá declarar aquí su relación con la 001 y acordar con su propietario el orden y las reglas de convivencia (Regla III, Cero Solapes).

- **004-citaclara-analitica → 001-agenda-core**: la 004 solo lee las entidades de la 001 (clínica, profesional, servicio, paciente, cita) a través de una conexión de solo lectura; no escribe en la agenda de ningún profesional y por tanto no le aplica la Regla III como escritor. Cualquier cambio futuro del esquema o del acceso de la 001 debe revisar si rompe las consultas de la 004.
