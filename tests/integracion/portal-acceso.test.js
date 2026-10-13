import { after, before, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarServidor, textoVisible } from '../ayudas/fixture.js';
import { CLAUDIA, entornoConSemilla, iniciarPortal, secretoDemo } from '../ayudas/portal.js';
import { crearOrenovarEnlace } from '../../src/domain/enlaces.js';

describe('Portal del paciente: acceso sin cuenta ni contraseña', () => {
  let e;
  let p;
  let otra;
  before(async () => {
    e = entornoConSemilla();
    otra = e.crearOtraClinica();
    p = await iniciarPortal(e);
  });
  after(async () => {
    await p.cerrar();
    e.cerrar();
  });

  const secreto = secretoDemo(CLAUDIA);

  it('[002:FR-001][002:US3-E1] el enlace de Claudia abre su página sin teclear nada ni enviar cookie', async () => {
    const r = await p.get(`/p/${secreto}`);
    assert.equal(r.estado, 200);
    assert.match(textoVisible(r.cuerpo), /Hola, Claudia/);
    assert.equal(r.cabeceras.get('set-cookie'), null);
  });

  it('[002:FR-003][002:US3-E2] inventado, de longitud errónea, con caracteres ajenos o renovado: 404 con la misma respuesta', async () => {
    const antiguo = secretoDemo(7);
    crearOrenovarEnlace(e.db, { clinicaId: e.clinicaId, pacienteId: 7 }); // renovado: el de demostración ya no vale
    const casos = [
      'A'.repeat(43), // inventado
      secreto.slice(0, 20), // longitud errónea
      `${secreto}extra`, // demasiado largo
      `${secreto.slice(0, 42)}!`, // carácter ajeno
      antiguo, // renovado
    ];
    const cuerpos = new Set();
    for (const malo of casos) {
      const r = await p.get(`/p/${encodeURIComponent(malo)}`);
      assert.equal(r.estado, 404, malo);
      cuerpos.add(r.cuerpo);
    }
    assert.equal(cuerpos.size, 1, 'todas las causas de invalidez dan exactamente el mismo cuerpo');
    const texto = textoVisible([...cuerpos][0]);
    assert.match(texto, /Este enlace no es válido/);
    assert.match(texto, /Llama a la clínica y te daremos uno nuevo/);
    assert.doesNotMatch(texto, /Eleva|Claudia|Marta|Clínica Otra/);
  });

  it('[002:FR-002][002:US3-E3] alterar un carácter del enlace de Claudia nunca devuelve datos de otra paciente (43 posiciones)', async () => {
    const alfabeto = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
    for (let i = 0; i < secreto.length; i++) {
      const otro = alfabeto[(alfabeto.indexOf(secreto[i]) + 1) % alfabeto.length];
      const r = await p.get(`/p/${secreto.slice(0, i)}${otro}${secreto.slice(i + 1)}`);
      assert.equal(r.estado, 404);
      assert.doesNotMatch(textoVisible(r.cuerpo), /Hola,|Reservada|Completada/);
    }
  });

  it('[002:FR-002][002:SC-006] el enlace de una clínica no abre fichas de otra y cada uno ve solo lo suyo', async () => {
    const r = await p.get(`/p/${otra.secreto}`);
    const texto = textoVisible(r.cuerpo);
    assert.equal(r.estado, 200);
    assert.match(texto, /Hola, Marta/);
    assert.match(texto, /Clínica Otra · 911 000 000/);
    assert.doesNotMatch(texto, /Claudia|Eleva|Lucía|María|Jorge/);
    // una cita de la clínica de Claudia pedida con el enlace de la otra clínica no se revela
    const c = await p.get(`/p/${otra.secreto}/citas/805/cancelar`);
    assert.equal(c.estado, 303);
    assert.match(c.ubicacion, /aviso=no-disponible$/);
    assert.equal(e.estadoDe(805), 'reservada');
  });

  it('[002:FR-005][002:US3-E5] todas las respuestas de /p/… llevan cabeceras de privacidad y noindex', async () => {
    const rutas = [
      `/p/${secreto}`,
      `/p/${secreto}/citas/805/cancelar`,
      `/p/${'B'.repeat(43)}`,
      `/p/${secreto}/otra-cosa`,
      '/p/',
    ];
    for (const ruta of rutas) {
      const r = await p.get(ruta);
      assert.equal(r.cabeceras.get('cache-control'), 'no-store', ruta);
      assert.equal(r.cabeceras.get('referrer-policy'), 'no-referrer', ruta);
      assert.match(r.cabeceras.get('x-robots-tag'), /noindex/, ruta);
      assert.match(r.cuerpo, /<meta name="robots" content="noindex, nofollow">/, ruta);
    }
  });

  it('[002:FR-001] ninguna respuesta de /p/… emite cookies y la cookie de recepción no cambia el resultado', async () => {
    const recepcion = await iniciarServidor(e);
    try {
      assert.equal((await recepcion.entrar('eleva-demo')).estado, 303);
      assert.ok(recepcion.cookie);
      const conCookie = await fetch(`${recepcion.base}/p/${'C'.repeat(43)}`, { headers: { cookie: recepcion.cookie } });
      assert.equal(conCookie.status, 404);
      assert.equal(conCookie.headers.get('set-cookie'), null);
      const sin = await p.get(`/p/${'C'.repeat(43)}`);
      assert.equal(sin.cuerpo, await conCookie.text());
    } finally {
      await recepcion.cerrar();
    }
  });

  it('[002:FR-005][002:FR-003] subrutas desconocidas y fallos internos devuelven las páginas de error del portal, sin enlaces a recepción ni el secreto', async () => {
    for (const ruta of [`/p/${secreto}/otra-cosa`, '/p/']) {
      const r = await p.get(ruta);
      assert.equal(r.estado, 404, ruta);
      assert.doesNotMatch(r.cuerpo, /href="\/agenda"|href="\/pacientes"|Cerrar sesión|Volver a la agenda/, ruta);
      assert.ok(!r.cuerpo.includes(secreto));
      assert.match(textoVisible(r.cuerpo), /Llama a la clínica/);
    }
  });

  it('[002:FR-005] un fallo interno dentro del portal muestra su propia página de error y no registra el secreto', async () => {
    const { crearApp } = await import('../../src/app.js');
    const { createServer } = await import('node:http');
    const dbRota = { prepare: () => { throw new Error('fallo forzado'); } };
    const servidor = createServer(crearApp({ db: dbRota, ahora: e.ahora, secreto: 's' }));
    await new Promise((ok) => servidor.listen(0, '127.0.0.1', ok));
    const registros = [];
    const original = console.error;
    console.error = (...args) => registros.push(args.map(String).join(' '));
    try {
      const r = await fetch(`http://127.0.0.1:${servidor.address().port}/p/${secreto}`);
      const cuerpo = await r.text();
      assert.equal(r.status, 500);
      assert.doesNotMatch(cuerpo, /href="\/agenda"|Volver a la agenda/);
      assert.ok(!cuerpo.includes(secreto));
      assert.equal(r.headers.get('cache-control'), 'no-store');
      assert.ok(registros.length > 0);
      assert.ok(registros.every((l) => !l.includes(secreto)));
    } finally {
      console.error = original;
      await new Promise((ok) => servidor.close(ok));
    }
  });
});
