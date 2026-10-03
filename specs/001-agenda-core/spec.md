# Feature Specification: Núcleo de agenda de CitaClara

**Feature Branch**: `001-agenda-core`

**Created**: 2026-10-02

**Status**: Aprobada (2026-10-02) · Propietario: Camilo (ver `specs/MAPA.md`)

**Input**: User description: "Núcleo de agenda de CitaClara para clínicas pequeñas (2-5 profesionales). La recepción gestiona la agenda; los pacientes solo existen como fichas. Incluye clínica, profesionales, servicios, pacientes y citas; regla de cero solapes (también con reservas simultáneas); no crear citas en el pasado; agenda del día por profesional; alta de cita; marcar completada / cancelada / no asistida; acceso con clave de clínica; datos de demostración deterministas (Clínica Eleva)."

## Clarifications

### Session 2026-10-02

- Q: ¿Qué horario admite reservas? → A: Una única franja para toda la clínica (09:00–20:00, lunes a viernes); se rechaza toda cita que no empiece y termine dentro de ella.
- Q: ¿Desde cuándo se puede marcar una cita como completada o no asistida? → A: Desde su hora de inicio (no antes); no hace falta esperar a su hora de fin.
- Q: ¿Cómo se registra un paciente nuevo? → A: Desde el formulario de alta de cita se puede crear la ficha (nombre, teléfono, email); no se editan ni se borran fichas en la 001.
- Q: ¿Cuánto dura el acceso tras introducir la clave? → A: Una jornada de trabajo: la clave se vuelve a pedir tras 12 horas o al cerrar sesión con un botón visible.

### Session 2026-10-02 (revisión tras el análisis)

- Q: ¿Cómo se identifica la clínica al entrar con la clave? → A: La clave identifica la clínica: el acceso solo pide la clave, y la clave debe ser única entre clínicas.
- Q: ¿Con qué granularidad se elige la hora de inicio de una cita? → A: Saltos de 15 minutos (09:00, 09:15, 09:30…); al pulsar un hueco libre se precarga su inicio.
- Q: ¿Qué ocurre con la semana en curso en los datos de demostración? → A: Queda sin citas: la historia son las 8 semanas anteriores y las reservas son las 2 semanas siguientes a la actual.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Reservar una cita sin solapes (Priority: P1)

La persona de recepción da de alta una cita eligiendo profesional, servicio, paciente y hora de inicio. El sistema calcula la hora de fin a partir de la duración del servicio y registra la cita como "reservada". Si el hueco choca con otra cita reservada o completada del mismo profesional, o está en el pasado, el sistema rechaza el alta con un mensaje claro y no registra nada.

**Why this priority**: Es la promesa mínima del producto (Constitución, Principio III). Sin una reserva fiable no hay agenda.

**Independent Test**: Con los datos de demostración, dar de alta una cita en un hueco libre (queda registrada con su hora de fin correcta) e intentar después otra que solape (se rechaza). Se puede probar sin ninguna otra pantalla.

**Acceptance Scenarios**:

1. **Given** María tiene el hueco de las 10:00 a las 10:45 libre, **When** recepción reserva una "sesión de fisioterapia" (45 min) a las 10:00, **Then** la cita queda en estado "reservada" con fin a las 10:45.
2. **Given** María tiene una cita reservada de 10:00 a 10:45, **When** recepción intenta reservar otra cita de María a las 10:30, **Then** el alta se rechaza indicando que el hueco está ocupado y la agenda no cambia.
3. **Given** María tiene una cita completada de 10:00 a 10:45, **When** recepción intenta reservar a las 10:15, **Then** el alta se rechaza.
4. **Given** María tiene una cita de 10:00 a 10:45, **When** recepción reserva otra a las 10:45 (justo al terminar la anterior), **Then** el alta se acepta, porque no hay solape.
5. **Given** María tiene una cita cancelada o no asistida de 10:00 a 10:45, **When** recepción reserva en ese mismo hueco, **Then** el alta se acepta.
6. **Given** el instante actual es posterior a las 09:00 de hoy, **When** recepción intenta reservar una cita que empieza a las 09:00 de hoy, **Then** el alta se rechaza indicando que no se pueden crear citas en el pasado.
7. **Given** un mismo hueco libre de Jorge, **When** dos altas para ese hueco (o huecos que se solapan entre sí) llegan a la vez, **Then** solo una queda registrada y la otra recibe el mensaje de hueco ocupado.
8. **Given** la franja de la clínica de 09:00 a 20:00 de lunes a viernes, **When** recepción intenta reservar una cita que empieza antes de las 09:00, que termina después de las 20:00 (p. ej. primera visita de fisioterapia de 60 min a las 19:30) o que cae en sábado o domingo, **Then** el alta se rechaza indicando que está fuera del horario de la clínica.
9. **Given** una cita que termina exactamente a las 20:00, **When** recepción la reserva, **Then** el alta se acepta.
10. **Given** una persona que llama por primera vez y no tiene ficha, **When** recepción introduce su nombre, teléfono y email en el alta de cita y reserva un hueco libre, **Then** se crea su ficha y la cita queda reservada a su nombre.
11. **Given** el alta con un paciente nuevo cuyo hueco está ocupado, **When** el alta se rechaza, **Then** la ficha del paciente sí queda creada y, al elegir otro hueco, recepción la encuentra sin volver a escribirla.
12. **Given** María y Jorge, **When** recepción reserva a la misma hora una cita para cada uno, **Then** ambas se aceptan: el solape se evalúa por profesional.
13. **Given** una hora de inicio que no es múltiplo de 15 minutos (p. ej. 10:07), **When** recepción intenta reservar, **Then** el alta se rechaza indicando que la cita debe empezar en punto, y cuarto, y media o menos cuarto; y con 10:15 se acepta.

---

### User Story 2 - Ver la agenda del día por profesional (Priority: P2)

Recepción abre la clínica con su clave, elige un día y ve, para cada profesional, una vista clara del día con los tramos ocupados (con paciente, servicio, horario y estado de la cita) y los huecos libres. Puede moverse entre días.

**Why this priority**: Sin esta vista recepción no puede decidir dónde encajar una cita ni saber qué ocurre en el día; es la pantalla de uso diario.

**Independent Test**: Con los datos de demostración, entrar con la clave de la clínica, abrir un día con actividad y comprobar que las citas y los huecos libres coinciden con los datos conocidos de cada profesional.

**Acceptance Scenarios**:

1. **Given** una persona sin la clave de la clínica, **When** intenta abrir la agenda, **Then** se le pide la clave y no ve ningún dato.
2. **Given** una clave incorrecta, **When** la introduce, **Then** se le deniega el acceso con un mensaje claro.
3. **Given** la clave correcta de Clínica Eleva, **When** abre la agenda de un día, **Then** ve a María, Jorge y Lucía, cada uno con sus citas del día ordenadas por hora y sus huecos libres.
4. **Given** una cita cancelada o no asistida, **When** se muestra la agenda, **Then** el tramo aparece como libre para reservar, y la cita sigue visible como histórico con su estado diferenciado.
5. **Given** recepción con sesión iniciada, **When** pasan más de 12 horas o pulsa "Cerrar sesión", **Then** la siguiente acción vuelve a pedir la clave y no muestra datos.
6. **Given** un día sin citas para un profesional, **When** se muestra la agenda, **Then** todo su horario aparece libre.
7. **Given** un teléfono móvil, **When** recepción abre la agenda, **Then** puede leerla y usarla sin desplazamiento horizontal de la página ni perder información.
8. **Given** dos clínicas con claves distintas, **When** recepción de cada una entra con su clave, **Then** solo ve los datos de su clínica; y crear una clínica con una clave ya usada por otra se rechaza.

---

### User Story 3 - Cerrar el ciclo de una cita (Priority: P3)

Recepción marca una cita reservada como completada, cancelada o no asistida desde la agenda del día. Una vez cerrada, la cita no vuelve a cambiar de estado.

**Why this priority**: Mantiene la agenda veraz y libera huecos; depende de que ya existan citas (P1) y de poder verlas (P2).

**Independent Test**: Con una cita reservada de los datos de demostración, aplicar cada una de las tres acciones sobre citas distintas y comprobar el estado resultante y el efecto sobre los huecos.

**Acceptance Scenarios**:

1. **Given** una cita reservada que ya ha empezado, **When** recepción la marca como completada, **Then** pasa a "completada" y sigue ocupando su hueco.
2. **Given** una cita reservada (futura o en curso), **When** recepción la cancela, **Then** pasa a "cancelada" y su hueco queda libre.
3. **Given** una cita reservada cuya hora de inicio ya ha pasado y a la que el paciente no se presentó, **When** recepción la marca como no asistida, **Then** pasa a "no asistida" y su hueco queda libre.
4. **Given** una cita reservada que aún no ha empezado, **When** recepción intenta marcarla como no asistida o completada, **Then** la acción no está disponible o se rechaza con un mensaje claro.
5. **Given** una cita ya completada, cancelada o no asistida, **When** recepción intenta cambiar su estado, **Then** se rechaza: solo las citas reservadas admiten cambios.

---

### User Story 4 - Explorar con datos de demostración (Priority: P3)

Cualquier persona que ponga en marcha el producto puede cargar los datos de Clínica Eleva y obtener siempre exactamente la misma historia, para demostraciones, pruebas y para citar cifras en otras specs.

**Why this priority**: Permite demostrar y verificar todo lo anterior (Constitución, Principio V), pero no aporta valor operativo a una clínica real.

**Independent Test**: Cargar los datos dos veces en entornos limpios y comprobar que los recuentos y el contenido de las citas son idénticos.

**Acceptance Scenarios**:

1. **Given** un entorno vacío, **When** se cargan los datos de demostración, **Then** existe la clínica "Clínica Eleva", con María y Jorge (fisioterapia) y Lucía (nutrición), los cuatro servicios indicados y unos 40 pacientes.
2. **Given** los datos cargados, **When** se revisan las 8 semanas anteriores, **Then** aproximadamente el 10 % de las citas de ese periodo son "no asistida" y aproximadamente el 8 % "cancelada"; el resto son "completada".
3. **Given** los datos cargados, **When** se revisan las 2 semanas siguientes, **Then** hay citas "reservada" repartidas entre los tres profesionales, sin ningún solape.
4. **Given** dos cargas independientes, **When** se comparan, **Then** son idénticas (mismas citas, mismos pacientes, mismos estados).
5. **Given** que los datos ya están cargados, **When** se vuelven a cargar, **Then** el resultado final es idéntico al de la primera carga, sin duplicados.

---

### Edge Cases

- Dos altas simultáneas que no coinciden exactamente pero se solapan parcialmente (p. ej. 10:00–10:45 y 10:30–11:00): solo una puede quedar registrada.
- Dos altas simultáneas para profesionales distintos a la misma hora: ambas se aceptan.
- Alta con una hora de inicio que no es múltiplo de 15 minutos (p. ej. 10:07): se rechaza indicando las horas válidas.
- Cita que cruza una hora "redonda" (p. ej. primera visita de 60 min a las 10:30): el fin es 11:30, sin ambigüedad.
- Cita cuyo inicio coincide exactamente con el instante actual: se considera pasado y se rechaza (la cita debe empezar estrictamente después de ahora).
- Cambio de hora de verano/invierno en España: las horas mostradas y la duración de las citas siguen siendo coherentes.
- Alta con algún dato obligatorio vacío (profesional, servicio, paciente o inicio): se rechaza indicando qué falta.
- Cancelar una cita que ya empezó pero sigue reservada: se permite (ver supuestos).
- Dos pacientes con el mismo nombre: se distinguen por teléfono y email en los selectores.
- Intento repetido de marcar la misma cita (doble clic o dos recepciones a la vez): solo el primer cambio se aplica; el segundo se rechaza por no estar ya reservada.

## Requirements *(mandatory)*

### Functional Requirements

**Acceso**

- **FR-001**: El sistema MUST pedir la clave de la clínica antes de mostrar cualquier dato de agenda o permitir cualquier acción.
- **FR-002**: El sistema MUST denegar el acceso con un mensaje claro cuando la clave sea incorrecta, sin revelar datos de la clínica.
- **FR-002b**: Tras introducir la clave correcta, el acceso MUST mantenerse 12 horas sin volver a pedirla; pasado ese tiempo, o al pulsar el botón visible "Cerrar sesión", el sistema MUST pedir la clave de nuevo y no mostrar datos hasta entonces.
- **FR-003**: Cada clínica MUST tener su propia clave de panel, **única entre todas las clínicas**; la clave identifica a la clínica, de modo que el acceso solo pide la clave y da acceso únicamente a los datos de su clínica. El sistema MUST rechazar crear una clínica con una clave que ya use otra.

**Datos maestros**

- **FR-004**: El sistema MUST mantener los datos de la clínica: nombre y clave de panel.
- **FR-005**: El sistema MUST mantener los profesionales de una clínica, con nombre y especialidad.
- **FR-006**: El sistema MUST mantener los servicios de una clínica, con nombre, duración en minutos (entera y mayor que cero) y precio en euros (importe exacto en céntimos, no negativo).
- **FR-007**: El sistema MUST mantener los pacientes de una clínica como fichas, con nombre, teléfono y email.
- **FR-008**: El alta, modificación o baja de profesionales y servicios por la interfaz queda fuera de la 001; en esta versión esos datos proceden de la carga de datos de demostración. De los pacientes, la 001 solo permite crear fichas nuevas (FR-008b); no se editan ni se borran. (Ver Assumptions.)
- **FR-008b**: Desde el formulario de alta de cita, recepción MUST poder crear la ficha de un paciente nuevo indicando nombre, teléfono y email, y reservar la cita con él en el mismo paso. El nombre es obligatorio, y el teléfono y el email deben tener un formato válido. Si la cita se rechaza (solape, pasado o fuera de horario), la ficha del paciente nuevo MUST conservarse y quedar disponible para volver a intentarlo, sin crear duplicados.

**Citas**

- **FR-009**: Una cita MUST asociar exactamente un profesional, un servicio y un paciente de la misma clínica, con una hora de inicio y una hora de fin.
- **FR-010**: El sistema MUST calcular la hora de fin como hora de inicio más la duración en minutos del servicio elegido; recepción no la introduce a mano.
- **FR-011**: Toda cita MUST tener uno de estos estados: reservada, completada, cancelada, no asistida. Toda cita nueva nace "reservada".
- **FR-012**: Los únicos cambios de estado permitidos son reservada → completada, reservada → cancelada y reservada → no asistida. Completada, cancelada y no asistida son estados finales.
- **FR-013**: "No asistida" MUST aplicarse exclusivamente a una cita que seguía reservada y cuyo paciente no se presentó; el sistema MUST rechazar marcar como no asistida una cita que no esté reservada o que aún no haya empezado.
- **FR-014**: El sistema MUST rechazar marcar como completada una cita que aún no ha empezado.
- **FR-015**: Los precios mostrados MUST ser exactos al céntimo y con formato de euros de España (p. ej. "40,00 €").

**Reglas de negocio**

- **RN1 / FR-016**: El sistema MUST rechazar la creación de una cita cuyo intervalo se solape con el de otra cita **reservada o completada** del **mismo profesional**. Dos intervalos que solo se tocan en un extremo (el fin de uno es el inicio del otro) no se solapan.
- **FR-017**: Las citas canceladas y no asistidas MUST NOT bloquear huecos: el mismo tramo puede reservarse de nuevo.
- **FR-018**: Si varias altas para el mismo profesional con intervalos solapados llegan simultáneamente, el sistema MUST registrar como máximo una y rechazar las demás con el mismo mensaje de hueco ocupado; en ningún caso puede quedar un solape.
- **FR-019**: Un cambio de estado MUST NOT poder crear un solape (las únicas transiciones posibles solo liberan huecos o mantienen la ocupación).
- **RN2 / FR-020**: El sistema MUST rechazar la creación de citas cuyo inicio no sea posterior al instante actual.
- **RN3 / FR-020b**: El sistema MUST rechazar la creación de citas que no empiecen y terminen dentro del horario de la clínica: de lunes a viernes, de 09:00 a 20:00 (hora de España). Una cita que termina exactamente a las 20:00 es válida. No hay horarios por profesional, festivos ni vacaciones en la 001.
- **RN4 / FR-020c**: La hora de inicio de una cita MUST ser múltiplo de 15 minutos (09:00, 09:15, 09:30…). El sistema MUST rechazar cualquier otro inicio. Como todos los servicios duran múltiplos de 15 minutos, los huecos libres de la agenda también empiezan en múltiplos de 15.
- **FR-021**: Un alta rechazada MUST NOT dejar ningún rastro en la agenda (ni cita parcial ni estado intermedio) y MUST explicar el motivo en lenguaje llano.

**Interfaz de recepción**

- **FR-022**: La interfaz MUST ofrecer una "agenda del día" que muestre, para un día elegido, una columna o sección por profesional con sus tramos ocupados y sus huecos libres, claramente distinguibles entre sí.
- **FR-023**: Cada tramo ocupado MUST mostrar, como mínimo, horario, paciente, servicio y estado de la cita; los estados MUST distinguirse sin depender solo del color.
- **FR-024**: La interfaz MUST permitir navegar al día anterior, al siguiente y volver a hoy; el día inicial es hoy.
- **FR-025**: La interfaz MUST permitir dar de alta una cita eligiendo profesional, servicio, paciente (existente o nuevo, según FR-008b) y hora de inicio, y mostrar el resultado (cita registrada o motivo del rechazo). La hora de inicio se elige en saltos de 15 minutos (RN4). Al elegir un hueco libre de la agenda, el alta MUST partir con profesional, día y la hora de inicio de ese hueco ya rellenados.
- **FR-026**: La interfaz MUST ofrecer, sobre cada cita reservada, las acciones "Completada", "Cancelada" y "No asistida"; las acciones no permitidas por FR-012/013/014 no se ofrecen o se explican.
- **FR-027**: Tras cada alta o cambio de estado, la agenda MUST reflejar el resultado de inmediato.
- **FR-028**: Todo texto visible MUST estar en español de España, sin jerga técnica; fechas y horas MUST mostrarse sin ambigüedad (p. ej. "viernes 2 de octubre de 2026, 10:00") y ligadas a la hora de España.
- **FR-029**: La interfaz MUST ser plenamente utilizable tanto en pantalla de ordenador portátil como en teléfono móvil, con contraste y tamaños accesibles.

**Datos de demostración**

- **FR-030**: El sistema MUST poder cargar un conjunto de datos de demostración determinista: la clínica "Clínica Eleva"; los profesionales María y Jorge (fisioterapia) y Lucía (nutrición); y los servicios sesión de fisioterapia (45 min, 40,00 €), primera visita de fisioterapia (60 min, 50,00 €), consulta de nutrición (30 min, 35,00 €) y primera consulta de nutrición (45 min, 45,00 €).
- **FR-031**: Los datos de demostración MUST incluir unos 40 pacientes con nombre, teléfono y email.
- **FR-032**: Los datos de demostración MUST incluir 8 semanas de historia con aproximadamente un 10 % de citas "no asistida" y un 8 % de "cancelada" (el resto "completada"), y 2 semanas futuras con citas "reservada".
- **FR-033**: Los datos de demostración MUST cumplir RN1, RN2 y RN3 en su conjunto (ningún solape en la agenda de ningún profesional; las citas de la parte futura empiezan después del momento de la carga; todas las citas caen dentro del horario de la clínica) y respetar la coherencia de estados (FR-012/013).
- **FR-034**: Cargar los datos de demostración dos veces MUST producir exactamente el mismo contenido, sin duplicados.

### Key Entities

- **Clínica**: centro que usa CitaClara. Tiene nombre y clave de panel. Agrupa a todos los demás datos; una clínica no ve los datos de otra.
- **Profesional**: persona que atiende citas. Nombre y especialidad. Tiene su propia agenda: las reglas de solape se evalúan por profesional.
- **Servicio**: prestación que ofrece la clínica. Nombre, duración en minutos y precio en euros.
- **Paciente**: ficha de una persona atendida. Nombre, teléfono y email. En esta versión no accede al sistema.
- **Cita**: une un profesional, un servicio y un paciente con hora de inicio y fin (inicio + duración del servicio) y un estado (reservada, completada, cancelada, no asistida).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: En cualquier prueba, incluidas las que lanzan reservas simultáneas, ninguna agenda de ningún profesional contiene dos citas reservadas o completadas solapadas (0 solapes). En una prueba con al menos 20 altas simultáneas sobre el mismo hueco, exactamente 1 queda registrada.
- **SC-002**: Una persona de recepción sin formación ni manual da de alta una cita en menos de 1 minuto desde que abre la agenda del día.
- **SC-003**: Recepción localiza si un profesional tiene un hueco libre a una hora concreta del día en menos de 10 segundos, mirando solo la agenda del día.
- **SC-004**: El 100 % de las altas rechazadas (solape, pasado, datos incompletos) muestra un motivo comprensible y deja la agenda exactamente como estaba.
- **SC-005**: Con los datos de demostración, dos cargas independientes producen los mismos recuentos de pacientes y citas por estado, y las proporciones de no asistida y cancelada del histórico quedan dentro de ±2 puntos porcentuales de 10 % y 8 %.
- **SC-006**: La agenda del día y el alta de cita se pueden usar completas en un teléfono móvil sin desplazamiento horizontal de la página.
- **SC-007**: Todo texto, fecha, hora e importe visibles están en español de España y ningún importe muestra descuadre de céntimos.
- **SC-008**: Cada regla de negocio (RN1, RN2, RN3) y cada escenario de aceptación de esta spec tiene al menos una prueba automática que lo referencia.

## Assumptions

- **Usuarios**: el único usuario es la recepción de una clínica pequeña (2-5 profesionales); no hay roles diferenciados. Quien conoce la clave de la clínica tiene acceso completo.
- **Autenticación simplificada (deuda consciente)**: la v1 usa una única clave de panel por clínica, sin cuentas de usuario, sin recuperación de clave y sin bloqueos por intentos; el acceso dura 12 horas (FR-002b). Se reconoce como deuda técnica y de seguridad a sustituir en una spec propia; es suficiente para demostración y uso piloto.
- **Zona horaria**: todas las horas se interpretan y muestran en hora de España peninsular (con cambio estacional de hora).
- **Horario de la clínica**: una única franja para toda la clínica, de 09:00 a 20:00 de lunes a viernes (RN3). La agenda del día muestra esa franja; en sábado y domingo se muestra sin huecos reservables. La 001 no modela horarios por profesional, festivos ni vacaciones.
- **Una cita, un servicio**: cada cita lleva exactamente un servicio; sin citas recurrentes ni de varios servicios.
- **Modificación de citas**: la 001 no permite editar ni reprogramar una cita. Para cambiarla se cancela y se crea otra.
- **Cancelar una cita que ya empezó**: se permite mientras siga reservada. Marcar completada o no asistida solo es posible desde el instante de inicio de la cita (inclusive), sin esperar a su fin.
- **Datos maestros**: el alta/edición de profesionales y servicios por interfaz no está incluida; en la 001 esos datos proceden de la carga de datos de demostración. Los pacientes se pueden crear desde el alta de cita, pero no editar ni borrar. Una spec posterior gestionará los datos maestros completos. Se mantiene la distinción de clínica en el modelo de datos para no cerrar la puerta a varias clínicas.
- **Pacientes como fichas**: sin acceso propio, sin avisos ni recordatorios, y sin detección de pacientes duplicados (dos fichas con los mismos datos se aceptan; recepción las distingue por teléfono y email).
- **Un paciente puede tener citas solapadas con profesionales distintos**: la regla de cero solapes aplica solo al profesional.
- **Datos de demostración**: las fechas se calculan en relación con el lunes de la semana en curso (la "ancla"): la historia son las 8 semanas laborales completas anteriores a ella y las reservas son las 2 semanas laborales completas siguientes a la semana actual. Por eso la **semana en curso queda sin citas** y "hoy" aparece vacío justo tras la carga (FR-024 sigue abriendo la agenda en hoy). Así los recuentos son idénticos en cualquier día de carga, y el patrón de citas, pacientes y estados es idéntico en cada carga; las pruebas fijan la ancla. La historia no contiene citas "reservada" en el pasado. La clave de demostración de Clínica Eleva se documenta junto a los datos de demostración.
- **Fuera de alcance de la 001** (specs propias): cualquier acceso del paciente, recordatorios, analítica y pagos online.
- **Gobierno (Constitución, Principio I)**: el propietario de esta spec es Camilo, según `specs/MAPA.md`, y la spec está aprobada desde el 2026-10-02. Cumple los Principios II (precisión de importes y horas), III (cero solapes, con pruebas simultáneas en SC-001), IV (alcance acotado), V (datos reproducibles), VI (SC-008), VII y VIII (FR-028/029).
