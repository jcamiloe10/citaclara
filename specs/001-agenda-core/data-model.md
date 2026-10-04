# Modelo de datos: Núcleo de agenda de CitaClara

Almacén: SQLite (ver `research.md`, D2). Todas las tablas de negocio llevan `clinica_id`: una clínica nunca ve datos de otra (FR-003), aunque la 001 solo cargue una.

## Entidades

### clinica
| Campo | Tipo | Reglas |
|---|---|---|
| id | entero, clave | |
| nombre | texto | obligatorio, no vacío |
| clave_hash | texto | *hash* `scrypt` con sal; nunca la clave en claro (FR-004, D7). La clave es única entre clínicas (FR-003): se comprueba al crear la clínica verificándola contra los *hash* existentes, no con una restricción de base de datos |

### profesional
| Campo | Tipo | Reglas |
|---|---|---|
| id | entero, clave | |
| clinica_id | → clinica | obligatorio |
| nombre | texto | obligatorio |
| especialidad | texto | obligatorio |

### servicio
| Campo | Tipo | Reglas |
|---|---|---|
| id | entero, clave | |
| clinica_id | → clinica | obligatorio |
| nombre | texto | obligatorio |
| duracion_min | entero | > 0 (FR-006) |
| precio_centimos | entero | ≥ 0; el precio en euros se deriva solo para mostrar (FR-015) |

### paciente
| Campo | Tipo | Reglas |
|---|---|---|
| id | entero, clave | |
| clinica_id | → clinica | obligatorio |
| nombre | texto | obligatorio (FR-008b) |
| telefono | texto | formato válido en España (9 dígitos, admite prefijo +34 y espacios) |
| email | texto | formato válido |

Sin restricción de unicidad: dos fichas con los mismos datos se aceptan (supuesto de la spec).

### cita
| Campo | Tipo | Reglas |
|---|---|---|
| id | entero, clave | |
| clinica_id | → clinica | obligatorio |
| profesional_id | → profesional | obligatorio, misma clínica |
| servicio_id | → servicio | obligatorio, misma clínica |
| paciente_id | → paciente | obligatorio, misma clínica |
| inicio | instante UTC (texto ISO 8601 con `Z`) | obligatorio |
| fin | instante UTC | siempre `inicio + duracion_min` del servicio (FR-010); `fin > inicio` |
| estado | `reservada` \| `completada` \| `cancelada` \| `no_asistida` | nace `reservada` (FR-011) |

Las citas guardan `inicio` y `fin` ya calculados (el cambio posterior de la duración de un servicio no altera citas existentes).

## Reglas de integridad y dónde se aplican

| Regla | Spec | Capa |
|---|---|---|
| Sin solape (profesional, `reservada`/`completada`) | RN1, FR-016/017/018/019 | Servicio de citas (transacción inmediata) **y** disparador en la base |
| `inicio` posterior al instante actual | RN2, FR-020 | Servicio de citas (reloj inyectado) |
| `inicio` en múltiplo de 15 minutos (hora de Madrid) | RN4, FR-020c | Servicio de citas (módulo de tiempo) |
| Dentro del horario de la clínica (L–V, 09:00–20:00 Madrid; fin ≤ 20:00) | RN3, FR-020b | Servicio de citas (módulo de tiempo) |
| Transiciones válidas | FR-012/013/014 | Servicio de citas; el `UPDATE` de estado exige `estado = 'reservada'` en su condición (el segundo cambio simultáneo no afecta a ninguna fila) |
| Misma clínica en profesional, servicio y paciente | FR-009 | Servicio de citas, y claves foráneas |
| Solape medido como intervalos semiabiertos `[inicio, fin)` | Edge case "se tocan en un extremo" | Misma consulta en servicio y disparador: `a.inicio < b.fin AND b.inicio < a.fin` |

## Transiciones de estado

```text
              ┌──────────► completada   (desde el instante de inicio)
reservada ────┼──────────► no_asistida  (desde el instante de inicio)
              └──────────► cancelada    (mientras siga reservada, antes o después del inicio)

completada, cancelada, no_asistida: finales, sin salida.
```

- Solo `reservada` ocupa hueco junto con `completada`. Pasar a `cancelada` o `no_asistida` libera el hueco; ninguna transición puede crear un solape (FR-019).
- Las transiciones no revalidan RN2 ni RN3 (solo se aplican a la creación).

## Índices

- `cita (clinica_id, profesional_id, inicio)`: agenda del día y consulta de solape.
- `cita (clinica_id, inicio)`: navegación por días.
- `paciente (clinica_id, nombre)`: selector de pacientes.

## Datos de demostración (resumen cuantitativo)

Con la ancla y la semilla por defecto del generador (valores exactos en `research.md`, D8):
- 1 clínica, 3 profesionales, 4 servicios, 40 pacientes.
- Historia: 40 días laborables × agenda de 3 profesionales. Proporciones exactas por cuotas: 10 % `no_asistida`, 8 % `cancelada`, resto `completada`.
- Futuro: 10 días laborables, todas `reservada`.
- El número total de citas lo fija el generador y se publica en `quickstart.md` una vez implementado, junto a los recuentos por estado (Principio V).
