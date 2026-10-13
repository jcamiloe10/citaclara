# Mapa de specs de CitaClara

Fuente única de verdad sobre la propiedad de cada spec (Constitución, Principio I). Cada spec tiene exactamente un propietario, que decide y aprueba los cambios sobre ella. Una spec sin propietario aquí no está lista para implementarse.

| Spec | Propietario | Estado | Zona de comportamiento que toca |
|------|-------------|--------|---------------------------------|
| [001-agenda-core](001-agenda-core/spec.md) | Camilo | Cerrada (2026-10-03) | Agenda de cada profesional (escribe citas); acceso de recepción; datos de demostración |
| [003-recordatorios-cita](003-recordatorios-cita/spec.md) | Camilo | Borrador (2026-10-13) | Cancela citas de la agenda de cada profesional (solo libera huecos); correo de salida |

## Relaciones entre specs

- **003-recordatorios-cita → 001**: la 003 cancela citas (solo libera huecos, nunca crea solapes) y amplía la cita con el origen de la cancelación. Orden y reglas de convivencia por acordar con el propietario de la 001 antes de implementar. También conviene alinear la regla de cancelación con la 002 (portal del paciente).

Toda spec futura que escriba en la agenda de un profesional deberá declarar aquí su relación con la 001 y acordar con su propietario el orden y las reglas de convivencia (Regla III, Cero Solapes).
