import { formatearEuros } from './dinero.js';
import { formatearTelefono } from './pacientes.js';
import {
  aperturaDelDia,
  cierreDelDia,
  esDiaLaborable,
  finDelDia,
  inicioDelDia,
  iso,
} from './tiempo.js';

const SELECT_CITA = `
  SELECT c.id, c.profesional_id AS profesionalId, c.inicio, c.fin, c.estado,
         c.cancelada_por_paciente AS canceladaPorPaciente,
         s.nombre AS servicio, s.duracion_min AS duracionMin, s.precio_centimos AS precioCentimos,
         p.id AS pacienteId, p.nombre AS paciente
  FROM cita c
  JOIN servicio s ON s.id = c.servicio_id
  JOIN paciente p ON p.id = c.paciente_id`;

const aCita = (f) => ({
  ...f,
  inicio: new Date(f.inicio),
  fin: new Date(f.fin),
  precio: formatearEuros(f.precioCentimos),
});

/** Una cita con los datos que muestra la interfaz, o undefined si no es de la clínica. */
export function citaConDetalle(db, clinicaId, citaId) {
  const f = db.prepare(`${SELECT_CITA} WHERE c.id = ? AND c.clinica_id = ?`).get(citaId, clinicaId);
  return f ? aCita(f) : undefined;
}

/**
 * Agenda de un día (FR-022): por profesional, los tramos ocupados (reservada o completada) y
 * libres entre la apertura y el cierre de la clínica, más el histórico del día (canceladas
 * y no asistidas, que no ocupan hueco). `dia` es 'AAAA-MM-DD' en hora de España.
 */
export function agendaDelDia(db, clinicaId, dia) {
  const laborable = esDiaLaborable(dia);
  const profesionales = db
    .prepare('SELECT id, nombre, especialidad FROM profesional WHERE clinica_id = ? ORDER BY id')
    .all(clinicaId);
  const desde = iso(inicioDelDia(dia));
  const hasta = iso(finDelDia(dia));
  const apertura = aperturaDelDia(dia);
  const cierre = cierreDelDia(dia);

  const citas = db
    .prepare(
      `${SELECT_CITA}
       WHERE c.clinica_id = ? AND c.inicio >= ? AND c.inicio < ?
       ORDER BY c.inicio, c.id`,
    )
    .all(clinicaId, desde, hasta)
    .map(aCita);

  return {
    dia,
    laborable,
    profesionales: profesionales.map((prof) => {
      const suyas = citas.filter((c) => c.profesionalId === prof.id);
      const activas = suyas.filter((c) => c.estado === 'reservada' || c.estado === 'completada');
      const historico = suyas.filter((c) => c.estado === 'cancelada' || c.estado === 'no_asistida');
      const tramos = [];
      if (laborable) {
        let cursor = apertura;
        for (const cita of activas) {
          if (cita.inicio > cursor) {
            tramos.push({ tipo: 'libre', inicio: cursor, fin: cita.inicio < cierre ? cita.inicio : cierre });
          }
          tramos.push({ tipo: 'ocupado', cita });
          if (cita.fin > cursor) cursor = cita.fin;
        }
        if (cursor < cierre) tramos.push({ tipo: 'libre', inicio: cursor, fin: cierre });
      }
      return { ...prof, tramos, historico };
    }),
  };
}

/** Datos de los selectores del alta de cita. */
export function opcionesAlta(db, clinicaId) {
  return {
    profesionales: db
      .prepare('SELECT id, nombre, especialidad FROM profesional WHERE clinica_id = ? ORDER BY id')
      .all(clinicaId),
    servicios: db
      .prepare(
        'SELECT id, nombre, duracion_min AS duracionMin, precio_centimos AS precioCentimos FROM servicio WHERE clinica_id = ? ORDER BY id',
      )
      .all(clinicaId)
      .map((s) => ({ ...s, precio: formatearEuros(s.precioCentimos) })),
    pacientes: db
      .prepare('SELECT id, nombre, telefono, email FROM paciente WHERE clinica_id = ? ORDER BY nombre, id')
      .all(clinicaId)
      .map((p) => ({ ...p, telefonoFormateado: formatearTelefono(p.telefono) })),
  };
}
