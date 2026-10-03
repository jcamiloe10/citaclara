import { afterEach, beforeEach, describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { cambiarEstado, crearCita } from '../../src/domain/citas.js';
import { crearEntorno, en, haySolapes } from '../ayudas/fixture.js';

const TRABAJADOR = fileURLToPath(new URL('../concurrencia/trabajador.js', import.meta.url));

describe('Cambios de estado de una cita', () => {
  let e;
  beforeEach(() => {
    e = crearEntorno();
  });
  afterEach(() => e.cerrar());

  const poner = (dia, hora, estado = 'reservada', prof = 'maria') =>
    e.insertarCita({
      profesional: e.profesionales[prof],
      servicio: e.servicios.sesion,
      inicio: en(dia, hora),
      fin: new Date(en(dia, hora).getTime() + 45 * 60_000),
      estado,
    });
  const cambiar = (citaId, estado) => cambiarEstado(e.db, { clinicaId: e.clinicaId, citaId, estado }, e.ahora);
  const estadoDe = (id) => e.db.prepare('SELECT estado FROM cita WHERE id = ?').get(id).estado;
  const reservar = (dia, hora) =>
    crearCita(
      e.db,
      {
        clinicaId: e.clinicaId,
        profesionalId: e.profesionales.maria,
        servicioId: e.servicios.sesion,
        pacienteId: e.pacientes[1],
        inicio: en(dia, hora),
      },
      e.ahora,
    );

  it('[US3-E1][FR-012] completada desde el instante de inicio (inclusive) y sigue ocupando el hueco', () => {
    const id = poner('2026-10-05', '10:00');
    e.reloj.fijar('2026-10-05', '09:59');
    assert.equal(cambiar(id, 'completada').codigo, 'no_ha_empezado');
    e.reloj.fijar('2026-10-05', '10:00'); // justo al inicio
    assert.equal(cambiar(id, 'completada').ok, true);
    assert.equal(estadoDe(id), 'completada');
    e.reloj.fijar('2026-10-04', '08:00');
    assert.equal(reservar('2026-10-05', '10:15').codigo, 'ocupado');
  });

  it('[US3-E2][FR-012] cancelar libera el hueco, también con la cita en curso', () => {
    const futura = poner('2026-10-05', '10:00');
    assert.equal(cambiar(futura, 'cancelada').ok, true);
    assert.equal(reservar('2026-10-05', '10:00').ok, true);

    const enCurso = poner('2026-10-06', '10:00');
    e.reloj.fijar('2026-10-06', '10:20');
    assert.equal(cambiar(enCurso, 'cancelada').ok, true);
    assert.equal(estadoDe(enCurso), 'cancelada');
  });

  it('[US3-E3][FR-013] no asistida con la hora de inicio ya pasada libera el hueco', () => {
    const id = poner('2026-10-05', '10:00');
    e.reloj.fijar('2026-10-05', '10:30');
    assert.equal(cambiar(id, 'no_asistida').ok, true);
    assert.equal(estadoDe(id), 'no_asistida');
    e.reloj.fijar('2026-10-06', '08:00');
    assert.equal(reservar('2026-10-05', '10:00').codigo, 'pasado'); // RN2 sigue vigente
    // El hueco quedó libre: otra cita de otro día no se ve afectada y la agenda no tiene solapes.
    assert.equal(haySolapes(e.db), false);
  });

  it('[US3-E4][FR-013][FR-014] antes de empezar no se puede marcar completada ni no asistida', () => {
    const id = poner('2026-10-05', '10:00');
    assert.equal(cambiar(id, 'completada').codigo, 'no_ha_empezado');
    assert.equal(cambiar(id, 'no_asistida').codigo, 'no_ha_empezado');
    assert.equal(estadoDe(id), 'reservada');
  });

  it('[US3-E5][FR-012] desde completada, cancelada o no asistida no se puede cambiar de estado', () => {
    e.reloj.fijar('2026-10-06', '12:00');
    for (const final of ['completada', 'cancelada', 'no_asistida']) {
      for (const nuevo of ['completada', 'cancelada', 'no_asistida']) {
        const id = poner('2026-10-05', '10:00', final, 'jorge');
        const r = cambiar(id, nuevo);
        assert.deepEqual([r.ok, r.codigo], [false, 'no_reservada'], `${final} → ${nuevo}`);
        assert.equal(estadoDe(id), final);
        e.db.prepare('DELETE FROM cita WHERE id = ?').run(id);
      }
    }
  });

  it('[FR-012] rechaza estados desconocidos y citas inexistentes o de otra clínica', () => {
    const id = poner('2026-10-05', '10:00');
    assert.equal(cambiar(id, 'reservada').codigo, 'estado_invalido');
    assert.equal(cambiar(id, 'borrada').codigo, 'estado_invalido');
    assert.equal(cambiar(9999, 'cancelada').codigo, 'no_encontrado');
    const ajeno = cambiarEstado(e.db, { clinicaId: e.clinica2.id, citaId: id, estado: 'cancelada' }, e.ahora);
    assert.equal(ajeno.codigo, 'no_encontrado');
    assert.equal(estadoDe(id), 'reservada');
  });

  it('[FR-019][RN1] ninguna transición crea un solape', () => {
    e.reloj.fijar('2026-10-06', '12:00');
    const ids = [poner('2026-10-05', '09:00'), poner('2026-10-05', '09:45'), poner('2026-10-05', '10:30')];
    cambiar(ids[0], 'completada');
    cambiar(ids[1], 'cancelada');
    cambiar(ids[2], 'no_asistida');
    for (const id of ids) for (const estado of ['completada', 'cancelada', 'no_asistida']) cambiar(id, estado);
    assert.equal(haySolapes(e.db), false);
  });
});

describe('Cambios de estado simultáneos desde procesos distintos', () => {
  let e;
  beforeEach(() => {
    e = crearEntorno({ archivo: true });
  });
  afterEach(() => e.cerrar());

  it('[FR-012][US3-E5] dos o más cambios sobre la misma cita a la vez: solo el primero se aplica', async () => {
    const id = e.insertarCita({
      profesional: e.profesionales.maria,
      servicio: e.servicios.sesion,
      inicio: en('2026-10-05', '10:00'),
      fin: en('2026-10-05', '10:45'),
    });
    e.reloj.fijar('2026-10-05', '11:00');
    const arranque = Date.now() + 2000;
    const estados = ['completada', 'cancelada', 'no_asistida', 'cancelada', 'completada', 'no_asistida'];
    const resultados = await Promise.all(
      estados.map(
        (estado) =>
          new Promise((resolver, rechazar) => {
            const parametros = JSON.stringify({
              ruta: e.ruta,
              operacion: 'estado',
              clinicaId: e.clinicaId,
              citaId: id,
              estado,
              ahora: e.ahora().toISOString(),
              arranque,
            });
            execFile(
              process.execPath,
              ['--disable-warning=ExperimentalWarning', TRABAJADOR, parametros],
              { timeout: 60_000 },
              (error, salida, errores) => (error ? rechazar(new Error(`${error.message}\n${errores}`)) : resolver(JSON.parse(salida))),
            );
          }),
      ),
    );
    assert.equal(resultados.filter((r) => r.ok).length, 1);
    assert.ok(resultados.filter((r) => !r.ok).every((r) => r.codigo === 'no_reservada'));
    const aplicado = resultados.find((r) => r.ok).estado;
    assert.equal(e.db.prepare('SELECT estado FROM cita WHERE id = ?').get(id).estado, aplicado);
  });
});
