import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { agendaDelDia } from '../../../src/domain/agenda.js';
import { iniciarPortal } from '../../ayudas/portal.js';
import { CLAVE, crearCarpetaSalida, crearEntorno, crearReloj, iniciarServidor, textoVisible } from '../../ayudas/fixture.js';
import { citaA, generar, secretoDeCita } from '../ayudas.js';

describe('Agenda de recepción: cita cancelada desde el enlace del recordatorio', () => {
  let e;
  let carpeta;
  let recepcion;
  let web;
  let citaId;
  let secreto;
  beforeEach(async () => {
    e = crearEntorno({ reloj: crearReloj('2026-10-04', '07:00') });
    carpeta = crearCarpetaSalida();
    citaId = citaA(e, '2026-10-05', '10:00');
    generar(e, carpeta);
    secreto = secretoDeCita(e, carpeta, citaId);
    recepcion = await iniciarServidor(e);
    web = await iniciarPortal(e);
    await recepcion.entrar(CLAVE);
  });
  afterEach(async () => {
    await recepcion.cerrar();
    await web.cerrar();
    e.cerrar();
    carpeta.limpiar();
  });

  it('[003:US2-E7][003:FR-016] tras cancelar por el enlace, la agenda muestra "Cancelada por el paciente" y el hueco libre y reservable', async () => {
    assert.equal((await web.post(`/cancelar/${secreto}`)).estado, 200);
    const maria = agendaDelDia(e.db, e.clinicaId, '2026-10-05').profesionales.find((p) => p.nombre === 'María');
    assert.ok(!maria.tramos.some((t) => t.tipo === 'ocupado'), 'ya no hay tramos ocupados de María');
    assert.ok(
      maria.tramos.some((t) => t.tipo === 'libre' && t.inicio <= new Date('2026-10-05T08:00:00.000Z') && t.fin >= new Date('2026-10-05T08:45:00.000Z')),
      'el hueco de las 10:00 a las 10:45 está libre',
    );
    const texto = textoVisible((await recepcion.get('/agenda?dia=2026-10-05')).cuerpo);
    assert.match(texto, /10:00–10:45 · Ana Ruiz · Sesión de fisioterapia ✖ Cancelada por el paciente/);

    // Recepción puede reservar de nuevo ese mismo hueco.
    const reservar = await recepcion.enviar('/citas', {
      profesional_id: e.profesionales.maria,
      servicio_id: e.servicios.sesion,
      dia: '2026-10-05',
      hora: '10:00',
      paciente_id: e.pacientes[1],
    });
    assert.equal(reservar.estado, 303);
  });

  it('[003:US2-E7][003:FR-016] una cancelación hecha por recepción no lleva la etiqueta "por el paciente"', async () => {
    assert.equal((await recepcion.enviar(`/citas/${citaId}/estado`, { estado: 'cancelada', dia: '2026-10-05' })).estado, 303);
    const texto = textoVisible((await recepcion.get('/agenda?dia=2026-10-05')).cuerpo);
    assert.match(texto, /10:00–10:45 · Ana Ruiz · Sesión de fisioterapia ✖ Cancelada(?! por el paciente)/);
    assert.equal(e.db.prepare('SELECT cancelada_por_paciente AS p FROM cita WHERE id = ?').get(citaId).p, 0);
    // El enlace del recordatorio informa de que ya estaba cancelada y no cambia el origen.
    assert.match(textoVisible((await web.get(`/cancelar/${secreto}`)).cuerpo), /ya está cancelada/);
    assert.equal(e.db.prepare('SELECT cancelada_por_paciente AS p FROM cita WHERE id = ?').get(citaId).p, 0);
  });
});
