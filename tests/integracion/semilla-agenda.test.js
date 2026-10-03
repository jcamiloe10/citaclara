import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBase } from '../../src/db/connection.js';
import { agendaDelDia } from '../../src/domain/agenda.js';
import { formatoHora } from '../../src/domain/tiempo.js';
import { cargarSemilla } from '../../src/seed/seed.js';
import { CLAVE, crearReloj, iniciarServidor, textoVisible } from '../ayudas/fixture.js';

describe('Agenda con los datos de demostración', () => {
  let db;
  let c;
  let reloj;
  beforeEach(async () => {
    db = abrirBase();
    cargarSemilla(db, { ancla: '2026-09-28' });
    reloj = crearReloj('2026-09-30', '10:00');
    c = await iniciarServidor({ db, ahora: reloj.ahora });
    assert.equal((await c.entrar('eleva-demo')).estado, 303);
  });
  afterEach(async () => {
    await c.cerrar();
    db.close();
  });

  it('[US4-E3][FR-022] un día de la parte futura muestra a los tres profesionales con reservas y huecos libres', async () => {
    const t = textoVisible((await c.get('/agenda?dia=2026-10-06')).cuerpo);
    for (const nombre of ['María', 'Jorge', 'Lucía']) assert.match(t, new RegExp(nombre));
    assert.match(t, /🕒 Reservada/);
    assert.match(t, /Libre/);
  });

  it('[US4-E2][FR-022] la historia muestra completadas, no asistidas y canceladas', async () => {
    let completadas = 0;
    let noAsistidas = 0;
    let canceladas = 0;
    for (const dia of ['2026-09-21', '2026-09-22', '2026-09-23', '2026-09-24', '2026-09-25']) {
      const t = textoVisible((await c.get(`/agenda?dia=${dia}`)).cuerpo);
      completadas += (t.match(/✔ Completada/g) ?? []).length;
      noAsistidas += (t.match(/⚠ No asistida/g) ?? []).length;
      canceladas += (t.match(/✖ Cancelada/g) ?? []).length;
    }
    assert.ok(completadas > 0 && noAsistidas > 0 && canceladas > 0, `${completadas}/${noAsistidas}/${canceladas}`);
  });

  it('[FR-025] el alta en un hueco libre de la semilla se completa con un único envío de formulario', async () => {
    // Primer hueco libre de al menos 45 minutos de un profesional de fisioterapia.
    const agenda = agendaDelDia(db, 1, '2026-10-06');
    const maria = agenda.profesionales.find((p) => p.nombre === 'María');
    const hueco = maria.tramos.find((t) => t.tipo === 'libre' && t.fin - t.inicio >= 45 * 60_000);
    assert.ok(hueco, 'la semilla deja huecos libres de al menos 45 minutos');
    const hora = formatoHora(hueco.inicio);

    const html = (await c.get('/agenda?dia=2026-10-06')).cuerpo;
    assert.match(html, new RegExp(`profesional=${maria.id}&amp;dia=2026-10-06&amp;hora=${hora}`));
    const formulario = await c.get(`/citas/nueva?profesional=${maria.id}&dia=2026-10-06&hora=${hora}`);
    assert.match(formulario.cuerpo, new RegExp(`<option value="${hora}" selected>`));

    const sesion = db.prepare("SELECT id FROM servicio WHERE nombre = 'Sesión de fisioterapia'").get().id;
    const paciente = db.prepare('SELECT id FROM paciente ORDER BY id LIMIT 1').get().id;
    const antes = db.prepare('SELECT COUNT(*) AS n FROM cita').get().n;
    const r = await c.enviar('/citas', {
      profesional_id: maria.id,
      servicio_id: sesion,
      dia: '2026-10-06',
      hora,
      paciente_id: paciente,
    });
    assert.equal(r.estado, 303);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM cita').get().n, antes + 1);
  });

  it('[FR-003] la clave de otra clínica no da acceso a la de demostración', async () => {
    const otro = await iniciarServidor({ db, ahora: reloj.ahora });
    try {
      assert.equal((await otro.entrar(CLAVE)).estado, 401);
    } finally {
      await otro.cerrar();
    }
  });
});
