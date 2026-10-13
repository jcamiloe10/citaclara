import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { textoVisible } from '../ayudas/fixture.js';
import { CLAUDIA, CLAUDIA_RUIZ, entornoConSemilla, iniciarPortal, secretoDemo } from '../ayudas/portal.js';

describe('Portal del paciente: ver mis citas', () => {
  let e;
  let p;
  before(async () => {
    e = entornoConSemilla();
    p = await iniciarPortal(e);
  });
  after(async () => {
    await p.cerrar();
    e.cerrar();
  });

  const pagina = async (ficha, consulta = '') => {
    const r = await p.get(`/p/${secretoDemo(ficha)}${consulta}`);
    assert.equal(r.estado, 200);
    return { html: r.cuerpo, texto: textoVisible(r.cuerpo) };
  };

  it('[002:FR-006][002:US1-E1] "Próximas citas" muestra las 10 de Claudia, la primera el lunes 5 de octubre de 2026, 09:00', async () => {
    const { html, texto } = await pagina(CLAUDIA);
    assert.match(texto, /Hola, Claudia/);
    assert.match(texto, /Próximas citas lunes 5 de octubre de 2026, 09:00 Lucía · Consulta de nutrición/);
    const proximas = html.split('id="titulo-historial"')[0];
    assert.equal((proximas.match(/class="tarjeta cita-portal/g) ?? []).length, 10);
    assert.match(texto, /jueves 15 de octubre de 2026, 17:45 María · Sesión de fisioterapia/);
  });

  it('[002:FR-007][002:FR-018] fechas es-ES en hora de España, estado con texto e icono, sin precios ni inglés', async () => {
    const { html, texto } = await pagina(CLAUDIA);
    assert.match(texto, /lunes 5 de octubre de 2026, 09:00/);
    assert.match(texto, /🕒 Reservada/);
    assert.match(texto, /✔ Completada/);
    assert.match(texto, /Todas las horas son hora de España/);
    assert.doesNotMatch(texto, /€|\bprecio\b/i);
    assert.doesNotMatch(texto, /\b(upcoming|history|cancel appointment|undefined|null)\b/i);
    assert.match(html, /<html lang="es">/);
  });

  it('[002:FR-007] el historial muestra 10 citas y "Ver más citas" (h=20 → 20; h=30 → las 29)', async () => {
    const cuenta = (html) => (html.split('id="titulo-historial"')[1]?.match(/class="tarjeta cita-portal/g) ?? []).length;
    const base = await pagina(CLAUDIA);
    assert.equal(cuenta(base.html), 10);
    assert.match(base.texto, /Ver más citas/);
    assert.match(base.html, /href="\/p\/[^"]+\?h=20"/);
    const veinte = await pagina(CLAUDIA, '?h=20');
    assert.equal(cuenta(veinte.html), 20);
    const treinta = await pagina(CLAUDIA, '?h=30');
    assert.equal(cuenta(treinta.html), 29);
    assert.doesNotMatch(treinta.texto, /Ver más citas/);
    assert.equal(cuenta((await pagina(CLAUDIA, '?h=7')).html), 10);
    assert.equal(cuenta((await pagina(CLAUDIA, '?h=1000000')).html), 29);
  });

  it('[002:FR-017] las canceladas del historial se muestran como "Cancelada" a secas (no hay canceladas por el paciente en la semilla)', async () => {
    const { texto } = await pagina(CLAUDIA, '?h=30');
    assert.match(texto, /miércoles 23 de septiembre de 2026, 11:00 Jorge · Sesión de fisioterapia ✖ Cancelada/);
    assert.doesNotMatch(texto, /Cancelada por el paciente/);
  });

  it('[002:FR-009] el nombre y el teléfono de la clínica aparecen en la página', async () => {
    const { texto, html } = await pagina(CLAUDIA);
    assert.match(texto, /Clínica Eleva · 910 123 456/);
    assert.match(html, /href="tel:910123456"/);
  });

  it('[002:FR-009] una clínica sin teléfono muestra solo su nombre y "Llama a la clínica"', async () => {
    e.db.prepare('UPDATE clinica SET telefono = NULL WHERE id = ?').run(e.clinicaId);
    e.reloj.fijar('2026-10-04', '10:00'); // la cita 805 queda a 23 h: se explica el plazo y se pide llamar
    try {
      const { texto } = await pagina(CLAUDIA);
      assert.doesNotMatch(texto, /910/);
      assert.match(texto, /Clínica Eleva/);
      assert.match(texto, /Llama a la clínica/);
    } finally {
      e.reloj.fijar('2026-10-01', '10:00');
      e.db.prepare("UPDATE clinica SET telefono = '910123456' WHERE id = ?").run(e.clinicaId);
    }
  });

  it('[002:FR-010][002:US1-E5] un paciente sin citas ve "Todavía no tienes citas" y el teléfono de la clínica', async () => {
    const { crearOrenovarEnlace } = await import('../../src/domain/enlaces.js');
    const { lastInsertRowid } = e.db
      .prepare('INSERT INTO paciente (clinica_id, nombre, telefono, email) VALUES (?, ?, ?, ?)')
      .run(e.clinicaId, 'Pablo Nuevo', '611111111', 'pablo@ejemplo.es');
    const { secreto } = crearOrenovarEnlace(e.db, { clinicaId: e.clinicaId, pacienteId: Number(lastInsertRowid) });
    const r = await p.get(`/p/${secreto}`);
    const texto = textoVisible(r.cuerpo);
    assert.equal(r.estado, 200);
    assert.match(texto, /Todavía no tienes citas/);
    assert.match(texto, /910 123 456/);
  });

  it('[002:US1-E4][002:FR-002] el enlace de Claudia Ruiz Romero no muestra ninguna cita de Claudia Rodríguez Pérez', async () => {
    const suyas = await pagina(CLAUDIA, '?h=30');
    const otra = await pagina(CLAUDIA_RUIZ, '?h=40');
    assert.match(otra.texto, /Hola, Claudia/);
    const citas = (html) => [...html.matchAll(/<p class="cita-cuando">([^<]+)<\/p>\s*<p class="cita-detalle">([^<]+)<\/p>/g)].map((m) => `${m[1]}|${m[2]}`);
    const deClaudia = new Set(citas(suyas.html));
    // Mismo día, hora, profesional y servicio solo puede coincidir si la cita es la misma: nunca para la misma ficha.
    const comunes = citas(otra.html).filter((c) => deClaudia.has(c));
    // Puede haber coincidencias fortuitas de día y hora con distinto profesional; comparamos por ids en base de datos.
    const idsClaudia = new Set(e.db.prepare('SELECT id FROM cita WHERE paciente_id = ?').all(CLAUDIA).map((c) => c.id));
    const idsOtra = e.db.prepare('SELECT id FROM cita WHERE paciente_id = ?').all(CLAUDIA_RUIZ).map((c) => c.id);
    assert.ok(idsOtra.every((id) => !idsClaudia.has(id)));
    assert.ok(comunes.length <= idsOtra.length);
    assert.equal(citas(otra.html).length, idsOtra.length);
  });

  it('[002:FR-019][002:US1-E6][002:SC-007] adaptable a móvil: viewport, una columna y sin anchuras fijas mayores de 360 px', async () => {
    const { html } = await pagina(CLAUDIA);
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
    const css = readFileSync(new URL('../../src/web/publico/estilos.css', import.meta.url), 'utf8');
    const portal = css.slice(css.indexOf('Portal del paciente (002)'));
    for (const m of portal.matchAll(/(?<![-a-z])(?:min-)?width:\s*(\d+)px/g)) {
      assert.ok(Number(m[1]) <= 360, `anchura fija de ${m[1]}px en el CSS del portal`);
    }
    assert.match(portal, /max-width:\s*40rem/);
  });
});
