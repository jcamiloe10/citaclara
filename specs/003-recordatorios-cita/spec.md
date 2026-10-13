# Feature Specification: Recordatorios de cita

**Feature Branch**: `003-citaclara-recordatorios`

**Created**: 2026-10-13

**Status**: Aprobada (2026-10-13) · Propietario: Camilo (ver `specs/MAPA.md`) · Decisiones de Sara incorporadas · Se implementa sobre la 002 (ver Assumptions)

**Input**: User description: "Recordatorios de cita. El dolor número uno del cliente piloto: la no asistencia. Alcance: un proceso diario genera un recordatorio por email para cada cita reservada de las próximas 24-48 horas, sin duplicar envíos; el email incluye los datos de la cita y una forma de que el paciente cancele si no va a ir (mejor un hueco libre que un no-show). Correo en modo simulado sin SMTP configurado: se escriben ficheros .eml en datos/salida-correo/. Preguntas cerradas para Sara: antelación exacta, qué pasa si el paciente cancela desde el email y con cuánta antelación puede, y si el recordatorio se reenvía cuando la cita se mueve. Fuera de alcance v1: SMS y WhatsApp."

## Clarifications

### Session 2026-10-13 (Sara)

- Q: ¿Antelación exacta del recordatorio? → A: 24 h (ventana de 24-48 h, un solo aviso por cita).
- Q: ¿Con cuánta antelación mínima puede cancelar el paciente desde el email? → A: 24 h antes del inicio.
- Q: ¿Qué ve y qué debe hacer si ya no llega a tiempo? → A: Se le indica que llame a la clínica.
- Q: ¿Se reenvía el recordatorio cuando la cita se mueve? → A: Se trata como cualquier otra cita, sin regla especial.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - El paciente recibe un recordatorio de su cita (Priority: P1)

Una vez al día, el sistema revisa la agenda de la clínica y envía un email de recordatorio a cada paciente que tiene una cita **reservada** dentro de la ventana de antelación (entre 24 y 48 horas antes del inicio, de modo que quede al menos 24 h para cancelar, ver FR-002 y FR-012). El email, en español de España, indica clínica, profesional, servicio, y día y hora de la cita sin ambigüedad. Un mismo paciente no recibe dos recordatorios por la misma cita aunque el proceso diario se ejecute varias veces.

**Why this priority**: Es el núcleo del valor: reducir la no asistencia, el dolor número uno del cliente piloto. Con solo esta historia ya se avisa al paciente, aunque todavía no pueda cancelar desde el correo.

**Independent Test**: Con los datos de demostración y un instante de referencia fijado, ejecutar el proceso diario y comprobar que se genera un recordatorio por cada cita reservada dentro de la ventana, ninguno para el resto, y que una segunda ejecución no genera nada nuevo.

**Acceptance Scenarios**:

1. **Given** una cita reservada de un paciente con email dentro de la ventana de recordatorio, **When** se ejecuta el proceso diario, **Then** se genera un recordatorio para ese paciente con los datos de la cita (clínica, profesional, servicio, día y hora en hora de España).
2. **Given** una cita reservada fuera de la ventana (más lejana o ya pasada), **When** se ejecuta el proceso diario, **Then** no se genera recordatorio para ella.
3. **Given** citas completadas, canceladas o no asistidas dentro de la ventana temporal, **When** se ejecuta el proceso diario, **Then** no se genera recordatorio para ellas.
4. **Given** una cita para la que ya se generó recordatorio, **When** el proceso diario se ejecuta de nuevo (el mismo día o tras un reinicio), **Then** no se genera un segundo recordatorio para esa cita.
5. **Given** un paciente con dos citas reservadas en la ventana, **When** se ejecuta el proceso diario, **Then** recibe un recordatorio por cada cita, cada uno con sus datos.
6. **Given** un recordatorio generado, **When** se lee su fecha y hora, **Then** aparece en formato inequívoco ligado a la hora de España (p. ej. "viernes 16 de octubre de 2026, 10:00").

---

### User Story 2 - El paciente cancela desde el email para liberar el hueco (Priority: P2)

El email incluye un enlace personal. Al abrirlo, el paciente ve los datos de su cita y puede confirmar su cancelación sin iniciar sesión ni llamar a la clínica. La cita pasa a "cancelada" y el hueco queda libre para que recepción lo vuelva a reservar. El resultado (cancelada, o motivo por el que no se puede cancelar) se explica en lenguaje llano.

**Why this priority**: Convierte un posible no-show en un hueco libre reutilizable ("mejor un hueco libre que un no-show"). Depende de la historia 1, pero entrega valor propio.

**Independent Test**: Tomar el enlace de un recordatorio generado, abrirlo y confirmar la cancelación; comprobar que la cita queda cancelada, que el hueco admite una nueva reserva y que repetir la operación no cambia nada.

**Acceptance Scenarios**:

1. **Given** un recordatorio con enlace de cancelación y una cita todavía reservada, **When** el paciente abre el enlace y confirma, **Then** la cita pasa a "cancelada", el hueco queda libre y el paciente ve una confirmación clara.
2. **Given** una cita ya cancelada desde el enlace, **When** el paciente vuelve a abrir el mismo enlace, **Then** se le informa de que la cita ya está cancelada y no se produce ningún otro cambio.
3. **Given** una cita que ya no está reservada (completada, no asistida o cancelada por recepción), **When** el paciente abre el enlace, **Then** se le informa de que ya no puede cancelarla y no cambia nada.
4. **Given** un enlace manipulado, inventado o que pertenece a otra cita, **When** alguien lo abre, **Then** no se cancela ninguna cita y no se revela información de ninguna cita ni de ningún paciente.
5. **Given** una cita que empieza en menos de 24 horas, **When** el paciente abre el enlace, **Then** no puede cancelar desde el email: se le explica con claridad que debe llamar a la clínica (con su teléfono de contacto) y la cita no cambia.
6. **Given** una cita que empieza dentro de 24 horas o más, **When** el paciente confirma la cancelación, **Then** se cancela (límite inclusivo: a exactamente 24 h aún puede).
7. **Given** una cita cancelada desde el enlace, **When** recepción abre la agenda del día, **Then** la cita aparece como "cancelada" y el hueco figura como libre, sin intervención manual.
8. **Given** una cancelación desde el enlace y una operación de recepción sobre la misma cita o el mismo hueco llegando a la vez, **When** ambas se procesan, **Then** el resultado es siempre uno de los órdenes posibles y nunca queda un solape en la agenda del profesional.

---

### User Story 3 - Qué hace el sistema cuando la cita cambia (Priority: P3)

Cuando una cita cambia de hora o de profesional, el paciente no debe quedarse con un recordatorio obsoleto ni recibir información contradictoria. Regla acordada con Sara: una cita movida se trata como cualquier otra cita (ver FR-018).

**Why this priority**: Evita avisos erróneos, pero es un caso menos frecuente que los dos anteriores y su regla ya está acordada con Sara.

**Independent Test**: Cancelar una cita con recordatorio ya generado y reservar otra para el mismo paciente en otro hueco; comprobar que el enlace del recordatorio antiguo ya no cancela la cita nueva y que la cita nueva se trata según la regla acordada.

**Acceptance Scenarios**:

1. **Given** una cita con recordatorio ya generado que recepción cancela y sustituye por otra cita del mismo paciente (en la 001 no se reprograma: se cancela y se crea otra), **When** se ejecuta el proceso diario, **Then** la cita nueva se trata como una cita más (recibe su propio recordatorio si cae en la ventana) y el enlace del recordatorio antiguo informa de que esa cita ya no está reservada.
2. **Given** una cita que se mueve a otra hora (cancelada y creada de nuevo; o reprogramada si una spec futura lo permite), **When** se ejecuta el proceso diario, **Then** la cita en su nueva hora recibe su recordatorio como cualquier otra cita si cae en la ventana, y el enlace del recordatorio anterior no cancela la cita nueva.

---

### Edge Cases

- **Paciente sin email válido**: no se envía nada y el hecho queda registrado como "no recordada: sin email" para que recepción pueda llamar. No bloquea al resto de pacientes.
- **Cita reservada tras el último proceso diario** y que ya cae dentro de la ventana (p. ej. una reserva para mañana hecha esta tarde): se recoge en la siguiente ejecución mientras siga dentro de la ventana; nunca recibe dos recordatorios.
- **Proceso diario que no se ejecuta un día** (parada, caída): la siguiente ejecución recupera las citas de la ventana que no tengan recordatorio, sin duplicar los ya generados.
- **Fallo al escribir un recordatorio** (disco lleno, carpeta no accesible): el fallo se registra y no se marca la cita como recordada, de modo que la siguiente ejecución lo reintente; un fallo no impide procesar el resto de citas.
- **Cita en el cambio de hora** (último domingo de marzo/octubre): la ventana y la hora mostrada al paciente se calculan en hora de España y no se desplazan una hora.
- **Cita reservada para dentro de menos de 24 horas** en el momento del alta: se trata en la siguiente ejecución si está dentro de la ventana; la regla exacta depende de la antelación acordada (FR-002).
- **Dos pacientes con el mismo email** (p. ej. familia): cada cita recibe su propio recordatorio y su propio enlace, que solo cancela esa cita.
- **El paciente abre el enlace después de la hora de la cita**: no se cancela; se explica que la cita ya ha pasado.
- **Datos personales en el enlace o en el nombre de los ficheros**: el enlace no contiene datos de salud ni personales legibles.

## Requirements *(mandatory)*

### Functional Requirements

#### Generación de recordatorios

- **FR-001**: El sistema MUST disponer de un proceso diario que, para cada clínica, genera un recordatorio por email por cada cita **reservada** que cumpla la ventana de FR-002 y cuyo paciente tenga un email válido.
- **FR-002**: La ventana de recordatorio MUST cubrir las citas cuyo inicio cae entre 24 y 48 horas desde el instante de la ejecución. Acordado con Sara: antelación de 24 h. Como la cancelación exige 24 h de margen (FR-012), el aviso sale siempre con la cita a 24 h o más; cada cita se avisa una sola vez dentro de la ventana.
- **FR-003**: El sistema MUST NOT generar recordatorio para citas que no estén en estado "reservada" (completada, cancelada, no asistida) ni para citas fuera de la ventana.
- **FR-004**: El sistema MUST recordar qué citas ya tienen recordatorio generado y MUST NOT generar un segundo recordatorio para la misma cita aunque el proceso se ejecute varias veces, se reinicie o se ejecute de forma concurrente.
- **FR-005**: Si la generación del recordatorio de una cita falla, el sistema MUST registrar el fallo, MUST NOT dar la cita por recordada y MUST reintentarla en la siguiente ejecución, sin que ese fallo impida procesar el resto de citas.
- **FR-006**: Si el paciente de una cita no tiene un email válido, el sistema MUST NOT enviar nada y MUST dejar constancia visible para recepción de que esa cita no pudo recordarse por falta de email.

#### Contenido del email

- **FR-007**: El email MUST estar escrito en español de España e incluir: nombre de la clínica, nombre del paciente, profesional, servicio, y día y hora de la cita en formato inequívoco ligado a la hora de España (Constitución, Principios II y VIII).
- **FR-008**: El email MUST incluir un enlace personal para cancelar la cita y una indicación clara de que cancelar libera el hueco para otra persona, sin jerga técnica (Principio VII).
- **FR-009**: El email MUST indicar cómo contactar con la clínica para cambiar la cita, en lugar de ofrecer reprogramar desde el enlace (la 001 no permite reprogramar).

#### Cancelación desde el email

- **FR-010**: El enlace de cancelación MUST identificar una única cita, no ser deducible ni modificable por un tercero para llegar a otra cita, y MUST NOT requerir iniciar sesión (el paciente no tiene acceso propio, ver Assumptions). Abrir el enlace MUST NOT cancelar por sí solo: la cancelación requiere una confirmación explícita del paciente.
- **FR-011**: Al confirmar, el sistema MUST cambiar la cita de "reservada" a "cancelada" (transición ya permitida por la 001, FR-012) y dejar el hueco libre. Una cita que no esté "reservada" MUST NOT cambiar de estado por este medio y se informa al paciente del motivo.
- **FR-012**: El paciente MUST poder cancelar desde el enlace solo si la cita empieza dentro de 24 horas o más (inclusive) desde el momento de confirmar (acordado con Sara). Si falta menos, el sistema MUST NOT cancelar y MUST explicar que debe llamar a la clínica, mostrando su teléfono de contacto.
- **FR-013**: Repetir la apertura o la confirmación del mismo enlace MUST ser inocuo: el resultado es siempre "la cita está cancelada" o "no se puede cancelar", sin efectos adicionales.
- **FR-014**: La cancelación desde el enlace MUST NOT poder crear nunca un solape (Principio III): solo libera ocupación, y si coincide con otra operación sobre la misma cita o el mismo hueco, el resultado es consistente.
- **FR-015**: Un enlace inválido, caducado o de una cita inexistente MUST mostrar un mensaje genérico que no revele si la cita existe ni datos de ningún paciente.
- **FR-016**: Recepción MUST ver en la agenda del día que una cita fue cancelada por el paciente (no por recepción), con la misma etiqueta "Cancelada por el paciente" que usa la 002 (su FR-017); la cancelación hecha desde el enlace del recordatorio MUST registrarse con ese mismo origen.

#### Cambios de cita

- **FR-017**: Cuando una cita deja de estar reservada, el enlace de su recordatorio MUST dejar de poder cancelar nada más, y un recordatorio ya generado MUST NOT afectar nunca a otra cita distinta.
- **FR-018**: Acordado con Sara: una cita movida se trata como cualquier otra, sin regla especial de reenvío; el recordatorio es único por cita y hora de inicio, y el enlace de uno anterior MUST NOT cancelar la cita en su nueva hora. Mientras la 001 no permita reprogramar, una cita "movida" es una cita nueva que sigue la regla general (FR-001, FR-004).

#### Correo simulado

- **FR-019**: Mientras no haya un servicio de correo configurado, el sistema MUST funcionar en modo simulado: cada recordatorio se escribe como un fichero de correo (.eml) en la carpeta `datos/salida-correo/`, legible por un cliente de correo y con asunto, destinatario y cuerpo completos.
- **FR-020**: En modo simulado, cada fichero MUST tener un nombre estable y único por cita, de modo que reescribirlo por error no cree duplicados ni mezcle citas distintas.
- **FR-021**: El modo (simulado o real) MUST ser inequívoco para quien opera el sistema: no puede enviarse un email real por equivocación en modo simulado, ni darse por enviado un recordatorio que solo se ha escrito como fichero.

#### Alcance y convivencia

- **FR-022**: Los recordatorios por SMS y por WhatsApp quedan fuera de esta spec (v1); no se construyen ni se anticipan (Principio IV).
- **FR-023**: Esta spec toca la agenda de los profesionales (cancela citas). Su relación con la 001 (estados y cero solapes) y con la 002 (portal del paciente) se declara en `specs/MAPA.md`, y los propietarios acuerdan las reglas de convivencia antes de implementar.

### Key Entities

- **Recordatorio**: aviso a un paciente sobre una cita concreta. Atributos: cita, destinatario, instante de generación, resultado (generado, no recordada por falta de email, fallido) y contenido. Como máximo uno por cita (por hora de inicio de la cita, FR-018).
- **Enlace de cancelación**: acceso personal a una única cita, incluido en el recordatorio. Permite ver sus datos y confirmar su cancelación; no da acceso a ningún otro dato.
- **Cita** (de la 001): sin cambios propios; el origen de la cancelación (paciente o recepción) es el dato que añade la 002 y esta spec reutiliza.
- **Paciente** (de la 001): su email es el destino del recordatorio; sin email válido no hay recordatorio.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con los datos de demostración y un instante de referencia fijado, el proceso diario genera exactamente un recordatorio por cada cita reservada de la ventana con email válido, y cero para el resto; el número esperado puede citarse a partir de los datos de demostración (Principio V).
- **SC-002**: Tras ejecutar el proceso diario 10 veces seguidas (y con ejecuciones simultáneas), el número de recordatorios por cita es 1 en el 100 % de las citas (0 duplicados).
- **SC-003**: Un paciente sin formación abre el recordatorio en un teléfono móvil y cancela su cita en menos de 1 minuto y como máximo 3 pasos desde que abre el enlace, sin crear cuenta ni contraseña.
- **SC-004**: El 100 % de las cancelaciones hechas desde un recordatorio dejan el hueco libre y reservable de inmediato, y en ninguna prueba (incluidas cancelaciones y reservas simultáneas sobre el mismo hueco) queda un solape en la agenda de un profesional.
- **SC-005**: Ningún enlace manipulado, caducado o de otra cita permite cancelar una cita ajena ni revela datos de otro paciente (0 casos en las pruebas de abuso).
- **SC-006**: Recepción identifica en menos de 10 segundos, mirando la agenda del día, qué citas fueron canceladas por el paciente desde el recordatorio y cuáles no pudieron recordarse por falta de email.
- **SC-007**: Todo texto, fecha y hora del recordatorio y de la pantalla de cancelación están en español de España y sin ambigüedad horaria, incluidas las citas próximas al cambio de hora.
- **SC-008**: Cada requisito (FR) y cada escenario de aceptación de esta spec tiene al menos una prueba automática que lo referencia (Principio VI).
- **SC-009**: En modo simulado, cada fichero .eml generado se abre correctamente en un cliente de correo estándar y contiene los datos de FR-007 y el enlace de FR-008.

## Assumptions

- **Usuarios**: el paciente solo interactúa con el email y con la pantalla de cancelación del enlace; recepción sigue siendo la única usuaria con acceso a la agenda (clave de clínica, 001). El paciente no tiene cuenta ni portal propio en esta spec.
- **Datos personales**: el email contiene datos personales (nombre, profesional, servicio) de un entorno sanitario; se incluye el mínimo necesario para identificar la cita y ningún dato clínico. Un análisis de protección de datos más amplio queda para una spec propia si el cliente piloto lo requiere.
- **Zona horaria**: todas las horas se interpretan y muestran en hora de España peninsular (con cambio estacional de hora).
- **Proceso diario**: se ejecuta una vez al día, todos los días de la semana incluidos sábado y domingo (los avisos de las citas del lunes se generan el domingo), antes de la apertura de la clínica; cómo se programa se decide en el plan. Debe poder ejecutarse también bajo demanda, con un instante de referencia fijado, para pruebas y demostración.
- **Teléfono de la clínica**: es el dato que añade la 002 (`clinica.telefono`); esta spec lo reutiliza para FR-009 y FR-012 y no define otro.
- **Modo simulado**: sin servicio de correo configurado es el modo por defecto; el envío real queda fuera de la v1 salvo que Sara y el cliente piloto lo pidan en una spec posterior.
- **Sin reprogramación**: la 001 no permite editar ni reprogramar una cita; "mover" una cita equivale a cancelar y crear otra. La regla de Sara ("como cualquier otra") cubre ese flujo y una futura reprogramación real.
- **Reutiliza las adiciones de la 002**: el origen de la cancelación (FR-016) y el teléfono de la clínica son los que añade la 002 a la 001; esta spec solo aporta la tabla de recordatorios (FR-004) y no vuelve a ampliar ninguna tabla de la 001.
- **Relación con la 002 (portal del paciente)**: la 002 (aprobada el 2026-10-13, propietario Camilo) permite cancelar con el mismo plazo de 24 h y la misma transición `reservada → cancelada`. Acordado: **la 003 se implementa después de la 002** y cancela con la misma regla de cancelación del paciente (misma función de dominio), el mismo origen de cancelación y la misma etiqueta "Cancelada por el paciente" en la agenda de recepción; no duplica reglas. Los accesos son distintos: la 002 usa un enlace personal por paciente que entrega recepción; la 003 usa un enlace por cita incluido en el recordatorio. Relación declarada en `specs/MAPA.md`, en la 001 y en la 002.
- **Fuera de alcance de la v1**: SMS, WhatsApp, reprogramación por parte del paciente, varios recordatorios por cita, confirmación de asistencia, lista de espera para reutilizar el hueco liberado y envío real de email.
- **Gobierno (Constitución, Principio I)**: el propietario de esta spec es Camilo, según `specs/MAPA.md`. Cumple los Principios II (horas inequívocas), III (cancelar solo libera hueco, FR-014/SC-004), IV (alcance acotado, FR-022), V (SC-001), VI (SC-008), VII y VIII (FR-007/008, SC-007).
