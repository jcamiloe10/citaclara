// Comprueba que cada regla de negocio, requisito funcional y escenario de aceptación de la spec
// aparece entre corchetes en el nombre de algún test (Principio VI, SC-008).
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

// Identificadores que son solo un límite de alcance, sin comportamiento que probar, por spec.
// FR-008 de la 001 ("fuera de la 001") no tiene prueba posible; FR-008 de la 004 sí la tiene
// (es "sin datos en el periodo") y por tanto NO se excluye: la exclusión es por spec, nunca global.
const EXCLUIDOS_POR_SPEC = { '001-agenda-core': new Set(['FR-008']) };

/** Extrae de la spec los identificadores exigibles y los alias RN↔FR. */
export function extraerRequisitos(spec, excluidos = new Set()) {
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

const ID = '(?:RN\\d|FR-\\d{3}[a-z]?|SC-\\d{3}|US\\d+-E\\d+)';

/**
 * Identificadores entre corchetes que aparecen en el texto de los tests. Cada spec reinicia su
 * propia numeración (FR-001, US1-E1…), así que a partir de la 004 los test exigen el prefijo de
 * su carpeta (p. ej. `[004-FR-004]`) para no confundirse con el FR-004 de otra spec; la 001 es la
 * única que conserva sus etiquetas sin prefijo, por ser anterior a que existiera más de una spec
 * (research.md de la 004, D6) y estar cerrada.
 */
export function extraerEtiquetas(textoTests, prefijo) {
  const patron = prefijo ? new RegExp(`\\[${prefijo}-(${ID})\\]`, 'g') : new RegExp(`\\[(${ID})\\]`, 'g');
  return new Set([...textoTests.matchAll(patron)].map((m) => m[1]));
}

export function analizar(spec, textoTests, { prefijo, excluidos } = {}) {
  const { ids, alias } = extraerRequisitos(spec, excluidos);
  const etiquetas = extraerEtiquetas(textoTests, prefijo);
  const cubiertos = new Set(etiquetas);
  for (const e of etiquetas) if (alias.has(e)) cubiertos.add(alias.get(e));
  return { total: ids.length, sinCobertura: ids.filter((id) => !cubiertos.has(id)) };
}

/** Prefijo de una carpeta de spec (p. ej. "004" de "004-citaclara-analitica"), o null para la 001 (sin prefijo, D6). */
export function prefijoDe(nombreSpec) {
  if (nombreSpec === '001-agenda-core') return null;
  return /^(\d+)-/.exec(nombreSpec)?.[1] ?? null;
}

function ficherosDeTest(dir) {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) return ficherosDeTest(ruta);
    return nombre.endsWith('.test.js') ? [ruta] : [];
  });
}

/** Todas las specs del repositorio: cada carpeta de `specs/` que tenga su propio `spec.md`. */
export function ficherosDeSpec(dirSpecs) {
  return readdirSync(dirSpecs)
    .map((nombre) => join(dirSpecs, nombre, 'spec.md'))
    .filter((ruta) => {
      try {
        return statSync(ruta).isFile();
      } catch {
        return false;
      }
    });
}

const esPrincipal = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (esPrincipal) {
  const raiz = resolve(fileURLToPath(new URL('..', import.meta.url)));
  const textoTests = ficherosDeTest(join(raiz, 'tests'))
    .map((f) => readFileSync(f, 'utf8'))
    .join('\n');

  let totalGeneral = 0;
  let faltaAlguna = false;
  for (const rutaSpec of ficherosDeSpec(join(raiz, 'specs'))) {
    const nombreSpec = rutaSpec.split(/[\\/]/).at(-2);
    const spec = readFileSync(rutaSpec, 'utf8');
    const { total, sinCobertura } = analizar(spec, textoTests, {
      prefijo: prefijoDe(nombreSpec),
      excluidos: EXCLUIDOS_POR_SPEC[nombreSpec],
    });
    totalGeneral += total;
    if (sinCobertura.length) {
      faltaAlguna = true;
      console.error(
        `${nombreSpec}: sin test que los referencie (${sinCobertura.length} de ${total}):\n  ${sinCobertura.join('\n  ')}`,
      );
    } else {
      console.log(`${nombreSpec}: trazabilidad correcta (${total} identificadores).`);
    }
  }
  if (faltaAlguna) process.exit(1);
  console.log(`Trazabilidad correcta en todas las specs: ${totalGeneral} identificadores con al menos un test.`);
}
