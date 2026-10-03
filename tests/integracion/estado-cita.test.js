import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, en, iniciarServidor, textoVisible } from '../ayudas/fixture.js';

describe('Cambio de estado por HTTP', () => {
  let e;
  let c;
  let futura;
  let pasada;
  beforeEach(async () => {
    e = crearEntorno(); // viernes 2 de octubre de 2026, 08:00
    c = await iniciarServidor(e);
    await c.entrar();
    pasada = e.insertarCita({
      profesional: e.profesionales.maria,
      servicio: e.servicios.sesion,
      paciente: e.pacientes[0],
      inicio: en('2026-10-02', '07:00'),
      fin: en('2026-10-02', '07:45'),
    });
    futura = e.insertarCita({
      profesional: e.profesionales.maria,
      servicio: e.servicios.sesion,
      paciente: e.pacientes[1],
      inicio: en('2026-10-02', '10:00'),
      fin: en('2026-10-02', '10:45'),
    });
  });
  afterEach(async () => {
    await c.cerrar();
    e.cerrar();
  });

  const estadoDe = (id) => e.db.prepare('SELECT estado FROM cita WHERE id = ?').get(id).estado;
  const cambiar = (id, estado) => c.enviar(`/citas/${id}/estado`, { estado, dia: '2026-10-02' });

  it('[US3-E1] completar una cita que ya empezó redirige con aviso', async () => {
    const r = await cambiar(pasada, 'completada');
    assert.equal(r.estado, 303);
    assert.match(r.ubicacion, /^\/agenda\?dia=2026-10-02&aviso=estado&cita=\d+$/);
    assert.equal(estadoDe(pasada), 'completada');
    assert.match(textoVisible((await c.get(r.ubicacion)).cuerpo), /ha pasado a «Completada»/);
  });

  it('[US3-E2][FR-027] cancelar libera el hueco y la agenda lo refleja de inmediato', async () => {
    const libresDeDia = (t) => (t.match(/09:00–20:00 Libre/g) ?? []).length;
    const antes = textoVisible((await c.get('/agenda?dia=2026-10-02')).cuerpo);
    assert.equal(libresDeDia(antes), 2); // solo Jorge y Lucía tienen el día entero libre
    const r = await cambiar(futura, 'cancelada');
    assert.equal(r.estado, 303);
    const despues = textoVisible((await c.get('/agenda?dia=2026-10-02')).cuerpo);
    assert.match(despues, /Luis Gil · Sesión de fisioterapia ✖ Cancelada/); // en el histórico
    assert.equal(libresDeDia(despues), 3); // el día de María vuelve a estar libre
    assert.doesNotMatch(despues, /10:45–20:00 Libre/);
  });

  it('[US3-E3] marcar como no asistida una cita ya empezada', async () => {
    assert.equal((await cambiar(pasada, 'no_asistida')).estado, 303);
    assert.equal(estadoDe(pasada), 'no_asistida');
  });

  it('[US3-E4] antes de empezar, completada y no asistida dan 422 con su mensaje', async () => {
    for (const estado of ['completada', 'no_asistida']) {
      const r = await cambiar(futura, estado);
      assert.equal(r.estado, 422);
      assert.match(r.cuerpo, /Todavía no ha empezado la cita/);
    }
    assert.equal(estadoDe(futura), 'reservada');
  });

  it('[US3-E5] una cita que ya no está reservada da 409', async () => {
    await cambiar(pasada, 'completada');
    const r = await cambiar(pasada, 'cancelada');
    assert.equal(r.estado, 409);
    assert.match(r.cuerpo, /Esa cita ya no está reservada/);
    assert.equal(estadoDe(pasada), 'completada');
  });

  it('[FR-003] una cita inexistente o de otra clínica da 404', async () => {
    const ajena = e.insertarCita({
      clinicaId: e.clinica2.id,
      profesional: e.clinica2.profesional,
      servicio: e.clinica2.servicio,
      paciente: e.clinica2.paciente,
      inicio: en('2026-10-02', '11:00'),
      fin: en('2026-10-02', '11:50'),
    });
    for (const id of [9999, ajena]) {
      const r = await cambiar(id, 'cancelada');
      assert.equal(r.estado, 404);
      assert.match(r.cuerpo, /No se encuentra la cita/);
    }
    assert.equal(estadoDe(ajena), 'reservada');
  });

  it('[FR-012] un estado no permitido da 422', async () => {
    const r = await cambiar(futura, 'reservada');
    assert.equal(r.estado, 422);
    assert.equal(estadoDe(futura), 'reservada');
  });

  it('[FR-026] la agenda ofrece las tres acciones solo en citas reservadas y explica las no disponibles', async () => {
    const html = (await c.get('/agenda?dia=2026-10-02')).cuerpo;
    const formulariosEstado = [...html.matchAll(/action="\/citas\/(\d+)\/estado"/g)].map((m) => Number(m[1]));
    assert.equal(formulariosEstado.filter((id) => id === pasada).length, 3);
    assert.equal(formulariosEstado.filter((id) => id === futura).length, 3);
    // La cita futura muestra "Completada" y "No asistida" desactivadas, con la explicación.
    const tramoFutura = html.split('<li class="tramo ocupado').find((t) => t.includes(`/citas/${futura}/estado`));
    assert.equal((tramoFutura.match(/ disabled /g) ?? []).length, 2);
    assert.match(tramoFutura, /Disponible cuando empiece la cita/);
    // La cita ya empezada no tiene botones desactivados.
    const tramoPasada = html.split('<li class="tramo ocupado').find((t) => t.includes(`/citas/${pasada}/estado`));
    assert.doesNotMatch(tramoPasada, / disabled /);
    // Tras cerrarla, ya no se ofrece ninguna acción.
    await cambiar(pasada, 'completada');
    const despues = (await c.get('/agenda?dia=2026-10-02')).cuerpo;
    assert.doesNotMatch(despues, new RegExp(`/citas/${pasada}/estado`));
  });
});
