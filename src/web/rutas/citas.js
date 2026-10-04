import { Router } from 'express';
import { opcionesAlta } from '../../domain/agenda.js';
import { cambiarEstado, crearCita } from '../../domain/citas.js';
import { crearPaciente, validarPaciente } from '../../domain/pacientes.js';
import { aInstanteUTC, esDiaValido, formatoHora, hoyMadrid } from '../../domain/tiempo.js';
import { textos } from '../textos.js';
import { exigirCsrf, exigirSesion } from '../sesion.js';
import { vistaAltaCita } from '../vistas/alta-cita.js';
import { mostrarAgenda } from './agenda.js';

const CAMPOS = [
  'profesional_id', 'servicio_id', 'dia', 'hora',
  'paciente_id', 'paciente_nombre', 'paciente_telefono', 'paciente_email',
];

const texto = (v) => (typeof v === 'string' ? v.trim() : '');
const entero = (v) => (/^\d+$/.test(texto(v)) ? Number(v) : null);

export function rutasCitas(contexto) {
  const { db, ahora } = contexto;
  const r = Router();

  function mostrarFormulario(req, res, { valores = {}, errores = {}, estado = 200, error, aviso } = {}) {
    const opciones = opcionesAlta(db, req.sesion.clinicaId);
    const servicio = opciones.servicios.find((s) => String(s.id) === String(valores.servicio_id));
    const inicio = aInstanteUTC(valores.dia, valores.hora);
    const finCalculado =
      servicio && inicio ? formatoHora(new Date(inicio.getTime() + servicio.duracionMin * 60_000)) : undefined;
    res
      .status(estado)
      .type('html')
      .send(vistaAltaCita({ opciones, valores, errores, sesion: req.sesion, error, aviso, finCalculado }));
  }

  r.get('/citas/nueva', exigirSesion, (req, res) => {
    const dia = esDiaValido(req.query.dia) ? req.query.dia : hoyMadrid(ahora());
    mostrarFormulario(req, res, {
      valores: {
        profesional_id: texto(req.query.profesional),
        servicio_id: texto(req.query.servicio),
        dia,
        hora: texto(req.query.hora),
      },
    });
  });

  r.post('/citas', exigirSesion, exigirCsrf, (req, res) => {
    const { clinicaId } = req.sesion;
    const valores = Object.fromEntries(CAMPOS.map((c) => [c, texto(req.body?.[c])]));
    const rechazar = (estado, error, errores = {}, extra = {}) =>
      mostrarFormulario(req, res, { valores: { ...valores, ...extra }, errores, estado, error });

    const errores = {};
    if (!valores.profesional_id) errores.profesional = 'Elige un profesional';
    if (!valores.servicio_id) errores.servicio = 'Elige un servicio';
    if (!valores.dia || !valores.hora) errores.inicio = 'Indica el día y la hora de inicio';
    const inicio = errores.inicio ? null : aInstanteUTC(valores.dia, valores.hora);
    if (!errores.inicio && !inicio) errores.inicio = 'El día o la hora no son válidos';

    const hayDatosNuevos = ['paciente_nombre', 'paciente_telefono', 'paciente_email'].some((c) => valores[c]);
    if (!valores.paciente_id && !hayDatosNuevos) errores.paciente = textos.errores.elegirPaciente;
    if (!valores.paciente_id && hayDatosNuevos) {
      const v = validarPaciente({
        nombre: valores.paciente_nombre,
        telefono: valores.paciente_telefono,
        email: valores.paciente_email,
      });
      if (!v.ok) Object.assign(errores, v.errores);
    }
    if (Object.keys(errores).length) return rechazar(422, textos.errores.datos, errores);

    // La ficha del paciente nuevo se guarda aparte: sobrevive si la cita se rechaza (FR-008b).
    let pacienteId = entero(valores.paciente_id);
    let extra = {};
    let aviso;
    if (!pacienteId) {
      const alta = crearPaciente(db, clinicaId, {
        nombre: valores.paciente_nombre,
        telefono: valores.paciente_telefono,
        email: valores.paciente_email,
      });
      pacienteId = alta.paciente.id;
      extra = { paciente_id: String(pacienteId), paciente_nombre: '', paciente_telefono: '', paciente_email: '' };
      aviso = textos.alta.fichaCreada(alta.paciente.nombre);
    }

    const resultado = crearCita(
      db,
      {
        clinicaId,
        profesionalId: entero(valores.profesional_id),
        servicioId: entero(valores.servicio_id),
        pacienteId,
        inicio,
      },
      ahora,
    );

    if (resultado.ok) {
      return res.redirect(303, `/agenda?dia=${valores.dia}&aviso=reservada&cita=${resultado.cita.id}`);
    }
    const fallo = {
      ocupado: [409, textos.errores.ocupado],
      pasado: [422, textos.errores.pasado],
      fuera_de_horario: [422, textos.errores.fueraDeHorario],
      hora_invalida: [422, textos.errores.horaInvalida],
      no_encontrado: [422, textos.errores.noEncontrado],
      datos: [422, textos.errores.datos],
    }[resultado.codigo] ?? [422, textos.errores.datos];
    mostrarFormulario(req, res, {
      valores: { ...valores, ...extra },
      errores: resultado.errores ?? {},
      estado: fallo[0],
      error: fallo[1],
      aviso,
    });
  });

  r.post('/citas/:id/estado', exigirSesion, exigirCsrf, (req, res) => {
    const dia = esDiaValido(req.body?.dia) ? req.body.dia : hoyMadrid(ahora());
    const resultado = cambiarEstado(
      db,
      { clinicaId: req.sesion.clinicaId, citaId: entero(req.params.id), estado: texto(req.body?.estado) },
      ahora,
    );
    if (resultado.ok) {
      return res.redirect(303, `/agenda?dia=${dia}&aviso=estado&cita=${Number(req.params.id)}`);
    }
    const [estado, error] = {
      no_encontrado: [404, textos.errores.citaNoEncontrada],
      no_reservada: [409, textos.errores.noReservada],
      no_ha_empezado: [422, textos.errores.aunNoHaEmpezado],
      estado_invalido: [422, textos.errores.estadoNoPermitido],
    }[resultado.codigo];
    mostrarAgenda(contexto, req, res, dia, { estado, error });
  });

  return r;
}
