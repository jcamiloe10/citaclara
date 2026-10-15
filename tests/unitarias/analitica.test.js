import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { abrirBase } from '../../src/db/connection.js';
import { formatearEuros } from '../../src/domain/dinero.js';
import { evolucionSemanal, ingresosPorServicio, ocupacionYNoAsistenciaPorProfesional, ventanaDeOchoSemanas } from '../../src/domain/analitica.js';
import { cargarSemilla } from '../../src/seed/seed.js';
import { crearEntorno, en } from '../ayudas/fixture.js';

describe('Ventana de 8 semanas', () => {
  it('[004-FR-007] son las 8 semanas laborales completas anteriores a la semana en curso', () => {
    // Lunes 2026-09-28 es el lunes de la semana en curso en el ancla de pruebas de 001.
    const ahora = () => en('2026-10-02', '08:00'); // viernes de esa misma semana en curso
    const ventana = ventanaDeOchoSemanas(ahora);
    assert.equal(ventana.inicio, '2026-08-03');
    assert.equal(ventana.fin, '2026-09-28');
    assert.equal(ventana.semanas, 8);
    assert.equal(ventana.minutosDisponiblesPorSemana, 3300);
  });
});

describe('Cifras sobre los datos de demostración (ancla de pruebas 2026-09-28)', () => {
  const ANCLA = '2026-09-28';
  const ahora = () => en('2026-09-30', '10:00'); // miércoles de la semana en curso en la ancla

  function cargar() {
    const db = abrirBase();
    const { clinicaId } = cargarSemilla(db, { ancla: ANCLA });
    return { db, clinicaId };
  }

  it('[004-FR-004] ocupación semanal por profesional (completada + no asistida ÷ 8 × 3.300 min)', () => {
    const { db, clinicaId } = cargar();
    const porProfesional = ocupacionYNoAsistenciaPorProfesional(db, clinicaId, ahora);
    const porNombre = Object.fromEntries(porProfesional.map((p) => [p.nombre, p]));
    assert.equal((porNombre.María.ocupacion * 100).toFixed(1), '43.0');
    assert.equal((porNombre.Jorge.ocupacion * 100).toFixed(1), '40.8');
    assert.equal((porNombre.Lucía.ocupacion * 100).toFixed(1), '34.6');
  });

  it('[004-FR-005] tasa de no asistencia por profesional (no asistidas ÷ todas las citas del periodo)', () => {
    const { db, clinicaId } = cargar();
    const porProfesional = ocupacionYNoAsistenciaPorProfesional(db, clinicaId, ahora);
    const porNombre = Object.fromEntries(porProfesional.map((p) => [p.nombre, p]));
    assert.equal((porNombre.María.tasaNoAsistencia * 100).toFixed(1), '10.2');
    assert.equal((porNombre.Jorge.tasaNoAsistencia * 100).toFixed(1), '7.3');
    assert.equal((porNombre.Lucía.tasaNoAsistencia * 100).toFixed(1), '11.9');
  });

  it('[004-FR-006] ingresos por servicio (solo citas completadas, céntimo exacto)', () => {
    const { db, clinicaId } = cargar();
    const porServicio = ingresosPorServicio(db, clinicaId, ahora);
    const porNombre = Object.fromEntries(porServicio.map((s) => [s.nombre, s]));
    assert.equal(porNombre['Sesión de fisioterapia'].ingresosCentimos, 1_412_000);
    assert.equal(porNombre['Primera visita de fisioterapia'].ingresosCentimos, 340_000);
    assert.equal(porNombre['Consulta de nutrición'].ingresosCentimos, 556_500);
    assert.equal(porNombre['Primera consulta de nutrición'].ingresosCentimos, 319_500);
    const total = porServicio.reduce((suma, s) => suma + s.ingresosCentimos, 0);
    assert.equal(total, 2_628_000);
  });

  it('[004-FR-007][004-US2-E1] evolución semanal: 8 filas ordenadas de la más antigua a la más reciente', () => {
    const { db, clinicaId } = cargar();
    const evolucion = evolucionSemanal(db, clinicaId, ahora);
    assert.equal(evolucion.length, 8);
    assert.equal(evolucion[0].lunes, '2026-08-03');
    assert.equal(evolucion.at(-1).lunes, '2026-09-21');
    for (let i = 1; i < evolucion.length; i++) assert.ok(evolucion[i].lunes > evolucion[i - 1].lunes);
  });

  it('[004-US2-E2] la fila de la semana del 2026-08-24 tiene los ingresos y la tasa de no asistencia exactos', () => {
    const { db, clinicaId } = cargar();
    const evolucion = evolucionSemanal(db, clinicaId, ahora);
    const semana = evolucion.find((f) => f.lunes === '2026-08-24');
    assert.equal(semana.ingresosCentimos, 287_500);
    assert.equal((semana.tasaNoAsistencia * 100).toFixed(1), '16.5');
  });
});

describe('[004-FR-006] importes de miles de euros con separador de millares', () => {
  const sinNbsp = (t) => t.replace(/ /g, ' ');

  it('formatearEuros agrupa los millares también entre 1.000 y 9.999 (Intl.NumberFormat de Node no lo hace por defecto)', () => {
    // 001-agenda-core nunca mostró un importe de 4 cifras (su mayor precio es 50,00 €), así que
    // no detectó que el `useGrouping` por defecto de Node deja "3400,00 €" sin punto; los
    // ingresos agregados de esta spec sí llegan a esas cifras y necesitan el separador.
    assert.equal(sinNbsp(formatearEuros(340_000)), '3.400,00 €');
    assert.equal(sinNbsp(formatearEuros(556_500)), '5.565,00 €');
    assert.equal(sinNbsp(formatearEuros(319_500)), '3.195,00 €');
    assert.equal(sinNbsp(formatearEuros(1_412_000)), '14.120,00 €');
    assert.equal(sinNbsp(formatearEuros(2_628_000)), '26.280,00 €');
  });
});

describe('[004-US2-E3] evolución con menos de 8 semanas de historia', () => {
  it('una clínica con historia reciente solo muestra las semanas que realmente tienen citas', () => {
    const { db, clinicaId, profesionales, servicios, insertarCita } = crearEntorno();
    insertarCita({
      profesional: profesionales.maria,
      servicio: servicios.sesion,
      inicio: en('2026-08-24', '10:00'),
      fin: en('2026-08-24', '10:45'),
      estado: 'completada',
    });
    const evolucion = evolucionSemanal(db, clinicaId, () => en('2026-10-02', '08:00'));
    assert.equal(evolucion.length, 1);
    assert.equal(evolucion[0].lunes, '2026-08-24');
  });
});

describe('[004-FR-008] ausencia de datos en el periodo', () => {
  it('un profesional sin ninguna cita en el periodo no tiene ocupación ni tasa de no asistencia (undefined, no 0 ni NaN)', () => {
    const { db, clinicaId, profesionales } = crearEntorno();
    const porProfesional = ocupacionYNoAsistenciaPorProfesional(db, clinicaId, () => en('2026-10-02', '08:00'));
    assert.equal(porProfesional.length, 3);
    for (const p of porProfesional) {
      assert.equal(p.ocupacion, undefined);
      assert.equal(p.tasaNoAsistencia, undefined);
    }
    assert.ok(profesionales.maria); // el entorno sí tiene profesionales, solo ninguna cita en el periodo
  });

  it('un servicio sin ninguna cita completada en el periodo muestra 0,00 €, no un error', () => {
    const { db, clinicaId } = crearEntorno();
    const porServicio = ingresosPorServicio(db, clinicaId, () => en('2026-10-02', '08:00'));
    assert.equal(porServicio.length, 4);
    for (const s of porServicio) assert.equal(s.ingresosCentimos, 0);
  });
});
