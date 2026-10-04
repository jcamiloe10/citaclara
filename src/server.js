import { config } from './config.js';
import { abrirBase } from './db/connection.js';
import { crearApp } from './app.js';

const db = abrirBase(config.rutaBase);
const { total } = db.prepare('SELECT COUNT(*) AS total FROM clinica').get();
if (total === 0) {
  console.warn('Aún no hay ninguna clínica. Carga los datos de demostración con: npm run seed');
}

const app = crearApp({ db, secreto: config.secreto });
app.listen(config.puerto, () => {
  console.log(`CitaClara escuchando en http://localhost:${config.puerto}`);
});
