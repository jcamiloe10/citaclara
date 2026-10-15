// Única apertura de node:sqlite. Si se sustituye el motor, solo cambia este fichero.
import { DatabaseSync, constants } from 'node:sqlite';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const SCHEMA = readFileSync(new URL('./schema.sql', import.meta.url), 'utf8');

export function abrirBase(ruta = ':memory:') {
  if (ruta !== ':memory:') mkdirSync(dirname(ruta), { recursive: true });
  const db = new DatabaseSync(ruta);
  db.exec('PRAGMA busy_timeout = 10000');
  db.exec('PRAGMA foreign_keys = ON');
  db.exec('PRAGMA journal_mode = WAL');
  // El esquema es idempotente: varios procesos pueden abrir una base vacía a la vez.
  db.exec(SCHEMA);
  return db;
}

// Acciones de solo lectura que el autorizador permite; cualquier otra (INSERT, UPDATE,
// DELETE, CREATE/DROP/ALTER, PRAGMA, ATTACH...) queda denegada (FR-003 de 004-citaclara-analitica).
const ACCIONES_DE_LECTURA = new Set([
  constants.SQLITE_SELECT,
  constants.SQLITE_READ,
  constants.SQLITE_FUNCTION,
  constants.SQLITE_RECURSIVE,
]);

/**
 * Segunda conexión sobre el mismo fichero, solo para lectura: un autorizador de SQLite
 * rechaza cualquier acción que no sea de lectura. Es la red de seguridad de la 004 (solo
 * lectura), igual filosofía que el disparador anti-solape de la 001. No aplica el esquema
 * (ya lo aplicó `abrirBase` sobre el mismo fichero) ni acepta `:memory:` como base compartida
 * con una conexión de escritura, porque cada `:memory:` es una base independiente.
 */
export function abrirBaseSoloLectura(ruta) {
  const db = new DatabaseSync(ruta);
  db.exec('PRAGMA busy_timeout = 10000');
  db.setAuthorizer((accion) => (ACCIONES_DE_LECTURA.has(accion) ? constants.SQLITE_OK : constants.SQLITE_DENY));
  return db;
}

// Transacción de escritura inmediata: otra escritura no puede intercalarse entre
// la comprobación y el alta, tampoco desde otro proceso (RN1, FR-018).
export function enTransaccionInmediata(db, fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const resultado = fn();
    db.exec('COMMIT');
    return resultado;
  } catch (error) {
    try {
      db.exec('ROLLBACK');
    } catch {
      // la transacción ya se había cerrado
    }
    throw error;
  }
}
