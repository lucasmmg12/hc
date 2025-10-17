import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export async function uploadPDFToStorage(
  pdfBlob: Blob,
  nombrePaciente: string
): Promise<{ success: boolean; url?: string; error?: string }> {
  try {
    const timestamp = new Date().getTime();
    const sanitizedNombre = nombrePaciente.replace(/[^a-zA-Z0-9]/g, '_');
    const fileName = `auditoria_${sanitizedNombre}_${timestamp}.pdf`;
    const filePath = `auditorias/${fileName}`;

    const { data, error } = await supabase.storage
      .from('pdf-auditorias')
      .upload(filePath, pdfBlob, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: false,
      });

    if (error) {
      console.error('Error uploading PDF to storage:', error);
      return { success: false, error: error.message };
    }

    const { data: publicUrlData } = supabase.storage
      .from('pdf-auditorias')
      .getPublicUrl(filePath);

    return {
      success: true,
      url: publicUrlData.publicUrl,
    };
  } catch (error) {
    console.error('Error in uploadPDFToStorage:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function updateAuditoriaPDFUrl(
  auditoriaId: string,
  pdfUrl: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase
      .from('auditorias')
      .update({ pdf_url: pdfUrl })
      .eq('id', auditoriaId);

    if (error) {
      console.error('Error updating auditoria PDF URL:', error);
      return { success: false, error: error.message };
    }

    return { success: true };
  } catch (error) {
    console.error('Error in updateAuditoriaPDFUrl:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function downloadPDFFromStorage(pdfUrl: string): Promise<void> {
  try {
    const response = await fetch(pdfUrl);
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = pdfUrl.split('/').pop() || 'auditoria.pdf';
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
  } catch (error) {
    console.error('Error downloading PDF from storage:', error);
    throw error;
  }
}
