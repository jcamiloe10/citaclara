import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { crearEntorno, en, iniciarServidor, textoVisible } from '../ayudas/fixture.js';

describe('Agenda del día por HTTP', () => {
  let e;
  let c;
  beforeEach(async () => {
    e = crearEntorno();
    c = await iniciarServidor(e);
    await c.entrar();
    e.insertarCita({
      profesional: e.profesionales.maria,
      servicio: e.servicios.sesion,
      paciente: e.pacientes[0],
      inicio: en('2026-10-05', '10:00'),
      fin: en('2026-10-05', '10:45'),
    });
    e.insertarCita({
      profesional: e.profesionales.jorge,
      servicio: e.servicios.primera,
      paciente: e.pacientes[1],
      inicio: en('2026-10-05', '11:00'),
      fin: en('2026-10-05', '12:00'),
      estado: 'completada',
    });
    e.insertarCita({
      profesional: e.profesionales.lucia,
      servicio: e.servicios.consulta,
      paciente: e.pacientes[2],
      inicio: en('2026-10-05', '12:00'),
      fin: en('2026-10-05', '12:30'),
      estado: 'cancelada',
    });
  });
  afterEach(async () => {
    await c.cerrar();
    e.cerrar();
  });

  it('[US2-E3][FR-022][FR-023] muestra a los tres profesionales con horario, paciente, servicio y estado en texto', async () => {
    const r = await c.get('/agenda?dia=2026-10-05');
    assert.equal(r.estado, 200);
    const t = textoVisible(r.cuerpo);
    for (const nombre of ['María', 'Jorge', 'Lucía']) assert.match(t, new RegExp(nombre));
    assert.match(t, /10:00–10:45/);
    assert.match(t, /Ana Ruiz/);
    assert.match(t, /Sesión de fisioterapia · 45 min · 40,00 €/);
    assert.match(t, /Reservada/);
    assert.match(t, /Completada/);
    assert.match(t, /Libre/);
    // Los estados se distinguen con texto e icono, no solo con color.
    assert.match(r.cuerpo, /estado-reservada"><span aria-hidden="true">🕒<\/span> Reservada/);
    assert.match(r.cuerpo, /estado-completada"><span aria-hidden="true">✔<\/span> Completada/);
  });

  it('[US2-E4] una cita cancelada deja el tramo libre y aparece en el histórico con su estado', async () => {
    const t = textoVisible((await c.get('/agenda?dia=2026-10-05')).cuerpo);
    assert.match(t, /Canceladas y no asistidas/);
    assert.match(t, /12:00–12:30 · Eva Mora · Consulta de nutrición ✖ Cancelada/);
    // El tramo de Lucía es libre de 09:00 a 20:00 pese a la cita cancelada.
    assert.match(t, /Lucía Nutrición Libre|09:00–20:00 Libre/);
  });

  it('[FR-024] ofrece día anterior, hoy y día siguiente; el día inicial es hoy', async () => {
    const r = await c.get('/agenda?dia=2026-10-05');
    assert.match(r.cuerpo, /href="\/agenda\?dia=2026-10-04"/);
    assert.match(r.cuerpo, /href="\/agenda\?dia=2026-10-02"/); // Hoy (reloj fijo: 2 de octubre)
    assert.match(r.cuerpo, /href="\/agenda\?dia=2026-10-06"/);
    const inicial = textoVisible((await c.get('/agenda')).cuerpo);
    assert.match(inicial, /viernes 2 de octubre de 2026/);
  });

  it('[FR-024] un día inválido da 400 con un enlace a "Hoy"', async () => {
    const r = await c.get('/agenda?dia=2026-13-45');
    assert.equal(r.estado, 400);
    assert.match(r.cuerpo, /El día indicado no es válido/);
    assert.match(r.cuerpo, /href="\/agenda\?dia=2026-10-02"/);
  });

  it('[FR-028] las fechas se muestran en español sin ambigüedad y ligadas a la hora de España', async () => {
    const r = await c.get('/agenda?dia=2026-10-05');
    const t = textoVisible(r.cuerpo);
    assert.match(t, /lunes 5 de octubre de 2026/);
    assert.match(t, /Todas las horas son hora de España/);
    assert.doesNotMatch(t, /\b\d{1,2}\/\d{1,2}(\/\d{2,4})?\b/);
    assert.match(r.cuerpo, /<html lang="es">/);
  });

  it('[US2-E6] sábado y domingo indican que la clínica no abre', async () => {
    const r = await c.get('/agenda?dia=2026-10-03');
    assert.match(textoVisible(r.cuerpo), /La clínica no abre este día/);
    assert.doesNotMatch(r.cuerpo, /Reservar<\/a>/);
  });

  it('[FR-025][RN4] cada hueco libre enlaza al alta con profesional, día y la hora de inicio del hueco', async () => {
    const r = await c.get('/agenda?dia=2026-10-05');
    // María: libre de 09:00 a 10:00 y de 10:45 a 20:00.
    assert.match(r.cuerpo, new RegExp(`/citas/nueva\\?profesional=${e.profesionales.maria}&amp;dia=2026-10-05&amp;hora=09:00`));
    assert.match(r.cuerpo, new RegExp(`/citas/nueva\\?profesional=${e.profesionales.maria}&amp;dia=2026-10-05&amp;hora=10:45`));
    const horas = [...r.cuerpo.matchAll(/hora=(\d{2}:\d{2})/g)].map((m) => m[1]);
    assert.ok(horas.length > 0 && horas.every((h) => Number(h.slice(3)) % 15 === 0));
  });

  it('[FR-029][US2-E7][SC-006] la página es adaptable a móvil: ventana de visualización y rejilla sin anchos fijos', async () => {
    // Comprobación estática de apoyo; la comprobación en un móvil real es manual (quickstart, paso 9).
    const r = await c.get('/agenda?dia=2026-10-05');
    assert.match(r.cuerpo, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
    const css = readFileSync(new URL('../../src/web/publico/estilos.css', import.meta.url), 'utf8');
    assert.match(css, /@media \(max-width: \d+px\)/);
    assert.match(css, /grid-template-columns: 1fr;/);
    for (const [, px] of css.matchAll(/(?:^|[;{\s])(?:min-)?width:\s*(\d+)px/g)) {
      assert.ok(Number(px) <= 320, `ancho fijo de ${px}px puede forzar desplazamiento horizontal`);
    }
    // Los controles táctiles miden al menos 44 px.
    assert.match(css, /min-height: 44px/);
  });

  it('[FR-015] los importes se muestran al céntimo con formato de euros de España', async () => {
    const t = textoVisible((await c.get('/agenda?dia=2026-10-05')).cuerpo).replace(/ /g, ' ');
    assert.match(t, /40,00 €/);
    assert.match(t, /50,00 €/);
  });
});
