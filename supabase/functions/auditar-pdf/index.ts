// auditoria-handler.ts
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
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

/* ======== NUEVO: Estudios ======== */
type CategoriaEstudio = "Imagenes" | "Laboratorio" | "Procedimientos";

interface Estudio {
  categoria: CategoriaEstudio;
  tipo: string;
  fecha?: string | null; // DD/MM/YYYY
  hora?: string | null; // HH:mm
  lugar?: string | null;
  resultado?: string | null;
  informe_presente: boolean;
  advertencias: string[];
  numero_hoja?: number; // Número de página donde se encontró el estudio
}

/* =========================
   Utilidades
   ========================= */
function normalizarTextoPDF(texto: string): string {
  // NO traducimos términos (p.ej. BOX) — solo limpieza de espacios/saltos
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

// Construye fecha sin depender del parser de JS
function makeDate(d: string, hms?: string): Date {
  const [ddStr, mmStr, yyyyStr] = d.split("/");
  const dd = Number(ddStr);
  const mm = Number(mmStr);
  let yyyy = Number(yyyyStr);
  if (yyyy < 100) yyyy += 2000;
  let hh = 0,
    mi = 0,
    ss = 0;
  if (hms) {
    const parts = hms.split(":");
    hh = Number(parts[0] ?? 0);
    mi = Number(parts[1] ?? 0);
    ss = Number(parts[2] ?? 0);
  }
  return new Date(yyyy, mm - 1, dd, hh, mi, ss);
}

function extractIngresoAlta(text: string): { ingreso: Date | null; alta: Date | null } {
  let ingreso: Date | null = null;
  let alta: Date | null = null;

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

  if (!ingreso) {
    const mi = text.match(
      /fecha[\s_]*ingreso[\s:]*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i
    );
    if (mi) {
      const dt = makeDate(mi[1]);
      if (!Number.isNaN(dt.getTime())) ingreso = dt;
    }
  }

  if (!alta) {
    const ma = text.match(
      /fecha[\s_]*alta[\s:]*([0-9]{1,2}\/[0-9]{1,2}\/[0-9]{2,4})/i
    );
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
 * - Mismo día: 0 días.
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
  const diffIncluyendoHoy =
    Math.floor((hoy.getTime() - si.getTime()) / MS_DIA) + 1;
  return Math.max(1, diffIncluyendoHoy);
}

/* =========================
   Extracción de datos del paciente
   ========================= */
function extraerDatosPaciente(texto: string): DatosPaciente {
  const datos: DatosPaciente = { errores_admision: [] };
  const tx = normalizarTextoPDF(texto);
  const lineas = tx.split("\n");
  const textoInicial = lineas.slice(0, 120).join("\n"); // ampliamos ventana

  // Nombre
  const patronesNombre = [
    /nombre[:\s]*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s,]+)/i,
    /paciente[:\s]*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s,]+)/i,
    /apellido[:\s]*([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s,]+)/i,
  ];
  for (const patron of patronesNombre) {
    const m = textoInicial.match(patron);
    if (m && m[1].trim().length > 3) {
      datos.nombre = m[1].trim();
      break;
    }
  }
  if (!datos.nombre) datos.errores_admision.push("Nombre del paciente no encontrado");

  // DNI
  const patronesDni = [/dni[:\s]*(\d{7,8})/i, /documento[:\s]*(\d{7,8})/i];
  for (const patron of patronesDni) {
    const m = textoInicial.match(patron);
    if (m) {
      datos.dni = m[1];
      break;
    }
  }
  if (!datos.dni) datos.errores_admision.push("DNI del paciente no encontrado");

  // Fecha nacimiento
  const nac = textoInicial.match(
    /fecha[:\s]*nacimiento[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i
  );
  if (nac) datos.fecha_nacimiento = nac[1];
  else datos.errores_admision.push("Fecha de nacimiento no encontrada");

  // Sexo
  const mSexo = textoInicial.match(
    /sexo[:\s]*(mujer|hombre|femenino|masculino|f|m)/i
  );
  if (mSexo) {
    const s = mSexo[1].toLowerCase();
    if (s === "f" || s === "femenino") datos.sexo = "Femenino";
    else if (s === "m" || s === "masculino") datos.sexo = "Masculino";
    else datos.sexo = s.charAt(0).toUpperCase() + s.slice(1);
  } else datos.errores_admision.push("Sexo del paciente no especificado");

  // Obra social
  const patronesOS = [
    /obra[\s_]*social[\s:]*(\d+[\s-]*[A-Za-zÁÉÍÓÚáéíóúñÑ\s]+)/i,
    /obra[\s_]*social[\s:]*([A-Za-zÁÉÍÓÚáéíóúñÑ\s]+)/i,
  ];
  for (const p of patronesOS) {
    const m = textoInicial.match(p);
    if (m && m[1].trim().length > 2) {
      datos.obra_social = m[1].trim();
      break;
    }
  }
  if (!datos.obra_social) datos.obra_social = "No encontrada";

  // Habitación (no traducir "BOX")
  // Buscamos primero coincidencias con BOX y priorizamos esa.
  const reHabGenerico =
    /habitación[:\s]*([A-Za-z0-9\s\-]+)|habitacion[:\s]*([A-Za-z0-9\s\-]+)|hab[:\s]*([A-Za-z0-9\s\-]+)|box[:\s]*([A-Za-z0-9\s\-]+)|sala[:\s]*([A-Za-z0-9\s\-]+)/i;

  // Primera pasada en primeras líneas
  let habMatch =
    textoInicial.match(reHabGenerico)?.slice(1).find(Boolean) || null;

  // Si no aparece o parece "CAJA", buscamos en todo el documento priorizando BOX
  const matchBoxGlobal = tx.match(/box[:\s-]*([A-Za-z0-9\- ]+)/i);
  if (matchBoxGlobal) {
    const val = (matchBoxGlobal[0] || "").replace(/^.*?box[:\s-]*/i, "").trim();
    if (val) habMatch = `BOX ${val}`.replace(/\s+/g, " ").trim();
  } else if (!habMatch) {
    const mAll =
      tx.match(reHabGenerico)?.slice(1).find(Boolean) || null;
    if (mAll) habMatch = String(mAll).trim();
  }

  if (habMatch) {
    // Normalizamos solamente formato (no traducimos)
    const raw = habMatch.replace(/[ ,]+-?$/, "").trim();
    // Si comienza con BOX, lo dejamos en mayúsculas
    datos.habitacion = /^box\b/i.test(raw) ? raw.toUpperCase() : raw;
    // Parche: si el OCR tradujo a "CAJA" y existe BOX en el doc, ya fue reemplazado arriba
  } else {
    datos.habitacion = "No encontrada";
  }

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

  const patronVisita =
    /visita[\s_]+(\d{1,2}\/\d{1,2}\/\d{4})(?:\s+\d{1,2}:\d{2})?/gi;
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

  for (const v of visitasEncontradas) {
    const fechaStr = v.fecha;
    const posicion = v.posicion;
    try {
      const [d, m, a] = fechaStr.split("/");
      const fechaVisita = new Date(`${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
      if (
        fechaVisita >= new Date(fechaAdmisionDate.toDateString()) &&
        fechaVisita <= new Date(fechaAltaDate.toDateString())
      ) {
        visitasPorFecha.set(fechaStr, (visitasPorFecha.get(fechaStr) || 0) + 1);
        const bloque = textoNormalizado.substring(posicion, posicion + 2000);
        for (const p of patronesEvolDiaria) {
          if (bloque.match(p)) {
            diasConEvolucion.add(fechaStr);
            break;
          }
        }
      }
    } catch {}
  }

  const fechasYa = new Set<string>();
  for (const [fechaStr] of visitasPorFecha) {
    if (fechasYa.has(fechaStr)) continue;
    fechasYa.add(fechaStr);
    try {
      const [d, m, a] = fechaStr.split("/");
      const f = new Date(`${a}-${m.padStart(2, "0")}-${d.padStart(2, "0")}`);
      if (!diasConEvolucion.has(fechaStr)) {
        if (f.getTime() === new Date(fechaAdmisionDate.toDateString()).getTime()) {
          // día de admisión: ok
        } else if (f.getTime() === new Date(fechaAltaDate.toDateString()).getTime()) {
          advertencias.push({
            tipo: "Día de alta sin evolución",
            descripcion: `⚠️ ADVERTENCIA: ${fechaStr} - Día de alta, usualmente no requiere evolución diaria`,
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
  const ultimasLineas = texto.split("\n").slice(-500).join("\n");
  const patronesAlta = [
    /alta\s+médica/i,
    /alta\s+medica/i,
    /registro\s+de\s+alta/i,
    /egreso\s+sanatorial/i,
    /egreso\s+hospitalario/i,
    /discharge/i,
    /egreso/i,
  ];
  let ok = false;
  for (const p of patronesAlta) {
    if (ultimasLineas.match(p)) {
      ok = true;
      break;
    }
  }
  if (!ok) errores.push("❌ CRÍTICO: Falta registro de alta médica");
  return errores;
}

function verificarEpicrisis(texto: string): string[] {
  const errores: string[] = [];
  const lineas = texto.split("\n");
  const patrones = [
    /epicrisis/i,
    /epicrísis/i,
    /resumen\s+de\s+alta/i,
    /cierre\s+de\s+atenci[oó]n/i,
    /indicaciones\s+y\s+evoluci[oó]n/i,
  ];
  const inicioUltimaHoja = Math.max(0, lineas.length - 400);
  const ult = lineas.slice(inicioUltimaHoja);
  let ok = false;
  for (const l of ult) {
    if (l.trim().length === 0) continue;
    for (const p of patrones) {
      if (p.test(l)) {
        ok = true;
        break;
      }
    }
    if (ok) break;
  }
  if (!ok) errores.push("❌ CRÍTICO: No existe epicrisis (resumen de alta)");
  return errores;
}

/* =========================
   Doctores / Foja
   ========================= */
function extraerDoctores(texto: string): {
  residentes: Doctor[];
  cirujanos: Doctor[];
  otros: Doctor[];
} {
  const doctores = {
    residentes: [] as Doctor[],
    cirujanos: [] as Doctor[],
    otros: [] as Doctor[],
  };
  const lineas = texto.split("\n");
  for (let i = 0; i < lineas.length; i++) {
    const m = lineas[i].match(/(mp|mn|matrícula)[:\s]*(\d{3,6})/i);
    if (m) {
      const matricula = m[2];
      let nombre: string | null = null;
      for (let j = Math.max(0, i - 3); j < Math.min(i + 3, lineas.length); j++) {
        const mn = lineas[j].match(/([A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ\s,]+)/);
        if (mn && mn[1].trim().length > 5) {
          nombre = mn[1].trim();
          break;
        }
      }
      if (nombre) {
        const contexto = lineas
          .slice(Math.max(0, i - 5), Math.min(i + 5, lineas.length))
          .join(" ")
          .toLowerCase();
        if (/cirujano|cirugia|operacion|quirurgico/i.test(contexto)) {
          doctores.cirujanos.push({ nombre, matricula });
        } else if (/residente|resident|evolucion/i.test(contexto)) {
          doctores.residentes.push({ nombre, matricula });
        } else {
          doctores.otros.push({ nombre, matricula });
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

  const crit = ["cirujano", "primer_ayudante", "instrumentador", "anestesista"];
  const porRol: Record<string, string> = {};
  for (const m of equipo) {
    const rol = m.rol;
    const nombre = m.nombre.trim().toUpperCase();
    if (crit.includes(rol)) porRol[rol] = nombre;
  }
  const roles = Object.keys(porRol);
  for (let i = 0; i < roles.length; i++) {
    for (let j = i + 1; j < roles.length; j++) {
      const r1 = roles[i],
        r2 = roles[j];
      if (porRol[r1] === porRol[r2]) {
        errores.push(
          `❌ CRÍTICO: El ${r1.replace("_", " ")} y el ${r2.replace(
            "_",
            " "
          )} tienen el mismo nombre: ${porRol[r1]}. Deben ser diferentes.`
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
  let header: RegExpMatchArray | null = null;
  for (const p of patronesFoja) {
    header = texto.match(p);
    if (header) break;
  }

  if (!header) {
    const indicadores = [
      /cirujano[:\s]*([A-Z][A-Z\s,]+)/i,
      /anestesista[:\s]*([A-Z][A-Z\s,]+)/i,
      /hora\s+comienzo[:\s]*(\d{1,2}:\d{2})/i,
      /bisturí\s+armónico/i,
    ];
    let count = 0;
    for (const r of estosIndicadores(indicadores, texto)) if (r) count++;
    if (count < 2) {
      resultados.errores.push(
        "❌ CRÍTICO: No se encontró foja quirúrgica en el documento"
      );
      return resultados;
    }
  }

  const inicio = header ? (header.index ?? 0) : 0;
  const trozo = texto.substring(inicio, inicio + 3000);

  // Bisturí armónico
  const patronesBisturi = [
    /uso\s+de\s+bisturí\s+armónico\??[:\s]*(si|no)/i,
    /bisturí\s+armónico\??[:\s]*(si|no)/i,
    /armónico\??[:\s]*(si|no)/i,
    /bisturí.*?(si|no)/i,
    /armónico.*?(si|no)/i,
  ];
  for (const p of patronesBisturi) {
    const m = trozo.match(p);
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
  } as const;
  for (const [rol, p] of Object.entries(patronesEquipo)) {
    const m = trozo.match(p);
    if (m) resultados.equipo_quirurgico.push({ rol, nombre: m[1].trim() });
  }

  // Horas/Fechas
  const patronesHoraInicio = [
    /hora\s+comienzo[:\s]*(\d{1,2}:\d{2})/i,
    /hora\s+inicio[:\s]*(\d{1,2}:\d{2})/i,
    /comienzo[:\s]*(\d{1,2}:\d{2})/i,
  ];
  let gotInicio = false;
  for (const p of patronesHoraInicio) {
    const m = trozo.match(p);
    if (m) {
      resultados.hora_inicio = m[1];
      gotInicio = true;
      const antes = trozo.substring(0, m.index ?? 0);
      const pf = [/fecha[:\s]*(\d{1,2}\/\d{1,2}\/\d{4})/i, /(\d{1,2}\/\d{1,2}\/\d{4})/];
      let fOK = false;
      for (const r of pf) {
        const f = antes.match(r);
        if (f) {
          resultados.fecha_cirugia = f[1];
          fOK = true;
          break;
        }
      }
      if (!fOK)
        resultados.errores.push(
          "❌ CRÍTICO: Fecha de cirugía no encontrada en foja quirúrgica"
        );
      break;
    }
  }
  if (!gotInicio)
    resultados.errores.push(
      "❌ CRÍTICO: Hora de comienzo no encontrada en foja quirúrgica"
    );

  const patronesHoraFin = [
    /hora\s+finalización[:\s]*(\d{1,2}:\d{2})/i,
    /hora\s+fin[:\s]*(\d{1,2}:\d{2})/i,
    /finalización[:\s]*(\d{1,2}:\d{2})/i,
  ];
  for (const p of patronesHoraFin) {
    const m = trozo.match(p);
    if (m) {
      resultados.hora_fin = m[1];
      break;
    }
  }
  if (!resultados.hora_fin)
    resultados.errores.push(
      "⚠️ ADVERTENCIA: Hora de finalización no encontrada en foja quirúrgica"
    );

  return resultados;
}

function* estosIndicadores(regs: RegExp[], txt: string) {
  for (const r of regs) yield r.test(txt);
}

/* =========================
   NUEVO: Extraer Estudios
   ========================= */
function extraerEstudios(texto: string) {
  const tx = normalizarTextoPDF(texto);
  const lineas = tx.split("\n");

  const reFecha = /(\b\d{1,2}\/\d{1,2}\/\d{2,4}\b)/i;
  const reHora = /(\b\d{1,2}:\d{2}(?::\d{2})?\b)/;
  const reInforme = /(informe|impresi[oó]n|conclusi[oó]n|resultado)/i;
  const rePagina = /p[aá]gina\s+(\d+)/i;

  const patronesImagenes: Array<[RegExp, string]> = [
    [/\b(tac|tc|tomograf[ií]a)\b.*?(cerebro|cr[aá]neo|t[oó]rax|abdomen|pelvis|columna|cuello)?/i, "TAC"],
    [/\b(rm|rmn|resonancia)\b.*?(cerebro|cr[aá]neo|columna|rodilla|hombro|abdomen|pelvis|t[oó]rax)?/i, "Resonancia Magnética"],
    [/\b(rx|radiograf[ií]a|r[ xg]rafia)\b.*?(t[oó]rax|columna|miembro|mano|muñeca|cadera|pelvis)?/i, "Radiografía"],
    [/\b(eco|ecograf[ií]a|ultrasonido)\b.*?(abdominal|hep[aá]tico|vesicular|renal|tiroides|obst[eé]trica|doppler|partes blandas)?/i, "Ecografía"],
    [/\bdoppler\b.*?(venoso|arterial|miembros|carot[ií]deo)?/i, "Doppler"],
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
    [/\bparacentesis|toracocentesis|punci[oó]n lumbar\b/i, "Procedimiento"],
    [/\b(ktr|kine|kinesio|kinesiolog[íi]a|kinesioterapia|kinesioter\w+|kine\.|ktr\.)\b/i, "Kinesiología"],
  ];

  // Rastrear número de página actual y identificar páginas de "Exámenes complementarios"
  let paginaActual = 1;
  const paginasExamenesComplementarios = new Set<number>();
  const paginasEstudiosEntregados = new Set<number>();
  let dentroDeExamenesComplementarios = false;
  let dentroDeEstudiosEntregados = false;

  // Primera pasada: identificar páginas de exámenes complementarios
  for (let i = 0; i < lineas.length; i++) {
    const linea = lineas[i];
    
    // Detectar cambio de página
    const matchPagina = linea.match(rePagina);
    if (matchPagina) {
      paginaActual = Number(matchPagina[1]);
    }

    // Detectar inicio de "Exámenes complementarios"
    if (/ex[áa]menes\s+complementarios/i.test(linea)) {
      dentroDeExamenesComplementarios = true;
      paginasExamenesComplementarios.add(paginaActual);
    }

    // Detectar "Estudios entregados por el paciente"
    if (/estudios\s+entregados\s+por\s+el\s+paciente/i.test(linea)) {
      dentroDeEstudiosEntregados = true;
      paginasEstudiosEntregados.add(paginaActual);
    }

    // Detectar fin de sección (siguiente sección principal)
    if (/(evoluci[oó]n|visita|alta\s+m[eé]dica|epicrisis|foja|cirug[íi]a)/i.test(linea) && 
        !dentroDeExamenesComplementarios && !dentroDeEstudiosEntregados) {
      dentroDeExamenesComplementarios = false;
      dentroDeEstudiosEntregados = false;
    }

    // Si estamos dentro de exámenes complementarios, marcar páginas consecutivas
    if (dentroDeExamenesComplementarios) {
      paginasExamenesComplementarios.add(paginaActual);
    }
    if (dentroDeEstudiosEntregados) {
      paginasEstudiosEntregados.add(paginaActual);
    }
  }

  // Segunda pasada: extraer estudios
  paginaActual = 1;
  const estudios: Estudio[] = [];
  const sesionesKinesiologia: Array<{ hoja: number; linea: string }> = [];

  const tipoDetectado = (base: string, linea: string) => {
    // NO agregar lugar a estos tipos de estudios
    const tiposSinLugar = [
      "Kinesiología", 
      "Perfil hepático", 
      "Hemograma", 
      "PCR", 
      "VSG", 
      "Glucemia", 
      "Creatinina", 
      "Urea",
      "Orina completa",
      "Ionograma"
    ];
    
    if (tiposSinLugar.includes(base)) {
      return base;
    }
    
    const zona =
      linea.match(
        /de\s+(t[oó]rax|abdomen|pelvis|columna|cerebro|cr[aá]neo|cuello|rodilla|hombro|hep[aá]tico|renal|tiroides|obst[eé]trica|venoso|arterial|car[oó]tideo)/i
      )?.[1] || "";
    return zona ? `${base} de ${zona}` : base;
  };

  const pushEstudio = (categoria: CategoriaEstudio, tipo: string, linea: string, numHoja: number) => {
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
      numero_hoja: numHoja,
    });
  };

  for (let i = 0; i < lineas.length; i++) {
    const lRaw = lineas[i];
    
    // Detectar cambio de página
    const matchPagina = lRaw.match(rePagina);
    if (matchPagina) {
      paginaActual = Number(matchPagina[1]);
    }

    const l = lRaw.trim();
    if (!l) continue;

    // Verificar si estamos en páginas de exámenes complementarios
    const esExamenExterno = paginasExamenesComplementarios.has(paginaActual) || 
                           paginasEstudiosEntregados.has(paginaActual);

    // ✅ NUEVO: Detectar kinesiología ANTES del filtro de exámenes externos
    for (const [re, label] of patronesProc) {
      if (re.test(l) && label === "Kinesiología") {
        sesionesKinesiologia.push({ hoja: paginaActual, linea: l });
        pushEstudio("Procedimientos", label, l, paginaActual);
        break;
      }
    }

    // Si es examen externo, SKIP (pero ya registramos kinesiología arriba)
    if (esExamenExterno) continue;

    // Detectar estudios (imágenes y laboratorio)
    for (const [re, label] of patronesImagenes) {
      if (re.test(l)) {
        pushEstudio("Imagenes", label, l, paginaActual);
        break;
      }
    }
    for (const [re, label] of patronesLab) {
      if (re.test(l)) {
        pushEstudio("Laboratorio", label, l, paginaActual);
        break;
      }
    }

    // Detectar otros procedimientos (excluye kinesiología ya procesada)
    for (const [re, label] of patronesProc) {
      if (re.test(l) && label !== "Kinesiología") {
        pushEstudio("Procedimientos", label, l, paginaActual);
        break;
      }
    }
  }

  // Dedup por categoria+tipo+fecha
  const visto = new Set<string>();
  const dedup: Estudio[] = [];
  for (const e of estudios) {
    // Para kinesiología, no deduplicamos - cada página cuenta como sesión
    if (e.tipo === "Kinesiología") continue;
    
    const key = `${e.categoria}|${(e.tipo || "").toUpperCase()}|${e.fecha || "NA"}`;
    if (!visto.has(key)) {
      visto.add(key);
      dedup.push(e);
    }
  }

  // Procesar sesiones de kinesiología: contar páginas diferentes
  const paginasUnicasKinesiologia = new Set(sesionesKinesiologia.map(s => s.hoja));
  const totalSesionesKinesiologia = paginasUnicasKinesiologia.size;

  // Agregar sesiones de kinesiología como estudios individuales
  paginasUnicasKinesiologia.forEach(hoja => {
    dedup.push({
      categoria: "Procedimientos",
      tipo: "Kinesiología",
      fecha: null,
      hora: null,
      lugar: null,
      resultado: null,
      informe_presente: true, // Kinesiología no requiere informe adicional
      advertencias: [], // Sin advertencias porque no es obligatorio
      numero_hoja: hoja,
    });
  });

  const conteo = {
    total: dedup.length,
    imagenes: dedup.filter((e) => e.categoria === "Imagenes").length,
    laboratorio: dedup.filter((e) => e.categoria === "Laboratorio").length,
    procedimientos: dedup.filter((e) => e.categoria === "Procedimientos").length,
    kinesiologia: totalSesionesKinesiologia,
  };

  const erroresEstudios: string[] = [];
  for (const e of dedup) {
    if (!e.informe_presente && e.tipo !== "Kinesiología") {
      erroresEstudios.push(
        `Estudio sin informe: [${e.categoria}] ${e.tipo}${e.fecha ? ` (${e.fecha})` : ""} (Hoja ${e.numero_hoja})`
      );
    }
  }

  // Ya no se marca como error si no hay kinesiología (no es obligatorio)

  return { estudios: dedup, erroresEstudios, conteo };
}

/* =========================
   Comunicaciones (incluye estudios)
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

  if (erroresAdmision.length > 0) {
    comunicaciones.push({
      sector: "Admisión",
      responsable: "Personal de Admisión",
      motivo: "Datos de admisión incompletos",
      urgencia: "ALTA",
      errores: erroresAdmision,
      mensaje:
        "Se detectaron errores en los datos de admisión del paciente. Completar antes del envío a OSDE.",
    });
  }

  if (erroresEvolucion.length > 0) {
    const set = new Set<string>();
    const residentes = doctores.residentes.filter((r) => {
      if (set.has(r.nombre)) return false;
      set.add(r.nombre);
      return true;
    });
    const nombres =
      residentes.length > 0
        ? residentes.map((r) => `Dr/a ${r.nombre}`).join(", ")
        : "Equipo de Residentes";
    comunicaciones.push({
      sector: "Residentes",
      responsable: nombres,
      motivo: "Problemas en evoluciones médicas diarias",
      urgencia: "ALTA",
      errores: erroresEvolucion,
      mensaje:
        "Se detectaron días sin evolución médica diaria. Revisar y completar.",
    });
  }

  if (advertencias.length > 0) {
    comunicaciones.push({
      sector: "Residentes",
      responsable: "Equipo de Residentes",
      motivo: "Advertencias sobre evoluciones médicas",
      urgencia: "MEDIA",
      errores: advertencias.map((a) => a.descripcion),
      mensaje:
        "Se detectaron advertencias relacionadas con evoluciones. Revisar.",
    });
  }

  const faltaAlta = erroresAltaMedica.some((e) => /alta/i.test(e));
  if (faltaAlta) {
    const set = new Set<string>();
    const cir = doctores.cirujanos.filter((c) => {
      if (set.has(c.nombre)) return false;
      set.add(c.nombre);
      return true;
    });
    const nombres =
      cir.length > 0 ? cir.map((c) => `Dr/a ${c.nombre}`).join(", ") : "Cirujano Responsable";
    comunicaciones.push({
      sector: "Cirugía",
      responsable: nombres,
      motivo: "Falta registro de alta médica",
      urgencia: "CRÍTICA",
      errores: erroresAltaMedica.filter((e) => /alta/i.test(e)),
      mensaje:
        "Se detectó ausencia de alta médica. Completar antes del envío a OSDE.",
    });
  }

  if (erroresEpicrisis.length > 0) {
    const set = new Set<string>();
    const cir = doctores.cirujanos.filter((c) => {
      if (set.has(c.nombre)) return false;
      set.add(c.nombre);
      return true;
    });
    const nombres =
      cir.length > 0 ? cir.map((c) => `Dr/a ${c.nombre}`).join(", ") : "Cirujano Responsable";
    comunicaciones.push({
      sector: "Cirugía",
      responsable: nombres,
      motivo: "Falta epicrisis (resumen de alta)",
      urgencia: "CRÍTICA",
      errores: erroresEpicrisis,
      mensaje: "Se detectó ausencia de epicrisis. Completar.",
    });
  }

  if (erroresFoja.length > 0 || resultadosFoja.errores.length > 0) {
    const set = new Set<string>();
    const cir = doctores.cirujanos.filter((c) => {
      if (set.has(c.nombre)) return false;
      set.add(c.nombre);
      return true;
    });
    const nombres =
      cir.length > 0 ? cir.map((c) => `Dr/a ${c.nombre}`).join(", ") : "Cirujano Responsable";
    const errs = [...erroresFoja, ...resultadosFoja.errores];
    comunicaciones.push({
      sector: "Cirugía",
      responsable: nombres,
      motivo: "Problemas en foja quirúrgica",
      urgencia: "ALTA",
      errores: errs,
      mensaje: "Se detectaron inconsistencias en la foja quirúrgica. Completar.",
    });
  }

  if (resultadosFoja.bisturi_armonico === "SI") {
    const set = new Set<string>();
    const cir = doctores.cirujanos.filter((c) => {
      if (set.has(c.nombre)) return false;
      set.add(c.nombre);
      return true;
    });
    const nombres =
      cir.length > 0 ? cir.map((c) => `Dr/a ${c.nombre}`).join(", ") : "Cirujano Responsable";
    comunicaciones.push({
      sector: "Cirugía",
      responsable: nombres,
      motivo: "Uso de bisturí armónico - Requiere autorización especial",
      urgencia: "CRÍTICA",
      errores: ["Se utilizó bisturí armónico"],
      mensaje:
        "Se detectó uso de BISTURÍ ARMÓNICO. Verificar autorización de OSDE previa a facturación.",
    });
  }

  // Estudios sin informe
  const sinInforme = estudios.filter((e) => !e.informe_presente);
  if (sinInforme.length > 0) {
    const list = (cat: CategoriaEstudio) =>
      sinInforme
        .filter((e) => e.categoria === cat)
        .map((e) => `${e.tipo}${e.fecha ? ` (${e.fecha})` : ""}`)
        .join("; ");

    if (sinInforme.some((e) => e.categoria === "Imagenes")) {
      comunicaciones.push({
        sector: "Diagnóstico por Imágenes",
        responsable: "Jefe/a de Servicio",
        motivo: "Estudios de imágenes sin informe",
        urgencia: "ALTA",
        errores: sinInforme
          .filter((e) => e.categoria === "Imagenes")
          .map(
            (e) => `[Imagenes] ${e.tipo}${e.fecha ? ` (${e.fecha})` : ""}`
          ),
        mensaje: `Faltan informes en: ${list("Imagenes")}. Adjuntar antes del envío a OSDE.`,
      });
    }
    if (sinInforme.some((e) => e.categoria === "Laboratorio")) {
      comunicaciones.push({
        sector: "Laboratorio",
        responsable: "Jefe/a de Laboratorio",
        motivo: "Estudios de laboratorio sin resultado/informe",
        urgencia: "MEDIA",
        errores: sinInforme
          .filter((e) => e.categoria === "Laboratorio")
          .map(
            (e) => `[Laboratorio] ${e.tipo}${e.fecha ? ` (${e.fecha})` : ""}`
          ),
        mensaje: `Faltan resultados claros en: ${list(
          "Laboratorio"
        )}. Adjuntar reporte normalizado.`,
      });
    }
    if (sinInforme.some((e) => e.categoria === "Procedimientos")) {
      comunicaciones.push({
        sector: "Endoscopía / Procedimientos",
        responsable: "Responsable de Procedimientos",
        motivo: "Procedimientos sin informe",
        urgencia: "ALTA",
        errores: sinInforme
          .filter((e) => e.categoria === "Procedimientos")
          .map(
            (e) =>
              `[Procedimientos] ${e.tipo}${e.fecha ? ` (${e.fecha})` : ""}`
          ),
        mensaje:
          "Faltan informes y conclusiones de procedimientos. Cargar documentación.",
      });
    }
  }

  if (erroresEstudios.length > 0) {
    comunicaciones.push({
      sector: "Coordinación de Historias Clínicas",
      responsable: "Equipo Coordinación",
      motivo: "Normalización de estudios",
      urgencia: "MEDIA",
      errores: erroresEstudios,
      mensaje:
        "Se detectaron estudios sin informe o sin fecha. Normalizar documentación para auditoría externa.",
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
      return new Response(
        JSON.stringify({ error: "Faltan datos requeridos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { ingreso, alta } = extractIngresoAlta(pdfText);

    if (!ingreso || Number.isNaN(ingreso.getTime())) {
      return new Response(
        JSON.stringify({
          error: "No se pudo extraer la fecha de ingreso (dato obligatorio)",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const altaValida = !!(alta && !Number.isNaN(alta.getTime()));
    const fechaAlta = altaValida ? alta! : new Date();
    const pacienteInternado = !altaValida;

    const datosPaciente = extraerDatosPaciente(pdfText);

    const {
      errores: erroresEvolucion,
      evolucionesRepetidas,
      advertencias,
    } = extraerEvolucionesMejorado(pdfText, ingreso, fechaAlta);

    // ✅ Corrección: si está internado NO marcamos "ok", explicitamos "No aplica"
    let erroresAltaMedica: string[] = [];
    let erroresEpicrisis: string[] = [];
    if (pacienteInternado) {
      erroresAltaMedica = ["⚠️ No aplica: paciente internado (sin alta registrada)"];
      erroresEpicrisis = ["⚠️ No aplica: paciente internado (sin alta registrada)"];
    } else {
      erroresAltaMedica = verificarAltaMedica(pdfText);
      erroresEpicrisis = verificarEpicrisis(pdfText);
    }

    const doctores = extraerDoctores(pdfText);
    const resultadosFoja = analizarFojaQuirurgica(pdfText);

    const erroresEquipoUnico = validarEquipoQuirurgicoUnico(resultadosFoja);
    if (erroresEquipoUnico.length > 0)
      resultadosFoja.errores.push(...erroresEquipoUnico);

    // Estudios
    const {
      estudios,
      erroresEstudios,
      conteo: estudiosConteo,
    } = extraerEstudios(pdfText);

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
      (pacienteInternado ? 0 : erroresAltaMedica.length) + // no penalizamos "no aplica"
      (pacienteInternado ? 0 : erroresEpicrisis.length) +
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
      // estudios
      estudios,
      estudiosConteo,
      erroresEstudios,
      sesionesKinesiologia: estudiosConteo.kinesiologia,
      comunicaciones,
      totalErrores,
      estado: totalErrores > 0 ? "Pendiente de corrección" : "Aprobado",
    };

    // Persistencia
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
        habitacion: datosPaciente.habitacion || "No encontrada", // preserva "BOX 3"
        fecha_ingreso: ingreso.toISOString(),
        fecha_alta: pacienteInternado ? null : fechaAlta.toISOString(),
        total_errores: totalErrores,
        errores_admision: datosPaciente.errores_admision.length,
        errores_evoluciones: erroresEvolucion.length,
        errores_foja_quirurgica: resultadosFoja.errores.length,
        errores_alta_medica: pacienteInternado ? 0 : erroresAltaMedica.length,
        errores_epicrisis: pacienteInternado ? 0 : erroresEpicrisis.length,
        bisturi_armonico: resultadosFoja.bisturi_armonico || "No determinado",
        estado: totalErrores > 0 ? "Pendiente de corrección" : "Aprobado",
        // estudios
        estudios_total: estudiosConteo.total,
        estudios_imagenes: estudiosConteo.imagenes,
        estudios_laboratorio: estudiosConteo.laboratorio,
        estudios_procedimientos: estudiosConteo.procedimientos,
        sesiones_kinesiologia: estudiosConteo.kinesiologia,
        estudios, // JSON completo
        errores_estudios: erroresEstudios,
        errores_detalle: [
          ...datosPaciente.errores_admision.map((e) => ({
            tipo: "Admisión",
            descripcion: e,
          })),
          ...erroresEvolucion.map((e) => ({ tipo: "Evolución", descripcion: e })),
          ...advertencias.map((a) => ({ tipo: a.tipo, descripcion: a.descripcion })),
          ...resultadosFoja.errores.map((e) => ({
            tipo: "Foja Quirúrgica",
            descripcion: e,
          })),
          ...(pacienteInternado ? [] : erroresAltaMedica.map((e) => ({ tipo: "Alta Médica", descripcion: e }))),
          ...(pacienteInternado ? [] : erroresEpicrisis.map((e) => ({ tipo: "Epicrisis", descripcion: e }))),
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

    return new Response(
      JSON.stringify({ success: true, resultado, auditoriaId: data?.[0]?.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error procesando PDF:", error);
    return new Response(
      JSON.stringify({
        error: "Error procesando el archivo PDF",
        details: error?.message,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
