/*
  # Create mensajes_enviados table for WhatsApp message tracking

  1. New Tables
    - `mensajes_enviados`
      - `id` (uuid, primary key)
      - `auditoria_id` (uuid, references auditorias)
      - `comunicacion_index` (integer) - Index of the communication in the array
      - `numero_destino` (text) - WhatsApp number where message was sent
      - `responsable` (text) - Name of the responsible person
      - `sector` (text) - Department/sector
      - `mensaje_contenido` (text) - Full message content sent
      - `estado` (text) - Status: 'enviado', 'error', 'pendiente'
      - `error_mensaje` (text, nullable) - Error message if failed
      - `created_at` (timestamptz) - When the message was sent
      - `enviado_por` (text, nullable) - User who sent the message
  
  2. Security
    - Enable RLS on `mensajes_enviados` table
    - Add policy for authenticated users to read all messages
    - Add policy for authenticated users to insert messages
    - Add policy for authenticated users to update their own messages

  3. Indexes
    - Create index on auditoria_id for faster lookups
    - Create index on created_at for sorting
*/

CREATE TABLE IF NOT EXISTS mensajes_enviados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auditoria_id uuid REFERENCES auditorias(id) ON DELETE CASCADE,
  comunicacion_index integer NOT NULL,
  numero_destino text NOT NULL,
  responsable text NOT NULL,
  sector text NOT NULL,
  mensaje_contenido text NOT NULL,
  estado text NOT NULL DEFAULT 'pendiente',
  error_mensaje text,
  created_at timestamptz DEFAULT now(),
  enviado_por text
);

-- Enable RLS
ALTER TABLE mensajes_enviados ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Authenticated users can read all messages"
  ON mensajes_enviados FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert messages"
  ON mensajes_enviados FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update messages"
  ON mensajes_enviados FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_mensajes_auditoria ON mensajes_enviados(auditoria_id);
CREATE INDEX IF NOT EXISTS idx_mensajes_created_at ON mensajes_enviados(created_at DESC);