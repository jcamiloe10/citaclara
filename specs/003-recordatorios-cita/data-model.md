# Modelo de datos: Recordatorios de cita

La 003 se implementa **después de la 002** y reutiliza sus adiciones a la 001 ([../002-portal-del-paciente/data-model.md](../002-portal-del-paciente/data-model.md)): `cita.cancelada_por_paciente` (origen de la cancelación) y `clinica.telefono` (teléfono de contacto). La 003 **no modifica ninguna tabla existente**; solo añade una tabla nueva. Instantes en UTC (texto ISO 8601), como en la 001.

## Datos que reutiliza

| Dato | De qué spec | Uso en la 003 |
|---|---|---|
| `cita.cancelada_por_paciente` (0/1) | 002 | Se pone a 1 al cancelar desde el enlace del recordatorio (FR-016); la agenda de recepción ya muestra "Cancelada por el paciente" (002, FR-017). |
| `clinica.telefono` | 002 | Teléfono que indican el email y la página del enlace (FR-009, FR-012). Nulo = sin teléfono: los textos dicen "llama a la clínica". |
| Regla de cancelación del paciente (≥ 24 h antes, inclusiva) | 002 (`cancelarComoPaciente`) | La 003 la invoca; no la reimplementa (research D5). |
| Utilidades de enlace (`FORMATO_SECRETO`, `huellaDeSecreto`, generación de secretos de 256 bits) | 002 (`src/domain/enlaces.js`) | El enlace de cancelación usa el mismo formato y la misma huella (research D7). |

## Tabla nueva: `recordatorio`

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
| `token_huella` | texto, nulo | SHA-256 en hexadecimal del secreto del enlace de la cita. Nulo si no se generó. Índice **único**. |
| `error` | texto, nulo | Motivo breve del fallo cuando `resultado = 'fallido'`. |
| `generado_en` | texto | Instante de la última ejecución que tocó la fila. |

## Reglas de integridad

- **R1 (sin duplicados, FR-004)**: `UNIQUE (cita_id, inicio_cita)`. Cada cita tiene como máximo un recordatorio por hora de inicio. Segunda defensa; la primera es la transacción inmediata del proceso (research D4).
- **R2**: `resultado IN ('generado', 'sin_email', 'fallido')`.
- **R3**: si `resultado = 'generado'`, `modo`, `fichero` y `token_huella` no son nulos; si `resultado = 'sin_email'`, los tres son nulos (no hay mensaje ni enlace); si `fallido`, `token_huella` es nulo y `error` no es nulo.
- **R4**: el secreto en claro no se guarda en ninguna tabla (solo en el `.eml`).
- **R5 (cero solapes, Principio III)**: la nueva tabla no toca la agenda; la única escritura sobre `cita` que provoca esta feature es `reservada → cancelada` (solo libera ocupación), hecha por la función de la 002 y protegida por los disparadores de la 001.
- La tabla se crea con `CREATE TABLE IF NOT EXISTS` en `src/db/schema.sql`: no necesita migración.

## Estados del recordatorio

```text
(sin fila) ──ejecución──▶ generado ──enlace confirmado (cita reservada, ≥ 24 h)──▶ generado (la cita pasa a cancelada, cancelada_por_paciente = 1)
          ├──────────────▶ sin_email   (paciente sin email válido; no hay enlace)
          └──────────────▶ fallido ──nueva ejecución mientras la cita siga en la ventana──▶ generado | sin_email | fallido
```

- `generado` y `sin_email` son resultados finales para esa hora de inicio: las ejecuciones siguientes los omiten (FR-004).
- `fallido` se reintenta en una ejecución posterior mientras la cita siga en la ventana (FR-005).
- Una fila nunca cambia de `cita_id` ni de `inicio_cita`. Si la cita cambia de hora, la fila antigua queda como historial y la cita en su nueva hora puede tener otra fila.

## Validez del enlace

El enlace permite ver o cancelar solo si **todas** estas condiciones se cumplen (research D5):

1. Existe un `recordatorio` con la huella del secreto y `resultado = 'generado'`.
2. `cita.inicio = recordatorio.inicio_cita` (la cita no se ha movido, FR-017).
3. `cita.estado = 'reservada'`.
4. Para cancelar: `cita.inicio - ahora >= 24 h` (inclusive, FR-012); lo comprueba la función de la 002.

Resultados posibles: `cancelada` (ok), `ya_cancelada` (la cita ya estaba cancelada, por el paciente o por recepción), `no_reservada` (completada o no asistida), `sin_margen` (faltan menos de 24 h o la cita ya empezó: llamar a la clínica), `no_valido` (secreto desconocido o recordatorio sustituido por un cambio de hora; mensaje genérico, FR-015). Los códigos de la 002 se traducen a estos (research D5).

## Consultas que añade esta feature

- **Citas a recordar**: citas con `estado = 'reservada'` y `inicio` en `[ahora + 24 h, ahora + 48 h)`, con el paciente, el servicio, el profesional, la clínica y su teléfono, ordenadas por `inicio, id`; se excluyen las que ya tienen un recordatorio `generado` o `sin_email` para esa hora de inicio.
- **Agenda del día**: la etiqueta "Cancelada por el paciente" ya la da la 002 (`cancelada_por_paciente`). La 003 solo añade a cada cita `reservada` si su recordatorio es `sin_email`, para la etiqueta "Sin email: sin recordatorio" (FR-006).

## Datos de demostración

La 003 no añade datos a la semilla salvo lo que ya aporta la 002 (`clinica.telefono`). Al recargar la semilla se borran antes los `recordatorio` de la clínica (las claves foráneas lo exigen). Los recuentos de la 001 no cambian (research D10).
