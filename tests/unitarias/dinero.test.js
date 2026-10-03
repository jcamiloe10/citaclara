import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { formatearEuros } from '../../src/domain/dinero.js';

const sinNbsp = (t) => t.replace(/ /g, ' ');

describe('Dinero', () => {
  it('[FR-015] muestra los precios de los servicios al céntimo, con formato de euros de España', () => {
    assert.equal(sinNbsp(formatearEuros(4000)), '40,00 €');
    assert.equal(sinNbsp(formatearEuros(5000)), '50,00 €');
    assert.equal(sinNbsp(formatearEuros(3500)), '35,00 €');
    assert.equal(sinNbsp(formatearEuros(4500)), '45,00 €');
    assert.equal(sinNbsp(formatearEuros(1999)), '19,99 €');
    assert.equal(sinNbsp(formatearEuros(5)), '0,05 €');
  });

  it('[FR-006] rechaza importes con decimales o negativos', () => {
    assert.throws(() => formatearEuros(40.5), RangeError);
    assert.throws(() => formatearEuros(-1), RangeError);
    assert.throws(() => formatearEuros('4000'), RangeError);
  });
});
