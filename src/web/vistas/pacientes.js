import { textos } from '../textos.js';
import { esc, pagina } from './base.js';

const t = textos.pacientes;

function fila(p) {
  return `<li class="tarjeta fila-paciente">
    <p><strong>${esc(p.nombre)}</strong></p>
    <p class="nota">${esc(p.telefonoFormateado)} · ${esc(p.email)}</p>
    <p><span class="estado ${p.conEnlace ? 'estado-reservada' : 'estado-completada'}">${esc(p.conEnlace ? t.conEnlace : t.sinEnlace)}</span></p>
    <p><a class="boton pequeno ${p.conEnlace ? 'secundario' : ''}" href="/pacientes/${p.id}/enlace">${esc(p.conEnlace ? t.renovar : t.crear)}</a></p>
  </li>`;
}

export function vistaPacientes({ pacientes, q = '', sesion }) {
  return pagina({
    titulo: t.titulo,
    sesion,
    contenido: `
    <h1>${esc(t.titulo)}</h1>
    <form method="get" action="/pacientes" class="formulario">
      <label for="q">${esc(t.buscar)}</label>
      <div class="acciones-formulario">
        <input id="q" name="q" type="search" value="${esc(q)}">
        <button class="boton secundario" type="submit">${esc(t.botonBuscar)}</button>
      </div>
    </form>
    ${pacientes.length ? `<ul class="lista-citas">${pacientes.map(fila).join('')}</ul>` : `<p class="nota">${esc(t.sinResultados)}</p>`}`,
  });
}

/** Confirmación antes de crear o renovar (renovar invalida el enlace anterior). */
export function vistaConfirmarEnlace({ paciente, sesion }) {
  const renueva = paciente.conEnlace;
  return pagina({
    titulo: renueva ? t.renovarTitulo : t.crearTitulo,
    sesion,
    contenido: `
    <section class="tarjeta">
      <h1>${esc(renueva ? t.renovarTitulo : t.crearTitulo)}</h1>
      <p><strong>${esc(paciente.nombre)}</strong></p>
      <p>${esc(renueva ? t.renovarAviso : t.crearAviso)}</p>
      <form method="post" action="/pacientes/${paciente.id}/enlace" class="acciones-formulario">
        <input type="hidden" name="csrf" value="${esc(sesion.csrf)}">
        <button class="boton" type="submit">${esc(t.continuar)}</button>
        <a class="boton secundario" href="/pacientes">${esc(t.volver)}</a>
      </form>
    </section>`,
  });
}

/** Única vez que se muestra el enlace completo (FR-004). */
export function vistaEnlaceCreado({ paciente, enlace, sesion }) {
  return pagina({
    titulo: t.enlaceCreadoTitulo,
    sesion,
    aviso: t.enlaceCreadoAviso,
    contenido: `
    <section class="tarjeta">
      <h1>${esc(t.enlaceCreadoTitulo)}</h1>
      <p>${esc(t.copiaYEntrega(paciente.nombre))}</p>
      <div class="formulario">
        <label for="enlace">${esc(t.etiquetaEnlace)}</label>
        <input id="enlace" type="text" readonly value="${esc(enlace)}" onfocus="this.select()">
      </div>
      <p><a class="boton secundario" href="/pacientes">${esc(t.volver)}</a></p>
    </section>`,
  });
}
