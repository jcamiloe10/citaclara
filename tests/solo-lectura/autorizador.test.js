// [004-FR-003] El autorizador de SQLite es la red de seguridad de "no escribe NADA": incluso
// saltándose por completo el dominio, la conexión de solo lectura rechaza cualquier escritura.
import { describe, it, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { abrirBase, abrirBaseSoloLectura } from '../../src/db/connection.js';

const directorio = mkdtempSync(join(tmpdir(), 'citaclara-solo-lectura-'));
const ruta = join(directorio, 'prueba.db');

const db = abrirBase(ruta);
db.prepare('INSERT INTO clinica (nombre, clave_hash) VALUES (?, ?)').run('Clínica de prueba', 'hash-cualquiera');
const dbSoloLectura = abrirBaseSoloLectura(ruta);

after(() => {
  db.close();
  dbSoloLectura.close();
  rmSync(directorio, { recursive: true, force: true });
});

describe('Autorizador de solo lectura (FR-003)', () => {
  it('[004-FR-003] bloquea un INSERT directo sobre cita', () => {
    assert.throws(
      () => dbSoloLectura.prepare("INSERT INTO cita (clinica_id, profesional_id, servicio_id, paciente_id, inicio, fin, estado) VALUES (1,1,1,1,'x','y','reservada')").run(),
      /not authorized/,
    );
  });

  it('[004-FR-003] bloquea un UPDATE directo sobre clinica', () => {
    assert.throws(() => dbSoloLectura.prepare('UPDATE clinica SET nombre = ? WHERE id = 1').run('Otro nombre'), /not authorized/);
  });

  it('[004-FR-003] bloquea un DELETE directo sobre clinica', () => {
    assert.throws(() => dbSoloLectura.prepare('DELETE FROM clinica WHERE id = 1').run(), /not authorized/);
  });

  it('[004-FR-003] bloquea crear o alterar tablas', () => {
    assert.throws(() => dbSoloLectura.exec('CREATE TABLE intruso (id INTEGER)'), /not authorized/);
    assert.throws(() => dbSoloLectura.exec('ALTER TABLE clinica ADD COLUMN intruso TEXT'), /not authorized/);
  });

  it('[004-FR-003] permite SELECT, con JOIN, ORDER BY y funciones agregadas, que necesitará domain/analitica.js', () => {
    const fila = dbSoloLectura.prepare('SELECT COUNT(*) AS total FROM clinica').get();
    assert.equal(fila.total, 1);

    const conJoin = dbSoloLectura
      .prepare(
        `SELECT c.nombre, COUNT(p.id) AS profesionales
         FROM clinica c LEFT JOIN profesional p ON p.clinica_id = c.id
         GROUP BY c.id ORDER BY c.nombre`,
      )
      .all();
    assert.equal(conJoin.length, 1);
    assert.equal(conJoin[0].nombre, 'Clínica de prueba');
    assert.equal(conJoin[0].profesionales, 0);
  });

  it('[004-FR-003] la conexión de escritura, sin autorizador, sigue pudiendo escribir con normalidad', () => {
    db.prepare('UPDATE clinica SET nombre = ? WHERE id = 1').run('Clínica de prueba (editada)');
    const fila = db.prepare('SELECT nombre FROM clinica WHERE id = 1').get();
    assert.equal(fila.nombre, 'Clínica de prueba (editada)');
  });
});
