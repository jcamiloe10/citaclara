import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { normalizarTelefono } from './pacientes.js';

// Autenticación v1 (deuda consciente): una clave de panel por clínica, sin cuentas.

export function hashClave(clave) {
  const sal = randomBytes(16);
  const hash = scryptSync(clave, sal, 32);
  return `scrypt$${sal.toString('hex')}$${hash.toString('hex')}`;
}

export function verificarClave(clave, guardado) {
  const [tipo, salHex, hashHex] = String(guardado).split('$');
  if (tipo !== 'scrypt' || !salHex || !hashHex) return false;
  const esperado = Buffer.from(hashHex, 'hex');
  const calculado = scryptSync(String(clave), Buffer.from(salHex, 'hex'), esperado.length);
  return timingSafeEqual(esperado, calculado);
}

/** La clave identifica a la clínica (FR-003): devuelve la clínica cuya clave coincide, o null. */
export function identificarPorClave(db, clave) {
  if (typeof clave !== 'string' || clave.length === 0) return null;
  const clinicas = db.prepare('SELECT id, nombre, clave_hash FROM clinica ORDER BY id').all();
  for (const c of clinicas) {
    if (verificarClave(clave, c.clave_hash)) return { id: c.id, nombre: c.nombre };
  }
  return null;
}

/** Crea una clínica; rechaza una clave ya usada por otra (FR-003). */
export function crearClinica(db, { nombre, clave, telefono }) {
  if (typeof nombre !== 'string' || nombre.trim() === '') {
    return { ok: false, codigo: 'datos', errores: { nombre: 'El nombre es obligatorio' } };
  }
  if (typeof clave !== 'string' || clave.length < 6) {
    return { ok: false, codigo: 'datos', errores: { clave: 'La clave debe tener al menos 6 caracteres' } };
  }
  let telefonoNormalizado = null;
  if (telefono !== undefined && telefono !== null && String(telefono).trim() !== '') {
    telefonoNormalizado = normalizarTelefono(telefono);
    if (!telefonoNormalizado) {
      return { ok: false, codigo: 'datos', errores: { telefono: 'El teléfono debe tener 9 cifras, por ejemplo 612 345 678' } };
    }
  }
  if (identificarPorClave(db, clave)) {
    return { ok: false, codigo: 'clave_repetida', errores: { clave: 'Esa clave ya la usa otra clínica' } };
  }
  const { lastInsertRowid } = db
    .prepare('INSERT INTO clinica (nombre, clave_hash, telefono) VALUES (?, ?, ?)')
    .run(nombre.trim(), hashClave(clave), telefonoNormalizado);
  return { ok: true, clinica: { id: Number(lastInsertRowid), nombre: nombre.trim(), telefono: telefonoNormalizado } };
}

/** Datos públicos de la clínica que muestra el portal (FR-009). */
export function obtenerClinica(db, clinicaId) {
  return db.prepare('SELECT id, nombre, telefono FROM clinica WHERE id = ?').get(clinicaId) ?? null;
}
