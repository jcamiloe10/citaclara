import { textos } from '../textos.js';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export const esc = (valor) => String(valor ?? '').replace(/[&<>"']/g, (c) => ESCAPES[c]);

/** Plantilla común de página. `sesion` (opcional) muestra la cabecera con "Cerrar sesión". */
export function pagina({ titulo, contenido, sesion, aviso, error }) {
  const cabecera = sesion
    ? `<header class="cabecera">
        <a class="marca" href="/agenda">${esc(textos.marca)}<span class="clinica">${esc(sesion.nombre)}</span></a>
        <nav class="nav-cabecera">
          <a href="/analitica">${esc(textos.enlaceAnalitica)}</a>
        </nav>
        <form method="post" action="/salir">
          <input type="hidden" name="csrf" value="${esc(sesion.csrf)}">
          <button class="boton secundario" type="submit">${esc(textos.cerrarSesion)}</button>
        </form>
      </header>`
    : `<header class="cabecera"><span class="marca">${esc(textos.marca)}</span></header>`;
  const mensajes = [
    aviso ? `<p class="mensaje aviso" role="status">${esc(aviso)}</p>` : '',
    error ? `<p class="mensaje error" role="alert">${esc(error)}</p>` : '',
  ].join('');
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${esc(titulo)} · ${esc(textos.marca)}</title>
  <link rel="stylesheet" href="/estilos.css">
</head>
<body>
  ${cabecera}
  <main class="contenido">
    ${mensajes}
    ${contenido}
  </main>
  <footer class="pie">${esc(textos.zonaHoraria)}</footer>
</body>
</html>`;
}
