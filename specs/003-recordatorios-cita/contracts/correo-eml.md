# Contrato: fichero `.eml` del recordatorio

Cada recordatorio generado es un fichero de correo en la carpeta de salida (`datos/salida-correo/` por defecto), legible por cualquier cliente de correo (FR-019, SC-009).

## Nombre del fichero

`cita-<id>-<AAAAMMDD>T<HHMM>Z.eml`, con el id de la cita y su hora de inicio en UTC (por ejemplo `cita-418-20261019T0700Z.eml`). Es estable y único por cita y hora de inicio (FR-020): regenerarlo sobrescribe el mismo fichero y una cita movida a otra hora da un fichero distinto. No contiene nombres, emails ni datos de salud. Se escribe de forma atómica (fichero temporal y renombrado), así que nunca queda un `.eml` a medias.

## Cabeceras

| Cabecera | Valor |
|---|---|
| `From` | Nombre de la clínica (codificado según RFC 2047) y la dirección del remitente configurada. |
| `To` | Email del paciente de la cita. |
| `Subject` | `Recordatorio de tu cita en <clínica>: <día largo>, <hora>` (codificado según RFC 2047). |
| `Date` | Instante de generación (formato RFC 5322). |
| `Message-ID` | `<recordatorio-<id de cita>-<hora de inicio compacta>@citaclara.invalid>` (estable por cita y hora). |
| `MIME-Version` | `1.0` |
| `Content-Type` | `text/plain; charset=utf-8` |
| `Content-Transfer-Encoding` | `base64` |
| `X-CitaClara-Modo` | `simulado` (marca explícita de que no es un envío real, FR-021). |

## Cuerpo (texto, antes de codificar)

```text
Hola, <nombre del paciente>:

Te recordamos tu cita en <clínica>.

  Día y hora: <día largo>, <hh:mm> (hora de España)
  Profesional: <profesional>
  Servicio: <servicio>

Si no vas a poder venir, avísanos para que otra persona pueda usar tu hueco.
Puedes cancelar la cita hasta 24 horas antes desde este enlace:

<url pública>/cancelar/<token>

Si te quedan menos de 24 horas o necesitas cambiar la cita, llama a la clínica: <teléfono>.

Gracias,
<clínica>
```

Ejemplo de la fecha: `viernes 16 de octubre de 2026, 10:00 (hora de España)`.

## Reglas

- Español de España y sin jerga técnica (Principios VII y VIII); fecha y hora con las funciones de `src/domain/tiempo.js`.
- Si la clínica no tiene teléfono, la última frase queda como "llama a la clínica".
- El cuerpo solo incluye lo necesario para identificar la cita; ningún dato clínico (Assumptions de la spec).
- El enlace lleva el token en claro, único dato secreto del mensaje; no se guarda en la base (data-model R5).
- Los textos viven en `src/correo/textos.js`; ni el nombre del paciente ni ningún otro dato se inserta sin sanear las cabeceras (saltos de línea eliminados) para evitar inyección de cabeceras.
