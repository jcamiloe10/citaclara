CREATE TABLE IF NOT EXISTS clinica (
  id INTEGER PRIMARY KEY,
  nombre TEXT NOT NULL CHECK (length(trim(nombre)) > 0),
  clave_hash TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profesional (
  id INTEGER PRIMARY KEY,
  clinica_id INTEGER NOT NULL REFERENCES clinica(id),
  nombre TEXT NOT NULL CHECK (length(trim(nombre)) > 0),
  especialidad TEXT NOT NULL CHECK (length(trim(especialidad)) > 0)
);

CREATE TABLE IF NOT EXISTS servicio (
  id INTEGER PRIMARY KEY,
  clinica_id INTEGER NOT NULL REFERENCES clinica(id),
  nombre TEXT NOT NULL CHECK (length(trim(nombre)) > 0),
  duracion_min INTEGER NOT NULL CHECK (duracion_min > 0),
  precio_centimos INTEGER NOT NULL CHECK (precio_centimos >= 0)
);

CREATE TABLE IF NOT EXISTS paciente (
  id INTEGER PRIMARY KEY,
  clinica_id INTEGER NOT NULL REFERENCES clinica(id),
  nombre TEXT NOT NULL CHECK (length(trim(nombre)) > 0),
  telefono TEXT NOT NULL,
  email TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS cita (
  id INTEGER PRIMARY KEY,
  clinica_id INTEGER NOT NULL REFERENCES clinica(id),
  profesional_id INTEGER NOT NULL REFERENCES profesional(id),
  servicio_id INTEGER NOT NULL REFERENCES servicio(id),
  paciente_id INTEGER NOT NULL REFERENCES paciente(id),
  inicio TEXT NOT NULL,
  fin TEXT NOT NULL,
  estado TEXT NOT NULL DEFAULT 'reservada'
    CHECK (estado IN ('reservada', 'completada', 'cancelada', 'no_asistida')),
  CHECK (fin > inicio)
);

CREATE INDEX IF NOT EXISTS cita_profesional_inicio ON cita (clinica_id, profesional_id, inicio);
CREATE INDEX IF NOT EXISTS cita_inicio ON cita (clinica_id, inicio);
CREATE INDEX IF NOT EXISTS paciente_nombre ON paciente (clinica_id, nombre);

-- Segunda defensa del Principio III: la propia base rechaza cualquier solape
-- entre citas reservadas o completadas del mismo profesional (intervalos [inicio, fin)).
CREATE TRIGGER IF NOT EXISTS cita_sin_solape_alta
BEFORE INSERT ON cita
WHEN NEW.estado IN ('reservada', 'completada')
BEGIN
  SELECT RAISE(ABORT, 'solape')
  WHERE EXISTS (
    SELECT 1 FROM cita c
    WHERE c.profesional_id = NEW.profesional_id
      AND c.estado IN ('reservada', 'completada')
      AND c.inicio < NEW.fin
      AND NEW.inicio < c.fin
  );
END;

CREATE TRIGGER IF NOT EXISTS cita_sin_solape_cambio
BEFORE UPDATE ON cita
WHEN NEW.estado IN ('reservada', 'completada')
BEGIN
  SELECT RAISE(ABORT, 'solape')
  WHERE EXISTS (
    SELECT 1 FROM cita c
    WHERE c.id <> NEW.id
      AND c.profesional_id = NEW.profesional_id
      AND c.estado IN ('reservada', 'completada')
      AND c.inicio < NEW.fin
      AND NEW.inicio < c.fin
  );
END;
