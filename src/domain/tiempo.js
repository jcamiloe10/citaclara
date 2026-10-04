// Todo el cálculo con fechas pasa por aquí. Los instantes son UTC; las reglas y la
// presentación usan Europe/Madrid (Principio II).
const ZONA = 'Europe/Madrid';
const APERTURA_MIN = 9 * 60;
const CIERRE_MIN = 20 * 60;

const formatoPartes = new Intl.DateTimeFormat('en-US', {
  timeZone: ZONA,
  hourCycle: 'h23',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  weekday: 'short',
});

const DIAS_SEMANA = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };
const NOMBRES_DIA = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const NOMBRES_MES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

export const ahoraReal = () => new Date();

const dos = (n) => String(n).padStart(2, '0');

/** Partes locales (hora de España) de un instante. diaSemana: 1 = lunes … 7 = domingo. */
export function aLocal(instante) {
  const partes = Object.fromEntries(
    formatoPartes.formatToParts(instante).map((p) => [p.type, p.value]),
  );
  return {
    anio: Number(partes.year),
    mes: Number(partes.month),
    dia: Number(partes.day),
    hora: Number(partes.hour),
    minuto: Number(partes.minute),
    segundo: Number(partes.second),
    diaSemana: DIAS_SEMANA[partes.weekday],
  };
}

function desfaseMadridMs(instanteMs) {
  const l = aLocal(new Date(instanteMs));
  const comoUTC = Date.UTC(l.anio, l.mes - 1, l.dia, l.hora, l.minuto, l.segundo);
  return comoUTC - Math.floor(instanteMs / 1000) * 1000;
}

const RE_DIA = /^(\d{4})-(\d{2})-(\d{2})$/;
const RE_HORA = /^(\d{2}):(\d{2})$/;

export function esDiaValido(dia) {
  const m = RE_DIA.exec(dia ?? '');
  if (!m) return false;
  const [a, me, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const f = new Date(Date.UTC(a, me - 1, d));
  return f.getUTCFullYear() === a && f.getUTCMonth() === me - 1 && f.getUTCDate() === d;
}

/** 'AAAA-MM-DD' + 'HH:MM' (hora de Madrid) → instante UTC, o null si el formato no es válido. */
export function aInstanteUTC(dia, hora) {
  const h = RE_HORA.exec(hora ?? '');
  if (!esDiaValido(dia) || !h) return null;
  const [a, me, d] = dia.split('-').map(Number);
  const hh = Number(h[1]);
  const mm = Number(h[2]);
  if (hh > 23 || mm > 59) return null;
  const nominal = Date.UTC(a, me - 1, d, hh, mm);
  let candidato = nominal - desfaseMadridMs(nominal);
  candidato = nominal - desfaseMadridMs(candidato);
  return new Date(candidato);
}

export function hoyMadrid(ahora) {
  const l = aLocal(ahora);
  return `${l.anio}-${dos(l.mes)}-${dos(l.dia)}`;
}

export function sumarDias(dia, n) {
  const [a, m, d] = dia.split('-').map(Number);
  const f = new Date(Date.UTC(a, m - 1, d + n));
  return `${f.getUTCFullYear()}-${dos(f.getUTCMonth() + 1)}-${dos(f.getUTCDate())}`;
}

export function diaSemanaDe(dia) {
  const [a, m, d] = dia.split('-').map(Number);
  const js = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return js === 0 ? 7 : js;
}

export function esDiaLaborable(dia) {
  return diaSemanaDe(dia) <= 5;
}

export function lunesDeLaSemana(dia) {
  return sumarDias(dia, -(diaSemanaDe(dia) - 1));
}

export function inicioDelDia(dia) {
  return aInstanteUTC(dia, '00:00');
}

export function finDelDia(dia) {
  return aInstanteUTC(sumarDias(dia, 1), '00:00');
}

export function aperturaDelDia(dia) {
  return aInstanteUTC(dia, `${dos(APERTURA_MIN / 60)}:00`);
}

export function cierreDelDia(dia) {
  return aInstanteUTC(dia, `${dos(CIERRE_MIN / 60)}:00`);
}

/** RN3: de lunes a viernes, empezar desde las 09:00 y terminar como muy tarde a las 20:00 (hora de España). */
export function dentroDeHorario(inicio, fin) {
  const li = aLocal(inicio);
  const lf = aLocal(fin);
  const mismoDia = li.anio === lf.anio && li.mes === lf.mes && li.dia === lf.dia;
  if (!mismoDia || li.diaSemana > 5) return false;
  const minInicio = li.hora * 60 + li.minuto;
  const minFin = lf.hora * 60 + lf.minuto;
  return minInicio >= APERTURA_MIN && minFin <= CIERRE_MIN;
}

/** RN4: el inicio cae en múltiplo de 15 minutos de la hora de España. */
export function esMultiploDe15(inicio) {
  const l = aLocal(inicio);
  return l.minuto % 15 === 0 && l.segundo === 0 && inicio.getUTCMilliseconds() === 0;
}

export const iso = (fecha) => fecha.toISOString();

// ---- Presentación (es-ES, sin ambigüedad: FR-028) ----

export function formatoDiaLargo(dia) {
  const [a, m, d] = dia.split('-').map(Number);
  return `${NOMBRES_DIA[diaSemanaDe(dia) - 1]} ${d} de ${NOMBRES_MES[m - 1]} de ${a}`;
}

export function formatoHora(instante) {
  const l = aLocal(instante);
  return `${dos(l.hora)}:${dos(l.minuto)}`;
}

export function formatoRango(inicio, fin) {
  return `${formatoHora(inicio)}–${formatoHora(fin)}`;
}

export function diaDe(instante) {
  return hoyMadrid(instante);
}

export function formatoFechaHora(instante) {
  return `${formatoDiaLargo(diaDe(instante))}, ${formatoHora(instante)}`;
}

/** Horas de inicio ofrecidas en el alta: 09:00, 09:15 … 19:45 (RN4). */
export function horasDeInicio() {
  const horas = [];
  for (let m = APERTURA_MIN; m < CIERRE_MIN; m += 15) horas.push(`${dos(Math.floor(m / 60))}:${dos(m % 60)}`);
  return horas;
}
