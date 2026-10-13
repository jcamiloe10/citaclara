import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { textoVisible } from '../ayudas/fixture.js';
import { CLAUDIA, CLAUDIA_RUIZ, entornoConSemilla, iniciarPortal, secretoDemo } from '../ayudas/portal.js';
import { cambiarEstado } from '../../src/domain/citas.js';

describe('Portal del paciente: cancelar una cita', () => {
  let e;
  let p;
  beforeEach(async () => {
    e = entornoConSemilla();
    p = await iniciarPortal(e);
  });
  afterEach(async () => {
    await p.cerrar();
    e.cerrar();
  });

  const s = secretoDemo(CLAUDIA);
  const ruta = (id) => `/p/${s}/citas/${id}/cancelar`;
  const seguir = async (r) => textoVisible((await p.get(r.ubicacion)).cuerpo);

  it('[002:FR-012][002:US2-E3] la pantalla de confirmación muestra la cita y no cancela; "No, volver" no cambia nada', async () => {
    const r = await p.get(ruta(798));
    assert.equal(r.estado, 200);
    const texto = textoVisible(r.cuerpo);
    assert.match(texto, /¿Seguro que quieres cancelar esta cita\?/);
    assert.match(texto, /lunes 5 de octubre de 2026, 16:30/);
    assert.match(texto, /María · Sesión de fisioterapia/);
    assert.match(texto, /Sí, cancelar la cita/);
    assert.match(r.cuerpo, new RegExp(`href="/p/${s}">No, volver</a>`));
    assert.equal(e.estadoDe(798), 'reservada');
    await p.get(ruta(798)); // abrir la confirmación varias veces tampoco cancela
    assert.equal(e.estadoDe(798), 'reservada');
  });

  it('[002:FR-013][002:FR-016][002:US2-E1][002:US2-E8] cancelar redirige, avisa con día y hora y la cita pasa al historial', async () => {
    const r = await p.post(ruta(798));
    assert.equal(r.estado, 303);
    assert.equal(r.ubicacion, `/p/${s}?aviso=cancelada&cita=798`);
    const texto = await seguir(r);
    assert.match(texto, /Cita cancelada: lunes 5 de octubre de 2026, 16:30\./);
    assert.match(texto, /Si necesitas otra cita, contacta con la clínica/);
    const [antes, despues] = texto.split('Historial');
    assert.doesNotMatch(antes, /16:30 María/);
    assert.match(despues, /lunes 5 de octubre de 2026, 16:30 María · Sesión de fisioterapia ✖ Cancelada/);
    assert.equal(e.estadoDe(798), 'cancelada');
  });

  it('[002:FR-011][002:US2-E4] a menos de 24 h no hay botón, se explica con el teléfono, y GET/POST directos no cambian nada', async () => {
    e.reloj.fijar('2026-10-04', '10:00');
    const pagina = await p.get(`/p/${s}`);
    assert.doesNotMatch(pagina.cuerpo, /citas\/805\/cancelar/);
    assert.match(pagina.cuerpo, /citas\/798\/cancelar/);
    const texto = textoVisible(pagina.cuerpo);
    assert.match(texto, /A menos de 24 horas de la cita no se puede cancelar desde aquí\. Llama a la clínica\. Llama a Clínica Eleva: 910 123 456/);
    const get = await p.get(ruta(805));
    assert.equal(get.estado, 303);
    assert.match(get.ubicacion, /aviso=fuera-de-plazo$/);
    const post = await p.post(ruta(805));
    assert.match(post.ubicacion, /aviso=fuera-de-plazo$/);
    assert.match(await seguir(post), /Esa cita ya no se puede cancelar desde aquí\. Llama a la clínica/);
    assert.equal(e.estadoDe(805), 'reservada');
  });

  it('[002:US2-E5] las citas del historial no ofrecen acciones y un POST directo sobre ellas no cambia nada', async () => {
    const pagina = await p.get(`/p/${s}?h=30`);
    const historial = pagina.cuerpo.split('id="titulo-historial"')[1];
    assert.doesNotMatch(historial, /cancelar/);
    for (const [id, estado] of [[768, 'completada'], [735, 'cancelada'], [441, 'no_asistida']]) {
      const post = await p.post(ruta(id));
      assert.equal(post.estado, 303);
      assert.match(post.ubicacion, estado === 'cancelada' ? /aviso=ya-cancelada$/ : /aviso=fuera-de-plazo$/);
      assert.equal(e.estadoDe(id), estado);
    }
  });

  it('[002:FR-015][002:FR-016][002:US2-E6] doble pulsación: solo se aplica una cancelación y la segunda ve el estado real', async () => {
    const primera = await p.post(ruta(798));
    assert.match(primera.ubicacion, /aviso=cancelada/);
    const segunda = await p.post(ruta(798));
    assert.match(segunda.ubicacion, /aviso=ya-cancelada$/);
    assert.match(await seguir(segunda), /Esa cita ya estaba cancelada/);
    assert.equal(e.db.prepare("SELECT COUNT(*) AS n FROM cita WHERE cancelada_por_paciente = 1").get().n, 1);
  });

  it('[002:FR-015][002:FR-016][002:US2-E7] si recepción cancela entre la confirmación y el POST, se informa y la lista se actualiza', async () => {
    assert.equal((await p.get(ruta(798))).estado, 200);
    assert.equal(cambiarEstado(e.db, { clinicaId: e.clinicaId, citaId: 798, estado: 'cancelada' }, e.ahora).ok, true);
    const r = await p.post(ruta(798));
    assert.match(r.ubicacion, /aviso=ya-cancelada$/);
    const texto = await seguir(r);
    assert.match(texto, /Esa cita ya estaba cancelada/);
    assert.doesNotMatch(texto.split('Historial')[0], /16:30 María/);
    assert.equal(e.cita(798).cancelada_por_paciente, 0, 'la cancelación fue de recepción, no del paciente');
  });

  it('[002:FR-015][002:FR-016] si recepción la marca completada, el paciente ve que ya no se puede cancelar y nunca "cancelada"', async () => {
    e.reloj.fijar('2026-10-05', '16:31'); // ya empezó: recepción puede completarla
    assert.equal(cambiarEstado(e.db, { clinicaId: e.clinicaId, citaId: 798, estado: 'completada' }, e.ahora).ok, true);
    const r = await p.post(ruta(798));
    assert.match(r.ubicacion, /aviso=fuera-de-plazo$/);
    const texto = await seguir(r);
    assert.doesNotMatch(texto, /Cita cancelada/);
    assert.equal(e.estadoDe(798), 'completada');
  });

  it('[002:FR-002] GET/POST sobre una cita de otra paciente, inexistente o con id no numérico → aviso sin cambios ni datos', async () => {
    const otra = secretoDemo(CLAUDIA_RUIZ);
    const ajena = await p.post(`/p/${otra}/citas/805/cancelar`);
    assert.match(ajena.ubicacion, /aviso=no-disponible$/);
    assert.match((await p.get(`/p/${otra}/citas/805/cancelar`)).ubicacion, /aviso=no-disponible$/);
    assert.match((await p.post(ruta(999999))).ubicacion, /aviso=no-disponible$/);
    assert.match((await p.post(ruta('abc'))).ubicacion, /aviso=no-disponible$/);
    assert.equal(e.estadoDe(805), 'reservada');
    const texto = await seguir(ajena);
    assert.match(texto, /No hemos encontrado esa cita/);
    assert.ok(!texto.includes("lunes 5 de octubre de 2026, 09:00 Lucía · Consulta de nutrición 🕒 Reservada Cancelar cita lunes 5 de octubre de 2026, 16:30"), "no revela las citas de la otra ficha");
  });

  it('[002:FR-016] el aviso "Cita cancelada" solo aparece si la cita está realmente cancelada', async () => {
    const falso = await p.get(`/p/${s}?aviso=cancelada&cita=798`); // 798 sigue reservada
    assert.doesNotMatch(textoVisible(falso.cuerpo), /Cita cancelada/);
    const inventado = await p.get(`/p/${s}?aviso=cancelada&cita=999999`);
    assert.doesNotMatch(textoVisible(inventado.cuerpo), /Cita cancelada/);
    const ajeno = await p.get(`/p/${secretoDemo(CLAUDIA_RUIZ)}?aviso=cancelada&cita=735`);
    assert.doesNotMatch(textoVisible(ajeno.cuerpo), /Cita cancelada/);
  });

  it('[002:FR-018][002:FR-012] un aviso desconocido en la URL se ignora y no se refleja nunca texto libre', async () => {
    const r = await p.get(`/p/${s}?aviso=%3Cscript%3Ealert(1)%3C/script%3E`);
    assert.equal(r.estado, 200);
    assert.doesNotMatch(r.cuerpo, /<script>alert/);
  });
});
