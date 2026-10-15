import { mkdirSync, renameSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

// Salida de correo simulada (003, research D3): cada mensaje es un fichero .eml en una carpeta.
// Es el único sitio que conoce la carpeta; si algún día hay correo real, solo cambia este módulo.

/**
 * Escribe el fichero de forma atómica (temporal + renombrado) y devuelve su nombre.
 * Si falla, lanza un error con un mensaje claro y no deja ficheros a medias.
 */
export function escribirSimulado(carpeta, nombreFichero, contenido) {
  const destino = join(carpeta, nombreFichero);
  const temporal = join(carpeta, `.${nombreFichero}.${process.pid}.tmp`);
  try {
    mkdirSync(carpeta, { recursive: true });
    writeFileSync(temporal, contenido, 'utf8');
    renameSync(temporal, destino);
  } catch (error) {
    try {
      rmSync(temporal, { force: true });
    } catch {
      // nada que limpiar
    }
    throw new Error(`No se pudo escribir ${nombreFichero} en ${carpeta}: ${error.message}`);
  }
  return nombreFichero;
}
