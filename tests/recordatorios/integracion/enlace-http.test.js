import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { iniciarPortal } from '../../ayudas/portal.js';
import { conTelefonoClinica, crearCarpetaSalida, crearEntorno, crearReloj, textoVisible } from '../../ayudas/fixture.js';
import { nuevoSecreto } from '../../../src/domain/enlaces.js';
import { citaA, generar, secretoDeCita } from '../ayudas.js';

describe('Enlace de cancelación por HTTP (sin cookie ni clave)', () => {
  let e;
  let carpeta;
  let web;
  let citaId;
  let secreto;
  beforeEach(async () => {
    e = crearEntorno({ reloj: crearReloj('2026-10-04', '07:00') });
    carpeta = crearCarpetaSalida();
    conTelefonoClinica(e.db, e.clinicaId, '910123456');
    citaId = citaA(e, '2026-10-05', '10:00');
    generar(e, carpeta);
    secreto = secretoDeCita(e, carpeta, citaId);
    web = await iniciarPortal(e);
  });
  afterEach(async () => {
    await web.cerrar();
    e.cerrar();
    carpeta.limpiar();
  });

  const estado = () => e.db.prepare('SELECT estado FROM cita WHERE id = ?').get(citaId).estado;
  const ruta = (s = secreto) => `/cancelar/${s}`;

  it('[003:US2-E1][003:FR-010] abrir el enlace muestra los datos de la cita y el botón, y no cambia la cita', async () => {
    const r = await web.get(ruta());
    assert.equal(r.estado, 200);
    const texto = textoVisible(r.cuerpo);
    assert.match(texto, /lunes 5 de octubre de 2026, 10:00 \(hora de España\)/);
    assert.match(texto, /Clínica Eleva/);
    assert.match(texto, /María · Sesión de fisioterapia/);
    assert.match(texto, /Ana Ruiz/);
    assert.match(texto, /Cancelar mi cita/);
    assert.match(texto, /el hueco queda libre para otra persona/);
    assert.match(r.cuerpo, new RegExp(`<form method="post" action="/cancelar/${secreto}"`));
    assert.equal(estado(), 'reservada');
    await web.get(ruta());
    assert.equal(estado(), 'reservada', 'un GET repetido tampoco cambia nada');
  });

  it('[003:US2-E1][003:FR-011] confirmar cancela la cita y muestra la confirmación', async () => {
    const r = await web.post(ruta());
    assert.equal(r.estado, 200);
    assert.match(textoVisible(r.cuerpo), /Tu cita queda cancelada\. Gracias por avisar\./);
    assert.equal(estado(), 'cancelada');
  });

  it('[003:US2-E2][003:FR-013] repetir GET y POST informa de que ya está cancelada, con 200', async () => {
    await web.post(ruta());
    const get = await web.get(ruta());
    const post = await web.post(ruta());
    for (const r of [get, post]) {
      assert.equal(r.estado, 200);
      assert.match(textoVisible(r.cuerpo), /Esta cita ya está cancelada\./);
      assert.doesNotMatch(r.cuerpo, /Cancelar mi cita/);
    }
    assert.equal(estado(), 'cancelada');
  });

  it('[003:US2-E3] una cita que ya no está reservada informa de que no se puede cancelar y no ofrece el botón', async () => {
    e.db.prepare("UPDATE cita SET estado = 'completada' WHERE id = ?").run(citaId);
    for (const r of [await web.get(ruta()), await web.post(ruta())]) {
      assert.equal(r.estado, 200);
      assert.match(textoVisible(r.cuerpo), /Esta cita ya no se puede cancelar\./);
      assert.doesNotMatch(r.cuerpo, /Cancelar mi cita/);
    }
    assert.equal(estado(), 'completada');
  });

  it('[003:US2-E5][003:FR-012] con menos de 24 h no hay botón y se muestra el teléfono de la clínica; el POST no cancela', async () => {
    e.reloj.fijar('2026-10-04', '10:01');
    const get = await web.get(ruta());
    const texto = textoVisible(get.cuerpo);
    assert.match(texto, /Ya no se puede cancelar desde aquí/);
    assert.match(texto, /Llama a Clínica Eleva: 910 123 456/);
    assert.doesNotMatch(get.cuerpo, /Cancelar mi cita/);
    const post = await web.post(ruta());
    assert.equal(post.estado, 200);
    assert.match(textoVisible(post.cuerpo), /Llama a Clínica Eleva: 910 123 456/);
    assert.equal(estado(), 'reservada');
  });

  it('[003:US2-E5][003:FR-012] sin teléfono se dice "llama a la clínica" sin inventar ningún número', async () => {
    e.db.prepare('UPDATE clinica SET telefono = NULL WHERE id = ?').run(e.clinicaId);
    e.reloj.fijar('2026-10-04', '10:01');
    const texto = textoVisible((await web.get(ruta())).cuerpo);
    assert.match(texto, /Llama a Clínica Eleva\./);
    assert.doesNotMatch(texto, /\d{3} \d{3} \d{3}/);
  });

  it('[003:US2-E4][003:FR-015][003:SC-005] enlaces inventados, alterados, vacíos o muy largos dan el mismo 404 genérico sin datos y no cambian nada', async () => {
    const alterado = `${secreto.slice(0, -1)}${secreto.endsWith('A') ? 'B' : 'A'}`;
    const malos = [nuevoSecreto(), alterado, 'corto', 'a'.repeat(5000), `${secreto}/extra`, `${secreto}%00`, 'ñ'.repeat(43)];
    const cuerpos = new Set();
    for (const malo of malos) {
      for (const r of [await web.get(`/cancelar/${malo}`), await web.post(`/cancelar/${malo}`)]) {
        assert.equal(r.estado, 404, malo.slice(0, 20));
        const texto = textoVisible(r.cuerpo);
        assert.match(texto, /Este enlace no es válido\./);
        assert.doesNotMatch(texto, /Ana Ruiz|María|Clínica Eleva|Sesión de fisioterapia|octubre/);
        cuerpos.add(r.cuerpo);
      }
    }
    assert.equal(cuerpos.size, 1, 'la respuesta es idéntica para cualquier enlace no válido');
    assert.equal((await web.get('/cancelar/')).estado, 404);
    assert.equal(estado(), 'reservada');
  });

  it('[003:FR-010] las respuestas llevan las cabeceras de privacidad (sin caché, sin referente, no indexable)', async () => {
    for (const r of [await web.get(ruta()), await web.get('/cancelar/inventado')]) {
      assert.equal(r.cabeceras.get('cache-control'), 'no-store');
      assert.equal(r.cabeceras.get('referrer-policy'), 'no-referrer');
      assert.match(r.cabeceras.get('x-robots-tag'), /noindex/);
      assert.equal(r.cabeceras.get('set-cookie'), null, 'no emite cookies');
    }
  });

  it('[003:SC-007] los textos están en español de España, con la hora de España y sin jerga técnica', async () => {
    const texto = textoVisible((await web.get(ruta())).cuerpo);
    assert.match(texto, /\(hora de España\)/);
    assert.doesNotMatch(texto, /token|secreto|error 404|sql|null|undefined|\bID\b/i);
  });

  it('[003:SC-003] la página sirve el viewport móvil y el botón de cancelar es un botón normal, no desactivado', async () => {
    const { cuerpo } = await web.get(ruta());
    assert.match(cuerpo, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
    assert.match(cuerpo, /<button class="boton peligro" type="submit">Cancelar mi cita<\/button>/);
    assert.doesNotMatch(cuerpo, /disabled/);
  });
});
