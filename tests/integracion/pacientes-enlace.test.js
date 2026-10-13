import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarServidor, textoVisible } from '../ayudas/fixture.js';
import { CLAUDIA, entornoConSemilla, iniciarPortal } from '../ayudas/portal.js';
import { config } from '../../src/config.js';

describe('Pantalla de pacientes de recepción: crear y renovar enlaces', () => {
  let e;
  let r;
  let p;
  beforeEach(async () => {
    e = entornoConSemilla();
    r = await iniciarServidor(e);
    p = await iniciarPortal(e);
  });
  afterEach(async () => {
    await r.cerrar();
    await p.cerrar();
    e.cerrar();
  });

  const enlaceDe = (html) => /value="(http[^"]+\/p\/[A-Za-z0-9_-]{43})"/.exec(html)?.[1];

  it('[002:FR-004] sin sesión, /pacientes y el POST redirigen a /acceso y no devuelven datos', async () => {
    const lista = await r.get('/pacientes');
    assert.equal(lista.estado, 303);
    assert.equal(lista.ubicacion, '/acceso');
    assert.doesNotMatch(lista.cuerpo, /Claudia/);
    const antes = e.db.prepare('SELECT acceso_hash FROM paciente WHERE id = ?').get(CLAUDIA).acceso_hash;
    const post = await r.post(`/pacientes/${CLAUDIA}/enlace`, {});
    assert.equal(post.estado, 303);
    assert.equal(post.ubicacion, '/acceso');
    assert.equal(e.db.prepare('SELECT acceso_hash FROM paciente WHERE id = ?').get(CLAUDIA).acceso_hash, antes);
  });

  it('[002:FR-004] un POST sin token CSRF devuelve 403 y no cambia el enlace', async () => {
    await r.entrar('eleva-demo');
    const antes = e.db.prepare('SELECT acceso_hash FROM paciente WHERE id = ?').get(CLAUDIA).acceso_hash;
    const post = await r.post(`/pacientes/${CLAUDIA}/enlace`, {});
    assert.equal(post.estado, 403);
    assert.equal(e.db.prepare('SELECT acceso_hash FROM paciente WHERE id = ?').get(CLAUDIA).acceso_hash, antes);
  });

  it('[002:FR-004][002:US3-E1] lista los pacientes por nombre con "Con enlace"/"Sin enlace" y busca sin tildes ni mayúsculas', async () => {
    await r.entrar('eleva-demo');
    e.db.prepare('UPDATE paciente SET acceso_hash = NULL WHERE id = ?').run(13);
    const lista = textoVisible((await r.get('/pacientes')).cuerpo);
    assert.match(lista, /Pacientes/);
    assert.match(lista, /Claudia Rodríguez Pérez 621 670 508 · claudia\.rodriguez8@ejemplo\.es Con enlace Renovar enlace/);
    assert.match(lista, /Claudia Ruiz Romero 678 447 400 · claudia\.ruiz13@ejemplo\.es Sin enlace Crear enlace/);
    const busqueda = textoVisible((await r.get('/pacientes?q=RODRIGUEZ%20perez')).cuerpo);
    assert.match(busqueda, /Claudia Rodríguez Pérez/);
    assert.doesNotMatch(busqueda, /Claudia Ruiz/);
    assert.match(textoVisible((await r.get('/pacientes?q=zzzz')).cuerpo), /No hay pacientes con ese nombre/);
  });

  it('[002:FR-004][002:US3-E4] crear enlace: 200 con el enlace completo una sola vez; abre la página; renovar invalida el anterior', async () => {
    await r.entrar('eleva-demo');
    e.db.prepare('UPDATE paciente SET acceso_hash = NULL WHERE id = ?').run(CLAUDIA);
    assert.equal((await p.get(`/p/${'D'.repeat(43)}`)).estado, 404);

    const confirmar = await r.get(`/pacientes/${CLAUDIA}/enlace`);
    assert.equal(confirmar.estado, 200);
    assert.match(textoVisible(confirmar.cuerpo), /Crear el enlace/);

    const creado = await r.enviar(`/pacientes/${CLAUDIA}/enlace`, {});
    assert.equal(creado.estado, 200); // sin redirección
    assert.equal(creado.cabeceras.get('cache-control'), 'no-store');
    assert.match(textoVisible(creado.cuerpo), /Este enlace no volverá a mostrarse/);
    const primero = enlaceDe(creado.cuerpo);
    assert.ok(primero);
    const ruta1 = new URL(primero).pathname;
    const pagina = await p.get(ruta1);
    assert.equal(pagina.estado, 200);
    assert.match(textoVisible(pagina.cuerpo), /Hola, Claudia/);

    const confirmarRenovar = textoVisible((await r.get(`/pacientes/${CLAUDIA}/enlace`)).cuerpo);
    assert.match(confirmarRenovar, /Renovar el enlace deja de valer el anterior/);
    const renovado = await r.enviar(`/pacientes/${CLAUDIA}/enlace`, {});
    const segundo = enlaceDe(renovado.cuerpo);
    assert.notEqual(segundo, primero);
    assert.equal((await p.get(ruta1)).estado, 404);
    assert.equal((await p.get(new URL(segundo).pathname)).estado, 200);

    // el secreto no vuelve a aparecer en ninguna otra pantalla
    const secreto2 = new URL(segundo).pathname.split('/').pop();
    for (const ruta of ['/pacientes', '/pacientes?q=claudia', `/pacientes/${CLAUDIA}/enlace`, '/agenda']) {
      assert.ok(!(await r.get(ruta)).cuerpo.includes(secreto2), ruta);
    }
  });

  it('[002:FR-004] un paciente de otra clínica o inexistente devuelve 404 y no cambia ningún enlace', async () => {
    const otra = e.crearOtraClinica();
    await r.entrar('eleva-demo');
    const hash = (id) => e.db.prepare('SELECT acceso_hash FROM paciente WHERE id = ?').get(id).acceso_hash;
    const antes = hash(otra.pacienteId);
    assert.equal((await r.enviar(`/pacientes/${otra.pacienteId}/enlace`, {})).estado, 404);
    assert.equal((await r.get(`/pacientes/${otra.pacienteId}/enlace`)).estado, 404);
    assert.equal((await r.enviar('/pacientes/999999/enlace', {})).estado, 404);
    assert.equal(hash(otra.pacienteId), antes);
    assert.equal((await p.get(`/p/${otra.secreto}`)).estado, 200);
  });

  it('[002:FR-004] el enlace usa CITACLARA_URL_PUBLICA si existe y el host de la petición si no', async () => {
    await r.entrar('eleva-demo');
    const sinVariable = enlaceDe((await r.enviar(`/pacientes/${CLAUDIA}/enlace`, {})).cuerpo);
    assert.ok(sinVariable.startsWith(`${r.base}/p/`));
    config.urlPublica = 'https://citas.eleva.example';
    try {
      const conVariable = enlaceDe((await r.enviar(`/pacientes/${CLAUDIA}/enlace`, {})).cuerpo);
      assert.ok(conVariable.startsWith('https://citas.eleva.example/p/'));
    } finally {
      config.urlPublica = null;
    }
  });

  it('[002:FR-004] la cabecera de recepción incluye el enlace "Pacientes"', async () => {
    await r.entrar('eleva-demo');
    assert.match((await r.get('/agenda')).cuerpo, /href="\/pacientes"/);
  });
});
