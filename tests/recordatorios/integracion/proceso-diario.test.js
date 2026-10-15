import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { escribirSimulado } from '../../../src/correo/salida-simulada.js';
import { ejecutar } from '../../../src/recordatorios/ejecutar.js';
import { conTelefonoClinica, crearCarpetaSalida, crearEntorno, crearReloj } from '../../ayudas/fixture.js';
import { citaA, ficheros, generar, leerEml } from '../ayudas.js';

// Domingo 4 de octubre de 2026, 07:00: la ventana va del lunes 5 a las 07:00 al martes 6 a las 07:00.
const AHORA = ['2026-10-04', '07:00'];

describe('Proceso diario de recordatorios', () => {
  let e;
  let carpeta;
  beforeEach(() => {
    e = crearEntorno({ archivo: true, reloj: crearReloj(...AHORA) });
    carpeta = crearCarpetaSalida();
    conTelefonoClinica(e.db, e.clinicaId, '910123456');
  });
  afterEach(() => {
    e.cerrar();
    carpeta.limpiar();
  });

  const filas = () => e.db.prepare('SELECT * FROM recordatorio ORDER BY cita_id').all();

  it('[003:US1-E1][003:FR-001] una cita reservada de la ventana con email genera un .eml con los datos de la cita', () => {
    const id = citaA(e, '2026-10-05', '10:00');
    const r = generar(e, carpeta);
    assert.equal(r.generados, 1);
    assert.deepEqual(ficheros(carpeta), ['cita-' + id + '-20261005T0800Z.eml']);
    const { cabeceras, cuerpo } = leerEml(carpeta, ficheros(carpeta)[0]);
    assert.equal(cabeceras.To, 'ana@ejemplo.es');
    assert.match(cuerpo, /Ana Ruiz/);
    assert.match(cuerpo, /Profesional: María/);
    assert.match(cuerpo, /Servicio: Sesión de fisioterapia/);
    assert.match(cuerpo, /lunes 5 de octubre de 2026, 10:00 \(hora de España\)/);
    const [fila] = filas();
    assert.equal(fila.resultado, 'generado');
    assert.equal(fila.cita_id, id);
  });

  it('[003:US1-E2][003:FR-003][003:FR-002] las citas fuera de la ventana no generan recordatorio; 24 h exactas sí y 48 h exactas no', () => {
    citaA(e, '2026-10-04', '12:00'); // más cercana: ya empezó la cuenta atrás de 24 h
    citaA(e, '2026-10-05', '06:00'); // 23 h
    citaA(e, '2026-10-06', '08:30'); // 49 h 30 min
    citaA(e, '2026-10-09', '10:00'); // lejana
    citaA(e, '2026-10-02', '10:00'); // pasada
    const incluida = citaA(e, '2026-10-05', '07:00'); // exactamente a 24 h
    citaA(e, '2026-10-06', '07:00'); // exactamente a 48 h
    const r = generar(e, carpeta);
    assert.equal(r.generados, 1);
    assert.deepEqual(filas().map((f) => f.cita_id), [incluida]);
  });

  it('[003:US1-E3][003:FR-003] las citas completadas, canceladas y no asistidas de la ventana no generan recordatorio', () => {
    for (const estado of ['completada', 'cancelada', 'no_asistida']) {
      citaA(e, '2026-10-05', '10:00', { estado, profesional: e.profesionales[estado === 'completada' ? 'maria' : estado === 'cancelada' ? 'jorge' : 'lucia'] });
    }
    const r = generar(e, carpeta);
    assert.equal(r.generados, 0);
    assert.equal(filas().length, 0);
    assert.deepEqual(ficheros(carpeta), []);
  });

  it('[003:US1-E4][003:FR-004] una segunda ejecución con la misma ventana no genera nada nuevo ni cambia los ficheros', () => {
    citaA(e, '2026-10-05', '10:00');
    generar(e, carpeta);
    const antes = leerEml(carpeta, ficheros(carpeta)[0]).bruto;
    const filaAntes = filas()[0];
    const r = generar(e, carpeta);
    assert.equal(r.generados, 0);
    assert.equal(r.yaRecordadas, 1);
    assert.equal(ficheros(carpeta).length, 1);
    assert.equal(leerEml(carpeta, ficheros(carpeta)[0]).bruto, antes);
    assert.deepEqual(filas()[0], filaAntes);
  });

  it('[003:US1-E5] un paciente con dos citas en la ventana recibe dos recordatorios, cada uno con los datos de su cita', () => {
    citaA(e, '2026-10-05', '10:00');
    citaA(e, '2026-10-05', '16:30', { profesional: e.profesionales.jorge });
    generar(e, carpeta);
    const [primero, segundo] = ficheros(carpeta).map((f) => leerEml(carpeta, f));
    assert.equal(primero.cabeceras.To, segundo.cabeceras.To);
    assert.match(primero.cuerpo, /5 de octubre de 2026, 10:00/);
    assert.match(primero.cuerpo, /Profesional: María/);
    assert.match(segundo.cuerpo, /5 de octubre de 2026, 16:30/);
    assert.match(segundo.cuerpo, /Profesional: Jorge/);
  });

  it('[003:US1-E6] la hora del recordatorio aparece en hora de España con el formato largo', () => {
    citaA(e, '2026-10-05', '09:00');
    generar(e, carpeta);
    const { cuerpo, cabeceras } = leerEml(carpeta, ficheros(carpeta)[0]);
    assert.match(cuerpo, /Día y hora: lunes 5 de octubre de 2026, 09:00 \(hora de España\)/);
    assert.match(cabeceras.Subject, /lunes 5 de octubre de 2026, 09:00$/);
  });

  it('[003:US1-E7][003:FR-003] una cita que empieza en menos de 24 h en el momento de la ejecución no recibe recordatorio ni se recupera después', () => {
    const tarde = citaA(e, '2026-10-05', '09:00'); // a 26 h del instante inicial
    // El proceso no se ejecutó ese día; la siguiente ejecución llega con la cita a menos de 24 h.
    e.reloj.fijar('2026-10-05', '08:00');
    const r = generar(e, carpeta);
    assert.equal(r.generados, 0);
    assert.equal(filas().filter((f) => f.cita_id === tarde).length, 0);
    assert.deepEqual(ficheros(carpeta), []);
  });

  it('[003:FR-006] un paciente sin email válido deja la fila sin_email, no escribe fichero y no impide procesar al resto', () => {
    e.db.prepare("UPDATE paciente SET email = 'sin-correo' WHERE id = ?").run(e.pacientes[0]);
    const sin = citaA(e, '2026-10-05', '10:00', { paciente: e.pacientes[0] });
    const con = citaA(e, '2026-10-05', '11:00', { paciente: e.pacientes[1] });
    const r = generar(e, carpeta);
    assert.equal(r.sinEmail, 1);
    assert.equal(r.generados, 1);
    const porCita = Object.fromEntries(filas().map((f) => [f.cita_id, f]));
    assert.equal(porCita[sin].resultado, 'sin_email');
    assert.equal(porCita[sin].fichero, null);
    assert.equal(porCita[sin].token_huella, null);
    assert.equal(porCita[con].resultado, 'generado');
    assert.equal(ficheros(carpeta).length, 1);
    // No se vuelve a intentar en la ejecución siguiente (resultado final para esa hora).
    assert.equal(generar(e, carpeta).sinEmail, 0);
  });

  it('[003:FR-005] si falla la escritura, la cita queda fallida, el resto se procesa y una ejecución posterior con la cita aún en la ventana la genera', () => {
    const mala = citaA(e, '2026-10-05', '10:00', { paciente: e.pacientes[0] });
    const buena = citaA(e, '2026-10-05', '11:00', { paciente: e.pacientes[1] });
    const salida = (nombre, contenido) => {
      if (nombre.startsWith(`cita-${mala}-`)) throw new Error('disco lleno');
      return escribirSimulado(carpeta.ruta, nombre, contenido);
    };
    const r = generar(e, carpeta, { salida });
    assert.equal(r.fallidos, 1);
    assert.equal(r.generados, 1);
    const porCita = Object.fromEntries(filas().map((f) => [f.cita_id, f]));
    assert.equal(porCita[mala].resultado, 'fallido');
    assert.match(porCita[mala].error, /disco lleno/);
    assert.equal(porCita[buena].resultado, 'generado');

    // Una hora más tarde la cita sigue a más de 24 h: se reintenta y se genera.
    e.reloj.fijar('2026-10-04', '08:00');
    const segunda = generar(e, carpeta);
    assert.equal(segunda.generados, 1);
    assert.equal(segunda.yaRecordadas, 1);
    const despues = Object.fromEntries(filas().map((f) => [f.cita_id, f]));
    assert.equal(despues[mala].resultado, 'generado');
    assert.equal(despues[mala].error, null);
    assert.equal(ficheros(carpeta).length, 2);
  });

  it('[003:US1-E7][003:FR-005] una cita fallida cuya ventana ya pasó no se reintenta', () => {
    const mala = citaA(e, '2026-10-05', '09:00');
    generar(e, carpeta, { salida: () => { throw new Error('carpeta no accesible'); } });
    assert.equal(filas()[0].resultado, 'fallido');
    e.reloj.fijar('2026-10-05', '08:00'); // ahora faltan 1 h
    const r = generar(e, carpeta);
    assert.equal(r.generados, 0);
    assert.equal(filas().find((f) => f.cita_id === mala).resultado, 'fallido');
  });

  it('[003:FR-019][003:FR-021] la salida del comando dice "modo simulado" y cada fila guarda modo = simulado', () => {
    citaA(e, '2026-10-05', '10:00');
    const resultado = ejecutar({ argumentos: ['--ahora=2026-10-04T07:00'], ruta: e.ruta, carpeta: carpeta.ruta });
    assert.equal(resultado.codigo, 0);
    assert.match(resultado.lineas[0], /modo simulado/);
    assert.ok(resultado.lineas.includes('Generados: 1'));
    assert.ok(resultado.lineas.some((l) => l.startsWith('Ventana: del lunes 5 de octubre de 2026, 07:00')));
    const fila = e.db.prepare('SELECT modo FROM recordatorio').get();
    assert.equal(fila.modo, 'simulado');
    assert.equal(ficheros(carpeta).length, 1);
    assert.match(leerEml(carpeta, ficheros(carpeta)[0]).cabeceras['X-CitaClara-Modo'], /simulado/);
  });

  it('[003:FR-005][003:FR-021] el comando termina con código 1 si algún recordatorio falla, y con 2 ante un argumento no válido', () => {
    citaA(e, '2026-10-05', '10:00');
    const noEsCarpeta = join(mkdtempSync(join(tmpdir(), 'citaclara-fichero-')), 'fichero.txt');
    writeFileSync(noEsCarpeta, 'x');
    const fallo = ejecutar({ argumentos: ['--ahora=2026-10-04T07:00'], ruta: e.ruta, carpeta: join(noEsCarpeta, 'salida') });
    assert.equal(fallo.codigo, 1);
    assert.ok(fallo.lineas.includes('Fallidos: 1'));
    const mal = ejecutar({ argumentos: ['--ahora=ayer'], ruta: e.ruta, carpeta: carpeta.ruta });
    assert.equal(mal.codigo, 2);
    assert.equal(e.db.prepare('SELECT COUNT(*) AS n FROM recordatorio WHERE resultado = ?').get('fallido').n, 1);
  });
});
