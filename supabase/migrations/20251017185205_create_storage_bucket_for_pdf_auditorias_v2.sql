/*
  # Crear bucket de Storage para PDFs de auditorías

  ## Descripción
  Esta migración crea un bucket público en Supabase Storage para almacenar
  los PDFs generados de cada auditoría médica.

  ## Cambios
  1. Crear bucket `pdf-auditorias` con acceso público
  2. Configurar políticas de acceso:
     - Lectura pública (cualquiera puede descargar)
     - Escritura solo para usuarios autenticados

  ## Notas
  - Los PDFs serán accesibles públicamente mediante URL
  - Solo usuarios autenticados pueden subir archivos
*/

-- Crear bucket para PDFs de auditorías
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pdf-auditorias',
  'pdf-auditorias',
  true,
  10485760,
  ARRAY['application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Eliminar políticas existentes si existen
DROP POLICY IF EXISTS "Acceso público para lectura de PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados pueden subir PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados pueden actualizar PDFs" ON storage.objects;
DROP POLICY IF EXISTS "Usuarios autenticados pueden eliminar PDFs" ON storage.objects;

-- Política para permitir lectura pública de PDFs
CREATE POLICY "Acceso público para lectura de PDFs"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'pdf-auditorias');

-- Política para permitir subida de PDFs a usuarios autenticados
CREATE POLICY "Usuarios autenticados pueden subir PDFs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'pdf-auditorias');

-- Política para permitir actualización de PDFs a usuarios autenticados
CREATE POLICY "Usuarios autenticados pueden actualizar PDFs"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'pdf-auditorias')
WITH CHECK (bucket_id = 'pdf-auditorias');

-- Política para permitir eliminación de PDFs a usuarios autenticados
CREATE POLICY "Usuarios autenticados pueden eliminar PDFs"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'pdf-auditorias');
