import { config } from './config.js';
import { abrirBase, abrirBaseSoloLectura } from './db/connection.js';
import { crearApp } from './app.js';

const db = abrirBase(config.rutaBase);
const dbSoloLectura = abrirBaseSoloLectura(config.rutaBase);
const { total } = db.prepare('SELECT COUNT(*) AS total FROM clinica').get();
if (total === 0) {
  console.warn('Aún no hay ninguna clínica. Carga los datos de demostración con: npm run seed');
}

const app = crearApp({ db, dbSoloLectura, secreto: config.secreto });
app.listen(config.puerto, () => {
  console.log(`CitaClara escuchando en http://localhost:${config.puerto}`);
});
