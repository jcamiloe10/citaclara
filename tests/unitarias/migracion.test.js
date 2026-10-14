import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { abrirBase } from '../../src/db/connection.js';

const COLUMNAS = (db, tabla) => db.prepare(`PRAGMA table_info(${tabla})`).all().map((c) => c.name);

/** Base con el esquema de la 001 (sin las columnas de la 002) y una cita ya existente. */
function baseAntigua(ruta) {
  const db = new DatabaseSync(ruta);
  const esquema = readFileSync(new URL('../../src/db/schema.sql', import.meta.url), 'utf8');
  db.exec(esquema);
  db.exec("INSERT INTO clinica (id, nombre, clave_hash) VALUES (1, 'Clínica Antigua', 'x')");
  db.exec("INSERT INTO profesional (id, clinica_id, nombre, especialidad) VALUES (1, 1, 'María', 'Fisioterapia')");
  db.exec("INSERT INTO servicio (id, clinica_id, nombre, duracion_min, precio_centimos) VALUES (1, 1, 'Sesión', 45, 4000)");
  db.exec("INSERT INTO paciente (id, clinica_id, nombre, telefono, email) VALUES (1, 1, 'Ana Ruiz', '611111111', 'a@e.es')");
  db.exec(
    "INSERT INTO cita (clinica_id, profesional_id, servicio_id, paciente_id, inicio, fin) VALUES (1, 1, 1, 1, '2026-10-05T07:00:00.000Z', '2026-10-05T07:45:00.000Z')",
  );
  db.close();
}

// Las columnas nuevas ya vienen en el esquema de la 001 solo si se añadieron a schema.sql: no es así,
// se añaden por migración, de modo que el esquema leído aquí es exactamente el de la 001.
describe('Migración de la 002', () => {
  it('[002:FR-001] añade las tres columnas a una base de la 001 y conserva sus filas', () => {
    const dir = mkdtempSync(join(tmpdir(), 'citaclara-mig-'));
    try {
      const ruta = join(dir, 'antigua.db');
      baseAntigua(ruta);
      const db = abrirBase(ruta);
      assert.ok(COLUMNAS(db, 'paciente').includes('acceso_hash'));
      assert.ok(COLUMNAS(db, 'cita').includes('cancelada_por_paciente'));
      assert.ok(COLUMNAS(db, 'clinica').includes('telefono'));
      const cita = db.prepare('SELECT estado, cancelada_por_paciente AS p FROM cita').get();
      assert.equal(cita.estado, 'reservada');
      assert.equal(cita.p, 0);
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('[002:FR-001] ejecutarla dos veces no falla', () => {
    const dir = mkdtempSync(join(tmpdir(), 'citaclara-mig-'));
    try {
      const ruta = join(dir, 'doble.db');
      baseAntigua(ruta);
      abrirBase(ruta).close();
      assert.doesNotThrow(() => abrirBase(ruta).close());
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('[002:FR-001] varias aperturas simultáneas de una base antigua terminan sin error', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'citaclara-mig-'));
    try {
      const ruta = join(dir, 'carrera.db');
      baseAntigua(ruta);
      const conexion = pathToFileURL(fileURLToPath(new URL('../../src/db/connection.js', import.meta.url))).href;
      const arranque = Date.now() + 1500;
      const guion = [
        `const { abrirBase } = await import(${JSON.stringify(conexion)});`,
        `while (Date.now() < ${arranque}) {}`,
        `abrirBase(${JSON.stringify(ruta)}).close();`,
        `console.log('ok');`,
      ].join('\n');
      const lanzar = () =>
        new Promise((resolver, rechazar) =>
          execFile(
            process.execPath,
            ['--disable-warning=ExperimentalWarning', '--input-type=module', '-e', guion],
            (error, salida, errores) => (error ? rechazar(new Error(errores)) : resolver(salida.trim())),
          ),
        );
      assert.deepEqual(await Promise.all([lanzar(), lanzar(), lanzar()]), ['ok', 'ok', 'ok']);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
