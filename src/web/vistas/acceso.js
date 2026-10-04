import { textos } from '../textos.js';
import { esc, pagina } from './base.js';

export function vistaAcceso({ error } = {}) {
  const t = textos.acceso;
  return pagina({
    titulo: t.titulo,
    error,
    contenido: `
    <section class="tarjeta acceso">
      <h1>${esc(t.titulo)}</h1>
      <p>${esc(t.ayuda)}</p>
      <form method="post" action="/acceso" class="formulario">
        <label for="clave">${esc(t.etiquetaClave)}</label>
        <input id="clave" name="clave" type="password" autocomplete="current-password" required autofocus>
        <button class="boton" type="submit">${esc(t.boton)}</button>
      </form>
    </section>`,
  });
}
