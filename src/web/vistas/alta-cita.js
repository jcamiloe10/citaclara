import { horasDeInicio } from '../../domain/tiempo.js';
import { textos } from '../textos.js';
import { esc, pagina } from './base.js';

const opcion = (valor, texto, seleccionado, extra = '') =>
  `<option value="${esc(valor)}"${seleccionado ? ' selected' : ''}${extra}>${esc(texto)}</option>`;

const campoError = (errores, campo) =>
  errores?.[campo] ? `<p class="error-campo" role="alert">${esc(errores[campo])}</p>` : '';

/** Formulario de alta. `valores` conserva lo escrito; `errores` es un mapa campo → mensaje. */
export function vistaAltaCita({ opciones, valores = {}, errores = {}, sesion, error, aviso, finCalculado }) {
  const t = textos.alta;
  const v = valores;
  const horas = horasDeInicio();
  const servicios = opciones.servicios
    .map((s) =>
      opcion(s.id, `${s.nombre} · ${s.duracionMin} min · ${s.precio}`, String(v.servicio_id) === String(s.id), ` data-duracion="${s.duracionMin}"`),
    )
    .join('');
  return pagina({
    titulo: t.titulo,
    sesion,
    error,
    aviso,
    contenido: `
    <section class="tarjeta">
      <h1>${esc(t.titulo)}</h1>
      <form method="post" action="/citas" class="formulario" id="alta-cita">
        <input type="hidden" name="csrf" value="${esc(sesion.csrf)}">

        <label for="profesional_id">${esc(t.profesional)}</label>
        <select id="profesional_id" name="profesional_id" required>
          ${opcion('', t.elegir, !v.profesional_id)}
          ${opciones.profesionales
            .map((p) => opcion(p.id, `${p.nombre} · ${p.especialidad}`, String(v.profesional_id) === String(p.id)))
            .join('')}
        </select>
        ${campoError(errores, 'profesional')}

        <label for="servicio_id">${esc(t.servicio)}</label>
        <select id="servicio_id" name="servicio_id" required>
          ${opcion('', t.elegir, !v.servicio_id)}
          ${servicios}
        </select>
        ${campoError(errores, 'servicio')}

        <div class="fila">
          <div>
            <label for="dia">${esc(t.dia)}</label>
            <input id="dia" name="dia" type="date" value="${esc(v.dia)}" required>
          </div>
          <div>
            <label for="hora">${esc(t.hora)}</label>
            <select id="hora" name="hora" required>
              ${opcion('', t.elegir, !v.hora)}
              ${horas.map((h) => opcion(h, h, v.hora === h)).join('')}
            </select>
          </div>
        </div>
        ${campoError(errores, 'inicio')}
        <p class="nota" id="fin-calculado" aria-live="polite">${finCalculado ? esc(t.finCalculado(finCalculado)) : ''}</p>

        <label for="paciente_id">${esc(t.paciente)}</label>
        <select id="paciente_id" name="paciente_id">
          ${opcion('', t.pacienteNuevoOpcion, !v.paciente_id)}
          ${opciones.pacientes
            .map((p) =>
              opcion(p.id, `${p.nombre} · ${p.telefonoFormateado} · ${p.email}`, String(v.paciente_id) === String(p.id)),
            )
            .join('')}
        </select>
        ${campoError(errores, 'paciente')}

        <fieldset>
          <legend>${esc(t.pacienteNuevoTitulo)}</legend>
          <p class="nota">${esc(t.pacienteNuevoAyuda)}</p>
          <label for="paciente_nombre">${esc(t.nombre)}</label>
          <input id="paciente_nombre" name="paciente_nombre" type="text" autocomplete="off" value="${esc(v.paciente_nombre)}">
          ${campoError(errores, 'nombre')}
          <label for="paciente_telefono">${esc(t.telefono)}</label>
          <input id="paciente_telefono" name="paciente_telefono" type="tel" autocomplete="off" value="${esc(v.paciente_telefono)}">
          ${campoError(errores, 'telefono')}
          <label for="paciente_email">${esc(t.email)}</label>
          <input id="paciente_email" name="paciente_email" type="email" autocomplete="off" value="${esc(v.paciente_email)}">
          ${campoError(errores, 'email')}
        </fieldset>

        <div class="acciones-formulario">
          <button class="boton" type="submit">${esc(t.boton)}</button>
          <a class="boton secundario" href="/agenda${v.dia ? `?dia=${esc(v.dia)}` : ''}">${esc(t.cancelar)}</a>
        </div>
      </form>
    </section>
    <script>
      // Mejora opcional: muestra la hora de fin al elegir servicio y hora. Sin JavaScript el formulario funciona igual.
      (function () {
        var servicio = document.getElementById('servicio_id');
        var hora = document.getElementById('hora');
        var salida = document.getElementById('fin-calculado');
        function actualizar() {
          var opt = servicio.options[servicio.selectedIndex];
          if (!opt || !opt.dataset.duracion || !hora.value) { salida.textContent = ''; return; }
          var p = hora.value.split(':');
          var total = Number(p[0]) * 60 + Number(p[1]) + Number(opt.dataset.duracion);
          var h = String(Math.floor(total / 60)).padStart(2, '0');
          var m = String(total % 60).padStart(2, '0');
          salida.textContent = 'Terminaría a las ' + h + ':' + m;
        }
        servicio.addEventListener('change', actualizar);
        hora.addEventListener('change', actualizar);
      })();
    </script>`,
  });
}
