# Contrato de interfaz: portal del paciente y pantalla de pacientes

La 002 no expone una API pública: las rutas son las pantallas del paciente (HTML generado en servidor) y una pantalla nueva de recepción. Este documento fija el comportamiento observable y es la referencia de las pruebas de integración. Las convenciones de la 001 (fechas, textos, errores en pantalla) siguen vigentes; ver [interfaz-recepcion.md](../../001-agenda-core/contracts/interfaz-recepcion.md).

## Convenciones del portal

- Ninguna ruta `/p/…` usa la cookie de sesión de recepción ni emite cookies. La credencial es el secreto de la ruta (`<secreto>` = 43 caracteres de `A-Z a-z 0-9 - _`).
- Todas las respuestas de `/p/…` llevan `Cache-Control: no-store`, `Referrer-Policy: no-referrer` y `X-Robots-Tag: noindex`, y las páginas incluyen `<meta name="robots" content="noindex">` (FR-005).
- Un secreto con formato incorrecto, desconocido, renovado o de otra clínica produce **la misma respuesta**: 404 con la página "Este enlace no es válido" (FR-003). Esa página no contiene ningún dato de paciente ni de clínica, salvo el texto "Llama a la clínica y te daremos uno nuevo".
- Fechas y horas: "lunes 5 de octubre de 2026, 9:00", siempre en hora de España. Sin precios.
- Sin JavaScript obligatorio.
- Dentro de `/p/…` los errores tienen página propia del portal: 404 para cualquier subruta o método desconocido y 500 para un fallo interno, con las mismas cabeceras de privacidad, el texto "Llama a la clínica" y sin enlaces a `/agenda` ni a recepción. Ni la respuesta ni el registro del servidor incluyen el secreto.

## Rutas del paciente

| Ruta | Método | Resultado |
|---|---|---|
| `/p/:secreto` | GET | Página personal (ver abajo). Parámetros opcionales: `h` (cuántas citas del historial mostrar; múltiplos de 10, por defecto 10) y `aviso` (`cancelada`, `ya-cancelada`, `fuera-de-plazo`, `no-disponible`). |
| `/p/:secreto/citas/:id/cancelar` | GET | Pantalla de confirmación de la cita `:id` si es del paciente y se puede cancelar. Nunca cancela. Si no se puede, redirige (303) a `/p/:secreto?aviso=…` con la causa. |
| `/p/:secreto/citas/:id/cancelar` | POST | Cancela (ver resultados). Sin campos obligatorios. |

### Página personal (`/p/:secreto`)

- Cabecera con el nombre de la clínica y el saludo "Hola, Claudia" (primer nombre de la ficha). Pie con el nombre y el teléfono de la clínica, siempre visibles (FR-009); si la clínica no tiene teléfono registrado, solo su nombre y "Llama a la clínica" (FR-009).
- **Próximas citas** (FR-006): una tarjeta por cita, la más cercana primero, con día y hora, profesional, servicio y estado. En cada una, el botón "Cancelar cita" si faltan **24 horas o más** para el inicio; si no, el texto "A menos de 24 horas de la cita no se puede cancelar desde aquí. Llama a la clínica" y el teléfono (FR-011).
- **Historial** (FR-006, 007, 008): citas pasadas y las que ya no están reservadas (canceladas, no asistidas, completadas), la más reciente primero, de 10 en 10 con el enlace "Ver más citas". Sin acciones.
- El estado se muestra con texto e icono, no solo con color: "Reservada", "Completada", "Cancelada", "No asistida" (los de la 001).
- Sin citas (FR-010): "Todavía no tienes citas" y el teléfono de la clínica.
- Avisos (`aviso=`): "Cita cancelada: <día y hora>. Si necesitas otra cita, contacta con la clínica.", "Esa cita ya estaba cancelada", "Esa cita ya no se puede cancelar desde aquí. Llama a la clínica", "No hemos encontrado esa cita".

### Confirmación (`GET …/cancelar`)

Muestra la cita (día y hora, profesional, servicio), la pregunta "¿Seguro que quieres cancelar esta cita?" y dos acciones: "Sí, cancelar la cita" (formulario `POST`) y "No, volver" (enlace a `/p/:secreto`). Una cita que no es del paciente se trata igual que una inexistente.

### Resultados de `POST …/cancelar`

| Situación | Código | Comportamiento |
|---|---|---|
| Cancelada | 303 | A `/p/:secreto?aviso=cancelada&cita=:id`; la cita sale de "Próximas" y aparece en el historial como cancelada (US2-E1, E8). |
| Ya no estaba reservada (recepción la cerró antes, doble pulsación, otro dispositivo) | 303 | A `/p/:secreto?aviso=ya-cancelada` si estaba cancelada, o `aviso=fuera-de-plazo` si estaba completada o no asistida; la lista muestra el estado real (US2-E6, E7; FR-015, FR-016). |
| Menos de 24 horas | 303 | A `/p/:secreto?aviso=fuera-de-plazo`; la cita no cambia (US2-E4). |
| Cita de otro paciente, de otra clínica o inexistente | 303 | A `/p/:secreto?aviso=no-disponible`; nada cambia ni se revela (FR-002). |

En ningún caso se muestra "cancelada" si la cita no lo está (FR-016).

## Pantalla de pacientes (recepción)

Requiere sesión de recepción (001). Las rutas `POST` exigen el token CSRF de la 001.

| Ruta | Método | Entrada | Resultado |
|---|---|---|---|
| `/pacientes` | GET | `q` (opcional, busca por nombre sin distinguir tildes ni mayúsculas) | Lista de pacientes de la clínica por nombre: nombre, teléfono, email, "Con enlace" / "Sin enlace" y un botón "Crear enlace" o "Renovar enlace". Enlace "Pacientes" en la cabecera de recepción. Sin sesión, redirige a `/acceso` (303). |
| `/pacientes/:id/enlace` | GET | — | Para un paciente con enlace, pantalla de confirmación "Renovar el enlace deja de valer el anterior. ¿Continuar?"; para uno sin enlace, formulario de creación. |
| `/pacientes/:id/enlace` | POST | `csrf` | Crea o renueva el enlace y responde **200** con la pantalla del enlace nuevo (sin redirección, para que el secreto no se repita en el historial): enlace completo, campo de solo lectura para copiarlo y el aviso "Este enlace no volverá a mostrarse. Si se pierde, renuévalo". Paciente de otra clínica o inexistente: 404. |

El enlace completo es `CITACLARA_URL_PUBLICA` + `/p/` + secreto; sin la variable, se usa el esquema y host de la petición.

## Agenda del día (cambio en la 001)

En el histórico del día, una cita con `cancelada_por_paciente = 1` muestra "Cancelada por el paciente" (icono y texto); el resto de las canceladas siguen mostrando "Cancelada". El tramo aparece libre y reservable igual que antes (FR-017, US2-E2).

## Textos nuevos (todos en `textos.js`, español de España)

"Próximas citas", "Historial", "Cancelar cita", "Sí, cancelar la cita", "No, volver", "Ver más citas", "Todavía no tienes citas", "Este enlace no es válido", "Cancelada por el paciente", "Crear enlace", "Renovar enlace", "Con enlace", "Sin enlace", y los avisos y explicaciones citados arriba.
