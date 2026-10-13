import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno } from '../ayudas/fixture.js';
import { crearOrenovarEnlace, FORMATO_SECRETO, resolverEnlace, tieneEnlace } from '../../src/domain/enlaces.js';
import { crearClinica, obtenerClinica } from '../../src/domain/clinicas.js';

describe('Enlace personal del paciente', () => {
  let e;
  beforeEach(() => {
    e = crearEntorno();
  });
  afterEach(() => e.cerrar());

  const crear = (pacienteId = e.pacientes[0]) => crearOrenovarEnlace(e.db, { clinicaId: e.clinicaId, pacienteId });

  it('[002:FR-001] crear devuelve un secreto de 43 caracteres que resuelve a su paciente', () => {
    const r = crear();
    assert.equal(r.ok, true);
    assert.match(r.secreto, FORMATO_SECRETO);
    const acceso = resolverEnlace(e.db, r.secreto);
    assert.equal(acceso.pacienteId, e.pacientes[0]);
    assert.equal(acceso.clinicaId, e.clinicaId);
    assert.equal(acceso.nombre, 'Ana Ruiz');
    assert.equal(acceso.clinica.nombre, 'Clínica Eleva');
    assert.equal(tieneEnlace(e.db, e.pacientes[0]), true);
    assert.equal(tieneEnlace(e.db, e.pacientes[1]), false);
  });

  it('[002:FR-004][002:US3-E4] renovar invalida el secreto anterior y el nuevo resuelve', () => {
    const antiguo = crear().secreto;
    const nuevo = crear().secreto;
    assert.notEqual(antiguo, nuevo);
    assert.equal(resolverEnlace(e.db, antiguo), null);
    assert.equal(resolverEnlace(e.db, nuevo).pacienteId, e.pacientes[0]);
  });

  it('[002:FR-003][002:US3-E2] formato incorrecto, caracteres ajenos o desconocido → null', () => {
    const { secreto } = crear();
    for (const malo of [
      '',
      undefined,
      null,
      secreto.slice(1),
      `${secreto}x`,
      `${secreto.slice(0, 42)}!`,
      'a'.repeat(43),
      42,
    ]) {
      assert.equal(resolverEnlace(e.db, malo), null, String(malo));
    }
  });

  it('[002:FR-002][002:US3-E3] alterar un solo carácter de un secreto válido no resuelve a nadie', () => {
    const { secreto } = crear();
    crear(e.pacientes[1]);
    const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    for (let i = 0; i < secreto.length; i++) {
      const otro = alfabeto[(alfabeto.indexOf(secreto[i]) + 1) % alfabeto.length];
      assert.equal(resolverEnlace(e.db, secreto.slice(0, i) + otro + secreto.slice(i + 1)), null);
    }
  });

  it('[002:FR-004] el secreto en claro no se guarda en ninguna columna de la base', () => {
    const { secreto } = crear();
    for (const tabla of ['clinica', 'profesional', 'servicio', 'paciente', 'cita']) {
      for (const fila of e.db.prepare(`SELECT * FROM ${tabla}`).all()) {
        for (const valor of Object.values(fila)) assert.notEqual(String(valor), secreto);
      }
    }
    const guardado = e.db.prepare('SELECT acceso_hash FROM paciente WHERE id = ?').get(e.pacientes[0]).acceso_hash;
    assert.match(guardado, /^[0-9a-f]{64}$/);
  });

  it('[002:FR-002] un paciente de otra clínica no se puede enlazar con la clínica equivocada', () => {
    const r = crearOrenovarEnlace(e.db, { clinicaId: e.clinicaId, pacienteId: e.clinica2.paciente });
    assert.deepEqual(r, { ok: false, codigo: 'no_encontrado' });
    assert.equal(tieneEnlace(e.db, e.clinica2.paciente), false);
  });
});

describe('Teléfono de la clínica', () => {
  let e;
  beforeEach(() => {
    e = crearEntorno();
  });
  afterEach(() => e.cerrar());

  it('[002:FR-009] se guarda normalizado y se recupera; sin teléfono devuelve null', () => {
    const conTel = crearClinica(e.db, { nombre: 'Con teléfono', clave: 'clave-con-tel', telefono: '+34 910 12 34 56' });
    assert.equal(conTel.ok, true);
    assert.equal(obtenerClinica(e.db, conTel.clinica.id).telefono, '910123456');
    assert.equal(obtenerClinica(e.db, e.clinicaId).telefono, null);
  });

  it('[002:FR-009] un teléfono inválido se rechaza', () => {
    const r = crearClinica(e.db, { nombre: 'Mala', clave: 'clave-mala-1', telefono: '123' });
    assert.equal(r.ok, false);
    assert.ok(r.errores.telefono);
  });
});
