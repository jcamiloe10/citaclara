// Ayudas comunes de las pruebas de recordatorios (003).
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { escribirSimulado } from '../../src/correo/salida-simulada.js';
import { generarRecordatorios } from '../../src/domain/recordatorios.js';
import { en } from '../ayudas/fixture.js';

export const URL_PUBLICA = 'http://localhost:3000';
export const REMITENTE = 'no-responder@citaclara.invalid';

/** Ejecuta el proceso diario escribiendo en la carpeta de salida dada (o con la `salida` indicada). */
export function generar(e, carpeta, { salida, ahora = e.ahora } = {}) {
  return generarRecordatorios(e.db, {
    ahora,
    salida: salida ?? ((nombre, contenido) => escribirSimulado(carpeta.ruta, nombre, contenido)),
    urlPublica: URL_PUBLICA,
    remitente: REMITENTE,
  });
}

/** Inserta una cita reservada de 45 minutos (sesión de fisioterapia con María) en el día y hora de España. */
export function citaA(e, dia, hora, { paciente = e.pacientes[0], profesional = e.profesionales.maria, estado = 'reservada' } = {}) {
  const inicio = en(dia, hora);
  return e.insertarCita({
    profesional,
    servicio: e.servicios.sesion,
    paciente,
    inicio,
    fin: new Date(inicio.getTime() + 45 * 60_000),
    estado,
  });
}

export const ficheros = (carpeta) => readdirSync(carpeta.ruta).filter((f) => f.endsWith('.eml')).sort();

/** Decodifica un .eml: cabeceras (con palabras codificadas resueltas) y cuerpo. */
export function leerEml(carpeta, nombre) {
  const bruto = readFileSync(join(carpeta.ruta, nombre), 'utf8');
  return decodificarEml(bruto);
}

export function decodificarEml(bruto) {
  const [cabeceraBruta, ...resto] = bruto.split('\r\n\r\n');
  const cabeceras = {};
  for (const linea of cabeceraBruta.replace(/\r\n[ \t]+/g, ' ').split('\r\n')) {
    const i = linea.indexOf(':');
    cabeceras[linea.slice(0, i)] = linea
      .slice(i + 1)
      .trim()
      .replace(/(=\?UTF-8\?B\?[^?]*\?=)\s+(?==\?UTF-8\?B\?)/g, '$1')
      .replace(/=\?UTF-8\?B\?([^?]*)\?=/g, (_, b64) => Buffer.from(b64, 'base64').toString('utf8'));
  }
  const cuerpo = Buffer.from(resto.join('\r\n\r\n').replace(/\s+/g, ''), 'base64').toString('utf8');
  return { bruto, cabeceras, cuerpo };
}

/** Secreto del enlace de cancelación contenido en un cuerpo decodificado. */
export const secretoDe = (cuerpo) => /\/cancelar\/([A-Za-z0-9_-]{43})/.exec(cuerpo)?.[1];

/** Secreto del enlace del recordatorio generado para una cita (leído de su .eml). */
export function secretoDeCita(e, carpeta, citaId) {
  const fila = e.db.prepare("SELECT fichero FROM recordatorio WHERE cita_id = ? AND resultado = 'generado'").get(citaId);
  return secretoDe(leerEml(carpeta, fila.fichero).cuerpo);
}
