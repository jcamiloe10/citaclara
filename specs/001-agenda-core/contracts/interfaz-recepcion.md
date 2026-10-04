# Contrato de interfaz: panel de recepción

CitaClara 001 no expone una API pública: las rutas son las de las pantallas de recepción (HTML generado en servidor) y los formularios que reciben. Este documento fija el comportamiento observable de cada ruta; es la referencia para las pruebas de integración.

Convenciones:
- Todas las rutas, salvo `/acceso`, exigen sesión válida (FR-001). Sin sesión, redirigen a `/acceso` (303) y no devuelven datos.
- Las rutas `POST` exigen token CSRF (campo oculto `csrf`); si falta o no coincide, devuelven 403 con un mensaje en español.
- Fechas en rutas: `AAAA-MM-DD` (día en hora de España). Instantes en formularios: fecha `AAAA-MM-DD` + hora `HH:MM`, interpretadas en `Europe/Madrid`.
- Todo texto de respuesta en español de España; los errores se muestran en la propia pantalla, sin páginas técnicas.

## Acceso

| Ruta | Método | Entrada | Resultado |
|---|---|---|---|
| `/acceso` | GET | — | Formulario con el campo "Clave de la clínica". |
| `/acceso` | POST | `clave` (la clave identifica a la clínica, FR-003; no hay selector de clínica) | Clave correcta (FR-002b): cookie de sesión de 12 horas con la clínica identificada y redirección (303) a `/agenda`. Incorrecta (FR-002): 401 con el mismo formulario y el mensaje "La clave no es correcta", sin ningún dato de la clínica. |
| `/salir` | POST | `csrf` | Borra la sesión y redirige a `/acceso`. Botón "Cerrar sesión" visible en todas las pantallas. |

## Agenda del día

| Ruta | Método | Entrada | Resultado |
|---|---|---|---|
| `/` | GET | — | Redirige a `/agenda`. |
| `/agenda` | GET | `dia` (opcional; por defecto hoy en Madrid) | Agenda del día (FR-022 a FR-024). Un día inválido devuelve 400 con mensaje y enlace a "Hoy". |

Contenido de `/agenda`:
- Título con el día completo en español ("viernes 2 de octubre de 2026") y enlaces "Día anterior", "Hoy", "Día siguiente".
- Una columna (ordenador) o sección apilada (móvil) por profesional, con nombre y especialidad.
- Franja de 09:00 a 20:00. Cada tramo es **ocupado** (cita `reservada` o `completada`) o **libre**. En sábado y domingo no hay tramos reservables y se indica "La clínica no abre este día".
- Un tramo ocupado muestra horario ("10:00–10:45"), paciente, servicio y estado en texto ("Reservada", "Completada"), con icono además del color.
- Citas `cancelada` y `no_asistida`: el tramo aparece libre y la cita se lista como histórico del día, con su estado diferenciado (FR-023, escenario 2.4).
- Cada hueco libre enlaza al alta con profesional, día y la hora de inicio de ese hueco precargados (FR-025). Los huecos empiezan siempre en múltiplos de 15 minutos (RN4).
- Sobre cada cita `reservada`, botones "Completada", "Cancelada" y "No asistida" (FR-026). "Completada" y "No asistida" no se ofrecen (se muestran desactivados con la explicación "Disponible cuando empiece la cita") antes del instante de inicio.

## Alta de cita

| Ruta | Método | Entrada | Resultado |
|---|---|---|---|
| `/citas/nueva` | GET | `profesional`, `dia`, `hora` (opcionales, precargan el formulario) | Formulario: profesional, servicio (con duración y precio), paciente existente **o** paciente nuevo (nombre, teléfono, email), día y hora de inicio (selector en saltos de 15 minutos entre 09:00 y 19:45). Muestra la hora de fin calculada. |
| `/citas` | POST | `csrf`, `profesional_id`, `servicio_id`, `dia`, `hora`, y o bien `paciente_id` o bien `paciente_nombre` + `paciente_telefono` + `paciente_email` | Ver tabla de resultados. |

Resultados de `POST /citas`:

| Situación | Código | Comportamiento |
|---|---|---|
| Alta correcta | 303 | Redirige a `/agenda?dia=…` con aviso "Cita reservada: …" y el tramo ya ocupado (FR-027). |
| Hueco ocupado (RN1/FR-018, también si perdió una carrera) | 409 | Formulario con los datos conservados y el mensaje "Ese hueco ya está ocupado". Sin cita registrada. |
| En el pasado (RN2) | 422 | "No se pueden crear citas en el pasado". |
| Fuera de horario (RN3) | 422 | "La clínica atiende de lunes a viernes, de 09:00 a 20:00; la cita debe empezar y terminar dentro de ese horario". |
| Hora de inicio que no es múltiplo de 15 minutos (RN4) | 422 | "La cita debe empezar en punto, y cuarto, y media o menos cuarto". |
| Faltan datos o formato inválido | 422 | Mensaje por campo; indica qué falta (FR-021). |
| Profesional, servicio o paciente de otra clínica o inexistente | 422 | Mensaje genérico; no se revela existencia de datos ajenos. |

En todos los rechazos de la cita: ninguna cita queda registrada (FR-021). Si el paciente era nuevo, su ficha **sí** se conserva y reaparece seleccionada en el formulario (FR-008b, escenarios 1.11).

## Cambio de estado

| Ruta | Método | Entrada | Resultado |
|---|---|---|---|
| `/citas/:id/estado` | POST | `csrf`, `estado` ∈ {`completada`, `cancelada`, `no_asistida`}, `dia` | Correcto: 303 a `/agenda?dia=…` con aviso. |

| Situación | Código | Mensaje |
|---|---|---|
| Cita no reservada (ya cerrada, o segundo intento simultáneo) | 409 | "Esa cita ya no está reservada" (FR-012) |
| `completada` o `no_asistida` antes del inicio | 422 | "Todavía no ha empezado la cita" (FR-013/014) |
| Estado no permitido | 422 | Mensaje genérico |
| Cita inexistente o de otra clínica | 404 | "No se encuentra la cita" |

## Textos y formato (FR-015, FR-028)

- Fechas con día de la semana y mes en letra ("viernes 2 de octubre de 2026, 10:00"); nunca formatos numéricos ambiguos.
- Importes como "40,00 €".
- Estados visibles: Reservada, Completada, Cancelada, No asistida.
- Sin términos técnicos en pantalla (nada de "error 409", "token", "sesión expirada por CSRF"…).
