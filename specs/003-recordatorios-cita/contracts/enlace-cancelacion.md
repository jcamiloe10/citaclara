# Contrato: páginas públicas del enlace de cancelación

Las dos rutas siguientes son públicas: no exigen la clave de la clínica ni sesión de recepción (la credencial es el token del enlace; FR-010). Se añaden a las rutas de recepción de la 001 ([../../001-agenda-core/contracts/interfaz-recepcion.md](../../001-agenda-core/contracts/interfaz-recepcion.md)), que no cambian.

Convenciones:
- `:token` es el token de 43 caracteres (base64url) del email. Cualquier otro formato se trata como token no válido.
- Todas las respuestas llevan `Cache-Control: no-store`, `Referrer-Policy: no-referrer` y `X-Robots-Tag: noindex`.
- Texto en español de España, sin jerga; fecha y hora con el formato largo de la 001 y la indicación "hora de España" ("viernes 16 de octubre de 2026, 10:00").
- Móvil primero: sin desplazamiento horizontal, botones de al menos 44 px, cada resultado con texto e icono (no solo color).
- Una `GET` **nunca** cambia nada (los gestores de correo pueden abrir el enlace por su cuenta).
- Nunca se muestran datos de otros pacientes ni de otras citas.

## Ver la cita

| Ruta | Método | Resultado |
|---|---|---|
| `/cancelar/:token` | GET | Ver tabla de situaciones. |

| Situación | Estado HTTP | Contenido |
|---|---|---|
| Recordatorio válido, cita `reservada`, faltan 24 h o más | 200 | Datos de la cita (clínica, paciente, profesional, servicio, día y hora) y el botón "Cancelar mi cita" (formulario `POST` a la misma ruta), con la explicación "Al cancelar, el hueco queda libre para otra persona". |
| Cita `reservada`, faltan menos de 24 h (o ya ha empezado) | 200 | Datos de la cita y el aviso "Ya no se puede cancelar desde aquí. Llama a la clínica" con su teléfono si lo hay. Sin botón. |
| Cita ya `cancelada` (por el paciente o por recepción) | 200 | Datos de la cita y "Esta cita ya está cancelada." Sin botón. |
| Cita `completada` o `no_asistida` | 200 | "Esta cita ya no se puede cancelar." Sin botón. |
| Token desconocido, mal formado o recordatorio sustituido por un cambio de hora (FR-017) | 404 | "Este enlace no es válido." Sin datos de ninguna cita ni paciente y sin indicar si la cita existe (FR-015). |

## Cancelar la cita

| Ruta | Método | Entrada | Resultado |
|---|---|---|---|
| `/cancelar/:token` | POST | Ninguna (el token va en la ruta) | Aplica `cancelarPorEnlace` (research D5) y muestra el resultado. |

| Resultado | Estado HTTP | Contenido | Efecto |
|---|---|---|---|
| `cancelada` | 200 | "Tu cita queda cancelada. Gracias por avisar." con los datos de la cita | Cita `reservada → cancelada` con `cancelada_por_paciente = 1`, hueco libre. |
| `ya_cancelada` (repetir la operación, FR-013) | 200 | "Esta cita ya está cancelada." | Ninguno. |
| `no_reservada` | 200 | "Esta cita ya no se puede cancelar." | Ninguno. |
| `sin_margen` | 200 | "Ya no se puede cancelar desde aquí. Llama a la clínica" (con teléfono si lo hay) | Ninguno. |
| `no_valido` | 404 | "Este enlace no es válido." | Ninguno. |

Notas:
- Las respuestas informativas devuelven 200 (no son errores técnicos); solo `no_valido` devuelve 404.
- El margen de 24 h es inclusivo: a exactamente 24 h aún se puede cancelar.
- Si la cancelación coincide con otra operación sobre la misma cita (recepción, otra apertura del mismo enlace), solo una gana; la otra recibe `ya_cancelada` o `no_reservada`. Nunca queda un solape (los únicos cambios que hace son liberar el hueco).

## Vista de recepción (agenda del día de la 001, con las etiquetas de la 002)

Sin rutas nuevas. En `/agenda` de la 001:

- Una cita cancelada desde este enlace se guarda con `cancelada_por_paciente = 1` (la misma función de la 002) y la agenda ya la muestra con la etiqueta "Cancelada por el paciente" (texto + icono) en el histórico del día; no se añade ninguna etiqueta propia.
- Una cita `reservada` cuyo recordatorio es `sin_email` muestra la etiqueta "Sin email: sin recordatorio" (texto + icono), para que recepción pueda llamar al paciente.
- El resto de la pantalla no cambia.
