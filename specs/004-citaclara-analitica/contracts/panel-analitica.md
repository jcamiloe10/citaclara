# Contrato de interfaz: panel de analítica

Añade una única ruta a la aplicación de `001-agenda-core`; no modifica ninguna de las rutas ya
descritas en [`specs/001-agenda-core/contracts/interfaz-recepcion.md`](../../001-agenda-core/contracts/interfaz-recepcion.md),
cuyas convenciones de sesión, CSRF y textos en español de España siguen aplicando igual.

## Panel de analítica

| Ruta | Método | Entrada | Resultado |
|---|---|---|---|
| `/analitica` | GET | — (exige sesión, FR-001) | Página única con los cuatro bloques (FR-009). Sin sesión: redirección 303 a `/acceso`, sin ningún dato (igual que `/agenda`). |

Esta ruta es **estrictamente GET**: no existe ningún `POST`, `PUT`, `PATCH` ni `DELETE` bajo
`/analitica` (FR-003). No hay formularios ni botones de acción en la página; solo enlaces de
navegación.

Contenido de `/analitica`, en este orden:

1. **Cabecera**: título "Analítica de la clínica" y enlace "Volver a la agenda".
2. **Ocupación semanal por profesional** (FR-004): una barra por profesional (María, Jorge,
   Lucía) con el porcentaje en texto junto a la barra. Un profesional sin citas en el periodo
   muestra "Sin datos en este periodo" en vez de barra (FR-008).
3. **Tasa de no asistencia por profesional** (FR-005): igual forma que el bloque anterior, una
   barra con el porcentaje por profesional.
4. **Ingresos por servicio** (FR-006): una barra por cada uno de los cuatro servicios, con el
   importe exacto en euros ("14.120,00 €") junto a la barra, y el total de la clínica.
5. **Evolución de las últimas 8 semanas** (FR-007): una polilínea con un punto por semana para
   los ingresos y otra para la tasa de no asistencia, cada punto con su valor en texto al pasar
   el foco o en una tabla equivalente debajo del gráfico (para que la cifra exacta no dependa
   solo de leer el gráfico).

Cada bloque indica además, en texto, el periodo exacto que cubre ("del 3 de agosto al 25 de
septiembre de 2026"), para que Sara pueda citarlo en la reunión de renovación sin ambigüedad
(Principio II).

## Qué esta ruta nunca hace

- No crea, modifica ni borra ninguna fila de `clinica`, `profesional`, `servicio`, `paciente` ni
  `cita`, en ningún código de estado, incluidos los errores (FR-003, SC-002).
- No ofrece ninguna acción sobre una cita (no hay botones "Completada"/"Cancelada"/"No asistida"
  en esta página; esas acciones siguen viviendo solo en `/agenda`, de 001-agenda-core).
- No expone datos de otra clínica distinta de la de la sesión (FR-002).

## Textos y formato

- Mismo formato de fechas, horas e importes que 001 (`es-ES`, sin ambigüedad; importes como
  "3.400,00 €").
- Estados y proporciones se muestran siempre con su cifra en texto, nunca solo con un color o
  solo con el tamaño de una barra (Principio VII).
- "Sin datos en este periodo" es el único texto permitido para un bloque sin citas; nunca un
  0 %, un 0,00 € engañoso ni un mensaje técnico (FR-008).
