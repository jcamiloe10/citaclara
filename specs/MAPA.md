# Mapa de specs de CitaClara

Fuente única de verdad sobre la propiedad de cada spec (Constitución, Principio I). Cada spec tiene exactamente un propietario, que decide y aprueba los cambios sobre ella. Una spec sin propietario aquí no está lista para implementarse.

| Spec | Propietario | Estado | Zona de comportamiento que toca |
|------|-------------|--------|---------------------------------|
| [001-agenda-core](001-agenda-core/spec.md) | Camilo | Cerrada (2026-10-03) | Agenda de cada profesional (escribe citas); acceso de recepción; datos de demostración |
| [002-portal-del-paciente](002-portal-del-paciente/spec.md) | Camilo | Implementada (2026-10-13); pendiente de verificación manual SC-001/SC-002 | Estado de las citas (solo cancela: reservada → cancelada); acceso personal del paciente; ficha del paciente; datos de demostración (teléfono de la clínica) |
| [003-recordatorios-cita](003-recordatorios-cita/spec.md) | Camilo | Implementada (2026-10-14); pendiente de verificación manual SC-003/SC-006 y de abrir un .eml en un cliente de correo real | Estado de las citas (solo cancela: reservada → cancelada, vía la regla de la 002); correo de salida; tabla de recordatorios |

## Relaciones entre specs

- **002 → 001**: la 002 escribe en la agenda de los profesionales al cancelar citas (hueco liberado). Reutiliza sin cambios la transición reservada → cancelada, la liberación del hueco (FR-017) y la regla de Cero Solapes de la 001; no crea, mueve ni edita citas. Aprobada el 2026-10-13 por Camilo, propietario de la 001 y de la 002: la convivencia, las tres adiciones aditivas a la 001 (`cita.cancelada_por_paciente`, `clinica.telefono` y la pantalla de pacientes) y el orden (la 002 se implementa sobre la 001 cerrada).
- **003 → 001**: la 003 cancela citas (solo libera huecos, nunca crea solapes) reutilizando sin cambios la transición reservada → cancelada, la liberación del hueco y la regla de Cero Solapes de la 001. No amplía ninguna tabla de la 001: solo añade la tabla `recordatorio`.
- **003 → 002**: la 003 se implementa **después de la 002** y reutiliza sus adiciones a la 001 (`cita.cancelada_por_paciente`, `clinica.telefono`), su regla de cancelación del paciente (hasta 24 h antes) y la etiqueta "Cancelada por el paciente" de la agenda de recepción; no las duplica. Los accesos son distintos: la 002 da un enlace personal por paciente (lo entrega recepción); la 003 da un enlace por cita dentro del recordatorio. Aprobada el 2026-10-13 por Camilo, propietario de la 001, la 002 y la 003.

Toda spec futura que escriba en la agenda de un profesional deberá declarar aquí su relación con la 001 y acordar con su propietario el orden y las reglas de convivencia (Regla III, Cero Solapes).
