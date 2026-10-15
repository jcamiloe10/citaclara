const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Formato de correo que acepta la ficha del paciente (001, FR-008b). */
export const emailValido = (correo) => RE_EMAIL.test(String(correo ?? '').trim());

/** Teléfono español: 9 dígitos que empiezan por 6, 7, 8 o 9; admite prefijo +34 / 0034 y separadores. */
export function normalizarTelefono(texto) {
  let t = String(texto ?? '').replace(/[\s.\-()]/g, '');
  t = t.replace(/^(\+34|0034)/, '');
  return /^[6-9]\d{8}$/.test(t) ? t : null;
}

export function formatearTelefono(t) {
  return `${t.slice(0, 3)} ${t.slice(3, 6)} ${t.slice(6)}`;
}

/** Devuelve `{ ok: true, datos }` con los datos normalizados o `{ ok: false, errores }` por campo (FR-008b). */
export function validarPaciente({ nombre, telefono, email } = {}) {
  const errores = {};
  const nombreLimpio = String(nombre ?? '').trim();
  if (!nombreLimpio) errores.nombre = 'Escribe el nombre del paciente';
  const tel = normalizarTelefono(telefono);
  if (!String(telefono ?? '').trim()) errores.telefono = 'Escribe el teléfono del paciente';
  else if (!tel) errores.telefono = 'El teléfono debe tener 9 cifras, por ejemplo 612 345 678';
  const correo = String(email ?? '').trim();
  if (!correo) errores.email = 'Escribe el correo electrónico del paciente';
  else if (!RE_EMAIL.test(correo)) errores.email = 'El correo electrónico no es válido';
  if (Object.keys(errores).length) return { ok: false, errores };
  return { ok: true, datos: { nombre: nombreLimpio, telefono: tel, email: correo } };
}

export function crearPaciente(db, clinicaId, entrada) {
  const v = validarPaciente(entrada);
  if (!v.ok) return { ok: false, codigo: 'datos', errores: v.errores };
  const { lastInsertRowid } = db
    .prepare('INSERT INTO paciente (clinica_id, nombre, telefono, email) VALUES (?, ?, ?, ?)')
    .run(clinicaId, v.datos.nombre, v.datos.telefono, v.datos.email);
  return { ok: true, paciente: { id: Number(lastInsertRowid), ...v.datos } };
}

const sinTildes = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** Pacientes de la clínica por nombre, con búsqueda sin distinguir tildes ni mayúsculas (002, FR-004). */
export function listarPacientes(db, clinicaId, { q = '' } = {}) {
  const buscado = sinTildes(q).trim();
  return db
    .prepare('SELECT id, nombre, telefono, email, acceso_hash IS NOT NULL AS conEnlace FROM paciente WHERE clinica_id = ? ORDER BY nombre, id')
    .all(clinicaId)
    .filter((p) => !buscado || sinTildes(p.nombre).includes(buscado))
    .map((p) => ({ ...p, conEnlace: p.conEnlace === 1, telefonoFormateado: formatearTelefono(p.telefono) }));
}

export function obtenerPaciente(db, clinicaId, pacienteId) {
  return db.prepare('SELECT id, nombre, telefono, email, acceso_hash IS NOT NULL AS conEnlace FROM paciente WHERE id = ? AND clinica_id = ?').get(pacienteId, clinicaId) ?? null;
}
