import { formatearTelefono } from '../domain/pacientes.js';
import { formatoFechaHora } from '../domain/tiempo.js';
import { textosCorreo as t } from './textos.js';

// Composición y serialización del mensaje de recordatorio como fichero .eml (003, contracts/correo-eml.md).
const CRLF = '\r\n';
const dos = (n) => String(n).padStart(2, '0');

/** Una cabecera no puede llevar saltos de línea: evita que un dato inyecte cabeceras. */
const lineaUnica = (texto) => String(texto ?? '').replace(/[\r\n]+/g, ' ').trim();

/** Palabras codificadas (RFC 2047, UTF-8 en base64), de como mucho 60 caracteres (con el nombre de la cabecera la línea no pasa de 78) cada una. */
export function palabrasCodificadas(texto) {
  const trozos = [];
  let actual = '';
  for (const caracter of lineaUnica(texto)) {
    if (Buffer.byteLength(actual + caracter) > 36) {
      trozos.push(actual);
      actual = '';
    }
    actual += caracter;
  }
  if (actual) trozos.push(actual);
  return trozos.map((x) => `=?UTF-8?B?${Buffer.from(x, 'utf8').toString('base64')}?=`).join(`${CRLF} `);
}

const fechaRfc5322 = (instante) => instante.toUTCString().replace('GMT', '+0000');

/** AAAAMMDDTHHMMZ del instante, en UTC. */
export function sello(instante) {
  return (
    `${instante.getUTCFullYear()}${dos(instante.getUTCMonth() + 1)}${dos(instante.getUTCDate())}` +
    `T${dos(instante.getUTCHours())}${dos(instante.getUTCMinutes())}Z`
  );
}

/** Nombre estable y único por cita y hora de inicio; sin nombres ni emails (FR-020). */
export const nombreDeFichero = (citaId, inicio) => `cita-${citaId}-${sello(inicio)}.eml`;

function base64EnLineas(texto) {
  const base64 = Buffer.from(texto, 'utf8').toString('base64');
  return base64.match(/.{1,76}/g)?.join(CRLF) ?? '';
}

/**
 * Compone el recordatorio. `secreto` es el del enlace de cancelación (solo vive en el fichero).
 * Devuelve `{ nombreFichero, contenido }`.
 */
export function componerRecordatorio({ clinica, paciente, cita, urlPublica, secreto, generadoEn, remitente }) {
  const cuando = formatoFechaHora(cita.inicio);
  const telefono = clinica.telefono ? formatearTelefono(clinica.telefono) : null;
  const enlace = `${urlPublica}/cancelar/${secreto}`;

  const cuerpo = [
    t.saludo(lineaUnica(paciente.nombre)),
    '',
    t.intro(lineaUnica(clinica.nombre)),
    '',
    `  ${t.etiquetas.cuando}: ${cuando} ${t.horaDeEspana}`,
    `  ${t.etiquetas.profesional}: ${lineaUnica(cita.profesional)}`,
    `  ${t.etiquetas.servicio}: ${lineaUnica(cita.servicio)}`,
    '',
    ...t.avisoCancelar,
    '',
    enlace,
    '',
    t.contacto(telefono),
    '',
    t.despedida,
    lineaUnica(clinica.nombre),
    '',
  ].join(CRLF);

  const cabeceras = [
    `From: ${palabrasCodificadas(clinica.nombre)} <${lineaUnica(remitente)}>`,
    `To: ${lineaUnica(paciente.email)}`,
    `Subject: ${palabrasCodificadas(t.asunto(lineaUnica(clinica.nombre), cuando))}`,
    `Date: ${fechaRfc5322(generadoEn)}`,
    `Message-ID: <recordatorio-${cita.id}-${sello(cita.inicio)}@citaclara.invalid>`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=utf-8',
    'Content-Transfer-Encoding: base64',
    'X-CitaClara-Modo: simulado',
  ];

  return {
    nombreFichero: nombreDeFichero(cita.id, cita.inicio),
    contenido: `${cabeceras.join(CRLF)}${CRLF}${CRLF}${base64EnLineas(cuerpo)}${CRLF}`,
  };
}
