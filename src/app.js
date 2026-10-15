import express from 'express';
import { fileURLToPath } from 'node:url';
import { ahoraReal } from './domain/tiempo.js';
import { textos } from './web/textos.js';
import { cargarSesion } from './web/sesion.js';
import { rutasAcceso } from './web/rutas/acceso.js';
import { rutasAgenda } from './web/rutas/agenda.js';
import { rutasCitas } from './web/rutas/citas.js';
import { rutasEnlace } from './web/rutas/enlace.js';
import { rutasPacientes } from './web/rutas/pacientes.js';
import { rutasPortal } from './web/rutas/portal.js';
import { esc, pagina } from './web/vistas/base.js';

/** Construye la aplicación. Recibe base y reloj para poder fijarlos en las pruebas. */
export function crearApp({ db, ahora = ahoraReal, secreto }) {
  const app = express();
  app.disable('x-powered-by');
  const contexto = { db, ahora, secreto };

  app.use(express.static(fileURLToPath(new URL('./web/publico', import.meta.url))));
  app.use(express.urlencoded({ extended: false }));
  // Portal del paciente: sin sesión de recepción; antes de cargarla para que nunca la lea.
  app.use('/p', rutasPortal(contexto));
  // Enlace de cancelación de los recordatorios (003): también público, sin sesión de recepción.
  app.use('/cancelar', rutasEnlace(contexto));
  app.use(cargarSesion(contexto));
  app.use(rutasAcceso(contexto));
  app.use(rutasAgenda(contexto));
  app.use(rutasCitas(contexto));
  app.use(rutasPacientes(contexto));

  app.use((req, res) => {
    res.status(404).type('html').send(
      pagina({
        titulo: textos.errores.paginaNoEncontrada,
        sesion: req.sesion,
        error: textos.errores.paginaNoEncontrada,
        contenido: `<p><a href="/agenda">${esc(textos.volverAgenda)}</a></p>`,
      }),
    );
  });

  // eslint-disable-next-line no-unused-vars
  app.use((error, req, res, _next) => {
    console.error(error);
    res.status(500).type('html').send(
      pagina({
        titulo: textos.errores.inesperado,
        sesion: req.sesion,
        error: textos.errores.inesperado,
        contenido: `<p><a href="/agenda">${esc(textos.volverAgenda)}</a></p>`,
      }),
    );
  });

  return app;
}
