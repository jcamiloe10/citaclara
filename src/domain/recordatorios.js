import { enTransaccionInmediata } from '../db/connection.js';
import { componerRecordatorio } from '../correo/mensaje.js';
import { FORMATO_SECRETO, huellaDeSecreto, nuevoSecreto } from './enlaces.js';
import { emailValido } from './pacientes.js';
import { cancelarComoPaciente, PLAZO_CANCELACION_MS } from './portal.js';
import { iso } from './tiempo.js';

// Recordatorios de cita (003). La lógica no conoce HTTP ni ficheros: recibe una función `salida`
// que escribe el mensaje, y para cancelar reutiliza la regla del paciente de la 002.

const HORA_MS = 60 * 60 * 1000;

/** Ventana de recordatorio: citas que empiezan entre 24 y 48 horas después de `ahora` (FR-002). */
export function ventanaDeRecordatorio(ahora) {
  return {
    desde: new Date(ahora.getTime() + 24 * HORA_MS),
    hasta: new Date(ahora.getTime() + 48 * HORA_MS),
  };
}

const SELECT_PARA_RECORDAR = `
  SELECT c.id, c.clinica_id AS clinicaId, c.inicio, c.estado,
         p.nombre AS paciente, p.email AS email,
         pr.nombre AS profesional, s.nombre AS servicio,
         cl.nombre AS clinica, cl.telefono AS telefonoClinica,
         r.resultado AS resultadoPrevio
  FROM cita c
  JOIN paciente p ON p.id = c.paciente_id
  JOIN profesional pr ON pr.id = c.profesional_id
  JOIN servicio s ON s.id = c.servicio_id
  JOIN clinica cl ON cl.id = c.clinica_id
  LEFT JOIN recordatorio r ON r.cita_id = c.id AND r.inicio_cita = c.inicio
  WHERE c.estado = 'reservada' AND c.inicio >= ? AND c.inicio < ?
  ORDER BY c.inicio, c.id`;

/**
 * Citas reservadas de la ventana, con el resultado previo de su recordatorio (o null).
 * Solo `fallido` o ausente están pendientes (FR-003, FR-004, FR-005).
 */
export function citasEnVentana(db, ahora) {
  const { desde, hasta } = ventanaDeRecordatorio(ahora);
  return db.prepare(SELECT_PARA_RECORDAR).all(iso(desde), iso(hasta));
}

const GUARDAR = `
  INSERT INTO recordatorio
    (clinica_id, cita_id, inicio_cita, resultado, modo, fichero, token_huella, error, generado_en)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  ON CONFLICT (cita_id, inicio_cita) DO UPDATE SET
    resultado = excluded.resultado, modo = excluded.modo, fichero = excluded.fichero,
    token_huella = excluded.token_huella, error = excluded.error, generado_en = excluded.generado_en`;

/**
 * Proceso diario (FR-001 a FR-006). `salida(nombreFichero, contenido)` escribe el mensaje y devuelve
 * el nombre del fichero (o lanza un error). Cada cita se procesa en una transacción inmediata que
 * relee el estado: dos ejecuciones simultáneas no duplican (research D4).
 * Devuelve `{ generados, sinEmail, fallidos, yaRecordadas, fallos }`.
 */
export function generarRecordatorios(db, { ahora, salida, urlPublica, remitente }) {
  const instante = ahora();
  const resumen = { generados: 0, sinEmail: 0, fallidos: 0, yaRecordadas: 0, fallos: [] };

  for (const cita of citasEnVentana(db, instante)) {
    if (cita.resultadoPrevio === 'generado' || cita.resultadoPrevio === 'sin_email') {
      resumen.yaRecordadas += 1;
      continue;
    }
    const resultado = enTransaccionInmediata(db, () => {
      const actual = db
        .prepare(
          `SELECT c.estado, c.inicio, r.resultado AS previo
           FROM cita c LEFT JOIN recordatorio r ON r.cita_id = c.id AND r.inicio_cita = c.inicio
           WHERE c.id = ?`,
        )
        .get(cita.id);
      if (!actual || actual.estado !== 'reservada' || actual.inicio !== cita.inicio) return 'omitida';
      if (actual.previo === 'generado' || actual.previo === 'sin_email') return 'ya';

      const marca = iso(instante);
      if (!emailValido(cita.email)) {
        db.prepare(GUARDAR).run(cita.clinicaId, cita.id, cita.inicio, 'sin_email', null, null, null, null, marca);
        return 'sin_email';
      }
      const secreto = nuevoSecreto();
      try {
        const { nombreFichero, contenido } = componerRecordatorio({
          clinica: { nombre: cita.clinica, telefono: cita.telefonoClinica },
          paciente: { nombre: cita.paciente, email: cita.email },
          cita: { id: cita.id, inicio: new Date(cita.inicio), profesional: cita.profesional, servicio: cita.servicio },
          urlPublica,
          secreto,
          generadoEn: instante,
          remitente,
        });
        const fichero = salida(nombreFichero, contenido);
        db.prepare(GUARDAR).run(
          cita.clinicaId, cita.id, cita.inicio, 'generado', 'simulado', fichero, huellaDeSecreto(secreto), null, marca,
        );
        return 'generado';
      } catch (error) {
        const motivo = String(error?.message ?? error).slice(0, 300);
        db.prepare(GUARDAR).run(cita.clinicaId, cita.id, cita.inicio, 'fallido', null, null, null, motivo, marca);
        resumen.fallos.push({ citaId: cita.id, motivo });
        return 'fallido';
      }
    });
    if (resultado === 'generado') resumen.generados += 1;
    else if (resultado === 'sin_email') resumen.sinEmail += 1;
    else if (resultado === 'fallido') resumen.fallidos += 1;
    else if (resultado === 'ya') resumen.yaRecordadas += 1;
  }
  return resumen;
}

const SELECT_ENLACE = `
  SELECT r.cita_id AS citaId, r.inicio_cita AS inicioCita,
         c.inicio, c.estado, c.paciente_id AS pacienteId, c.clinica_id AS clinicaId,
         p.nombre AS paciente, pr.nombre AS profesional, s.nombre AS servicio,
         cl.nombre AS clinica, cl.telefono AS telefonoClinica
  FROM recordatorio r
  JOIN cita c ON c.id = r.cita_id
  JOIN paciente p ON p.id = c.paciente_id
  JOIN profesional pr ON pr.id = c.profesional_id
  JOIN servicio s ON s.id = c.servicio_id
  JOIN clinica cl ON cl.id = c.clinica_id
  WHERE r.token_huella = ? AND r.resultado = 'generado'`;

/** Recordatorio al que da acceso el secreto, o null (desconocido, mal formado o de una cita movida). */
function resolver(db, secreto) {
  if (typeof secreto !== 'string' || !FORMATO_SECRETO.test(secreto)) return null;
  const f = db.prepare(SELECT_ENLACE).get(huellaDeSecreto(secreto));
  if (!f || f.inicio !== f.inicioCita) return null; // FR-017: la cita cambió de hora
  return f;
}

const datosPublicos = (f) => ({
  cita: { id: f.citaId, inicio: new Date(f.inicio), profesional: f.profesional, servicio: f.servicio, paciente: f.paciente },
  clinica: { nombre: f.clinica, telefono: f.telefonoClinica },
});

/**
 * Qué muestra el enlace (solo lectura). `situacion`: puede_cancelar | sin_margen | ya_cancelada |
 * no_reservada. Un secreto no válido devuelve `{ ok: false, codigo: 'no_valido' }` sin datos (FR-015).
 */
export function consultarEnlace(db, secreto, ahora) {
  const f = resolver(db, secreto);
  if (!f) return { ok: false, codigo: 'no_valido' };
  let situacion;
  if (f.estado === 'cancelada') situacion = 'ya_cancelada';
  else if (f.estado !== 'reservada') situacion = 'no_reservada';
  else if (new Date(f.inicio).getTime() - ahora().getTime() < PLAZO_CANCELACION_MS) situacion = 'sin_margen';
  else situacion = 'puede_cancelar';
  return { ok: true, situacion, ...datosPublicos(f) };
}

/**
 * Cancela la cita desde el enlace con la misma función que el portal de la 002 (research D5).
 * `codigo`: cancelada | ya_cancelada | no_reservada | sin_margen | no_valido.
 */
export function cancelarPorEnlace(db, secreto, ahora) {
  const f = resolver(db, secreto);
  if (!f) return { ok: false, codigo: 'no_valido' };
  const r = cancelarComoPaciente(db, { pacienteId: f.pacienteId, clinicaId: f.clinicaId, citaId: f.citaId }, ahora);
  const datos = datosPublicos(f);
  if (r.ok) return { ok: true, codigo: 'cancelada', ...datos };
  if (r.codigo === 'fuera_de_plazo') return { ok: false, codigo: 'sin_margen', ...datos };
  if (r.codigo === 'no_reservada') {
    return { ok: false, codigo: r.estado === 'cancelada' ? 'ya_cancelada' : 'no_reservada', ...datos };
  }
  return { ok: false, codigo: 'no_valido' };
}
