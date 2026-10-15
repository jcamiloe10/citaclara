import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { componerRecordatorio } from '../../../src/correo/mensaje.js';
import { textosCorreo } from '../../../src/correo/textos.js';
import { aInstanteUTC } from '../../../src/domain/tiempo.js';
import { textos } from '../../../src/web/textos.js';
import { vistaEnlace, vistaEnlaceNoValido, vistaResultado } from '../../../src/web/vistas/enlace.js';
import { textoVisible } from '../../ayudas/fixture.js';
import { decodificarEml, REMITENTE, URL_PUBLICA } from '../ayudas.js';

const JERGA = /\b(token|secreto|hash|huella|sql|null|undefined|error 404|http|api|id)\b/i;
const NO_ESPANA = /\b(vosotros|ordenador portátil|computadora|celular|móvil de)\b|\bhi\b|\bhello\b|\bcancel\b/i;

const cita = {
  id: 7,
  inicio: aInstanteUTC('2026-10-16', '10:00'),
  profesional: 'María',
  servicio: 'Sesión de fisioterapia',
  paciente: 'Ana Ruiz',
};
const clinica = { nombre: 'Clínica Eleva', telefono: '910123456' };

const todasLasPaginas = () =>
  [
    ...['puede_cancelar', 'sin_margen', 'ya_cancelada', 'no_reservada'].map((situacion) =>
      vistaEnlace({ situacion, cita, clinica, secreto: 'A'.repeat(43) }),
    ),
    ...['cancelada', 'ya_cancelada', 'no_reservada', 'sin_margen'].map((codigo) => vistaResultado({ codigo, cita, clinica })),
    vistaEnlaceNoValido(),
  ].map(textoVisible);

describe('Textos del recordatorio y del enlace', () => {
  it('[003:SC-007] ninguna página del enlace contiene jerga técnica ni variantes ajenas al español de España', () => {
    for (const texto of todasLasPaginas()) {
      assert.doesNotMatch(texto, JERGA);
      assert.doesNotMatch(texto, NO_ESPANA);
    }
  });

  it('[003:SC-007] las páginas con una cita muestran la fecha en formato largo y la indicación "hora de España"', () => {
    for (const texto of todasLasPaginas().slice(0, 8)) {
      assert.match(texto, /viernes 16 de octubre de 2026, 10:00 \(hora de España\)/);
    }
  });

  it('[003:SC-007] el email no contiene jerga técnica y la fecha va en formato largo con la hora de España', () => {
    const { contenido } = componerRecordatorio({
      clinica,
      paciente: { nombre: 'Ana Ruiz', email: 'ana@ejemplo.es' },
      cita,
      urlPublica: URL_PUBLICA,
      secreto: 'A'.repeat(43),
      generadoEn: aInstanteUTC('2026-10-15', '07:00'),
      remitente: REMITENTE,
    });
    const { cuerpo } = decodificarEml(contenido);
    const sinEnlace = cuerpo.replace(/\S*\/cancelar\/\S+/, '');
    assert.doesNotMatch(sinEnlace, JERGA);
    assert.match(cuerpo, /viernes 16 de octubre de 2026, 10:00 \(hora de España\)/);
  });

  it('[003:SC-007] los textos del enlace y del correo están centralizados en módulos de textos', () => {
    assert.ok(textos.enlace && textosCorreo);
    for (const valor of Object.values(textos.enlace)) {
      if (typeof valor === 'string') assert.doesNotMatch(valor, JERGA);
    }
  });
});
