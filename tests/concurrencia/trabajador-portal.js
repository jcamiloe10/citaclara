// Proceso hijo de las pruebas de concurrencia de la 002: abre el mismo fichero de base y ejecuta una
// operación del portal, de recepción o un alta. Recibe un JSON en argv[2].
import { abrirBase } from '../../src/db/connection.js';
import { cambiarEstado, crearCita } from '../../src/domain/citas.js';
import { cancelarComoPaciente } from '../../src/domain/portal.js';

const p = JSON.parse(process.argv[2]);
const db = abrirBase(p.ruta);
const ahora = () => new Date(p.ahora);

// Barrera: todos los procesos esperan al mismo instante para lanzar la operación a la vez.
while (Date.now() < p.arranque) {
  /* espera activa */
}

let resultado;
if (p.operacion === 'cancelar-paciente') {
  resultado = cancelarComoPaciente(db, { clinicaId: p.clinicaId, pacienteId: p.pacienteId, citaId: p.citaId }, ahora);
} else if (p.operacion === 'estado') {
  resultado = cambiarEstado(db, { clinicaId: p.clinicaId, citaId: p.citaId, estado: p.estado }, ahora);
} else if (p.operacion === 'alta') {
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
}
console.log(JSON.stringify(resultado));
db.close();
