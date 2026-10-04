import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearCita } from '../../src/domain/citas.js';
import { crearEntorno, en, haySolapes } from '../ayudas/fixture.js';

describe('Alta de cita (dominio)', () => {
  let e;
  beforeEach(() => {
    e = crearEntorno(); // reloj fijo: viernes 2 de octubre de 2026, 08:00
  });
  afterEach(() => e.cerrar());

  const reservar = (dia, hora, { prof = 'maria', servicio = 'sesion', paciente } = {}) =>
    crearCita(
      e.db,
      {
        clinicaId: e.clinicaId,
        profesionalId: e.profesionales[prof],
        servicioId: e.servicios[servicio],
        pacienteId: paciente ?? e.pacientes[0],
        inicio: en(dia, hora),
      },
      e.ahora,
    );
  const citaDe = (id) => e.db.prepare('SELECT * FROM cita WHERE id = ?').get(id);

  it('[US1-E1][FR-010][FR-011] reserva en un hueco libre: fin = inicio + 45 min y estado reservada', () => {
    const r = reservar('2026-10-05', '10:00');
    assert.equal(r.ok, true);
    const c = citaDe(r.cita.id);
    assert.equal(c.estado, 'reservada');
    assert.equal(c.inicio, en('2026-10-05', '10:00').toISOString());
    assert.equal(c.fin, en('2026-10-05', '10:45').toISOString());
  });

  it('[FR-010] una primera visita de 60 minutos que cruza una hora redonda termina a las 11:30', () => {
    const r = reservar('2026-10-05', '10:30', { servicio: 'primera' });
    assert.equal(citaDe(r.cita.id).fin, en('2026-10-05', '11:30').toISOString());
  });

  it('[US1-E2][RN1] rechaza solape con una cita reservada y no cambia la agenda', () => {
    reservar('2026-10-05', '10:00');
    const antes = e.contarCitas();
    const r = reservar('2026-10-05', '10:30');
    assert.deepEqual([r.ok, r.codigo], [false, 'ocupado']);
    assert.equal(e.contarCitas(), antes);
  });

  it('[US1-E3][RN1] rechaza solape con una cita completada', () => {
    e.insertarCita({
      profesional: e.profesionales.maria,
      servicio: e.servicios.sesion,
      inicio: en('2026-10-05', '10:00'),
      fin: en('2026-10-05', '10:45'),
      estado: 'completada',
    });
    assert.equal(reservar('2026-10-05', '10:15').codigo, 'ocupado');
  });

  it('[US1-E2][RN1] rechaza solape parcial por delante, por detrás y cuando una cita envuelve a la otra', () => {
    reservar('2026-10-05', '10:00', { servicio: 'primera' }); // 10:00–11:00
    assert.equal(reservar('2026-10-05', '09:30').codigo, 'ocupado'); // 09:30–10:15 pisa el inicio
    assert.equal(reservar('2026-10-05', '10:45').codigo, 'ocupado'); // 10:45–11:30 pisa el final
    assert.equal(reservar('2026-10-05', '10:15', { servicio: 'consulta' }).codigo, 'ocupado'); // dentro
    assert.equal(reservar('2026-10-05', '10:00', { servicio: 'sesion' }).codigo, 'ocupado'); // mismo inicio
  });

  it('[US1-E4][RN1] una cita que empieza justo cuando termina otra (y al revés) no solapa', () => {
    assert.equal(reservar('2026-10-05', '10:00').ok, true); // 10:00–10:45
    assert.equal(reservar('2026-10-05', '10:45').ok, true); // empieza al terminar la anterior
    assert.equal(reservar('2026-10-05', '09:15').ok, true); // 09:15–10:00 termina al empezar la primera
    assert.equal(haySolapes(e.db), false);
  });

  it('[US1-E5][FR-017] las citas canceladas y no asistidas no bloquean el hueco', () => {
    for (const [dia, estado] of [['2026-10-05', 'cancelada'], ['2026-10-06', 'no_asistida']]) {
      e.insertarCita({
        profesional: e.profesionales.maria,
        servicio: e.servicios.sesion,
        inicio: en(dia, '10:00'),
        fin: en(dia, '10:45'),
        estado,
      });
      assert.equal(reservar(dia, '10:00').ok, true, estado);
    }
  });

  it('[US1-E6][RN2] rechaza citas en el pasado, incluido un inicio igual al instante actual', () => {
    e.reloj.fijar('2026-10-05', '09:30');
    assert.equal(reservar('2026-10-05', '09:00').codigo, 'pasado');
    assert.equal(reservar('2026-10-05', '09:30').codigo, 'pasado'); // estrictamente posterior a ahora
    assert.equal(reservar('2026-10-02', '10:00').codigo, 'pasado'); // un día anterior
    assert.equal(reservar('2026-10-05', '09:45').ok, true);
  });

  it('[US1-E8][RN3] rechaza citas fuera del horario de la clínica', () => {
    assert.equal(reservar('2026-10-05', '08:45').codigo, 'fuera_de_horario'); // antes de las 09:00
    assert.equal(reservar('2026-10-05', '19:30', { servicio: 'primera' }).codigo, 'fuera_de_horario'); // termina 20:30
    assert.equal(reservar('2026-10-05', '19:45').codigo, 'fuera_de_horario'); // termina 20:30
    assert.equal(reservar('2026-10-10', '10:00').codigo, 'fuera_de_horario'); // sábado
    assert.equal(reservar('2026-10-11', '10:00').codigo, 'fuera_de_horario'); // domingo
    assert.equal(e.contarCitas(), 0);
  });

  it('[US1-E9][RN3] una cita que termina exactamente a las 20:00 se acepta', () => {
    assert.equal(reservar('2026-10-05', '19:15').ok, true); // 19:15 + 45 min
    assert.equal(reservar('2026-10-06', '19:00', { servicio: 'primera' }).ok, true); // 19:00 + 60 min
  });

  it('[US1-E13][RN4] rechaza un inicio que no es múltiplo de 15 minutos y acepta uno que sí lo es', () => {
    assert.equal(reservar('2026-10-05', '10:07').codigo, 'hora_invalida');
    assert.equal(reservar('2026-10-05', '10:15').ok, true);
  });

  it('[US1-E12] la misma hora con profesionales distintos se acepta: el solape es por profesional', () => {
    assert.equal(reservar('2026-10-05', '10:00', { prof: 'maria' }).ok, true);
    assert.equal(reservar('2026-10-05', '10:00', { prof: 'jorge', paciente: e.pacientes[1] }).ok, true);
    assert.equal(reservar('2026-10-05', '10:00', { prof: 'lucia', servicio: 'consulta', paciente: e.pacientes[2] }).ok, true);
  });

  it('[FR-009] rechaza profesional, servicio o paciente de otra clínica o inexistentes', () => {
    const base = {
      clinicaId: e.clinicaId,
      profesionalId: e.profesionales.maria,
      servicioId: e.servicios.sesion,
      pacienteId: e.pacientes[0],
      inicio: en('2026-10-05', '10:00'),
    };
    for (const cambio of [
      { profesionalId: e.clinica2.profesional },
      { servicioId: e.clinica2.servicio },
      { pacienteId: e.clinica2.paciente },
      { profesionalId: 9999 },
    ]) {
      assert.equal(crearCita(e.db, { ...base, ...cambio }, e.ahora).codigo, 'no_encontrado');
    }
    assert.equal(e.contarCitas(), 0);
  });

  it('[FR-021] un alta sin datos obligatorios se rechaza indicando qué falta y no deja rastro', () => {
    const r = crearCita(e.db, { clinicaId: e.clinicaId }, e.ahora);
    assert.equal(r.codigo, 'datos');
    assert.deepEqual(Object.keys(r.errores).sort(), ['inicio', 'paciente', 'profesional', 'servicio']);
    assert.equal(e.contarCitas(), 0);
  });

  it('[FR-021] tras cualquier rechazo la tabla de citas queda idéntica', () => {
    reservar('2026-10-05', '10:00');
    const foto = JSON.stringify(e.db.prepare('SELECT * FROM cita ORDER BY id').all());
    reservar('2026-10-05', '10:30'); // ocupado
    reservar('2026-10-05', '10:07'); // hora inválida
    reservar('2026-10-02', '07:00'); // pasado
    reservar('2026-10-10', '10:00'); // sábado
    assert.equal(JSON.stringify(e.db.prepare('SELECT * FROM cita ORDER BY id').all()), foto);
  });
});
