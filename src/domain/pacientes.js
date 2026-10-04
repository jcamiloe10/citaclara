const RE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

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
