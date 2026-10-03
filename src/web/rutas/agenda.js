import { Router } from 'express';
import { agendaDelDia, citaConDetalle } from '../../domain/agenda.js';
import { esDiaValido, formatoFechaHora, hoyMadrid } from '../../domain/tiempo.js';
import { textos } from '../textos.js';
import { exigirSesion } from '../sesion.js';
import { vistaAgenda, vistaDiaInvalido } from '../vistas/agenda.js';

/** Convierte el código de aviso de la URL (nunca texto libre) en el mensaje mostrado. */
export function avisoDe(db, clinicaId, consulta) {
  const cita = consulta.cita ? citaConDetalle(db, clinicaId, Number(consulta.cita)) : undefined;
  if (!cita) return undefined;
  const resumen = `${cita.paciente}, ${formatoFechaHora(cita.inicio)}`;
  if (consulta.aviso === 'reservada') return textos.avisos.reservada(`${resumen}, ${cita.servicio}`);
  if (consulta.aviso === 'estado') return textos.avisos.estado(resumen, textos.estados[cita.estado].texto);
  return undefined;
}

export function mostrarAgenda({ db, ahora }, req, res, dia, { estado = 200, error } = {}) {
  const { clinicaId } = req.sesion;
  const agenda = agendaDelDia(db, clinicaId, dia);
  res
    .status(estado)
    .type('html')
    .send(
      vistaAgenda({
        agenda,
        sesion: req.sesion,
        ahora,
        aviso: error ? undefined : avisoDe(db, clinicaId, req.query),
        error,
      }),
    );
}

export function rutasAgenda(contexto) {
  const { ahora } = contexto;
  const r = Router();

  r.get('/', (_req, res) => res.redirect(303, '/agenda'));

  r.get('/agenda', exigirSesion, (req, res) => {
    const dia = req.query.dia ?? hoyMadrid(ahora());
    if (!esDiaValido(dia)) {
      return res.status(400).type('html').send(vistaDiaInvalido({ sesion: req.sesion, ahora }));
    }
    mostrarAgenda(contexto, req, res, dia);
  });

  return r;
}
