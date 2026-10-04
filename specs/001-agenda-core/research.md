# Research: Núcleo de agenda de CitaClara

Decisiones técnicas de la 001. Siguen la Constitución (Principio IV: lo más simple que cumpla la spec). No quedaban `NEEDS CLARIFICATION`; aquí se justifica el stack, que la spec deja abierto a propósito.

## D1. Plataforma: Node.js 24 con JavaScript (módulos ES), sin paso de compilación

- **Decisión**: Node.js 24 LTS, JavaScript puro con JSDoc donde aporte claridad. Sin TypeScript ni *bundler*.
- **Razón**: Node 24 y npm 11 ya están instalados en el entorno. Sin compilación hay menos piezas que mantener (IV). El corredor de pruebas viene incluido (`node:test`).
- **Alternativas**: TypeScript (más seguridad de tipos, pero añade compilación y configuración sin que ninguna spec lo pida); .NET 10 (disponible, pero más pesado para una interfaz de pocas pantallas).

## D2. Almacenamiento: SQLite en fichero mediante `node:sqlite` (incluido en Node)

- **Decisión**: una base SQLite en fichero (`data/citaclara.db`), con el módulo `node:sqlite` incluido en Node. Cero dependencias nativas.
- **Razón**: una clínica pequeña no necesita un servidor de base de datos. SQLite da transacciones reales y un único escritor, justo lo que exige el Cero Solapes (III). `better-sqlite3` obligaría a compilar un módulo nativo en Windows.
- **Riesgo**: `node:sqlite` se considera todavía de estabilidad limitada. Se aísla en un único módulo de conexión (`src/db/connection.js`) para poder sustituirlo.
- **Alternativas**: PostgreSQL (restricción de exclusión nativa, pero infraestructura desproporcionada para la 001); ficheros JSON (sin transacciones; incumple III).

## D3. Cero solapes bajo concurrencia (RN1, FR-018): dos defensas

- **Decisión**:
  1. **Comprobación y alta en una sola transacción de escritura inmediata** (`BEGIN IMMEDIATE`). La consulta de solape y el `INSERT` se ejecutan sin que otra escritura pueda intercalarse, también entre procesos distintos que compartan el fichero. Con `busy_timeout` las altas simultáneas esperan su turno en vez de fallar.
  2. **Disparador (`TRIGGER`) en la propia base** que aborta cualquier `INSERT` o `UPDATE` que deje a un profesional con dos citas reservadas o completadas solapadas. Es la red de seguridad: aunque un fallo futuro de código se saltara la comprobación, la base lo rechaza.
- **Razón**: SQLite no tiene restricción de exclusión por rango. La combinación de transacción inmediata y disparador cubre tanto la ruta normal como los fallos de programación. El Principio III exige además pruebas con intentos simultáneos reales.
- **Prueba**: N procesos hijos (no solo promesas en un mismo proceso, que el bucle de eventos ya serializaría) lanzan el alta del mismo hueco y de huecos parcialmente solapados. Resultado esperado: exactamente 1 cita registrada (SC-001).
- **Alternativas**: bloqueo en memoria (no protege con varios procesos); reintento optimista sin transacción (ventana de carrera).

## D4. Tiempo: instantes en UTC, reglas y presentación en `Europe/Madrid`

- **Decisión**: inicio y fin se guardan como instante UTC (texto ISO 8601 con `Z`). El horario de la clínica (RN3: lunes a viernes, 09:00–20:00) y toda presentación usan la zona `Europe/Madrid` mediante `Intl.DateTimeFormat`. Todo el cálculo con fechas pasa por un único módulo (`src/domain/tiempo.js`) y el reloj se inyecta (`ahora()`), para fijar la hora en las pruebas.
- **Razón**: Principio II: nada de horas ambiguas. Node 24 no trae `Temporal` sin configuración adicional, y `Intl` basta. Los cambios de hora de verano ocurren de madrugada del domingo, fuera del horario laboral, así que no afectan a las citas, pero sí se prueban los días de cambio.
- **Presentación**: `es-ES`, por ejemplo "viernes 2 de octubre de 2026, 10:00" (FR-028).
- **Alternativas**: guardar hora local sin zona (ambiguo en el cambio de hora); librería de fechas (dependencia sin necesidad).

## D5. Dinero: céntimos enteros

- **Decisión**: precios como entero en céntimos (`precio_centimos`). Formato de salida con `Intl.NumberFormat('es-ES', {style:'currency', currency:'EUR'})`, por ejemplo "40,00 €".
- **Razón**: Principio II; evita errores de coma flotante. En la 001 solo se muestran precios, no se suman.

## D6. Interfaz: HTML generado en el servidor, sin framework de frontend

- **Decisión**: Express genera páginas HTML con funciones de plantilla (cadenas), formularios normales con `POST` y redirección, y una hoja de estilos propia. Las acciones sobre citas son botones de formulario. Un fragmento mínimo de JavaScript solo mejora el formulario de paciente nuevo (mostrar u ocultar campos) y funciona sin él.
- **Razón**: la interfaz son tres pantallas (acceso, agenda del día, alta de cita). Un SPA añadiría estado en el cliente, un segundo sistema de validación y un *bundler* sin que ninguna spec lo pida (IV). Recargar la página tras cada acción cumple FR-027.
- **Diseño** (Principio VII): CSS propio con variables, *grid* responsive (columnas por profesional en ordenador, pila vertical en móvil), tamaños táctiles ≥ 44 px, contraste AA, estados diferenciados por texto e icono además del color (FR-023), tema claro. Sin dependencias de fuentes externas: pila de fuentes del sistema.
- **Textos**: todos en un único módulo `src/web/textos.js` en español de España, sin jerga (VIII).
- **Alternativas**: React/Vue (peso y complejidad innecesarios); HTMX (dependencia extra sin necesidad real).

## D7. Acceso con clave de clínica (v1, deuda consciente)

- **Decisión**: la clave de cada clínica se guarda como *hash* con `scrypt` de Node (`crypto`), nunca en claro. Al acertar, se emite una cookie de sesión firmada con HMAC que incluye el identificador de clínica y la caducidad (12 horas, FR-002b), `HttpOnly`, `SameSite=Lax`. "Cerrar sesión" la borra. Sin cuentas, sin recuperación y sin bloqueo por intentos (deuda declarada en la spec).
- **Identificación de la clínica por la clave (FR-003)**: el acceso solo recibe la clave. Para encontrar la clínica se verifica la clave contra el *hash* de cada clínica (pocas clínicas por instalación, coste despreciable). La unicidad se garantiza al crear la clínica: `crearClinica` verifica la clave nueva contra todas las existentes y la rechaza si coincide con alguna (no puede ser una restricción de base de datos, porque cada *hash* lleva su sal).
- **Protección mínima**: las acciones que escriben (`POST`) comprueban un *token* CSRF ligado a la sesión; comparación de claves en tiempo constante.
- **Razón**: cumple FR-001/002/002b/003 con piezas del propio Node, sin librerías de sesión.
- **Secreto de firma**: se lee del entorno (`CITACLARA_SECRETO`); en desarrollo se genera uno aleatorio por proceso (las sesiones se pierden al reiniciar, aceptable).

## D8. Datos de demostración deterministas

- **Decisión**: un generador con PRNG propio y semilla fija (`mulberry32`), sin leer el reloj ni `Math.random`. Parámetros explícitos: fecha ancla (por defecto, el lunes de la semana en curso, en `Europe/Madrid`) y semilla.
  - **Historia**: las 8 semanas laborales completas anteriores a la ancla (40 días laborables). Los estados se asignan por cuotas exactas sobre el total de citas generadas, no por probabilidad: el 10 % exacto (redondeado) "no asistida", el 8 % "cancelada", el resto "completada".
  - **Futuro**: las 2 semanas laborales completas que empiezan en el lunes siguiente a la ancla, todas "reservada". Las citas de esta parte quedan siempre después del momento de la carga, aunque esta se haga en lunes.
  - **Sin solapes**: se rellena cada día de cada profesional con huecos ya libres, sin pasar por el servicio de reservas (cumple RN1 por construcción, y una prueba lo verifica).
  - **Idempotencia**: `npm run seed` vacía los datos de la clínica demo y los vuelve a crear en una transacción (FR-034).
- **Razón**: Principio V; con fecha ancla y semilla fijas, el contenido es idéntico (mismas citas, mismos estados) en cualquier ejecución, y las pruebas fijan la ancla y el reloj para citar números exactos.
- **Consecuencia a vigilar**: con la ancla en el lunes de la semana en curso, la semana actual queda sin citas en la demo; las dos semanas con reservas son las dos siguientes. Se anota como supuesto del plan (ver `plan.md`).
- **Clave de demostración**: `eleva-demo`, documentada en `quickstart.md`. Es solo para datos de demostración.

## D9. Pruebas (Principio VI)

- **Decisión**: `node:test` y `node:assert`. Cada prueba lleva en el nombre el identificador de la regla o escenario que cubre (`RN1`, `FR-018`, `US1-E3`…), y un script de trazabilidad (`npm run trazabilidad`) comprueba que cada regla de negocio (RN1 a RN4), cada requisito funcional y cada escenario de aceptación de la spec tiene al menos una prueba que lo referencia (SC-008). Los alias de la spec se resuelven en el script: RN1 = FR-016, RN2 = FR-020, RN3 = FR-020b, RN4 = FR-020c; se admiten identificadores con sufijo (`FR-002b`, `FR-008b`). Los criterios de éxito de uso medidos por personas (SC-002, SC-003) y la comprobación en móvil real (SC-006) se verifican a mano en el [quickstart](quickstart.md) y no entran en el script.
- **Capas**: unitarias del dominio (tiempo, solape, transiciones, dinero), de integración contra una base SQLite temporal y HTTP real (acceso, agenda, alta, estados), de concurrencia con procesos hijos, y de la semilla (recuentos, proporciones, ausencia de solapes, igualdad entre dos cargas).
- **Interfaz**: se verifica por HTTP (contenido de las páginas y cabeceras) y con una revisión manual guiada de móvil y escritorio descrita en `quickstart.md`. No se añade un navegador automatizado en la 001 (IV).

## D10. Dependencias de producción

Solo `express`. Todo lo demás (SQLite, *hash*, HMAC, pruebas, formato de fechas e importes) viene con Node.
