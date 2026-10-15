import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearCarpetaSalida, crearEntorno, crearReloj } from '../../ayudas/fixture.js';
import { citaA, ficheros } from '../ayudas.js';
import { lanzarJuntos } from './lanzar.js';

describe('Ejecuciones simultáneas del proceso diario, desde procesos distintos', () => {
  let e;
  let carpeta;
  beforeEach(() => {
    e = crearEntorno({ archivo: true, reloj: crearReloj('2026-10-04', '07:00') });
    carpeta = crearCarpetaSalida();
  });
  afterEach(() => {
    e.cerrar();
    carpeta.limpiar();
  });

  it('[003:FR-004][003:SC-002] 20 ejecuciones a la vez: una fila y un fichero por cita, ningún error y 0 duplicados', async () => {
    const ids = [
      citaA(e, '2026-10-05', '09:00', { paciente: e.pacientes[0] }),
      citaA(e, '2026-10-05', '10:00', { paciente: e.pacientes[1] }),
      citaA(e, '2026-10-05', '11:00', { paciente: e.pacientes[2] }),
      citaA(e, '2026-10-05', '09:00', { paciente: e.pacientes[1], profesional: e.profesionales.jorge }),
      citaA(e, '2026-10-05', '10:00', { paciente: e.pacientes[2], profesional: e.profesionales.jorge }),
    ];
    const resultados = await lanzarJuntos(
      e,
      Array.from({ length: 20 }, () => ({ operacion: 'generar' })),
      { carpeta: carpeta.ruta },
    );
    assert.ok(resultados.every((r) => !r.error), JSON.stringify(resultados.filter((r) => r.error)));
    assert.equal(resultados.reduce((suma, r) => suma + r.generados, 0), ids.length, 'cada cita se genera una sola vez');
    const filas = e.db.prepare('SELECT cita_id, COUNT(*) AS n FROM recordatorio GROUP BY cita_id').all();
    assert.equal(filas.length, ids.length);
    assert.ok(filas.every((f) => f.n === 1));
    assert.equal(ficheros(carpeta).length, ids.length);
    assert.equal(e.db.prepare('SELECT COUNT(DISTINCT token_huella) AS n FROM recordatorio').get().n, ids.length);
  });
});
