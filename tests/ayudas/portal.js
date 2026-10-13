// Entorno de pruebas del portal (002): la semilla de demostración con ancla 2026-09-28 y el reloj
// fijo en jueves 1 de octubre de 2026, 10:00 (hora de España). Casos: ficha 8 = Claudia Rodríguez
// Pérez, ficha 13 = Claudia Ruiz Romero, ficha 26 = Claudia Jiménez Ruiz.
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crearApp } from '../../src/app.js';
import { abrirBase } from '../../src/db/connection.js';
import { crearClinica } from '../../src/domain/clinicas.js';
import { crearOrenovarEnlace } from '../../src/domain/enlaces.js';
import { cargarSemilla } from '../../src/seed/seed.js';
import { secretoDeDemostracion } from '../../src/seed/datos.js';
import { crearReloj, SECRETO } from './fixture.js';

export const CLAUDIA = 8;
export const CLAUDIA_RUIZ = 13;
export const secretoDemo = secretoDeDemostracion;

export function entornoConSemilla({ reloj = crearReloj('2026-10-01', '10:00') } = {}) {
  const directorio = mkdtempSync(join(tmpdir(), 'citaclara-portal-'));
  const ruta = join(directorio, 'prueba.db');
  const db = abrirBase(ruta);
  const resumen = cargarSemilla(db, { ancla: '2026-09-28' });
  return {
    db,
    ruta,
    reloj,
    ahora: reloj.ahora,
    clinicaId: resumen.clinicaId,
    resumen,
    claveRecepcion: 'eleva-demo',
    /** Segunda clínica con un paciente que tiene enlace, para comprobar el aislamiento. */
    crearOtraClinica() {
      const { clinica } = crearClinica(db, { nombre: 'Clínica Otra', clave: 'clave-otra-2', telefono: '911000000' });
      const { lastInsertRowid } = db
        .prepare('INSERT INTO paciente (clinica_id, nombre, telefono, email) VALUES (?, ?, ?, ?)')
        .run(clinica.id, 'Marta Vega', '644444444', 'marta@ejemplo.es');
      const pacienteId = Number(lastInsertRowid);
      const { secreto } = crearOrenovarEnlace(db, { clinicaId: clinica.id, pacienteId });
      return { clinicaId: clinica.id, pacienteId, secreto };
    },
    estadoDe: (citaId) => db.prepare('SELECT estado FROM cita WHERE id = ?').get(citaId).estado,
    cita: (citaId) => db.prepare('SELECT * FROM cita WHERE id = ?').get(citaId),
    cerrar() {
      try {
        db.close();
      } catch {
        // ya cerrada
      }
      rmSync(directorio, { recursive: true, force: true });
    },
  };
}

/** Servidor HTTP del portal: cliente sin cookie, que nunca envía la sesión de recepción. */
export async function iniciarPortal(entorno) {
  const app = crearApp({ db: entorno.db, ahora: entorno.ahora, secreto: SECRETO });
  const servidor = createServer(app);
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${servidor.address().port}`;
  const pedir = async (ruta, opciones = {}) => {
    const r = await fetch(base + ruta, { redirect: 'manual', ...opciones });
    return {
      estado: r.status,
      cuerpo: await r.text(),
      ubicacion: r.headers.get('location'),
      cabeceras: r.headers,
    };
  };
  return {
    base,
    get: (ruta) => pedir(ruta),
    post: (ruta, datos = {}) =>
      pedir(ruta, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(datos).toString(),
      }),
    cerrar: () => new Promise((ok) => servidor.close(ok)),
  };
}
