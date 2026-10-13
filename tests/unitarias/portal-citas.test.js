import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { citasDelPaciente } from '../../src/domain/portal.js';
import { CLAUDIA, CLAUDIA_RUIZ, entornoConSemilla } from '../ayudas/portal.js';
import { formatoFechaHora } from '../../src/domain/tiempo.js';

describe('Citas del paciente en el portal', () => {
  let e;
  before(() => {
    e = entornoConSemilla();
  });
  after(() => e.cerrar());

  const de = (pacienteId, opciones) =>
    citasDelPaciente(e.db, { pacienteId, clinicaId: e.clinicaId }, e.ahora, opciones);
  const resumen = (c) => `${formatoFechaHora(c.inicio)} · ${c.profesional} · ${c.servicio}`;

  it('[002:FR-006][002:US1-E1] Claudia tiene 10 próximas, por inicio ascendente, de la cita 805 a la 960', () => {
    const { proximas } = de(CLAUDIA);
    assert.equal(proximas.length, 10);
    assert.equal(proximas[0].id, 805);
    assert.equal(resumen(proximas[0]), 'lunes 5 de octubre de 2026, 09:00 · Lucía · Consulta de nutrición');
    assert.equal(proximas.at(-1).id, 960);
    assert.equal(resumen(proximas.at(-1)), 'jueves 15 de octubre de 2026, 17:45 · María · Sesión de fisioterapia');
    const inicios = proximas.map((c) => c.inicio.getTime());
    assert.deepEqual(inicios, [...inicios].sort((a, b) => a - b));
    assert.ok(proximas.every((c) => c.estado === 'reservada'));
  });

  it('[002:FR-006][002:FR-007][002:US1-E2] el historial tiene 29 citas, la más reciente primero (768) e incluye la cancelada 735', () => {
    const { historial, totalHistorial } = de(CLAUDIA, { limiteHistorial: 100 });
    assert.equal(totalHistorial, 29);
    assert.equal(historial.length, 29);
    assert.equal(historial[0].id, 768);
    assert.equal(resumen(historial[0]), 'viernes 25 de septiembre de 2026, 09:45 · María · Sesión de fisioterapia');
    assert.equal(historial[0].estado, 'completada');
    const cuenta = (estado) => historial.filter((c) => c.estado === estado).length;
    assert.deepEqual([cuenta('completada'), cuenta('cancelada'), cuenta('no_asistida')], [24, 3, 2]);
    const cancelada = historial.find((c) => c.id === 735);
    assert.equal(resumen(cancelada), 'miércoles 23 de septiembre de 2026, 11:00 · Jorge · Sesión de fisioterapia');
    assert.equal(cancelada.estado, 'cancelada');
    const inicios = historial.map((c) => c.inicio.getTime());
    assert.deepEqual(inicios, [...inicios].sort((a, b) => b - a));
  });

  it('[002:US1-E3] las dos citas del 15 de octubre (967 con Jorge y 960 con María) aparecen sin ocultar ninguna', () => {
    const ids = de(CLAUDIA).proximas.map((c) => c.id);
    assert.ok(ids.includes(967));
    assert.ok(ids.includes(960));
  });

  it('[002:FR-008] una cita cancelada con fecha futura va al historial y no a "Próximas"', () => {
    const fila = e.db.prepare("SELECT id FROM cita WHERE paciente_id = ? AND estado = 'reservada' ORDER BY inicio LIMIT 1").get(CLAUDIA);
    e.db.prepare("UPDATE cita SET estado = 'cancelada' WHERE id = ?").run(fila.id);
    try {
      const { proximas, historial } = de(CLAUDIA, { limiteHistorial: 100 });
      assert.ok(!proximas.some((c) => c.id === fila.id));
      assert.ok(historial.some((c) => c.id === fila.id && c.estado === 'cancelada'));
      assert.equal(proximas.length, 9);
    } finally {
      e.db.prepare("UPDATE cita SET estado = 'reservada' WHERE id = ?").run(fila.id);
    }
  });

  it('[002:FR-006] una cita reservada cuya hora de inicio ya pasó va al historial y no se puede cancelar', () => {
    const fila = e.db.prepare("SELECT id FROM cita WHERE paciente_id = ? AND estado = 'reservada' ORDER BY inicio LIMIT 1").get(CLAUDIA);
    const despues = () => new Date(e.ahora().getTime() + 30 * 24 * 3600 * 1000);
    const { proximas, historial } = citasDelPaciente(e.db, { pacienteId: CLAUDIA, clinicaId: e.clinicaId }, despues, {
      limiteHistorial: 100,
    });
    assert.ok(!proximas.some((c) => c.id === fila.id));
    assert.ok(historial.some((c) => c.id === fila.id && c.estado === 'reservada'));
  });

  it('[002:FR-002][002:US1-E4] nunca incluye citas de otras fichas con el mismo nombre de pila', () => {
    const suyas = new Set(
      e.db.prepare('SELECT id FROM cita WHERE paciente_id = ?').all(CLAUDIA).map((c) => c.id),
    );
    for (const otra of [CLAUDIA_RUIZ, 26]) {
      const { proximas, historial } = de(otra, { limiteHistorial: 100 });
      assert.ok(proximas.length > 0);
      for (const c of [...proximas, ...historial]) assert.ok(!suyas.has(c.id));
    }
    const todas = de(CLAUDIA, { limiteHistorial: 100 });
    assert.equal(todas.proximas.length + todas.historial.length, 39);
  });

  it('[002:FR-002] acotado por clínica: la ficha de Claudia con otra clínica no devuelve nada', () => {
    const otra = e.crearOtraClinica();
    const r = citasDelPaciente(e.db, { pacienteId: CLAUDIA, clinicaId: otra.clinicaId }, e.ahora);
    assert.deepEqual([r.proximas.length, r.historial.length], [0, 0]);
  });

  it('[002:FR-010][002:US1-E5] un paciente sin citas devuelve dos listas vacías', () => {
    const { lastInsertRowid } = e.db
      .prepare('INSERT INTO paciente (clinica_id, nombre, telefono, email) VALUES (?, ?, ?, ?)')
      .run(e.clinicaId, 'Sin Citas', '611111111', 'sin@ejemplo.es');
    const r = de(Number(lastInsertRowid));
    assert.deepEqual([r.proximas.length, r.historial.length, r.hayMas], [0, 0, false]);
  });

  it('[002:FR-007] el historial de 10 en 10 recorre las 29 citas sin repetir ni saltar ninguna', () => {
    const vistas = [];
    for (const limite of [10, 20, 30]) {
      const r = de(CLAUDIA, { limiteHistorial: limite });
      assert.equal(r.historial.length, Math.min(limite, 29));
      assert.equal(r.hayMas, limite < 29);
      vistas.push(r.historial.map((c) => c.id));
    }
    assert.deepEqual(vistas[1].slice(0, 10), vistas[0]);
    assert.equal(new Set(vistas[2]).size, 29);
    assert.deepEqual(vistas[2].slice(0, 20), vistas[1]);
  });
});
