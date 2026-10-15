import { formatearEuros } from '../../domain/dinero.js';
import { formatoDiaLargo } from '../../domain/tiempo.js';
import { textos } from '../textos.js';
import { esc, pagina } from './base.js';

const ANCHO = 420;
const ALTO_FILA = 32;
const PAD_ETIQUETA = 150;
const PAD_VALOR = 80;
const ANCHO_PISTA = ANCHO - PAD_ETIQUETA - PAD_VALOR;

/**
 * Gráfico de barras horizontales en SVG (research.md, D3): cada fila lleva su cifra en texto,
 * nunca solo la longitud de la barra o el color (Principio VII). `escala` fija el 100% de la
 * pista (p. ej. `1` para proporciones); sin ella, se usa el máximo de los valores de las filas.
 */
function graficoBarras(filas, { escala } = {}) {
  const valores = filas.filter((f) => f.valor !== undefined).map((f) => f.valor);
  const maxValores = valores.length ? Math.max(...valores) : 0;
  const max = escala ?? (maxValores || 1); // evita dividir por 0 cuando todos los importes son 0,00 €
  const alto = filas.length * ALTO_FILA;
  const resumen = filas.map((f) => `${f.etiqueta}: ${f.valor === undefined ? textos.analitica.sinDatos : f.texto}`).join('. ');

  const cuerpo = filas
    .map((f, i) => {
      const y = i * ALTO_FILA;
      const cy = y + ALTO_FILA / 2 + 4;
      if (f.valor === undefined) {
        return `
          <text x="0" y="${cy}" class="grafico-etiqueta">${esc(f.etiqueta)}</text>
          <text x="${PAD_ETIQUETA}" y="${cy}" class="grafico-sin-datos">${esc(textos.analitica.sinDatos)}</text>`;
      }
      const anchoBarra = Math.max(2, (f.valor / max) * ANCHO_PISTA);
      return `
        <text x="0" y="${cy}" class="grafico-etiqueta">${esc(f.etiqueta)}</text>
        <rect x="${PAD_ETIQUETA}" y="${y + 6}" width="${anchoBarra.toFixed(1)}" height="${ALTO_FILA - 12}" rx="4" class="grafico-barra"></rect>
        <text x="${PAD_ETIQUETA + ANCHO_PISTA + 10}" y="${cy}" class="grafico-valor">${esc(f.texto)}</text>`;
    })
    .join('');

  return `<svg viewBox="0 0 ${ANCHO} ${alto}" role="img" aria-label="${esc(resumen)}" class="grafico">${cuerpo}</svg>`;
}

function bloqueOcupacion(porProfesional) {
  const filas = porProfesional.map((p) => ({
    etiqueta: p.nombre,
    valor: p.ocupacion,
    texto: p.ocupacionTexto,
  }));
  return `
    <section class="bloque-analitica">
      <h2>${esc(textos.analitica.ocupacion)}</h2>
      ${graficoBarras(filas, { escala: 1 })}
    </section>`;
}

function bloqueNoAsistencia(porProfesional) {
  const filas = porProfesional.map((p) => ({
    etiqueta: p.nombre,
    valor: p.tasaNoAsistencia,
    texto: p.tasaNoAsistenciaTexto,
  }));
  return `
    <section class="bloque-analitica">
      <h2>${esc(textos.analitica.noAsistencia)}</h2>
      ${graficoBarras(filas, { escala: 1 })}
    </section>`;
}

function bloqueIngresos(porServicio) {
  const filas = porServicio.map((s) => ({ etiqueta: s.nombre, valor: s.ingresosCentimos, texto: s.ingresos }));
  const totalCentimos = porServicio.reduce((suma, s) => suma + s.ingresosCentimos, 0);
  return `
    <section class="bloque-analitica">
      <h2>${esc(textos.analitica.ingresos)}</h2>
      ${graficoBarras(filas)}
      <p class="grafico-total">${esc(textos.analitica.total)}: ${esc(formatearEuros(totalCentimos))}</p>
    </section>`;
}

const ANCHO_LINEA = 360;
const ALTO_LINEA = 80;

/** Polilínea SVG simple para una serie (research.md, D3); los valores exactos van en la tabla de al lado, no solo en el trazo. */
function polilinea(valores) {
  if (valores.length < 2) return '';
  const max = Math.max(...valores) || 1;
  const paso = ANCHO_LINEA / (valores.length - 1);
  const y = (v) => (ALTO_LINEA - (v / max) * ALTO_LINEA).toFixed(1);
  const puntos = valores.map((v, i) => `${(i * paso).toFixed(1)},${y(v)}`).join(' ');
  const marcadores = valores.map((v, i) => `<circle cx="${(i * paso).toFixed(1)}" cy="${y(v)}" r="3" class="grafico-punto"></circle>`).join('');
  return `<svg viewBox="0 0 ${ANCHO_LINEA} ${ALTO_LINEA}" class="grafico-linea" role="presentation" aria-hidden="true"><polyline points="${puntos}" class="grafico-polilinea" fill="none"></polyline>${marcadores}</svg>`;
}

function bloqueEvolucion(evolucion) {
  if (evolucion.length === 0) {
    return `
      <section class="bloque-analitica">
        <h2>${esc(textos.analitica.evolucion)}</h2>
        <p>${esc(textos.analitica.sinDatos)}</p>
      </section>`;
  }
  const filasTabla = evolucion
    .map((f) => `<tr><th scope="row">${esc(formatoDiaLargo(f.lunes))}</th><td>${esc(f.ingresos)}</td><td>${esc(f.tasaNoAsistenciaTexto)}</td></tr>`)
    .join('');
  return `
    <section class="bloque-analitica">
      <h2>${esc(textos.analitica.evolucion)}</h2>
      <h3>${esc(textos.analitica.ingresos)}</h3>
      ${polilinea(evolucion.map((f) => f.ingresosCentimos))}
      <h3>${esc(textos.analitica.noAsistencia)}</h3>
      ${polilinea(evolucion.map((f) => f.tasaNoAsistencia))}
      <table class="evolucion-tabla">
        <caption>${esc(textos.analitica.evolucionTablaTitulo)}</caption>
        <thead><tr><th scope="col">${esc(textos.analitica.semana)}</th><th scope="col">${esc(textos.analitica.ingresos)}</th><th scope="col">${esc(textos.analitica.noAsistencia)}</th></tr></thead>
        <tbody>${filasTabla}</tbody>
      </table>
    </section>`;
}

/** Página de analítica (FR-009: los cuatro bloques en una sola página). */
export function vistaAnalitica({ sesion, porProfesional, porServicio, periodo, evolucion }) {
  const textoPeriodo = textos.analitica.periodo(formatoDiaLargo(periodo.desde), formatoDiaLargo(periodo.hasta));
  return pagina({
    titulo: textos.analitica.titulo,
    sesion,
    contenido: `
      <h1>${esc(textos.analitica.titulo)}</h1>
      <p class="periodo-analizado">${esc(textoPeriodo)}</p>
      ${bloqueOcupacion(porProfesional)}
      ${bloqueNoAsistencia(porProfesional)}
      ${bloqueIngresos(porServicio)}
      ${bloqueEvolucion(evolucion)}
      <p><a href="/agenda">${esc(textos.analitica.volver)}</a></p>
    `,
  });
}
