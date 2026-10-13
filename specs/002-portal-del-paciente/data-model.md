# Modelo de datos: Portal del paciente

La 002 no crea tablas: añade tres columnas a las de la 001 (ver [research.md](research.md), D9). Los nombres de entidades y estados son los de la [001](../001-agenda-core/data-model.md).

## Cambios

| Tabla | Columna nueva | Tipo y reglas | Significado |
|---|---|---|---|
| `paciente` | `acceso_hash` | `TEXT`, nulo por defecto, **índice único** (parcial: solo no nulos) | Huella SHA-256 (hex) del secreto del enlace personal. Nulo = el paciente aún no tiene enlace. |
| `cita` | `cancelada_por_paciente` | `INTEGER NOT NULL DEFAULT 0 CHECK (cancelada_por_paciente IN (0, 1))` | 1 solo si la cita pasó a `cancelada` desde el portal. Las demás citas, incluidas las canceladas por recepción y todas las anteriores a la 002, valen 0. |
| `clinica` | `telefono` | `TEXT`, nulo por defecto | Teléfono que el portal muestra para lo que no cubre. Se guarda normalizado a 9 cifras (mismo formato que el de los pacientes) y se muestra con `formatearTelefono`. |

## Entidades de la spec y dónde viven

| Entidad de la spec | Dónde se guarda |
|---|---|
| Acceso del paciente | `paciente.acceso_hash`. El secreto en claro no se guarda nunca; solo existe en la respuesta que lo crea o renueva. |
| Origen de la cancelación | `cita.cancelada_por_paciente` (0 = recepción u otra vía; 1 = paciente). |

## Reglas de integridad

- **Un enlace por paciente**: `acceso_hash` es único y pertenece a una sola ficha, y por tanto a una sola clínica (spec, Assumptions).
- **Aislamiento**: toda consulta del portal se hace por `paciente_id` resuelto desde el secreto; ninguna ruta acepta un identificador de paciente, clínica o cita sin comprobarlo contra ese paciente (FR-002).
- **`cancelada_por_paciente = 1` ⇒ `estado = 'cancelada'`**: solo lo escribe `cancelarComoPaciente`, en la misma sentencia que cambia el estado.

## Transiciones de estado

Sin estados nuevos. El portal solo ejecuta la transición de la 001 (FR-012):

```text
reservada ──(paciente, ≥ 24 h antes del inicio)──▶ cancelada   [cancelada_por_paciente = 1]
reservada ──(recepción, en cualquier momento)────▶ cancelada   [cancelada_por_paciente = 0]
```

Las transiciones a `completada` y `no_asistida` siguen siendo exclusivas de recepción. Una cita que ya no está `reservada` no admite ningún cambio desde el portal.

## Consultas del portal

- **Resolver paciente**: `SELECT id, clinica_id, nombre FROM paciente WHERE acceso_hash = ?`.
- **Próximas**: citas del paciente con `estado = 'reservada'` e `inicio > ahora`, por `inicio` ascendente.
- **Historial**: el resto de sus citas, por `inicio` descendente, de 10 en 10.
- Cada cita se acompaña del nombre del profesional y del servicio (sin precio) y, para cada próxima, de si `inicio − ahora ≥ 24 h`.

## Datos de demostración (cambios)

- `clinica.telefono` de Clínica Eleva: número ficticio fijado en `src/seed/datos.js`.
- `paciente.acceso_hash` de las 40 fichas: huella del secreto `base64url(SHA-256("citaclara-demo:" + SEMILLA + ":" + n))`, con `n` = orden de creación de la ficha (1–40). Reproducible; solo demostración.
- Ninguna cita de la semilla tiene `cancelada_por_paciente = 1`: los recuentos de la 001 no cambian (996 citas: 793 de historia y 203 futuras).
