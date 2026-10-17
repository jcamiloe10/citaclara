// Cálculo de las cifras del panel de analítica (004-citaclara-analitica). Solo lectura: ninguna
// función de este módulo escribe en la base (FR-003); todas reciben `db` de solo lectura.
import { formatearEuros } from './dinero.js';
import { hoyMadrid, inicioDelDia, iso, lunesDeLaSemana, sumarDias } from './tiempo.js';

const SEMANAS_ANALIZADAS = 8;
const MINUTOS_DISPONIBLES_POR_SEMANA = 5 * (20 * 60 - 9 * 60); // RN3 de 001: 09:00-20:00, L-V, sin pausa

/**
 * Las últimas `SEMANAS_ANALIZADAS` semanas laborales completas anteriores a la semana en
 * curso (misma convención que la historia de los datos de demostración de 001-agenda-core).
 * `inicio` incluido, `fin` excluido.
 */
export function ventanaDeOchoSemanas(ahora) {
  const fin = lunesDeLaSemana(hoyMadrid(ahora()));
  const inicio = sumarDias(fin, -7 * SEMANAS_ANALIZADAS);
  return { inicio, fin, semanas: SEMANAS_ANALIZADAS, minutosDisponiblesPorSemana: MINUTOS_DISPONIBLES_POR_SEMANA };
}

/** Límites del periodo como instantes UTC (texto ISO), listos para comparar con `cita.inicio`. */
function limitesVentana(ahora) {
  const ventana = ventanaDeOchoSemanas(ahora);
  return { ...ventana, desde: iso(inicioDelDia(ventana.inicio)), hasta: iso(inicioDelDia(ventana.fin)) };
}

const minutos = (inicio, fin) => (new Date(fin) - new Date(inicio)) / 60_000;

const FORMATO_PORCENTAJE = new Intl.NumberFormat('es-ES', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });

/** "43,0 %"; `undefined` si la fracción es `undefined` (FR-008: sin datos, no "0,0 %"). */
export function formatoPorcentaje(fraccion) {
  return fraccion === undefined ? undefined : FORMATO_PORCENTAJE.format(fraccion);
}

/** Primer y último día (ambos en 'AAAA-MM-DD', España) que cubre el periodo analizado, para mostrarlo en texto. */
export function periodoAnalizado(ahora) {
  const ventana = ventanaDeOchoSemanas(ahora);
  return { desde: ventana.inicio, hasta: sumarDias(ventana.fin, -3) };
}

/**
 * Ocupación semanal y tasa de no asistencia de cada profesional de la clínica en el periodo
 * (FR-004, FR-005). `undefined` en ambas cifras si el profesional no tiene ninguna cita cerrada
 * (completada, no asistida o cancelada) en el periodo (FR-008).
 */
export function ocupacionYNoAsistenciaPorProfesional(db, clinicaId, ahora) {
  const { desde, hasta, semanas, minutosDisponiblesPorSemana } = limitesVentana(ahora);
  const minutosDisponibles = semanas * minutosDisponiblesPorSemana;
  const profesionales = db
    .prepare('SELECT id, nombre, especialidad FROM profesional WHERE clinica_id = ? ORDER BY id')
    .all(clinicaId);

  return profesionales.map((prof) => {
    const citas = db
      .prepare(
        `SELECT estado, inicio, fin FROM cita
         WHERE clinica_id = ? AND profesional_id = ? AND inicio >= ? AND inicio < ?
           AND estado IN ('completada', 'no_asistida', 'cancelada')`,
      )
      .all(clinicaId, prof.id, desde, hasta);

    if (citas.length === 0) {
      return { ...prof, ocupacion: undefined, ocupacionTexto: undefined, tasaNoAsistencia: undefined, tasaNoAsistenciaTexto: undefined };
    }

    let minutosOcupados = 0;
    let noAsistidas = 0;
    for (const c of citas) {
      if (c.estado === 'completada' || c.estado === 'no_asistida') minutosOcupados += minutos(c.inicio, c.fin);
      if (c.estado === 'no_asistida') noAsistidas += 1;
    }
    const ocupacion = minutosOcupados / minutosDisponibles;
    const tasaNoAsistencia = noAsistidas / citas.length;
    return {
      ...prof,
      ocupacion,
      ocupacionTexto: formatoPorcentaje(ocupacion),
      tasaNoAsistencia,
      tasaNoAsistenciaTexto: formatoPorcentaje(tasaNoAsistencia),
    };
  });
}

/**
 * Ingresos de la clínica por servicio en el periodo, solo citas "completada" (FR-006).
 * `ingresosCentimos` es `0` (no `undefined`) cuando el servicio no tuvo ninguna completada: a
 * diferencia de FR-004/005, un importe en cero no es ambiguo (FR-008 solo aplica a proporciones).
 */
export function ingresosPorServicio(db, clinicaId, ahora) {
  const { desde, hasta } = limitesVentana(ahora);
  const servicios = db
    .prepare('SELECT id, nombre, precio_centimos AS precioCentimos FROM servicio WHERE clinica_id = ? ORDER BY id')
    .all(clinicaId);

  return servicios.map((servicio) => {
    const { citasCompletadas } = db
      .prepare(
        `SELECT COUNT(*) AS citasCompletadas FROM cita
         WHERE clinica_id = ? AND servicio_id = ? AND estado = 'completada' AND inicio >= ? AND inicio < ?`,
      )
      .get(clinicaId, servicio.id, desde, hasta);
    const ingresosCentimos = citasCompletadas * servicio.precioCentimos;
    return { ...servicio, citasCompletadas, ingresosCentimos, ingresos: formatearEuros(ingresosCentimos) };
  });
}

/**
 * Evolución semanal de toda la clínica (FR-007): ingresos de citas completadas y tasa de no
 * asistencia, una fila por cada semana laboral completa del periodo que tenga alguna cita
 * cerrada; las semanas sin ninguna (clínica más joven que el periodo) no se incluyen (FR-008,
 * US2-E3), para no inventar filas vacías. Orden: de la semana más antigua a la más reciente.
 */
export function evolucionSemanal(db, clinicaId, ahora) {
  const ventana = ventanaDeOchoSemanas(ahora);
  const filas = [];
  for (let semana = 0; semana < ventana.semanas; semana++) {
    const lunes = sumarDias(ventana.inicio, 7 * semana);
    const desde = iso(inicioDelDia(lunes));
    const hasta = iso(inicioDelDia(sumarDias(lunes, 7)));
    const citas = db
      .prepare(
        `SELECT c.estado, c.servicio_id AS servicioId, s.precio_centimos AS precioCentimos
         FROM cita c JOIN servicio s ON s.id = c.servicio_id
         WHERE c.clinica_id = ? AND c.inicio >= ? AND c.inicio < ?
           AND c.estado IN ('completada', 'no_asistida', 'cancelada')`,
      )
      .all(clinicaId, desde, hasta);
    if (citas.length === 0) continue;

    let ingresosCentimos = 0;
    let noAsistidas = 0;
    for (const c of citas) {
      if (c.estado === 'completada') ingresosCentimos += c.precioCentimos;
      if (c.estado === 'no_asistida') noAsistidas += 1;
    }
    const tasaNoAsistencia = noAsistidas / citas.length;
    filas.push({
      lunes,
      ingresosCentimos,
      ingresos: formatearEuros(ingresosCentimos),
      tasaNoAsistencia,
      tasaNoAsistenciaTexto: formatoPorcentaje(tasaNoAsistencia),
    });
  }
  return filas;
}
