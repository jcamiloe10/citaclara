import { Router } from 'express';
import { identificarPorClave } from '../../domain/clinicas.js';
import { textos } from '../textos.js';
import { cookieBorrada, cookieDeSesion, emitirSesion, exigirCsrf } from '../sesion.js';
import { vistaAcceso } from '../vistas/acceso.js';

export function rutasAcceso({ db, ahora, secreto }) {
  const r = Router();

  r.get('/acceso', (req, res) => {
    if (req.sesion) return res.redirect(303, '/agenda');
    res.type('html').send(vistaAcceso());
  });

  r.post('/acceso', (req, res) => {
    const clinica = identificarPorClave(db, req.body?.clave);
    if (!clinica) {
      return res.status(401).type('html').send(vistaAcceso({ error: textos.acceso.claveIncorrecta }));
    }
    const valor = emitirSesion({ clinicaId: clinica.id, nombre: clinica.nombre }, secreto, ahora);
    res.setHeader('Set-Cookie', cookieDeSesion(valor));
    res.redirect(303, '/agenda');
  });

  r.post('/salir', exigirCsrf, (_req, res) => {
    res.setHeader('Set-Cookie', cookieBorrada());
    res.redirect(303, '/acceso');
  });

  return r;
}
