import { createHash, randomBytes } from 'node:crypto';
import { obtenerClinica } from './clinicas.js';

// Enlace personal del paciente (002, research D1): el secreto va en la ruta y en la base solo
// se guarda su huella, así que una filtración de la base no da acceso a ninguna página.
export const FORMATO_SECRETO = /^[A-Za-z0-9_-]{43}$/;

export const huellaDeSecreto = (secreto) => createHash('sha256').update(String(secreto)).digest('hex');

/** Secreto nuevo de 256 bits (43 caracteres base64url). Lo usan el enlace personal (002) y el de cancelación (003). */
export const nuevoSecreto = () => randomBytes(32).toString('base64url');

/** Crea el enlace de un paciente o lo renueva; el anterior deja de valer al instante (FR-004). */
export function crearOrenovarEnlace(db, { clinicaId, pacienteId }) {
  const secreto = nuevoSecreto();
  const { changes } = db
    .prepare('UPDATE paciente SET acceso_hash = ? WHERE id = ? AND clinica_id = ?')
    .run(huellaDeSecreto(secreto), pacienteId, clinicaId);
  if (changes === 0) return { ok: false, codigo: 'no_encontrado' };
  return { ok: true, secreto };
}

/** Paciente al que da acceso un secreto, o null (formato incorrecto, desconocido o renovado). */
export function resolverEnlace(db, secreto) {
  if (typeof secreto !== 'string' || !FORMATO_SECRETO.test(secreto)) return null;
  const paciente = db
    .prepare('SELECT id, clinica_id, nombre FROM paciente WHERE acceso_hash = ?')
    .get(huellaDeSecreto(secreto));
  if (!paciente) return null;
  const clinica = obtenerClinica(db, paciente.clinica_id);
  return { pacienteId: paciente.id, clinicaId: paciente.clinica_id, nombre: paciente.nombre, clinica };
}

export function tieneEnlace(db, pacienteId) {
  return db.prepare('SELECT acceso_hash FROM paciente WHERE id = ?').get(pacienteId)?.acceso_hash != null;
}
