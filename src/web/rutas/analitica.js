import { Router } from 'express';
import { evolucionSemanal, ingresosPorServicio, ocupacionYNoAsistenciaPorProfesional, periodoAnalizado } from '../../domain/analitica.js';
import { exigirSesion } from '../sesion.js';
import { vistaAnalitica } from '../vistas/analitica.js';

/**
 * GET /analitica: la única ruta de esta feature, estrictamente de lectura (FR-003). No existe
 * ningún POST/PUT/PATCH/DELETE bajo /analitica (contracts/panel-analitica.md).
 */
export function rutasAnalitica({ dbSoloLectura, ahora }) {
  const r = Router();

  r.get('/analitica', exigirSesion, (req, res) => {
    const { clinicaId } = req.sesion;
    const porProfesional = ocupacionYNoAsistenciaPorProfesional(dbSoloLectura, clinicaId, ahora);
    const porServicio = ingresosPorServicio(dbSoloLectura, clinicaId, ahora);
    const evolucion = evolucionSemanal(dbSoloLectura, clinicaId, ahora);
    const periodo = periodoAnalizado(ahora);
    res
      .status(200)
      .type('html')
      .send(vistaAnalitica({ sesion: req.sesion, porProfesional, porServicio, evolucion, periodo }));
  });

  return r;
}
