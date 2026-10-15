import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { analizar, ficherosDeSpec, prefijoDe } from '../../scripts/trazabilidad.js';

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
    const r = analizar(SPEC, "it('[FR-001] x'); it('[US1-E1] y');", { excluidos: new Set(['FR-008']) });
    assert.deepEqual(r.sinCobertura, ['FR-002b', 'FR-016', 'RN1', 'US1-E2']);
  });

  it('[SC-008] pasa cuando todos están cubiertos, resolviendo alias y sufijos, y excluyendo FR-008 explícitamente', () => {
    const r = analizar(SPEC, "[FR-001] [FR-002b] [RN1] [US1-E1] [US1-E2]", { excluidos: new Set(['FR-008']) });
    assert.deepEqual(r.sinCobertura, []);
  });

  it('[SC-008] sin excluidos explícitos, FR-008 sí se exige (la exclusión es por spec, nunca global)', () => {
    const r = analizar(SPEC, "[FR-001] [FR-002b] [RN1] [US1-E1] [US1-E2]");
    assert.deepEqual(r.sinCobertura, ['FR-008']);
  });

  it('[SC-008] con prefijo, solo cuentan las etiquetas de esa spec (p. ej. [004-FR-001], no el [FR-001] de otra)', () => {
    const r = analizar(SPEC, "[FR-001] [FR-002b] [RN1] [US1-E1] [US1-E2]", { prefijo: '004', excluidos: new Set(['FR-008']) });
    // Las etiquetas están sin prefijo: con prefijo exigido, ninguna cuenta como cobertura.
    assert.deepEqual(r.sinCobertura, ['FR-001', 'FR-002b', 'FR-016', 'RN1', 'US1-E1', 'US1-E2']);
    const r2 = analizar(SPEC, "[004-FR-001] [004-FR-002b] [004-RN1] [004-US1-E1] [004-US1-E2]", {
      prefijo: '004',
      excluidos: new Set(['FR-008']),
    });
    assert.deepEqual(r2.sinCobertura, []);
  });

  it('[SC-008] encuentra el spec.md de cada carpeta de specs/, ignorando las que no tienen uno', () => {
    const raiz = mkdtempSync(join(tmpdir(), 'citaclara-trazabilidad-'));
    try {
      mkdirSync(join(raiz, '001-agenda-core'));
      writeFileSync(join(raiz, '001-agenda-core', 'spec.md'), '# uno');
      mkdirSync(join(raiz, '004-citaclara-analitica'));
      writeFileSync(join(raiz, '004-citaclara-analitica', 'spec.md'), '# dos');
      writeFileSync(join(raiz, 'MAPA.md'), '# no es una carpeta de spec');
      const rutas = ficherosDeSpec(raiz).map((r) => r.split(/[\\/]/).at(-2)).sort();
      assert.deepEqual(rutas, ['001-agenda-core', '004-citaclara-analitica']);
    } finally {
      rmSync(raiz, { recursive: true, force: true });
    }
  });

  it('[SC-008] prefijoDe: la 001 no lleva prefijo (grandfathered); las demás usan su número de carpeta', () => {
    assert.equal(prefijoDe('001-agenda-core'), null);
    assert.equal(prefijoDe('004-citaclara-analitica'), '004');
    assert.equal(prefijoDe('012-lo-que-sea'), '012');
  });
});
