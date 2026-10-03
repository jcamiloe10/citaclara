import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBase } from '../../src/db/connection.js';
import { cargarSemilla } from '../../src/seed/seed.js';
import { crearReloj, iniciarServidor, textoVisible } from '../ayudas/fixture.js';

// Términos que un usuario de recepción nunca debe ver (Principio VII y VIII).
const PROHIBIDOS = [
  /\b(error|código|status)\s*[:=]?\s*[45]\d{2}\b/i, /\btoken\b/i, /\bcsrf\b/i, /\bundefined\b/i, /\bnull\b/i,
  /\bNaN\b/, /\[object/i, /\bHTTP\b/, /\bSQL\b/i, /\bexception\b/i, /\bstack\b/i, /\binvalid\b/i, /\bunauthorized\b/i,
  /\bsubmit\b/i, /\bforbidden\b/i, /\bdatabase\b/i, /\bsession\b/i,
];

describe('Textos visibles', () => {
  let db;
  let c;
  beforeEach(async () => {
    db = abrirBase();
    cargarSemilla(db, { ancla: '2026-09-28' });
    c = await iniciarServidor({ db, ahora: crearReloj('2026-09-30', '10:00').ahora });
  });
  afterEach(async () => {
    await c.cerrar();
    db.close();
  });

  async function paginasPrincipales() {
    const paginas = [];
    paginas.push((await c.get('/acceso')).cuerpo);
    paginas.push((await c.entrar('clave-mala')).cuerpo);
    await c.entrar('eleva-demo');
    for (const ruta of [
      '/agenda?dia=2026-10-06', '/agenda?dia=2026-09-22', '/agenda?dia=2026-10-03', '/agenda?dia=basura',
      '/citas/nueva', '/pagina-que-no-existe',
    ]) {
      paginas.push((await c.get(ruta)).cuerpo);
    }
    // Páginas de error de las reglas de negocio.
    const base = { profesional_id: '1', servicio_id: '1', dia: '2026-10-06', hora: '10:00', paciente_id: '1' };
    paginas.push((await c.enviar('/citas', { ...base, hora: '10:07' })).cuerpo);
    paginas.push((await c.enviar('/citas', { ...base, dia: '2026-10-10' })).cuerpo);
    paginas.push((await c.enviar('/citas', { ...base, dia: '2026-09-01' })).cuerpo);
    paginas.push((await c.enviar('/citas', { dia: '2026-10-06' })).cuerpo);
    paginas.push((await c.enviar('/citas/99999/estado', { estado: 'cancelada', dia: '2026-10-06' })).cuerpo);
    paginas.push((await c.post('/citas', base)).cuerpo); // sin token de formulario
    return paginas;
  }

  it('[FR-028][SC-007] ninguna página muestra jerga técnica, fechas numéricas ni valores rotos', async () => {
    const paginas = await paginasPrincipales();
    assert.ok(paginas.length >= 12);
    for (const html of paginas) {
      const t = textoVisible(html);
      for (const prohibido of PROHIBIDOS) assert.doesNotMatch(t, prohibido, `${prohibido} en: ${t.slice(0, 200)}`);
      assert.doesNotMatch(t, /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/, 'fecha numérica ambigua');
      assert.doesNotMatch(t, /\b\d{4}-\d{2}-\d{2}\b/, 'fecha en formato técnico visible');
    }
  });

  it('[FR-028] las páginas declaran el español y usan la hora de España', async () => {
    for (const html of await paginasPrincipales()) {
      if (html.includes('<html')) assert.match(html, /<html lang="es">/);
    }
    const agenda = textoVisible((await c.get('/agenda?dia=2026-10-06')).cuerpo);
    assert.match(agenda, /martes 6 de octubre de 2026/);
    assert.match(agenda, /Todas las horas son hora de España/);
  });

  it('[SC-007][FR-015] todo importe visible tiene formato de euros con dos decimales y coincide con el precio del servicio', async () => {
    await c.entrar('eleva-demo');
    const t = textoVisible((await c.get('/citas/nueva')).cuerpo).replace(/ /g, ' ');
    const importes = [...t.matchAll(/(\S+) €/g)].map((m) => m[1]);
    assert.ok(importes.length >= 4);
    for (const i of importes) assert.match(i, /^\d{1,3},\d{2}$/, i);
    assert.deepEqual([...new Set(importes)].sort(), ['35,00', '40,00', '45,00', '50,00']);
    const agenda = textoVisible((await c.get('/agenda?dia=2026-10-06')).cuerpo).replace(/ /g, ' ');
    for (const [, nombre, euros] of agenda.matchAll(/(Sesión de fisioterapia|Primera visita de fisioterapia|Consulta de nutrición|Primera consulta de nutrición) · \d+ min · (\S+) €/g)) {
      const esperado = { 'Sesión de fisioterapia': '40,00', 'Primera visita de fisioterapia': '50,00', 'Consulta de nutrición': '35,00', 'Primera consulta de nutrición': '45,00' }[nombre];
      assert.equal(euros, esperado, nombre);
    }
  });
});
