# Modelo de datos: Panel de analítica de CitaClara

Esta feature no añade ninguna tabla ni columna: lee exclusivamente las entidades ya definidas en
[`specs/001-agenda-core/data-model.md`](../001-agenda-core/data-model.md) (`clinica`,
`profesional`, `servicio`, `paciente`, `cita`), a través de la conexión de solo lectura descrita
en `research.md` (D2). Todas las cifras de este documento son **derivadas**: se calculan al
vuelo en cada petición y nunca se guardan.

## Periodo analizado

Todas las cifras de `/analitica` comparten el mismo periodo: las **8 semanas laborales completas
anteriores a la semana que contiene `ahora()`** (Assumptions de `spec.md`; mismo criterio que la
historia de los datos de demostración de 001). Si la clínica tiene menos de 8 semanas de citas,
se usan solo las semanas con alguna cita (US2, escenario 3).

```text
inicioPeriodo = sumarDias(lunesDeLaSemana(hoyMadrid(ahora())), -7 * 8)
finPeriodo    = lunesDeLaSemana(hoyMadrid(ahora()))           // exclusivo
```

Una cita pertenece al periodo si `inicio ∈ [inicioPeriodo, finPeriodo)` (hora de España).

## Ocupación semanal de un profesional (FR-004)

| Campo | Origen |
|---|---|
| `profesionalId`, `nombre`, `especialidad` | `profesional` |
| `minutosOcupados` | suma de `fin - inicio` (minutos) de sus citas del periodo con `estado IN ('completada', 'no_asistida')` |
| `minutosDisponibles` | `semanasDelPeriodo × 3.300` (5 días × 660 minutos, RN3 de 001; `semanasDelPeriodo` es el número de semanas completas que cubre el periodo analizado — 8, o menos si la clínica es más joven — y es el mismo para los tres profesionales, porque el horario de RN3 no varía por profesional) |
| `ocupacion` | `minutosOcupados / minutosDisponibles`; `undefined` ("sin datos") si el profesional no tiene ninguna cita en el periodo (FR-008) |

Las citas `cancelada` no suman `minutosOcupados` (liberaron el hueco).

## Tasa de no asistencia de un profesional (FR-005)

| Campo | Origen |
|---|---|
| `profesionalId` | `profesional` |
| `totalCitas` | citas del profesional en el periodo con `estado IN ('completada','no_asistida','cancelada')` |
| `noAsistidas` | de ellas, las de `estado = 'no_asistida'` |
| `tasaNoAsistencia` | `noAsistidas / totalCitas`; `undefined` ("sin datos") si `totalCitas = 0` |

Las citas `reservada` (futuras, aún no cerradas) no entran en ningún total: la tasa solo tiene
sentido sobre citas ya cerradas.

## Ingresos por servicio (FR-006)

| Campo | Origen |
|---|---|
| `servicioId`, `nombre` | `servicio` |
| `citasCompletadas` | recuento de citas de ese servicio en el periodo con `estado = 'completada'` |
| `ingresosCentimos` | `citasCompletadas × precio_centimos` del servicio (el precio es el vigente en el servicio; 001 no versiona precios históricos) |

`ingresosCentimos` se formatea con `formatearEuros` (`domain/dinero.js`), igual que el resto de
importes de la aplicación.

## Serie de evolución semanal (FR-007)

Una fila por cada semana laboral completa del periodo, de la más antigua a la más reciente:

| Campo | Origen |
|---|---|
| `lunes` | día (`AAAA-MM-DD`) del lunes de esa semana |
| `ingresosCentimos` | suma de `precio_centimos` de las citas `completada` de toda la clínica cuyo `inicio` cae esa semana |
| `tasaNoAsistencia` | `no_asistida / (completada + no_asistida + cancelada)` de toda la clínica, esa semana |

## Aislamiento por clínica

Toda consulta de este documento filtra por `clinica_id = ?` con el identificador de la sesión
(FR-002), exactamente igual que las consultas de `domain/agenda.js` en 001.
