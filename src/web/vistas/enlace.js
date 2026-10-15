import { formatearTelefono } from '../../domain/pacientes.js';
import { formatoFechaHora } from '../../domain/tiempo.js';
import { textos } from '../textos.js';
import { esc } from './base.js';
import { paginaPortal } from './portal.js';

// Páginas públicas del enlace de cancelación del recordatorio (003). Reutilizan la plantilla del
// portal de la 002: sin sesión, sin enlaces a recepción y no indexables.
const t = textos.enlace;

function llamaALaClinica(clinica) {
  const base = esc(t.llamaA(clinica.nombre));
  if (!clinica.telefono) return `${base}.`;
  return `${base}: <a href="tel:${esc(clinica.telefono)}">${esc(formatearTelefono(clinica.telefono))}</a>.`;
}

function datosDeLaCita(cita, clinica) {
  return `<section class="tarjeta cita-portal" aria-label="${esc(t.titulo)}">
    <p class="cita-cuando">${esc(t.cuandoDeEspana(formatoFechaHora(cita.inicio)))}</p>
    <p class="cita-detalle">${esc(clinica.nombre)}</p>
    <p class="cita-detalle">${esc(cita.profesional)} · ${esc(cita.servicio)}</p>
    <p class="cita-detalle">${esc(cita.paciente)}</p>
  </section>`;
}

/**
 * Qué ve el paciente al abrir el enlace (nunca cancela). `situacion`:
 * puede_cancelar | sin_margen | ya_cancelada | no_reservada.
 */
export function vistaEnlace({ situacion, cita, clinica, secreto }) {
  let cuerpo;
  if (situacion === 'puede_cancelar') {
    cuerpo = `
    <p>${esc(t.explicacion)}</p>
    <form method="post" action="/cancelar/${esc(secreto)}" class="acciones-formulario">
      <button class="boton peligro" type="submit">${esc(t.botonCancelar)}</button>
    </form>`;
  } else if (situacion === 'sin_margen') {
    cuerpo = `<p class="mensaje aviso" role="status">${esc(t.sinMargen)} ${llamaALaClinica(clinica)}</p>`;
  } else if (situacion === 'ya_cancelada') {
    cuerpo = `<p class="mensaje aviso" role="status">${esc(t.yaCancelada)}</p>`;
  } else {
    cuerpo = `<p class="mensaje aviso" role="status">${esc(t.noReservada)}</p>`;
  }
  return paginaPortal({
    titulo: t.titulo,
    clinica,
    contenido: `<h1>${esc(t.titulo)}</h1>${datosDeLaCita(cita, clinica)}${cuerpo}`,
  });
}

/** Resultado de confirmar (POST): cancelada, o el motivo por el que no se pudo. */
export function vistaResultado({ codigo, cita, clinica }) {
  const mensajes = {
    cancelada: `<p class="mensaje aviso" role="status">${esc(t.cancelada)}</p>`,
    ya_cancelada: `<p class="mensaje aviso" role="status">${esc(t.yaCancelada)}</p>`,
    no_reservada: `<p class="mensaje aviso" role="status">${esc(t.noReservada)}</p>`,
    sin_margen: `<p class="mensaje error" role="alert">${esc(t.sinMargen)} ${llamaALaClinica(clinica)}</p>`,
  };
  return paginaPortal({
    titulo: t.titulo,
    clinica,
    contenido: `<h1>${esc(t.titulo)}</h1>${datosDeLaCita(cita, clinica)}${mensajes[codigo]}`,
  });
}

/** Misma respuesta para cualquier enlace no válido: sin datos y sin decir si la cita existe (FR-015). */
export function vistaEnlaceNoValido() {
  return paginaPortal({
    titulo: t.noValido,
    clinica: null,
    contenido: `<section class="tarjeta">
      <h1>${esc(t.noValido)}</h1>
      <p>${esc(t.noValidoAyuda)}</p>
    </section>`,
  });
}
