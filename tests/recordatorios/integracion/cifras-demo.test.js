import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBase } from '../../../src/db/connection.js';
import { cargarSemilla } from '../../../src/seed/seed.js';
import { aInstanteUTC } from '../../../src/domain/tiempo.js';
import { crearCarpetaSalida } from '../../ayudas/fixture.js';
import { ficheros, generar } from '../ayudas.js';

// Cifras de la guía de validación (quickstart.md) con la semilla y la ancla del lunes 2026-10-12:
// las reservas van del lunes 19 al viernes 30 de octubre de 2026.
const ANCLA = '2026-10-12';

describe('Recordatorios con los datos de demostración', () => {
  let db;
  let carpeta;
  beforeEach(() => {
    db = abrirBase(':memory:');
    cargarSemilla(db, { ancla: ANCLA });
    carpeta = crearCarpetaSalida();
  });
  afterEach(() => {
    db.close();
    carpeta.limpiar();
  });

  const entorno = (dia, hora) => {
    const t = aInstanteUTC(dia, hora);
    return { db, ahora: () => t };
  };

  for (const [dia, hora, esperados] of [
    ['2026-10-18', '12:00', 18],
    ['2026-10-19', '12:00', 19],
    ['2026-10-22', '10:00', 21],
    ['2026-10-23', '12:00', 0],
  ]) {
    it(`[003:SC-001] con la semilla y el instante ${dia} ${hora} salen exactamente ${esperados} recordatorios, uno por cita reservada de la ventana`, () => {
      const e = entorno(dia, hora);
      const r = generar(e, carpeta);
      assert.equal(r.generados, esperados);
      assert.equal(r.sinEmail, 0);
      assert.equal(ficheros(carpeta).length, esperados);
      assert.equal(db.prepare('SELECT COUNT(*) AS n FROM recordatorio').get().n, esperados);
      // Cada recordatorio es de una cita reservada que cae dentro de la ventana de 24 a 48 horas.
      const t = e.ahora().getTime();
      const fuera = db
        .prepare(
          `SELECT COUNT(*) AS n FROM recordatorio r JOIN cita c ON c.id = r.cita_id
           WHERE c.estado <> 'reservada' OR c.inicio < ? OR c.inicio >= ?`,
        )
        .get(new Date(t + 24 * 3_600_000).toISOString(), new Date(t + 48 * 3_600_000).toISOString()).n;
      assert.equal(fuera, 0);
    });
  }

  it('[003:SC-002] ejecutar el proceso 10 veces seguidas deja exactamente un recordatorio por cita', () => {
    const e = entorno('2026-10-18', '12:00');
    const total = [];
    for (let i = 0; i < 10; i += 1) total.push(generar(e, carpeta).generados);
    assert.deepEqual(total, [18, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
    const { filas, citas } = db
      .prepare('SELECT COUNT(*) AS filas, COUNT(DISTINCT cita_id) AS citas FROM recordatorio')
      .get();
    assert.equal(filas, 18);
    assert.equal(citas, 18);
    assert.equal(ficheros(carpeta).length, 18);
  });
});
