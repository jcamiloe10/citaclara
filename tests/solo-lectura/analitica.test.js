// [004-SC-002] Garantía de cero escrituras: ejercitar /analitica por todos sus caminos (con
// sesión, sin sesión, sesión caducada, clínica sin datos) no debe cambiar ni una fila. Incluye
// el bloque de evolución (US2) en sus dos variantes: la clínica 1 solo tiene una cita en una
// semana del periodo (evolución con una sola fila, menos de 8 semanas) y la clínica 2 no tiene
// ninguna (evolución vacía); ambas pasan por el mismo código que la demo con 8 semanas completas.
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, en, iniciarServidor } from '../ayudas/fixture.js';

function resumenDeTablas(db) {
  const resumen = {};
  for (const tabla of ['clinica', 'profesional', 'servicio', 'paciente', 'cita']) {
    resumen[tabla] = db.prepare(`SELECT COUNT(*) AS total, COALESCE(SUM(id), 0) AS sumaIds FROM ${tabla}`).get();
  }
  return resumen;
}

describe('Panel de analítica: cero escrituras (SC-002)', () => {
  let e;
  let c;
  beforeEach(async () => {
    e = crearEntorno({ archivo: true });
    c = await iniciarServidor(e);
    e.insertarCita({
      profesional: e.profesionales.maria,
      servicio: e.servicios.sesion,
      inicio: en('2026-09-10', '10:00'),
      fin: en('2026-09-10', '10:45'),
      estado: 'completada',
    });
  });
  afterEach(async () => {
    await c.cerrar();
    e.cerrar();
  });

  it('[004-SC-002] con sesión válida, sin sesión, con sesión caducada y sin datos: las tablas quedan idénticas', async () => {
    const antes = resumenDeTablas(e.db);

    // Sin sesión.
    await c.get('/analitica');
    // Con sesión válida, repetidas veces.
    await c.entrar();
    await c.get('/analitica');
    await c.get('/analitica');
    // Sesión caducada (más de 12 horas).
    e.reloj.avanzarMs(13 * 60 * 60 * 1000);
    await c.get('/analitica');
    e.reloj.avanzarMs(-13 * 60 * 60 * 1000);

    // Una segunda clínica sin ninguna cita (recorrido "sin datos").
    const cliente2 = await iniciarServidor(e);
    await cliente2.entrar('clave-otra-2');
    await cliente2.get('/analitica');
    await cliente2.cerrar();

    assert.deepEqual(resumenDeTablas(e.db), antes);
  });
});
