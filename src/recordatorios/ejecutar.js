// Proceso diario de recordatorios (003, contracts/proceso-diario.md).
// Uso: npm run recordatorios [-- --ahora=AAAA-MM-DDTHH:MM]   (la hora es la de España)
// Salida: 0 todo bien · 1 algún recordatorio falló · 2 argumento no válido o base no disponible.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { config } from '../config.js';
import { escribirSimulado } from '../correo/salida-simulada.js';
import { abrirBase } from '../db/connection.js';
import { generarRecordatorios, ventanaDeRecordatorio } from '../domain/recordatorios.js';
import { aInstanteUTC, ahoraReal, formatoFechaHora } from '../domain/tiempo.js';

const RE_AHORA = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})$/;

/** Interpreta `--ahora=...`; devuelve el instante, `null` si no se indicó, o `undefined` si no es válido. */
export function leerAhora(argumentos) {
  const arg = argumentos.find((a) => a.startsWith('--ahora'));
  if (!arg) return null;
  const m = RE_AHORA.exec(arg.split('=')[1] ?? '');
  return (m && aInstanteUTC(m[1], m[2])) || undefined;
}

/** Ejecuta el proceso y devuelve `{ codigo, lineas }` (la consola la escribe quien llama). */
export function ejecutar({ argumentos = [], ruta = config.rutaBase, carpeta = config.carpetaCorreo } = {}) {
  const fijado = leerAhora(argumentos);
  if (fijado === undefined) {
    return { codigo: 2, lineas: ['Argumento no válido: usa --ahora=AAAA-MM-DDTHH:MM (hora de España).'] };
  }
  let db;
  try {
    db = abrirBase(ruta);
  } catch (error) {
    return { codigo: 2, lineas: [`No se pudo abrir la base de datos: ${error.message}`] };
  }
  try {
    const instante = fijado ?? ahoraReal();
    const resumen = generarRecordatorios(db, {
      ahora: () => instante,
      salida: (nombre, contenido) => escribirSimulado(carpeta, nombre, contenido),
      urlPublica: config.urlPublica ?? `http://localhost:${config.puerto}`,
      remitente: config.remitente,
    });
    const { desde, hasta } = ventanaDeRecordatorio(instante);
    const lineas = [
      'Recordatorios de citas · modo simulado (los correos se escriben como ficheros, no se envían)',
      `Instante de referencia: ${formatoFechaHora(instante)} (hora de España)`,
      `Ventana: del ${formatoFechaHora(desde)} al ${formatoFechaHora(hasta)}`,
      `Generados: ${resumen.generados}`,
      `Sin email: ${resumen.sinEmail}`,
      `Fallidos: ${resumen.fallidos}`,
      `Ya recordadas antes: ${resumen.yaRecordadas}`,
      `Carpeta de salida: ${carpeta}`,
      ...resumen.fallos.map((f) => `  Cita ${f.citaId}: ${f.motivo}`),
    ];
    return { codigo: resumen.fallidos > 0 ? 1 : 0, lineas, resumen };
  } finally {
    db.close();
  }
}

const esPrincipal = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (esPrincipal) {
  const { codigo, lineas } = ejecutar({ argumentos: process.argv.slice(2) });
  for (const l of lineas) console.log(l);
  process.exit(codigo);
}
