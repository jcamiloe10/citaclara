import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, en } from '../ayudas/fixture.js';

// Segunda defensa del Principio III: la base rechaza el solape aunque se salte el servicio de reservas.
describe('Disparador anti-solape de la base de datos', () => {
  let e;
  beforeEach(() => {
    e = crearEntorno();
  });
  afterEach(() => e.cerrar());

  const insertar = (hora, minutos, estado = 'reservada', prof = e.profesionales.maria, dia = '2026-10-05') =>
    e.insertarCita({
      profesional: prof,
      servicio: e.servicios.sesion,
      inicio: en(dia, hora),
      fin: new Date(en(dia, hora).getTime() + minutos * 60_000),
      estado,
    });

  it('[RN1][FR-016] un INSERT directo que solapa es rechazado', () => {
    insertar('10:00', 45);
    assert.throws(() => insertar('10:30', 45), /solape/);
    assert.throws(() => insertar('10:00', 45, 'completada'), /solape/);
    assert.equal(e.contarCitas(), 1);
  });

  it('[RN1][FR-016] un UPDATE de horario que crearía solape es rechazado', () => {
    insertar('10:00', 45);
    const id = insertar('11:00', 45);
    assert.throws(
      () =>
        e.db
          .prepare('UPDATE cita SET inicio = ?, fin = ? WHERE id = ?')
          .run(en('2026-10-05', '10:15').toISOString(), en('2026-10-05', '11:00').toISOString(), id),
      /solape/,
    );
  });

  it('[RN1][FR-019] volver a reservar o completar una cita cuyo hueco ya fue ocupado es rechazado', () => {
    const cancelada = insertar('10:00', 45, 'cancelada');
    insertar('10:00', 45); // otra cita reservada ocupa el hueco
    for (const estado of ['reservada', 'completada']) {
      assert.throws(() => e.db.prepare('UPDATE cita SET estado = ? WHERE id = ?').run(estado, cancelada), /solape/);
    }
  });

  it('[FR-017][RN1] las adyacentes, otros profesionales y los estados que liberan hueco no disparan', () => {
    insertar('10:00', 45);
    assert.doesNotThrow(() => insertar('10:45', 45)); // empieza al terminar la anterior
    assert.doesNotThrow(() => insertar('09:15', 45)); // termina al empezar la primera
    assert.doesNotThrow(() => insertar('10:00', 45, 'reservada', e.profesionales.jorge));
    assert.doesNotThrow(() => insertar('10:15', 45, 'cancelada'));
    assert.doesNotThrow(() => insertar('10:15', 45, 'no_asistida'));
  });
});
