import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CLAVE, crearCarpetaSalida, crearEntorno, crearReloj, iniciarServidor, textoVisible } from '../../ayudas/fixture.js';
import { citaA, generar } from '../ayudas.js';

describe('Agenda de recepción: citas sin recordatorio por falta de email', () => {
  let e;
  let carpeta;
  let recepcion;
  beforeEach(async () => {
    e = crearEntorno({ reloj: crearReloj('2026-10-04', '07:00') });
    carpeta = crearCarpetaSalida();
    recepcion = await iniciarServidor(e);
    await recepcion.entrar(CLAVE);
  });
  afterEach(async () => {
    await recepcion.cerrar();
    e.cerrar();
    carpeta.limpiar();
  });

  const agenda = async () => textoVisible((await recepcion.get('/agenda?dia=2026-10-05')).cuerpo);

  it('[003:FR-006][003:SC-006] la cita reservada sin email recordada muestra "Sin email: sin recordatorio"; la recordada con éxito no', async () => {
    e.db.prepare("UPDATE paciente SET email = 'sin-correo' WHERE id = ?").run(e.pacientes[0]);
    citaA(e, '2026-10-05', '10:00', { paciente: e.pacientes[0] });
    citaA(e, '2026-10-05', '11:00', { paciente: e.pacientes[1] });
    generar(e, carpeta);
    const texto = await agenda();
    assert.match(texto, /10:00–10:45 🕒 Reservada Ana Ruiz ✉ Sin email: sin recordatorio/);
    assert.doesNotMatch(texto.split('11:00–11:45')[1], /Sin email/);
    assert.equal((texto.match(/Sin email: sin recordatorio/g) ?? []).length, 1);
  });

  it('[003:FR-006] antes de ejecutar el proceso, y en clínicas sin recordatorios, la agenda no muestra nada nuevo', async () => {
    citaA(e, '2026-10-05', '10:00');
    const texto = await agenda();
    assert.match(texto, /10:00–10:45/);
    assert.doesNotMatch(texto, /Sin email/);
  });

  it('[003:FR-006] la etiqueta desaparece cuando la cita deja de estar reservada', async () => {
    e.db.prepare("UPDATE paciente SET email = 'sin-correo' WHERE id = ?").run(e.pacientes[0]);
    const id = citaA(e, '2026-10-05', '10:00', { paciente: e.pacientes[0] });
    generar(e, carpeta);
    assert.match(await agenda(), /Sin email: sin recordatorio/);
    await recepcion.enviar(`/citas/${id}/estado`, { estado: 'cancelada', dia: '2026-10-05' });
    assert.doesNotMatch(await agenda(), /Sin email/);
  });
});
