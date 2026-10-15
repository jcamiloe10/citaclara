import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

export const config = {
  puerto: Number(process.env.PORT) || 3000,
  rutaBase: resolve(process.env.CITACLARA_BASE || 'data/citaclara.db'),
  // Sin secreto en el entorno, las sesiones se pierden al reiniciar (aceptable en desarrollo).
  // Dirección pública para componer los enlaces de los pacientes; sin ella se usa la de la petición.
  urlPublica: (process.env.CITACLARA_URL_PUBLICA || '').replace(/\/+$/, '') || null,
  // Recordatorios (003): el correo es simulado, así que cada mensaje se escribe como un fichero .eml.
  carpetaCorreo: resolve(process.env.CITACLARA_SALIDA_CORREO || 'datos/salida-correo'),
  remitente: process.env.CITACLARA_REMITENTE || 'no-responder@citaclara.invalid',
  secreto: process.env.CITACLARA_SECRETO || randomBytes(32).toString('hex'),
};
