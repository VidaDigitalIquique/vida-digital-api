-- Crear tabla si no existe aún (puede no tener migración previa)
CREATE TABLE IF NOT EXISTS deuda_pagos (
  id             SERIAL PRIMARY KEY,
  deuda_id       INTEGER NOT NULL REFERENCES deudas_solicitudes(id),
  monto          NUMERIC(12,2) NOT NULL,
  registrado_por TEXT NOT NULL,
  fecha_hora     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Agregar columna si la tabla ya existía sin ella
ALTER TABLE deuda_pagos
  ADD COLUMN IF NOT EXISTS fecha_hora TIMESTAMPTZ NOT NULL DEFAULT NOW();
