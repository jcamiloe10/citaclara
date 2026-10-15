// Textos del email de recordatorio (003). Español de España, sin jerga técnica (Principios VII y VIII).
// Es el único sitio donde viven; el resto del módulo de correo solo los compone.
export const textosCorreo = {
  asunto: (clinica, cuando) => `Recordatorio de tu cita en ${clinica}: ${cuando}`,
  saludo: (nombre) => `Hola, ${nombre}:`,
  intro: (clinica) => `Te recordamos tu cita en ${clinica}.`,
  etiquetas: { cuando: 'Día y hora', profesional: 'Profesional', servicio: 'Servicio' },
  horaDeEspana: '(hora de España)',
  avisoCancelar: [
    'Si no vas a poder venir, avísanos para que otra persona pueda usar tu hueco.',
    'Puedes cancelar la cita hasta 24 horas antes desde este enlace:',
  ],
  contacto: (telefono) =>
    telefono
      ? `Si te quedan menos de 24 horas o necesitas cambiar la cita, llama a la clínica: ${telefono}.`
      : 'Si te quedan menos de 24 horas o necesitas cambiar la cita, llama a la clínica.',
  despedida: 'Gracias,',
};
