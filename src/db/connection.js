// Única apertura de node:sqlite. Si se sustituye el motor, solo cambia este fichero.
import { DatabaseSync } from 'node:sqlite';
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
