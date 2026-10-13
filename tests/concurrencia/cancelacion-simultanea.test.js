import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { CLAUDIA, CLAUDIA_RUIZ, entornoConSemilla } from '../ayudas/portal.js';
import { haySolapes } from '../ayudas/fixture.js';
import { aInstanteUTC } from '../../src/domain/tiempo.js';

const TRABAJADOR = fileURLToPath(new URL('./trabajador-portal.js', import.meta.url));

/** Un proceso hijo por operación; todos arrancan a la vez y se devuelven sus resultados. */
async function lanzarJuntos(e, operaciones) {
  const arranque = Date.now() + 1500 + operaciones.length * 40;
  return Promise.all(
    operaciones.map(
      (op) =>
        new Promise((resolver, rechazar) => {
          const parametros = JSON.stringify({
            ruta: e.ruta,
            clinicaId: e.clinicaId,
            ahora: e.ahora().toISOString(),
            arranque,
            ...op,
          });
          execFile(
            process.execPath,
            ['--disable-warning=ExperimentalWarning', TRABAJADOR, parametros],
            { timeout: 60_000 },
            (error, salida, errores) =>
              error ? rechazar(new Error(`${error.message}\n${errores}`)) : resolver(JSON.parse(salida)),
          );
        }),
    ),
  );
}

describe('Cancelaciones del portal simultáneas, desde procesos distintos', () => {
  let e;
  beforeEach(() => {
    e = entornoConSemilla();
  });
  afterEach(() => e.cerrar());

  const cancelacion = (citaId, pacienteId = CLAUDIA) => ({ operacion: 'cancelar-paciente', citaId, pacienteId });
  const cuenta = (resultados, codigo) => resultados.filter((r) => (r.ok ? 'ok' : r.codigo) === codigo).length;
  const idDe = (tabla, nombre) => e.db.prepare(`SELECT id FROM ${tabla} WHERE nombre = ?`).get(nombre).id;

  it('[002:SC-005][002:FR-015] 20 cancelaciones simultáneas de la misma cita: exactamente 1 aplicada, el resto "no reservada"', async () => {
    const resultados = await lanzarJuntos(e, Array.from({ length: 20 }, () => cancelacion(798)));
    assert.equal(cuenta(resultados, 'ok'), 1);
    assert.equal(cuenta(resultados, 'no_reservada'), 19);
    assert.equal(e.estadoDe(798), 'cancelada');
    assert.equal(e.cita(798).cancelada_por_paciente, 1);
    assert.equal(e.db.prepare('SELECT COUNT(*) AS n FROM cita WHERE cancelada_por_paciente = 1').get().n, 1);
    assert.equal(haySolapes(e.db), false);
  });

  it('[002:FR-015] cancelación del paciente contra la cancelación de recepción sobre la misma cita: solo una gana', async () => {
    const operaciones = [
      ...Array.from({ length: 10 }, () => cancelacion(798)),
      ...Array.from({ length: 10 }, () => ({ operacion: 'estado', citaId: 798, estado: 'cancelada' })),
    ];
    const resultados = await lanzarJuntos(e, operaciones);
    assert.equal(cuenta(resultados, 'ok'), 1, 'exactamente una de las 20 operaciones se aplica');
    assert.equal(e.estadoDe(798), 'cancelada');
    const ganoElPaciente = resultados.slice(0, 10).some((r) => r.ok);
    assert.equal(e.cita(798).cancelada_por_paciente, ganoElPaciente ? 1 : 0, 'la marca de origen coincide con quien ganó');
    assert.ok(resultados.filter((r) => !r.ok).every((r) => r.codigo === 'no_reservada'));
  });

  it('[002:FR-014][002:SC-005] cancelación contra 20 altas de recepción sobre el hueco liberado y huecos parcialmente solapados: 0 solapes', async () => {
    const maria = idDe('profesional', 'María');
    const sesion = idDe('servicio', 'Sesión de fisioterapia');
    const alta = (hora) => ({
      operacion: 'alta',
      profesionalId: maria,
      servicioId: sesion,
      pacienteId: CLAUDIA_RUIZ,
      inicio: aInstanteUTC('2026-10-05', hora).toISOString(),
    });
    const horas = ['16:30', '16:15', '16:45', '16:30', '16:30', '16:15', '16:45', '16:30', '16:30', '16:30'];
    const operaciones = [cancelacion(798), ...horas.map(alta), ...horas.map(alta)];
    const resultados = await lanzarJuntos(e, operaciones);
    assert.equal(resultados[0].ok, true, 'la cancelación se aplica');
    const altas = resultados.slice(1);
    const aceptadas = altas.filter((r) => r.ok);
    assert.ok(aceptadas.length <= 1, `como mucho una alta ocupa el hueco (hubo ${aceptadas.length})`);
    for (const a of aceptadas) assert.equal(a.cita.inicio, aInstanteUTC('2026-10-05', '16:30').toISOString());
    assert.ok(altas.filter((r) => !r.ok).every((r) => r.codigo === 'ocupado'));
    assert.equal(haySolapes(e.db), false);
    assert.equal(e.estadoDe(798), 'cancelada');
  });

  it('[002:FR-014] cancelaciones de dos citas distintas de la misma paciente a la vez: ambas se aplican', async () => {
    const resultados = await lanzarJuntos(e, [cancelacion(798), cancelacion(839), cancelacion(798), cancelacion(839)]);
    assert.equal(cuenta(resultados, 'ok'), 2);
    assert.equal(e.estadoDe(798), 'cancelada');
    assert.equal(e.estadoDe(839), 'cancelada');
    assert.equal(haySolapes(e.db), false);
  });
});
