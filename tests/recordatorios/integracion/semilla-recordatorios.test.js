import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBase } from '../../../src/db/connection.js';
import { cargarSemilla } from '../../../src/seed/seed.js';

const ANCLA = '2026-10-12';

describe('Datos de demostración con recordatorios (003)', () => {
  it('[003:SC-001] recargar la semilla con recordatorios existentes no falla, y los recuentos de la 001 se mantienen', () => {
    const db = abrirBase(':memory:');
    const primera = cargarSemilla(db, { ancla: ANCLA });
    const cita = db.prepare("SELECT id, inicio FROM cita WHERE estado = 'reservada' ORDER BY id LIMIT 1").get();
    db.prepare(
      `INSERT INTO recordatorio (clinica_id, cita_id, inicio_cita, resultado, generado_en)
       VALUES (?, ?, ?, 'sin_email', ?)`,
    ).run(primera.clinicaId, cita.id, cita.inicio, '2026-10-18T10:00:00.000Z');

    cargarSemilla(db, { ancla: ANCLA });

    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM recordatorio').get().n, 0);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM cita').get().n, 996);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM cita WHERE estado = 'reservada'").get().n, 203);
  });

  it('[003:SC-001] la clínica de demostración tiene teléfono de contacto (lo aporta la 002)', () => {
    const db = abrirBase(':memory:');
    const { clinicaId } = cargarSemilla(db, { ancla: ANCLA });
    const { telefono } = db.prepare('SELECT telefono FROM clinica WHERE id = ?').get(clinicaId);
    assert.match(telefono, /^[6-9]\d{8}$/);
  });
});
