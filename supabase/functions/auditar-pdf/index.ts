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
  fecha_nacimiento?: string;
  sexo?: string;
  telefono?: string;
  direccion?: string;
  obra_social?: string;
  habitacion?: string;
  errores_admision: string[];
}

interface Evolucion {
  fecha: string;
  texto: string;
}

interface Advertencia {
  tipo: string;
  descripcion: string;
  fecha?: string;
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

interface Doctor {
  nombre: string;
  matricula?: string;
}

interface ResultadosFoja {
  bisturi_armonico: string | null;
  equipo_quirurgico: Array<{rol: string; nombre: string}>;
  fecha_cirugia: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  errores: string[];
}

function normalizarTexto(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarTextoPDF(texto: string): string {
  texto = texto.replace(/\f/g, ' ');
  texto = texto.replace(/\r\n/g, '\n');
  texto = texto.replace(/\r/g, '\n');

  const lineas = texto.split('\n');
  const lineasLimpias = lineas.map(linea => linea.replace(/[ \t]+/g, ' ').trim());

  texto = lineasLimpias.join('\n');
  texto = texto.replace(/^Página\s+\d+\s+de\s+\d+\s*$/gim, '');
  texto = texto.replace(/^Fecha\s+impresión:.*?$/gim, '');

  return texto;
}

function extractIngresoAlta(text: string): { ingreso: Date | null; alta: Date | null } {
  let ingreso: Date | null = null;
  let alta: Date | null = null;

  const matchIngreso = text.match(/fecha[\s_]*ingreso[\s:]*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})[\s]+([0-9]{1,2}:[0-9]{2}:[0-9]{2})?/i);
  if (matchIngreso) {
    const fecha = matchIngreso[1];
    const hora = matchIngreso[2] || "00:00:00";
    try {
      const [dia, mes, anio] = fecha.split('/');
      const diaPad = dia.padStart(2, '0');
      const mesPad = mes.padStart(2, '0');
      ingreso = new Date(`${anio}-${mesPad}-${diaPad}T${hora}`);
    } catch (e) {
      console.error('Error parseando fecha de ingreso:', e);
    }
  }

  const matchAlta = text.match(/fecha[\s_]*alta[\s:]*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})[\s]+([0-9]{1,2}:[0-9]{2}:[0-9]{2})?/i);
  if (matchAlta) {
    const fecha = matchAlta[1];
    const hora = matchAlta[2] || "00:00:00";
    try {
      const [dia, mes, anio] = fecha.split('/');
      const diaPad = dia.padStart(2, '0');
      const mesPad = mes.padStart(2, '0');
      alta = new Date(`${anio}-${mesPad}-${diaPad}T${hora}`);
    } catch (e) {
      console.error('Error parseando fecha de alta:', e);
    }
  }

  return { ingreso, alta };
}

function extraerDatosPaciente(texto: string): DatosPaciente {
  const datos: DatosPaciente = { errores_admision: [] };
  const lineas = texto.split('\n');
  const textoInicial = lineas.slice(0, 50).join('\n');

  const patronesNombre = [
    /nombre[:\s]*([A-Z][A-Z\s,]+)/i,
    /paciente[:\s]*([A-Z][A-Z\s,]+)/i,
    /apellido[:\s]*([A-Z][A-Z\s,]+)/i,
  ];

  for (const patron of patronesNombre) {
    const match = textoInicial.match(patron);
    if (match && match[1].trim().length > 3) {
      datos.nombre = match[1].trim();
      break;
    }
  }
  if (!datos.nombre) datos.errores_admision.push('Nombre del paciente no encontrado');

  const patronesDni = [
    /dni[:\s]*(\d{7,8})/i,
    /documento[:\s]*(\d{7,8})/i,
  ];

  for (const patron of patronesDni) {
    const match = textoInicial.match(patron);
    if (match) {
      datos.dni = match[1];
      break;
    }
  }
  if (!datos.dni) datos.errores_admision.push('DNI del paciente no encontrado');

  const match_nacimiento = textoInicial.match(/fecha[:\s]*nacimiento[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (match_nacimiento) {
    datos.fecha_nacimiento = match_nacimiento[1];
  } else {
    datos.errores_admision.push('Fecha de nacimiento no encontrada');
  }

  const match_sexo = textoInicial.match(/sexo[:\s]*(mujer|hombre|femenino|masculino|f|m)/i);
  if (match_sexo) {
    const sexo = match_sexo[1].toLowerCase();
    if (sexo === 'f' || sexo === 'femenino') datos.sexo = 'Femenino';
    else if (sexo === 'm' || sexo === 'masculino') datos.sexo = 'Masculino';
    else datos.sexo = sexo.charAt(0).toUpperCase() + sexo.slice(1);
  } else {
    datos.errores_admision.push('Sexo del paciente no especificado');
  }

  const patronesObraSocial = [
    /obra[\s_]*social[\s:]*(\d+[\s-]*[A-Za-zÁÉÍÓÚáéíóúñÑ\s]+)/i,
    /obra[\s_]*social[\s:]*([A-Za-zÁÉÍÓÚáéíóúñÑ\s]+)/i
  ];

  for (const patron of patronesObraSocial) {
    const match = textoInicial.match(patron);
    if (match && match[1].trim().length > 2) {
      datos.obra_social = match[1].trim();
      break;
    }
  }
  if (!datos.obra_social) {
    datos.obra_social = 'No encontrada';
  }

  const patronesHabitacion = [
    /habitación[\s:]*([A-Za-z0-9\s\-]+)/i,
    /habitacion[\s:]*([A-Za-z0-9\s\-]+)/i,
    /hab[\s:]*([A-Za-z0-9\s\-]+)/i,
    /box[\s:]*([A-Za-z0-9\s\-]+)/i,
    /sala[\s:]*([A-Za-z0-9\s\-]+)/i
  ];

  for (const patron of patronesHabitacion) {
    const match = textoInicial.match(patron);
    if (match && match[1].trim().length > 0) {
      datos.habitacion = match[1].trim();
      break;
    }
  }
  if (!datos.habitacion) {
    datos.habitacion = 'No encontrada';
  }

  return datos;
}

function extraerEvolucionesMejorado(texto: string, ingreso: Date, alta: Date): {
  errores: string[];
  evolucionesRepetidas: Evolucion[];
  advertencias: Advertencia[];
} {
  const textoNormalizado = normalizarTextoPDF(texto);
  const errores: string[] = [];
  const evolucionesRepetidas: Evolucion[] = [];
  const advertencias: Advertencia[] = [];
  const diasConEvolucion = new Set<string>();

  console.log('='.repeat(80));
  console.log('ANÁLISIS DE EVOLUCIONES MÉDICAS:');
  console.log('='.repeat(80));

  const patronVisita = /visita[\s_]+(\d{1,2}\/\d{1,2}\/\d{4})(?:\s+\d{1,2}:\d{2})?/gi;
  const patronesEvolDiaria = [
    /evolución[\s_\n]+médica[\s_\n]+diaria/i,
    /evolución[\s_\n]+medica[\s_\n]+diaria/i,
    /evolucion[\s_\n]+médica[\s_\n]+diaria/i,
    /evolucion[\s_\n]+medica[\s_\n]+diaria/i,
    /evol[\s_\n]+médica[\s_\n]+diaria/i,
    /evol[\s_\n]+medica[\s_\n]+diaria/i,
    /evolución[\s_\n]+diaria/i,
    /evolucion[\s_\n]+diaria/i
  ];

  const visitasEncontradas: Array<{fecha: string; posicion: number}> = [];
  let match;
  while ((match = patronVisita.exec(textoNormalizado)) !== null) {
    visitasEncontradas.push({
      fecha: match[1],
      posicion: match.index
    });
  }

  console.log(`[DEBUG] Total de visitas encontradas: ${visitasEncontradas.length}`);

  const fechaAdmisionDate = ingreso;
  const fechaAltaDate = alta;

  // FASE 1: Identificar todas las fechas únicas que tienen "Evolución médica diaria"
  // Recorremos todas las visitas y marcamos las fechas que tienen al menos una evolución
  const visitasPorFecha = new Map<string, number>();

  for (const visitaInfo of visitasEncontradas) {
    const fechaStr = visitaInfo.fecha;
    const posicion = visitaInfo.posicion;

    try {
      const [dia, mes, anio] = fechaStr.split('/');
      const diaPad = dia.padStart(2, '0');
      const mesPad = mes.padStart(2, '0');
      const fechaVisita = new Date(`${anio}-${mesPad}-${diaPad}`);

      // Solo procesar visitas dentro del rango de hospitalización
      if (fechaVisita >= new Date(fechaAdmisionDate.toDateString()) &&
          fechaVisita <= new Date(fechaAltaDate.toDateString())) {

        // Contar visitas por fecha
        visitasPorFecha.set(fechaStr, (visitasPorFecha.get(fechaStr) || 0) + 1);

        // Buscar "Evolución médica diaria" después de esta visita
        const bloqueTexto = textoNormalizado.substring(posicion, posicion + 2000);

        for (const patron of patronesEvolDiaria) {
          const matchEvol = bloqueTexto.match(patron);
          if (matchEvol) {
            diasConEvolucion.add(fechaStr);
            console.log(`[DEBUG] ✓ Fecha ${fechaStr}: Evolución médica diaria encontrada (Patrón: ${patron.source})`);
            break;
          }
        }
      }
    } catch (e) {
      console.error(`[DEBUG] ❌ Error procesando fecha ${fechaStr}:`, e);
    }
  }

  console.log(`\n[DEBUG] Resumen de visitas por fecha:`);
  for (const [fecha, cantidad] of visitasPorFecha.entries()) {
    const tieneEvolucion = diasConEvolucion.has(fecha);
    console.log(`[DEBUG]   ${fecha}: ${cantidad} visita(s) - ${tieneEvolucion ? '✓ CON' : '✗ SIN'} evolución médica diaria`);
  }

  // FASE 2: Generar errores solo para fechas que NO tienen "Evolución médica diaria"
  // Procesamos cada fecha única solo una vez
  const fechasYaProcesadas = new Set<string>();

  for (const [fechaStr] of visitasPorFecha) {
    if (fechasYaProcesadas.has(fechaStr)) {
      continue;
    }
    fechasYaProcesadas.add(fechaStr);

    try {
      const [dia, mes, anio] = fechaStr.split('/');
      const diaPad = dia.padStart(2, '0');
      const mesPad = mes.padStart(2, '0');
      const fechaVisita = new Date(`${anio}-${mesPad}-${diaPad}`);

      // Si esta fecha NO tiene evolución médica diaria, verificar si necesita reportar error
      if (!diasConEvolucion.has(fechaStr)) {
        if (fechaVisita.getTime() === new Date(fechaAdmisionDate.toDateString()).getTime()) {
          console.log(`[DEBUG] ℹ️  ${fechaStr}: Día de admisión - No se requiere evolución médica diaria`);
        } else if (fechaVisita.getTime() === new Date(fechaAltaDate.toDateString()).getTime()) {
          console.log(`[DEBUG] ⚠️  ${fechaStr}: Día de alta sin evolución - Se genera advertencia`);
          advertencias.push({
            tipo: 'Día de alta sin evolución',
            descripcion: `⚠️ ADVERTENCIA: ${fechaStr} - Es el día de alta, generalmente no requiere evolución diaria`,
            fecha: fechaStr
          });
        } else {
          console.log(`[DEBUG] ❌ ${fechaStr}: CRÍTICO - Falta 'Evolución médica diaria'`);
          errores.push(`❌ CRÍTICO: ${fechaStr} - Falta 'Evolución médica diaria' en el contenido de la visita`);
        }
      }
    } catch (e) {
      console.error(`[DEBUG] ❌ Error validando fecha ${fechaStr}:`, e);
    }
  }

  console.log(`\n[DEBUG] RESUMEN FINAL:`);
  console.log(`[DEBUG]    Total de fechas únicas procesadas: ${visitasPorFecha.size}`);
  console.log(`[DEBUG]    Días con evolución médica diaria: ${diasConEvolucion.size}`);
  console.log(`[DEBUG]    Errores críticos: ${errores.length}`);
  console.log(`[DEBUG]    Advertencias: ${advertencias.length}`);
  console.log('='.repeat(80) + '\n');

  return { errores, evolucionesRepetidas, advertencias };
}

function verificarAltaMedica(texto: string): string[] {
  const errores: string[] = [];

  console.log(`[DEBUG] === Verificando presencia de ALTA MÉDICA ===`);

  const lineas = texto.split('\n');
  const ultimasLineas = lineas.slice(-500).join('\n');

  const patronesAlta = [
    /alta\s+médica/i,
    /alta\s+medica/i,
    /registro\s+de\s+alta/i,
    /egreso\s+sanatorial/i,
    /egreso\s+hospitalario/i,
    /discharge/i,
    /egreso/i
  ];

  let altaEncontrada = false;
  let patronUsado = '';

  console.log(`[DEBUG] Buscando alta médica en últimas 500 líneas del documento`);

  for (const patron of patronesAlta) {
    const match = ultimasLineas.match(patron);
    if (match) {
      altaEncontrada = true;
      patronUsado = patron.source;
      console.log(`[DEBUG] ✓ ALTA MÉDICA ENCONTRADA`);
      console.log(`[DEBUG]   Patrón usado: ${patronUsado}`);
      break;
    }
  }

  if (!altaEncontrada) {
    console.log(`[DEBUG] ❌ CRÍTICO: NO se encontró el registro de alta médica`);
    errores.push('❌ CRÍTICO: Falta registro de alta médica');
  }

  return errores;
}

function verificarEpicrisis(texto: string): string[] {
  const errores: string[] = [];

  console.log(`[DEBUG] === Verificando presencia de EPICRISIS ===`);

  const lineas = texto.split('\n');

  const patronesEpicrisis = [
    /epicrisis/i,
    /epicrísis/i,
    /resumen\s+de\s+alta/i,
    /cierre\s+de\s+atencion/i,
    /cierre\s+de\s+atención/i,
    /indicaciones\s+y\s+evolución/i
  ];

  let epicrisisEncontrada = false;
  let patronEncontrado = '';

  const lineasUltimaHoja = 400;
  const inicioUltimaHoja = Math.max(0, lineas.length - lineasUltimaHoja);
  const lineasFinales = lineas.slice(inicioUltimaHoja);

  console.log(`[DEBUG] Buscando palabra "epicrisis" en últimas ${lineasFinales.length} líneas`);

  for (let i = 0; i < lineasFinales.length; i++) {
    const lineaOriginal = lineasFinales[i];

    if (lineaOriginal.trim().length > 0) {
      for (const patron of patronesEpicrisis) {
        if (patron.test(lineaOriginal)) {
          epicrisisEncontrada = true;
          patronEncontrado = patron.source;
          console.log(`[DEBUG] ✓ EPICRISIS ENCONTRADA`);
          console.log(`[DEBUG]   Patrón usado: ${patronEncontrado}`);
          break;
        }
      }
    }

    if (epicrisisEncontrada) break;
  }

  if (!epicrisisEncontrada) {
    console.log(`[DEBUG] ❌ CRÍTICO: NO se encontró la palabra "epicrisis" en el documento`);
    errores.push('❌ CRÍTICO: No existe epicrisis (resumen de alta)');
  }

  return errores;
}

function extraerDoctores(texto: string): {
  residentes: Doctor[];
  cirujanos: Doctor[];
  otros: Doctor[];
} {
  const doctores = {
    residentes: [] as Doctor[],
    cirujanos: [] as Doctor[],
    otros: [] as Doctor[]
  };

  const lineas = texto.split('\n');

  for (let i = 0; i < lineas.length; i++) {
    const matchMat = lineas[i].match(/(mp|mn|matrícula)[:\s]*(\d{3,6})/i);
    if (matchMat) {
      const matricula = matchMat[2];
      let nombreEncontrado: string | null = null;

      for (let j = Math.max(0, i - 3); j < Math.min(i + 3, lineas.length); j++) {
        const matchNombre = lineas[j].match(/([A-Z][A-Z\s,]+)/);
        if (matchNombre && matchNombre[1].trim().length > 5) {
          nombreEncontrado = matchNombre[1].trim();
          break;
        }
      }

      if (nombreEncontrado) {
        const contexto = lineas.slice(Math.max(0, i - 5), Math.min(i + 5, lineas.length)).join(' ').toLowerCase();

        if (/cirujano|cirugia|operacion|quirurgico/i.test(contexto)) {
          doctores.cirujanos.push({ nombre: nombreEncontrado, matricula });
        } else if (/residente|resident|evolucion/i.test(contexto)) {
          doctores.residentes.push({ nombre: nombreEncontrado, matricula });
        } else {
          doctores.otros.push({ nombre: nombreEncontrado, matricula });
        }
      }
    }
  }

  return doctores;
}

function validarEquipoQuirurgicoUnico(resultadosFoja: ResultadosFoja): string[] {
  const errores: string[] = [];
  const equipo = resultadosFoja.equipo_quirurgico;

  if (!equipo || equipo.length === 0) {
    return errores;
  }

  const rolesCriticos = ['cirujano', 'primer_ayudante', 'instrumentador', 'anestesista'];
  const nombresPorRol: {[key: string]: string} = {};

  for (const miembro of equipo) {
    const rol = miembro.rol;
    const nombre = miembro.nombre.trim().toUpperCase();
    if (rolesCriticos.includes(rol)) {
      nombresPorRol[rol] = nombre;
    }
  }

  const rolesEncontrados = Object.keys(nombresPorRol);
  for (let i = 0; i < rolesEncontrados.length; i++) {
    for (let j = i + 1; j < rolesEncontrados.length; j++) {
      const rol1 = rolesEncontrados[i];
      const rol2 = rolesEncontrados[j];
      const nombre1 = nombresPorRol[rol1];
      const nombre2 = nombresPorRol[rol2];

      if (nombre1 === nombre2) {
        errores.push(
          `❌ CRÍTICO: El ${rol1.replace('_', ' ')} y el ${rol2.replace('_', ' ')} tienen el mismo nombre: ${nombre1}. Deben ser personas diferentes.`
        );
      }
    }
  }

  return errores;
}

function analizarFojaQuirurgica(texto: string): ResultadosFoja {
  const resultados: ResultadosFoja = {
    bisturi_armonico: null,
    equipo_quirurgico: [],
    fecha_cirugia: null,
    hora_inicio: null,
    hora_fin: null,
    errores: []
  };

  console.log('='.repeat(80));
  console.log('ANÁLISIS DETALLADO DE FOJA QUIRÚRGICA');
  console.log('='.repeat(80));

  const patronesFoja = [
    /foja\s+quirúrgica/i,
    /hoja\s+quirúrgica/i,
    /protocolo\s+quirúrgico/i,
    /protocolo\s+operatorio/i,
    /registro\s+quirúrgico/i,
    /parte\s+quirúrgico/i
  ];

  let matchFoja = null;
  let patronUsado = '';

  for (const patron of patronesFoja) {
    matchFoja = texto.match(patron);
    if (matchFoja) {
      patronUsado = patron.source;
      console.log(`[DEBUG] ✅ Foja quirúrgica encontrada con patrón: ${patronUsado}`);
      break;
    }
  }

  if (!matchFoja) {
    console.log('[DEBUG] ❌ CRÍTICO: No se encontró foja quirúrgica');

    const indicadoresQuirurgicos = [
      /cirujano[:\s]*([A-Z][A-Z\s,]+)/i,
      /anestesista[:\s]*([A-Z][A-Z\s,]+)/i,
      /hora\s+comienzo[:\s]*(\d{1,2}:\d{2})/i,
      /bisturí\s+armónico/i
    ];

    let indicadoresEncontrados = 0;
    for (const indicador of indicadoresQuirurgicos) {
      if (indicador.test(texto)) {
        indicadoresEncontrados++;
      }
    }

    if (indicadoresEncontrados >= 2) {
      console.log(`[DEBUG] ⚠️ Se detectaron ${indicadoresEncontrados} indicadores quirúrgicos sin header explícito`);
    } else {
      resultados.errores.push('❌ CRÍTICO: No se encontró foja quirúrgica en el documento');
      return resultados;
    }
  }

  const inicioFoja = matchFoja ? (matchFoja.index || 0) : 0;
  const textoFoja = texto.substring(inicioFoja, inicioFoja + 3000);
  const lineasFoja = textoFoja.split('\n');

  console.log(`\n📋 ANÁLISIS LÍNEA POR LÍNEA (Bisturí Armónico):`);
  console.log('-'.repeat(60));

  for (let i = 0; i < lineasFoja.length; i++) {
    const linea = lineasFoja[i].trim();
    if (linea && /uso\s+de\s+bisturí\s+armónico|bisturí\s+armónico/i.test(linea)) {
      console.log(`\nLínea ${i+1}: "${linea}"`);
      console.log(`  🎯 ¡ENCONTRADO! Esta línea contiene la pregunta sobre bisturí armónico`);

      const partes = linea.split(/uso\s+de\s+bisturí\s+armónico\??|bisturí\s+armónico\??/i);
      if (partes.length > 1) {
        const respuesta = partes[partes.length - 1].trim();
        console.log(`  📝 Respuesta extraída: "${respuesta}"`);

        if (/^si\b/i.test(respuesta)) {
          console.log(`  ✅ La respuesta es 'SI'`);
          resultados.bisturi_armonico = 'SI';
          break;
        } else if (/^no\b/i.test(respuesta)) {
          console.log(`  ❌ La respuesta es 'NO'`);
          resultados.bisturi_armonico = 'NO';
          break;
        }
      }
    }
  }

  if (!resultados.bisturi_armonico) {
    console.log(`\n🔍 BÚSQUEDA CON PATRONES REGEX (Segunda pasada):`);

    const patronesBisturi = [
      /uso\s+de\s+bisturí\s+armónico\??[:\s]*(si|no)/i,
      /bisturí\s+armónico\??[:\s]*(si|no)/i,
      /armónico\??[:\s]*(si|no)/i,
      /bisturí.*?(si|no)/i,
      /armónico.*?(si|no)/i
    ];

    for (let i = 0; i < patronesBisturi.length; i++) {
      const patron = patronesBisturi[i];
      console.log(`\nPatrón ${i+1}: ${patron.source}`);
      const match = textoFoja.match(patron);
      if (match) {
        console.log(`  ✅ COINCIDENCIA: "${match[0]}"`);
        resultados.bisturi_armonico = match[1].toUpperCase();
        break;
      }
    }
  }

  if (resultados.bisturi_armonico) {
    console.log(`\n✅ RESULTADO FINAL - Bisturí Armónico: ${resultados.bisturi_armonico}`);
  } else {
    console.log(`\n⚠️ ADVERTENCIA: No se pudo determinar el uso de bisturí armónico`);
  }

  console.log(`\n👨‍⚕️ EXTRACCIÓN DE EQUIPO QUIRÚRGICO:`);

  const patronesEquipo = {
    cirujano: /cirujano[:\s]*([A-Z][A-Z\s,]+)/i,
    primer_ayudante: /primer\s+ayudante[:\s]*([A-Z][A-Z\s,]+)/i,
    anestesista: /anestesista[:\s]*([A-Z][A-Z\s,]+)/i,
    instrumentador: /instrumentador[:\s]*([A-Z][A-Z\s,]+)/i,
    ayudante_residencia: /ayudante\s+residencia[:\s]*([A-Z][A-Z\s,]+)/i,
    ayudante: /ayudante[:\s]*([A-Z][A-Z\s,]+)/i
  };

  for (const [rol, patron] of Object.entries(patronesEquipo)) {
    const match = textoFoja.match(patron);
    if (match) {
      const nombre = match[1].trim();
      console.log(`  ✅ ${rol.toUpperCase()}: ${nombre}`);
      resultados.equipo_quirurgico.push({ rol, nombre });
    }
  }

  console.log(`\n⏰ BÚSQUEDA DE HORA DE INICIO Y FECHA:`);

  const patronesHoraInicio = [
    /hora\s+comienzo[:\s]*(\d{1,2}:\d{2})/i,
    /hora\s+inicio[:\s]*(\d{1,2}:\d{2})/i,
    /comienzo[:\s]*(\d{1,2}:\d{2})/i
  ];

  let horaInicioEncontrada = false;
  for (const patron of patronesHoraInicio) {
    const match = textoFoja.match(patron);
    if (match) {
      resultados.hora_inicio = match[1];
      horaInicioEncontrada = true;
      console.log(`  ✅ Hora inicio encontrada: ${match[1]}`);

      const textoAntes = textoFoja.substring(0, match.index || 0);
      const patronesFecha = [
        /fecha[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i,
        /(\d{1,2}\/\d{1,2}\/\d{4})/
      ];

      let fechaEncontrada = false;
      for (const patronFecha of patronesFecha) {
        const matchFecha = textoAntes.match(patronFecha);
        if (matchFecha) {
          resultados.fecha_cirugia = matchFecha[1];
          fechaEncontrada = true;
          console.log(`  ✅ Fecha de cirugía encontrada: ${matchFecha[1]}`);
          break;
        }
      }

      if (!fechaEncontrada) {
        resultados.errores.push('❌ CRÍTICO: Fecha de cirugía no encontrada en foja quirúrgica');
      }
      break;
    }
  }

  if (!horaInicioEncontrada) {
    resultados.errores.push('❌ CRÍTICO: Hora de comienzo no encontrada en foja quirúrgica');
  }

  const patronesHoraFin = [
    /hora\s+finalización[:\s]*(\d{1,2}:\d{2})/i,
    /hora\s+fin[:\s]*(\d{1,2}:\d{2})/i,
    /finalización[:\s]*(\d{1,2}:\d{2})/i
  ];

  for (const patron of patronesHoraFin) {
    const match = textoFoja.match(patron);
    if (match) {
      resultados.hora_fin = match[1];
      console.log(`  ✅ Hora fin encontrada: ${match[1]}`);
      break;
    }
  }

  if (!resultados.hora_fin) {
    resultados.errores.push('⚠️ ADVERTENCIA: Hora de finalización no encontrada en foja quirúrgica');
  }

  console.log('\n' + '='.repeat(80));
  console.log('FIN DEL ANÁLISIS DE FOJA QUIRÚRGICA');
  console.log('='.repeat(80) + '\n');

  return resultados;
}

function generarComunicacionesOptimizadas(
  erroresEvolucion: string[],
  advertencias: Advertencia[],
  erroresAltaMedica: string[],
  erroresEpicrisis: string[],
  erroresAdmision: string[],
  erroresFoja: string[],
  doctores: { residentes: Doctor[]; cirujanos: Doctor[]; otros: Doctor[] },
  resultadosFoja: ResultadosFoja
): Comunicacion[] {
  const comunicaciones: Comunicacion[] = [];

  // 1. COMUNICACIONES A ADMISIÓN
  if (erroresAdmision.length > 0) {
    comunicaciones.push({
      sector: 'Admisión',
      responsable: 'Personal de Admisión',
      motivo: 'Datos de admisión incompletos',
      urgencia: 'ALTA',
      errores: erroresAdmision,
      mensaje: `Estimados/as del Sector de Admisión: Se detectaron los siguientes errores en los datos de admisión del paciente: ${erroresAdmision.join(', ')}. Por favor completar la información faltante antes del envío a OSDE.`
    });
  }

  // 2. COMUNICACIONES A MÉDICOS RESIDENTES - UNA SOLA COMUNICACIÓN
  if (erroresEvolucion.length > 0) {
    const residentesUnicos: Doctor[] = [];
    const nombresVistos = new Set<string>();

    for (const residente of doctores.residentes) {
      if (!nombresVistos.has(residente.nombre)) {
        residentesUnicos.push(residente);
        nombresVistos.add(residente.nombre);
      }
    }

    if (residentesUnicos.length > 0) {
      const nombresResidentes = residentesUnicos.map(r => `Dr/a ${r.nombre}`).join(', ');
      let mensajeResidente = `Estimados/as ${nombresResidentes}: `;

      if (erroresEvolucion.length > 0) {
        mensajeResidente += `Se detectaron ${erroresEvolucion.length} días sin evolución médica diaria. `;
      }

      mensajeResidente += 'Por favor revisar y completar las evoluciones médicas antes del envío a OSDE.';

      comunicaciones.push({
        sector: 'Residentes',
        responsable: nombresResidentes,
        motivo: 'Problemas en evoluciones médicas diarias',
        urgencia: 'ALTA',
        errores: erroresEvolucion,
        mensaje: mensajeResidente
      });
    } else {
      comunicaciones.push({
        sector: 'Residentes',
        responsable: 'Equipo de Residentes',
        motivo: 'Problemas en evoluciones médicas diarias',
        urgencia: 'ALTA',
        errores: erroresEvolucion,
        mensaje: 'Se detectaron problemas en las evoluciones médicas diarias. Por favor contactar al equipo de residentes para completar las evoluciones faltantes.'
      });
    }
  }

  // 2.5. COMUNICACIONES SOBRE ADVERTENCIAS
  if (advertencias.length > 0) {
    comunicaciones.push({
      sector: 'Residentes',
      responsable: 'Equipo de Residentes',
      motivo: 'Advertencias sobre evoluciones médicas',
      urgencia: 'MEDIA',
      errores: advertencias.map(adv => adv.descripcion),
      mensaje: `Estimados/as del Equipo de Residentes: Se detectaron ${advertencias.length} advertencias relacionadas con evoluciones médicas. Por favor revisar antes del envío a OSDE.`
    });
  }

  // 3. COMUNICACIONES A CIRUJANOS (Alta médica) - UNA SOLA COMUNICACIÓN
  const faltaAltaMedica = erroresAltaMedica.some(error => /alta/i.test(error));
  if (faltaAltaMedica) {
    const cirujanosUnicos: Doctor[] = [];
    const nombresVistos = new Set<string>();

    for (const cirujano of doctores.cirujanos) {
      if (!nombresVistos.has(cirujano.nombre)) {
        cirujanosUnicos.push(cirujano);
        nombresVistos.add(cirujano.nombre);
      }
    }

    if (cirujanosUnicos.length > 0) {
      const nombresCirujanos = cirujanosUnicos.map(c => `Dr/a ${c.nombre}`).join(', ');
      comunicaciones.push({
        sector: 'Cirugía',
        responsable: nombresCirujanos,
        motivo: 'Falta registro de alta médica',
        urgencia: 'CRÍTICA',
        errores: erroresAltaMedica.filter(error => /alta/i.test(error)),
        mensaje: `Estimados/as ${nombresCirujanos}: Se detectó la ausencia del registro de alta médica. Como cirujanos responsables, por favor completar el alta médica antes del envío a OSDE.`
      });
    } else {
      comunicaciones.push({
        sector: 'Cirugía',
        responsable: 'Cirujano Responsable',
        motivo: 'Falta registro de alta médica',
        urgencia: 'CRÍTICA',
        errores: erroresAltaMedica.filter(error => /alta/i.test(error)),
        mensaje: 'Se detectó la ausencia del registro de alta médica. Por favor contactar al cirujano responsable para completar el alta.'
      });
    }
  }

  // 4. COMUNICACIONES A CIRUJANOS (Epicrisis) - UNA SOLA COMUNICACIÓN
  if (erroresEpicrisis.length > 0) {
    const cirujanosUnicos: Doctor[] = [];
    const nombresVistos = new Set<string>();

    for (const cirujano of doctores.cirujanos) {
      if (!nombresVistos.has(cirujano.nombre)) {
        cirujanosUnicos.push(cirujano);
        nombresVistos.add(cirujano.nombre);
      }
    }

    if (cirujanosUnicos.length > 0) {
      const nombresCirujanos = cirujanosUnicos.map(c => `Dr/a ${c.nombre}`).join(', ');
      comunicaciones.push({
        sector: 'Cirugía',
        responsable: nombresCirujanos,
        motivo: 'Falta epicrisis (resumen de alta)',
        urgencia: 'CRÍTICA',
        errores: erroresEpicrisis,
        mensaje: `Estimados/as ${nombresCirujanos}: Se detectó la ausencia de epicrisis. Como cirujanos responsables, por favor completar la epicrisis antes del envío a OSDE.`
      });
    } else {
      comunicaciones.push({
        sector: 'Cirugía',
        responsable: 'Cirujano Responsable',
        motivo: 'Falta epicrisis (resumen de alta)',
        urgencia: 'CRÍTICA',
        errores: erroresEpicrisis,
        mensaje: 'Se detectó la ausencia de epicrisis. Por favor contactar al cirujano responsable para completar la epicrisis.'
      });
    }
  }

  // 5. COMUNICACIONES SOBRE FOJA QUIRÚRGICA - UNA SOLA COMUNICACIÓN
  if (erroresFoja.length > 0 || resultadosFoja.errores.length > 0) {
    const cirujanosUnicos: Doctor[] = [];
    const nombresVistos = new Set<string>();

    for (const cirujano of doctores.cirujanos) {
      if (!nombresVistos.has(cirujano.nombre)) {
        cirujanosUnicos.push(cirujano);
        nombresVistos.add(cirujano.nombre);
      }
    }

    const erroresCombinados = [...erroresFoja, ...resultadosFoja.errores];

    if (cirujanosUnicos.length > 0) {
      const nombresCirujanos = cirujanosUnicos.map(c => `Dr/a ${c.nombre}`).join(', ');
      let mensajeF = `Estimados/as ${nombresCirujanos}: `;
      mensajeF += `Se detectaron inconsistencias en la foja quirúrgica. `;
      mensajeF += 'Por favor completar la información faltante antes del envío a OSDE.';

      comunicaciones.push({
        sector: 'Cirugía',
        responsable: nombresCirujanos,
        motivo: 'Problemas en foja quirúrgica',
        urgencia: 'ALTA',
        errores: erroresCombinados,
        mensaje: mensajeF
      });
    } else {
      comunicaciones.push({
        sector: 'Cirugía',
        responsable: 'Cirujano Responsable',
        motivo: 'Problemas en foja quirúrgica',
        urgencia: 'ALTA',
        errores: erroresCombinados,
        mensaje: `Se detectaron problemas en la foja quirúrgica. Por favor contactar al cirujano responsable.`
      });
    }
  }

  // 6. COMUNICACIÓN ESPECIAL SI SE USÓ BISTURÍ ARMÓNICO - UNA SOLA COMUNICACIÓN
  if (resultadosFoja.bisturi_armonico === 'SI') {
    const cirujanosUnicos: Doctor[] = [];
    const nombresVistos = new Set<string>();

    for (const cirujano of doctores.cirujanos) {
      if (!nombresVistos.has(cirujano.nombre)) {
        cirujanosUnicos.push(cirujano);
        nombresVistos.add(cirujano.nombre);
      }
    }

    if (cirujanosUnicos.length > 0) {
      const nombresCirujanos = cirujanosUnicos.map(c => `Dr/a ${c.nombre}`).join(', ');
      comunicaciones.push({
        sector: 'Cirugía',
        responsable: nombresCirujanos,
        motivo: 'Uso de bisturí armónico - Requiere autorización especial',
        urgencia: 'CRÍTICA',
        errores: ['Se utilizó bisturí armónico'],
        mensaje: `Estimados/as ${nombresCirujanos}: Se detectó el uso de BISTURÍ ARMÓNICO en la cirugía. Este procedimiento requiere autorización especial de OSDE antes de la facturación. Por favor verificar que se cuenta con la autorización correspondiente.`
      });
    } else {
      comunicaciones.push({
        sector: 'Cirugía',
        responsable: 'Cirujano Responsable',
        motivo: 'Uso de bisturí armónico - Requiere autorización especial',
        urgencia: 'CRÍTICA',
        errores: ['Se utilizó bisturí armónico'],
        mensaje: 'Se detectó el uso de BISTURÍ ARMÓNICO en la cirugía. Este procedimiento requiere autorización especial de OSDE. Por favor contactar al cirujano responsable para verificar la autorización.'
      });
    }
  }

  return comunicaciones;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const formData = await req.formData();
    const pdfText = formData.get('pdfText') as string;
    const nombreArchivo = formData.get('nombreArchivo') as string;

    if (!pdfText || !nombreArchivo) {
      return new Response(
        JSON.stringify({ error: 'Faltan datos requeridos' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const { ingreso, alta } = extractIngresoAlta(pdfText);

    if (!ingreso) {
      return new Response(
        JSON.stringify({ error: 'No se pudo extraer la fecha de ingreso (dato obligatorio)' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Si no hay fecha de alta, usar la fecha actual (paciente aún internado)
    const fechaAlta = alta || new Date();
    const pacienteInternado = !alta;

    console.log(`[INFO] Paciente ${pacienteInternado ? 'AÚN INTERNADO' : 'con alta registrada'}`);
    if (pacienteInternado) {
      console.log(`[INFO] Usando fecha actual como referencia: ${fechaAlta.toISOString()}`);
    }

    const datosPaciente = extraerDatosPaciente(pdfText);
    const { errores: erroresEvolucion, evolucionesRepetidas, advertencias } = extraerEvolucionesMejorado(pdfText, ingreso, fechaAlta);

    // Solo verificar alta y epicrisis si el paciente ya fue dado de alta
    const erroresAltaMedica = pacienteInternado ? [] : verificarAltaMedica(pdfText);
    const erroresEpicrisis = pacienteInternado ? [] : verificarEpicrisis(pdfText);

    if (pacienteInternado) {
      console.log('[INFO] Paciente internado - No se valida alta médica ni epicrisis');
    }
    const doctores = extraerDoctores(pdfText);
    const resultadosFoja = analizarFojaQuirurgica(pdfText);

    // Validar equipo quirúrgico único
    const erroresEquipoUnico = validarEquipoQuirurgicoUnico(resultadosFoja);
    if (erroresEquipoUnico.length > 0) {
      resultadosFoja.errores.push(...erroresEquipoUnico);
    }

    const comunicaciones = generarComunicacionesOptimizadas(
      erroresEvolucion,
      advertencias,
      erroresAltaMedica,
      erroresEpicrisis,
      datosPaciente.errores_admision,
      resultadosFoja.errores,
      doctores,
      resultadosFoja
    );

    const totalErrores = datosPaciente.errores_admision.length +
                         erroresEvolucion.length +
                         resultadosFoja.errores.length +
                         erroresAltaMedica.length +
                         erroresEpicrisis.length;

    const diasHospitalizacion = Math.floor((fechaAlta.getTime() - ingreso.getTime()) / (1000 * 60 * 60 * 24)) + 1;

    const resultado = {
      nombreArchivo,
      datosPaciente,
      fechaIngreso: ingreso.toISOString(),
      fechaAlta: fechaAlta.toISOString(),
      pacienteInternado,
      diasHospitalizacion,
      erroresAdmision: datosPaciente.errores_admision,
      erroresEvolucion,
      evolucionesRepetidas,
      advertencias,
      erroresAltaMedica,
      erroresEpicrisis,
      erroresFoja: resultadosFoja.errores,
      resultadosFoja,
      doctores,
      comunicaciones,
      totalErrores,
      estado: totalErrores > 0 ? 'Pendiente de corrección' : 'Aprobado'
    };

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase.from('auditorias').insert({
      nombre_archivo: nombreArchivo,
      nombre_paciente: datosPaciente.nombre || 'No encontrado',
      dni_paciente: datosPaciente.dni || 'No encontrado',
      obra_social: datosPaciente.obra_social || 'No encontrada',
      habitacion: datosPaciente.habitacion || 'No encontrada',
      fecha_ingreso: ingreso.toISOString(),
      fecha_alta: pacienteInternado ? null : fechaAlta.toISOString(),
      total_errores: totalErrores,
      errores_admision: datosPaciente.errores_admision.length,
      errores_evoluciones: erroresEvolucion.length,
      errores_foja_quirurgica: resultadosFoja.errores.length,
      errores_alta_medica: erroresAltaMedica.length,
      errores_epicrisis: erroresEpicrisis.length,
      bisturi_armonico: resultadosFoja.bisturi_armonico || 'No determinado',
      estado: totalErrores > 0 ? 'Pendiente de corrección' : 'Aprobado',
      errores_detalle: [
        ...datosPaciente.errores_admision.map(e => ({ tipo: 'Admisión', descripcion: e })),
        ...erroresEvolucion.map(e => ({ tipo: 'Evolución', descripcion: e })),
        ...advertencias.map(a => ({ tipo: a.tipo, descripcion: a.descripcion })),
        ...resultadosFoja.errores.map(e => ({ tipo: 'Foja Quirúrgica', descripcion: e })),
        ...erroresAltaMedica.map(e => ({ tipo: 'Alta Médica', descripcion: e })),
        ...erroresEpicrisis.map(e => ({ tipo: 'Epicrisis', descripcion: e }))
      ],
      comunicaciones,
      datos_adicionales: {
        doctores,
        resultadosFoja,
        diasHospitalizacion,
        advertencias
      }
    }).select();

    if (error) {
      console.error('Error guardando en BD:', error);
    }

    return new Response(
      JSON.stringify({ success: true, resultado, auditoriaId: data?.[0]?.id }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error procesando PDF:', error);
    return new Response(
      JSON.stringify({ error: 'Error procesando el archivo PDF', details: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
