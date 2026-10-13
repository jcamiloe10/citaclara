import { Router } from 'express';
import { config } from '../../config.js';
import { crearOrenovarEnlace } from '../../domain/enlaces.js';
import { listarPacientes, obtenerPaciente } from '../../domain/pacientes.js';
import { textos } from '../textos.js';
import { exigirCsrf, exigirSesion } from '../sesion.js';
import { esc, pagina } from '../vistas/base.js';
import { vistaConfirmarEnlace, vistaEnlaceCreado, vistaPacientes } from '../vistas/pacientes.js';

const entero = (v) => (/^\d+$/.test(String(v ?? '')) ? Number(v) : null);

/** Pantalla de recepción para crear y renovar los enlaces personales (002, FR-004). */
export function rutasPacientes({ db }) {
  const r = Router();

  const noEncontrado = (req, res) =>
    res.status(404).type('html').send(
      pagina({
        titulo: textos.errores.paginaNoEncontrada,
        sesion: req.sesion,
        error: textos.errores.paginaNoEncontrada,
        contenido: `<p><a href="/pacientes">${esc(textos.pacientes.volver)}</a></p>`,
      }),
    );

  r.get('/pacientes', exigirSesion, (req, res) => {
    const q = typeof req.query.q === 'string' ? req.query.q : '';
    const pacientes = listarPacientes(db, req.sesion.clinicaId, { q });
    res.type('html').send(vistaPacientes({ pacientes, q, sesion: req.sesion }));
  });

  r.get('/pacientes/:id/enlace', exigirSesion, (req, res) => {
    const paciente = obtenerPaciente(db, req.sesion.clinicaId, entero(req.params.id));
    if (!paciente) return noEncontrado(req, res);
    res.type('html').send(vistaConfirmarEnlace({ paciente: { ...paciente, conEnlace: paciente.conEnlace === 1 }, sesion: req.sesion }));
  });

  // 200 sin redirección: el secreto no se repite en el historial del navegador ni en la URL.
  r.post('/pacientes/:id/enlace', exigirSesion, exigirCsrf, (req, res) => {
    const { clinicaId } = req.sesion;
    const paciente = obtenerPaciente(db, clinicaId, entero(req.params.id));
    if (!paciente) return noEncontrado(req, res);
    const resultado = crearOrenovarEnlace(db, { clinicaId, pacienteId: paciente.id });
    if (!resultado.ok) return noEncontrado(req, res);
    const base = config.urlPublica ?? `${req.protocol}://${req.get('host')}`;
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' });
    res.type('html').send(
      vistaEnlaceCreado({ paciente, enlace: `${base}/p/${resultado.secreto}`, sesion: req.sesion }),
    );
  });

  return r;
}
