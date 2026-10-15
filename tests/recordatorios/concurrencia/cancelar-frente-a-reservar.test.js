import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { aInstanteUTC } from '../../../src/domain/tiempo.js';
import { crearCarpetaSalida, crearEntorno, crearReloj, haySolapes } from '../../ayudas/fixture.js';
import { citaA, generar, secretoDeCita } from '../ayudas.js';
import { lanzarJuntos } from './lanzar.js';

// Principio III: cancelar desde el enlace solo libera hueco; nunca puede crear un solape, tampoco
// mientras otros procesos reservan ese mismo hueco o huecos que lo pisan.
describe('Cancelación por enlace y altas simultáneas, desde procesos distintos', () => {
  let e;
  let carpeta;
  let citaId;
  let secreto;
  beforeEach(() => {
    e = crearEntorno({ archivo: true, reloj: crearReloj('2026-10-04', '07:00') });
    carpeta = crearCarpetaSalida();
    citaId = citaA(e, '2026-10-05', '10:00');
    generar(e, carpeta);
    secreto = secretoDeCita(e, carpeta, citaId);
  });
  afterEach(() => {
    e.cerrar();
    carpeta.limpiar();
  });

  const cuenta = (resultados, codigo) => resultados.filter((r) => r.codigo === codigo).length;
  const alta = (hora, paciente) => ({
    operacion: 'alta',
    profesionalId: e.profesionales.maria,
    servicioId: e.servicios.sesion,
    pacienteId: paciente,
    inicio: aInstanteUTC('2026-10-05', hora).toISOString(),
  });
  const cancelacion = () => ({ operacion: 'cancelar-enlace', secreto });

  it('[003:US2-E8][003:FR-014][003:SC-004] 20 procesos cancelan por enlace y reservan el mismo hueco y huecos que lo pisan: 0 solapes y resultado consistente', async () => {
    const operaciones = [
      ...Array.from({ length: 6 }, cancelacion),
      ...Array.from({ length: 6 }, () => alta('10:00', e.pacientes[1])),
      ...Array.from({ length: 4 }, () => alta('10:15', e.pacientes[2])),
      ...Array.from({ length: 4 }, () => alta('09:45', e.pacientes[2])),
    ];
    const resultados = await lanzarJuntos(e, operaciones);
    assert.ok(resultados.every((r) => !r.error), JSON.stringify(resultados.filter((r) => r.error)));

    const cancelaciones = resultados.slice(0, 6);
    assert.equal(cuenta(cancelaciones, 'cancelada'), 1, 'exactamente una cancelación se aplica');
    assert.equal(cuenta(cancelaciones, 'ya_cancelada'), 5);
    assert.equal(e.db.prepare('SELECT estado, cancelada_por_paciente AS p FROM cita WHERE id = ?').get(citaId).estado, 'cancelada');
    assert.equal(haySolapes(e.db), false, 'nunca hay dos citas reservadas o completadas solapadas');

    // Las altas aceptadas son compatibles entre sí: como mucho una de las que se pisan.
    const aceptadas = resultados.slice(6).filter((r) => r.ok);
    assert.ok(aceptadas.length <= 1, `solo una alta puede ocupar el hueco liberado (${aceptadas.length})`);
    const activas = e.db
      .prepare("SELECT COUNT(*) AS n FROM cita WHERE profesional_id = ? AND estado IN ('reservada', 'completada')")
      .get(e.profesionales.maria).n;
    assert.equal(activas, aceptadas.length);
  });

  it('[003:FR-013][003:SC-004] 20 confirmaciones simultáneas del mismo enlace: la cita queda cancelada una sola vez', async () => {
    const resultados = await lanzarJuntos(e, Array.from({ length: 20 }, cancelacion));
    assert.equal(cuenta(resultados, 'cancelada'), 1);
    assert.equal(cuenta(resultados, 'ya_cancelada'), 19);
    assert.equal(e.db.prepare('SELECT COUNT(*) AS n FROM cita WHERE cancelada_por_paciente = 1').get().n, 1);
    assert.equal(haySolapes(e.db), false);
  });

  it('[003:US2-E8][003:FR-014] cancelación por enlace frente a cancelación de recepción de la misma cita: solo una gana y el origen coincide con quien ganó', async () => {
    const operaciones = [
      ...Array.from({ length: 10 }, cancelacion),
      ...Array.from({ length: 10 }, () => ({ operacion: 'estado', citaId, estado: 'cancelada' })),
    ];
    const resultados = await lanzarJuntos(e, operaciones);
    assert.ok(resultados.every((r) => !r.error), JSON.stringify(resultados.filter((r) => r.error)));
    assert.equal(resultados.filter((r) => r.ok).length, 1, 'exactamente una de las 20 operaciones se aplica');
    const ganoElEnlace = resultados.slice(0, 10).some((r) => r.ok);
    const fila = e.db.prepare('SELECT estado, cancelada_por_paciente AS p FROM cita WHERE id = ?').get(citaId);
    assert.equal(fila.estado, 'cancelada');
    assert.equal(fila.p, ganoElEnlace ? 1 : 0);
    assert.equal(haySolapes(e.db), false);
  });
});
