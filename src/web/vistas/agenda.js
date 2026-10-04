import { formatoDiaLargo, formatoRango, formatoHora, hoyMadrid, sumarDias } from '../../domain/tiempo.js';
import { textos } from '../textos.js';
import { esc, pagina } from './base.js';

function insigniaEstado(estado) {
  const e = textos.estados[estado];
  return `<span class="estado estado-${esc(estado)}"><span aria-hidden="true">${e.icono}</span> ${esc(e.texto)}</span>`;
}

function acciones(cita, dia, sesion, ahora) {
  if (cita.estado !== 'reservada') return '';
  const haEmpezado = cita.inicio.getTime() <= ahora().getTime();
  const boton = (estado, deshabilitado) => `
    <form method="post" action="/citas/${cita.id}/estado" class="accion">
      <input type="hidden" name="csrf" value="${esc(sesion.csrf)}">
      <input type="hidden" name="dia" value="${esc(dia)}">
      <input type="hidden" name="estado" value="${estado}">
      <button class="boton pequeno ${estado === 'cancelada' ? 'peligro' : 'secundario'}" type="submit"${
        deshabilitado ? ` disabled title="${esc(textos.acciones.aunNoEmpieza)}"` : ''
      }>${esc(textos.acciones[estado])}</button>
    </form>`;
  const nota = haEmpezado ? '' : `<p class="nota">${esc(textos.acciones.aunNoEmpieza)}</p>`;
  return `<div class="acciones">${boton('completada', !haEmpezado)}${boton('no_asistida', !haEmpezado)}${boton('cancelada', false)}</div>${nota}`;
}

function tramoOcupado(cita, dia, sesion, ahora) {
  return `<li class="tramo ocupado estado-borde-${esc(cita.estado)}">
    <p class="horario">${esc(formatoRango(cita.inicio, cita.fin))} ${insigniaEstado(cita.estado)}</p>
    <p class="detalle"><strong>${esc(cita.paciente)}</strong></p>
    <p class="detalle">${esc(cita.servicio)} · ${esc(cita.duracionMin)} min · ${esc(cita.precio)}</p>
    ${acciones(cita, dia, sesion, ahora)}
  </li>`;
}

function tramoLibre(tramo, profesionalId, dia) {
  const hora = formatoHora(tramo.inicio);
  const enlace = `/citas/nueva?profesional=${profesionalId}&amp;dia=${esc(dia)}&amp;hora=${hora}`;
  return `<li class="tramo libre">
    <p class="horario">${esc(formatoRango(tramo.inicio, tramo.fin))} <span class="etiqueta-libre">${esc(textos.agenda.libre)}</span></p>
    <a class="boton pequeno" href="${enlace}">${esc(textos.agenda.reservar)}</a>
  </li>`;
}

function columna(prof, dia, sesion, ahora, laborable) {
  const tramos = prof.tramos
    .map((t) => (t.tipo === 'ocupado' ? tramoOcupado(t.cita, dia, sesion, ahora) : tramoLibre(t, prof.id, dia)))
    .join('');
  const historico = prof.historico.length
    ? `<details class="historico" open><summary>${esc(textos.agenda.historico)}</summary><ul>${prof.historico
        .map(
          (c) =>
            `<li>${esc(formatoRango(c.inicio, c.fin))} · ${esc(c.paciente)} · ${esc(c.servicio)} ${insigniaEstado(c.estado)}</li>`,
        )
        .join('')}</ul></details>`
    : '';
  return `<section class="profesional" aria-label="${esc(prof.nombre)}">
    <h2>${esc(prof.nombre)} <small>${esc(prof.especialidad)}</small></h2>
    ${laborable ? `<ul class="tramos">${tramos}</ul>` : ''}
    ${historico}
  </section>`;
}

export function vistaAgenda({ agenda, sesion, ahora, aviso, error }) {
  const t = textos.agenda;
  const { dia, laborable } = agenda;
  const hoy = hoyMadrid(ahora());
  const navegacion = `<nav class="navegacion-dias" aria-label="Cambiar de día">
    <a class="boton secundario" href="/agenda?dia=${sumarDias(dia, -1)}">← ${esc(t.anterior)}</a>
    <a class="boton secundario" href="/agenda?dia=${hoy}">${esc(t.hoy)}</a>
    <a class="boton secundario" href="/agenda?dia=${sumarDias(dia, 1)}">${esc(t.siguiente)} →</a>
  </nav>`;
  const cerrado = laborable ? '' : `<p class="mensaje aviso">${esc(t.cerrado)}</p>`;
  return pagina({
    titulo: `${t.titulo} · ${formatoDiaLargo(dia)}`,
    sesion,
    aviso,
    error,
    contenido: `
    <div class="encabezado-agenda">
      <h1>${esc(t.titulo)}<small>${esc(formatoDiaLargo(dia))}</small></h1>
      <a class="boton" href="/citas/nueva?dia=${esc(dia)}">${esc(t.nuevaCita)}</a>
    </div>
    ${navegacion}
    ${cerrado}
    <div class="columnas">
      ${agenda.profesionales.map((p) => columna(p, dia, sesion, ahora, laborable)).join('')}
    </div>`,
  });
}

export function vistaDiaInvalido({ sesion, ahora }) {
  return pagina({
    titulo: textos.agenda.titulo,
    sesion,
    error: textos.agenda.diaInvalido,
    contenido: `<p><a class="boton" href="/agenda?dia=${hoyMadrid(ahora())}">${esc(textos.agenda.hoy)}</a></p>`,
  });
}
