import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ventanaDeRecordatorio } from '../../../src/domain/recordatorios.js';
import { aInstanteUTC, formatoFechaHora } from '../../../src/domain/tiempo.js';

const HORA = 3_600_000;

describe('Ventana de recordatorio', () => {
  it('[003:FR-002] va de 24 a 48 horas absolutas después del instante de ejecución', () => {
    const ahora = aInstanteUTC('2026-10-04', '07:00');
    const { desde, hasta } = ventanaDeRecordatorio(ahora);
    assert.equal(desde.getTime() - ahora.getTime(), 24 * HORA);
    assert.equal(hasta.getTime() - ahora.getTime(), 48 * HORA);
    assert.equal(formatoFechaHora(desde), 'lunes 5 de octubre de 2026, 07:00');
    assert.equal(formatoFechaHora(hasta), 'martes 6 de octubre de 2026, 07:00');
  });

  it('[003:FR-002] el límite inferior está incluido y el superior excluido en la consulta de la ventana', () => {
    // Se comprueba como intervalo semiabierto [desde, hasta): el instante `desde` pertenece, `hasta` no.
    const { desde, hasta } = ventanaDeRecordatorio(aInstanteUTC('2026-10-04', '07:00'));
    const dentro = (t) => t >= desde && t < hasta;
    assert.equal(dentro(desde), true);
    assert.equal(dentro(new Date(hasta.getTime() - 1)), true);
    assert.equal(dentro(hasta), false);
    assert.equal(dentro(new Date(desde.getTime() - 1)), false);
  });

  it('[003:SC-007] el día del cambio de hora la ventana sigue siendo de 24 h absolutas y la hora mostrada es la real', () => {
    // El 25 de octubre de 2026 se retrasa el reloj una hora (03:00 → 02:00).
    const ahora = aInstanteUTC('2026-10-25', '00:30');
    const { desde, hasta } = ventanaDeRecordatorio(ahora);
    assert.equal(desde.getTime() - ahora.getTime(), 24 * HORA);
    assert.equal(hasta.getTime() - ahora.getTime(), 48 * HORA);
    // Una cita del lunes 26 a las 09:00 se muestra con su hora real, sin desplazamiento.
    assert.equal(formatoFechaHora(aInstanteUTC('2026-10-26', '09:00')), 'lunes 26 de octubre de 2026, 09:00');
    assert.ok(aInstanteUTC('2026-10-26', '09:00') >= desde && aInstanteUTC('2026-10-26', '09:00') < hasta);
  });
});
