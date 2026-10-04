import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { agendaDelDia } from '../../src/domain/agenda.js';
import { formatoHora } from '../../src/domain/tiempo.js';
import { crearEntorno, en } from '../ayudas/fixture.js';

describe('Agenda del día (dominio)', () => {
  let e;
  beforeEach(() => {
    e = crearEntorno();
  });
  afterEach(() => e.cerrar());

  const poner = (prof, servicio, dia, hora, minutos, estado = 'reservada', paciente) =>
    e.insertarCita({
      profesional: e.profesionales[prof],
      servicio: e.servicios[servicio],
      paciente,
      inicio: en(dia, hora),
      fin: new Date(en(dia, hora).getTime() + minutos * 60_000),
      estado,
    });
  const de = (agenda, nombre) => agenda.profesionales.find((p) => p.nombre === nombre);
  const resumen = (prof) =>
    prof.tramos.map((t) =>
      t.tipo === 'ocupado'
        ? `O ${formatoHora(t.cita.inicio)}-${formatoHora(t.cita.fin)}`
        : `L ${formatoHora(t.inicio)}-${formatoHora(t.fin)}`,
    );

  it('[FR-022] devuelve tramos ocupados y libres entre las 09:00 y las 20:00, incluida una cita de 60 min que cruza una hora', () => {
    poner('maria', 'sesion', '2026-10-05', '10:00', 45);
    poner('maria', 'primera', '2026-10-05', '10:45', 60, 'completada'); // 10:45–11:45
    poner('maria', 'sesion', '2026-10-05', '19:15', 45); // termina a las 20:00
    const agenda = agendaDelDia(e.db, e.clinicaId, '2026-10-05');
    assert.deepEqual(resumen(de(agenda, 'María')), [
      'L 09:00-10:00',
      'O 10:00-10:45',
      'O 10:45-11:45',
      'L 11:45-19:15',
      'O 19:15-20:00',
    ]);
    assert.deepEqual(agenda.profesionales.map((p) => p.nombre), ['María', 'Jorge', 'Lucía']);
  });

  it('[US2-E4] las canceladas y no asistidas no ocupan tramo, pero aparecen como histórico', () => {
    poner('maria', 'sesion', '2026-10-05', '10:00', 45, 'cancelada');
    poner('maria', 'sesion', '2026-10-05', '11:00', 45, 'no_asistida');
    const maria = de(agendaDelDia(e.db, e.clinicaId, '2026-10-05'), 'María');
    assert.deepEqual(resumen(maria), ['L 09:00-20:00']);
    assert.deepEqual(maria.historico.map((c) => c.estado), ['cancelada', 'no_asistida']);
  });

  it('[US2-E6] un día sin citas deja todo el horario libre', () => {
    const agenda = agendaDelDia(e.db, e.clinicaId, '2026-10-06');
    for (const p of agenda.profesionales) assert.deepEqual(resumen(p), ['L 09:00-20:00']);
  });

  it('[US2-E6][RN3] sábado y domingo no tienen tramos reservables', () => {
    for (const dia of ['2026-10-03', '2026-10-04']) {
      const agenda = agendaDelDia(e.db, e.clinicaId, dia);
      assert.equal(agenda.laborable, false);
      assert.ok(agenda.profesionales.every((p) => p.tramos.length === 0));
    }
  });

  it('[RN4][FR-025] todos los huecos libres empiezan en múltiplos de 15 minutos', () => {
    poner('jorge', 'sesion', '2026-10-05', '09:30', 45);
    poner('jorge', 'consulta', '2026-10-05', '11:15', 30);
    poner('jorge', 'primera', '2026-10-05', '14:45', 60);
    const jorge = de(agendaDelDia(e.db, e.clinicaId, '2026-10-05'), 'Jorge');
    const libres = jorge.tramos.filter((t) => t.tipo === 'libre');
    assert.ok(libres.length >= 3);
    for (const t of libres) assert.equal(Number(formatoHora(t.inicio).slice(3)) % 15, 0);
  });

  it('[FR-022] los huecos libres más cortos que cualquier servicio siguen apareciendo como libres', () => {
    poner('maria', 'sesion', '2026-10-05', '09:00', 45);
    poner('maria', 'sesion', '2026-10-05', '09:15', 45, 'cancelada'); // no bloquea
    poner('maria', 'sesion', '2026-10-05', '09:45', 45); // 09:45–10:30 deja libre 09:45? no: empieza al acabar la anterior
    const maria = de(agendaDelDia(e.db, e.clinicaId, '2026-10-05'), 'María');
    assert.deepEqual(resumen(maria).slice(0, 2), ['O 09:00-09:45', 'O 09:45-10:30']);
    // Un hueco de 15 minutos entre dos citas sigue siendo un hueco libre.
    poner('jorge', 'sesion', '2026-10-05', '09:00', 45);
    poner('jorge', 'sesion', '2026-10-05', '10:00', 45);
    const jorge = de(agendaDelDia(e.db, e.clinicaId, '2026-10-05'), 'Jorge');
    assert.deepEqual(resumen(jorge).slice(0, 3), ['O 09:00-09:45', 'L 09:45-10:00', 'O 10:00-10:45']);
  });

  it('[FR-003] la agenda de una clínica no incluye citas ni profesionales de otra', () => {
    e.insertarCita({
      clinicaId: e.clinica2.id,
      profesional: e.clinica2.profesional,
      servicio: e.clinica2.servicio,
      paciente: e.clinica2.paciente,
      inicio: en('2026-10-05', '10:00'),
      fin: en('2026-10-05', '10:50'),
    });
    const agenda = agendaDelDia(e.db, e.clinicaId, '2026-10-05');
    assert.deepEqual(agenda.profesionales.map((p) => p.nombre), ['María', 'Jorge', 'Lucía']);
    assert.ok(agenda.profesionales.every((p) => p.tramos.every((t) => t.tipo === 'libre')));
  });
});
