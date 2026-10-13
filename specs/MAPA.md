# Mapa de specs de CitaClara

Fuente única de verdad sobre la propiedad de cada spec (Constitución, Principio I). Cada spec tiene exactamente un propietario, que decide y aprueba los cambios sobre ella. Una spec sin propietario aquí no está lista para implementarse.

| Spec | Propietario | Estado | Zona de comportamiento que toca |
|------|-------------|--------|---------------------------------|
| [001-agenda-core](001-agenda-core/spec.md) | Camilo | Cerrada (2026-10-03) | Agenda de cada profesional (escribe citas); acceso de recepción; datos de demostración |
| [002-portal-del-paciente](002-portal-del-paciente/spec.md) | Camilo | Implementada (2026-10-13); pendiente de verificación manual SC-001/SC-002 | Estado de las citas (solo cancela: reservada → cancelada); acceso personal del paciente; ficha del paciente; datos de demostración (teléfono de la clínica) |

## Relaciones entre specs

- **002 → 001**: la 002 escribe en la agenda de los profesionales al cancelar citas (hueco liberado). Reutiliza sin cambios la transición reservada → cancelada, la liberación del hueco (FR-017) y la regla de Cero Solapes de la 001; no crea, mueve ni edita citas. Aprobada el 2026-10-13 por Camilo, propietario de la 001 y de la 002: la convivencia, las tres adiciones aditivas a la 001 (`cita.cancelada_por_paciente`, `clinica.telefono` y la pantalla de pacientes) y el orden (la 002 se implementa sobre la 001 cerrada).

Toda spec que escriba en la agenda de un profesional deberá declarar aquí su relación con la 001 y acordar con su propietario el orden y las reglas de convivencia (Regla III, Cero Solapes).
