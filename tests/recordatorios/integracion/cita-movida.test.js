import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { cambiarEstado } from '../../../src/domain/citas.js';
import { cancelarPorEnlace, consultarEnlace } from '../../../src/domain/recordatorios.js';
import { crearCarpetaSalida, crearEntorno, crearReloj } from '../../ayudas/fixture.js';
import { citaA, ficheros, generar, secretoDeCita } from '../ayudas.js';

// El proceso se ejecuta el domingo 4 de octubre de 2026 a las 07:00. En la 001 no se reprograma:
// mover una cita es cancelarla y crear otra, y una futura reprogramación cambiaría su hora de inicio.
describe('Cita movida: se trata como cualquier otra cita', () => {
  let e;
  let carpeta;
  beforeEach(() => {
    e = crearEntorno({ archivo: true, reloj: crearReloj('2026-10-04', '07:00') });
    carpeta = crearCarpetaSalida();
  });
  afterEach(() => {
    e.cerrar();
    carpeta.limpiar();
  });

  const estado = (id) => e.db.prepare('SELECT estado FROM cita WHERE id = ?').get(id).estado;
  const filas = () => e.db.prepare('SELECT cita_id, inicio_cita, resultado FROM recordatorio ORDER BY id').all();

  it('[003:US3-E1][003:FR-017] al cancelar por recepción y crear otra cita, el enlace antiguo no cancela nunca la cita nueva', () => {
    const antigua = citaA(e, '2026-10-05', '10:00');
    generar(e, carpeta);
    const secretoAntiguo = secretoDeCita(e, carpeta, antigua);

    assert.equal(cambiarEstado(e.db, { clinicaId: e.clinicaId, citaId: antigua, estado: 'cancelada' }, e.ahora).ok, true);
    const nueva = citaA(e, '2026-10-05', '11:00');

    assert.equal(consultarEnlace(e.db, secretoAntiguo, e.ahora).situacion, 'ya_cancelada');
    const intento = cancelarPorEnlace(e.db, secretoAntiguo, e.ahora);
    assert.equal(intento.codigo, 'ya_cancelada');
    assert.equal(estado(nueva), 'reservada', 'el enlace antiguo nunca toca la cita nueva');
  });

  it('[003:US3-E1][003:FR-018] la cita nueva recibe su propio recordatorio (otro fichero y otro enlace)', () => {
    const antigua = citaA(e, '2026-10-05', '10:00');
    generar(e, carpeta);
    const secretoAntiguo = secretoDeCita(e, carpeta, antigua);
    cambiarEstado(e.db, { clinicaId: e.clinicaId, citaId: antigua, estado: 'cancelada' }, e.ahora);
    const nueva = citaA(e, '2026-10-05', '11:00');

    const r = generar(e, carpeta);
    assert.equal(r.generados, 1);
    assert.equal(ficheros(carpeta).length, 2);
    const secretoNuevo = secretoDeCita(e, carpeta, nueva);
    assert.notEqual(secretoNuevo, secretoAntiguo);
    assert.equal(cancelarPorEnlace(e.db, secretoNuevo, e.ahora).codigo, 'cancelada');
    assert.equal(estado(nueva), 'cancelada');
  });

  it('[003:US3-E2][003:FR-018] si la hora de la cita cambia, la cita en su nueva hora recibe su recordatorio y el enlace anterior deja de valer', () => {
    const id = citaA(e, '2026-10-05', '10:00');
    generar(e, carpeta);
    const secretoAnterior = secretoDeCita(e, carpeta, id);

    // Simulación de una futura reprogramación: la misma cita cambia su hora de inicio y de fin.
    e.db
      .prepare("UPDATE cita SET inicio = '2026-10-05T12:00:00.000Z', fin = '2026-10-05T12:45:00.000Z' WHERE id = ?")
      .run(id);
    assert.deepEqual(consultarEnlace(e.db, secretoAnterior, e.ahora), { ok: false, codigo: 'no_valido' });

    const r = generar(e, carpeta);
    assert.equal(r.generados, 1);
    assert.deepEqual(
      filas().map((f) => [f.cita_id, f.inicio_cita, f.resultado]),
      [
        [id, '2026-10-05T08:00:00.000Z', 'generado'],
        [id, '2026-10-05T12:00:00.000Z', 'generado'],
      ],
    );
    assert.equal(ficheros(carpeta).length, 2, 'un fichero distinto por hora de inicio');
    const nuevo = e.db.prepare("SELECT fichero FROM recordatorio WHERE inicio_cita = '2026-10-05T12:00:00.000Z'").get();
    assert.match(nuevo.fichero, /20261005T1200Z\.eml$/);
    // El enlace anterior sigue sin valer y el nuevo sí cancela la cita en su nueva hora.
    assert.equal(cancelarPorEnlace(e.db, secretoAnterior, e.ahora).codigo, 'no_valido');
    assert.equal(estado(id), 'reservada');
  });

  it('[003:FR-017] el recordatorio de una cita que ya no está reservada no afecta a ninguna otra cita', () => {
    const a = citaA(e, '2026-10-05', '10:00', { paciente: e.pacientes[0] });
    const b = citaA(e, '2026-10-05', '11:00', { paciente: e.pacientes[0] });
    generar(e, carpeta);
    const secretoA = secretoDeCita(e, carpeta, a);
    e.db.prepare("UPDATE cita SET estado = 'completada' WHERE id = ?").run(a);
    assert.equal(cancelarPorEnlace(e.db, secretoA, e.ahora).codigo, 'no_reservada');
    assert.equal(estado(b), 'reservada');
    assert.equal(estado(a), 'completada');
  });
});
