// Datos de demostración deterministas e idempotentes (Principio V, FR-030 a FR-034).
// Con la misma ancla y la misma semilla, el contenido es siempre idéntico.
import { pathToFileURL } from 'node:url';
import { abrirBase, enTransaccionInmediata } from '../db/connection.js';
import { crearClinica } from '../domain/clinicas.js';
import { huellaDeSecreto } from '../domain/enlaces.js';
import { aInstanteUTC, ahoraReal, hoyMadrid, iso, lunesDeLaSemana, sumarDias } from '../domain/tiempo.js';
import {
  APELLIDOS, CLINICA, NOMBRES, NUM_PACIENTES, PROFESIONALES, PROPORCION_CANCELADA,
  PROPORCION_NO_ASISTIDA, SEMANAS_FUTURO, SEMANAS_HISTORIA, SEMILLA, SERVICIOS, secretoDeDemostracion,
} from './datos.js';
import { crearPrng } from './prng.js';

const sinTildes = (t) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const ALMUERZO_INICIO = 14 * 60;
const ALMUERZO_FIN = 15 * 60;
const CIERRE = 20 * 60;
const APERTURA = 9 * 60;
const HUECOS = [0, 0, 15, 30, 45, 60, 90, 120];

function generarPacientes(prng) {
  const vistos = new Set();
  const pacientes = [];
  while (pacientes.length < NUM_PACIENTES) {
    const nombre = prng.elegir(NOMBRES);
    const ap1 = prng.elegir(APELLIDOS);
    const ap2 = prng.elegir(APELLIDOS);
    const completo = `${nombre} ${ap1} ${ap2}`;
    if (ap1 === ap2 || vistos.has(completo)) continue;
    vistos.add(completo);
    const telefono = `6${prng.entero(10_000_000, 99_999_999)}`;
    const email = `${sinTildes(nombre)}.${sinTildes(ap1)}${pacientes.length + 1}@ejemplo.es`;
    pacientes.push({ nombre: completo, telefono, email });
  }
  return pacientes;
}

function elegirServicio(prng, servicios) {
  const total = servicios.reduce((s, x) => s + x.peso, 0);
  let punto = prng.entero(1, total);
  for (const s of servicios) {
    punto -= s.peso;
    if (punto <= 0) return s;
  }
  return servicios.at(-1);
}

/** Rellena un día laborable de un profesional con citas sin solapes, dentro de 09:00–20:00. */
function generarDia(prng, serviciosDelProfesional) {
  const citas = [];
  let cursor = APERTURA;
  for (let i = 0; i < 30; i++) {
    cursor += prng.elegir(HUECOS);
    const servicio = elegirServicio(prng, serviciosDelProfesional);
    if (cursor < ALMUERZO_FIN && cursor + servicio.duracionMin > ALMUERZO_INICIO) cursor = ALMUERZO_FIN;
    if (cursor + servicio.duracionMin > CIERRE) break;
    citas.push({ inicioMin: cursor, servicio });
    cursor += servicio.duracionMin;
  }
  return citas;
}

const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

function diasLaborables(desde, semanas) {
  const dias = [];
  for (let s = 0; s < semanas; s++) for (let d = 0; d < 5; d++) dias.push(sumarDias(desde, 7 * s + d));
  return dias;
}

/**
 * Vacía y recrea la clínica de demostración.
 * - Historia: las `SEMANAS_HISTORIA` semanas laborales completas anteriores a la ancla (lunes).
 * - Futuro: las `SEMANAS_FUTURO` semanas laborales completas que empiezan el lunes siguiente a la ancla.
 *   La semana de la ancla queda sin citas, para que los recuentos no dependan del día de carga.
 */
export function cargarSemilla(db, { ancla = lunesDeLaSemana(hoyMadrid(ahoraReal())), semilla = SEMILLA } = {}) {
  return enTransaccionInmediata(db, () => {
    for (const { id } of db.prepare('SELECT id FROM clinica WHERE nombre = ?').all(CLINICA.nombre)) {
      for (const tabla of ['cita', 'paciente', 'servicio', 'profesional']) {
        db.prepare(`DELETE FROM ${tabla} WHERE clinica_id = ?`).run(id);
      }
      db.prepare('DELETE FROM clinica WHERE id = ?').run(id);
    }

    const alta = crearClinica(db, CLINICA);
    if (!alta.ok) throw new Error(`No se pudo crear la clínica de demostración: ${JSON.stringify(alta.errores)}`);
    const clinicaId = alta.clinica.id;
    const prng = crearPrng(semilla);

    const profesionales = PROFESIONALES.map((p) => {
      const { lastInsertRowid } = db
        .prepare('INSERT INTO profesional (clinica_id, nombre, especialidad) VALUES (?, ?, ?)')
        .run(clinicaId, p.nombre, p.especialidad);
      return { ...p, id: Number(lastInsertRowid) };
    });
    const servicios = new Map(
      SERVICIOS.map((s) => {
        const { lastInsertRowid } = db
          .prepare('INSERT INTO servicio (clinica_id, nombre, duracion_min, precio_centimos) VALUES (?, ?, ?, ?)')
          .run(clinicaId, s.nombre, s.duracionMin, s.precioCentimos);
        return [s.clave, { ...s, id: Number(lastInsertRowid) }];
      }),
    );
    const idsPacientes = generarPacientes(prng).map((p) => {
      const { lastInsertRowid } = db
        .prepare('INSERT INTO paciente (clinica_id, nombre, telefono, email) VALUES (?, ?, ?, ?)')
        .run(clinicaId, p.nombre, p.telefono, p.email);
      return Number(lastInsertRowid);
    });

    const generar = (dias, futuro) => {
      const citas = [];
      for (const dia of dias) {
        for (const prof of profesionales) {
          const suyos = prof.servicios.map((c) => servicios.get(c));
          for (const { inicioMin, servicio } of generarDia(prng, suyos)) {
            const inicio = aInstanteUTC(dia, hhmm(inicioMin));
            citas.push({
              profesionalId: prof.id,
              servicioId: servicio.id,
              pacienteId: idsPacientes[prng.entero(0, idsPacientes.length - 1)],
              inicio,
              fin: new Date(inicio.getTime() + servicio.duracionMin * 60_000),
              estado: futuro ? 'reservada' : 'completada',
            });
          }
        }
      }
      return citas;
    };

    const historia = generar(diasLaborables(sumarDias(ancla, -7 * SEMANAS_HISTORIA), SEMANAS_HISTORIA), false);
    const futuro = generar(diasLaborables(sumarDias(ancla, 7), SEMANAS_FUTURO), true);

    // Cuotas exactas de estados en la historia (no probabilidades): 10 % no asistida, 8 % cancelada.
    const cuotaNoAsistida = Math.round(historia.length * PROPORCION_NO_ASISTIDA);
    const cuotaCancelada = Math.round(historia.length * PROPORCION_CANCELADA);
    const orden = prng.barajar(historia.map((_, i) => i));
    orden.slice(0, cuotaNoAsistida).forEach((i) => (historia[i].estado = 'no_asistida'));
    orden.slice(cuotaNoAsistida, cuotaNoAsistida + cuotaCancelada).forEach((i) => (historia[i].estado = 'cancelada'));

    const insertar = db.prepare(
      `INSERT INTO cita (clinica_id, profesional_id, servicio_id, paciente_id, inicio, fin, estado)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const c of [...historia, ...futuro]) {
      insertar.run(clinicaId, c.profesionalId, c.servicioId, c.pacienteId, iso(c.inicio), iso(c.fin), c.estado);
    }

    // Enlace personal de cada ficha: solo la huella, como en producción (002, FR-020).
    idsPacientes.forEach((id, i) => {
      db.prepare('UPDATE paciente SET acceso_hash = ? WHERE id = ?').run(huellaDeSecreto(secretoDeDemostracion(i + 1)), id);
    });

    return {
      clinicaId,
      ancla,
      pacientes: idsPacientes.length,
      historia: {
        total: historia.length,
        completada: historia.length - cuotaNoAsistida - cuotaCancelada,
        no_asistida: cuotaNoAsistida,
        cancelada: cuotaCancelada,
      },
      futuro: { total: futuro.length, reservada: futuro.length },
      citas: historia.length + futuro.length,
    };
  });
}

const esPrincipal = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (esPrincipal) {
  const { config } = await import('../config.js');
  const db = abrirBase(config.rutaBase);
  const r = cargarSemilla(db);
  console.log(`Datos de demostración cargados en ${config.rutaBase}`);
  console.log(`  Clínica: ${CLINICA.nombre} · clave de acceso: ${CLINICA.clave}`);
  console.log(`  Pacientes: ${r.pacientes} · citas: ${r.citas} (ancla: lunes ${r.ancla})`);
  console.log(
    `  Historia: ${r.historia.total} (completadas ${r.historia.completada}, no asistidas ${r.historia.no_asistida}, canceladas ${r.historia.cancelada})`,
  );
  console.log(`  Futuro: ${r.futuro.total} reservadas`);
  console.log(`  Enlace de demostración de la ficha 8 (Claudia Rodríguez Pérez): http://localhost:${config.puerto}/p/${secretoDeDemostracion(8)}`);
  db.close();
}
