/*
  # Agregar columna habitación a auditorías

  1. Cambios
    - Se agrega la columna `habitacion` a la tabla `auditorias`
    - Tipo: text
    - Valor por defecto: 'No encontrada'
    - Permite null: true
    
  2. Descripción
    - Este campo almacenará la información de la habitación donde está internado el paciente
    - Ejemplo: "BOX 2-B2", "Habitación 305", etc.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auditorias' AND column_name = 'habitacion'
  ) THEN
    ALTER TABLE auditorias ADD COLUMN habitacion text DEFAULT 'No encontrada';
  END IF;
END $$;