// Entorno de pruebas aislado: base temporal, reloj fijo y cliente HTTP mínimo.
import { mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { crearApp } from '../../src/app.js';
import { abrirBase, abrirBaseSoloLectura } from '../../src/db/connection.js';
import { crearClinica } from '../../src/domain/clinicas.js';
import { aInstanteUTC } from '../../src/domain/tiempo.js';

export const CLAVE = 'clave-eleva-1';
export const CLAVE_2 = 'clave-otra-2';
export const SECRETO = 'secreto-de-pruebas';

/** Reloj fijo y modificable. Por defecto: viernes 2 de octubre de 2026, 08:00 (hora de España). */
export function crearReloj(dia = '2026-10-02', hora = '08:00') {
  const reloj = { t: aInstanteUTC(dia, hora) };
  reloj.ahora = () => reloj.t;
  reloj.fijar = (d, h) => {
    reloj.t = aInstanteUTC(d, h);
  };
  reloj.avanzarMs = (ms) => {
    reloj.t = new Date(reloj.t.getTime() + ms);
  };
  return reloj;
}

/** Instante de pruebas a partir de día y hora de España. */
export const en = (dia, hora) => aInstanteUTC(dia, hora);

export function crearEntorno({ archivo = false, reloj = crearReloj() } = {}) {
  let directorio;
  let ruta = ':memory:';
  if (archivo) {
    directorio = mkdtempSync(join(tmpdir(), 'citaclara-'));
    ruta = join(directorio, 'prueba.db');
  }
  const db = abrirBase(ruta);

  const { clinica } = crearClinica(db, { nombre: 'Clínica Eleva', clave: CLAVE });
  const { clinica: clinica2 } = crearClinica(db, { nombre: 'Clínica Otra', clave: CLAVE_2 });

  const prof = db.prepare('INSERT INTO profesional (clinica_id, nombre, especialidad) VALUES (?, ?, ?)');
  const serv = db.prepare('INSERT INTO servicio (clinica_id, nombre, duracion_min, precio_centimos) VALUES (?, ?, ?, ?)');
  const pac = db.prepare('INSERT INTO paciente (clinica_id, nombre, telefono, email) VALUES (?, ?, ?, ?)');
  const id = (r) => Number(r.lastInsertRowid);

  const profesionales = {
    maria: id(prof.run(clinica.id, 'María', 'Fisioterapia')),
    jorge: id(prof.run(clinica.id, 'Jorge', 'Fisioterapia')),
    lucia: id(prof.run(clinica.id, 'Lucía', 'Nutrición')),
  };
  const servicios = {
    sesion: id(serv.run(clinica.id, 'Sesión de fisioterapia', 45, 4000)),
    primera: id(serv.run(clinica.id, 'Primera visita de fisioterapia', 60, 5000)),
    consulta: id(serv.run(clinica.id, 'Consulta de nutrición', 30, 3500)),
    primeraNutricion: id(serv.run(clinica.id, 'Primera consulta de nutrición', 45, 4500)),
  };
  const pacientes = [
    id(pac.run(clinica.id, 'Ana Ruiz', '611111111', 'ana@ejemplo.es')),
    id(pac.run(clinica.id, 'Luis Gil', '622222222', 'luis@ejemplo.es')),
    id(pac.run(clinica.id, 'Eva Mora', '633333333', 'eva@ejemplo.es')),
  ];

  // Datos de la segunda clínica, para comprobar el aislamiento (FR-003).
  const prof2 = id(prof.run(clinica2.id, 'Pablo', 'Psicología'));
  const serv2 = id(serv.run(clinica2.id, 'Terapia', 50, 6000));
  const pac2 = id(pac.run(clinica2.id, 'Marta Vega', '644444444', 'marta@ejemplo.es'));

  return {
    db,
    ruta,
    reloj,
    ahora: reloj.ahora,
    clinicaId: clinica.id,
    clinica2: { id: clinica2.id, profesional: prof2, servicio: serv2, paciente: pac2 },
    profesionales,
    servicios,
    pacientes,
    /** Inserta una cita directamente (sin pasar por el servicio de reservas). */
    insertarCita({ profesional, servicio, paciente = pacientes[0], inicio, fin, estado = 'reservada', clinicaId = clinica.id }) {
      const r = db
        .prepare(
          'INSERT INTO cita (clinica_id, profesional_id, servicio_id, paciente_id, inicio, fin, estado) VALUES (?, ?, ?, ?, ?, ?, ?)',
        )
        .run(clinicaId, profesional, servicio, paciente, inicio.toISOString(), fin.toISOString(), estado);
      return Number(r.lastInsertRowid);
    },
    contarCitas: () => db.prepare('SELECT COUNT(*) AS n FROM cita').get().n,
    cerrar() {
      try {
        db.close();
      } catch {
        // ya cerrada
      }
      if (directorio) rmSync(directorio, { recursive: true, force: true });
    },
  };
}

/** Comprueba que ningún profesional tiene dos citas reservadas o completadas solapadas. */
export function haySolapes(db) {
  return db
    .prepare(
      `SELECT COUNT(*) AS n FROM cita a JOIN cita b
         ON a.profesional_id = b.profesional_id AND a.id < b.id
        AND a.estado IN ('reservada','completada') AND b.estado IN ('reservada','completada')
        AND a.inicio < b.fin AND b.inicio < a.fin`,
    )
    .get().n > 0;
}

/** Arranca la aplicación en un puerto libre y devuelve un cliente con cookie y token de formulario. */
export async function iniciarServidor(entorno) {
  // Sin `ruta` (p. ej. un entorno construido a mano con solo `db` y `ahora`), se abre una
  // segunda base en memoria independiente: basta para los flujos que no pasan por /analitica.
  const dbSoloLectura = abrirBaseSoloLectura(entorno.ruta ?? ':memory:');
  const app = crearApp({ db: entorno.db, dbSoloLectura, ahora: entorno.ahora, secreto: SECRETO });
  const servidor = createServer(app);
  await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${servidor.address().port}`;

  const cliente = {
    base,
    cookie: '',
    async pedir(ruta, opciones = {}) {
      const respuesta = await fetch(base + ruta, {
        redirect: 'manual',
        ...opciones,
        headers: { ...(opciones.headers ?? {}), ...(cliente.cookie ? { cookie: cliente.cookie } : {}) },
      });
      const nueva = respuesta.headers.getSetCookie?.() ?? [];
      for (const c of nueva) {
        const par = c.split(';')[0];
        cliente.cookie = par.endsWith('=') ? '' : par;
      }
      const cuerpo = await respuesta.text();
      return { estado: respuesta.status, cuerpo, ubicacion: respuesta.headers.get('location'), cabeceras: respuesta.headers };
    },
    get: (ruta) => cliente.pedir(ruta),
    post: (ruta, datos) =>
      cliente.pedir(ruta, {
        method: 'POST',
        headers: { 'content-type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams(datos).toString(),
      }),
    async entrar(clave = CLAVE) {
      return cliente.post('/acceso', { clave });
    },
    /** Token de formulario de la sesión actual, leído de una página con botón "Cerrar sesión". */
    async csrf() {
      const { cuerpo } = await cliente.get('/agenda');
      return /name="csrf" value="([^"]+)"/.exec(cuerpo)?.[1];
    },
    /** POST con el token de formulario ya incluido. */
    async enviar(ruta, datos) {
      return cliente.post(ruta, { csrf: await cliente.csrf(), ...datos });
    },
  };
  cliente.cerrar = () =>
    new Promise((ok) =>
      servidor.close(() => {
        dbSoloLectura.close();
        ok();
      }),
    );
  return cliente;
}

/** Texto visible de una página: sin etiquetas, sin scripts ni estilos. */
export function textoVisible(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ');
}

/** Carpeta temporal para la salida de correo simulada (003). `limpiar()` la borra. */
export function crearCarpetaSalida() {
  const ruta = mkdtempSync(join(tmpdir(), 'citaclara-correo-'));
  return { ruta, limpiar: () => rmSync(ruta, { recursive: true, force: true }) };
}

/** Fija el teléfono de contacto de una clínica (002, `clinica.telefono`). */
export function conTelefonoClinica(db, clinicaId, telefono) {
  db.prepare('UPDATE clinica SET telefono = ? WHERE id = ?').run(telefono, clinicaId);
}
