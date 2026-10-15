import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analizar, SPECS } from '../../../scripts/trazabilidad.js';

const SPEC = `
### User Story 1 - Recordar (Priority: P1)

**Acceptance Scenarios**:

1. **Given** a, **When** b, **Then** c.
2. **Given** a, **When** b, **Then** c.

---

## Requirements

- **FR-001**: algo.
- **FR-022**: límite de alcance.
`;

const opciones = { prefijo: '003:', excluidos: new Set(['FR-022']) };

describe('Trazabilidad de la 003', () => {
  it('[003:SC-008] la 003 está en la lista de specs comprobadas, con su prefijo y sin exigir FR-022 ni FR-023', () => {
    const entrada = SPECS.find((s) => s.ruta === 'specs/003-recordatorios-cita/spec.md');
    assert.ok(entrada);
    assert.equal(entrada.prefijo, '003:');
    assert.ok(entrada.excluidos.has('FR-022') && entrada.excluidos.has('FR-023'));
  });

  it('[003:SC-008] falla con los identificadores de la 003 que ningún test referencia con el prefijo', () => {
    const r = analizar(SPEC, "it('[003:FR-001] x'); it('[003:US1-E1] y');", opciones);
    assert.deepEqual(r.sinCobertura, ['US1-E2']);
  });

  it('[003:SC-008] pasa cuando todos llevan el prefijo, sin exigir los excluidos', () => {
    const r = analizar(SPEC, '[003:FR-001] [003:US1-E1] [003:US1-E2]', opciones);
    assert.deepEqual(r.sinCobertura, []);
  });

  it('[003:SC-008] una etiqueta sin prefijo o con el de otra spec no cubre la 003', () => {
    const r = analizar(SPEC, '[FR-001] [002:FR-001] [US1-E1] [002:US1-E2]', opciones);
    assert.deepEqual(r.sinCobertura, ['FR-001', 'US1-E1', 'US1-E2']);
  });

  it('[003:SC-008] una etiqueta con el prefijo 003: no cubre los identificadores de la 001 ni de la 002', () => {
    const sin = analizar(SPEC, '[003:FR-001] [003:US1-E1] [003:US1-E2]', { prefijo: '', excluidos: new Set(['FR-022']) });
    assert.deepEqual(sin.sinCobertura, ['FR-001', 'US1-E1', 'US1-E2']);
    const dos = analizar(SPEC, '[003:FR-001]', { prefijo: '002:', excluidos: new Set(['FR-022']) });
    assert.deepEqual(dos.sinCobertura, ['FR-001', 'US1-E1', 'US1-E2']);
  });
});
