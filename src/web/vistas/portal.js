import { formatoFechaHora } from '../../domain/tiempo.js';
import { formatearTelefono } from '../../domain/pacientes.js';
import { textos } from '../textos.js';
import { esc } from './base.js';

const t = textos.portal;

const primerNombre = (nombre) => String(nombre).trim().split(/\s+/)[0];

const telefonoVisible = (clinica) => (clinica?.telefono ? formatearTelefono(clinica.telefono) : null);

/** Plantilla del portal: sin sesión, sin enlaces a recepción, no indexable (FR-005). */
export function paginaPortal({ titulo, contenido, clinica, aviso, error }) {
  const nombre = clinica?.nombre ?? textos.marca;
  const telefono = telefonoVisible(clinica);
  const mensajes = [
    aviso ? `<p class="mensaje aviso" role="status">${esc(aviso)}</p>` : '',
    error ? `<p class="mensaje error" role="alert">${esc(error)}</p>` : '',
  ].join('');
  const pie = clinica
    ? `<p>${esc(nombre)}${telefono ? ` · <a href="tel:${esc(clinica.telefono)}">${esc(telefono)}</a>` : ''}</p>`
    : '';
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex, nofollow">
  <title>${esc(titulo)} · ${esc(nombre)}</title>
  <link rel="stylesheet" href="/estilos.css">
</head>
<body class="portal">
  <header class="cabecera"><span class="marca">${esc(nombre)}</span></header>
  <main class="contenido portal-contenido">
    ${mensajes}
    ${contenido}
  </main>
  <footer class="pie portal-pie">${pie}<p>${esc(textos.zonaHoraria)}</p></footer>
</body>
</html>`;
}

function insignia(cita) {
  const e = cita.estado === 'cancelada' && cita.canceladaPorPaciente
    ? textos.estados.cancelada_paciente
    : textos.estados[cita.estado];
  return `<span class="estado estado-${esc(cita.estado)}"><span aria-hidden="true">${e.icono}</span> ${esc(e.texto)}</span>`;
}

const contactar = (clinica) => {
  const tel = telefonoVisible(clinica);
  return tel
    ? `${esc(t.llamaA(clinica.nombre, ''))}: <a href="tel:${esc(clinica.telefono)}">${esc(tel)}</a>`
    : esc(t.llamaALaClinica);
};

function tarjeta(cita, { secreto, clinica, conAcciones }) {
  let accion = '';
  if (conAcciones) {
    accion = cita.sePuedeCancelar
      ? `<p class="acciones"><a class="boton peligro" href="/p/${esc(secreto)}/citas/${cita.id}/cancelar">${esc(t.cancelarCita)}</a></p>`
      : `<p class="nota">${esc(t.fueraDePlazo)} ${contactar(clinica)}</p>`;
  }
  return `<li class="tarjeta cita-portal estado-borde-${esc(cita.estado)}">
    <p class="cita-cuando">${esc(formatoFechaHora(cita.inicio))}</p>
    <p class="cita-detalle">${esc(cita.profesional)} · ${esc(cita.servicio)}</p>
    <p>${insignia(cita)}</p>
    ${accion}
  </li>`;
}

/** Página personal (FR-006 a FR-010). */
export function vistaPaginaPortal({ paciente, clinica, citas, secreto, aviso, limite }) {
  const proximas = citas.proximas.length
    ? `<ul class="lista-citas">${citas.proximas.map((c) => tarjeta(c, { secreto, clinica, conAcciones: true })).join('')}</ul>`
    : `<p class="nota">${esc(t.sinCitas)}. ${contactar(clinica)}</p>`;
  const historial = citas.historial.length
    ? `<section aria-labelledby="titulo-historial">
        <h2 id="titulo-historial">${esc(t.historial)}</h2>
        <ul class="lista-citas">${citas.historial.map((c) => tarjeta(c, { secreto, clinica, conAcciones: false })).join('')}</ul>
        ${citas.hayMas ? `<p><a class="boton secundario" href="/p/${esc(secreto)}?h=${limite + 10}">${esc(t.verMas)}</a></p>` : ''}
      </section>`
    : '';
  return paginaPortal({
    titulo: t.proximas,
    clinica,
    aviso,
    contenido: `
    <h1>${esc(t.saludo(primerNombre(paciente.nombre)))}</h1>
    <section aria-labelledby="titulo-proximas">
      <h2 id="titulo-proximas">${esc(t.proximas)}</h2>
      ${proximas}
    </section>
    ${historial}`,
  });
}

/** Confirmación en un segundo paso (FR-012). Nunca cancela por sí sola. */
export function vistaConfirmarCancelacion({ cita, secreto, clinica }) {
  return paginaPortal({
    titulo: t.confirmarTitulo,
    clinica,
    contenido: `
    <section class="tarjeta">
      <h1>${esc(t.confirmarTitulo)}</h1>
      <p class="cita-cuando">${esc(formatoFechaHora(cita.inicio))}</p>
      <p class="cita-detalle">${esc(cita.profesional)} · ${esc(cita.servicio)}</p>
      <form method="post" action="/p/${esc(secreto)}/citas/${cita.id}/cancelar" class="acciones-formulario">
        <button class="boton peligro" type="submit">${esc(t.siCancelar)}</button>
        <a class="boton secundario" href="/p/${esc(secreto)}">${esc(t.noVolver)}</a>
      </form>
    </section>`,
  });
}

/** Misma respuesta para formato incorrecto, desconocido, renovado u otra clínica (FR-003). */
export function vistaEnlaceNoValido() {
  return paginaPortal({
    titulo: t.enlaceNoValido,
    clinica: null,
    contenido: `
    <section class="tarjeta">
      <h1>${esc(t.enlaceNoValido)}</h1>
      <p>${esc(t.enlaceNoValidoAyuda)}</p>
    </section>`,
  });
}

/** Errores dentro de /p/…: sin enlaces a recepción ni a la agenda. */
export function vistaErrorPortal({ titulo, clinica = null }) {
  return paginaPortal({
    titulo,
    clinica,
    contenido: `
    <section class="tarjeta">
      <h1>${esc(titulo)}</h1>
      <p>${esc(t.llamaALaClinica)}.</p>
    </section>`,
  });
}

export const AVISOS_PORTAL = {
  'ya-cancelada': t.avisos.yaCancelada,
  'fuera-de-plazo': t.avisos.fueraDePlazo,
  'no-disponible': t.avisos.noDisponible,
};

export const textoCancelada = (inicio) => t.avisos.cancelada(formatoFechaHora(inicio));
