import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarServidor, textoVisible } from '../ayudas/fixture.js';
import { CLAUDIA, CLAUDIA_RUIZ, entornoConSemilla, iniciarPortal, secretoDemo } from '../ayudas/portal.js';
import { agendaDelDia } from '../../src/domain/agenda.js';

describe('Agenda de recepción: citas canceladas por el paciente', () => {
  let e;
  let r;
  let p;
  beforeEach(async () => {
    e = entornoConSemilla();
    r = await iniciarServidor(e);
    p = await iniciarPortal(e);
    await r.entrar('eleva-demo');
  });
  afterEach(async () => {
    await r.cerrar();
    await p.cerrar();
    e.cerrar();
  });

  const cancelarDesdePortal = (id) => p.post(`/p/${secretoDemo(CLAUDIA)}/citas/${id}/cancelar`);
  const idDe = (tabla, nombre) => e.db.prepare(`SELECT id FROM ${tabla} WHERE nombre = ?`).get(nombre).id;

  it('[002:FR-017][002:US2-E2] tras cancelar la 798 el tramo de María queda libre y la agenda dice "Cancelada por el paciente"', async () => {
    assert.match((await cancelarDesdePortal(798)).ubicacion, /aviso=cancelada/);
    const maria = agendaDelDia(e.db, e.clinicaId, '2026-10-05').profesionales.find((x) => x.nombre === 'María');
    const ocupados = maria.tramos.filter((t) => t.tipo === 'ocupado').map((t) => t.cita.id);
    assert.ok(!ocupados.includes(798));
    const libre = maria.tramos.find(
      (t) => t.tipo === 'libre' && t.inicio <= new Date('2026-10-05T14:30:00.000Z') && t.fin >= new Date('2026-10-05T15:15:00.000Z'),
    );
    assert.ok(libre, 'el tramo de 16:30 a 17:15 está libre');
    const texto = textoVisible((await r.get('/agenda?dia=2026-10-05')).cuerpo);
    assert.match(texto, /16:30–17:15 · Claudia Rodríguez Pérez · Sesión de fisioterapia ✖ Cancelada por el paciente/);
  });

  it('[002:FR-017] una cita cancelada por recepción sigue mostrando "Cancelada" a secas', async () => {
    assert.equal((await r.enviar('/citas/859/estado', { estado: 'cancelada', dia: '2026-10-08' })).estado, 303);
    const texto = textoVisible((await r.get('/agenda?dia=2026-10-08')).cuerpo);
    assert.match(texto, /Claudia Rodríguez Pérez · Sesión de fisioterapia ✖ Cancelada(?! por el paciente)/);
    assert.equal(e.cita(859).cancelada_por_paciente, 0);
  });

  it('[002:FR-017] las canceladas históricas de la semilla muestran "Cancelada" y la otra paciente no se mezcla', async () => {
    const texto = textoVisible((await r.get('/agenda?dia=2026-08-04')).cuerpo);
    assert.match(texto, /Laura Sánchez Hernández · Consulta de nutrición ✖ Cancelada/);
    assert.doesNotMatch(texto, /Cancelada por el paciente/);
    assert.equal(e.db.prepare('SELECT COUNT(*) AS n FROM cita WHERE cancelada_por_paciente = 1').get().n, 0);
    assert.ok(CLAUDIA_RUIZ);
  });

  it('[002:US2-E2][002:FR-014] recepción puede reservar de nuevo el hueco liberado y no aparece ningún solape', async () => {
    await cancelarDesdePortal(798);
    const valores = {
      profesional_id: idDe('profesional', 'María'),
      servicio_id: idDe('servicio', 'Sesión de fisioterapia'),
      dia: '2026-10-05',
      hora: '16:30',
      paciente_id: CLAUDIA_RUIZ,
    };
    const alta = await r.enviar('/citas', valores);
    assert.equal(alta.estado, 303);
    const solapes = e.db
      .prepare(
        `SELECT COUNT(*) AS n FROM cita a JOIN cita b ON a.profesional_id = b.profesional_id AND a.id < b.id
         AND a.estado IN ('reservada','completada') AND b.estado IN ('reservada','completada')
         AND a.inicio < b.fin AND b.inicio < a.fin`,
      )
      .get().n;
    assert.equal(solapes, 0);
  });

  it('[002:FR-017] no se añade ningún botón ni paso nuevo a la agenda de recepción', async () => {
    const antes = (await r.get('/agenda?dia=2026-10-05')).cuerpo;
    await cancelarDesdePortal(798);
    const despues = (await r.get('/agenda?dia=2026-10-05')).cuerpo;
    const botones = (html) => (html.match(/<button/g) ?? []).length;
    assert.ok(botones(despues) < botones(antes), 'una cita menos reservada, sus botones desaparecen y no se añaden otros');
    const li = /<li>[^<]*· Claudia Rodríguez Pérez[\s\S]*?<\/li>/.exec(despues)[0];
    assert.match(li, /Cancelada por el paciente/);
    assert.doesNotMatch(li, /<form|<button|<a /);
  });
});
