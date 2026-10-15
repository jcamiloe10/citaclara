import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const TRABAJADOR = fileURLToPath(new URL('./trabajador.js', import.meta.url));

/** Un proceso hijo por operación; todos arrancan a la vez y se devuelven sus resultados. */
export async function lanzarJuntos(e, operaciones, extra = {}) {
  const arranque = Date.now() + 1500 + operaciones.length * 40;
  return Promise.all(
    operaciones.map(
      (op) =>
        new Promise((resolver, rechazar) => {
          const parametros = JSON.stringify({
            ruta: e.ruta,
            clinicaId: e.clinicaId,
            ahora: e.ahora().toISOString(),
            arranque,
            ...extra,
            ...op,
          });
          execFile(
            process.execPath,
            ['--disable-warning=ExperimentalWarning', TRABAJADOR, parametros],
            { timeout: 60_000 },
            (error, salida, errores) =>
              error ? rechazar(new Error(`${error.message}\n${errores}`)) : resolver(JSON.parse(salida)),
          );
        }),
    ),
  );
}
