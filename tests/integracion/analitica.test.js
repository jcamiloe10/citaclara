import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, en, iniciarServidor, textoVisible } from '../ayudas/fixture.js';

// Mismo criterio que 001-agenda-core (tests/integracion/textos.test.js), repetido aquí porque
// ese fichero está etiquetado con los FR/SC de la 001 (spec cerrada): la cobertura de la 004
// necesita su propia etiqueta `[004:FR-010]` (research.md, D6).
const PROHIBIDOS = [
  /\b(error|código|status)\s*[:=]?\s*[45]\d{2}\b/i, /\btoken\b/i, /\bcsrf\b/i, /\bundefined\b/i, /\bnull\b/i,
  /\bNaN\b/, /\[object/i, /\bHTTP\b/, /\bSQL\b/i, /\bexception\b/i, /\bstack\b/i, /\binvalid\b/i, /\bunauthorized\b/i,
  /\bdatabase\b/i, /\bsession\b/i,
];

describe('Panel de analítica por HTTP', () => {
  let e;
  let c;
  beforeEach(async () => {
    e = crearEntorno({ archivo: true });
    c = await iniciarServidor(e);
  });
  afterEach(async () => {
    await c.cerrar();
    e.cerrar();
  });

  it('[004:US1-E3][004:FR-001] sin sesión, GET /analitica redirige a /acceso sin datos', async () => {
    const r = await c.get('/analitica');
    assert.equal(r.estado, 303);
    assert.equal(r.ubicacion, '/acceso');
  });

  it('[004:US1-E1][004:FR-009] con sesión, la página incluye los tres bloques con cifras exactas', async () => {
    await c.entrar();
    e.insertarCita({
      profesional: e.profesionales.maria,
      servicio: e.servicios.sesion,
      inicio: en('2026-09-10', '10:00'),
      fin: en('2026-09-10', '10:45'),
      estado: 'completada',
    });
    e.insertarCita({
      profesional: e.profesionales.maria,
      servicio: e.servicios.sesion,
      inicio: en('2026-09-10', '11:00'),
      fin: en('2026-09-10', '11:45'),
      estado: 'no_asistida',
    });
    const t = textoVisible((await c.get('/analitica')).cuerpo);
    assert.match(t, /Ocupación semanal por profesional/);
    assert.match(t, /Tasa de no asistencia por profesional/);
    assert.match(t, /Ingresos por servicio/);
    assert.match(t, /María/);
    assert.match(t, /50,0 %/); // 1 de 2 citas no asistida
    assert.match(t, /40,00/); // una cita completada de "Sesión de fisioterapia" (4000 céntimos)
  });

  it('[004:US1-E4][004:FR-002] una segunda clínica solo ve sus propias cifras', async () => {
    e.insertarCita({
      profesional: e.profesionales.maria,
      servicio: e.servicios.sesion,
      inicio: en('2026-09-10', '10:00'),
      fin: en('2026-09-10', '10:45'),
      estado: 'completada',
    });
    // Entra con la clave de la segunda clínica (sin citas) y comprueba que no ve las de la primera.
    const cliente2 = await iniciarServidor(e);
    await cliente2.entrar('clave-otra-2');
    const t = textoVisible((await cliente2.get('/analitica')).cuerpo);
    assert.doesNotMatch(t, /40,00/);
    await cliente2.cerrar();
  });

  it('[004:US1-E5][004:FR-008] un profesional sin citas en el periodo muestra "Sin datos en este periodo"', async () => {
    await c.entrar();
    const t = textoVisible((await c.get('/analitica')).cuerpo);
    assert.match(t, /Sin datos en este periodo/);
  });

  it('[004:US2-E1][004:FR-007] la página muestra el bloque de evolución con los puntos y una tabla de cifras exactas', async () => {
    await c.entrar();
    e.insertarCita({
      profesional: e.profesionales.lucia,
      servicio: e.servicios.consulta,
      inicio: en('2026-08-24', '10:00'),
      fin: en('2026-08-24', '10:30'),
      estado: 'completada',
    });
    const t = textoVisible((await c.get('/analitica')).cuerpo);
    assert.match(t, /Evolución de las últimas 8 semanas/);
    assert.match(t, /Cifras exactas de cada semana/);
    assert.match(t, /35,00/); // ingreso de esa cita en la tabla de evolución
  });

  it('[004:US2-E3] una clínica nueva con menos de 8 semanas de historia no muestra semanas vacías', async () => {
    await c.entrar();
    e.insertarCita({
      profesional: e.profesionales.maria,
      servicio: e.servicios.sesion,
      inicio: en('2026-09-21', '10:00'),
      fin: en('2026-09-21', '10:45'),
      estado: 'completada',
    });
    const { cuerpo } = await c.get('/analitica');
    // Solo una fila de datos en la tabla de evolución (una semana con citas).
    const filas = [...cuerpo.matchAll(/<th scope="row">/g)];
    assert.equal(filas.length, 1);
  });

  it('[004:SC-005] los importes se muestran en formato es-ES', async () => {
    await c.entrar();
    e.insertarCita({
      profesional: e.profesionales.jorge,
      servicio: e.servicios.primera,
      inicio: en('2026-09-10', '10:00'),
      fin: en('2026-09-10', '11:00'),
      estado: 'completada',
    });
    const t = textoVisible((await c.get('/analitica')).cuerpo);
    assert.match(t, /50,00/);
  });

  it('[004:FR-010] la página no muestra jerga técnica ni fechas numéricas ambiguas, y declara el español', async () => {
    await c.entrar();
    e.insertarCita({
      profesional: e.profesionales.jorge,
      servicio: e.servicios.primera,
      inicio: en('2026-09-10', '10:00'),
      fin: en('2026-09-10', '11:00'),
      estado: 'completada',
    });
    const { cuerpo } = await c.get('/analitica');
    assert.match(cuerpo, /<html lang="es">/);
    const t = textoVisible(cuerpo);
    for (const prohibido of PROHIBIDOS) assert.doesNotMatch(t, prohibido, `${prohibido} en: ${t.slice(0, 200)}`);
    assert.doesNotMatch(t, /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/, 'fecha numérica ambigua');
    assert.doesNotMatch(t, /\b\d{4}-\d{2}-\d{2}\b/, 'fecha en formato técnico visible');
    assert.match(t, /Todas las horas son hora de España/);
  });

  it('[004:FR-011] declara el viewport móvil y usa la misma rejilla responsive que la agenda', async () => {
    await c.entrar();
    const { cuerpo } = await c.get('/analitica');
    assert.match(cuerpo, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
    assert.match(cuerpo, /estilos\.css/);
  });

  it('[004:FR-012] cada carga de la página refleja el estado actual de la agenda, sin necesidad de nada más que recargar', async () => {
    await c.entrar();
    const antes = textoVisible((await c.get('/analitica')).cuerpo);
    assert.match(antes, /Sin datos en este periodo/);

    e.insertarCita({
      profesional: e.profesionales.maria,
      servicio: e.servicios.sesion,
      inicio: en('2026-09-10', '10:00'),
      fin: en('2026-09-10', '10:45'),
      estado: 'completada',
    });
    const despues = textoVisible((await c.get('/analitica')).cuerpo);
    assert.match(despues, /40,00/);
  });
});
