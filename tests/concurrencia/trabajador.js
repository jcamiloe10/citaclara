// Proceso hijo de las pruebas de concurrencia: abre el mismo fichero de base y ejecuta una operación.
// Recibe un JSON en argv[2]: { ruta, operacion, arranque, ahora, ...parámetros }.
import { abrirBase } from '../../src/db/connection.js';
import { cambiarEstado, crearCita } from '../../src/domain/citas.js';

const p = JSON.parse(process.argv[2]);
const db = abrirBase(p.ruta);
const ahora = () => new Date(p.ahora);

// Barrera: todos los procesos esperan al mismo instante para lanzar la operación a la vez.
while (Date.now() < p.arranque) {
  /* espera activa */
}

let resultado;
if (p.operacion === 'alta') {
  resultado = crearCita(
    db,
    {
      clinicaId: p.clinicaId,
      profesionalId: p.profesionalId,
      servicioId: p.servicioId,
      pacienteId: p.pacienteId,
      inicio: p.inicio,
    },
    ahora,
  );
} else if (p.operacion === 'estado') {
  resultado = cambiarEstado(db, { clinicaId: p.clinicaId, citaId: p.citaId, estado: p.estado }, ahora);
}
console.log(JSON.stringify(resultado));
db.close();
