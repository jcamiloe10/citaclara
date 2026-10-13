# Feature Specification: Portal del paciente

**Feature Branch**: `002-portal-del-paciente`

**Created**: 2026-10-13

**Status**: Implementada (2026-10-13), pendiente de verificación manual de SC-001 y SC-002 · Aprobada (2026-10-13) · Propietario: Camilo (ver `specs/MAPA.md`) · Decisiones de Sara incorporadas

**Input**: User description: "Portal del paciente. Los pacientes de la clínica quieren ver sus citas y cancelarlas sin llamar por teléfono (Sonia, recepción de Eleva, dedica «la mitad de la mañana» a esto). Un paciente accede a una página personal moderna donde ve sus citas futuras y pasadas y puede cancelar una cita futura. Interfaz limpia y responsive, pensada para móvil. Sin cuentas ni contraseñas. Fuera de alcance v1: reservar o mover citas online, pagos."

## Clarifications

### Session 2026-10-13 (decisiones de Sara)

- Q: ¿Cómo accede el paciente, sin cuenta ni contraseña? → A: Enlace personal secreto por paciente (opción A). Recepción se lo entrega una sola vez y sigue valiendo hasta que recepción lo renueve. CitaClara no envía nada. Quien tiene el enlace ve las citas de esa persona, por eso recepción debe poder renovarlo si se pierde o se filtra.
- Q: ¿Hasta cuándo puede cancelar el paciente? → A: Hasta 24 horas antes del inicio de la cita; después debe llamar a la clínica. El plazo solo rige en el portal: recepción conserva su regla de la 001 (cancelar mientras la cita siga reservada, aunque haya empezado). Ejemplo con "ahora" = domingo 4 de octubre de 2026, 10:00: la cita de Claudia Rodríguez Pérez con María del lunes 5 a las 16:30 (a 30 h 30 min) se puede cancelar; la de Lucía del lunes 5 a las 9:00 (a 23 h) no.
- Q: ¿Qué pasa con el hueco liberado? → A: Queda libre al instante y se puede volver a reservar (001, FR-017), y la agenda del día de recepción muestra que la cancelaron el paciente (no recepción), para poder ofrecer el hueco. No se envía ningún aviso por email.

## User Scenarios & Testing *(mandatory)*

Los ejemplos usan los datos de demostración de Clínica Eleva con ancla 2026-09-28 y, salvo que se diga otra cosa, "ahora" = jueves 1 de octubre de 2026, 10:00 (hora de España). Esa semana no tiene citas (001, Assumptions), así que todas las citas reservadas de los ejemplos son futuras.

### User Story 1 - Ver mis citas (Priority: P1)

Un paciente abre su página personal desde el móvil y ve, de un vistazo, sus próximas citas (la más cercana primero) y, aparte, su historial de citas pasadas (la más reciente primero). De cada cita ve día y hora, profesional, servicio y estado.

**Why this priority**: Es el valor mínimo: saber cuándo es mi cita sin llamar. Es independiente de la cancelación y ya descarga a recepción de las llamadas de "¿cuándo tenía cita?".

**Independent Test**: Con los datos de demostración, abrir la página de Claudia Rodríguez Pérez y comprobar que sus citas coinciden exactamente con las conocidas.

**Acceptance Scenarios**:

1. **Given** Claudia Rodríguez Pérez (ficha de Clínica Eleva con 39 citas: 10 reservadas, 24 completadas, 3 canceladas y 2 no asistidas), **When** abre su página, **Then** en "Próximas citas" ve sus 10 reservadas ordenadas por fecha, la primera "lunes 5 de octubre de 2026, 09:00 · Lucía · Consulta de nutrición" y la última "jueves 15 de octubre de 2026, 17:45 · María · Sesión de fisioterapia".
2. **Given** la misma paciente, **When** mira su historial, **Then** ve sus 29 citas pasadas (24 completadas, 3 canceladas, 2 no asistidas), la más reciente primero: "viernes 25 de septiembre de 2026, 09:45 · María · Sesión de fisioterapia · Completada"; entre ellas, "miércoles 23 de septiembre de 2026, 11:00 · Jorge · Sesión de fisioterapia · Cancelada".
3. **Given** Claudia tiene dos citas el jueves 15 de octubre (Jorge a las 17:30 y María a las 17:45), **When** abre su página, **Then** ve ambas, sin que se oculte ni se marque ninguna (la 001 solo prohíbe solapes por profesional).
4. **Given** Claudia Rodríguez Pérez y Claudia Ruiz Romero, dos fichas distintas con el mismo nombre de pila, **When** cada una abre su página, **Then** cada una ve únicamente sus propias citas.
5. **Given** un paciente sin ninguna cita, **When** abre su página, **Then** ve un mensaje claro ("Todavía no tienes citas") y la forma de contactar con la clínica, no una pantalla vacía.
6. **Given** un teléfono móvil de 360 píxeles de ancho, **When** abre su página, **Then** lee y usa todo sin desplazamiento horizontal ni información cortada.

---

### User Story 2 - Cancelar una cita futura (Priority: P2)

El paciente pulsa "Cancelar cita" sobre una cita futura que aún está dentro del plazo (24 h antes del inicio), confirma en un segundo paso explícito y ve la cita como cancelada. El hueco queda libre para la agenda.

**Why this priority**: Es lo que ahorra a Sonia la mitad de la mañana. Depende de poder ver las citas (P1).

**Independent Test**: Con los datos de demostración, cancelar la cita 798 de Claudia (lunes 5 de octubre, 16:30, María) y comprobar que su estado es "cancelada" y que recepción puede reservar ese hueco.

**Acceptance Scenarios**:

1. **Given** Claudia ve "lunes 5 de octubre de 2026, 16:30 · María · Sesión de fisioterapia" y faltan más de 24 h, **When** pulsa "Cancelar cita" y confirma, **Then** la cita pasa a "cancelada", sale de "Próximas citas" y aparece en el historial como cancelada.
2. **Given** la cita anterior ya cancelada, **When** recepción abre la agenda de María del 5 de octubre, **Then** el tramo de 16:30 a 17:15 aparece libre y recepción puede reservarlo (Cero Solapes, 001 RN1).
3. **Given** el paciente pulsa "Cancelar cita", **When** aparece la confirmación y la descarta, **Then** la cita sigue reservada sin cambios.
4. **Given** "ahora" = domingo 4 de octubre de 2026, 10:00 y la cita de Lucía del lunes 5 a las 9:00 (a 23 h), **When** el paciente mira esa cita, **Then** no se ofrece "Cancelar cita" y se le explica con claridad que, a menos de 24 horas, debe llamar a la clínica, con el teléfono de la clínica a la vista.
5. **Given** una cita ya completada, cancelada o no asistida, **When** el paciente mira su historial, **Then** no se ofrece ninguna acción sobre ella.
6. **Given** el paciente cancela una cita, **When** recepción la había marcado ya como cancelada un instante antes (o el paciente pulsa dos veces), **Then** solo se aplica un cambio y el paciente ve el estado real de la cita con un mensaje comprensible, sin error técnico.
7. **Given** la cita que el paciente tiene abierta en el móvil fue cancelada por recepción mientras tanto, **When** pulsa "Cancelar cita", **Then** se le informa de que la cita ya estaba cancelada y se le muestra su lista actualizada.
8. **Given** el paciente cancela una cita, **When** ve el resultado, **Then** ve un mensaje de confirmación con el día y la hora cancelados, y que para otra cita debe contactar con la clínica.

---

### User Story 3 - Entrar sin cuenta ni contraseña (Priority: P1)

El paciente llega a su página personal sin registrarse y sin recordar ninguna contraseña, mediante un enlace personal secreto. Nadie puede ver las citas de otra persona.

**Why this priority**: Sin acceso no hay portal, y un acceso débil expone datos de salud. Se comparte la prioridad máxima con P1 porque ambas son imprescindibles para un primer uso real.

**Independent Test**: Con la semilla, comprobar que el acceso válido de Claudia muestra sus citas, que un acceso inventado o caducado no muestra nada, y que ningún acceso de una paciente deja ver los datos de otra.

**Acceptance Scenarios**:

1. **Given** el enlace personal válido de Claudia Rodríguez Pérez, **When** lo abre en el móvil, **Then** ve su página sin teclear nada.
2. **Given** un enlace inventado, manipulado o renovado por recepción (el antiguo), **When** se abre, **Then** se muestra el mensaje "Este enlace no es válido. Llama a la clínica y te daremos uno nuevo", sin revelar ningún dato ni si la persona existe.
3. **Given** el enlace de Claudia, **When** se altera un solo carácter, **Then** no se muestran datos de ninguna otra paciente.
4. **Given** recepción, **When** renueva el enlace de un paciente, **Then** el anterior deja de funcionar al instante y el nuevo funciona; recepción ve en la pantalla de pacientes si cada paciente tiene ya enlace.
5. **Given** que la página del paciente está abierta, **When** la abre un buscador u otra persona sin el enlace, **Then** nada de su contenido es accesible ni indexable.

---

### Edge Cases

- Cita futura reservada cuyo inicio ya pasó pero recepción no la ha cerrado: se muestra en el historial con su estado actual y sin acción de cancelar (la cancelación del paciente solo aplica a citas que aún no han empezado y dentro del plazo).
- Cita que empieza exactamente en el límite del plazo (exactamente 24 h antes): se puede cancelar; un minuto después, no (el plazo es inclusivo en su límite).
- Cambio de hora de verano a invierno (domingo 25 de octubre de 2026): el plazo se mide en tiempo real transcurrido y las horas se muestran siempre en hora de España, sin ambigüedad.
- Dos cancelaciones simultáneas de la misma cita (doble toque, dos dispositivos): solo una se aplica; la otra recibe un mensaje claro.
- Cancelación del paciente a la vez que recepción reserva ese mismo hueco justo al liberarse: nunca queda un solape (Constitución III).
- Pérdida de conexión durante la cancelación: el paciente nunca ve "cancelada" si no lo está; al reabrir ve el estado real.
- Paciente con muchas citas pasadas (Claudia, 29): el historial se lee cómodamente en el móvil sin cargar una pantalla interminable (ver FR-007).

## Requirements *(mandatory)*

### Functional Requirements

**Acceso**

- **FR-001**: El sistema MUST dar a cada paciente una página personal a la que se accede sin crear cuenta ni contraseña, mediante un enlace personal secreto (ver Clarifications).
- **FR-002**: El sistema MUST mostrar a cada paciente únicamente las citas de su propia ficha; ningún acceso válido, inválido o manipulado puede mostrar datos de otro paciente ni de otra clínica.
- **FR-003**: Un acceso inválido, caducado o renovado MUST mostrar un mensaje claro en español sin revelar datos ni si el paciente existe.
- **FR-004**: Recepción MUST poder crear el enlace personal de un paciente y renovarlo (invalidando el anterior al instante) desde una pantalla de pacientes de la interfaz de recepción. El enlace completo se muestra a recepción en el momento de crearlo o renovarlo, para que lo copie y se lo entregue al paciente; después no vuelve a mostrarse (si se pierde, se renueva).
- **FR-005**: La página personal MUST NOT ser indexable ni compartir contenido de citas con terceros más allá del propio paciente.

**Ver citas**

- **FR-006**: La página MUST mostrar dos bloques separados: "Próximas citas" (reservadas cuyo inicio es posterior a ahora, la más cercana primero) e "Historial" (el resto, la más reciente primero).
- **FR-007**: Cada cita MUST mostrar día y hora (sin ambigüedad y en hora de España), profesional, servicio y estado (reservada, completada, cancelada, no asistida), distinguibles sin depender solo del color. El historial MUST poder recorrerse completo, pero sin mostrar de golpe más de 10 citas (con una acción clara para ver más).
- **FR-008**: Una cita cancelada, completada o no asistida MUST aparecer en el historial aunque su fecha sea futura (p. ej. cancelada hoy).
- **FR-009**: La página MUST mostrar de forma permanente el nombre de la clínica y, si la clínica tiene teléfono registrado, su teléfono, para los casos que el portal no cubre. Si la clínica no tiene teléfono, la explicación se limita a "Llama a la clínica" con su nombre.
- **FR-010**: Un paciente sin citas MUST ver un mensaje claro en lugar de una pantalla vacía.

**Cancelar**

- **FR-011**: El sistema MUST ofrecer "Cancelar cita" únicamente sobre citas reservadas que aún no han empezado y están dentro del plazo definido en Clarifications (24 horas antes del inicio); en las demás MUST explicar por qué no y qué hacer.
- **FR-012**: La cancelación MUST requerir una confirmación explícita en un segundo paso y MUST indicar al paciente qué cita cancela (día, hora, profesional, servicio).
- **FR-013**: Al cancelar, la cita MUST pasar a "cancelada" mediante la misma transición reservada → cancelada de la 001 (FR-012); el portal MUST NOT permitir ningún otro cambio de estado ni editar, mover o reservar citas.
- **FR-014**: Una cita cancelada MUST liberar su hueco al instante para recepción (001, FR-017) y MUST NOT poder crear un solape en ninguna circunstancia (001, FR-019).
- **FR-015**: Si dos cancelaciones (o una cancelación y un cambio de recepción) coinciden sobre la misma cita, el sistema MUST aplicar solo una y MUST informar a la otra parte del estado real con un mensaje comprensible.
- **FR-016**: El sistema MUST mostrar al paciente el resultado real de su acción (cancelada o no) y MUST NOT mostrar un éxito que no se haya producido.
- **FR-017**: La agenda del día de recepción MUST distinguir las citas canceladas por el paciente de las canceladas por recepción, sin añadir ningún paso a recepción.

**Interfaz**

- **FR-018**: Todo texto visible MUST estar en español de España, sin jerga técnica, con fechas y horas sin ambigüedad (p. ej. "lunes 5 de octubre de 2026, 09:00") y en hora de España (Constitución II y VIII).
- **FR-019**: La interfaz MUST ser limpia, moderna y plenamente utilizable en un móvil desde 360 píxeles de ancho sin desplazamiento horizontal, con contraste y tamaños de toque accesibles, y igualmente cómoda en un ordenador (Constitución VII).
- **FR-020**: Los datos de demostración MUST permitir probar el portal sin cambios en su contenido: los recuentos de citas por paciente y estado citados en esta spec deben salir de la semilla (Constitución V).

### Key Entities

- **Paciente**: ficha existente (001). El portal le da una página personal; no se crea ninguna cuenta ni credencial de usuario.
- **Acceso del paciente**: lo que permite abrir la página personal de un paciente concreto (un enlace personal secreto). Pertenece a un solo paciente, puede renovarse y, al renovarse, el anterior deja de valer.
- **Cita**: existente (001). El portal solo lee citas y solo aplica la transición reservada → cancelada.
- **Origen de la cancelación**: dato nuevo que distingue "cancelada por el paciente" de "cancelada por recepción".

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un paciente sin ayuda ni manual encuentra y cancela una cita futura en menos de 1 minuto desde que abre su página, en un móvil.
- **SC-002**: Un paciente identifica cuál es su próxima cita (día, hora y profesional) en menos de 10 segundos desde que abre la página.
- **SC-003**: Tras 8 semanas con el portal en producción, al menos el 70 % de las cancelaciones de la clínica se hacen desde el portal y no por teléfono. *(Objetivo propuesto; Sara puede ajustarlo.)*
- **SC-004**: Recepción dedica al menos un 50 % menos de tiempo a atender llamadas de consulta y cancelación de citas que antes del portal, medido por Sonia sobre la misma semana tipo. *(Objetivo propuesto; línea de base: "la mitad de la mañana".)*
- **SC-005**: En todas las pruebas, incluidas 20 o más cancelaciones simultáneas de la misma cita y cancelaciones simultáneas con altas de recepción sobre el hueco liberado, la cita queda cancelada exactamente una vez y ninguna agenda contiene solapes (0 solapes).
- **SC-006**: En ninguna prueba de acceso (enlace inventado, manipulado, renovado o de otra paciente) se muestra un solo dato de un paciente que no sea el dueño del acceso: 0 fugas.
- **SC-007**: La página completa (ver y cancelar) se usa en un móvil de 360 píxeles de ancho sin desplazamiento horizontal.
- **SC-008**: Todo texto, fecha y hora visibles están en español de España; ninguna hora es ambigua ni aparece fuera de hora de España.
- **SC-009**: Cada requisito y cada escenario de aceptación de esta spec tiene al menos una prueba automática que lo referencia (Constitución VI).

## Assumptions

- **Usuarios**: el paciente de una clínica pequeña (2-5 profesionales), a menudo desde el móvil y sin formación; recepción sigue siendo el único usuario del panel (001).
- **Relación con la 001**: esta spec escribe en la agenda de los profesionales (cancela citas), así que declara su relación con la 001 en `specs/MAPA.md` y en ambas specs. Reutiliza sin cambios las reglas de la 001 (transición reservada → cancelada, hueco liberado, Cero Solapes) y la supera solo en lo que la 001 dejó fuera ("cualquier acceso del paciente"). La 001 está cerrada: sus cambios los aprueba su propietario (Camilo).
- **Sin alta de cuentas**: no hay registro, contraseña ni recuperación de contraseña; el acceso es el enlace personal.
- **Una clínica por acceso**: cada acceso pertenece a una ficha de una única clínica; un mismo ser humano con fichas en dos clínicas tiene un acceso en cada una.
- **Qué muestra la cita**: día y hora, profesional, servicio y estado. No se muestra el precio ni datos de otros pacientes ni la ocupación de las agendas.
- **Teléfono de la clínica**: se necesita para derivar lo que el portal no cubre; hoy la clínica solo tiene nombre y clave (001, FR-004), así que el teléfono de contacto es un dato nuevo de la clínica que el plan deberá incorporar (y la semilla, rellenar de forma determinista).
- **Cancelar es definitivo para el paciente**: el portal no deshace una cancelación; para recuperarla, el paciente llama a la clínica y recepción reserva de nuevo (001).
- **Sin avisos**: el portal no envía recordatorios, confirmaciones ni avisos por email; el enlace lo entrega recepción y el paciente ve la confirmación en pantalla.
- **Hora de España**: todas las horas se interpretan y muestran en hora de España peninsular, con el cambio estacional.
- **Fuera de alcance de la 002 (v1)**: reservar o mover citas online, pagos, editar los datos de la ficha desde el portal, recordatorios y analítica.
- **Gobierno (Constitución, Principio I)**: el propietario de esta spec es Camilo, según `specs/MAPA.md`, y la spec está aprobada desde el 2026-10-13, incluida la convivencia con la 001. Cumplimiento previsto: II (horas sin ambigüedad), III (SC-005, pruebas de cancelación simultánea), IV (alcance mínimo: ver y cancelar), V (FR-020), VI (SC-009), VII y VIII (FR-018/019).
