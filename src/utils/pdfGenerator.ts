import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/* =========================
   Tipos
   ========================= */
type CategoriaEstudio = 'Imagenes' | 'Laboratorio' | 'Procedimientos';

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

interface ResultadoAuditoria {
  nombreArchivo: string;
  datosPaciente: {
    nombre?: string;
    dni?: string;
    fecha_nacimiento?: string;
    sexo?: string;
    obra_social?: string;
    habitacion?: string;
    errores_admision: string[];
  };
  fechaIngreso: string;
  fechaAlta: string;
  pacienteInternado: boolean;
  diasHospitalizacion: number;
  erroresAdmision: string[];
  erroresEvolucion: string[];
  evolucionesRepetidas: Array<{ fecha: string; texto: string }>;
  advertencias: Array<{ tipo: string; descripcion: string; fecha?: string }>;
  erroresAltaMedica: string[];
  erroresEpicrisis: string[];
  erroresFoja: string[];
  resultadosFoja: {
    bisturi_armonico: string | null;
    equipo_quirurgico: Array<{ rol: string; nombre: string }>;
    fecha_cirugia: string | null;
    hora_inicio: string | null;
    hora_fin: string | null;
    errores: string[];
  };
  doctores: {
    residentes: Array<{ nombre: string; matricula?: string }>;
    cirujanos: Array<{ nombre: string; matricula?: string }>;
    otros: Array<{ nombre: string; matricula?: string }>;
  };
  comunicaciones: Array<{
    sector: string;
    responsable: string;
    motivo: string;
    urgencia: string;
    errores: string[];
    mensaje: string;
    matricula?: string;
  }>;
  totalErrores: number;
  estado: string;

  // ===== NUEVO: opcionales para Estudios =====
  estudios?: Estudio[];
  estudiosConteo?: {
    total: number;
    imagenes: number;
    laboratorio: number;
    procedimientos: number;
  };
  erroresEstudios?: string[];
}

/* =========================
   Colores
   ========================= */
const GROW_GREEN = [22, 163, 74];
const GROW_DARK = [31, 41, 55];
const ERROR_RED = [220, 38, 38];
const WARNING_YELLOW = [245, 158, 11];
const LIGHT_GRAY = [249, 250, 251];

/* =========================
   Util
   ========================= */
const fmtBool = (v: boolean) => (v ? 'Sí' : 'No');

export async function generateAuditPDF(resultado: ResultadoAuditoria, downloadPDF: boolean = true): Promise<Blob> {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 20;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const addHeaderFooter = (pageNumber: number, totalPages: number) => {
    // Header
    doc.setFillColor(...GROW_GREEN);
    doc.rect(0, 0, pageWidth, 15, 'F');

    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text('GROW LABS', 10, 9);
    doc.setFontSize(7);
    doc.setFont('helvetica', 'normal');
    doc.text('Donde tus ideas crecen', 10, 12.5);

    doc.setTextColor(255, 255, 255);
    doc.text('Sanatorio Argentino - San Juan', pageWidth - 10, 9, { align: 'right' });

    // Footer
    doc.setFillColor(...GROW_DARK);
    doc.rect(0, pageHeight - 10, pageWidth, 10, 'F');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text(
      `Sistema desarrollado por Grow Labs | Página ${pageNumber} de ${totalPages}`,
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );
  };

  const checkPageBreak = (requiredSpace: number) => {
    if (yPos + requiredSpace > pageHeight - 20) {
      doc.addPage();
      yPos = 25;
      return true;
    }
    return false;
  };

  const addSection = (title: string, bgColor: number[] = GROW_GREEN) => {
    checkPageBreak(15);
    doc.setFillColor(...bgColor);
    doc.rect(10, yPos, pageWidth - 20, 10, 'F');
    doc.setFontSize(12);
    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.text(title, 12, yPos + 7);
    yPos += 15;
  };

  /* =========================
     Portada
     ========================= */
  doc.setFillColor(...GROW_GREEN);
  doc.rect(0, yPos, pageWidth, 40, 'F');

  doc.setFontSize(20);
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.text('INFORME DE AUDITORÍA MÉDICA', pageWidth / 2, yPos + 15, { align: 'center' });

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Sanatorio Argentino - Sistema Salus', pageWidth / 2, yPos + 25, { align: 'center' });
  doc.text('Powered by Grow Labs', pageWidth / 2, yPos + 32, { align: 'center' });

  yPos += 50;

  doc.setFontSize(10);
  doc.setTextColor(...GROW_DARK);
  doc.setFont('helvetica', 'bold');
  doc.text('Fecha de Auditoría:', 10, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date().toLocaleDateString('es-AR'), 60, yPos);
  yPos += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('Archivo analizado:', 10, yPos);
  doc.setFont('helvetica', 'normal');
  const fileNameText = doc.splitTextToSize(resultado.nombreArchivo, pageWidth - 70);
  doc.text(fileNameText, 60, yPos);
  yPos += 10;

  /* =========================
     Resumen General
     ========================= */
  checkPageBreak(30);
  doc.setFillColor(...LIGHT_GRAY);
  doc.roundedRect(10, yPos, pageWidth - 20, 25, 3, 3, 'F');
  doc.setFontSize(9);
  doc.setTextColor(...GROW_DARK);
  doc.setFont('helvetica', 'bold');
  doc.text('RESUMEN GENERAL', 12, yPos + 5);
  doc.setFont('helvetica', 'normal');

  const resumenText = resultado.pacienteInternado
    ? `PACIENTE ACTUALMENTE INTERNADO - Los datos corresponden a la internación en curso. Durante la auditoría automatizada se detectaron ${resultado.totalErrores} errores que requieren corrección durante la internación.`
    : `Durante la auditoría automatizada se detectaron ${resultado.totalErrores} errores que requieren corrección antes del envío a OSDE.`;

  const splitResumen = doc.splitTextToSize(resumenText, pageWidth - 24);
  doc.text(splitResumen, 12, yPos + 10);
  yPos += 30;

  /* =========================
     Datos del paciente
     ========================= */
  addSection('DATOS DEL PACIENTE');

  const pacienteData = [
    ['Nombre', resultado.datosPaciente.nombre || 'No encontrado'],
    ['DNI', resultado.datosPaciente.dni || 'No encontrado'],
    ['Fecha de Nacimiento', resultado.datosPaciente.fecha_nacimiento || 'No encontrada'],
    ['Sexo', resultado.datosPaciente.sexo || 'No encontrado'],
    ['Obra Social', resultado.datosPaciente.obra_social || 'No encontrada'],
    ['Habitación', resultado.datosPaciente.habitacion || 'No encontrada'],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: pacienteData,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { cellWidth: 'auto' },
    },
    margin: { left: 10, right: 10 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  /* =========================
     Período de hospitalización
     ========================= */
  addSection('PERÍODO DE HOSPITALIZACIÓN');

  const hospitalizacionData = [
    ['Fecha de Ingreso', formatDate(resultado.fechaIngreso)],
    ['Fecha de Alta', resultado.pacienteInternado ? 'Paciente Internado (Sin alta registrada)' : formatDate(resultado.fechaAlta)],
    ['Días de ' + (resultado.pacienteInternado ? 'internación' : 'hospitalización'), `${resultado.diasHospitalizacion} días`],
  ];

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: hospitalizacionData,
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 50 },
      1: { cellWidth: 'auto' },
    },
    margin: { left: 10, right: 10 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  /* =========================
     Síntesis del análisis (incluye KPI de Estudios si existen)
     ========================= */
  addSection('SÍNTESIS DEL ANÁLISIS');

  const sintesisData: Array<[string, string]> = [
    ['Errores de admisión', resultado.erroresAdmision.length.toString()],
    ['Errores en evoluciones', resultado.erroresEvolucion.length.toString()],
    ['Evoluciones repetidas', resultado.evolucionesRepetidas.length.toString()],
    ['Advertencias', (resultado.advertencias?.length || 0).toString()],
    ['Errores foja quirúrgica', resultado.erroresFoja.length.toString()],
    ['Errores alta médica', resultado.erroresAltaMedica.length.toString()],
    ['Errores epicrisis', resultado.erroresEpicrisis.length.toString()],
    ['Comunicaciones generadas', resultado.comunicaciones.length.toString()],
  ];

  if (resultado.estudiosConteo && typeof resultado.estudiosConteo.total === 'number') {
    sintesisData.push(
      ['Estudios detectados (total)', String(resultado.estudiosConteo.total)],
      ['— Imágenes', String(resultado.estudiosConteo.imagenes)],
      ['— Laboratorio', String(resultado.estudiosConteo.laboratorio)],
      ['— Procedimientos', String(resultado.estudiosConteo.procedimientos)],
    );
  }

  autoTable(doc, {
    startY: yPos,
    head: [],
    body: sintesisData,
    theme: 'striped',
    styles: { fontSize: 9, cellPadding: 3 },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 80 },
      1: { cellWidth: 'auto', halign: 'center' },
    },
    margin: { left: 10, right: 10 },
  });

  yPos = (doc as any).lastAutoTable.finalY + 10;

  /* =========================
     Errores (bloques existentes)
     ========================= */
  if (resultado.erroresAdmision.length > 0) {
    addSection('ERRORES DE ADMISIÓN', ERROR_RED);
    resultado.erroresAdmision.forEach((error) => {
      checkPageBreak(20);
      doc.setFillColor(254, 226, 226);
      doc.roundedRect(10, yPos, pageWidth - 20, 15, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setTextColor(...ERROR_RED);
      doc.setFont('helvetica', 'bold');
      doc.text('CRÍTICO', 12, yPos + 4);
      doc.setTextColor(...GROW_DARK);
      doc.setFont('helvetica', 'normal');
      const errorText = doc.splitTextToSize(error, pageWidth - 24);
      doc.text(errorText, 12, yPos + 8);
      yPos += 18;
    });
  }

  if (resultado.erroresEvolucion.length > 0) {
    addSection('ERRORES EN EVOLUCIONES MÉDICAS', ERROR_RED);
    resultado.erroresEvolucion.forEach((error) => {
      checkPageBreak(25);
      doc.setFillColor(254, 226, 226);
      doc.roundedRect(10, yPos, pageWidth - 20, 20, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setTextColor(...ERROR_RED);
      doc.setFont('helvetica', 'bold');
      doc.text('CRÍTICO', 12, yPos + 4);
      doc.setTextColor(...GROW_DARK);
      doc.setFont('helvetica', 'normal');
      const errorText = doc.splitTextToSize(error, pageWidth - 24);
      doc.text(errorText, 12, yPos + 8);
      doc.setFontSize(7);
      doc.text('Impacto: Impide el cierre completo de la internación y puede generar débitos.', 12, yPos + 15);
      yPos += 23;
    });
  }

  if (resultado.evolucionesRepetidas.length > 0) {
    addSection('EVOLUCIONES REPETIDAS', WARNING_YELLOW);
    resultado.evolucionesRepetidas.forEach((ev) => {
      checkPageBreak(25);
      doc.setFillColor(254, 243, 199);
      doc.roundedRect(10, yPos, pageWidth - 20, 20, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setTextColor(...WARNING_YELLOW);
      doc.setFont('helvetica', 'bold');
      doc.text('ADVERTENCIA', 12, yPos + 4);
      doc.setTextColor(...GROW_DARK);
      doc.setFont('helvetica', 'normal');
      doc.text(`Fecha: ${ev.fecha}`, 12, yPos + 8);
      const textoEv = doc.splitTextToSize(ev.texto, pageWidth - 24);
      doc.text(textoEv, 12, yPos + 12);
      yPos += 23;
    });
  }

  if (resultado.advertencias && resultado.advertencias.length > 0) {
    addSection('ADVERTENCIAS', WARNING_YELLOW);
    resultado.advertencias.forEach((adv) => {
      checkPageBreak(25);
      doc.setFillColor(254, 243, 199);
      doc.roundedRect(10, yPos, pageWidth - 20, 20, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setTextColor(...WARNING_YELLOW);
      doc.setFont('helvetica', 'bold');
      doc.text('ADVERTENCIA', 12, yPos + 4);
      doc.setTextColor(...GROW_DARK);
      doc.setFont('helvetica', 'normal');
      doc.text(adv.tipo, 12, yPos + 8);
      const descText = doc.splitTextToSize(adv.descripcion, pageWidth - 24);
      doc.text(descText, 12, yPos + 12);
      if (adv.fecha) doc.text(`Fecha: ${adv.fecha}`, 12, yPos + 16);
      yPos += 23;
    });
  }

  if (resultado.erroresFoja.length > 0) {
    addSection('ERRORES EN FOJA QUIRÚRGICA', ERROR_RED);
    resultado.erroresFoja.forEach((error) => {
      checkPageBreak(15);
      doc.setFillColor(254, 226, 226);
      doc.roundedRect(10, yPos, pageWidth - 20, 12, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setTextColor(...ERROR_RED);
      doc.setFont('helvetica', 'bold');
      doc.text('CRÍTICO', 12, yPos + 4);
      doc.setTextColor(...GROW_DARK);
      doc.setFont('helvetica', 'normal');
      const errorText = doc.splitTextToSize(error, pageWidth - 24);
      doc.text(errorText, 12, yPos + 8);
      yPos += 15;
    });
  }

  if (resultado.erroresAltaMedica.length > 0) {
    addSection('ERRORES DE ALTA MÉDICA', ERROR_RED);
    resultado.erroresAltaMedica.forEach((error) => {
      checkPageBreak(20);
      doc.setFillColor(254, 226, 226);
      doc.roundedRect(10, yPos, pageWidth - 20, 17, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setTextColor(...ERROR_RED);
      doc.setFont('helvetica', 'bold');
      doc.text('CRÍTICO', 12, yPos + 4);
      doc.setTextColor(...GROW_DARK);
      doc.setFont('helvetica', 'normal');
      const errorText = doc.splitTextToSize(error, pageWidth - 24);
      doc.text(errorText, 12, yPos + 8);
      doc.setFontSize(7);
      doc.text('Impacto: Impide el cierre correcto de la internación.', 12, yPos + 13);
      yPos += 20;
    });
  }

  if (resultado.erroresEpicrisis.length > 0) {
    addSection('ERRORES DE EPICRISIS', ERROR_RED);
    resultado.erroresEpicrisis.forEach((error) => {
      checkPageBreak(20);
      doc.setFillColor(254, 226, 226);
      doc.roundedRect(10, yPos, pageWidth - 20, 17, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setTextColor(...ERROR_RED);
      doc.setFont('helvetica', 'bold');
      doc.text('CRÍTICO', 12, yPos + 4);
      doc.setTextColor(...GROW_DARK);
      doc.setFont('helvetica', 'normal');
      const errorText = doc.splitTextToSize(error, pageWidth - 24);
      doc.text(errorText, 12, yPos + 8);
      doc.setFontSize(7);
      doc.text('Impacto: Impide el cierre correcto de la internación.', 12, yPos + 13);
      yPos += 20;
    });
  }

  /* =========================
     NUEVO: Errores de Estudios (si existen)
     ========================= */
  if (resultado.erroresEstudios && resultado.erroresEstudios.length > 0) {
    addSection('ERRORES EN ESTUDIOS', ERROR_RED);
    resultado.erroresEstudios.forEach((error) => {
      checkPageBreak(20);
      doc.setFillColor(254, 226, 226);
      doc.roundedRect(10, yPos, pageWidth - 20, 17, 2, 2, 'F');
      doc.setFontSize(8);
      doc.setTextColor(...ERROR_RED);
      doc.setFont('helvetica', 'bold');
      doc.text('CRÍTICO', 12, yPos + 4);
      doc.setTextColor(...GROW_DARK);
      doc.setFont('helvetica', 'normal');
      const errorText = doc.splitTextToSize(error, pageWidth - 24);
      doc.text(errorText, 12, yPos + 8);
      doc.setFontSize(7);
      doc.text('Impacto: si no hay informe/resultado, OSDE puede debitar el estudio.', 12, yPos + 13);
      yPos += 20;
    });
  }

  /* =========================
     NUEVO: Estudios realizados (tabla + resultados)
     ========================= */
  if (resultado.estudios && resultado.estudios.length > 0) {
    addSection('ESTUDIOS REALIZADOS');

    // Tabla con metadatos de estudios
    const estudiosBody = resultado.estudios.map((e) => {
      const fechaHora = [e.fecha || '—', e.hora || ''].join(' ').trim();
      return [
        e.categoria || '—',
        e.tipo || '—',
        fechaHora || '—',
        e.lugar || '—',
        e.informe_presente ? 'Sí' : 'No',
        (e.advertencias?.length ? e.advertencias.join(', ') : '—'),
      ];
    });

    autoTable(doc, {
      startY: yPos,
      head: [['Categoría', 'Tipo', 'Fecha/Hora', 'Lugar', 'Informe', 'Advertencias']],
      body: estudiosBody,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [243, 244, 246], textColor: GROW_DARK as any, fontStyle: 'bold' },
      columnStyles: {
        0: { cellWidth: 28 },
        1: { cellWidth: 50 },
        2: { cellWidth: 30 },
        3: { cellWidth: 30 },
        4: { cellWidth: 18, halign: 'center' },
        5: { cellWidth: 'auto' },
      },
      margin: { left: 10, right: 10 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 8;

    // Bloque de Resultados / Impresiones (solo para los que traen texto)
    const conResultado = resultado.estudios.filter((e) => e.resultado && e.resultado.trim().length > 0);
    if (conResultado.length > 0) {
      checkPageBreak(12);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Resultados / Impresiones:', 10, yPos);
      yPos += 6;

      conResultado.forEach((e, idx) => {
        const header = `• ${e.tipo} (${e.categoria}${e.fecha ? ` - ${e.fecha}` : ''}${e.hora ? ` ${e.hora}` : ''})`;
        const headerLines = doc.splitTextToSize(header, pageWidth - 24);
        const resultLines = doc.splitTextToSize(e.resultado!, pageWidth - 24);

        // estimar espacio
        const needed = 6 + headerLines.length * 4 + resultLines.length * 4 + 3;
        checkPageBreak(needed);

        doc.setFontSize(8.5);
        doc.setFont('helvetica', 'bold');
        doc.text(headerLines, 12, yPos);
        yPos += headerLines.length * 4 + 2;

        doc.setFont('helvetica', 'normal');
        doc.text(resultLines, 12, yPos);
        yPos += resultLines.length * 4 + 3;
      });
      yPos += 2;
    }
  }

  /* =========================
     Bloque "OK" si no hubo errores
     ========================= */
  if (resultado.totalErrores === 0) {
    checkPageBreak(20);
    doc.setFillColor(220, 252, 231);
    doc.roundedRect(10, yPos, pageWidth - 20, 15, 3, 3, 'F');
    doc.setFontSize(10);
    doc.setTextColor(...GROW_GREEN);
    doc.setFont('helvetica', 'bold');
    doc.text('No se detectaron errores', 12, yPos + 6);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GROW_DARK);
    doc.text('La historia clínica está completa y lista para el envío a OSDE', 12, yPos + 11);
    yPos += 18;
  }

  /* =========================
     Comunicaciones generadas
     ========================= */
  if (resultado.comunicaciones.length > 0) {
    addSection('COMUNICACIONES GENERADAS');
    resultado.comunicaciones.forEach((com, idx) => {
      checkPageBreak(50);

      let bgColor: number[] = LIGHT_GRAY;
      if (com.urgencia === 'CRÍTICA') bgColor = [254, 226, 226];
      else if (com.urgencia === 'ALTA') bgColor = [255, 237, 213];
      else bgColor = [254, 243, 199];

      doc.setFillColor(...bgColor);
      doc.roundedRect(10, yPos, pageWidth - 20, 45, 3, 3, 'F');

      doc.setFontSize(10);
      doc.setTextColor(...GROW_DARK);
      doc.setFont('helvetica', 'bold');
      doc.text(`Comunicación N.º ${idx + 1}`, 12, yPos + 5);
      doc.setFontSize(8);
      doc.text(com.urgencia, pageWidth - 12, yPos + 5, { align: 'right' });

      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.text(`Sector: ${com.sector}`, 12, yPos + 10);
      doc.text(`Responsable: ${com.responsable}${com.matricula ? ' (MP: ' + com.matricula + ')' : ''}`, 12, yPos + 15);
      doc.text(`Motivo: ${com.motivo}`, 12, yPos + 20);

      doc.setFont('helvetica', 'bold');
      doc.text('Mensaje:', 12, yPos + 26);
      doc.setFont('helvetica', 'italic');
      const mensajeText = doc.splitTextToSize(com.mensaje, pageWidth - 24);
      doc.text(mensajeText, 12, yPos + 31);

      yPos += 48;

      if (com.errores.length > 0) {
        checkPageBreak(15 + com.errores.length * 5);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'bold');
        doc.text('Errores asociados:', 12, yPos);
        yPos += 4;
        doc.setFont('helvetica', 'normal');
        com.errores.forEach((error) => {
          const errorLines = doc.splitTextToSize(`• ${error}`, pageWidth - 26);
          doc.text(errorLines, 14, yPos);
          yPos += errorLines.length * 4;
        });
        yPos += 5;
      }
    });
  }

  /* =========================
     Verificaciones adicionales (foja)
     ========================= */
  if (resultado.resultadosFoja) {
    addSection('VERIFICACIONES ADICIONALES');

    const verificacionesData = [
      ['Alta médica', resultado.erroresAltaMedica.length > 0 ? 'Faltante' : 'Presente y correcta'],
      ['Epicrisis', resultado.erroresEpicrisis.length > 0 ? 'Faltante' : 'Detectada correctamente'],
      ['Foja quirúrgica', resultado.erroresFoja.some((e) => e.includes('foja')) ? 'No encontrada' : 'Completa'],
      [
        'Bisturí Armónico',
        resultado.resultadosFoja.bisturi_armonico === 'SI'
          ? 'Utilizado - REQUIERE AUTORIZACIÓN'
          : resultado.resultadosFoja.bisturi_armonico === 'NO'
          ? 'No utilizado'
          : 'No determinado',
      ],
    ];

    autoTable(doc, {
      startY: yPos,
      head: [],
      body: verificacionesData,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3 },
      columnStyles: {
        0: { fontStyle: 'bold', cellWidth: 70 },
        1: { cellWidth: 'auto' },
      },
      margin: { left: 10, right: 10 },
    });

    yPos = (doc as any).lastAutoTable.finalY + 10;

    if (resultado.resultadosFoja.equipo_quirurgico.length > 0) {
      checkPageBreak(20);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text('Equipo quirúrgico:', 10, yPos);
      yPos += 5;
      doc.setFont('helvetica', 'normal');
      resultado.resultadosFoja.equipo_quirurgico.forEach((miembro) => {
        doc.text(`• ${miembro.rol.charAt(0).toUpperCase() + miembro.rol.slice(1)}: ${miembro.nombre}`, 12, yPos);
        yPos += 5;
      });
      yPos += 5;
    }
  }

  /* =========================
     Conclusión final
     ========================= */
  addSection('CONCLUSIÓN FINAL', GROW_DARK);

  checkPageBreak(35);
  doc.setFillColor(243, 244, 246);
  doc.roundedRect(10, yPos, pageWidth - 20, 30, 3, 3, 'F');

  doc.setFontSize(9);
  doc.setTextColor(...GROW_DARK);
  doc.setFont('helvetica', 'normal');

  const conclusion = resultado.pacienteInternado
    ? resultado.totalErrores > 0
      ? `El paciente se encuentra actualmente INTERNADO. Se detectaron ${resultado.totalErrores} errores que deben corregirse durante la internación para facilitar el proceso de cierre posterior.`
      : `El paciente se encuentra actualmente INTERNADO. La documentación está completa hasta el momento. Continuar registrando las evoluciones diarias.`
    : resultado.totalErrores > 0
    ? `El documento se encuentra en revisión, con necesidad de corrección antes del envío a OSDE. Una vez completadas las correcciones, el caso podrá marcarse como Aprobado.`
    : `El documento está completo y aprobado. Puede proceder con el envío a OSDE.`;

  const conclusionText = doc.splitTextToSize(conclusion, pageWidth - 24);
  doc.text(conclusionText, 12, yPos + 5);

  doc.setFont('helvetica', 'bold');
  doc.text('Estado actual:', 12, yPos + 18);
  doc.setFont('helvetica', 'normal');
  const estado = resultado.pacienteInternado ? 'Paciente Internado' : resultado.estado;
  doc.text(estado, 45, yPos + 18);

  /* =========================
     Header/Footer en todas las páginas
     ========================= */
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    addHeaderFooter(i, totalPages);
  }

  /* =========================
     Salida
     ========================= */
  const fileName = `Auditoria_${resultado.datosPaciente.nombre || 'Paciente'}_${new Date()
    .toLocaleDateString('es-AR')
    .replace(/\//g, '-')}.pdf`;

  if (downloadPDF) doc.save(fileName);

  return doc.output('blob');
}
