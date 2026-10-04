import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';

export const config = {
  puerto: Number(process.env.PORT) || 3000,
  rutaBase: resolve(process.env.CITACLARA_BASE || 'data/citaclara.db'),
  // Sin secreto en el entorno, las sesiones se pierden al reiniciar (aceptable en desarrollo).
  secreto: process.env.CITACLARA_SECRETO || randomBytes(32).toString('hex'),
};
