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

/* ======== NUEVO: Estudios ======== */
type CategoriaEstudio = 'Imagenes' | 'Laboratorio' | 'Procedimientos';

interface Estudio {
  categoria: CategoriaEstudio;
  tipo: string;             // p.ej. "TAC de tórax", "Hemograma completo", "Endoscopía alta"
  fecha?: string | null;    // "DD/MM/YYYY"
  hora?: string | null;     // "HH:mm"
  lugar?: string | null;    // p.ej. "Servicio de Diagnóstico", "Laboratorio Central"
  resultado?: string | null;// línea breve capturada (cuando aplique)
  informe_presente: boolean;// si detectamos "informe, impresión, conclusión"
  advertencias: string[];   // p.ej. "sin informe", "sin fecha"
}

/* =========================
   Utilidades de Normalización
   ========================= */
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

/* =========================
   Parseo de fechas ROBUSTO
   ========================= */
function makeDate(d: string, hms?: string): Date {
  const [ddStr, mmStr, yyyyStr] = d.split('/');
  const dd = Number(ddStr);
  const mm = Number(mmStr);
  let yyyy = Number(yyyyStr);
  if (yyyy < 100) yyyy += 2000;

  let hh = 0, mi = 0, ss = 0;
  if (hms) {
    const parts = hms.split(':');
    hh = Number(parts[0] ?? 0);
    mi = Number(parts[1] ?? 0);
    ss = Number(parts[2] ?? 0);
  }
  return new Date(yyyy, (mm - 1), dd, hh, mi, ss);
}

function extractIngresoAlta(text: string): { ingreso: Date | null; alta: Date | null } {
  let ingreso: Date | null = null;
  let alta: Date | null = null;

  const reFechaHora = /fecha[\s_]*(ingreso|alta)[\s:]*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})[\s]+([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)/gi;
  let m: RegExpExecArray | null;
  while ((m = reFechaHora.exec(text)) !== null) {
    const tipo = m[1].toLowerCase();
    const fecha = m[2];
    const hora = m[3];
    const dt = makeDate(fecha, hora);
    if (!Number.isNaN(dt.getTime())) {
      if (tipo === 'ingreso') ingreso = dt;
      if (tipo === 'alta') alta = dt;
    }
  }

  if (!ingreso) {
    const mi = text.match(/fecha[\s_]*ingreso[\s:]*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i);
    if (mi) {
      const dt = makeDate(mi[1]);
      if (!Number.isNaN(dt.getTime())) ingreso = dt;
    }
  }

  if (!alta) {
    const ma = text.match(/fecha[\s_]*alta[\s:]*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i);
    if (ma) {
      const dt = makeDate(ma[1]);
      if (!Number.isNaN(dt.getTime())) alta = dt;
    }
  }

  return { ingreso, alta };
}

/* =========================
   Helpers de días de hospitalización
   ========================= */
function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Reglas:
 * - Egresado: ingreso incluido, alta EXCLUIDA.
 * - Internado (sin alta): ingreso incluido, HOY incluido.
 * - Ingreso y alta el mismo día: 0 días.
 */
function diasHospitalizacionCalc(ingreso: Date, alta: Date | null): number {
  const MS_DIA = 1000 * 60 * 60 * 24;
  const si = startOfDay(ingreso);

  if (alta && !Number.isNaN(alta.getTime())) {
    const sa = startOfDay(alta);
    const diff = Math.floor((sa.getTime() - si.getTime()) / MS_DIA);
    return Math.max(0, diff);
  }

  const hoy = startOfDay(new Date());
  const diffIncluyendoHoy = Math.floor((hoy.getTime() - si.getTime()) / MS_DIA) + 1;
  return Math.max(1, diffIncluyendoHoy);
}

/* =========================
   Extracción de datos
   ========================= */
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
  if (match_nacimiento) datos.fecha_nacimiento = match_nacimiento[1];
  else datos.errores_admision.push('Fecha de nacimiento no encontrada');

  const match_sexo = textoInicial.match(/sexo[:\s]*(mujer|hombre|femenino|masculino|f|m)/i);
  if (match_sexo) {
    const sexo = match_sexo[1].toLowerCase();
    if (sexo === 'f' || sexo === 'femenino') datos.sexo = 'Femenino';
    else if (sexo === 'm' || sexo === 'masculino') datos.sexo = 'Masculino';
    else datos.sexo = sexo.charAt(0).toUpperCase() + sexo.slice(1);
  } else datos.errores_admision.push('Sexo del paciente no especificado');

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
  if (!datos.obra_social) datos.obra_social = 'No encontrada';

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
  if (!datos.habitacion) datos.habitacion = 'No encontrada';

  return datos;
}

/* =========================
   Evoluciones
   ========================= */
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
    visitasEncontradas.push({ fecha: match[1], posicion: match.index });
  }

  const fechaAdmisionDate = ingreso;
  const fechaAltaDate = alta;

  const visitasPorFecha = new Map<string, number>();
  for (const visitaInfo of visitasEncontradas) {
    const fechaStr = visitaInfo.fecha;
    const posicion = visitaInfo.posicion;

    try {
      const [dia, mes, anio] = fechaStr.split('/');
      const diaPad = dia.padStart(2, '0');
      const mesPad = mes.padStart(2, '0');
      const fechaVisita = new Date(`${anio}-${mesPad}-${diaPad}`);

      if (fechaVisita >= new Date(fechaAdmisionDate.toDateString()) &&
          fechaVisita <= new Date(fechaAltaDate.toDateString())) {

        visitasPorFecha.set(fechaStr, (visitasPorFecha.get(fechaStr) || 0) + 1);

        const bloqueTexto = textoNormalizado.substring(posicion, posicion + 2000);
        for (const patron of patronesEvolDiaria) {
          const matchEvol = bloqueTexto.match(patron);
          if (matchEvol) {
            diasConEvolucion.add(fechaStr);
            break;
          }
        }
      }
    } catch {}
  }

  const fechasYaProcesadas = new Set<string>();
  for (const [fechaStr] of visitasPorFecha) {
    if (fechasYaProcesadas.has(fechaStr)) continue;
    fechasYaProcesadas.add(fechaStr);

    try {
      const [dia, mes, anio] = fechaStr.split('/');
      const diaPad = dia.padStart(2, '0');
      const mesPad = mes.padStart(2, '0');
      const fechaVisita = new Date(`${anio}-${mesPad}-${diaPad}`);

      if (!diasConEvolucion.has(fechaStr)) {
        if (fechaVisita.getTime() === new Date(fechaAdmisionDate.toDateString()).getTime()) {
          // día admisión: ok sin evolución
        } else if (fechaVisita.getTime() === new Date(fechaAltaDate.toDateString()).getTime()) {
          advertencias.push({
            tipo: 'Día de alta sin evolución',
            descripcion: `⚠️ ADVERTENCIA: ${fechaStr} - Es el día de alta, generalmente no requiere evolución diaria`,
            fecha: fechaStr
          });
        } else {
          errores.push(`❌ CRÍTICO: ${fechaStr} - Falta 'Evolución médica diaria'`);
        }
      }
    } catch {}
  }

  return { errores, evolucionesRepetidas, advertencias };
}

/* =========================
   Alta médica / Epicrisis
   ========================= */
function verificarAltaMedica(texto: string): string[] {
  const errores: string[] = [];
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
  for (const patron of patronesAlta) {
    const match = ultimasLineas.match(patron);
    if (match) { altaEncontrada = true; break; }
  }

  if (!altaEncontrada) errores.push('❌ CRÍTICO: Falta registro de alta médica');
  return errores;
}

function verificarEpicrisis(texto: string): string[] {
  const errores: string[] = [];
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
  const inicioUltimaHoja = Math.max(0, lineas.length - 400);
  const lineasFinales = lineas.slice(inicioUltimaHoja);

  for (let i = 0; i < lineasFinales.length; i++) {
    const lineaOriginal = lineasFinales[i];
    if (lineaOriginal.trim().length > 0) {
      for (const patron of patronesEpicrisis) {
        if (patron.test(lineaOriginal)) { epicrisisEncontrada = true; break; }
      }
    }
    if (epicrisisEncontrada) break;
  }

  if (!epicrisisEncontrada) errores.push('❌ CRÍTICO: No existe epicrisis (resumen de alta)');
  return errores;
}

/* =========================
   Doctores y Foja
   ========================= */
function extraerDoctores(texto: string): {
  residentes: Doctor[];
  cirujanos: Doctor[];
  otros: Doctor[];
} {
  const doctores = { residentes: [] as Doctor[], cirujanos: [] as Doctor[], otros: [] as Doctor[] };
  const lineas = texto.split('\n');

  for (let i = 0; i < lineas.length; i++) {
    const matchMat = lineas[i].match(/(mp|mn|matrícula)[:\s]*(\d{3,6})/i);
    if (matchMat) {
      const matricula = matchMat[2];
      let nombreEncontrado: string | null = null;

      for (let j = Math.max(0, i - 3); j < Math.min(i + 3, lineas.length); j++) {
        const matchNombre = lineas[j].match(/([A-Z][A-Z\s,]+)/);
        if (matchNombre && matchNombre[1].trim().length > 5) {
          nombreEncontrado = matchNombre[1].trim(); break;
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
  if (!equipo || equipo.length === 0) return errores;

  const rolesCriticos = ['cirujano', 'primer_ayudante', 'instrumentador', 'anestesista'];
  const nombresPorRol: {[key: string]: string} = {};

  for (const miembro of equipo) {
    const rol = miembro.rol;
    const nombre = miembro.nombre.trim().toUpperCase();
    if (rolesCriticos.includes(rol)) nombresPorRol[rol] = nombre;
  }

  const rolesEncontrados = Object.keys(nombresPorRol);
  for (let i = 0; i < rolesEncontrados.length; i++) {
    for (let j = i + 1; j < rolesEncontrados.length; j++) {
      const rol1 = rolesEncontrados[i], rol2 = rolesEncontrados[j];
      if (nombresPorRol[rol1] === nombresPorRol[rol2]) {
        errores.push(`❌ CRÍTICO: El ${rol1.replace('_',' ')} y el ${rol2.replace('_',' ')} tienen el mismo nombre: ${nombresPorRol[rol1]}. Deben ser diferentes.`);
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

  const patronesFoja = [
    /foja\s+quirúrgica/i,
    /hoja\s+quirúrgica/i,
    /protocolo\s+quirúrgico/i,
    /protocolo\s+operatorio/i,
    /registro\s+quirúrgico/i,
    /parte\s+quirúrgico/i
  ];

  let matchFoja = null;
  for (const patron of patronesFoja) {
    matchFoja = texto.match(patron);
    if (matchFoja) break;
  }

  if (!matchFoja) {
    const indicadoresQuirurgicos = [
      /cirujano[:\s]*([A-Z][A-Z\s,]+)/i,
      /anestesista[:\s]*([A-Z][A-Z\s,]+)/i,
      /hora\s+comienzo[:\s]*(\d{1,2}:\d{2})/i,
      /bisturí\s+armónico/i
    ];
    let indicadoresEncontrados = 0;
    for (const r of estosIndicadores(indicadoresQuirurgicos, texto)) if (r) indicadoresEncontrados++;
    if (indicadoresEncontrados < 2) {
      resultados.errores.push('❌ CRÍTICO: No se encontró foja quirúrgica en el documento');
      return resultados;
    }
  }

  const inicioFoja = matchFoja ? (matchFoja.index || 0) : 0;
  const textoFoja = texto.substring(inicioFoja, inicioFoja + 3000);

  // Bisturí armónico
  const patronesBisturi = [
    /uso\s+de\s+bisturí\s+armónico\??[:\s]*(si|no)/i,
    /bisturí\s+armónico\??[:\s]*(si|no)/i,
    /armónico\??[:\s]*(si|no)/i,
    /bisturí.*?(si|no)/i,
    /armónico.*?(si|no)/i
  ];
  for (const patron of patronesBisturi) {
    const m = textoFoja.match(patron);
    if (m) { resultados.bisturi_armonico = m[1].toUpperCase(); break; }
  }

  // Equipo
  const patronesEquipo = {
    cirujano: /cirujano[:\s]*([A-Z][A-Z\s,]+)/i,
    primer_ayudante: /primer\s+ayudante[:\s]*([A-Z][A-Z\s,]+)/i,
    anestesista: /anestesista[:\s]*([A-Z][A-Z\s,]+)/i,
    instrumentador: /instrumentador[:\s]*([A-Z][A-Z\s,]+)/i,
    ayudante_residencia: /ayudante\s+residencia[:\s]*([A-Z][A-Z\s,]+)/i,
    ayudante: /ayudante[:\s]*([A-Z][A-Z\s,]+)/i
  };
  for (const [rol, patron] of Object.entries(patronesEquipo)) {
    const m = textoFoja.match(patron);
    if (m) resultados.equipo_quirurgico.push({ rol, nombre: m[1].trim() });
  }

  // Horas / fechas
  const patronesHoraInicio = [
    /hora\s+comienzo[:\s]*(\d{1,2}:\d{2})/i,
    /hora\s+inicio[:\s]*(\d{1,2}:\d{2})/i,
    /comienzo[:\s]*(\d{1,2}:\d{2})/i
  ];
  let horaInicioEncontrada = false;
  for (const patron of patronesHoraInicio) {
    const m = textoFoja.match(patron);
    if (m) {
      resultados.hora_inicio = m[1]; horaInicioEncontrada = true;
      const textoAntes = textoFoja.substring(0, (m.index ?? 0));
      const patronesFecha = [/fecha[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i, /(\d{1,2}\/\d{1,2}\/\d{4})/];
      let fechaEncontrada = false;
      for (const pf of patronesFecha) {
        const f = textoAntes.match(pf);
        if (f) { resultados.fecha_cirugia = f[1]; fechaEncontrada = true; break; }
      }
      if (!fechaEncontrada) resultados.errores.push('❌ CRÍTICO: Fecha de cirugía no encontrada en foja quirúrgica');
      break;
    }
  }
  if (!horaInicioEncontrada) resultados.errores.push('❌ CRÍTICO: Hora de comienzo no encontrada en foja quirúrgica');

  const patronesHoraFin = [
    /hora\s+finalización[:\s]*(\d{1,2}:\d{2})/i,
    /hora\s+fin[:\s]*(\d{1,2}:\d{2})/i,
    /finalización[:\s]*(\d{1,2}:\d{2})/i
  ];
  for (const patron of patronesHoraFin) {
    const m = textoFoja.match(patron);
    if (m) { resultados.hora_fin = m[1]; break; }
  }
  if (!resultados.hora_fin) resultados.errores.push('⚠️ ADVERTENCIA: Hora de finalización no encontrada en foja quirúrgica');

  return resultados;
}

function* estosIndicadores(regs: RegExp[], txt: string) {
  for (const r of regs) yield r.test(txt);
}

/* =========================
   NUEVO: Extraer Estudios
   ========================= */
function extraerEstudios(texto: string): { estudios: Estudio[]; erroresEstudios: string[]; conteo: {total:number, imagenes:number, laboratorio:number, procedimientos:number} } {
  const tx = normalizarTextoPDF(texto);
  const lineas = tx.split('\n');

  const reFecha = /(\b\d{1,2}\/\d{1,2}\/\d{2,4}\b)/i;
  const reHora = /(\b\d{1,2}:\d{2}(?::\d{2})?\b)/;
  const reInforme = /(informe|impresion|impresión|conclusion|conclusión|resultado)/i;

  // Catálogo básico de tipos
  const patronesImagenes: Array<[RegExp, string]> = [
    [/\b(tac|tc|tomografia|tomografía)\b.*?(cerebro|craneo|cráneo|torax|tórax|abdomen|pelvis|columna|cuello)?/i, 'TAC'],
    [/\b(rm|rmn|resonancia)\b.*?(cerebro|craneo|cráneo|columna|rodilla|hombro|abdomen|pelvis|torax|tórax)?/i, 'Resonancia Magnética'],
    [/\b(rx|r[xg]rafia|radiografia|radiografía)\b.*?(torax|tórax|columna|miembro|mano|muñeca|cadera|pelvis)?/i, 'Radiografía'],
    [/\b(eco|ecografia|ecografía|us|ultrasonido)\b.*?(abdominal|hepato|vesicular|renal|tiroides|obstetrica|doppler|partes blandas)?/i, 'Ecografía'],
    [/\bdoppler\b.*?(venoso|arterial|miembros|carotideo|carotídeo)?/i, 'Doppler'],
    [/\bangiotac|angio[-\s]?rm\b/i, 'Angio']
  ];

  const patronesLab: Array<[RegExp, string]> = [
    [/\bhemograma( completo)?\b/i, 'Hemograma'],
    [/\bpcr\b(?![-\w])/i, 'PCR'],
    [/\bvsg\b/i, 'VSG'],
    [/\bglucemia\b/i, 'Glucemia'],
    [/\bcreatinin(a|emia)?\b/i, 'Creatinina'],
    [/\burea\b/i, 'Urea'],
    [/\bionograma|sodio|potasio|cloro\b/i, 'Ionograma'],
    [/\bhepatic[oa]|tgo|tgp|gamm?aglutamil|bilirrubin(a|as)?\b/i, 'Perfil hepático'],
    [/\bur[ie]nalisis|sumario de orina|orina completa\b/i, 'Orina completa'],
  ];

  const patronesProc: Array<[RegExp, string]> = [
    [/\bendoscop[ií]a (alta|digestiva alta)\b/i, 'Endoscopía alta'],
    [/\bcolonoscop[ií]a\b/i, 'Colonoscopía'],
    [/\bbroncoscop[ií]a\b/i, 'Broncoscopía'],
    [/\beco[-\s]?cardiogram?a\b/i, 'Ecocardiograma'],
    [/\becg|electrocardiograma\b/i, 'Electrocardiograma'],
    [/\bparacentesis|toracocentesis|puncion lumbar|punción lumbar\b/i, 'Procedimiento']
  ];

  const estudios: Estudio[] = [];
  const pushEstudio = (categoria: CategoriaEstudio, tipo: string, linea: string) => {
    const fecha = (linea.match(reFecha)?.[1]) || null;
    const hora  = (linea.match(reHora)?.[1])  || null;
    const informe_presente = reInforme.test(linea);
    const advertencias: string[] = [];
    if (!informe_presente) advertencias.push('sin informe');
    if (!fecha) advertencias.push('sin fecha');

    // intento de lugar
    const lugar = (linea.match(/servicio[:\s]+([a-z0-9\s]+)$/i)?.[1] || null);

    // recorte de resultado breve si aparece
    let resultado: string | null = null;
    const mRes = linea.match(/(resultado|impresi[oó]n|conclusi[oó]n)[:\s-]+(.{10,200})/i);
    if (mRes) resultado = mRes[2].trim();

    estudios.push({
      categoria, tipo: tipoDetectado(tipo, linea), fecha, hora, lugar,
      resultado, informe_presente, advertencias
    });
  };

  const tipoDetectado = (base: string, linea: string) => {
    const zona = (linea.match(/de\s+(t[oó]rax|abdomen|pelvis|columna|cerebro|cr[aá]neo|cuello|rodilla|hombro|hep[aá]tico|renal|tiroides|obst[eé]trica|venoso|arterial|car[oó]tideo)/i)?.[1]) || '';
    return zona ? `${base} de ${zona}` : base;
  };

  // Búsqueda línea a línea (barato y efectivo en PDFs lineales)
  for (const l of lineas) {
    const linea = l.trim();
    if (!linea) continue;

    for (const [re, label] of patronesImagenes) {
      if (re.test(linea)) { pushEstudio('Imagenes', label, linea); break; }
    }
    for (const [re, label] of patronesLab) {
      if (re.test(linea)) { pushEstudio('Laboratorio', label, linea); break; }
    }
    for (const [re, label] of patronesProc) {
      if (re.test(linea)) { pushEstudio('Procedimientos', label, linea); break; }
    }

    // Secciones generales
    if (/diagn[oó]stico por im[aá]genes|servicio de im[aá]genes|radiolog[ií]a/i.test(linea)) {
      // Marcar contexto: no necesario aquí; igual capturamos por línea
    }
    if (/laboratorio\b|an[aá]lisis cl[ií]nico/i.test(linea) && /solicitad[oa]|realizad[oa]|resultado/i.test(linea)) {
      // ya cubierto en patterns; esta línea sirve de pista adicional
    }
  }

  // Deduplicación por tipo+fecha (mantiene el primero, normalmente el más descriptivo)
  const visto = new Set<string>();
  const dedup: Estudio[] = [];
  for (const e of estudios) {
    const key = `${e.categoria}|${(e.tipo||'').toUpperCase()}|${e.fecha||'NA'}`;
    if (!visto.has(key)) { visto.add(key); dedup.push(e); }
  }

  // Conteo por categoría
  const conteo = {
    total: dedup.length,
    imagenes: dedup.filter(e => e.categoria === 'Imagenes').length,
    laboratorio: dedup.filter(e => e.categoria === 'Laboratorio').length,
    procedimientos: dedup.filter(e => e.categoria === 'Procedimientos').length,
  };

  // Errores: estudios sin informe
  const erroresEstudios: string[] = [];
  for (const e of dedup) {
    if (!e.informe_presente) {
      erroresEstudios.push(`Estudio sin informe: [${e.categoria}] ${e.tipo}${e.fecha ? ` (${e.fecha})` : ''}`);
    }
  }

  return { estudios: dedup, erroresEstudios, conteo };
}

/* =========================
   Comunicaciones (extendido con Estudios)
   ========================= */
function generarComunicacionesOptimizadas(
  erroresEvolucion: string[],
  advertencias: Advertencia[],
  erroresAltaMedica: string[],
  erroresEpicrisis: string[],
  erroresAdmision: string[],
  erroresFoja: string[],
  doctores: { residentes: Doctor[]; cirujanos: Doctor[]; otros: Doctor[] },
  resultadosFoja: ResultadosFoja,
  estudios: Estudio[],
  erroresEstudios: string[]
): Comunicacion[] {
  const comunicaciones: Comunicacion[] = [];

  // 1. Admisión
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

  // 2. Residentes (evoluciones)
  if (erroresEvolucion.length > 0) {
    const residentesUnicos: Doctor[] = [];
    const nombresVistos = new Set<string>();
    for (const r of doctores.residentes) {
      if (!nombresVistos.has(r.nombre)) { residentesUnicos.push(r); nombresVistos.add(r.nombre); }
    }
    if (residentesUnicos.length > 0) {
      const nombres = residentesUnicos.map(r => `Dr/a ${r.nombre}`).join(', ');
      comunicaciones.push({
        sector: 'Residentes',
        responsable: nombres,
        motivo: 'Problemas en evoluciones médicas diarias',
        urgencia: 'ALTA',
        errores: erroresEvolucion,
        mensaje: `Estimados/as ${nombres}: Se detectaron ${erroresEvolucion.length} días sin evolución médica diaria. Revisar y completar antes del envío a OSDE.`
      });
    } else {
      comunicaciones.push({
        sector: 'Residentes',
        responsable: 'Equipo de Residentes',
        motivo: 'Problemas en evoluciones médicas diarias',
        urgencia: 'ALTA',
        errores: erroresEvolucion,
        mensaje: 'Se detectaron problemas en las evoluciones. Por favor completar las evoluciones faltantes.'
      });
    }
  }

  // 2.5 Advertencias
  if (advertencias.length > 0) {
    comunicaciones.push({
      sector: 'Residentes',
      responsable: 'Equipo de Residentes',
      motivo: 'Advertencias sobre evoluciones médicas',
      urgencia: 'MEDIA',
      errores: advertencias.map(adv => adv.descripcion),
      mensaje: `Estimados/as del Equipo de Residentes: Se detectaron ${advertencias.length} advertencias relacionadas con evoluciones. Revisar.`
    });
  }

  // 3. Cirugía (alta médica)
  const faltaAltaMedica = erroresAltaMedica.some(e => /alta/i.test(e));
  if (faltaAltaMedica) {
    const cirUnicos: Doctor[] = [];
    const setN = new Set<string>();
    for (const c of doctores.cirujanos) {
      if (!setN.has(c.nombre)) { cirUnicos.push(c); setN.add(c.nombre); }
    }
    const errores = erroresAltaMedica.filter(e => /alta/i.test(e));
    if (cirUnicos.length > 0) {
      const nombres = cirUnicos.map(c => `Dr/a ${c.nombre}`).join(', ');
      comunicaciones.push({
        sector: 'Cirugía',
        responsable: nombres,
        motivo: 'Falta registro de alta médica',
        urgencia: 'CRÍTICA',
        errores,
        mensaje: `Estimados/as ${nombres}: Se detectó ausencia de alta médica. Completar antes del envío a OSDE.`
      });
    } else {
      comunicaciones.push({
        sector: 'Cirugía',
        responsable: 'Cirujano Responsable',
        motivo: 'Falta registro de alta médica',
        urgencia: 'CRÍTICA',
        errores,
        mensaje: 'Se detectó ausencia de alta médica. Contactar al cirujano responsable para completar.'
      });
    }
  }

  // 4. Cirugía (epicrisis)
  if (erroresEpicrisis.length > 0) {
    const cirUnicos: Doctor[] = [];
    const setN = new Set<string>();
    for (const c of doctores.cirujanos) {
      if (!setN.has(c.nombre)) { cirUnicos.push(c); setN.add(c.nombre); }
    }
    if (cirUnicos.length > 0) {
      const nombres = cirUnicos.map(c => `Dr/a ${c.nombre}`).join(', ');
      comunicaciones.push({
        sector: 'Cirugía',
        responsable: nombres,
        motivo: 'Falta epicrisis (resumen de alta)',
        urgencia: 'CRÍTICA',
        errores: erroresEpicrisis,
        mensaje: `Estimados/as ${nombres}: Falta epicrisis. Completar antes del envío a OSDE.`
      });
    } else {
      comunicaciones.push({
        sector: 'Cirugía',
        responsable: 'Cirujano Responsable',
        motivo: 'Falta epicrisis (resumen de alta)',
        urgencia: 'CRÍTICA',
        errores: erroresEpicrisis,
        mensaje: 'Falta epicrisis. Contactar al cirujano responsable para completar.'
      });
    }
  }

  // 5. Foja quirúrgica
  if (erroresFoja.length > 0 || resultadosFoja.errores.length > 0) {
    const cirUnicos: Doctor[] = [];
    const setN = new Set<string>();
    for (const c of doctores.cirujanos) {
      if (!setN.has(c.nombre)) { cirUnicos.push(c); setN.add(c.nombre); }
    }
    const erroresCombinados = [...erroresFoja, ...resultadosFoja.errores];
    if (cirUnicos.length > 0) {
      const nombres = cirUnicos.map(c => `Dr/a ${c.nombre}`).join(', ');
      comunicaciones.push({
        sector: 'Cirugía',
        responsable: nombres,
        motivo: 'Problemas en foja quirúrgica',
        urgencia: 'ALTA',
        errores: erroresCombinados,
        mensaje: `Estimados/as ${nombres}: Se detectaron inconsistencias en la foja quirúrgica. Completar antes del envío a OSDE.`
      });
    } else {
      comunicaciones.push({
        sector: 'Cirugía',
        responsable: 'Cirujano Responsable',
        motivo: 'Problemas en foja quirúrgica',
        urgencia: 'ALTA',
        errores: erroresCombinados,
        mensaje: `Se detectaron problemas en la foja quirúrgica. Contactar al cirujano responsable.`
      });
    }
  }

  // 6. Bisturí armónico
  if (resultadosFoja.bisturi_armonico === 'SI') {
    const cirUnicos: Doctor[] = [];
    const setN = new Set<string>();
    for (const c of doctores.cirujanos) {
      if (!setN.has(c.nombre)) { cirUnicos.push(c); setN.add(c.nombre); }
    }
    if (cirUnicos.length > 0) {
      const nombres = cirUnicos.map(c => `Dr/a ${c.nombre}`).join(', ');
      comunicaciones.push({
        sector: 'Cirugía',
        responsable: nombres,
        motivo: 'Uso de bisturí armónico - Requiere autorización especial',
        urgencia: 'CRÍTICA',
        errores: ['Se utilizó bisturí armónico'],
        mensaje: `Estimados/as ${nombres}: Se detectó el uso de BISTURÍ ARMÓNICO. Requiere autorización de OSDE previa a facturación. Verificar.`
      });
    } else {
      comunicaciones.push({
        sector: 'Cirugía',
        responsable: 'Cirujano Responsable',
        motivo: 'Uso de bisturí armónico - Requiere autorización especial',
        urgencia: 'CRÍTICA',
        errores: ['Se utilizó bisturí armónico'],
        mensaje: 'Uso de BISTURÍ ARMÓNICO detectado. Verificar autorización de OSDE previa a facturación.'
      });
    }
  }

  // 7. NUEVO: Estudios sin informe -> comunicar a servicios
  const sinInforme = estudios.filter(e => !e.informe_presente);
  if (sinInforme.length > 0) {
    const errores = sinInforme.map(e => `[${e.categoria}] ${e.tipo}${e.fecha ? ` (${e.fecha})` : ''}`);
    const hayImagenes = sinInforme.some(e => e.categoria === 'Imagenes');
    const hayLab = sinInforme.some(e => e.categoria === 'Laboratorio');
    const hayProc = sinInforme.some(e => e.categoria === 'Procedimientos');

    if (hayImagenes) {
      comunicaciones.push({
        sector: 'Diagnóstico por Imágenes',
        responsable: 'Jefe/a de Servicio',
        motivo: 'Estudios de imágenes sin informe',
        urgencia: 'ALTA',
        errores,
        mensaje: `Se detectaron estudios de imágenes sin informe: ${errores.filter(s=>s.includes('[Imagenes]')).join('; ')}. Emitir/adjuntar informe antes del envío a OSDE.`
      });
    }
    if (hayLab) {
      comunicaciones.push({
        sector: 'Laboratorio',
        responsable: 'Jefe/a de Laboratorio',
        motivo: 'Estudios de laboratorio sin resultado/informe',
        urgencia: 'MEDIA',
        errores,
        mensaje: `Se detectaron estudios de laboratorio sin resultado/informe claro: ${errores.filter(s=>s.includes('[Laboratorio]')).join('; ')}. Adjuntar resultados normalizados.`
      });
    }
    if (hayProc) {
      comunicaciones.push({
        sector: 'Endoscopía / Procedimientos',
        responsable: 'Responsable de Procedimientos',
        motivo: 'Procedimientos sin informe',
        urgencia: 'ALTA',
        errores,
        mensaje: `Procedimientos sin informe detectados: ${errores.filter(s=>s.includes('[Procedimientos]')).join('; ')}. Cargar informe y conclusiones.`
      });
    }
  }

  // 8. También incluimos erroresEstudios explícitos (traza)
  if (erroresEstudios.length > 0) {
    comunicaciones.push({
      sector: 'Coordinación de Historias Clínicas',
      responsable: 'Equipo Coordinación',
      motivo: 'Normalización de estudios',
      urgencia: 'MEDIA',
      errores: erroresEstudios,
      mensaje: 'Se detectaron estudios sin informe/fecha. Normalizar documentación antes de auditoría externa.'
    });
  }

  return comunicaciones;
}

/* =========================
   Handler principal
   ========================= */
Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const formData = await req.formData();
    const pdfText = formData.get('pdfText') as string;
    const nombreArchivo = formData.get('nombreArchivo') as string;

    if (!pdfText || !nombreArchivo) {
      return new Response(JSON.stringify({ error: 'Faltan datos requeridos' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { ingreso, alta } = extractIngresoAlta(pdfText);
    if (!ingreso || Number.isNaN(ingreso.getTime())) {
      return new Response(JSON.stringify({ error: 'No se pudo extraer la fecha de ingreso (dato obligatorio)' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const altaValida = !!(alta && !Number.isNaN(alta.getTime()));
    const fechaAlta = altaValida ? alta! : new Date();
    const pacienteInternado = !altaValida;

    const datosPaciente = extraerDatosPaciente(pdfText);
    const { errores: erroresEvolucion, evolucionesRepetidas, advertencias } =
      extraerEvolucionesMejorado(pdfText, ingreso, fechaAlta);

    const erroresAltaMedica = pacienteInternado ? [] : verificarAltaMedica(pdfText);
    const erroresEpicrisis   = pacienteInternado ? [] : verificarEpicrisis(pdfText);

    const doctores = extraerDoctores(pdfText);
    const resultadosFoja = analizarFojaQuirurgica(pdfText);

    const erroresEquipoUnico = validarEquipoQuirurgicoUnico(resultadosFoja);
    if (erroresEquipoUnico.length > 0) resultadosFoja.errores.push(...erroresEquipoUnico);

    // NUEVO: Estudios
    const { estudios, erroresEstudios, conteo: estudiosConteo } = extraerEstudios(pdfText);

    const comunicaciones = generarComunicacionesOptimizadas(
      erroresEvolucion,
      advertencias,
      erroresAltaMedica,
      erroresEpicrisis,
      datosPaciente.errores_admision,
      resultadosFoja.errores,
      doctores,
      resultadosFoja,
      estudios,
      erroresEstudios
    );

    const totalErrores =
      datosPaciente.errores_admision.length +
      erroresEvolucion.length +
      resultadosFoja.errores.length +
      erroresAltaMedica.length +
      erroresEpicrisis.length +
      erroresEstudios.length;

    const diasHospitalizacion = diasHospitalizacionCalc(
      ingreso,
      altaValida ? fechaAlta : null
    );

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
      // NUEVO
      estudios,
      estudiosConteo,
      erroresEstudios,
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
      // NUEVO: persistencia de estudios
      estudios_total: estudiosConteo.total,
      estudios_imagenes: estudiosConteo.imagenes,
      estudios_laboratorio: estudiosConteo.laboratorio,
      estudios_procedimientos: estudiosConteo.procedimientos,
      estudios, // JSON completo
      errores_estudios: erroresEstudios, // trazabilidad
      errores_detalle: [
        ...datosPaciente.errores_admision.map(e => ({ tipo: 'Admisión', descripcion: e })),
        ...erroresEvolucion.map(e => ({ tipo: 'Evolución', descripcion: e })),
        ...advertencias.map(a => ({ tipo: a.tipo, descripcion: a.descripcion })),
        ...resultadosFoja.errores.map(e => ({ tipo: 'Foja Quirúrgica', descripcion: e })),
        ...erroresAltaMedica.map(e => ({ tipo: 'Alta Médica', descripcion: e })),
        ...erroresEpicrisis.map(e => ({ tipo: 'Epicrisis', descripcion: e })),
        ...erroresEstudios.map(e => ({ tipo: 'Estudios', descripcion: e })),
      ],
      comunicaciones,
      datos_adicionales: {
        doctores,
        resultadosFoja,
        diasHospitalizacion,
        advertencias
      }
    }).select();

    if (error) console.error('Error guardando en BD:', error);

    return new Response(
      JSON.stringify({ success: true, resultado, auditoriaId: data?.[0]?.id }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error procesando PDF:', error);
    return new Response(
      JSON.stringify({ error: 'Error procesando el archivo PDF', details: error?.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
