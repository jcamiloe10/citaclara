<!--
Sync Impact Report
- Version change: TEMPLATE → 1.0.0 (ratificación inicial)
- Principios añadidos:
  - I. Spec First
  - II. Precisión Numérica y Temporal (NON-NEGOTIABLE)
  - III. Cero Solapes (NON-NEGOTIABLE)
  - IV. Simplicidad y Cero Alcance Fantasma
  - V. Datos de Demostración Reproducibles
  - VI. Los Tests Acompañan a la Spec
  - VII. Interfaz Clara y Moderna
  - VIII. Español de España
- Secciones añadidas: "Alcance de esta Constitución", "Flujo Multi-Feature y Multi-Agente"
- Secciones eliminadas: ninguna (primera ratificación)
- Plantillas revisadas:
  - ✅ .specify/templates/plan-template.md (la sección "Constitution Check" ya es genérica y remite al fichero de constitución; sin cambios de contenido necesarios)
  - ✅ .specify/templates/spec-template.md (genérica, compatible con los principios; sin cambios necesarios)
  - ✅ .specify/templates/tasks-template.md (genérica, compatible; sin cambios necesarios)
  - ✅ .specify/templates/checklist-template.md (genérica; sin cambios necesarios)
  - ✅ Comandos/skills speckit-* instalados: no contienen nombres de principios ni referencias específicas de agente que deban actualizarse
- TODOs diferidos: ninguno
-->

# Constitución de CitaClara

## Core Principles

### I. Spec First

Todo comportamiento observable de CitaClara nace de una spec aprobada dentro de `specs/`.
Ninguna funcionalidad, pantalla, regla de negocio o cambio de comportamiento llega a
implementarse sin que exista primero su spec correspondiente. Todo cambio de comportamiento
—ya sea una funcionalidad nueva, una corrección o un ajuste— empieza corrigiendo o creando la
spec afectada; el código nunca se adelanta a la spec. La propiedad de cada spec vive en
`specs/MAPA.md`: cada spec tiene exactamente un propietario, y ese mapa es la fuente única de
verdad sobre quién decide y aprueba los cambios de esa spec. Una spec sin propietario asignado
en `specs/MAPA.md` no está lista para implementarse.

**Rationale**: CitaClara nace como producto Spec-Driven Development desde el primer día y
aspira a sostener varias features y varios agentes trabajando en paralelo. Sin una spec previa
y sin una propiedad clara por spec, el trabajo paralelo produce comportamientos contradictorios
y nadie puede arbitrar qué versión es la correcta.

### II. Precisión Numérica y Temporal (NON-NEGOTIABLE)

Todos los importes que maneje CitaClara cuadran al céntimo, siempre: no se redondea de forma
creativa, no se aceptan descuadres "aproximados", y cualquier operación con dinero debe poder
justificar céntimo a céntimo el resultado mostrado. Toda fecha u hora que se muestre a un
usuario se presenta sin ambigüedad posible para una clínica que opera en España: no se muestran
fechas ni horas cuyo formato pueda interpretarse de más de una manera, y toda información
horaria relevante para una cita queda inequívocamente ligada a la zona horaria de España.

**Rationale**: Una clínica factura a pacientes y aseguradoras y agenda citas con consecuencias
reales sobre personas; un céntimo que no cuadra o una hora ambigua no son defectos cosméticos,
son errores de negocio que erosionan la confianza de recepción y de los pacientes.

### III. Cero Solapes (NON-NEGOTIABLE)

Un profesional no puede tener dos citas a la vez, jamás. Esta regla no admite excepciones ni
casos especiales: ni siquiera cuando dos reservas para el mismo hueco llegan en el mismo
instante, ni cuando provienen de canales distintos (recepción, agente automático, paciente),
puede el sistema terminar con dos citas solapadas para el mismo profesional. Toda feature que
escriba en la agenda de un profesional debe incluir, como parte de su propia spec y de sus
propios tests, pruebas que intenten deliberadamente provocar un solape (incluyendo intentos
simultáneos) y que demuestren que el sistema los rechaza o los resuelve sin duplicar la
ocupación del hueco.

**Rationale**: El solape es, para este producto, el fallo capital: es la promesa mínima que
CitaClara hace a cada clínica. Cualquier otro defecto es negociable en severidad; este no.

### IV. Simplicidad y Cero Alcance Fantasma

Ante dos soluciones que resuelven la misma spec, se elige siempre la más simple. Ninguna
funcionalidad, pantalla, regla o dependencia se construye ni se añade al producto si no está
justificada explícitamente en una spec aprobada. No se anticipan necesidades futuras no
escritas, no se generalizan reglas de negocio "por si acaso", y no se incorpora nada —código,
librería, formato de dato o proceso— cuya necesidad no pueda señalarse en una spec concreta.

**Rationale**: El alcance fantasma es el enemigo silencioso de un producto que aspira a crecer
con varias features y varios agentes en paralelo: cada pieza no justificada es superficie de
mantenimiento, de conflicto entre agentes y de deriva respecto a lo que la spec realmente pide.

### V. Datos de Demostración Reproducibles

CitaClara mantiene datos de demostración deterministas: la misma semilla produce siempre la
misma historia de clínicas, profesionales, pacientes y citas. Toda spec, ejemplo, criterio de
aceptación o pieza de analítica que cite un número concreto (una cifra de ingresos, un recuento
de citas, una tasa de ocupación) debe poder citarlo a partir de estos datos de demostración, de
forma que cualquier persona que ejecute la misma semilla obtenga exactamente el mismo número.

**Rationale**: Sin datos reproducibles, cada demo, cada spec y cada revisión discute sobre
cifras distintas; con ellos, el producto y su documentación comparten una única realidad
verificable por cualquiera, en cualquier momento.

### VI. Los Tests Acompañan a la Spec

Cada regla de negocio y cada criterio de aceptación relevante de una spec tiene un test que la
referencia explícitamente. Un criterio de aceptación sin test asociado no se considera
cumplido. La suite de tests en verde es condición necesaria para fusionar cualquier cambio: no
se fusiona código con tests en rojo, ni se desactivan tests para poder fusionar.

**Rationale**: La trazabilidad entre spec y test es lo que permite que varios agentes trabajen
en paralelo sobre features distintas sin que nadie tenga que releer todo el código para saber
qué reglas siguen cumpliéndose.

### VII. Interfaz Clara y Moderna

La persona de recepción usa CitaClara sin formación previa y sin manual. La interfaz no
muestra jerga técnica en ningún texto visible para el usuario; el contraste y el tamaño de los
elementos son accesibles; y la aplicación funciona tanto en el ordenador portátil de recepción
como en el teléfono móvil de un paciente. Esto es un requisito de calidad de producto, no una
decisión de stack: la tecnología concreta con la que se construye esa interfaz se decide en el
plan de cada feature, no en esta constitución.

**Rationale**: El personal de recepción de una clínica pequeña no tiene tiempo ni perfil técnico
para aprender una herramienta compleja, y el paciente que reserva desde el móvil abandona ante
cualquier fricción; la claridad de la interfaz es, para este producto, un requisito de negocio.

### VIII. Español de España

Todo texto visible para cualquier usuario de CitaClara —pantallas, mensajes de error,
notificaciones, documentos generados, correos— está en español de España: terminología,
formato de fecha y hora, y convenciones propias de España, sin mezclar variantes de otros
países hispanohablantes ni anglicismos evitables.

**Rationale**: CitaClara se dirige a clínicas y consultas en España; cualquier inconsistencia de
variante lingüística o de convención se percibe de inmediato como un producto "traducido" y
resta confianza a recepción y a los pacientes.

## Alcance de esta Constitución

Esta constitución fija principios de negocio y de calidad: qué debe ser siempre cierto sobre el
comportamiento de CitaClara, independientemente de cómo se construya. No fija ninguna decisión
técnica. El lenguaje y framework de implementación, el formato de almacenamiento de los datos,
la estructura de carpetas y módulos del código, y cualquier otra elección de stack se deciden en
el plan (`plan.md`) de cada feature, nunca en este documento. Si una spec, un plan o una tarea
necesita justificar una elección técnica, la justificación se apoya en estos principios, pero
el principio en sí nunca nombra una tecnología concreta.

## Flujo Multi-Feature y Multi-Agente

CitaClara está pensado para que, desde el primer mes, varias features avancen a la vez y varios
agentes (humanos o automatizados) trabajen en paralelo sobre specs distintas. Para que ese
paralelismo no degenere en conflicto:

- Ninguna spec se implementa sin propietario asignado en `specs/MAPA.md`; ese propietario es
  quien decide y aprueba los cambios sobre su spec.
- Dos specs que afecten a la misma zona de comportamiento (por ejemplo, dos features que
  escriben en la agenda de un mismo profesional) deben declarar explícitamente esa relación en
  ambas specs, y sus propietarios acuerdan el orden y las reglas de convivencia antes de que
  ninguna de las dos se implemente.
- Un agente solo puede empezar a trabajar sobre una spec que ya esté aprobada; si el trabajo
  revela la necesidad de un comportamiento no cubierto por la spec, el agente detiene la
  implementación y actualiza primero la spec (Principio I).
- La Regla III (Cero Solapes) se trata como una restricción compartida por todas las features
  que tocan la agenda: cualquier feature nueva que escriba en la agenda debe demostrar, con sus
  propios tests, que sigue siendo imposible provocar un solape, incluso combinada con las demás
  features ya existentes.

## Governance

Esta constitución prevalece sobre cualquier otra guía, plantilla o convención del proyecto en
caso de conflicto. Toda spec, plan, tarea o revisión de código debe poder verificarse contra
estos principios; una spec o un plan que no pueda justificar el cumplimiento de un principio no
está lista para aprobarse.

**Procedimiento de enmienda**: cualquier cambio a esta constitución se propone explícitamente,
se redacta como una actualización de este mismo documento (no como una nota aparte) y se aplica
junto con la revisión de las plantillas y comandos dependientes (`plan-template.md`,
`spec-template.md`, `tasks-template.md`, `checklist-template.md` y los comandos `speckit-*`)
para comprobar que ninguno queda desalineado con el nuevo texto.

**Política de versionado**: esta constitución usa versionado semántico (MAJOR.MINOR.PATCH).
MAJOR ante la eliminación o redefinición incompatible de un principio; MINOR al añadir un
principio o una sección, o al ampliar materialmente una guía existente; PATCH ante aclaraciones
de redacción que no cambian el sentido de ningún principio.

**Revisión de cumplimiento**: toda spec incluye, antes de aprobarse, una comprobación explícita
frente a estos principios; todo plan incluye una sección "Constitution Check" que debe pasar
antes de la fase de investigación y volver a comprobarse tras el diseño; cualquier
incumplimiento debe justificarse por escrito en la sección de seguimiento de complejidad del
plan o resolverse simplificando la propuesta (Principio IV).

**Version**: 1.0.0 | **Ratified**: 2026-09-27 | **Last Amended**: 2026-09-27
