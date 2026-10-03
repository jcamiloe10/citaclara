import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { crearEntorno, en, haySolapes } from '../ayudas/fixture.js';

const TRABAJADOR = fileURLToPath(new URL('./trabajador.js', import.meta.url));

/** Lanza un proceso hijo por operación; todos arrancan a la vez y se devuelven sus resultados. */
async function lanzarJuntos(e, operaciones) {
  const arranque = Date.now() + 1500 + operaciones.length * 40;
  const hijos = operaciones.map(
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
          (error, salida, errores) => (error ? rechazar(new Error(`${error.message}\n${errores}`)) : resolver(JSON.parse(salida))),
        );
      }),
  );
  return Promise.all(hijos);
}

describe('Altas simultáneas desde procesos distintos', () => {
  let e;
  beforeEach(() => {
    e = crearEntorno({ archivo: true });
  });
  afterEach(() => e.cerrar());

  const alta = (hora, { prof = 'jorge', servicio = 'sesion', paciente = 0, dia = '2026-10-05' } = {}) => ({
    operacion: 'alta',
    profesionalId: e.profesionales[prof],
    servicioId: e.servicios[servicio],
    pacienteId: e.pacientes[paciente],
    inicio: en(dia, hora).toISOString(),
  });

  it('[SC-001][FR-018][US1-E7][RN1] 20 procesos reservan el mismo hueco: exactamente 1 cita registrada', async () => {
    const resultados = await lanzarJuntos(e, Array.from({ length: 20 }, (_, i) => alta('10:00', { paciente: i % 3 })));
    const aceptadas = resultados.filter((r) => r.ok);
    const rechazadas = resultados.filter((r) => !r.ok);
    assert.equal(aceptadas.length, 1);
    assert.equal(rechazadas.length, 19);
    assert.ok(rechazadas.every((r) => r.codigo === 'ocupado'), JSON.stringify(rechazadas));
    assert.equal(e.contarCitas(), 1);
    assert.equal(haySolapes(e.db), false);
  });

  it('[FR-018][US1-E7][RN1] 20 procesos con intervalos parcialmente solapados: nunca queda un solape', async () => {
    // Inicios cada 15 minutos con 45 minutos de duración: cada uno pisa a sus vecinos.
    const horas = Array.from({ length: 20 }, (_, i) => {
      const min = 9 * 60 + i * 15;
      return `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;
    });
    const resultados = await lanzarJuntos(e, horas.map((h) => alta(h)));
    assert.ok(resultados.some((r) => r.ok));
    assert.ok(resultados.filter((r) => !r.ok).every((r) => r.codigo === 'ocupado' || r.codigo === 'fuera_de_horario'));
    assert.equal(haySolapes(e.db), false);
    assert.equal(e.contarCitas(), resultados.filter((r) => r.ok).length);
  });

  it('[US1-E12] altas simultáneas a la misma hora para profesionales distintos: todas aceptadas', async () => {
    const resultados = await lanzarJuntos(e, [
      alta('10:00', { prof: 'maria' }),
      alta('10:00', { prof: 'jorge', paciente: 1 }),
      alta('10:00', { prof: 'lucia', servicio: 'consulta', paciente: 2 }),
    ]);
    assert.ok(resultados.every((r) => r.ok), JSON.stringify(resultados));
    assert.equal(e.contarCitas(), 3);
    assert.equal(haySolapes(e.db), false);
  });
});
