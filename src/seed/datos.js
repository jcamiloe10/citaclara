// Datos fijos de la clínica de demostración (FR-030, FR-031).
export const SEMILLA = 20260927;

export const CLINICA = {
  nombre: 'Clínica Eleva',
  // Clave de demostración: solo para datos de demostración, nunca para una clínica real.
  clave: 'eleva-demo',
};

export const PROFESIONALES = [
  { clave: 'maria', nombre: 'María', especialidad: 'Fisioterapia', servicios: ['sesionFisio', 'primeraFisio'] },
  { clave: 'jorge', nombre: 'Jorge', especialidad: 'Fisioterapia', servicios: ['sesionFisio', 'primeraFisio'] },
  { clave: 'lucia', nombre: 'Lucía', especialidad: 'Nutrición', servicios: ['consultaNutricion', 'primeraNutricion'] },
];

// Precios en céntimos enteros.
export const SERVICIOS = [
  { clave: 'sesionFisio', nombre: 'Sesión de fisioterapia', duracionMin: 45, precioCentimos: 4000, peso: 80 },
  { clave: 'primeraFisio', nombre: 'Primera visita de fisioterapia', duracionMin: 60, precioCentimos: 5000, peso: 20 },
  { clave: 'consultaNutricion', nombre: 'Consulta de nutrición', duracionMin: 30, precioCentimos: 3500, peso: 75 },
  { clave: 'primeraNutricion', nombre: 'Primera consulta de nutrición', duracionMin: 45, precioCentimos: 4500, peso: 25 },
];

export const NUM_PACIENTES = 40;
export const SEMANAS_HISTORIA = 8;
export const SEMANAS_FUTURO = 2;
export const PROPORCION_NO_ASISTIDA = 0.1;
export const PROPORCION_CANCELADA = 0.08;

export const NOMBRES = [
  'Lucas', 'Sofía', 'Mateo', 'Valeria', 'Daniel', 'Paula', 'Pablo', 'Carmen', 'Álvaro', 'Elena',
  'Hugo', 'Marta', 'Adrián', 'Laura', 'Diego', 'Irene', 'Sergio', 'Claudia', 'Iván', 'Noelia',
];

export const APELLIDOS = [
  'García', 'Fernández', 'González', 'Rodríguez', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martín',
  'Jiménez', 'Ruiz', 'Hernández', 'Díaz', 'Moreno', 'Muñoz', 'Álvarez', 'Romero', 'Alonso', 'Gutiérrez',
  'Navarro', 'Torres', 'Domínguez', 'Vázquez', 'Ramos', 'Gil', 'Ramírez', 'Serrano', 'Blanco', 'Molina',
];
