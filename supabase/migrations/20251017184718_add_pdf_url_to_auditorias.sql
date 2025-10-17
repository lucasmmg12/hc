/*
  # Agregar campo para almacenar URL del PDF generado

  ## Descripción
  Esta migración agrega un campo para almacenar la URL del PDF de auditoría generado,
  así como un campo para registrar cuándo fue actualizado por última vez el registro.

  ## Cambios
  1. Nueva Columna en `auditorias`:
    - `pdf_url` (text): URL del PDF generado y almacenado en Supabase Storage
    - `updated_at` (timestamptz): Fecha y hora de última actualización del registro
  
  2. Índice:
    - Índice en `updated_at` para optimizar consultas ordenadas por actualización

  ## Notas
  - El campo pdf_url es nullable porque auditorías existentes no tienen PDF
  - Se agrega trigger para actualizar automáticamente updated_at
*/

-- Agregar campo para URL del PDF generado
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auditorias' AND column_name = 'pdf_url'
  ) THEN
    ALTER TABLE auditorias ADD COLUMN pdf_url text;
  END IF;
END $$;

-- Agregar campo para fecha de última actualización
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auditorias' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE auditorias ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;

-- Crear índice para optimizar búsquedas por última actualización
CREATE INDEX IF NOT EXISTS idx_auditorias_updated_at ON auditorias(updated_at DESC);

-- Crear función para actualizar updated_at automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Crear trigger para actualizar updated_at en cada UPDATE
DROP TRIGGER IF EXISTS update_auditorias_updated_at ON auditorias;
CREATE TRIGGER update_auditorias_updated_at
  BEFORE UPDATE ON auditorias
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
