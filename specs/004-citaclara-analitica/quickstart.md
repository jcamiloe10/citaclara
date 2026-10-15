# Guía de validación rápida: Panel de analítica

Guía para comprobar de extremo a extremo que la 004 funciona sobre los datos de demostración de
001-agenda-core. Los comandos son los mismos de 001 (no se añade ningún script nuevo); se
crearán al implementar las tareas.

## Requisitos previos

- Node.js 24 o superior y npm.
- Instalar dependencias: `npm install`.

## 1. Cargar los datos de demostración

```text
npm run seed
```

Igual que en 001: crea "Clínica Eleva" (clave `eleva-demo`), con María, Jorge y Lucía, 4
servicios y 8 semanas de historia. La 004 no añade datos propios; lee los mismos que ya carga
001-agenda-core.

**Recuentos exactos de referencia** (Principio V), con la ancla de pruebas (lunes 2026-09-28,
igual que usa `tests/semilla/semilla.test.js` de 001):

| Cifra | Valor |
|---|---|
| Ocupación semanal (completadas + no asistidas ÷ 3.300 min/semana × 8 semanas) | María 43,0 % · Jorge 40,8 % · Lucía 34,6 % |
| Tasa de no asistencia (÷ todas las citas del periodo) | María 10,2 % · Jorge 7,3 % · Lucía 11,9 % |
| Ingresos por servicio (solo completadas) | Sesión de fisioterapia 14.120,00 € · Primera visita de fisioterapia 3.400,00 € · Consulta de nutrición 5.565,00 € · Primera consulta de nutrición 3.195,00 € (total 26.280,00 €) |
| Evolución, semana del 2026-08-24 | Ingresos 2.875,00 € · no asistencia 16,5 % |

Estos valores quedan fijados como aserciones exactas en las pruebas unitarias de
`domain/analitica.js` (ver `research.md` D7); si cambia la semilla o el generador de 001, estas
cifras deben recalcularse y volver a publicarse aquí (Principio V).

## 2. Arrancar la aplicación

```text
npm start
```

Entrar con la clave `eleva-demo` en `http://localhost:3000/acceso` y pulsar el enlace
"Analítica" de la cabecera (o abrir directamente `http://localhost:3000/analitica`).

## 3. Recorrido manual

1. **Acceso**: sin sesión, `/analitica` redirige a `/acceso` igual que `/agenda`.
2. **Los cuatro bloques**: comprobar que aparecen, en orden, ocupación por profesional, no
   asistencia por profesional, ingresos por servicio y evolución de 8 semanas, con las cifras de
   la tabla anterior.
3. **Sin datos**: con una clínica recién creada (sin `npm run seed`), cada bloque debe mostrar
   "Sin datos en este periodo" en vez de un error o un 0 % engañoso (FR-008).
4. **Aislamiento por clínica**: crear una segunda clínica de prueba (sin citas) y comprobar que
   su panel no muestra ninguna cifra de Clínica Eleva.
5. **Nunca escribe**: repetir la carga de la página varias veces, incluidos los casos sin datos y
   sin sesión, y comprobar (con `sqlite3 data/citaclara.db` o el recuento de filas) que ninguna
   tabla cambia.
6. **Móvil**: estrechar la ventana a unos 375 px. Los cuatro bloques y sus gráficos se leen
   completos sin desplazamiento horizontal de la página (SC-004).

## 4. Pruebas automáticas

```text
npm test
```

- Unitarias de `domain/analitica.js` contra la semilla con la ancla de pruebas (recuentos exactos
  de la tabla anterior).
- Integración HTTP de `/analitica` (sesión exigida, aislamiento por clínica, contenido de cada
  bloque, bloques "sin datos").
- Suite de solo lectura: cero cambios en las tablas tras ejercitar `/analitica` en todos sus
  caminos, y el autorizador de SQLite rechazando una escritura deliberada (research.md, D2).

```text
npm run trazabilidad
```

Tras generalizarse en esta feature (research.md, D6), comprueba también que cada FR y cada
escenario de aceptación de `specs/004-citaclara-analitica/spec.md` tiene al menos una prueba que
lo referencia, además de seguir comprobando 001-agenda-core.

## Criterio de "hecho"

Todo el recorrido manual correcto, `npm test` y `npm run trazabilidad` en verde, y los recuentos
de esta guía iguales a los que produce `domain/analitica.js` sobre la semilla con la ancla de
pruebas.

## Resultado del recorrido (2026-10-13)

Pasos 1 a 5 ejecutados contra la aplicación real (`npm run seed` y `npm start` sobre una base
nueva en una carpeta temporal, con la ancla por defecto del día, 2026-10-12), lanzados como
peticiones HTTP reales (acceso con `eleva-demo`, `GET /analitica`): los cuatro bloques
aparecieron con exactamente las cifras de la tabla del punto 1 (María 43,0 %/10,2 %, Jorge
40,8 %/7,3 %, Lucía 34,6 %/11,9 %; ingresos 14.120,00 €/3.400,00 €/5.565,00 €/3.195,00 €, total
26.280,00 €; evolución con 8 semanas y la fila equivalente a la del 2026-08-24 con 2.875,00 € y
16,5 %), confirmando que los recuentos no dependen del día de carga (Principio V).

**Hallazgo y corrección durante este recorrido**: con la ancla real, los importes de miles de
euros (p. ej. 3.400,00 €) aparecían sin el punto de millares ("3400,00 €"), porque el
`Intl.NumberFormat('es-ES', {style:'currency'})` de Node solo agrupa a partir de 5 cifras con su
opción `useGrouping` por defecto ('auto'). 001-agenda-core nunca lo notó porque sus precios no
llegan a 1.000 €. Se corrigió añadiendo `useGrouping: 'always'` a `domain/dinero.js`
(`formatearEuros`, compartido con 001 sin cambiar su salida visible) y se repitió la petición
real: todos los importes de miles aparecen ya con el punto ("3.400,00 €", "26.280,00 €"). Test de
regresión en `tests/unitarias/analitica.test.js` (`[004-FR-006]`).

**Paso 6 (móvil)**: no se dispuso de un navegador real ni de axe-core en este entorno (001 los
usó en su momento con Chrome headless + puppeteer-core, no dejados como dependencia del
proyecto). En su lugar se revisó el CSS nuevo a mano: los bloques y los SVG usan `width: 100%` /
`height: auto` sin anchos mínimos fijos, la regla a 600px quita el `max-width` de los bloques
(igual criterio que `.columnas` de la agenda), el enlace "Analítica" de la cabecera respeta el
alto táctil de 44 px ya definido para el resto de botones, y los textos de los gráficos (13px)
usan los mismos colores de texto (`--texto`, `--texto-suave`) que 001 ya validó con axe-core a
375 px y 1366 px (ver `specs/001-agenda-core/plan.md`, decisión 4). **Pendiente**: repetir una
pasada real de axe-core sobre `/analitica` cuando se disponga de esas herramientas, igual que
hizo 001.

**Paso 4 (aislamiento) y paso 5 (cero escrituras)**: verificados por las pruebas automáticas
(`tests/integracion/analitica.test.js` y `tests/solo-lectura/analitica.test.js`), que ejercitan
exactamente estos dos recorridos contra una base de fichero real; no se repitieron a mano con
`sqlite3` porque las pruebas ya comprueban el contenido de las tablas byte a byte.

## Referencias

- Contrato de la página: [contracts/panel-analitica.md](contracts/panel-analitica.md)
- Cifras derivadas y periodo analizado: [data-model.md](data-model.md)
- Decisiones técnicas: [research.md](research.md)
- Datos y agenda de los que depende esta feature: [specs/001-agenda-core](../001-agenda-core/)
