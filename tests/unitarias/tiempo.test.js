import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  aInstanteUTC,
  aLocal,
  dentroDeHorario,
  esDiaLaborable,
  esMultiploDe15,
  formatoDiaLargo,
  formatoFechaHora,
  formatoRango,
  horasDeInicio,
  hoyMadrid,
  lunesDeLaSemana,
} from '../../src/domain/tiempo.js';

const en = (dia, hora) => aInstanteUTC(dia, hora);
const mas = (instante, min) => new Date(instante.getTime() + min * 60_000);

describe('Tiempo (hora de España)', () => {
  it('[FR-028] formatea fechas y horas en español sin ambigüedad', () => {
    assert.equal(formatoDiaLargo('2026-10-02'), 'viernes 2 de octubre de 2026');
    assert.equal(formatoFechaHora(en('2026-10-02', '10:00')), 'viernes 2 de octubre de 2026, 10:00');
    const inicio = en('2026-10-02', '10:00');
    assert.equal(formatoRango(inicio, mas(inicio, 45)), '10:00–10:45');
  });

  it('[RN3] respeta el horario de la clínica: lunes a viernes, de 09:00 a 20:00', () => {
    const cita = (dia, hora, min) => {
      const i = en(dia, hora);
      return dentroDeHorario(i, mas(i, min));
    };
    assert.equal(cita('2026-10-05', '09:00', 45), true); // lunes, justo a la apertura
    assert.equal(cita('2026-10-05', '08:45', 45), false); // empieza antes de abrir
    assert.equal(cita('2026-10-05', '19:15', 45), true); // termina exactamente a las 20:00
    assert.equal(cita('2026-10-05', '19:30', 60), false); // termina a las 20:30
    assert.equal(cita('2026-10-05', '19:30', 45), false); // termina a las 20:15
    assert.equal(cita('2026-10-09', '10:00', 45), true); // viernes
    assert.equal(cita('2026-10-03', '10:00', 45), false); // sábado
    assert.equal(cita('2026-10-04', '10:00', 45), false); // domingo
    assert.equal(esDiaLaborable('2026-10-05'), true);
    assert.equal(esDiaLaborable('2026-10-04'), false);
  });

  it('[RN4] solo admite inicios en múltiplos de 15 minutos', () => {
    for (const h of ['10:00', '10:15', '10:30', '10:45']) assert.equal(esMultiploDe15(en('2026-10-05', h)), true, h);
    for (const h of ['10:07', '10:01', '10:14', '10:59']) assert.equal(esMultiploDe15(en('2026-10-05', h)), false, h);
    assert.equal(esMultiploDe15(new Date(en('2026-10-05', '10:00').getTime() + 1000)), false);
    const horas = horasDeInicio();
    assert.equal(horas[0], '09:00');
    assert.equal(horas.at(-1), '19:45');
    assert.equal(horas.length, 44);
  });

  it('[RN3] convierte Madrid ↔ UTC en verano e invierno', () => {
    assert.equal(en('2026-07-15', '10:00').toISOString(), '2026-07-15T08:00:00.000Z'); // UTC+2
    assert.equal(en('2026-12-15', '10:00').toISOString(), '2026-12-15T09:00:00.000Z'); // UTC+1
    const l = aLocal(en('2026-07-15', '10:00'));
    assert.deepEqual([l.dia, l.hora, l.minuto], [15, 10, 0]);
  });

  it('[RN3] los días de cambio de hora (29 de marzo y 25 de octubre de 2026) no afectan a las citas laborables', () => {
    // Los cambios ocurren de madrugada del domingo: el horario laborable del lunes siguiente es inequívoco.
    assert.equal(en('2026-03-27', '10:00').toISOString(), '2026-03-27T09:00:00.000Z'); // viernes, invierno
    assert.equal(en('2026-03-30', '10:00').toISOString(), '2026-03-30T08:00:00.000Z'); // lunes, verano
    assert.equal(en('2026-10-23', '10:00').toISOString(), '2026-10-23T08:00:00.000Z'); // viernes, verano
    assert.equal(en('2026-10-26', '10:00').toISOString(), '2026-10-26T09:00:00.000Z'); // lunes, invierno
    // El día del cambio, la hora local sigue siendo coherente y un día dura 23 o 25 horas.
    const inicioMarzo = en('2026-03-29', '00:00');
    const finMarzo = en('2026-03-30', '00:00');
    assert.equal((finMarzo - inicioMarzo) / 3_600_000, 23);
    const inicioOctubre = en('2026-10-25', '00:00');
    const finOctubre = en('2026-10-26', '00:00');
    assert.equal((finOctubre - inicioOctubre) / 3_600_000, 25);
    // Una cita de 09:00 a 09:45 el lunes tras el cambio dura 45 minutos reales.
    const i = en('2026-03-30', '09:00');
    assert.equal(formatoRango(i, mas(i, 45)), '09:00–09:45');
  });

  it('[FR-028] calcula el día de España de un instante y el lunes de su semana', () => {
    // 23:30 UTC del 1 de octubre ya es 2 de octubre en España.
    assert.equal(hoyMadrid(new Date('2026-10-01T23:30:00Z')), '2026-10-02');
    assert.equal(lunesDeLaSemana('2026-10-02'), '2026-09-28');
    assert.equal(lunesDeLaSemana('2026-09-28'), '2026-09-28');
    assert.equal(lunesDeLaSemana('2026-10-04'), '2026-09-28');
  });

  it('[FR-021] rechaza formatos de día u hora no válidos', () => {
    assert.equal(aInstanteUTC('2026-02-30', '10:00'), null);
    assert.equal(aInstanteUTC('02/10/2026', '10:00'), null);
    assert.equal(aInstanteUTC('2026-10-02', '25:00'), null);
    assert.equal(aInstanteUTC('2026-10-02', ''), null);
  });
});
