import { after, afterEach, before, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, en, iniciarServidor } from '../ayudas/fixture.js';

describe('Alta de cita por HTTP', () => {
  let e;
  let c;
  beforeEach(async () => {
    e = crearEntorno();
    c = await iniciarServidor(e);
    await c.entrar();
  });
  afterEach(async () => {
    await c.cerrar();
    e.cerrar();
  });

  const formulario = (extra = {}) => ({
    profesional_id: e.profesionales.maria,
    servicio_id: e.servicios.sesion,
    dia: '2026-10-05',
    hora: '10:00',
    paciente_id: e.pacientes[0],
    ...extra,
  });
  const citas = () => e.db.prepare('SELECT * FROM cita ORDER BY id').all();

  it('[US1-E1] un alta correcta redirige a la agenda y deja la cita reservada', async () => {
    const r = await c.enviar('/citas', formulario());
    assert.equal(r.estado, 303);
    assert.match(r.ubicacion, /^\/agenda\?dia=2026-10-05&aviso=reservada&cita=\d+$/);
    assert.equal(citas().length, 1);
    assert.equal(citas()[0].estado, 'reservada');
    const agenda = await c.get(r.ubicacion);
    assert.match(agenda.cuerpo, /Cita reservada: Ana Ruiz/);
  });

  it('[US1-E2][FR-021][SC-004] un hueco ocupado da 409, conserva los datos y no registra nada', async () => {
    await c.enviar('/citas', formulario());
    const r = await c.enviar('/citas', formulario({ hora: '10:30' }));
    assert.equal(r.estado, 409);
    assert.match(r.cuerpo, /Ese hueco ya está ocupado/);
    assert.match(r.cuerpo, /<option value="10:30" selected>/);
    assert.equal(citas().length, 1);
  });

  it('[RN2][SC-004] una cita en el pasado da 422 con su mensaje', async () => {
    e.reloj.fijar('2026-10-05', '12:00');
    await c.entrar(); // el salto de reloj caduca la sesión anterior
    const r = await c.enviar('/citas', formulario());
    assert.equal(r.estado, 422);
    assert.match(r.cuerpo, /No se pueden crear citas en el pasado/);
    assert.equal(citas().length, 0);
  });

  it('[RN3][SC-004] una cita fuera de horario da 422 con su mensaje', async () => {
    const r = await c.enviar('/citas', formulario({ hora: '19:45', servicio_id: e.servicios.primera }));
    assert.equal(r.estado, 422);
    assert.match(r.cuerpo, /de lunes a viernes, de 09:00 a 20:00/);
    const sabado = await c.enviar('/citas', formulario({ dia: '2026-10-10' }));
    assert.equal(sabado.estado, 422);
    assert.equal(citas().length, 0);
  });

  it('[RN4][US1-E13][SC-004] una hora que no es múltiplo de 15 minutos da 422', async () => {
    const r = await c.enviar('/citas', formulario({ hora: '10:07' }));
    assert.equal(r.estado, 422);
    assert.match(r.cuerpo, /en punto, y cuarto, y media o menos cuarto/);
    assert.equal(citas().length, 0);
  });

  it('[FR-021][SC-004] los datos incompletos dan 422 con un mensaje por campo', async () => {
    const r = await c.enviar('/citas', { dia: '2026-10-05' });
    assert.equal(r.estado, 422);
    assert.match(r.cuerpo, /Elige un profesional/);
    assert.match(r.cuerpo, /Elige un servicio/);
    assert.match(r.cuerpo, /Indica el día y la hora de inicio|Elige un paciente de la lista/);
    assert.equal(citas().length, 0);
  });

  it('[US1-E10][FR-008b] un paciente nuevo se crea y se reserva su cita en el mismo paso', async () => {
    const r = await c.enviar(
      '/citas',
      formulario({
        paciente_id: '',
        paciente_nombre: 'Carla Soto',
        paciente_telefono: '655 555 555',
        paciente_email: 'carla@ejemplo.es',
      }),
    );
    assert.equal(r.estado, 303);
    const ficha = e.db.prepare("SELECT * FROM paciente WHERE nombre = 'Carla Soto'").get();
    assert.equal(ficha.telefono, '655555555');
    assert.equal(citas()[0].paciente_id, ficha.id);
  });

  it('[US1-E11][FR-008b] con el hueco ocupado, la ficha nueva se conserva, se preselecciona y no se duplica al reintentar', async () => {
    await c.enviar('/citas', formulario());
    const datos = formulario({
      paciente_id: '',
      paciente_nombre: 'Carla Soto',
      paciente_telefono: '655555555',
      paciente_email: 'carla@ejemplo.es',
    });
    const rechazo = await c.enviar('/citas', datos);
    assert.equal(rechazo.estado, 409);
    const ficha = e.db.prepare("SELECT * FROM paciente WHERE nombre = 'Carla Soto'").get();
    assert.ok(ficha, 'la ficha sobrevive al rechazo');
    assert.match(rechazo.cuerpo, new RegExp(`<option value="${ficha.id}" selected>`));
    assert.match(rechazo.cuerpo, /Se ha guardado la ficha de Carla Soto/);
    assert.equal(citas().length, 1);
    // Reintento en otro hueco, ya con la ficha seleccionada.
    const reintento = await c.enviar('/citas', formulario({ hora: '12:00', paciente_id: ficha.id }));
    assert.equal(reintento.estado, 303);
    assert.equal(e.db.prepare("SELECT COUNT(*) AS n FROM paciente WHERE nombre = 'Carla Soto'").get().n, 1);
  });

  it('[FR-008b] los datos inválidos del paciente nuevo se rechazan sin crear ficha ni cita', async () => {
    const r = await c.enviar(
      '/citas',
      formulario({ paciente_id: '', paciente_nombre: 'Carla', paciente_telefono: '123', paciente_email: 'mal' }),
    );
    assert.equal(r.estado, 422);
    assert.match(r.cuerpo, /El teléfono debe tener 9 cifras/);
    assert.match(r.cuerpo, /El correo electrónico no es válido/);
    assert.equal(e.db.prepare("SELECT COUNT(*) AS n FROM paciente WHERE nombre = 'Carla'").get().n, 0);
    assert.equal(citas().length, 0);
  });

  it('[FR-025][FR-010] GET /citas/nueva precarga profesional, día y hora, y muestra el fin calculado', async () => {
    const r = await c.get(
      `/citas/nueva?profesional=${e.profesionales.jorge}&dia=2026-10-05&hora=11:15&servicio=${e.servicios.primera}`,
    );
    assert.equal(r.estado, 200);
    assert.match(r.cuerpo, new RegExp(`<option value="${e.profesionales.jorge}" selected>`));
    assert.match(r.cuerpo, /name="dia" type="date" value="2026-10-05"/);
    assert.match(r.cuerpo, /<option value="11:15" selected>/);
    assert.match(r.cuerpo, /Terminaría a las 12:15/);
  });

  it('[FR-025][RN4] el selector de hora ofrece saltos de 15 minutos de 09:00 a 19:45', async () => {
    const r = await c.get('/citas/nueva');
    const horas = [...r.cuerpo.matchAll(/<option value="(\d{2}:\d{2})"/g)].map((m) => m[1]);
    assert.equal(horas.length, 44);
    assert.equal(horas[0], '09:00');
    assert.equal(horas.at(-1), '19:45');
    assert.ok(horas.every((h) => Number(h.slice(3)) % 15 === 0));
  });

  it('[FR-003] no se puede reservar con profesional, servicio o paciente de otra clínica', async () => {
    const r = await c.enviar('/citas', formulario({ profesional_id: e.clinica2.profesional }));
    assert.equal(r.estado, 422);
    assert.equal(citas().length, 0);
  });

  it('[FR-001] un envío sin token de formulario se rechaza con 403', async () => {
    const r = await c.post('/citas', formulario());
    assert.equal(r.estado, 403);
    assert.equal(citas().length, 0);
  });
});
