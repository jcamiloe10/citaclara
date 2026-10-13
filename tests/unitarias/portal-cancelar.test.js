import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cancelarComoPaciente, citasDelPaciente } from '../../src/domain/portal.js';
import { aInstanteUTC } from '../../src/domain/tiempo.js';
import { crearReloj } from '../ayudas/fixture.js';
import { CLAUDIA, CLAUDIA_RUIZ, entornoConSemilla } from '../ayudas/portal.js';

describe('Cancelación de una cita desde el portal', () => {
  let e;
  beforeEach(() => {
    e = entornoConSemilla();
  });
  afterEach(() => e.cerrar());

  const cancelar = (citaId, { pacienteId = CLAUDIA, clinicaId = e.clinicaId } = {}) =>
    cancelarComoPaciente(e.db, { pacienteId, clinicaId, citaId }, e.ahora);

  it('[002:FR-013][002:US2-E1] cancelar la 798 la deja cancelada por el paciente y la saca de "Próximas"', () => {
    const r = cancelar(798);
    assert.equal(r.ok, true);
    assert.equal(r.cita.estado, 'cancelada');
    const fila = e.cita(798);
    assert.equal(fila.estado, 'cancelada');
    assert.equal(fila.cancelada_por_paciente, 1);
    const { proximas } = citasDelPaciente(e.db, { pacienteId: CLAUDIA, clinicaId: e.clinicaId }, e.ahora);
    assert.ok(!proximas.some((c) => c.id === 798));
    assert.equal(proximas.length, 9);
  });

  it('[002:FR-011][002:US2-E4] con ahora = domingo 4 de octubre 10:00, la 805 (23 h) se rechaza y la 798 (30 h 30 min) se acepta', () => {
    e.reloj.fijar('2026-10-04', '10:00');
    const rechazo = cancelar(805);
    assert.deepEqual(rechazo, { ok: false, codigo: 'fuera_de_plazo' });
    assert.equal(e.estadoDe(805), 'reservada');
    assert.equal(e.cita(805).cancelada_por_paciente, 0);
    assert.equal(cancelar(798).ok, true);
  });

  it('[002:FR-011] límite inclusivo: exactamente 24 h antes se acepta y 24 h menos un minuto se rechaza', () => {
    e.reloj.fijar('2026-10-04', '09:00'); // la 805 empieza el lunes 5 a las 09:00
    assert.equal(cancelar(805).ok, true);
    e.reloj.fijar('2026-10-06', '09:46'); // la 839 empieza el miércoles 7 a las 09:45: 23 h 59 min antes
    assert.deepEqual(cancelar(839), { ok: false, codigo: 'fuera_de_plazo' });
    e.reloj.fijar('2026-10-06', '09:45'); // exactamente 24 h
    assert.equal(cancelar(839).ok, true);
  });

  it('[002:FR-011] el plazo se mide en tiempo real transcurrido, también al cambiar la hora (25 de octubre de 2026)', () => {
    const maria = e.db.prepare("SELECT id FROM profesional WHERE nombre = 'María'").get().id;
    const servicio = e.db.prepare("SELECT id FROM servicio WHERE nombre = 'Sesión de fisioterapia'").get().id;
    const insertar = (inicio, fin) =>
      Number(
        e.db
          .prepare(
            "INSERT INTO cita (clinica_id, profesional_id, servicio_id, paciente_id, inicio, fin, estado) VALUES (?, ?, ?, ?, ?, ?, 'reservada')",
          )
          .run(e.clinicaId, maria, servicio, CLAUDIA, inicio.toISOString(), fin.toISOString()).lastInsertRowid,
      );
    const inicio = aInstanteUTC('2026-10-26', '09:00');
    const citaId = insertar(inicio, new Date(inicio.getTime() + 45 * 60_000));
    e.reloj.fijar('2026-10-25', '09:30'); // domingo, 23,5 h reales antes (ya en horario de invierno)
    assert.deepEqual(cancelar(citaId), { ok: false, codigo: 'fuera_de_plazo' });
    e.reloj.fijar('2026-10-24', '09:00'); // sábado 09:00 (verano) → lunes 09:00 (invierno): 49 h reales
    assert.equal(cancelar(citaId).ok, true);
  });

  it('[002:US2-E5] una cita completada, cancelada o no asistida no se puede cancelar y no cambia', () => {
    const casos = [
      [768, 'completada'],
      [735, 'cancelada'],
      [441, 'no_asistida'],
    ];
    for (const [id, estado] of casos) {
      const r = cancelar(id);
      assert.deepEqual(r, { ok: false, codigo: 'no_reservada', estado });
      assert.equal(e.estadoDe(id), estado);
    }
    assert.equal(e.cita(735).cancelada_por_paciente, 0);
  });

  it('[002:FR-002] una cita de otro paciente, de otra clínica o inexistente devuelve no_encontrada y no cambia', () => {
    assert.deepEqual(cancelar(805, { pacienteId: CLAUDIA_RUIZ }), { ok: false, codigo: 'no_encontrada' });
    const otra = e.crearOtraClinica();
    assert.deepEqual(cancelar(805, { pacienteId: otra.pacienteId, clinicaId: otra.clinicaId }), {
      ok: false,
      codigo: 'no_encontrada',
    });
    assert.deepEqual(cancelar(805, { clinicaId: otra.clinicaId }), { ok: false, codigo: 'no_encontrada' });
    assert.deepEqual(cancelar(999_999), { ok: false, codigo: 'no_encontrada' });
    assert.equal(e.estadoDe(805), 'reservada');
  });

  it('[002:FR-013] el portal solo cambia el estado y la marca: horario, profesional y servicio quedan igual', () => {
    const antes = e.cita(798);
    cancelar(798);
    const despues = e.cita(798);
    for (const campo of ['inicio', 'fin', 'profesional_id', 'servicio_id', 'paciente_id', 'clinica_id']) {
      assert.equal(despues[campo], antes[campo]);
    }
    assert.equal(
      e.db.prepare("SELECT COUNT(*) AS n FROM cita WHERE cancelada_por_paciente = 1").get().n,
      1,
    );
  });

  it('[002:FR-015][002:US2-E6] cancelar dos veces seguidas: la primera ok, la segunda no_reservada', () => {
    assert.equal(cancelar(798).ok, true);
    assert.deepEqual(cancelar(798), { ok: false, codigo: 'no_reservada', estado: 'cancelada' });
    assert.equal(e.estadoDe(798), 'cancelada');
  });

  it('[002:FR-014] el hueco liberado se puede volver a reservar y la cancelación nunca crea un solape', () => {
    const antes = e.cita(798);
    cancelar(798);
    // Un alta directa en el mismo hueco de María: el disparador de la 001 no la rechaza porque quedó libre.
    assert.doesNotThrow(() =>
      e.db
        .prepare(
          "INSERT INTO cita (clinica_id, profesional_id, servicio_id, paciente_id, inicio, fin, estado) VALUES (?, ?, ?, ?, ?, ?, 'reservada')",
        )
        .run(e.clinicaId, antes.profesional_id, antes.servicio_id, CLAUDIA_RUIZ, antes.inicio, antes.fin),
    );
    const solapes = e.db
      .prepare(
        `SELECT COUNT(*) AS n FROM cita a JOIN cita b ON a.profesional_id = b.profesional_id AND a.id < b.id
         AND a.estado IN ('reservada','completada') AND b.estado IN ('reservada','completada')
         AND a.inicio < b.fin AND b.inicio < a.fin`,
      )
      .get().n;
    assert.equal(solapes, 0);
  });
});
