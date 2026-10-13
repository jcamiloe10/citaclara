import { enTransaccionInmediata } from '../db/connection.js';

// Portal del paciente (002). Solo lee las citas del propio paciente y solo aplica la
// transición reservada → cancelada, con su propio plazo (research D4, D5).
export const PLAZO_CANCELACION_MS = 24 * 60 * 60 * 1000;

const SELECT_CITAS = `
  SELECT c.id, c.inicio, c.fin, c.estado, c.cancelada_por_paciente AS canceladaPorPaciente,
         pr.nombre AS profesional, s.nombre AS servicio
  FROM cita c
  JOIN profesional pr ON pr.id = c.profesional_id
  JOIN servicio s ON s.id = c.servicio_id`;

const aCita = (f) => ({
  id: f.id,
  inicio: new Date(f.inicio),
  fin: new Date(f.fin),
  estado: f.estado,
  canceladaPorPaciente: f.canceladaPorPaciente === 1,
  profesional: f.profesional,
  servicio: f.servicio,
});

const dentroDePlazo = (inicio, ahora) => inicio.getTime() - ahora.getTime() >= PLAZO_CANCELACION_MS;

/**
 * Próximas (reservadas que aún no han empezado, la más cercana primero) e historial (el resto,
 * la más reciente primero, recortado a `limiteHistorial`). Siempre acotado al paciente (FR-002).
 */
export function citasDelPaciente(db, { pacienteId, clinicaId }, ahora, { limiteHistorial = 10 } = {}) {
  const instante = ahora();
  const filas = db
    .prepare(`${SELECT_CITAS} WHERE c.paciente_id = ? AND c.clinica_id = ? ORDER BY c.inicio, c.id`)
    .all(pacienteId, clinicaId)
    .map(aCita);
  const esProxima = (c) => c.estado === 'reservada' && c.inicio.getTime() > instante.getTime();
  const proximas = filas
    .filter(esProxima)
    .map((c) => ({ ...c, sePuedeCancelar: dentroDePlazo(c.inicio, instante) }));
  const todoElHistorial = filas.filter((c) => !esProxima(c)).reverse();
  return {
    proximas,
    historial: todoElHistorial.slice(0, limiteHistorial),
    totalHistorial: todoElHistorial.length,
    hayMas: todoElHistorial.length > limiteHistorial,
  };
}

/** Una cita del paciente (para la pantalla de confirmación), o undefined si no es suya. */
export function citaDelPaciente(db, { pacienteId, clinicaId, citaId }, ahora) {
  const f = db
    .prepare(`${SELECT_CITAS} WHERE c.id = ? AND c.paciente_id = ? AND c.clinica_id = ?`)
    .get(citaId, pacienteId, clinicaId);
  if (!f) return undefined;
  const cita = aCita(f);
  return { ...cita, sePuedeCancelar: cita.estado === 'reservada' && dentroDePlazo(cita.inicio, ahora()) };
}

/**
 * Cancelación por el paciente (FR-011, FR-013, FR-015). Códigos de rechazo:
 * no_encontrada | no_reservada (con `estado` real) | fuera_de_plazo.
 */
export function cancelarComoPaciente(db, { pacienteId, clinicaId, citaId }, ahora) {
  return enTransaccionInmediata(db, () => {
    const f = db
      .prepare(`${SELECT_CITAS} WHERE c.id = ? AND c.paciente_id = ? AND c.clinica_id = ?`)
      .get(citaId, pacienteId, clinicaId);
    if (!f) return { ok: false, codigo: 'no_encontrada' };
    const cita = aCita(f);
    if (cita.estado !== 'reservada') return { ok: false, codigo: 'no_reservada', estado: cita.estado };
    if (!dentroDePlazo(cita.inicio, ahora())) return { ok: false, codigo: 'fuera_de_plazo' };
    const { changes } = db
      .prepare(
        `UPDATE cita SET estado = 'cancelada', cancelada_por_paciente = 1
         WHERE id = ? AND estado = 'reservada'`,
      )
      .run(citaId);
    if (changes === 0) return { ok: false, codigo: 'no_reservada', estado: 'cancelada' };
    return { ok: true, cita: { ...cita, estado: 'cancelada', canceladaPorPaciente: true } };
  });
}
