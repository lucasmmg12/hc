import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface DatosPaciente {
  nombre?: string;
  dni?: string;
  obra_social?: string;
}

interface ComunicacionData {
  sector: string;
  responsable: string;
  motivo: string;
  urgencia: string;
  errores: string[];
  mensaje: string;
  matricula?: string;
}

interface EnviarWhatsAppRequest {
  comunicacion: ComunicacionData;
  datosPaciente: DatosPaciente;
  nombreArchivo: string;
  auditoriaId?: string;
  comunicacionIndex: number;
  numeroDestino: string;
}

function construirMensajeWhatsApp(
  comunicacion: ComunicacionData,
  datosPaciente: DatosPaciente,
  nombreArchivo: string
): string {
  let mensaje = `🩺 *PRUEBA: NOTIFICACIÓN MÉDICA - Sistema de Auditoría*\n\n`;
  mensaje += `🏥 *Sector:* ${comunicacion.sector}\n`;
  mensaje += `👤 *Responsable:* ${comunicacion.responsable}\n`;
  mensaje += `⚠️ *Urgencia:* ${comunicacion.urgencia}\n\n`;
  mensaje += `📄 *Motivo:* ${comunicacion.motivo}\n\n`;
  mensaje += `🧍‍♂️ *Paciente:* ${datosPaciente.nombre || 'No encontrado'}\n`;
  mensaje += `🪪 *DNI:* ${datosPaciente.dni || 'No encontrado'}\n`;
  mensaje += `🏥 *Obra Social:* ${datosPaciente.obra_social || 'No encontrada'}\n`;
  mensaje += `📁 *Archivo:* ${nombreArchivo}\n\n`;

  if (comunicacion.errores && comunicacion.errores.length > 0) {
    mensaje += `❌ *Errores detectados:*\n`;
    comunicacion.errores.forEach((error, index) => {
      const numeroEmoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'][index] || `${index + 1}️⃣`;
      mensaje += `${numeroEmoji} ${error}\n`;
    });
    mensaje += `\n`;
  }

  mensaje += `🩺 *Acción:* Completar correcciones antes del envío a OSDE para evitar débitos.\n\n`;
  mensaje += `🤖 Grow Labs - Sanatorio Argentino`;

  return mensaje;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const timestamp = new Date().toISOString();
    console.log(`\n${'='.repeat(80)}`);
    console.log(`[${timestamp}] === INICIO DE SOLICITUD ENVIAR-WHATSAPP ===`);
    console.log(`${'='.repeat(80)}`);
    console.log('[VALIDACION] Method:', req.method);
    console.log('[VALIDACION] Headers:', Object.fromEntries(req.headers.entries()));

    const requestData: EnviarWhatsAppRequest = await req.json();
    console.log('[VALIDACION] Request data recibido:', {
      tieneComunicacion: !!requestData.comunicacion,
      tieneDatosPaciente: !!requestData.datosPaciente,
      nombreArchivo: requestData.nombreArchivo,
      auditoriaId: requestData.auditoriaId,
      comunicacionIndex: requestData.comunicacionIndex
    });
    console.log('[VALIDACION] Comunicacion completa:', JSON.stringify(requestData.comunicacion, null, 2));
    console.log('[VALIDACION] Datos paciente completos:', JSON.stringify(requestData.datosPaciente, null, 2));
    
    const {
      comunicacion,
      datosPaciente,
      nombreArchivo,
      auditoriaId,
      comunicacionIndex,
      numeroDestino
    } = requestData;

    const numeroDestinoLimpio = numeroDestino?.replace(/\D/g, '') ?? '';
    const formatoNumero = /^549\d{8,11}$/;

    if (!comunicacion || !datosPaciente || !nombreArchivo || !numeroDestinoLimpio) {
      console.error('Faltan datos requeridos:', {
        tieneComunicacion: !!comunicacion,
        tieneDatosPaciente: !!datosPaciente,
        tieneNombreArchivo: !!nombreArchivo,
        tieneNumeroDestino: !!numeroDestinoLimpio
      });
      return new Response(
        JSON.stringify({ error: 'Faltan datos requeridos' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!formatoNumero.test(numeroDestinoLimpio)) {
      console.error('Número destino con formato inválido:', numeroDestino);
      return new Response(
        JSON.stringify({
          error: 'Formato de número inválido. Usa 549 + código de área + número sin signos.'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[VALIDACION] Número destino (limpio):', numeroDestinoLimpio);

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseKey) {
      console.error('Faltan variables de entorno de Supabase');
      return new Response(
        JSON.stringify({ error: 'Error de configuración del servidor' }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('Creando cliente de Supabase...');
    const supabase = createClient(supabaseUrl, supabaseKey);

    if (auditoriaId && comunicacionIndex !== undefined) {
      console.log('Verificando si el mensaje ya fue enviado...');
      const { data: existingMessage, error: checkError } = await supabase
        .from('mensajes_enviados')
        .select('id, estado')
        .eq('auditoria_id', auditoriaId)
        .eq('comunicacion_index', comunicacionIndex)
        .eq('estado', 'enviado')
        .maybeSingle();

      if (checkError) {
        console.error('Error verificando mensaje existente:', checkError);
      }

      if (existingMessage) {
        console.log('Mensaje ya fue enviado anteriormente');
        return new Response(
          JSON.stringify({
            error: 'Este mensaje ya fue enviado anteriormente',
            yaEnviado: true
          }),
          {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          }
        );
      }
      console.log('Mensaje no enviado previamente, continuando...');
    }

    console.log('\n[CONSTRUCCION] Construyendo mensaje de WhatsApp...');
    const mensajeWhatsApp = construirMensajeWhatsApp(comunicacion, datosPaciente, nombreArchivo);
    console.log('[CONSTRUCCION] Mensaje completo construido:');
    console.log('--- INICIO MENSAJE ---');
    console.log(mensajeWhatsApp);
    console.log('--- FIN MENSAJE ---');
    console.log(`[CONSTRUCCION] Longitud del mensaje: ${mensajeWhatsApp.length} caracteres`);

    const BUILDERBOT_API_URL = 'https://app.builderbot.cloud/api/v2/c3fd918b-b736-40dc-a841-cbb73d3b2a8d/messages';
    const BUILDERBOT_API_KEY = 'bb-3c45fa69-2776-4275-82b6-2d6df9e08ec6';
    const MEDIA_URL = 'https://i.imgur.com/X2903s6.png';

    const builderbotPayload = {
      messages: {
        content: mensajeWhatsApp,
        mediaUrl: MEDIA_URL
      },
      number: numeroDestinoLimpio,
      checkIfExists: false
    };

    console.log('\n[ENVIO] Preparando envío a Builderbot...');
    console.log('[ENVIO] URL:', BUILDERBOT_API_URL);
    console.log('[ENVIO] Número destino:', numeroDestinoLimpio);
    console.log('[ENVIO] Media URL:', MEDIA_URL);
    console.log('[ENVIO] API Key (primeros 10 chars):', BUILDERBOT_API_KEY.substring(0, 10));
    console.log('[ENVIO] Payload completo:', JSON.stringify(builderbotPayload, null, 2));

    const builderbotResponse = await fetch(BUILDERBOT_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-builderbot': BUILDERBOT_API_KEY
      },
      body: JSON.stringify(builderbotPayload)
    });

    console.log('\n[RESPUESTA] Respuesta recibida de Builderbot');
    console.log('[RESPUESTA] Status HTTP:', builderbotResponse.status);
    console.log('[RESPUESTA] Status Text:', builderbotResponse.statusText);
    console.log('[RESPUESTA] Headers:', Object.fromEntries(builderbotResponse.headers.entries()));

    if (!builderbotResponse.ok) {
      const errorText = await builderbotResponse.text();
      console.error('\n[ERROR] ❌ Error al llamar a Builderbot API');
      console.error('[ERROR] Status HTTP:', builderbotResponse.status);
      console.error('[ERROR] Status Text:', builderbotResponse.statusText);
      console.error('[ERROR] Cuerpo de respuesta completo:');
      console.error('--- INICIO ERROR ---');
      console.error(errorText);
      console.error('--- FIN ERROR ---');

      let parsedError;
      try {
        parsedError = JSON.parse(errorText);
        console.error('[ERROR] Error parseado como JSON:', JSON.stringify(parsedError, null, 2));
      } catch {
        console.error('[ERROR] No se pudo parsear el error como JSON');
      }
      
      if (auditoriaId && comunicacionIndex !== undefined) {
        const errorData = {
          payload_enviado: JSON.stringify(builderbotPayload),
          respuesta_error: errorText,
          status_http: builderbotResponse.status
        };

        await supabase.from('mensajes_enviados').insert({
          auditoria_id: auditoriaId,
          comunicacion_index: comunicacionIndex,
          numero_destino: numeroDestinoLimpio,
          responsable: comunicacion.responsable,
          sector: comunicacion.sector,
          mensaje_contenido: mensajeWhatsApp,
          estado: 'error',
          error_mensaje: JSON.stringify(errorData)
        });
        console.log('[ERROR] Error guardado en base de datos');
      }

      return new Response(
        JSON.stringify({
          error: 'Error al enviar mensaje por WhatsApp',
          details: errorText,
          statusCode: builderbotResponse.status,
          payload: builderbotPayload
        }),
        {
          status: builderbotResponse.status,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const builderbotResult = await builderbotResponse.json();
    console.log('\n[RESPUESTA] ✅ Respuesta exitosa de Builderbot');
    console.log('[RESPUESTA] Resultado completo:', JSON.stringify(builderbotResult, null, 2));

    if (auditoriaId && comunicacionIndex !== undefined) {
      const { error: dbError } = await supabase.from('mensajes_enviados').insert({
        auditoria_id: auditoriaId,
        comunicacion_index: comunicacionIndex,
        numero_destino: numeroDestinoLimpio,
        responsable: comunicacion.responsable,
        sector: comunicacion.sector,
        mensaje_contenido: mensajeWhatsApp,
        estado: 'enviado'
      });

      if (dbError) {
        console.error('Error guardando en BD:', dbError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        mensaje: 'Mensaje enviado exitosamente por WhatsApp',
        builderbotResponse: builderbotResult
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    const timestamp = new Date().toISOString();
    console.error(`\n${'='.repeat(80)}`);
    console.error(`[${timestamp}] === ERROR CRÍTICO ===`);
    console.error(`${'='.repeat(80)}`);
    console.error('[EXCEPCION] Error type:', error?.constructor?.name);
    console.error('[EXCEPCION] Error message:', error?.message);
    console.error('[EXCEPCION] Error stack:', error?.stack);
    console.error('[EXCEPCION] Error completo:', error);

    return new Response(
      JSON.stringify({
        error: 'Error interno del servidor',
        details: error?.message || 'Error desconocido',
        type: error?.constructor?.name,
        timestamp
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});