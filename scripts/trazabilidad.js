// Comprueba que cada regla de negocio, requisito funcional y escenario de aceptación de cada spec
// aparece entre corchetes en el nombre de algún test (Principio VI, SC-008 de la 001, SC-009 de la 002).
//
// Los identificadores de la 001 se etiquetan sin prefijo ([FR-011], [US1-E2]); los de la 002 llevan
// el prefijo "002:" ([002:FR-011], [002:US1-E2]) los de la 003 el prefijo "003:" y los de la 004 el prefijo "004:", porque ambas specs usan la misma numeración.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// FR-008 de la 001 es un límite de alcance: no hay comportamiento que probar.
const EXCLUIDOS_001 = new Set(['FR-008']);

/** Specs comprobadas: ruta, prefijo de las etiquetas y requisitos que no exigen test. */
export const SPECS = [
  { ruta: 'specs/001-agenda-core/spec.md', prefijo: '', excluidos: EXCLUIDOS_001 },
  { ruta: 'specs/002-portal-del-paciente/spec.md', prefijo: '002:', excluidos: new Set() },
  // FR-022 (límite de alcance) y FR-023 (gobierno) de la 003 no tienen comportamiento que probar.
  { ruta: 'specs/003-recordatorios-cita/spec.md', prefijo: '003:', excluidos: new Set(['FR-022', 'FR-023']) },
  // La 004 es de solo lectura y no excluye ningún requisito: su FR-008 ("sin datos") sí se prueba.
  { ruta: 'specs/004-citaclara-analitica/spec.md', prefijo: '004:', excluidos: new Set() },
];

/** Extrae de la spec los identificadores exigibles y los alias RN↔FR. */
export function extraerRequisitos(spec, excluidos = EXCLUIDOS_001) {
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
  for (const id of excluidos) ids.delete(id);
  return { ids: [...ids].sort(), alias };
}

/** Identificadores entre corchetes (con el prefijo dado) que aparecen en el texto de los tests. */
export function extraerEtiquetas(textoTests, prefijo = '') {
  const literal = prefijo.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const patron = new RegExp(`\\[${literal}((?:RN\\d|FR-\\d{3}[a-z]?|SC-\\d{3}|US\\d+-E\\d+))\\]`, 'g');
  return new Set([...textoTests.matchAll(patron)].map((m) => m[1]));
}

export function analizar(spec, textoTests, { prefijo = '', excluidos = EXCLUIDOS_001 } = {}) {
  const { ids, alias } = extraerRequisitos(spec, excluidos);
  const etiquetas = extraerEtiquetas(textoTests, prefijo);
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
  const textoTests = ficherosDeTest(join(raiz, 'tests'))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');
  let fallo = false;
  for (const { ruta, prefijo, excluidos } of SPECS) {
    const spec = readFileSync(join(raiz, ruta), 'utf8');
    const { total, sinCobertura } = analizar(spec, textoTests, { prefijo, excluidos });
    if (sinCobertura.length) {
      fallo = true;
      console.error(`${ruta}: sin test que los referencie (${sinCobertura.length} de ${total}):\n  ${sinCobertura.join('\n  ')}`);
    } else {
      console.log(`${ruta}: trazabilidad correcta, ${total} identificadores con al menos un test.`);
    }
  }
  if (fallo) process.exit(1);
}
