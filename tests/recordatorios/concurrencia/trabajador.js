// Proceso hijo de las pruebas de concurrencia de la 003: abre el mismo fichero de base y ejecuta una
// operación de recordatorios. Recibe un JSON en argv[2]. No entra en el glob de `npm test`.
import { escribirSimulado } from '../../../src/correo/salida-simulada.js';
import { abrirBase } from '../../../src/db/connection.js';
import { cambiarEstado, crearCita } from '../../../src/domain/citas.js';
import { cancelarPorEnlace, generarRecordatorios } from '../../../src/domain/recordatorios.js';

const p = JSON.parse(process.argv[2]);
const db = abrirBase(p.ruta);
const ahora = () => new Date(p.ahora);

// Barrera: todos los procesos esperan al mismo instante para lanzar la operación a la vez.
while (Date.now() < p.arranque) {
  /* espera activa */
}

let resultado;
try {
  if (p.operacion === 'generar') {
    resultado = generarRecordatorios(db, {
      ahora,
      salida: (nombre, contenido) => escribirSimulado(p.carpeta, nombre, contenido),
      urlPublica: 'http://localhost:3000',
      remitente: 'no-responder@citaclara.invalid',
    });
  } else if (p.operacion === 'cancelar-enlace') {
    resultado = cancelarPorEnlace(db, p.secreto, ahora);
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
} catch (error) {
  resultado = { error: String(error?.message ?? error) };
}
console.log(JSON.stringify(resultado));
db.close();
