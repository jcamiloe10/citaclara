import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { textos } from './textos.js';

export const NOMBRE_COOKIE = 'citaclara_sesion';
export const DURACION_SESION_MS = 12 * 60 * 60 * 1000; // FR-002b

const firmar = (secreto, texto) => createHmac('sha256', secreto).update(texto).digest('base64url');

function iguales(a, b) {
  const x = Buffer.from(String(a));
  const y = Buffer.from(String(b));
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Valor de la cookie de sesión: clínica, caducidad y token CSRF, firmados con HMAC. */
export function emitirSesion({ clinicaId, nombre }, secreto, ahora) {
  const carga = {
    c: clinicaId,
    n: nombre,
    e: ahora().getTime() + DURACION_SESION_MS,
    t: randomBytes(16).toString('hex'),
  };
  const cuerpo = Buffer.from(JSON.stringify(carga)).toString('base64url');
  return `${cuerpo}.${firmar(secreto, cuerpo)}`;
}

export function leerSesion(valor, secreto, ahora) {
  if (typeof valor !== 'string') return null;
  const [cuerpo, firma] = valor.split('.');
  if (!cuerpo || !firma || !iguales(firma, firmar(secreto, cuerpo))) return null;
  try {
    const carga = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'));
    if (typeof carga.e !== 'number' || carga.e <= ahora().getTime()) return null;
    return { clinicaId: carga.c, nombre: carga.n, csrf: carga.t };
  } catch {
    return null;
  }
}

function leerCookies(cabecera = '') {
  return Object.fromEntries(
    cabecera
      .split(';')
      .map((p) => p.trim())
      .filter(Boolean)
      .map((p) => {
        const i = p.indexOf('=');
        return [p.slice(0, i), decodeURIComponent(p.slice(i + 1))];
      }),
  );
}

export const cookieDeSesion = (valor) =>
  `${NOMBRE_COOKIE}=${encodeURIComponent(valor)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DURACION_SESION_MS / 1000}`;

export const cookieBorrada = () => `${NOMBRE_COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;

/** Carga la sesión de la cookie (si es válida y no ha caducado) en `req.sesion`. */
export function cargarSesion({ secreto, ahora }) {
  return (req, _res, next) => {
    const cookies = leerCookies(req.headers.cookie);
    req.sesion = leerSesion(cookies[NOMBRE_COOKIE], secreto, ahora);
    next();
  };
}

/** Sin sesión válida no se devuelve ningún dato de la clínica (FR-001). */
export function exigirSesion(req, res, next) {
  if (!req.sesion) return res.redirect(303, '/acceso');
  next();
}

export function exigirCsrf(req, res, next) {
  const enviado = req.body?.csrf;
  if (!req.sesion || typeof enviado !== 'string' || !iguales(enviado, req.sesion.csrf)) {
    return res.status(403).type('html').send(
      `<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${textos.errores.formularioCaducado}</title><p>${textos.errores.formularioCaducado}</p><p><a href="/agenda">${textos.volverAgenda}</a></p></html>`,
    );
  }
  next();
}
