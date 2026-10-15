import { Router } from 'express';
import { cancelarPorEnlace, consultarEnlace } from '../../domain/recordatorios.js';
import { textos } from '../textos.js';
import { vistaErrorPortal } from '../vistas/portal.js';
import { vistaEnlace, vistaEnlaceNoValido, vistaResultado } from '../vistas/enlace.js';

/**
 * Enlace de cancelación del recordatorio (003, contracts/enlace-cancelacion.md). Público: la
 * credencial es el secreto de la ruta. Un GET nunca cambia nada; solo el POST cancela.
 */
export function rutasEnlace({ db, ahora }) {
  const r = Router();

  r.use((_req, res, next) => {
    res.set({
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
    });
    next();
  });

  const noValido = (res) => res.status(404).type('html').send(vistaEnlaceNoValido());

  r.get('/:secreto', (req, res) => {
    const { secreto } = req.params;
    const consulta = consultarEnlace(db, secreto, ahora);
    if (!consulta.ok) return noValido(res);
    res.type('html').send(vistaEnlace({ ...consulta, secreto }));
  });

  r.post('/:secreto', (req, res) => {
    const resultado = cancelarPorEnlace(db, req.params.secreto, ahora);
    if (resultado.codigo === 'no_valido') return noValido(res);
    res.type('html').send(vistaResultado(resultado));
  });

  // Cualquier otra ruta dentro del enlace: misma respuesta genérica, sin enlaces a recepción.
  r.use((_req, res) => noValido(res));

  // eslint-disable-next-line no-unused-vars
  r.use((error, _req, res, _next) => {
    // Solo el mensaje: nunca la ruta ni la URL de la petición, que contienen el secreto.
    console.error('Error en el enlace de cancelación:', error?.message ?? error);
    res.status(500).type('html').send(vistaErrorPortal({ titulo: textos.portal.errorInesperado }));
  });

  return r;
}
