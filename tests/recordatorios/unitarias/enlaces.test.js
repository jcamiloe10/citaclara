import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FORMATO_SECRETO, huellaDeSecreto, nuevoSecreto } from '../../../src/domain/enlaces.js';

describe('Secreto del enlace de cancelación', () => {
  it('[003:FR-010] los secretos son distintos entre sí (1000 muestras), de 43 caracteres y sin datos legibles', () => {
    const muestras = Array.from({ length: 1000 }, () => nuevoSecreto());
    assert.equal(new Set(muestras).size, 1000);
    for (const s of muestras) {
      assert.equal(s.length, 43);
      assert.match(s, FORMATO_SECRETO);
    }
  });

  it('[003:FR-010] la huella es determinista y distinta del secreto, y no lo contiene', () => {
    const s = nuevoSecreto();
    assert.equal(huellaDeSecreto(s), huellaDeSecreto(s));
    assert.notEqual(huellaDeSecreto(s), s);
    assert.equal(huellaDeSecreto(s).length, 64);
    assert.ok(!huellaDeSecreto(s).includes(s));
  });

  it('[003:FR-015] los formatos no válidos se rechazan sin lanzar error', () => {
    for (const malo of ['', 'corto', 'a'.repeat(44), 'a'.repeat(42), `${'a'.repeat(42)}!`, null, undefined, 42]) {
      assert.equal(FORMATO_SECRETO.test(malo), false);
    }
  });
});
