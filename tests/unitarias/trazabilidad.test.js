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
