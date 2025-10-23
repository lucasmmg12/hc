// auditoria-handler.ts (Deno Edge Function)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

/* =========================
   Tipos base
   ========================= */
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
  equipo_quirurgico: Array<{ rol: string; nombre: string }>;
  fecha_cirugia: string | null;
  hora_inicio: string | null;
  hora_fin: string | null;
  errores: string[];
}

type CategoriaEstudio = "Imagenes" | "Laboratorio" | "Procedimientos";

interface Estudio {
  categoria: CategoriaEstudio;
  tipo: string;
  fecha?: string | null;
  hora?: string | null;
  lugar?: string | null;
  resultado?: string | null;
  informe_presente: boolean;
  advertencias: string[];
}

/* =========================
   Utilidades de normalización / fechas
   ========================= */
function normalizarTextoPDF(texto: string): string {
  texto = texto.replace(/\f/g, " ");
  texto = texto.replace(/\r\n/g, "\n");
  texto = texto.replace(/\r/g, "\n");

  const lineas = texto.split("\n");
  const lineasLimpias = lineas.map((l) => l.replace(/[ \t]+/g, " ").trim());

  texto = lineasLimpias.join("\n");
  texto = texto.replace(/^Página\s+\d+\s+de\s+\d+\s*$/gim, "");
  texto = texto.replace(/^Fecha\s+impresión:.*?$/gim, "");

  return texto;
}

function makeDate(d: string, hms?: string): Date {
  const [ddStr, mmStr, yyyyStr] = d.split("/");
  const dd = Number(ddStr);
  const mm = Number(mmStr);
  let yyyy = Number(yyyyStr);
  if (yyyy < 100) yyyy += 2000;

  let hh = 0, mi = 0, ss = 0;
  if (hms) {
    const parts = hms.split(":");
    hh = Number(parts[0] ?? 0);
    mi = Number(parts[1] ?? 0);
    ss = Number(parts[2] ?? 0);
  }
  return new Date(yyyy, (mm - 1), dd, hh, mi, ss);
}

function extractIngresoAlta(text: string): { ingreso: Date | null; alta: Date | null } {
  let ingreso: Date | null = null;
  let alta: Date | null = null;

  // Fecha + hora
  const reFechaHora =
    /fecha[\s_]*(ingreso|alta)[\s:]*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})[\s]+([0-9]{1,2}:[0-9]{2}(?::[0-9]{2})?)/gi;
  let m: RegExpExecArray | null;
  while ((m = reFechaHora.exec(text)) !== null) {
    const tipo = m[1].toLowerCase();
    const fecha = m[2];
    const hora = m[3];
    const dt = makeDate(fecha, hora);
    if (!Number.isNaN(dt.getTime())) {
      if (tipo === "ingreso") ingreso = dt;
      if (tipo === "alta") alta = dt;
    }
  }

  // Solo fecha
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

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Reglas:
 * - Egresado: ingreso incluido, alta EXCLUIDA.
 * - Internado: ingreso incluido, HOY incluido.
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
   Extracción de datos del paciente (sin “traducir” BOX)
   ========================= */
function extraerDatosPaciente(texto: string): DatosPaciente {
  const datos: DatosPaciente = { errores_admision: [] };
  const lineas = texto.split("\n");
  const textoInicial = lineas.slice(0, 80).join("\n"); // primeras líneas suelen tener cabecera

  // Nombre
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
  if (!datos.nombre) datos.errores_admision.push("Nombre del paciente no encontrado");

  // DNI
  const patronesDni = [/dni[:\s]*(\d{7,8})/i, /documento[:\s]*(\d{7,8})/i];
  for (const patron of patronesDni) {
    const match = textoInicial.match(patron);
    if (match) {
      datos.dni = match[1];
      break;
    }
  }
  if (!datos.dni) datos.errores_admision.push("DNI del paciente no encontrado");

  // Fecha nacimiento
  const match_nacimiento = textoInicial.match(/fecha[:\s]*nacimiento[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i);
  if (match_nacimiento) datos.fecha_nacimiento = match_nacimiento[1];
  else datos.errores_admision.push("Fecha de nacimiento no encontrada");

  // Sexo
  const match_sexo = textoInicial.match(/sexo[:\s]*(mujer|hombre|femenino|masculino|f|m)/i);
  if (match_sexo) {
    const sexo = match_sexo[1].toLowerCase();
    if (sexo === "f" || sexo === "femenino") datos.sexo = "Femenino";
    else if (sexo === "m" || sexo === "masculino") datos.sexo = "Masculino";
    else datos.sexo = sexo.charAt(0).toUpperCase() + sexo.slice(1);
  } else datos.errores_admision.push("Sexo del paciente no especificado");

  // Obra social
  const patronesObraSocial = [
    /obra[\s_]*social[\s:]*(\d+[\s-]*[A-Za-zÁÉÍÓÚáéíóúñÑ\s]+)/i,
    /obra[\s_]*social[\s:]*([A-Za-zÁÉÍÓÚáéíóúñÑ\s]+)/i,
  ];
  for (const patron of patronesObraSocial) {
    const match = textoInicial.match(patron);
    if (match && match[1].trim().length > 2) {
      datos.obra_social = match[1].trim();
      break;
    }
  }
  if (!datos.obra_social) datos.obra_social = "No encontrada";

  // Habitación: soportar "Hab:", "Habitación:", "Box:", "BOX", "Sala:", y NO confundir con "Caja"
  const patronesHabitacion = [
    /habitación[\s:]*([A-Za-z0-9\s\-]+)/i,
    /habitacion[\s:]*([A-Za-z0-9\s\-]+)/i,
    /\bhab[\s:]*([A-Za-z0-9\s\-]+)/i,
    /\bbox[\s:]*([A-Za-z0-9\s\-]+)/i, // preferimos BOX explícito
    /\bsala[\s:]*([A-Za-z0-9\s\-]+)/i,
  ];
  for (const patron of patronesHabitacion) {
    const match = textoInicial.match(patron);
    if (match && match[1].trim().length > 0) {
      // No cambiar "BOX" por "Caja", y evitar capturar líneas de "Caja" (administración)
      const full = match[0];
      if (/caja/i.test(full)) continue; // evita "Caja 3" de administración
      datos.habitacion = match[1].trim(); // conservar tal cual (si dice "BOX 3", queda "BOX 3")
      break;
    }
  }
  if (!datos.habitacion) datos.habitacion = "No encontrada";

  return datos;
}

/* =========================
   Evoluciones
   ========================= */
function extraerEvolucionesMejorado(
  texto: string,
  ingreso: Date,
  alta: Date
): { errores: string[]; evolucionesRepetidas: Evolucion[]; advertencias: Advertencia[] } {
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
    /evolucion[\s_\n]+diaria/i,
  ];

  const visitasEncontradas: Array<{ fecha: string; posicion: number }> = [];
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
      const [dia, mes, anio] = fechaStr.split("/");
      const diaPad = dia.padStart(2, "0");
      const mesPad = mes.padStart(2, "0");
      const fechaVisita = new Date(`${anio}-${mesPad}-${diaPad}`);

      if (
        fechaVisita >= new Date(fechaAdmisionDate.toDateString()) &&
        fechaVisita <= new Date(fechaAltaDate.toDateString())
      ) {
        visitasPorFecha.set(fechaStr, (visitasPorFecha.get(fechaStr) || 0) + 1);

        const bloqueTexto = textoNormalizado.substring(posicion, posicion + 2000);
        for (const patron of patronesEvolDiaria) {
          const m = bloqueTexto.match(patron);
          if (m) {
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
      const [dia, mes, anio] = fechaStr.split("/");
      const diaPad = dia.padStart(2, "0");
      const mesPad = mes.padStart(2, "0");
      const fechaVisita = new Date(`${anio}-${mesPad}-${diaPad}`);

      if (!diasConEvolucion.has(fechaStr)) {
        if (fechaVisita.getTime() === new Date(fechaAdmisionDate.toDateString()).getTime()) {
          // día admisión: ok sin evolución
        } else if (fechaVisita.getTime() === new Date(fechaAltaDate.toDateString()).getTime()) {
          advertencias.push({
            tipo: "Día de alta sin evolución",
            descripcion: `⚠️ ADVERTENCIA: ${fechaStr} - Es el día de alta, generalmente no requiere evolución diaria`,
            fecha: fechaStr,
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
  const lineas = texto.split("\n");
  const ultimasLineas = lineas.slice(-500).join("\n");

  const patronesAlta = [
    /alta\s+médica/i,
    /alta\s+medica/i,
    /registro\s+de\s+alta/i,
    /egreso\s+sanatorial/i,
    /egreso\s+hospitalario/i,
    /discharge/i,
    /egreso/i,
  ];

  let altaEncontrada = false;
  for (const patron of patronesAlta) {
    const match = ultimasLineas.match(patron);
    if (match) {
      altaEncontrada = true;
      break;
    }
  }

  if (!altaEncontrada) errores.push("❌ CRÍTICO: Falta registro de alta médica");
  return errores;
}

function verificarEpicrisis(texto: string): string[] {
  const errores: string[] = [];
  const lineas = texto.split("\n");

  const patronesEpicrisis = [
    /epicrisis/i,
    /epicrísis/i,
    /resumen\s+de\s+alta/i,
    /cierre\s+de\s+atencion/i,
    /cierre\s+de\s+atención/i,
    /indicaciones\s+y\s+evolución/i,
  ];

  let epicrisisEncontrada = false;
  const inicioUltimaHoja = Math.max(0, lineas.length - 400);
  const lineasFinales = lineas.slice(inicioUltimaHoja);

  for (let i = 0; i < lineasFinales.length; i++) {
    const lineaOriginal = lineasFinales[i];
    if (lineaOriginal.trim().length > 0) {
      for (const patron of patronesEpicrisis) {
        if (patron.test(lineaOriginal)) {
          epicrisisEncontrada = true;
          break;
        }
      }
    }
    if (epicrisisEncontrada) break;
  }

  if (!epicrisisEncontrada) errores.push("❌ CRÍTICO: No existe epicrisis (resumen de alta)");
  return errores;
}

/* =========================
   Doctores y Foja Quirúrgica
   ========================= */
function extraerDoctores(texto: string): {
  residentes: Doctor[];
  cirujanos: Doctor[];
  otros: Doctor[];
} {
  const doctores = { residentes: [] as Doctor[], cirujanos: [] as Doctor[], otros: [] as Doctor[] };
  const lineas = texto.split("\n");

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
        const contexto = lineas.slice(Math.max(0, i - 5), Math.min(i + 5, lineas.length)).join(" ").toLowerCase();

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

  const rolesCriticos = ["cirujano", "primer_ayudante", "instrumentador", "anestesista"];
  const nombresPorRol: { [key: string]: string } = {};

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
          `❌ CRÍTICO: El ${rol1.replace("_", " ")} y el ${rol2.replace("_", " ")} tienen el mismo nombre: ${nombre1}. Deben ser diferentes.`
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
    errores: [],
  };

  const patronesFoja = [
    /foja\s+quirúrgica/i,
    /hoja\s+quirúrgica/i,
    /protocolo\s+quirúrgico/i,
    /protocolo\s+operatorio/i,
    /registro\s+quirúrgico/i,
    /parte\s+quirúrgico/i,
  ];

  let matchFoja: RegExpMatchArray | null = null;
  for (const patron of patronesFoja) {
    matchFoja = texto.match(patron);
    if (matchFoja) break;
  }

  // Si NO se detecta header, intentamos inferir si hubo cirugía por indicadores
  if (!matchFoja) {
    const indicadoresQuirurgicos = [
      /cirujano[:\s]*([A-Z][A-Z\s,]+)/i,
      /anestesista[:\s]*([A-Z][A-Z\s,]+)/i,
      /hora\s+comienzo[:\s]*(\d{1,2}:\d{2})/i,
      /bisturí\s+armónico/i,
    ];
    let indicadoresEncontrados = 0;
    for (const r of estosIndicadores(indicadoresQuirurgicos, texto)) if (r) indicadoresEncontrados++;
    // Si < 2 indicadores -> NO considerar foja (no fue cirugía). No agregamos error.
    if (indicadoresEncontrados < 2) return resultados;
  }

  const inicioFoja = matchFoja ? (matchFoja.index || 0) : 0;
  const textoFoja = texto.substring(inicioFoja, inicioFoja + 3000);

  // Bisturí armónico
  const patronesBisturi = [
    /uso\s+de\s+bisturí\s+armónico\??[:\s]*(si|no)/i,
    /bisturí\s+armónico\??[:\s]*(si|no)/i,
    /armónico\??[:\s]*(si|no)/i,
    /bisturí.*?(si|no)/i,
    /armónico.*?(si|no)/i,
  ];
  for (const patron of patronesBisturi) {
    const m = textoFoja.match(patron);
    if (m) {
      resultados.bisturi_armonico = m[1].toUpperCase();
      break;
    }
  }

  // Equipo
  const patronesEquipo = {
    cirujano: /cirujano[:\s]*([A-Z][A-Z\s,]+)/i,
    primer_ayudante: /primer\s+ayudante[:\s]*([A-Z][A-Z\s,]+)/i,
    anestesista: /anestesista[:\s]*([A-Z][A-Z\s,]+)/i,
    instrumentador: /instrumentador[:\s]*([A-Z][A-Z\s,]+)/i,
    ayudante_residencia: /ayudante\s+residencia[:\s]*([A-Z][A-Z\s,]+)/i,
    ayudante: /ayudante[:\s]*([A-Z][A-Z\s,]+)/i,
  };
  for (const [rol, patron] of Object.entries(patronesEquipo)) {
    const m = textoFoja.match(patron);
    if (m) resultados.equipo_quirurgico.push({ rol, nombre: m[1].trim() });
  }

  // Horas / fecha
  const patronesHoraInicio = [
    /hora\s+comienzo[:\s]*(\d{1,2}:\d{2})/i,
    /hora\s+inicio[:\s]*(\d{1,2}:\d{2})/i,
    /comienzo[:\s]*(\d{1,2}:\d{2})/i,
  ];
  let horaInicioEncontrada = false;
  for (const patron of patronesHoraInicio) {
    const m = textoFoja.match(patron);
    if (m) {
      resultados.hora_inicio = m[1];
      horaInicioEncontrada = true;

      const textoAntes = textoFoja.substring(0, m.index ?? 0);
      const patronesFecha = [/fecha[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i, /(\d{1,2}\/\d{1,2}\/\d{4})/];

      let fechaEncontrada = false;
      for (const pf of patronesFecha) {
        const f = textoAntes.match(pf);
        if (f) {
          resultados.fecha_cirugia = f[1];
          fechaEncontrada = true;
          break;
        }
      }
      if (!fechaEncontrada) resultados.errores.push("❌ CRÍTICO: Fecha de cirugía no encontrada en foja quirúrgica");
      break;
    }
  }
  if (!horaInicioEncontrada) resultados.errores.push("❌ CRÍTICO: Hora de comienzo no encontrada en foja quirúrgica");

  const patronesHoraFin = [
    /hora\s+finalización[:\s]*(\d{1,2}:\d{2})/i,
    /hora\s+fin[:\s]*(\d{1,2}:\d{2})/i,
    /finalización[:\s]*(\d{1,2}:\d{2})/i,
  ];
  for (const patron of patronesHoraFin) {
    const m = textoFoja.match(patron);
    if (m) {
      resultados.hora_fin = m[1];
      break;
    }
  }
  if (!resultados.hora_fin) resultados.errores.push("⚠️ ADVERTENCIA: Hora de finalización no encontrada en foja quirúrgica");

  return resultados;
}

function* estosIndicadores(regs: RegExp[], txt: string) {
  for (const r of regs) yield r.test(txt);
}

/* =========================
   NUEVO: Extraer Estudios
   ========================= */
function extraerEstudios(texto: string): {
  estudios: Estudio[];
  erroresEstudios: string[];
  conteo: { total: number; imagenes: number; laboratorio: number; procedimientos: number };
} {
  const tx = normalizarTextoPDF(texto);
  const lineas = tx.split("\n");

  const reFecha = /(\b\d{1,2}\/\d{1,2}\/\d{2,4}\b)/i;
  const reHora = /(\b\d{1,2}:\d{2}(?::\d{2})?\b)/;
  const reInforme = /(informe|impresion|impresión|conclusion|conclusión|resultado)/i;

  const patronesImagenes: Array<[RegExp, string]> = [
    [/\b(tac|tc|tomografia|tomografía)\b.*?(cerebro|craneo|cráneo|torax|tórax|abdomen|pelvis|columna|cuello)?/i, "TAC"],
    [/\b(rm|rmn|resonancia)\b.*?(cerebro|craneo|cráneo|columna|rodilla|hombro|abdomen|pelvis|torax|tórax)?/i, "Resonancia Magnética"],
    [/\b(rx|r[xg]rafia|radiografia|radiografía)\b.*?(torax|tórax|columna|miembro|mano|muñeca|cadera|pelvis)?/i, "Radiografía"],
    [/\b(eco|ecografia|ecografía|us|ultrasonido)\b.*?(abdominal|hepato|vesicular|renal|tiroides|obstetrica|doppler|partes blandas)?/i, "Ecografía"],
    [/\bdoppler\b.*?(venoso|arterial|miembros|carotideo|carotídeo)?/i, "Doppler"],
    [/\bangiotac|angio[-\s]?rm\b/i, "Angio"],
  ];

  const patronesLab: Array<[RegExp, string]> = [
    [/\bhemograma( completo)?\b/i, "Hemograma"],
    [/\bpcr\b(?![-\w])/i, "PCR"],
    [/\bvsg\b/i, "VSG"],
    [/\bglucemia\b/i, "Glucemia"],
    [/\bcreatinin(a|emia)?\b/i, "Creatinina"],
    [/\burea\b/i, "Urea"],
    [/\bionograma|sodio|potasio|cloro\b/i, "Ionograma"],
    [/\bhepatic[oa]|tgo|tgp|gamm?aglutamil|bilirrubin(a|as)?\b/i, "Perfil hepático"],
    [/\bur[ie]nalisis|sumario de orina|orina completa\b/i, "Orina completa"],
  ];

  const patronesProc: Array<[RegExp, string]> = [
    [/\bendoscop[ií]a (alta|digestiva alta)\b/i, "Endoscopía alta"],
    [/\bcolonoscop[ií]a\b/i, "Colonoscopía"],
    [/\bbroncoscop[ií]a\b/i, "Broncoscopía"],
    [/\beco[-\s]?cardiogram?a\b/i, "Ecocardiograma"],
    [/\becg|electrocardiograma\b/i, "Electrocardiograma"],
    [/\bparacentesis|toracocentesis|puncion lumbar|punción lumbar\b/i, "Procedimiento"],
  ];

  const estudios: Estudio[] = [];
  const pushEstudio = (categoria: CategoriaEstudio, tipo: string, linea: string) => {
    const fecha = linea.match(reFecha)?.[1] || null;
    const hora = linea.match(reHora)?.[1] || null;
    const informe_presente = reInforme.test(linea);
    const advertencias: string[] = [];
    if (!informe_presente) advertencias.push("sin informe");
    if (!fecha) advertencias.push("sin fecha");

    const lugar = linea.match(/servicio[:\s]+([a-z0-9\s]+)$/i)?.[1] || null;

    let resultado: string | null = null;
    const mRes = linea.match(/(resultado|impresi[oó]n|conclusi[oó]n)[:\s-]+(.{10,200})/i);
    if (mRes) resultado = mRes[2].trim();

    estudios.push({
      categoria,
      tipo: tipoDetectado(tipo, linea),
      fecha,
      hora,
      lugar,
      resultado,
      informe_presente,
      advertencias,
    });
  };

  const tipoDetectado = (base: string, linea: string) => {
    const zona =
      linea.match(
        /de\s+(t[oó]rax|abdomen|pelvis|columna|cerebro|cr[aá]neo|cuello|rodilla|hombro|hep[aá]tico|renal|tiroides|obst[eé]trica|venoso|arterial|car[oó]tideo)/i
      )?.[1] || "";
    return zona ? `${base} de ${zona}` : base;
  };

  for (const l of lineas) {
    const linea = l.trim();
    if (!linea) continue;

    let matched = false;
    for (const [re, label] of patronesImagenes) {
      if (re.test(linea)) {
        pushEstudio("Imagenes", label, linea);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    for (const [re, label] of patronesLab) {
      if (re.test(linea)) {
        pushEstudio("Laboratorio", label, linea);
        matched = true;
        break;
      }
    }
    if (matched) continue;

    for (const [re, label] of patronesProc) {
      if (re.test(linea)) {
        pushEstudio("Procedimientos", label, linea);
        break;
      }
    }
  }

  // Deduplicación tipo+fecha
  const visto = new Set<string>();
  const dedup: Estudio[] = [];
  for (const e of estudios) {
    const key = `${e.categoria}|${(e.tipo || "").toUpperCase()}|${e.fecha || "NA"}`;
    if (!visto.has(key)) {
      visto.add(key);
      dedup.push(e);
    }
  }

  const conteo = {
    total: dedup.length,
    imagenes: dedup.filter((e) => e.categoria === "Imagenes").length,
    laboratorio: dedup.filter((e) => e.categoria === "Laboratorio").length,
    procedimientos: dedup.filter((e) => e.categoria === "Procedimientos").length,
  };

  const erroresEstudios: string[] = [];
  for (const e of dedup) {
    if (!e.informe_presente) {
      erroresEstudios.push(`Estudio sin informe: [${e.categoria}] ${e.tipo}${e.fecha ? ` (${e.fecha})` : ""}`);
    }
  }

  return { estudios: dedup, erroresEstudios, conteo };
}

/* =========================
   Comunicaciones (con estudios y reglas de “no aplica”)
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

  // Admisión
  if (erroresAdmision.length > 0) {
    comunicaciones.push({
      sector: "Admisión",
      responsable: "Personal de Admisión",
      motivo: "Datos de admisión incompletos",
      urgencia: "ALTA",
      errores: erroresAdmision,
      mensaje: `Se detectaron errores en admisión: ${erroresAdmision.join(
        ", "
      )}. Completar información antes del envío a OSDE.`,
    });
  }

  // Residentes - Evoluciones
  if (erroresEvolucion.length > 0) {
    const residentesUnicos: Doctor[] = [];
    const nombresVistos = new Set<string>();
    for (const r of doctores.residentes) {
      if (!nombresVistos.has(r.nombre)) {
        residentesUnicos.push(r);
        nombresVistos.add(r.nombre);
      }
    }
    if (residentesUnicos.length > 0) {
      const nombres = residentesUnicos.map((r) => `Dr/a ${r.nombre}`).join(", ");
      comunicaciones.push({
        sector: "Residentes",
        responsable: nombres,
        motivo: "Problemas en evoluciones médicas diarias",
        urgencia: "ALTA",
        errores: erroresEvolucion,
        mensaje: `Estimados/as ${nombres}: hay ${erroresEvolucion.length} días sin evolución diaria. Completar antes del envío a OSDE.`,
      });
    } else {
      comunicaciones.push({
        sector: "Residentes",
        responsable: "Equipo de Residentes",
        motivo: "Problemas en evoluciones médicas diarias",
        urgencia: "ALTA",
        errores: erroresEvolucion,
        mensaje: "Se detectaron días sin evolución. Completar las evoluciones faltantes.",
      });
    }
  }

  // Advertencias
  if (advertencias.length > 0) {
    comunicaciones.push({
      sector: "Residentes",
      responsable: "Equipo de Residentes",
      motivo: "Advertencias sobre evoluciones",
      urgencia: "MEDIA",
      errores: advertencias.map((a) => a.descripcion),
      mensaje: `Se detectaron ${advertencias.length} advertencias relacionadas con evoluciones. Revisar.`,
    });
  }

  // Alta médica
  if (erroresAltaMedica.length > 0) {
    const cirUnicos: Doctor[] = [];
    const setN = new Set<string>();
    for (const c of doctores.cirujanos) {
      if (!setN.has(c.nombre)) {
        cirUnicos.push(c);
        setN.add(c.nombre);
      }
    }
    const nombres = cirUnicos.length ? cirUnicos.map((c) => `Dr/a ${c.nombre}`).join(", ") : "Cirujano Responsable";
    comunicaciones.push({
      sector: "Cirugía",
      responsable: nombres,
      motivo: "Falta registro de alta médica",
      urgencia: "CRÍTICA",
      errores: erroresAltaMedica,
      mensaje: `Se detectó ausencia de alta médica. Completar antes del envío a OSDE.`,
    });
  }

  // Epicrisis
  if (erroresEpicrisis.length > 0) {
    const cirUnicos: Doctor[] = [];
    const setN = new Set<string>();
    for (const c of doctores.cirujanos) {
      if (!setN.has(c.nombre)) {
        cirUnicos.push(c);
        setN.add(c.nombre);
      }
    }
    const nombres = cirUnicos.length ? cirUnicos.map((c) => `Dr/a ${c.nombre}`).join(", ") : "Cirujano Responsable";
    comunicaciones.push({
      sector: "Cirugía",
      responsable: nombres,
      motivo: "Falta epicrisis (resumen de alta)",
      urgencia: "CRÍTICA",
      errores: erroresEpicrisis,
      mensaje: `Falta epicrisis. Completar antes del envío a OSDE.`,
    });
  }

  // Foja quirúrgica
  if (erroresFoja.length > 0) {
    const cirUnicos: Doctor[] = [];
    const setN = new Set<string>();
    for (const c of doctores.cirujanos) {
      if (!setN.has(c.nombre)) {
        cirUnicos.push(c);
        setN.add(c.nombre);
      }
    }
    const nombres = cirUnicos.length ? cirUnicos.map((c) => `Dr/a ${c.nombre}`).join(", ") : "Cirujano Responsable";
    comunicaciones.push({
      sector: "Cirugía",
      responsable: nombres,
      motivo: "Problemas en foja quirúrgica",
      urgencia: "ALTA",
      errores: erroresFoja,
      mensaje: `Se detectaron inconsistencias en foja quirúrgica. Completar antes del envío a OSDE.`,
    });
  }

  // Bisturí armónico (solo si aplica y fue "SI")
  if (resultadosFoja.bisturi_armonico === "SI") {
    const cirUnicos: Doctor[] = [];
    const setN = new Set<string>();
    for (const c of doctores.cirujanos) {
      if (!setN.has(c.nombre)) {
        cirUnicos.push(c);
        setN.add(c.nombre);
      }
    }
    const nombres = cirUnicos.length ? cirUnicos.map((c) => `Dr/a ${c.nombre}`).join(", ") : "Cirujano Responsable";
    comunicaciones.push({
      sector: "Cirugía",
      responsable: nombres,
      motivo: "Uso de bisturí armónico - Requiere autorización",
      urgencia: "CRÍTICA",
      errores: ["Se utilizó bisturí armónico"],
      mensaje: `Se detectó uso de BISTURÍ ARMÓNICO. Requiere autorización de OSDE previa a facturación. Verificar.`,
    });
  }

  // Estudios sin informe → servicios
  const sinInforme = estudios.filter((e) => !e.informe_presente);
  if (sinInforme.length > 0) {
    const errores = sinInforme.map((e) => `[${e.categoria}] ${e.tipo}${e.fecha ? ` (${e.fecha})` : ""}`);
    if (sinInforme.some((e) => e.categoria === "Imagenes")) {
      comunicaciones.push({
        sector: "Diagnóstico por Imágenes",
        responsable: "Jefe/a de Servicio",
        motivo: "Estudios de imágenes sin informe",
        urgencia: "ALTA",
        errores,
        mensaje: `Estudios de imágenes sin informe: ${errores
          .filter((s) => s.includes("[Imagenes]"))
          .join("; ")}. Emitir/adjuntar informe.`,
      });
    }
    if (sinInforme.some((e) => e.categoria === "Laboratorio")) {
      comunicaciones.push({
        sector: "Laboratorio",
        responsable: "Jefe/a de Laboratorio",
        motivo: "Estudios de laboratorio sin resultado/informe",
        urgencia: "MEDIA",
        errores,
        mensaje: `Laboratorio sin resultado/informe claro: ${errores
          .filter((s) => s.includes("[Laboratorio]"))
          .join("; ")}. Adjuntar resultados normalizados.`,
      });
    }
    if (sinInforme.some((e) => e.categoria === "Procedimientos")) {
      comunicaciones.push({
        sector: "Endoscopía / Procedimientos",
        responsable: "Responsable de Procedimientos",
        motivo: "Procedimientos sin informe",
        urgencia: "ALTA",
        errores,
        mensaje: `Procedimientos sin informe: ${errores
          .filter((s) => s.includes("[Procedimientos]"))
          .join("; ")}. Cargar informe y conclusiones.`,
      });
    }
  }

  // Traza de normalización de estudios
  if (erroresEstudios.length > 0) {
    comunicaciones.push({
      sector: "Coordinación de Historias Clínicas",
      responsable: "Equipo Coordinación",
      motivo: "Normalización de estudios",
      urgencia: "MEDIA",
      errores: erroresEstudios,
      mensaje: "Se detectaron estudios sin informe/fecha. Normalizar documentación.",
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
    const pdfText = formData.get("pdfText") as string;
    const nombreArchivo = formData.get("nombreArchivo") as string;

    if (!pdfText || !nombreArchivo) {
      return new Response(JSON.stringify({ error: "Faltan datos requeridos" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { ingreso, alta } = extractIngresoAlta(pdfText);
    if (!ingreso || Number.isNaN(ingreso.getTime())) {
      return new Response(JSON.stringify({ error: "No se pudo extraer la fecha de ingreso (dato obligatorio)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const altaValida = !!(alta && !Number.isNaN(alta.getTime()));
    const fechaAlta = altaValida ? alta! : new Date();
    const pacienteInternado = !altaValida;

    const datosPaciente = extraerDatosPaciente(pdfText);
    const { errores: erroresEvolucion, evolucionesRepetidas, advertencias } = extraerEvolucionesMejorado(
      pdfText,
      ingreso,
      fechaAlta
    );

    // Alta/Epicrisis: si está internado, no aplica (no se evalúa ni como error)
    const erroresAltaMedica = pacienteInternado ? [] : verificarAltaMedica(pdfText);
    const erroresEpicrisis = pacienteInternado ? [] : verificarEpicrisis(pdfText);

    const doctores = extraerDoctores(pdfText);
    let resultadosFoja = analizarFojaQuirurgica(pdfText);

    // Determinar si hubo cirugía: foja "real" (al menos algún elemento claro)
    const hayFojaQuirurgica =
      resultadosFoja.equipo_quirurgico.length > 0 ||
      resultadosFoja.fecha_cirugia !== null ||
      resultadosFoja.hora_inicio !== null;

    // Si NO hubo cirugía: no aplica foja ni bisturí ni errores de foja
    if (!hayFojaQuirurgica) {
      resultadosFoja = {
        bisturi_armonico: null,
        equipo_quirurgico: [],
        fecha_cirugia: null,
        hora_inicio: null,
        hora_fin: null,
        errores: [],
      };
    } else {
      // Validar equipo quirúrgico único solo si hay cirugía
      const erroresEquipoUnico = validarEquipoQuirurgicoUnico(resultadosFoja);
      if (erroresEquipoUnico.length > 0) resultadosFoja.errores.push(...erroresEquipoUnico);
    }

    // Estudios
    const { estudios, erroresEstudios, conteo: estudiosConteo } = extraerEstudios(pdfText);

    // Comunicaciones (pasan arrays ya filtrados por “no aplica”)
    const comunicaciones = generarComunicacionesOptimizadas(
      erroresEvolucion,
      advertencias,
      erroresAltaMedica,
      erroresEpicrisis,
      datosPaciente.errores_admision,
      resultadosFoja.errores, // si no hay cirugía vendrá vacío
      doctores,
      resultadosFoja,
      estudios,
      erroresEstudios
    );

    // Total de errores (sin alta/epicrisis cuando internado, sin foja si no hubo cirugía)
    const totalErrores =
      datosPaciente.errores_admision.length +
      erroresEvolucion.length +
      resultadosFoja.errores.length +
      erroresAltaMedica.length + // ya es [] si internado
      erroresEpicrisis.length + // ya es [] si internado
      erroresEstudios.length;

    const diasHospitalizacion = diasHospitalizacionCalc(ingreso, altaValida ? fechaAlta : null);

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
      estudios,
      estudiosConteo,
      erroresEstudios,
      comunicaciones,
      totalErrores,
      estado: totalErrores > 0 ? "Pendiente de corrección" : "Aprobado",
    };

    // Guardar en Supabase
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from("auditorias")
      .insert({
        nombre_archivo: nombreArchivo,
        nombre_paciente: datosPaciente.nombre || "No encontrado",
        dni_paciente: datosPaciente.dni || "No encontrado",
        obra_social: datosPaciente.obra_social || "No encontrada",
        habitacion: datosPaciente.habitacion || "No encontrada",
        fecha_ingreso: ingreso.toISOString(),
        fecha_alta: pacienteInternado ? null : fechaAlta.toISOString(),
        total_errores: totalErrores,
        errores_admision: datosPaciente.errores_admision.length,
        errores_evoluciones: erroresEvolucion.length,
        errores_foja_quirurgica: resultadosFoja.errores.length,
        errores_alta_medica: erroresAltaMedica.length,
        errores_epicrisis: erroresEpicrisis.length,
        bisturi_armonico: resultadosFoja.bisturi_armonico || "No determinado",
        estado: totalErrores > 0 ? "Pendiente de corrección" : "Aprobado",

        // Estudios
        estudios_total: estudiosConteo.total,
        estudios_imagenes: estudiosConteo.imagenes,
        estudios_laboratorio: estudiosConteo.laboratorio,
        estudios_procedimientos: estudiosConteo.procedimientos,
        estudios, // JSON completo
        errores_estudios: erroresEstudios,

        // Detalle plano de errores
        errores_detalle: [
          ...datosPaciente.errores_admision.map((e) => ({ tipo: "Admisión", descripcion: e })),
          ...erroresEvolucion.map((e) => ({ tipo: "Evolución", descripcion: e })),
          ...advertencias.map((a) => ({ tipo: a.tipo, descripcion: a.descripcion })),
          ...resultadosFoja.errores.map((e) => ({ tipo: "Foja Quirúrgica", descripcion: e })),
          ...erroresAltaMedica.map((e) => ({ tipo: "Alta Médica", descripcion: e })),
          ...erroresEpicrisis.map((e) => ({ tipo: "Epicrisis", descripcion: e })),
          ...erroresEstudios.map((e) => ({ tipo: "Estudios", descripcion: e })),
        ],
        comunicaciones,
        datos_adicionales: {
          doctores,
          resultadosFoja,
          diasHospitalizacion,
          advertencias,
        },
      })
      .select();

    if (error) {
      console.error("Error guardando en BD:", error);
    }

    return new Response(JSON.stringify({ success: true, resultado, auditoriaId: data?.[0]?.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("Error procesando PDF:", error);
    return new Response(JSON.stringify({ error: "Error procesando el archivo PDF", details: error?.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
