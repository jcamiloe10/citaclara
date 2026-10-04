import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBase } from '../../src/db/connection.js';
import { crearClinica } from '../../src/domain/clinicas.js';
import { crearPaciente, normalizarTelefono, validarPaciente } from '../../src/domain/pacientes.js';

describe('Pacientes', () => {
  it('[FR-008b] valida los datos de una ficha nueva por campo', () => {
    const vacio = validarPaciente({});
    assert.deepEqual(Object.keys(vacio.errores).sort(), ['email', 'nombre', 'telefono']);
    const mal = validarPaciente({ nombre: 'Ana', telefono: '12345', email: 'ana@' });
    assert.equal(mal.ok, false);
    assert.ok(mal.errores.telefono);
    assert.ok(mal.errores.email);
    assert.equal(mal.errores.nombre, undefined);
  });

  it('[FR-008b] normaliza el teléfono (espacios, prefijo +34)', () => {
    assert.equal(normalizarTelefono('612 345 678'), '612345678');
    assert.equal(normalizarTelefono('+34 612-345-678'), '612345678');
    assert.equal(normalizarTelefono('0034612345678'), '612345678');
    assert.equal(normalizarTelefono('512345678'), null);
    assert.equal(normalizarTelefono('6123456789'), null);
  });

  it('[FR-007] crea la ficha de un paciente con nombre, teléfono y email', () => {
    const db = abrirBase();
    const { clinica } = crearClinica(db, { nombre: 'Clínica Prueba', clave: 'clave-prueba' });
    const r = crearPaciente(db, clinica.id, { nombre: ' Ana Ruiz ', telefono: '611 111 111', email: 'ana@ejemplo.es' });
    assert.equal(r.ok, true);
    const fila = db.prepare('SELECT nombre, telefono, email, clinica_id FROM paciente WHERE id = ?').get(r.paciente.id);
    assert.equal(fila.nombre, 'Ana Ruiz');
    assert.equal(fila.telefono, '611111111');
    assert.equal(fila.clinica_id, clinica.id);
    // Dos fichas con los mismos datos se aceptan (no hay detección de duplicados).
    assert.equal(crearPaciente(db, clinica.id, { nombre: 'Ana Ruiz', telefono: '611111111', email: 'ana@ejemplo.es' }).ok, true);
    db.close();
  });
});
