// Los importes son céntimos enteros; solo se convierten a euros para mostrarlos (Principio II).
const formatoEuros = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatearEuros(centimos) {
  if (!Number.isInteger(centimos) || centimos < 0) {
    throw new RangeError('El importe debe ser un número entero de céntimos, no negativo');
  }
  return formatoEuros.format(centimos / 100);
}
