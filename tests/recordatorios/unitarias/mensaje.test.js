import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { componerRecordatorio, nombreDeFichero, palabrasCodificadas } from '../../../src/correo/mensaje.js';
import { aInstanteUTC } from '../../../src/domain/tiempo.js';
import { decodificarEml, REMITENTE, URL_PUBLICA } from '../ayudas.js';

const SECRETO = 'A'.repeat(43);

const base = () => ({
  clinica: { nombre: 'Clínica Eleva', telefono: '910123456' },
  paciente: { nombre: 'Sofía Núñez', email: 'sofia@ejemplo.es' },
  cita: {
    id: 418,
    inicio: aInstanteUTC('2026-10-16', '10:00'),
    profesional: 'María',
    servicio: 'Sesión de fisioterapia',
  },
  urlPublica: URL_PUBLICA,
  secreto: SECRETO,
  generadoEn: aInstanteUTC('2026-10-15', '07:00'),
  remitente: REMITENTE,
});

const componer = (cambios = {}) => {
  const { contenido, nombreFichero } = componerRecordatorio({ ...base(), ...cambios });
  return { ...decodificarEml(contenido), nombreFichero, contenido };
};

describe('Mensaje del recordatorio (.eml)', () => {
  it('[003:FR-007] el cuerpo incluye clínica, paciente, profesional, servicio y la hora de España sin ambigüedad', () => {
    const { cuerpo } = componer();
    assert.match(cuerpo, /Hola, Sofía Núñez:/);
    assert.match(cuerpo, /Te recordamos tu cita en Clínica Eleva\./);
    assert.match(cuerpo, /Día y hora: viernes 16 de octubre de 2026, 10:00 \(hora de España\)/);
    assert.match(cuerpo, /Profesional: María/);
    assert.match(cuerpo, /Servicio: Sesión de fisioterapia/);
  });

  it('[003:FR-008] incluye el enlace de cancelación en su propia línea y dice que cancelar libera el hueco', () => {
    const { cuerpo } = componer();
    assert.ok(cuerpo.split('\r\n').includes(`${URL_PUBLICA}/cancelar/${SECRETO}`));
    assert.match(cuerpo, /para que otra persona pueda usar tu hueco/);
    assert.match(cuerpo, /hasta 24 horas antes/);
  });

  it('[003:FR-009] indica cómo contactar para cambiar la cita, con teléfono y sin él', () => {
    assert.match(componer().cuerpo, /llama a la clínica: 910 123 456\./);
    const sin = componer({ clinica: { nombre: 'Clínica Eleva', telefono: null } }).cuerpo;
    assert.match(sin, /necesitas cambiar la cita, llama a la clínica\./);
    assert.doesNotMatch(sin, /\d{3} \d{3} \d{3}/);
  });

  it('[003:FR-019] lleva las cabeceras de un correo completo y la marca de modo simulado', () => {
    const { cabeceras } = componer();
    assert.equal(cabeceras.To, 'sofia@ejemplo.es');
    assert.equal(cabeceras.From, `Clínica Eleva <${REMITENTE}>`);
    assert.equal(cabeceras.Subject, 'Recordatorio de tu cita en Clínica Eleva: viernes 16 de octubre de 2026, 10:00');
    assert.match(cabeceras.Date, /^Thu, 15 Oct 2026 0[5-6]:00:00 \+0000$/);
    assert.equal(cabeceras['Message-ID'], '<recordatorio-418-20261016T0800Z@citaclara.invalid>');
    assert.equal(cabeceras['MIME-Version'], '1.0');
    assert.equal(cabeceras['Content-Type'], 'text/plain; charset=utf-8');
    assert.equal(cabeceras['Content-Transfer-Encoding'], 'base64');
    assert.equal(cabeceras['X-CitaClara-Modo'], 'simulado');
  });

  it('[003:SC-009] las tildes y eñes del asunto y del remitente se codifican y el cuerpo en base64 recupera el texto exacto', () => {
    const { bruto, cuerpo } = componer({ paciente: { nombre: 'Íñigo Muñoz', email: 'i@ejemplo.es' } });
    assert.match(bruto, /^Subject: =\?UTF-8\?B\?/m);
    assert.match(bruto, /^From: =\?UTF-8\?B\?/m);
    assert.ok(/^[\x20-\x7e\r\n]*$/.test(bruto), 'el fichero es ASCII puro: nada depende de la codificación del cliente');
    assert.match(cuerpo, /Hola, Íñigo Muñoz:/);
    for (const linea of bruto.split('\r\n')) assert.ok(linea.length <= 78, `línea demasiado larga: ${linea.length}`);
  });

  it('[003:SC-009] un asunto largo se parte en varias palabras codificadas de como mucho 75 caracteres', () => {
    const largo = palabrasCodificadas('ñ'.repeat(120));
    for (const palabra of largo.split(/\r\n /)) assert.ok(palabra.length <= 75);
  });

  it('[003:FR-007] un nombre con saltos de línea o comillas no inyecta cabeceras', () => {
    const { bruto, cabeceras } = componer({
      paciente: { nombre: 'Eva\r\nBcc: espia@ejemplo.es', email: 'eva@ejemplo.es' },
      clinica: { nombre: 'Clínica "Eleva"\r\nX-Falsa: 1', telefono: null },
    });
    assert.doesNotMatch(bruto, /^Bcc:/m);
    assert.doesNotMatch(bruto, /^X-Falsa:/m);
    assert.equal(cabeceras.Bcc, undefined);
  });

  it('[003:FR-020] el nombre del fichero es estable y único por cita y hora, y no contiene nombres ni emails', () => {
    const { nombreFichero } = componer();
    assert.equal(nombreFichero, 'cita-418-20261016T0800Z.eml');
    assert.equal(nombreDeFichero(418, aInstanteUTC('2026-10-16', '10:00')), nombreFichero);
    assert.notEqual(nombreDeFichero(418, aInstanteUTC('2026-10-16', '11:00')), nombreFichero);
    assert.notEqual(nombreDeFichero(419, aInstanteUTC('2026-10-16', '10:00')), nombreFichero);
    assert.doesNotMatch(nombreFichero, /sofia|núñez|ejemplo|@/i);
  });
});
