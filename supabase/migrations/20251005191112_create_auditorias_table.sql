/*
  # Sistema de Auditoría Médica - Base de Datos

  ## Descripción
  Este migration crea la estructura de base de datos para el sistema de auditoría médica
  del Sanatorio Argentino. Permite guardar historial completo de auditorías realizadas.

  ## Nuevas Tablas

  ### `auditorias`
  Tabla principal que almacena cada auditoría realizada sobre historias clínicas en PDF.
  
  **Columnas:**
  - `id` (uuid, PK): Identificador único de la auditoría
  - `created_at` (timestamptz): Fecha y hora de creación de la auditoría
  - `nombre_archivo` (text): Nombre del archivo PDF auditado
  - `nombre_paciente` (text): Nombre completo del paciente
  - `dni_paciente` (text): DNI del paciente
  - `obra_social` (text): Obra social del paciente
  - `fecha_ingreso` (timestamptz): Fecha de ingreso del paciente
  - `fecha_alta` (timestamptz): Fecha de alta del paciente
  - `total_errores` (integer): Cantidad total de errores detectados
  - `errores_admision` (integer): Cantidad de errores de admisión
  - `errores_evoluciones` (integer): Cantidad de errores en evoluciones médicas
  - `errores_foja_quirurgica` (integer): Cantidad de errores en foja quirúrgica
  - `errores_alta` (integer): Cantidad de errores en alta/epicrisis
  - `bisturi_armonico` (text): SI/NO/No determinado - uso de bisturí armónico
  - `estado` (text): Estado de la auditoría (Pendiente/Aprobado/En Revisión)
  - `errores_detalle` (jsonb): Array JSON con detalle de todos los errores
  - `comunicaciones` (jsonb): Array JSON con todas las comunicaciones generadas
  - `datos_adicionales` (jsonb): Información adicional (equipo médico, estudios, etc.)

  ## Seguridad
  - RLS habilitado en todas las tablas
  - Políticas restrictivas: solo usuarios autenticados pueden leer/escribir
  - Los datos médicos son sensibles y requieren autenticación
*/

-- Crear tabla de auditorías
CREATE TABLE IF NOT EXISTS auditorias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  nombre_archivo text NOT NULL,
  nombre_paciente text DEFAULT 'No encontrado',
  dni_paciente text DEFAULT 'No encontrado',
  obra_social text DEFAULT 'No encontrada',
  fecha_ingreso timestamptz,
  fecha_alta timestamptz,
  total_errores integer DEFAULT 0,
  errores_admision integer DEFAULT 0,
  errores_evoluciones integer DEFAULT 0,
  errores_foja_quirurgica integer DEFAULT 0,
  errores_alta integer DEFAULT 0,
  bisturi_armonico text DEFAULT 'No determinado',
  estado text DEFAULT 'En Revisión',
  errores_detalle jsonb DEFAULT '[]'::jsonb,
  comunicaciones jsonb DEFAULT '[]'::jsonb,
  datos_adicionales jsonb DEFAULT '{}'::jsonb
);

-- Habilitar RLS
ALTER TABLE auditorias ENABLE ROW LEVEL SECURITY;

-- Política para SELECT: usuarios autenticados pueden ver todas las auditorías
CREATE POLICY "Usuarios autenticados pueden ver auditorías"
  ON auditorias
  FOR SELECT
  TO authenticated
  USING (true);

-- Política para INSERT: usuarios autenticados pueden crear auditorías
CREATE POLICY "Usuarios autenticados pueden crear auditorías"
  ON auditorias
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Política para UPDATE: usuarios autenticados pueden actualizar auditorías
CREATE POLICY "Usuarios autenticados pueden actualizar auditorías"
  ON auditorias
  FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Política para DELETE: usuarios autenticados pueden eliminar auditorías
CREATE POLICY "Usuarios autenticados pueden eliminar auditorías"
  ON auditorias
  FOR DELETE
  TO authenticated
  USING (true);

-- Crear índices para mejorar performance en búsquedas comunes
CREATE INDEX IF NOT EXISTS idx_auditorias_created_at ON auditorias(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auditorias_nombre_paciente ON auditorias(nombre_paciente);
CREATE INDEX IF NOT EXISTS idx_auditorias_dni_paciente ON auditorias(dni_paciente);
CREATE INDEX IF NOT EXISTS idx_auditorias_estado ON auditorias(estado);
CREATE INDEX IF NOT EXISTS idx_auditorias_bisturi_armonico ON auditorias(bisturi_armonico);
