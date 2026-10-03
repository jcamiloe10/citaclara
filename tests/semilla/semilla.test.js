import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBase } from '../../src/db/connection.js';
import { identificarPorClave } from '../../src/domain/clinicas.js';
import { normalizarTelefono } from '../../src/domain/pacientes.js';
import { aInstanteUTC, dentroDeHorario } from '../../src/domain/tiempo.js';
import { cargarSemilla } from '../../src/seed/seed.js';
import { haySolapes } from '../ayudas/fixture.js';

// Ancla y reloj fijos de las pruebas: lunes 28 de septiembre de 2026; "ahora" = miércoles 30, 10:00.
const ANCLA = '2026-09-28';
const AHORA = aInstanteUTC('2026-09-30', '10:00');

// Recuentos exactos con la ancla y la semilla por defecto (Principio V). Se publican en el quickstart.
const ESPERADO = {
  pacientes: 40,
  citas: 996,
  historia: { total: 793, completada: 651, no_asistida: 79, cancelada: 63 },
  futuro: 203,
};

function cargar() {
  const db = abrirBase();
  const resumen = cargarSemilla(db, { ancla: ANCLA });
  return { db, resumen };
}

/** Contenido de la clínica sin identificadores internos, para comparar cargas. */
function volcado(db) {
  const filas = (sql) => db.prepare(sql).all().map((f) => JSON.stringify(f));
  return {
    clinica: filas('SELECT nombre FROM clinica'),
    profesionales: filas('SELECT nombre, especialidad FROM profesional ORDER BY id'),
    servicios: filas('SELECT nombre, duracion_min, precio_centimos FROM servicio ORDER BY id'),
    pacientes: filas('SELECT nombre, telefono, email FROM paciente ORDER BY id'),
    citas: filas(
      `SELECT pr.nombre AS profesional, s.nombre AS servicio, pa.nombre AS paciente, c.inicio, c.fin, c.estado
       FROM cita c JOIN profesional pr ON pr.id = c.profesional_id JOIN servicio s ON s.id = c.servicio_id
       JOIN paciente pa ON pa.id = c.paciente_id ORDER BY c.inicio, pr.id`,
    ),
  };
}

const lunesSiguiente = aInstanteUTC('2026-10-05', '00:00');
const inicioHistoria = aInstanteUTC('2026-08-03', '00:00');

describe('Datos de demostración', () => {
  it('[US4-E1][FR-030][FR-031][FR-005] crea Clínica Eleva con sus profesionales, servicios y 40 pacientes', () => {
    const { db } = cargar();
    assert.deepEqual(db.prepare('SELECT nombre FROM clinica').all().map((c) => c.nombre), ['Clínica Eleva']);
    assert.deepEqual(
      db.prepare('SELECT nombre, especialidad FROM profesional ORDER BY id').all().map((p) => [p.nombre, p.especialidad]),
      [['María', 'Fisioterapia'], ['Jorge', 'Fisioterapia'], ['Lucía', 'Nutrición']],
    );
    assert.deepEqual(
      db.prepare('SELECT nombre, duracion_min, precio_centimos FROM servicio ORDER BY id').all().map((s) => [s.nombre, s.duracion_min, s.precio_centimos]),
      [
        ['Sesión de fisioterapia', 45, 4000],
        ['Primera visita de fisioterapia', 60, 5000],
        ['Consulta de nutrición', 30, 3500],
        ['Primera consulta de nutrición', 45, 4500],
      ],
    );
    const pacientes = db.prepare('SELECT nombre, telefono, email FROM paciente').all();
    assert.equal(pacientes.length, 40);
    assert.equal(new Set(pacientes.map((p) => p.nombre)).size, 40);
    for (const p of pacientes) {
      assert.ok(p.nombre.trim().length > 0);
      assert.equal(normalizarTelefono(p.telefono), p.telefono, p.telefono);
      assert.match(p.email, /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/);
    }
    assert.equal(identificarPorClave(db, 'eleva-demo')?.nombre, 'Clínica Eleva');
  });

  it('[US4-E2][FR-032][SC-005] 8 semanas de historia con exactamente el 10 % de no asistidas y el 8 % de canceladas', () => {
    const { db, resumen } = cargar();
    assert.deepEqual(resumen.historia, ESPERADO.historia);
    const porEstado = Object.fromEntries(
      db
        .prepare('SELECT estado, COUNT(*) AS n FROM cita WHERE inicio < ? GROUP BY estado')
        .all(lunesSiguiente.toISOString())
        .map((f) => [f.estado, f.n]),
    );
    assert.deepEqual(porEstado, {
      completada: ESPERADO.historia.completada,
      no_asistida: ESPERADO.historia.no_asistida,
      cancelada: ESPERADO.historia.cancelada,
    });
    const total = ESPERADO.historia.total;
    assert.ok(Math.abs((porEstado.no_asistida / total) * 100 - 10) <= 2);
    assert.ok(Math.abs((porEstado.cancelada / total) * 100 - 8) <= 2);
    // 8 semanas laborables completas: de lunes 3 de agosto a viernes 25 de septiembre.
    const { primera, ultima } = db.prepare('SELECT MIN(inicio) AS primera, MAX(inicio) AS ultima FROM cita WHERE inicio < ?').get(lunesSiguiente.toISOString());
    assert.ok(primera >= inicioHistoria.toISOString());
    assert.ok(ultima < aInstanteUTC('2026-09-28', '00:00').toISOString());
  });

  it('[US4-E3][FR-032] 2 semanas futuras solo con reservadas, de los tres profesionales y posteriores a la carga', () => {
    const { db, resumen } = cargar();
    assert.equal(resumen.futuro.total, ESPERADO.futuro);
    const futuras = db.prepare('SELECT * FROM cita WHERE inicio >= ?').all(lunesSiguiente.toISOString());
    assert.equal(futuras.length, ESPERADO.futuro);
    assert.ok(futuras.every((c) => c.estado === 'reservada'));
    assert.equal(new Set(futuras.map((c) => c.profesional_id)).size, 3);
    assert.ok(futuras.every((c) => new Date(c.inicio) > AHORA));
    const dias = new Set(futuras.map((c) => c.inicio.slice(0, 10)));
    assert.ok(dias.size >= 10 && dias.size <= 12); // 10 días laborables (el UTC puede partir alguno)
    assert.ok(futuras.every((c) => new Date(c.inicio) < aInstanteUTC('2026-10-19', '00:00')));
    assert.equal(resumen.citas, ESPERADO.citas);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM cita').get().n, ESPERADO.citas);
  });

  it('[FR-033][RN1][RN3] sin solapes, todas las citas dentro del horario y ninguna reservada en el pasado', () => {
    const { db } = cargar();
    assert.equal(haySolapes(db), false);
    // Aunque no haya solapes entre activas, tampoco entre ninguna combinación de citas del mismo profesional.
    const todos = db
      .prepare(
        `SELECT COUNT(*) AS n FROM cita a JOIN cita b ON a.profesional_id = b.profesional_id AND a.id < b.id
         AND a.inicio < b.fin AND b.inicio < a.fin`,
      )
      .get().n;
    assert.equal(todos, 0);
    for (const c of db.prepare('SELECT inicio, fin, estado FROM cita').all()) {
      assert.ok(dentroDeHorario(new Date(c.inicio), new Date(c.fin)), `${c.inicio}–${c.fin}`);
      if (c.estado === 'reservada') assert.ok(new Date(c.inicio) > AHORA, 'reservada en el pasado');
      assert.ok(new Date(c.inicio).getUTCMinutes() % 15 === 0); // RN4
    }
  });

  it('[FR-033][FR-012] los estados son coherentes: en la historia no hay reservadas y en el futuro solo reservadas', () => {
    const { db } = cargar();
    const pasadas = db.prepare("SELECT COUNT(*) AS n FROM cita WHERE inicio < ? AND estado = 'reservada'").get(lunesSiguiente.toISOString()).n;
    const futuras = db.prepare("SELECT COUNT(*) AS n FROM cita WHERE inicio >= ? AND estado <> 'reservada'").get(lunesSiguiente.toISOString()).n;
    assert.equal(pasadas, 0);
    assert.equal(futuras, 0);
  });

  it('[US4-E4][FR-034] dos cargas independientes producen exactamente el mismo contenido', () => {
    const a = cargar();
    const b = cargar();
    assert.deepEqual(volcado(a.db), volcado(b.db));
    assert.deepEqual(a.resumen, b.resumen);
  });

  it('[US4-E5][FR-034] cargar dos veces sobre la misma base deja el mismo resultado, sin duplicados', () => {
    const { db } = cargar();
    const primera = volcado(db);
    cargarSemilla(db, { ancla: ANCLA });
    assert.deepEqual(volcado(db), primera);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM clinica').get().n, 1);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM paciente').get().n, 40);
    assert.equal(db.prepare('SELECT COUNT(*) AS n FROM cita').get().n, ESPERADO.citas);
  });

  it('[FR-034] otra ancla desplaza las fechas pero conserva los recuentos', () => {
    const db = abrirBase();
    const r = cargarSemilla(db, { ancla: '2027-01-04' });
    assert.deepEqual(r.historia, ESPERADO.historia);
    assert.equal(r.futuro.total, ESPERADO.futuro);
  });
});
