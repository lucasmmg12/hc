import { createClient } from '@supabase/supabase-js';

interface DatosPaciente {
  nombre?: string;
  dni?: string;
  obra_social?: string;
}

interface Comunicacion {
  sector: string;
  responsable: string;
  motivo: string;
  urgencia: string;
  errores: string[];
  mensaje: string;
  matricula?: string;
}

interface EnviarWhatsAppParams {
  comunicacion: Comunicacion;
  datosPaciente: DatosPaciente;
  nombreArchivo: string;
  auditoriaId?: string;
  comunicacionIndex: number;
  numeroDestino: string;
}

interface EnviarWhatsAppResponse {
  success: boolean;
  mensaje?: string;
  error?: string;
  yaEnviado?: boolean;
  builderbotResponse?: any;
}

function construirMensajeWhatsApp(
  comunicacion: Comunicacion,
  datosPaciente: DatosPaciente,
  nombreArchivo: string
): string {
  const urgenciaEmoji = comunicacion.urgencia === 'CRÍTICA' ? '🚨' : '⚠️';

  let mensaje = `${urgenciaEmoji} *NOTIFICACIÓN MÉDICA* ${urgenciaEmoji}\n\n`;
  mensaje += `🏥 *Sector:* ${comunicacion.sector}\n`;
  mensaje += `👤 *Responsable:* ${comunicacion.responsable}\n`;
  mensaje += `⚠️ *Urgencia:* ${comunicacion.urgencia}\n\n`;
  mensaje += `📄 *Motivo:* ${comunicacion.motivo}\n\n`;
  mensaje += `🧍‍♀️ *Paciente:* ${datosPaciente.nombre || 'No encontrado'}\n`;
  mensaje += `🪪 *DNI:* ${datosPaciente.dni || 'No encontrado'}\n`;
  mensaje += `🏥 *Obra Social:* ${datosPaciente.obra_social || 'No encontrada'}\n`;
  mensaje += `📁 *Archivo:* ${nombreArchivo}\n\n`;

  if (comunicacion.errores && comunicacion.errores.length > 0) {
    comunicacion.errores.forEach((error) => {
      mensaje += `❌ *Error:* ${error}\n`;
    });
    mensaje += `\n`;
  }

  mensaje += `🩺 *Acción:* Completar correcciones antes del envío a OSDE para evitar débitos.\n\n`;
  mensaje += `🤖 Grow Labs - Sanatorio Argentino`;

  return mensaje;
}

export async function enviarMensajeWhatsApp(
  params: EnviarWhatsAppParams
): Promise<EnviarWhatsAppResponse> {
  try {
    const numeroDestinoLimpio = params.numeroDestino.replace(/\D/g, '');
    const timestamp = new Date().toISOString();
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[${timestamp}] FRONTEND: INICIANDO ENVIO WHATSAPP`);
    console.log(`${'='.repeat(80)}`);

    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    console.log('[FRONTEND-CONFIG] Supabase URL:', supabaseUrl);
    console.log('[FRONTEND-CONFIG] Tiene Supabase Key:', !!supabaseAnonKey);

    if (!supabaseUrl || !supabaseAnonKey) {
      console.error('[FRONTEND-ERROR] ❌ Faltan credenciales de Supabase');
      throw new Error('Configuración de Supabase no encontrada');
    }

    console.log('\n[FRONTEND-DATOS] Datos a enviar:');
    console.log('[FRONTEND-DATOS] Auditoria ID:', params.auditoriaId);
    console.log('[FRONTEND-DATOS] Comunicacion Index:', params.comunicacionIndex);
    console.log('[FRONTEND-DATOS] Nombre Archivo:', params.nombreArchivo);
    console.log('[FRONTEND-DATOS] Número destino:', numeroDestinoLimpio);
    console.log('[FRONTEND-DATOS] Comunicacion:', JSON.stringify(params.comunicacion, null, 2));
    console.log('[FRONTEND-DATOS] Datos Paciente:', JSON.stringify(params.datosPaciente, null, 2));

    const payload = {
      comunicacion: params.comunicacion,
      datosPaciente: params.datosPaciente,
      nombreArchivo: params.nombreArchivo,
      auditoriaId: params.auditoriaId,
      comunicacionIndex: params.comunicacionIndex,
      numeroDestino: numeroDestinoLimpio
    };

    console.log('\n[FRONTEND-PAYLOAD] Payload completo a enviar:');
    console.log(JSON.stringify(payload, null, 2));

    const edgeFunctionUrl = `${supabaseUrl}/functions/v1/enviar-whatsapp`;
    console.log('\n[FRONTEND-REQUEST] URL Edge Function:', edgeFunctionUrl);

    console.log('[FRONTEND-REQUEST] Enviando request...');
    const response = await fetch(edgeFunctionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'apikey': supabaseAnonKey
      },
      body: JSON.stringify(payload)
    });

    console.log('\n[FRONTEND-RESPONSE] Respuesta recibida de Edge Function');
    console.log('[FRONTEND-RESPONSE] Status HTTP:', response.status);
    console.log('[FRONTEND-RESPONSE] Status Text:', response.statusText);
    console.log('[FRONTEND-RESPONSE] Headers:', Object.fromEntries(response.headers.entries()));

    const responseText = await response.text();
    console.log('[FRONTEND-RESPONSE] Response body (raw):');
    console.log('--- INICIO RESPONSE ---');
    console.log(responseText);
    console.log('--- FIN RESPONSE ---');

    if (!response.ok) {
      console.error('\n[FRONTEND-ERROR] ❌ Error en Edge Function');
      console.error('[FRONTEND-ERROR] Status:', response.status);
      console.error('[FRONTEND-ERROR] Status Text:', response.statusText);
      console.error('[FRONTEND-ERROR] Body:', responseText);

      let errorData;
      try {
        errorData = JSON.parse(responseText);
        console.error('[FRONTEND-ERROR] Error parseado:', JSON.stringify(errorData, null, 2));
      } catch (e) {
        console.error('[FRONTEND-ERROR] No se pudo parsear el error como JSON');
        errorData = { error: responseText };
      }

      return {
        success: false,
        error: errorData.error || `Error ${response.status}: ${response.statusText}`,
        yaEnviado: errorData.yaEnviado
      };
    }

    let result;
    try {
      result = JSON.parse(responseText);
      console.log('\n[FRONTEND-SUCCESS] ✅ Respuesta exitosa');
      console.log('[FRONTEND-SUCCESS] Resultado parseado:', JSON.stringify(result, null, 2));
    } catch (e) {
      console.error('\n[FRONTEND-ERROR] ❌ Error parseando respuesta:', e);
      return {
        success: false,
        error: 'Respuesta inválida del servidor'
      };
    }

    return {
      success: true,
      mensaje: result.mensaje || 'Mensaje enviado exitosamente',
      builderbotResponse: result.builderbotResponse
    };

  } catch (error) {
    const timestamp = new Date().toISOString();
    console.error(`\n${'='.repeat(80)}`);
    console.error(`[${timestamp}] FRONTEND: ERROR CRÍTICO`);
    console.error(`${'='.repeat(80)}`);
    console.error('[FRONTEND-EXCEPTION] Error completo:', error);
    console.error('[FRONTEND-EXCEPTION] Error type:', error?.constructor?.name);
    console.error('[FRONTEND-EXCEPTION] Error message:', error?.message);
    console.error('[FRONTEND-EXCEPTION] Error stack:', error?.stack);

    if (error instanceof TypeError && error.message.includes('fetch')) {
      console.error('[FRONTEND-EXCEPTION] Tipo: Error de conexión/fetch');
      return {
        success: false,
        error: 'Error de conexión. Verifica tu conexión a internet.',
      };
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al enviar mensaje',
    };
  }
}

export async function verificarMensajeEnviado(
  auditoriaId: string,
  comunicacionIndex: number
): Promise<boolean> {
  try {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    const response = await fetch(
      `${supabaseUrl}/rest/v1/mensajes_enviados?auditoria_id=eq.${auditoriaId}&comunicacion_index=eq.${comunicacionIndex}&estado=eq.enviado&select=id`,
      {
        headers: {
          'apikey': supabaseAnonKey,
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
      }
    );

    if (!response.ok) {
      return false;
    }

    const data = await response.json();
    return data && data.length > 0;
  } catch (error) {
    console.error('Error verificando mensaje enviado:', error);
    return false;
  }
}
