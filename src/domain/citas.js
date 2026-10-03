import { enTransaccionInmediata } from '../db/connection.js';
import { dentroDeHorario, esMultiploDe15, iso } from './tiempo.js';

const ESTADOS_CIERRE = ['completada', 'cancelada', 'no_asistida'];

const rechazo = (codigo, extra = {}) => ({ ok: false, codigo, ...extra });

function comoInstante(inicio) {
  if (inicio instanceof Date) return Number.isNaN(inicio.getTime()) ? null : inicio;
  if (typeof inicio === 'string') {
    const f = new Date(inicio);
    return Number.isNaN(f.getTime()) ? null : f;
  }
  return null;
}

/**
 * Alta de cita (RN1, RN2, RN3, RN4). `ahora` es una función que devuelve el instante actual.
 * Devuelve `{ ok: true, cita }` o `{ ok: false, codigo }` con codigo ∈
 * datos | no_encontrado | hora_invalida | pasado | fuera_de_horario | ocupado.
 */
export function crearCita(db, datos, ahora) {
  const { clinicaId, profesionalId, servicioId, pacienteId } = datos;
  const inicio = comoInstante(datos.inicio);
  const errores = {};
  if (!profesionalId) errores.profesional = 'Elige un profesional';
  if (!servicioId) errores.servicio = 'Elige un servicio';
  if (!pacienteId) errores.paciente = 'Elige un paciente';
  if (!inicio) errores.inicio = 'Indica el día y la hora de inicio';
  if (Object.keys(errores).length) return rechazo('datos', { errores });

  const profesional = db
    .prepare('SELECT id FROM profesional WHERE id = ? AND clinica_id = ?')
    .get(profesionalId, clinicaId);
  const servicio = db
    .prepare('SELECT id, duracion_min FROM servicio WHERE id = ? AND clinica_id = ?')
    .get(servicioId, clinicaId);
  const paciente = db
    .prepare('SELECT id FROM paciente WHERE id = ? AND clinica_id = ?')
    .get(pacienteId, clinicaId);
  if (!profesional || !servicio || !paciente) return rechazo('no_encontrado');

  const fin = new Date(inicio.getTime() + servicio.duracion_min * 60_000);

  if (!esMultiploDe15(inicio)) return rechazo('hora_invalida');
  if (inicio.getTime() <= ahora().getTime()) return rechazo('pasado');
  if (!dentroDeHorario(inicio, fin)) return rechazo('fuera_de_horario');

  try {
    return enTransaccionInmediata(db, () => {
      const choque = db
        .prepare(
          `SELECT 1 FROM cita
           WHERE profesional_id = ? AND estado IN ('reservada', 'completada')
             AND inicio < ? AND ? < fin
           LIMIT 1`,
        )
        .get(profesionalId, iso(fin), iso(inicio));
      if (choque) return rechazo('ocupado');
      const { lastInsertRowid } = db
        .prepare(
          `INSERT INTO cita (clinica_id, profesional_id, servicio_id, paciente_id, inicio, fin, estado)
           VALUES (?, ?, ?, ?, ?, ?, 'reservada')`,
        )
        .run(clinicaId, profesionalId, servicioId, pacienteId, iso(inicio), iso(fin));
      return {
        ok: true,
        cita: {
          id: Number(lastInsertRowid),
          profesionalId,
          servicioId,
          pacienteId,
          inicio: iso(inicio),
          fin: iso(fin),
          estado: 'reservada',
        },
      };
    });
  } catch (error) {
    // La red de seguridad de la base rechazó un solape que la comprobación no vio.
    if (String(error?.message).includes('solape')) return rechazo('ocupado');
    throw error;
  }
}

/**
 * Cierre de una cita reservada (FR-012/013/014). Códigos de rechazo:
 * estado_invalido | no_encontrado | no_reservada | no_ha_empezado.
 */
export function cambiarEstado(db, { clinicaId, citaId, estado }, ahora) {
  if (!ESTADOS_CIERRE.includes(estado)) return rechazo('estado_invalido');
  return enTransaccionInmediata(db, () => {
    const cita = db
      .prepare('SELECT id, inicio, estado FROM cita WHERE id = ? AND clinica_id = ?')
      .get(citaId, clinicaId);
    if (!cita) return rechazo('no_encontrado');
    if (cita.estado !== 'reservada') return rechazo('no_reservada');
    if (
      (estado === 'completada' || estado === 'no_asistida') &&
      new Date(cita.inicio).getTime() > ahora().getTime()
    ) {
      return rechazo('no_ha_empezado');
    }
    const { changes } = db
      .prepare(
        `UPDATE cita SET estado = ?
         WHERE id = ? AND clinica_id = ? AND estado = 'reservada'`,
      )
      .run(estado, citaId, clinicaId);
    if (changes === 0) return rechazo('no_reservada');
    return { ok: true, estado };
  });
}
