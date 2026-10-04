// Comprueba que cada regla de negocio, requisito funcional y escenario de aceptación de la spec
// aparece entre corchetes en el nombre de algún test (Principio VI, SC-008).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// FR-008 es un límite de alcance: no hay comportamiento que probar.
const EXCLUIDOS = new Set(['FR-008']);

/** Extrae de la spec los identificadores exigibles y los alias RN↔FR. */
export function extraerRequisitos(spec) {
  const ids = new Set();
  const alias = new Map();

  for (const m of spec.matchAll(/^- \*\*(?:(RN\d) \/ )?(FR-\d{3}[a-z]?)\*\*/gm)) {
    const [, rn, fr] = m;
    ids.add(fr);
    if (rn) {
      ids.add(rn);
      alias.set(rn, fr);
      alias.set(fr, rn);
    }
  }

  let historia = 0;
  let enEscenarios = false;
  for (const linea of spec.split('\n')) {
    const h = /^### User Story (\d+)/.exec(linea);
    if (h) {
      historia = Number(h[1]);
      enEscenarios = false;
    } else if (/^\*\*Acceptance Scenarios\*\*/.test(linea)) {
      enEscenarios = true;
    } else if (/^---\s*$/.test(linea) || /^## /.test(linea)) {
      enEscenarios = false;
    } else if (enEscenarios) {
      const e = /^(\d+)\. \*\*Given/.exec(linea);
      if (e) ids.add(`US${historia}-E${e[1]}`);
    }
  }
  for (const id of EXCLUIDOS) ids.delete(id);
  return { ids: [...ids].sort(), alias };
}

/** Identificadores entre corchetes que aparecen en el texto de los tests. */
export function extraerEtiquetas(textoTests) {
  return new Set([...textoTests.matchAll(/\[((?:RN\d|FR-\d{3}[a-z]?|SC-\d{3}|US\d+-E\d+))\]/g)].map((m) => m[1]));
}

export function analizar(spec, textoTests) {
  const { ids, alias } = extraerRequisitos(spec);
  const etiquetas = extraerEtiquetas(textoTests);
  const cubiertos = new Set(etiquetas);
  for (const e of etiquetas) if (alias.has(e)) cubiertos.add(alias.get(e));
  return { total: ids.length, sinCobertura: ids.filter((id) => !cubiertos.has(id)) };
}

function ficherosDeTest(dir) {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return ficherosDeTest(ruta);
    return nombre.endsWith('.test.js') ? [ruta] : [];
  });
}

const esPrincipal = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (esPrincipal) {
  const raiz = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const spec = readFileSync(join(raiz, 'specs/001-agenda-core/spec.md'), 'utf8');
  const textoTests = ficherosDeTest(join(raiz, 'tests'))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
  const { total, sinCobertura } = analizar(spec, textoTests);
  if (sinCobertura.length) {
    console.error(`Sin test que los referencie (${sinCobertura.length} de ${total}):\n  ${sinCobertura.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`Trazabilidad correcta: ${total} identificadores de la spec con al menos un test.`);
}
