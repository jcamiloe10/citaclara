import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearClinica } from '../../src/domain/clinicas.js';
import { CLAVE, CLAVE_2, crearEntorno, en, iniciarServidor } from '../ayudas/fixture.js';

describe('Acceso con clave de clínica', () => {
  let e;
  let c;
  beforeEach(async () => {
    e = crearEntorno();
    c = await iniciarServidor(e);
    e.insertarCita({
      profesional: e.profesionales.maria,
      servicio: e.servicios.sesion,
      inicio: en('2026-10-02', '10:00'),
      fin: en('2026-10-02', '10:45'),
    });
  });
  afterEach(async () => {
    await c.cerrar();
    e.cerrar();
  });

  it('[US2-E1][FR-001] sin sesión no se muestra ningún dato ni se aceptan acciones', async () => {
    for (const ruta of ['/agenda', '/agenda?dia=2026-10-02', '/citas/nueva']) {
      const r = await c.get(ruta);
      assert.equal(r.estado, 303, ruta);
      assert.equal(r.ubicacion, '/acceso');
      assert.doesNotMatch(r.cuerpo, /Ana Ruiz|María|Clínica Eleva/);
    }
    const alta = await c.post('/citas', { profesional_id: e.profesionales.maria });
    assert.equal(alta.estado, 303);
    assert.equal(e.contarCitas(), 1);
    const estado = await c.post('/citas/1/estado', { estado: 'cancelada' });
    assert.equal(estado.estado, 303);
    assert.equal(e.db.prepare('SELECT estado FROM cita WHERE id = 1').get().estado, 'reservada');
    const formulario = await c.get('/acceso');
    assert.equal(formulario.estado, 200);
    assert.doesNotMatch(formulario.cuerpo, /Ana Ruiz|María|Clínica Eleva/);
  });

  it('[US2-E2][FR-002] una clave incorrecta da 401 con un mensaje claro y sin datos', async () => {
    const r = await c.entrar('clave-equivocada');
    assert.equal(r.estado, 401);
    assert.match(r.cuerpo, /La clave no es correcta/);
    assert.doesNotMatch(r.cuerpo, /Ana Ruiz|María|Clínica Eleva/);
    assert.equal((await c.get('/agenda')).estado, 303);
  });

  it('[FR-002b] la clave correcta abre una sesión con cookie HttpOnly', async () => {
    const r = await c.entrar();
    assert.equal(r.estado, 303);
    assert.equal(r.ubicacion, '/agenda');
    const cookie = r.cabeceras.getSetCookie()[0];
    assert.match(cookie, /HttpOnly/);
    assert.match(cookie, /SameSite=Lax/);
    const agenda = await c.get('/agenda?dia=2026-10-02');
    assert.equal(agenda.estado, 200);
    assert.match(agenda.cuerpo, /Ana Ruiz/);
  });

  it('[US2-E5][FR-002b] pasadas 12 horas o al cerrar sesión se vuelve a pedir la clave', async () => {
    await c.entrar();
    e.reloj.avanzarMs(11 * 3_600_000 + 59 * 60_000);
    assert.equal((await c.get('/agenda')).estado, 200, 'a las 11 h 59 min sigue dentro');
    e.reloj.avanzarMs(2 * 60_000);
    const caducada = await c.get('/agenda');
    assert.equal(caducada.estado, 303);
    assert.equal(caducada.ubicacion, '/acceso');

    await c.entrar();
    assert.match((await c.get('/agenda')).cuerpo, /Cerrar sesión/);
    const salir = await c.enviar('/salir', {});
    assert.equal(salir.estado, 303);
    assert.equal(salir.ubicacion, '/acceso');
    assert.equal((await c.get('/agenda')).estado, 303);
  });

  it('[FR-002b] una cookie manipulada no da acceso', async () => {
    await c.entrar();
    c.cookie = c.cookie.replace(/\.[^.]*$/, '.firmafalsa');
    assert.equal((await c.get('/agenda')).estado, 303);
  });

  it('[FR-003][US2-E8] cada clínica entra con su propia clave y solo ve sus datos', async () => {
    const otro = await iniciarServidor(e);
    try {
      assert.equal((await c.entrar(CLAVE)).estado, 303);
      const propia = await c.get('/agenda?dia=2026-10-02');
      assert.match(propia.cuerpo, /María/);
      assert.doesNotMatch(propia.cuerpo, /Pablo/);

      assert.equal((await otro.entrar(CLAVE_2)).estado, 303);
      const ajena = await otro.get('/agenda?dia=2026-10-02');
      assert.match(ajena.cuerpo, /Pablo/);
      assert.doesNotMatch(ajena.cuerpo, /María|Ana Ruiz/);
      assert.match(ajena.cuerpo, /Clínica Otra/);

      // Una clínica no puede operar sobre citas de otra.
      const intento = await otro.enviar('/citas/1/estado', { estado: 'cancelada', dia: '2026-10-02' });
      assert.equal(intento.estado, 404);
      assert.equal(e.db.prepare('SELECT estado FROM cita WHERE id = 1').get().estado, 'reservada');
    } finally {
      await otro.cerrar();
    }
  });

  it('[FR-003][US2-E8] crear una clínica con una clave ya usada por otra se rechaza', () => {
    const r = crearClinica(e.db, { nombre: 'Clínica Copia', clave: CLAVE });
    assert.equal(r.ok, false);
    assert.equal(r.codigo, 'clave_repetida');
    assert.equal(e.db.prepare('SELECT COUNT(*) AS n FROM clinica').get().n, 2);
    assert.equal(crearClinica(e.db, { nombre: 'Clínica Nueva', clave: 'otra-clave-distinta' }).ok, true);
  });

  it('[FR-004] la clave se guarda como hash, nunca en claro', () => {
    for (const f of e.db.prepare('SELECT clave_hash FROM clinica').all()) {
      assert.match(f.clave_hash, /^scrypt\$[0-9a-f]+\$[0-9a-f]+$/);
      assert.ok(!f.clave_hash.includes(CLAVE) && !f.clave_hash.includes(CLAVE_2));
    }
  });
});
