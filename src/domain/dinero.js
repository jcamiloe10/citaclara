// Los importes son céntimos enteros; solo se convierten a euros para mostrarlos (Principio II).
// `useGrouping: 'always'` evita que Node, con su `useGrouping` por defecto ('auto'), muestre
// "3400,00 €" sin separador de millares (solo agrupa a partir de 5 cifras): 001-agenda-core
// nunca lo notó porque sus precios no llegan a 1.000 €, pero los ingresos agregados de
// 004-citaclara-analitica sí (p. ej. 3.400,00 €), y la Constitución exige importes sin
// ambigüedad y consistentes en toda la aplicación (Principio II).
const formatoEuros = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: 'always',
});

export function formatearEuros(centimos) {
  if (!Number.isInteger(centimos) || centimos < 0) {
    throw new RangeError('El importe debe ser un número entero de céntimos, no negativo');
  }
  return formatoEuros.format(centimos / 100);
}
