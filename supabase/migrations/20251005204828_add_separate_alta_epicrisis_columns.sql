/*
  # Separar columnas de Alta Médica y Epicrisis

  ## Descripción
  Esta migración agrega columnas separadas para distinguir entre errores de alta médica
  y errores de epicrisis, reconociendo que son documentos médicos distintos.

  ## Cambios realizados

  1. **Nuevas Columnas**
    - `errores_alta_medica` (integer): Contador de errores específicos del alta médica
    - `errores_epicrisis` (integer): Contador de errores específicos de la epicrisis
  
  2. **Compatibilidad**
    - Se mantiene la columna `errores_alta` existente para compatibilidad con versiones anteriores
    - La columna `errores_alta` puede almacenar la suma de ambos tipos de errores o puede ser deprecada en el futuro

  ## Notas importantes
  - El alta médica y la epicrisis son documentos diferentes y obligatorios
  - El alta médica aparece primero en el documento
  - La epicrisis (resumen de alta) aparece después del alta médica
  - Ambos documentos son responsabilidad del médico cirujano cuando faltan
*/

-- Agregar columna para errores de alta médica
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auditorias' AND column_name = 'errores_alta_medica'
  ) THEN
    ALTER TABLE auditorias ADD COLUMN errores_alta_medica integer DEFAULT 0;
  END IF;
END $$;

-- Agregar columna para errores de epicrisis
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'auditorias' AND column_name = 'errores_epicrisis'
  ) THEN
    ALTER TABLE auditorias ADD COLUMN errores_epicrisis integer DEFAULT 0;
  END IF;
END $$;

-- Crear índice para búsquedas por errores de alta médica
CREATE INDEX IF NOT EXISTS idx_auditorias_errores_alta_medica ON auditorias(errores_alta_medica);

-- Crear índice para búsquedas por errores de epicrisis
CREATE INDEX IF NOT EXISTS idx_auditorias_errores_epicrisis ON auditorias(errores_epicrisis);
