import { Router } from 'express';
import { resolverEnlace } from '../../domain/enlaces.js';
import { cancelarComoPaciente, citaDelPaciente, citasDelPaciente } from '../../domain/portal.js';
import { textos } from '../textos.js';
import {
  AVISOS_PORTAL,
  textoCancelada,
  vistaConfirmarCancelacion,
  vistaEnlaceNoValido,
  vistaErrorPortal,
  vistaPaginaPortal,
} from '../vistas/portal.js';

const entero = (v) => (/^\d+$/.test(String(v ?? '')) ? Number(v) : null);

/** Cuántas citas del historial se muestran: múltiplos de 10, sin tope (se acota al total). */
function limiteDeHistorial(valor) {
  const n = entero(valor);
  return n && n % 10 === 0 ? n : 10;
}

/**
 * Portal del paciente (002). No usa la sesión de recepción ni emite cookies: la credencial es
 * el secreto de la ruta (research D1, D3). Todas las respuestas llevan cabeceras de privacidad.
 */
export function rutasPortal({ db, ahora }) {
  const r = Router();

  r.use((_req, res, next) => {
    res.set({
      'Cache-Control': 'no-store',
      'Referrer-Policy': 'no-referrer',
      'X-Robots-Tag': 'noindex, nofollow',
    });
    next();
  });

  // Resuelve el secreto; cualquier causa de invalidez da exactamente la misma respuesta (FR-003).
  r.use('/:secreto', (req, res, next) => {
    const acceso = resolverEnlace(db, req.params.secreto);
    if (!acceso) return res.status(404).type('html').send(vistaEnlaceNoValido());
    req.acceso = acceso;
    next();
  });

  const datosDe = (req) => ({ pacienteId: req.acceso.pacienteId, clinicaId: req.acceso.clinicaId });
  const volver = (res, secreto, aviso, extra = '') => res.redirect(303, `/p/${secreto}?aviso=${aviso}${extra}`);

  r.get('/:secreto', (req, res) => {
    const limite = limiteDeHistorial(req.query.h);
    const citas = citasDelPaciente(db, datosDe(req), ahora, { limiteHistorial: limite });
    let aviso;
    if (req.query.aviso === 'cancelada') {
      const cita = citaDelPaciente(db, { ...datosDe(req), citaId: entero(req.query.cita) }, ahora);
      if (cita?.estado === 'cancelada') aviso = textoCancelada(cita.inicio);
    } else if (typeof req.query.aviso === 'string') {
      aviso = AVISOS_PORTAL[req.query.aviso];
    }
    res.type('html').send(
      vistaPaginaPortal({
        paciente: { nombre: req.acceso.nombre },
        clinica: req.acceso.clinica,
        citas,
        secreto: req.params.secreto,
        aviso,
        limite,
      }),
    );
  });

  // Confirmación: nunca cancela (FR-012).
  r.get('/:secreto/citas/:id/cancelar', (req, res) => {
    const { secreto } = req.params;
    const cita = citaDelPaciente(db, { ...datosDe(req), citaId: entero(req.params.id) }, ahora);
    if (!cita) return volver(res, secreto, 'no-disponible');
    if (cita.estado === 'cancelada') return volver(res, secreto, 'ya-cancelada');
    if (!cita.sePuedeCancelar) return volver(res, secreto, 'fuera-de-plazo');
    res.type('html').send(vistaConfirmarCancelacion({ cita, secreto, clinica: req.acceso.clinica }));
  });

  r.post('/:secreto/citas/:id/cancelar', (req, res) => {
    const { secreto } = req.params;
    const citaId = entero(req.params.id);
    if (citaId === null) return volver(res, secreto, 'no-disponible');
    const resultado = cancelarComoPaciente(db, { ...datosDe(req), citaId }, ahora);
    if (resultado.ok) return volver(res, secreto, 'cancelada', `&cita=${citaId}`);
    if (resultado.codigo === 'no_encontrada') return volver(res, secreto, 'no-disponible');
    if (resultado.codigo === 'no_reservada') {
      return volver(res, secreto, resultado.estado === 'cancelada' ? 'ya-cancelada' : 'fuera-de-plazo');
    }
    return volver(res, secreto, 'fuera-de-plazo');
  });

  // Errores propios del portal: sin enlaces a recepción y sin el secreto en el cuerpo (FR-005).
  r.use((_req, res) => {
    res.status(404).type('html').send(vistaErrorPortal({ titulo: textos.portal.paginaNoEncontrada }));
  });

  // eslint-disable-next-line no-unused-vars
  r.use((error, _req, res, _next) => {
    // Solo el error: nunca la ruta ni la URL de la petición, que contienen el secreto.
    console.error('Error en el portal del paciente:', error?.message ?? error);
    res.status(500).type('html').send(vistaErrorPortal({ titulo: textos.portal.errorInesperado }));
  });

  return r;
}
