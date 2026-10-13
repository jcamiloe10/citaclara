# Modelo de datos: Recordatorios de cita

Amplía el modelo de la 001 ([../001-agenda-core/data-model.md](../001-agenda-core/data-model.md)) con dos tablas nuevas. No se modifica ninguna tabla de la 001. Instantes en UTC (texto ISO 8601), como en la 001.

## Tablas nuevas

### `clinica_contacto`

Teléfono de contacto de la clínica (FR-009, FR-012).

| Campo | Tipo | Reglas |
|---|---|---|
| `clinica_id` | entero, clave primaria | Referencia a `clinica(id)`. Una fila como máximo por clínica. |
| `telefono` | texto | No vacío tras recortar espacios. Se muestra tal cual en el email y en la página. |

Una clínica sin fila no tiene teléfono: los textos dicen "llama a la clínica" sin número.

### `recordatorio`

Un aviso a un paciente sobre una cita en una hora concreta (FR-004, FR-017, FR-018).

| Campo | Tipo | Reglas |
|---|---|---|
| `id` | entero, clave primaria | |
| `clinica_id` | entero | Referencia a `clinica(id)`; coincide con la de la cita. |
| `cita_id` | entero | Referencia a `cita(id)`. |
| `inicio_cita` | texto | Hora de inicio de la cita **cuando se generó** el recordatorio (FR-017). |
| `resultado` | texto | `generado`, `sin_email` o `fallido` (ver estados). |
| `modo` | texto, nulo | `simulado` cuando `resultado = 'generado'`; nulo en los demás. |
| `fichero` | texto, nulo | Nombre del `.eml` escrito (sin ruta); nulo si no se generó. |
| `token_huella` | texto, nulo | SHA-256 en hexadecimal del token del enlace. Nulo si no se generó. Índice **único**. |
| `error` | texto, nulo | Motivo breve del fallo cuando `resultado = 'fallido'`. |
| `generado_en` | texto | Instante de la última ejecución que tocó la fila. |
| `cancelada_en` | texto, nulo | Instante en que el paciente canceló la cita con este enlace (FR-016). |

## Reglas de integridad

- **R1 (sin duplicados, FR-004)**: `UNIQUE (cita_id, inicio_cita)`. Cada cita tiene como máximo un recordatorio por hora de inicio. Segunda defensa; la primera es la transacción inmediata del proceso (research D4).
- **R2**: `resultado IN ('generado', 'sin_email', 'fallido')`.
- **R3**: si `resultado = 'generado'`, `modo`, `fichero` y `token_huella` no son nulos; si `resultado = 'sin_email'`, los tres son nulos (no hay mensaje ni enlace); si `fallido`, `token_huella` es nulo y `error` no es nulo.
- **R4**: `cancelada_en` solo puede ser no nulo cuando `resultado = 'generado'`.
- **R5**: el token en claro no se guarda en ninguna tabla (solo en el `.eml`).
- **R6 (cero solapes, Principio III)**: las nuevas tablas no tocan la agenda; la única escritura sobre `cita` que hace esta feature es `reservada → cancelada` (solo libera ocupación), protegida por los disparadores de la 001.

## Estados del recordatorio

```text
(sin fila) ──ejecución──▶ generado ──enlace confirmado (cita reservada, ≥ 24 h)──▶ generado + cancelada_en
          ├──────────────▶ sin_email   (paciente sin email válido; no hay enlace)
          └──────────────▶ fallido ──siguiente ejecución──▶ generado | sin_email | fallido
```

- `generado` y `sin_email` son resultados finales para esa hora de inicio: las ejecuciones siguientes los omiten (FR-004).
- `fallido` se reintenta en la siguiente ejecución mientras la cita siga en la ventana (FR-005).
- Una fila nunca cambia de `cita_id` ni de `inicio_cita`. Si la cita cambia de hora, la fila antigua queda como historial y la cita en su nueva hora puede tener otra fila.

## Validez del enlace

El enlace permite ver o cancelar solo si **todas** estas condiciones se cumplen (research D5):

1. Existe un `recordatorio` con la huella del token y `resultado = 'generado'`.
2. `cita.inicio = recordatorio.inicio_cita` (la cita no se ha movido, FR-017).
3. `cita.estado = 'reservada'`.
4. Para cancelar: `cita.inicio - ahora >= 24 h` (inclusive, FR-012).

Resultados posibles: `cancelada` (ok), `ya_cancelada` (la cita ya está cancelada; FR-013), `no_reservada` (completada, no asistida o cancelada por recepción), `sin_margen` (faltan menos de 24 h o la cita ya empezó: llamar a la clínica), `no_valido` (token desconocido o recordatorio sustituido por un cambio de hora; mensaje genérico, FR-015).

## Consultas que añade esta feature

- **Citas a recordar**: citas con `estado = 'reservada'` y `inicio` en `[ahora + 24 h, ahora + 48 h)`, con el paciente, el servicio, el profesional y la clínica, ordenadas por `inicio, id`; se excluyen las que ya tienen un recordatorio `generado` o `sin_email` para esa hora de inicio.
- **Agenda del día (ampliada)**: cada cita incluye `recordatorio` = `{ resultado, canceladaPorPaciente }` de la fila con el mismo `inicio_cita`, o nulo (FR-006, FR-016).

## Datos de demostración

La semilla de la 001 se amplía solo con `clinica_contacto` para Clínica Eleva. Al recargarla se borran antes `recordatorio` y `clinica_contacto` de la clínica (las claves foráneas lo exigen). Los recuentos de la 001 no cambian (research D10).
