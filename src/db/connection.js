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
  migrar(db);
  return db;
}

// Columnas añadidas por la 002 sobre bases creadas con el esquema de la 001 (research D9).
// CREATE TABLE IF NOT EXISTS no añade columnas, así que se comprueba y se añade lo que falte.
const COLUMNAS_NUEVAS = [
  ['paciente', 'acceso_hash', 'TEXT'],
  ['cita', 'cancelada_por_paciente', 'INTEGER NOT NULL DEFAULT 0 CHECK (cancelada_por_paciente IN (0, 1))'],
  ['clinica', 'telefono', 'TEXT'],
];

function migrar(db) {
  for (const [tabla, columna, definicion] of COLUMNAS_NUEVAS) {
    const existe = db.prepare(`PRAGMA table_info(${tabla})`).all().some((c) => c.name === columna);
    if (existe) continue;
    try {
      db.exec(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`);
    } catch (error) {
      // Otro proceso ganó la carrera y ya la añadió.
      if (!String(error?.message).includes('duplicate column name')) throw error;
    }
  }
  db.exec(
    'CREATE UNIQUE INDEX IF NOT EXISTS paciente_acceso_hash ON paciente (acceso_hash) WHERE acceso_hash IS NOT NULL',
  );
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
