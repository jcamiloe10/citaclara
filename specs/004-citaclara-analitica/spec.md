# Feature Specification: Panel de analítica de CitaClara

**Feature Branch**: `004-citaclara-analitica`

**Created**: 2026-10-13

**Status**: Aprobada (2026-10-13) · Propietario: Camilo (ver `specs/MAPA.md`)

**Input**: User description: "Panel de analítica para la clínica. Sara lo necesita para las renovaciones: 'enseñar a la clínica lo que CitaClara le ahorra'. Alcance: una página del panel (misma clave que la agenda), con interfaz moderna y gráficos claros: ocupación semanal por profesional, tasa de no asistencia por profesional, ingresos por servicio (citas completadas; importes exactos, al céntimo), y evolución de las últimas 8 semanas. Solo lectura: esta feature no escribe NADA."

## Clarifications

### Session 2026-10-13

- Q: ¿Sobre qué total se calcula la tasa de no asistencia de cada profesional? → A: Sobre todas las citas del profesional en el periodo, incluidas las canceladas (completadas + no asistidas + canceladas) — Opción A, igual criterio que el estadístico global ya publicado en el quickstart de 001-agenda-core (10,0 %).
- Q: ¿Qué cuenta como "tiempo ocupado" en la ocupación semanal de cada profesional? → A: Minutos de citas "completada" + "no asistida" (el hueco estuvo bloqueado en su momento aunque el paciente no viniera); las citas "cancelada" no cuentan como tiempo ocupado, porque sí liberaron el hueco — Opción B.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Ver de un vistazo cuánto le ahorra CitaClara a la clínica (Priority: P1)

Sara abre, con la misma clave de la clínica que usa recepción para la agenda, una única página de analítica. En ella ve, para cada profesional, su ocupación semanal y su tasa de no asistencia, y ve los ingresos de la clínica desglosados por servicio, todo con cifras exactas y gráficos claros que puede mostrar en una reunión de renovación sin tener que explicar de dónde salen.

**Why this priority**: Es la razón de negocio de toda la feature (renovaciones): sin estas tres cifras no hay nada que mostrar a la clínica.

**Independent Test**: Con los datos de demostración de Clínica Eleva, abrir el panel con la clave de la clínica y comprobar que la ocupación, la tasa de no asistencia y los ingresos por servicio que se muestran coinciden exactamente con los que resultan de consultar directamente las citas de la base de datos.

**Acceptance Scenarios**:

1. **Given** la clave de Clínica Eleva, **When** Sara abre el panel de analítica, **Then** ve una sección por cada profesional (María, Jorge, Lucía) con su ocupación semanal y su tasa de no asistencia, y una sección de ingresos con un importe por cada uno de los cuatro servicios.
2. **Given** los datos de demostración con la ancla de pruebas (lunes 2026-09-28), **When** se muestran los ingresos por servicio, **Then** "Sesión de fisioterapia" muestra 14.120,00 €, "Primera visita de fisioterapia" 3.400,00 €, "Consulta de nutrición" 5.565,00 € y "Primera consulta de nutrición" 3.195,00 €, sumando 26.280,00 € sin ningún descuadre de céntimos.
3. **Given** una persona sin la clave de la clínica, **When** intenta abrir el panel, **Then** se le pide la clave (la misma pantalla de acceso que la agenda) y no ve ningún dato.
4. **Given** dos clínicas con claves distintas, **When** cada una abre el panel con su clave, **Then** cada una ve únicamente las cifras de su propia clínica.
5. **Given** un profesional sin ninguna cita en el periodo analizado, **When** se muestra su sección, **Then** aparece con "sin datos en este periodo" en vez de un porcentaje o una cifra sin sentido (p. ej. 0/0).

---

### User Story 2 - Ver la tendencia de las últimas 8 semanas (Priority: P2)

Sara quiere apoyar la conversación de renovación con una tendencia, no solo con una foto fija: ver cómo han evolucionado semana a semana, durante las últimas 8 semanas completas, los ingresos y la no asistencia de la clínica.

**Why this priority**: Refuerza el argumento de venta de la US1 ("esto mejora con CitaClara") pero no es indispensable para tener un panel útil; depende de que ya existan las cifras agregadas de la US1.

**Independent Test**: Con los datos de demostración, comprobar que el gráfico de evolución muestra 8 puntos (uno por semana) y que los valores de cada semana coinciden con los que resultan de filtrar las citas de esa semana concreta en la base de datos.

**Acceptance Scenarios**:

1. **Given** los datos de demostración con la ancla de pruebas, **When** Sara abre la evolución de las últimas 8 semanas, **Then** ve 8 puntos semanales de ingresos y 8 puntos semanales de tasa de no asistencia, ordenados de la semana más antigua a la más reciente.
2. **Given** la semana del 2026-08-24 (lunes) en los datos de demostración, **When** se muestra ese punto de la evolución, **Then** los ingresos de esa semana son 2.875,00 € y la tasa de no asistencia de esa semana es 16,5 %.
3. **Given** una clínica recién creada con menos de 8 semanas de historia, **When** se muestra la evolución, **Then** se ven solo las semanas que realmente tienen datos, sin inventar semanas vacías anteriores a la apertura de la clínica.

---

### Edge Cases

- Un servicio sin ninguna cita completada en el periodo: su barra de ingresos muestra 0,00 €, no se oculta ni produce un error.
- Un profesional con cero citas totales en el periodo (no solo cero no asistidas): su tasa de no asistencia se muestra como "sin datos", nunca como 0 % (que sugeriría que sí tuvo citas y ninguna fue no asistida) ni como un error de división por cero.
- La sesión de Sara caduca (más de 12 horas, igual que en la agenda) mientras tiene el panel abierto: la siguiente acción vuelve a pedir la clave y no muestra cifras antiguas en pantalla.
- Recepción da de alta, cancela o completa una cita en la agenda mientras Sara tiene el panel abierto: el panel no se actualiza solo en tiempo real, pero la próxima vez que Sara lo abra o lo recargue ve las cifras ya actualizadas; en ningún caso el panel bloquea ni retrasa esa alta de recepción.
- Apertura desde un teléfono móvil: los gráficos y las cifras se leen completos sin desplazamiento horizontal de la página.
- Cualquier error al calcular o mostrar una cifra (dato inesperado, periodo sin historia, etc.) se resuelve mostrando un aviso claro en esa sección del panel; nunca intentando "arreglarlo" escribiendo o corrigiendo datos de la agenda.

## Requirements *(mandatory)*

### Functional Requirements

**Acceso y alcance**

- **FR-001**: El sistema MUST exigir la misma clave de clínica que usa la agenda (001-agenda-core) antes de mostrar cualquier dato del panel de analítica, con el mismo comportamiento de sesión de 12 horas y cierre de sesión ya definido en 001-agenda-core (FR-001 a FR-002b).
- **FR-002**: El panel MUST mostrar únicamente las cifras de la clínica identificada por esa clave; una clínica nunca ve las cifras de otra.
- **FR-003**: Esta feature MUST ser de solo lectura: en ningún flujo, incluidos los de error, puede crear, modificar o borrar ningún registro de clínica, profesional, servicio, paciente o cita. Todas las cifras se calculan leyendo las citas que ya existen por efecto de 001-agenda-core.

**Cifras del panel**

- **FR-004**: El sistema MUST mostrar, para cada profesional de la clínica, su ocupación semanal media sobre el periodo analizado (las últimas 8 semanas laborales completas, con el mismo criterio de "semana completa" que las 8 semanas de historia de los datos de demostración: ver Assumptions), calculada como los minutos de citas "completada" más "no asistida" (el hueco estuvo bloqueado en su momento) dividido entre los minutos disponibles de la clínica en ese periodo; las citas "cancelada" no cuentan como tiempo ocupado, porque liberaron el hueco para una nueva reserva. El tiempo disponible es el horario continuo de 09:00 a 20:00 de lunes a viernes ya fijado por RN3/FR-020b de 001-agenda-core (3.300 minutos por profesional y semana); no se resta ninguna pausa, porque 001-agenda-core no define un descanso como regla de negocio (el hueco de mediodía que se ve en los datos de demostración es solo un rasgo del generador de citas, no una franja bloqueada de la clínica). Con los datos de demostración (ancla de pruebas 2026-09-28): María 43,0 %, Jorge 40,8 %, Lucía 34,6 %.
- **FR-005**: El sistema MUST mostrar, para cada profesional, su tasa de no asistencia en el periodo analizado, calculada como sus citas "no asistida" dividido entre todas sus citas del periodo (completadas + no asistidas + canceladas), igual criterio que el ya usado para la cifra global de la clínica en el quickstart de 001-agenda-core. Con los datos de demostración (ancla de pruebas 2026-09-28): María 10,2 %, Jorge 7,3 %, Lucía 11,9 %.
- **FR-006**: El sistema MUST mostrar los ingresos de la clínica desglosados por servicio, sumando únicamente las citas en estado "completada" del periodo analizado, en euros con importe exacto al céntimo (Principio II). Con los datos de demostración (ancla de pruebas 2026-09-28, 8 semanas de historia): "Sesión de fisioterapia" 14.120,00 €, "Primera visita de fisioterapia" 3.400,00 €, "Consulta de nutrición" 5.565,00 € y "Primera consulta de nutrición" 3.195,00 € (total 26.280,00 €).
- **FR-007**: El sistema MUST mostrar una evolución semana a semana de las últimas 8 semanas laborales completas con, como mínimo, los ingresos de citas completadas y la tasa de no asistencia de cada semana (agregados de toda la clínica), ordenada de la semana más antigua a la más reciente.
- **FR-008**: Si en una sección no hay ninguna cita en el periodo (profesional nuevo, servicio sin uso, clínica con menos de 8 semanas de historia), el sistema MUST mostrarlo como ausencia de datos ("sin datos en este periodo") en vez de un cero, un porcentaje engañoso o un error.

**Interfaz**

- **FR-009**: La interfaz MUST presentar las cuatro cifras (ocupación por profesional, no asistencia por profesional, ingresos por servicio y evolución de 8 semanas) en una sola página del panel, con gráficos claros además de las cifras exactas, sin exigir navegar a otras pantallas para verlas todas.
- **FR-010**: Todo texto visible MUST estar en español de España, sin jerga técnica, con fechas, horas e importes mostrados de forma inequívoca (Principios VII y VIII, igual que en 001-agenda-core).
- **FR-011**: La interfaz MUST ser plenamente utilizable en el ordenador de recepción/dirección y en el teléfono móvil, con contraste y tamaños accesibles, sin desplazamiento horizontal de la página.
- **FR-012**: Las cifras del panel MUST reflejar el estado de la agenda en el momento de abrir o recargar la página; el panel no necesita actualizarse en tiempo real mientras está abierto (ver Assumptions).

### Key Entities

Esta feature no crea ninguna entidad persistida nueva: lee exclusivamente las entidades ya definidas por 001-agenda-core (Clínica, Profesional, Servicio, Cita). Introduce únicamente **cifras derivadas**, calculadas al vuelo y nunca guardadas:

- **Ocupación semanal de un profesional**: proporción de su tiempo disponible ocupado por citas "completada" o "no asistida" en el periodo analizado (FR-004).
- **Tasa de no asistencia de un profesional**: sus citas "no asistida" dividido entre todas sus citas (completadas + no asistidas + canceladas) del periodo (FR-005).
- **Ingresos por servicio**: suma en céntimos del precio del servicio por cada cita "completada" del periodo que lo usó.
- **Serie de evolución semanal**: una fila por cada una de las últimas 8 semanas laborales completas, con sus ingresos y su tasa de no asistencia agregados de toda la clínica.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Con los datos de demostración, cada cifra que muestra el panel (ocupación, no asistencia, ingresos, evolución) coincide exactamente, céntimo a céntimo y sin redondeos sorpresa, con el resultado de calcular esa misma cifra directamente sobre las citas almacenadas; dos cargas o aperturas del panel sobre los mismos datos producen siempre las mismas cifras (Principio V).
- **SC-002**: Usar esta feature, en cualquier recorrido (incluidos errores o periodos sin datos), MUST producir exactamente 0 escrituras sobre clínica, profesional, servicio, paciente o cita; esto se verifica con una prueba automática que lo comprueba explícitamente.
- **SC-003**: Sara, sin formación ni manual, encuentra en el panel la ocupación y la tasa de no asistencia de un profesional concreto en menos de 15 segundos desde que abre la página.
- **SC-004**: El panel se usa completo, con todos sus gráficos y cifras legibles, en un teléfono móvil sin desplazamiento horizontal de la página.
- **SC-005**: El 100 % de los importes y porcentajes visibles están en español de España y ningún importe muestra descuadre de céntimos.

## Assumptions

- **Reutilización del acceso de 001-agenda-core**: el panel no introduce una clave ni un rol nuevos; usa exactamente la clave de clínica y la ventana de sesión de 12 horas ya definidas en 001-agenda-core. No hay, en esta versión, un acceso diferenciado para "dirección" frente a "recepción": quien tiene la clave de la clínica ve también el panel de analítica.
- **Una sola página**: todo el alcance de esta spec (FR-004 a FR-007) vive en una única pantalla del panel, sin sub-páginas por profesional o por servicio.
- **Periodo analizado**: "las últimas 8 semanas" se interpreta igual que la ventana de "historia" de los datos de demostración de 001-agenda-core (ver su `research.md`, decisión D8): las 8 semanas laborales completas anteriores a la semana en curso, sin incluir la semana en curso (que aún no está completa). Con cualquier ancla, el panel muestra siempre 8 semanas completas; una clínica con menos de 8 semanas de antigüedad muestra solo las semanas que realmente tiene.
- **Qué cuenta como "completada" para ingresos**: solo las citas en estado "completada" generan ingresos (igual que en 001-agenda-core); las "no asistida" y "cancelada" nunca suman ingresos.
- **Sin actualización en tiempo real**: el panel no necesita refrescarse solo mientras está abierto; basta con que muestre datos correctos al abrirlo o recargarlo (FR-012). Un refresco automático queda fuera de alcance salvo que una revisión futura de esta spec lo pida.
- **Sin exportación ni impresión**: esta versión no incluye exportar el panel a PDF/Excel ni una vista de impresión; Sara muestra la pantalla directamente en la reunión de renovación. Queda como posible ampliación futura, no como parte de esta spec.
- **Solo lectura hasta en los fallos**: ningún camino de error de esta feature (periodo sin datos, cálculo fallido, sesión caducada) puede derivar en una escritura sobre la agenda; si algo no se puede calcular, el panel lo señala como aviso, nunca intentando corregir datos.
- **Fuera de alcance de la 004** (posibles specs propias): comparar varias clínicas entre sí, analítica por paciente, proyecciones o previsiones, y cualquier acción que modifique la agenda desde el panel.
- **Gobierno (Constitución, Principio I)**: esta spec depende de los datos y del acceso definidos por 001-agenda-core pero no modifica su comportamiento ni su spec; al aprobarse, su propietario y su relación con 001 deben añadirse a `specs/MAPA.md` (Principio I y "Flujo Multi-Feature").
