import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { analizar } from '../../scripts/trazabilidad.js';

const SPEC = `
### User Story 1 - Reservar (Priority: P1)

**Acceptance Scenarios**:

1. **Given** a, **When** b, **Then** c.
2. **Given** a, **When** b, **Then** c.

---

## Requirements

- **FR-001**: algo.
- **FR-002b**: algo más.
- **FR-008**: límite de alcance.
- **RN1 / FR-016**: sin solape.
`;

describe('Trazabilidad spec ↔ tests', () => {
  it('[SC-008] falla con los identificadores de la spec que ningún test referencia', () => {
    const r = analizar(SPEC, "it('[FR-001] x'); it('[US1-E1] y');");
    assert.deepEqual(r.sinCobertura, ['FR-002b', 'FR-016', 'RN1', 'US1-E2']);
  });

  it('[SC-008] pasa cuando todos están cubiertos, resolviendo alias y sufijos, y sin exigir FR-008', () => {
    const r = analizar(SPEC, "[FR-001] [FR-002b] [RN1] [US1-E1] [US1-E2]");
    assert.deepEqual(r.sinCobertura, []);
  });
});

const SPEC_002 = `
### User Story 1 - Ver (Priority: P1)

**Acceptance Scenarios**:

1. **Given** a, **When** b, **Then** c.

---

## Requirements

- **FR-001**: algo.
- **FR-008**: esta sí exige test en la 002.
`;

describe('Trazabilidad de la 002 con prefijo', () => {
  const opciones = { prefijo: '002:', excluidos: new Set() };

  it('[002:SC-009] falla con los identificadores de la 002 que ningún test referencia con el prefijo', () => {
    const r = analizar(SPEC_002, "it('[002:FR-001] x');", opciones);
    assert.deepEqual(r.sinCobertura, ['FR-008', 'US1-E1']);
  });

  it('[002:SC-009] pasa cuando todos llevan el prefijo, incluido FR-008, que en la 002 no se excluye', () => {
    const r = analizar(SPEC_002, '[002:FR-001] [002:FR-008] [002:US1-E1]', opciones);
    assert.deepEqual(r.sinCobertura, []);
  });

  it('[002:SC-009] una etiqueta sin prefijo (de la 001) no cubre el identificador de la 002 y viceversa', () => {
    assert.deepEqual(analizar(SPEC_002, '[FR-001] [FR-008] [US1-E1]', opciones).sinCobertura, ['FR-001', 'FR-008', 'US1-E1']);
    assert.deepEqual(analizar(SPEC, '[002:FR-001] [002:FR-002b] [002:RN1] [002:US1-E1] [002:US1-E2]').sinCobertura, [
      'FR-001', 'FR-002b', 'FR-016', 'RN1', 'US1-E1', 'US1-E2',
    ]);
  });
});
