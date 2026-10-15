import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cancelarComoPaciente } from '../../../src/domain/portal.js';
import { cancelarPorEnlace, consultarEnlace } from '../../../src/domain/recordatorios.js';
import { nuevoSecreto } from '../../../src/domain/enlaces.js';
import { crearCarpetaSalida, crearEntorno, crearReloj } from '../../ayudas/fixture.js';
import { citaA, generar, secretoDeCita } from '../ayudas.js';

// El proceso se ejecuta el domingo 4 de octubre de 2026 a las 07:00; la cita es el lunes 5 a las 10:00 (27 h).
describe('Cancelación desde el enlace del recordatorio (dominio)', () => {
  let e;
  let carpeta;
  let citaId;
  let secreto;
  beforeEach(() => {
    e = crearEntorno({ reloj: crearReloj('2026-10-04', '07:00') });
    carpeta = crearCarpetaSalida();
    citaId = citaA(e, '2026-10-05', '10:00');
    generar(e, carpeta);
    secreto = secretoDeCita(e, carpeta, citaId);
  });
  afterEach(() => {
    e.cerrar();
    carpeta.limpiar();
  });

  const cita = () => e.db.prepare('SELECT estado, cancelada_por_paciente AS porPaciente, inicio FROM cita WHERE id = ?').get(citaId);
  const cancelar = () => cancelarPorEnlace(e.db, secreto, e.ahora);

  it('[003:US2-E1][003:FR-011] con margen, la cita reservada pasa a cancelada con origen "paciente"', () => {
    const r = cancelar();
    assert.equal(r.ok, true);
    assert.equal(r.codigo, 'cancelada');
    assert.deepEqual({ ...cita() }, { estado: 'cancelada', porPaciente: 1, inicio: cita().inicio });
    assert.equal(r.clinica.nombre, 'Clínica Eleva');
  });

  it('[003:US2-E2][003:FR-013] repetir la cancelación devuelve ya_cancelada sin cambios', () => {
    cancelar();
    const despues = { ...cita() };
    const r = cancelar();
    assert.equal(r.ok, false);
    assert.equal(r.codigo, 'ya_cancelada');
    assert.deepEqual({ ...cita() }, despues);
    assert.equal(consultarEnlace(e.db, secreto, e.ahora).situacion, 'ya_cancelada');
  });

  it('[003:US2-E3][003:FR-011] una cita completada o no asistida no cambia: no_reservada', () => {
    for (const estado of ['completada', 'no_asistida']) {
      e.db.prepare('UPDATE cita SET estado = ? WHERE id = ?').run(estado, citaId);
      const r = cancelar();
      assert.equal(r.codigo, 'no_reservada');
      assert.equal(cita().estado, estado);
      assert.equal(consultarEnlace(e.db, secreto, e.ahora).situacion, 'no_reservada');
    }
  });

  it('[003:US2-E3][003:FR-017] una cita cancelada por recepción no se toca y el enlace informa de que ya está cancelada', () => {
    e.db.prepare("UPDATE cita SET estado = 'cancelada' WHERE id = ?").run(citaId);
    const r = cancelar();
    assert.equal(r.codigo, 'ya_cancelada');
    assert.equal(cita().porPaciente, 0, 'el origen sigue siendo recepción');
  });

  it('[003:US2-E5][003:FR-012] a 23 h 59 min del inicio no se puede cancelar: sin_margen y la cita no cambia', () => {
    e.reloj.fijar('2026-10-04', '10:01');
    assert.equal(consultarEnlace(e.db, secreto, e.ahora).situacion, 'sin_margen');
    const r = cancelar();
    assert.equal(r.codigo, 'sin_margen');
    assert.equal(r.clinica.nombre, 'Clínica Eleva');
    assert.equal(cita().estado, 'reservada');
  });

  it('[003:US2-E6][003:FR-012] a exactamente 24 h del inicio sí se puede cancelar (límite inclusivo)', () => {
    e.reloj.fijar('2026-10-04', '10:00');
    assert.equal(consultarEnlace(e.db, secreto, e.ahora).situacion, 'puede_cancelar');
    assert.equal(cancelar().codigo, 'cancelada');
    assert.equal(cita().estado, 'cancelada');
  });

  it('[003:FR-012] una cita que ya ha empezado no se puede cancelar desde el enlace', () => {
    e.reloj.fijar('2026-10-05', '10:30');
    assert.equal(cancelar().codigo, 'sin_margen');
    assert.equal(cita().estado, 'reservada');
  });

  it('[003:FR-017] si la cita cambia de hora, el enlace del recordatorio anterior deja de valer', () => {
    e.db.prepare("UPDATE cita SET inicio = '2026-10-06T08:00:00.000Z', fin = '2026-10-06T08:45:00.000Z' WHERE id = ?").run(citaId);
    assert.deepEqual(consultarEnlace(e.db, secreto, e.ahora), { ok: false, codigo: 'no_valido' });
    assert.deepEqual(cancelar(), { ok: false, codigo: 'no_valido' });
    assert.equal(cita().estado, 'reservada');
  });

  it('[003:US2-E4][003:FR-015] un secreto desconocido, mal formado o alterado no devuelve datos ni cancela nada', () => {
    const alterado = `${secreto.slice(0, -1)}${secreto.endsWith('A') ? 'B' : 'A'}`;
    for (const malo of [nuevoSecreto(), alterado, '', 'corto', 'a'.repeat(44), null, undefined, 42]) {
      assert.deepEqual(consultarEnlace(e.db, malo, e.ahora), { ok: false, codigo: 'no_valido' });
      assert.deepEqual(cancelarPorEnlace(e.db, malo, e.ahora), { ok: false, codigo: 'no_valido' });
    }
    assert.equal(cita().estado, 'reservada');
  });

  it('[003:US2-E4][003:FR-015] el recordatorio fallido o sin email no tiene enlace que valga', () => {
    e.db.prepare("UPDATE paciente SET email = 'sin-correo' WHERE id = ?").run(e.pacientes[1]);
    const otra = citaA(e, '2026-10-05', '11:00', { paciente: e.pacientes[1] });
    generar(e, carpeta);
    const fila = e.db.prepare('SELECT resultado, token_huella FROM recordatorio WHERE cita_id = ?').get(otra);
    assert.equal(fila.resultado, 'sin_email');
    assert.equal(fila.token_huella, null);
  });

  it('[003:FR-011] cancelar por el enlace y desde el portal de la 002 da el mismo resultado (una única regla)', () => {
    const otra = citaA(e, '2026-10-05', '11:00', { paciente: e.pacientes[1] });
    cancelar();
    const r = cancelarComoPaciente(e.db, { pacienteId: e.pacientes[1], clinicaId: e.clinicaId, citaId: otra }, e.ahora);
    assert.equal(r.ok, true);
    const filas = e.db
      .prepare('SELECT estado, cancelada_por_paciente AS p FROM cita WHERE id IN (?, ?) ORDER BY id')
      .all(citaId, otra);
    assert.deepEqual(filas.map((f) => ({ ...f })), [
      { estado: 'cancelada', p: 1 },
      { estado: 'cancelada', p: 1 },
    ]);
  });

  it('[003:US2-E4][003:SC-005] el secreto no se guarda en la base: solo su huella', () => {
    const volcado = JSON.stringify(e.db.prepare('SELECT * FROM recordatorio').all());
    assert.ok(!volcado.includes(secreto));
  });
});
