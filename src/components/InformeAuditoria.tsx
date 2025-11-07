import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle,
  FileText,
  Calendar,
  User,
  MessageSquare,
  Send,
  Loader2,
  CheckCircle2,
  Download,
  Scan,
  FlaskConical,
  ActivitySquare,
} from 'lucide-react';
import { enviarMensajeWhatsApp, verificarMensajeEnviado } from '../services/whatsappService';
import { ConfirmacionEnvioModal } from './ConfirmacionEnvioModal';
import { generateAuditPDF } from '../utils/pdfGenerator';
import { uploadPDFToStorage, updateAuditoriaPDFUrl } from '../services/pdfStorageService';

/* =========================
   Tipos base existentes
   ========================= */
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

  // ===== NUEVO: Estudios (opcionales, no rompen si faltan) =====
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
   Tipos nuevos: Estudios
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

/* =========================
   Props
   ========================= */
interface Props {
  resultado: ResultadoAuditoria;
  auditoriaId?: string;
}

/* =========================
   Componente
   ========================= */
export function InformeAuditoria({ resultado, auditoriaId }: Props) {
  const [enviando, setEnviando] = useState(false);
  const [mensajesEnviados, setMensajesEnviados] = useState<Set<number>>(new Set());
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [, setVerificandoEnviados] = useState(false);
  const [generandoPDF, setGenerandoPDF] = useState(false);
  const [modalConfirmacionAbierto, setModalConfirmacionAbierto] = useState(false);
  const [comunicacionSeleccionada, setComunicacionSeleccionada] = useState<number | null>(null);
  const [numerosDestino, setNumerosDestino] = useState<Record<number, string>>({});

  /* =========================
     Helpers
     ========================= */
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

  const getUrgenciaColor = (urgencia: string) => {
    switch (urgencia) {
      case 'CRÍTICA':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'ALTA':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      default:
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    }
  };

  const getCategoriaClasses = (cat: CategoriaEstudio) => {
    switch (cat) {
      case 'Imagenes':
        return 'bg-blue-50 text-blue-800 border-blue-200';
      case 'Laboratorio':
        return 'bg-purple-50 text-purple-800 border-purple-200';
      case 'Procedimientos':
        return 'bg-teal-50 text-teal-800 border-teal-200';
      default:
        return 'bg-gray-50 text-gray-800 border-gray-200';
    }
  };

  const InformePill = ({ ok }: { ok: boolean }) => (
    <span
      className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${
        ok ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'
      }`}
    >
      {ok ? 'Informe presente' : 'Sin informe'}
    </span>
  );

  const showNotification = useCallback((message: string, type: 'success' | 'error') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 5000);
  }, []);

  const abrirModalEnvio = useCallback((index: number) => {
    setComunicacionSeleccionada(index);
    setModalConfirmacionAbierto(true);
  }, []);

  const cerrarModalEnvio = useCallback(() => {
    setModalConfirmacionAbierto(false);
    setComunicacionSeleccionada(null);
  }, []);

  const numeroDestinoSeleccionado = useMemo(
    () => (comunicacionSeleccionada !== null ? numerosDestino[comunicacionSeleccionada] || '' : ''),
    [comunicacionSeleccionada, numerosDestino]
  );

  const comunicacionSeleccionadaData = useMemo(
    () => (comunicacionSeleccionada !== null ? resultado.comunicaciones[comunicacionSeleccionada] : null),
    [comunicacionSeleccionada, resultado.comunicaciones]
  );

  const handleNumeroDestinoChange = useCallback(
    (numero: string) => {
      if (comunicacionSeleccionada === null) return;
      setNumerosDestino((prev) => ({
        ...prev,
        [comunicacionSeleccionada]: numero,
      }));
    },
    [comunicacionSeleccionada]
  );

  /* =========================
     Efectos
     ========================= */
  useEffect(() => {
    const verificarMensajesPrevios = async () => {
      if (!auditoriaId || resultado.comunicaciones.length === 0) return;

      setVerificandoEnviados(true);
      const enviados = new Set<number>();

      for (let i = 0; i < resultado.comunicaciones.length; i++) {
        const yaEnviado = await verificarMensajeEnviado(auditoriaId, i);
        if (yaEnviado) enviados.add(i);
      }

      setMensajesEnviados(enviados);
      setVerificandoEnviados(false);
    };

    verificarMensajesPrevios();
  }, [auditoriaId, resultado.comunicaciones.length]);

  useEffect(() => {
    const generarYSubirPDFAutomatico = async () => {
      if (auditoriaId && resultado) {
        try {
          const pdfBlob = await generateAuditPDF(resultado, false);
          const uploadResult = await uploadPDFToStorage(
            pdfBlob,
            resultado.datosPaciente.nombre || 'Paciente',
            resultado.nombreArchivo
          );

          if (uploadResult.success && uploadResult.url) {
            await updateAuditoriaPDFUrl(auditoriaId, uploadResult.url);
            console.log('PDF generado y guardado automáticamente:', uploadResult.url);
          }
        } catch (error) {
          console.error('Error al generar PDF automático:', error);
        }
      }
    };

    generarYSubirPDFAutomatico();
  }, [auditoriaId, resultado]);

  /* =========================
     Acciones
     ========================= */
  const handleEnviarDirecto = useCallback(
    async (index: number, numeroDestino: string) => {
      if (enviando) return;

      const numeroLimpio = numeroDestino.replace(/\D/g, '');
      if (!numeroLimpio) {
        showNotification('Debes ingresar un número de WhatsApp válido.', 'error');
        return;
      }

      setEnviando(true);

      try {
        const comunicacion = resultado.comunicaciones[index];

        const response = await enviarMensajeWhatsApp({
          comunicacion,
          datosPaciente: resultado.datosPaciente,
          nombreArchivo: resultado.nombreArchivo,
          auditoriaId,
          comunicacionIndex: index,
          numeroDestino: numeroLimpio,
        });

        if (response.success) {
          setMensajesEnviados((prev) => new Set([...prev, index]));
          showNotification('✅ Mensaje enviado correctamente', 'success');
        } else {
          if (response.yaEnviado) showNotification('Este mensaje ya fue enviado anteriormente', 'error');
          else showNotification('❌ Error al enviar el mensaje', 'error');
        }
      } catch (error) {
        showNotification('❌ Error al enviar el mensaje', 'error');
        console.error('Error:', error);
      } finally {
        setEnviando(false);
        setComunicacionSeleccionada(null);
      }
    },
    [auditoriaId, enviando, resultado, showNotification]
  );

  const handleConfirmarEnvio = useCallback(
    (numero: string) => {
      if (comunicacionSeleccionada === null) return;
      setNumerosDestino((prev) => ({
        ...prev,
        [comunicacionSeleccionada]: numero,
      }));
      setModalConfirmacionAbierto(false);
      void handleEnviarDirecto(comunicacionSeleccionada, numero);
    },
    [comunicacionSeleccionada, handleEnviarDirecto]
  );

  const handleDescargarPDF = async () => {
    setGenerandoPDF(true);
    try {
      const pdfBlob = await generateAuditPDF(resultado, true);

      if (auditoriaId) {
        const uploadResult = await uploadPDFToStorage(pdfBlob, resultado.datosPaciente.nombre || 'Paciente');

        if (uploadResult.success && uploadResult.url) {
          await updateAuditoriaPDFUrl(auditoriaId, uploadResult.url);
          console.log('PDF guardado en Storage:', uploadResult.url);
        }
      }

      showNotification('PDF descargado exitosamente', 'success');
    } catch (error) {
      console.error('Error al generar PDF:', error);
      showNotification('Error al generar el PDF', 'error');
    } finally {
      setGenerandoPDF(false);
    }
  };

  /* =========================
     Render
     ========================= */
  return (
    <>
      <div className="space-y-8">
      {/* Botón superior para PDF */}
      <div className="flex justify-center mb-6">
        <button
          onClick={handleDescargarPDF}
          disabled={generandoPDF}
          className="px-8 py-4 bg-gradient-to-r from-green-600 to-green-700 text-white font-bold rounded-lg hover:from-green-700 hover:to-green-800 transition-all transform hover:scale-105 shadow-lg flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generandoPDF ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              Generando PDF...
            </>
          ) : (
            <>
              <Download className="w-6 h-6" />
              Descargar Informe en PDF
            </>
          )}
        </button>
      </div>

      {/* Encabezado */}
      <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl p-8 border-t-4 border-green-600">
        <div className="flex items-center gap-3 mb-6">
          <FileText className="w-10 h-10 text-green-600" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">INFORME DE AUDITORÍA MÉDICA</h1>
            <p className="text-gray-600">Sanatorio Argentino - Sistema Salus</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-6 mb-6">
          <div>
            <p className="text-sm text-gray-600">Fecha de Auditoría</p>
            <p className="text-lg font-semibold text-gray-900">{new Date().toLocaleDateString('es-AR')}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Archivo analizado</p>
            <p className="text-lg font-semibold text-gray-900">{resultado.nombreArchivo}</p>
          </div>
        </div>

        <div className="p-4 bg-green-50 rounded-lg border border-green-200">
          <h3 className="font-semibold text-green-900 mb-2">Resumen General</h3>
          <p className="text-gray-700">
            {resultado.pacienteInternado && (
              <span className="block mb-2">
                <strong className="text-green-600">PACIENTE ACTUALMENTE INTERNADO</strong> - Los datos corresponden a la internación en curso.
              </span>
            )}
            Durante la auditoría automatizada se detectaron{' '}
            <strong className="text-red-600">{resultado.totalErrores} errores</strong> que requieren corrección
            {resultado.pacienteInternado ? ' durante la internación' : ' antes del envío a OSDE'}.
            {resultado.resultadosFoja.bisturi_armonico && (
              <span className="block mt-2">
                El Bisturí Armónico{' '}
                <strong>
                  {resultado.resultadosFoja.bisturi_armonico === 'SI' ? 'FUE UTILIZADO' : 'NO FUE UTILIZADO'}
                </strong>
                {resultado.resultadosFoja.bisturi_armonico === 'SI' && (
                  <span className="text-red-600 font-semibold"> - REQUIERE AUTORIZACIÓN ESPECIAL DE OSDE</span>
                )}
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Datos del paciente */}
      <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <User className="w-8 h-8 text-gray-700" />
          <h2 className="text-2xl font-bold text-gray-900">Datos del Paciente</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <p className="text-sm text-gray-600">Nombre</p>
            <p className="text-lg font-semibold text-gray-900">{resultado.datosPaciente.nombre || 'No encontrado'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">DNI</p>
            <p className="text-lg font-semibold text-gray-900">{resultado.datosPaciente.dni || 'No encontrado'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Fecha de Nacimiento</p>
            <p className="text-lg font-semibold text-gray-900">{resultado.datosPaciente.fecha_nacimiento || 'No encontrada'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Sexo</p>
            <p className="text-lg font-semibold text-gray-900">{resultado.datosPaciente.sexo || 'No encontrado'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Obra Social</p>
            <p className="text-lg font-semibold text-gray-900">{resultado.datosPaciente.obra_social || 'No encontrada'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Habitación</p>
            <p className="text-lg font-semibold text-gray-900">{resultado.datosPaciente.habitacion || 'No encontrada'}</p>
          </div>
        </div>
      </div>

      {/* Período de hospitalización */}
      <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <Calendar className="w-8 h-8 text-gray-700" />
          <h2 className="text-2xl font-bold text-gray-900">Período de Hospitalización</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <div>
            <p className="text-sm text-gray-600">Fecha de Ingreso</p>
            <p className="text-lg font-semibold text-gray-900">{formatDate(resultado.fechaIngreso)}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Fecha de Alta</p>
            {resultado.pacienteInternado ? (
              <div>
                <p className="text-lg font-semibold text-green-600">Paciente Internado</p>
                <p className="text-xs text-green-500 mt-1">Sin alta registrada</p>
              </div>
            ) : (
              <p className="text-lg font-semibold text-gray-900">{formatDate(resultado.fechaAlta)}</p>
            )}
          </div>
          <div>
            <p className="text-sm text-gray-600">Días de {resultado.pacienteInternado ? 'internación' : 'hospitalización'}</p>
            <p className="text-lg font-semibold text-gray-900">{resultado.diasHospitalizacion} días</p>
          </div>
        </div>
      </div>

      {/* Síntesis del análisis + KPIs de estudios */}
      <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <AlertTriangle className="w-8 h-8 text-red-600" />
          <h2 className="text-2xl font-bold text-gray-900">Síntesis del Análisis</h2>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">Errores de admisión</p>
            <p className="text-2xl font-bold text-gray-900">{resultado.erroresAdmision.length}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">Errores en evoluciones</p>
            <p className="text-2xl font-bold text-gray-900">{resultado.erroresEvolucion.length}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">Evoluciones repetidas</p>
            <p className="text-2xl font-bold text-gray-900">{resultado.evolucionesRepetidas.length}</p>
          </div>
          <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
            <p className="text-sm text-yellow-700">Advertencias</p>
            <p className="text-2xl font-bold text-yellow-900">{resultado.advertencias?.length || 0}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">Errores foja quirúrgica</p>
            <p className="text-2xl font-bold text-gray-900">{resultado.erroresFoja.length}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">Errores alta médica</p>
            <p className="text-2xl font-bold text-gray-900">{resultado.erroresAltaMedica.length}</p>
          </div>
          <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
            <p className="text-sm text-gray-600">Errores epicrisis</p>
            <p className="text-2xl font-bold text-gray-900">{resultado.erroresEpicrisis.length}</p>
          </div>
          <div className="p-4 bg-green-50 rounded-lg border border-green-300">
            <p className="text-sm text-green-700">Comunicaciones generadas</p>
            <p className="text-2xl font-bold text-green-900">{resultado.comunicaciones.length}</p>
          </div>

          {/* === NUEVO: KPIs de Estudios === */}
          {resultado.estudiosConteo?.total !== undefined && (
            <>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600">Estudios detectados</p>
                <p className="text-2xl font-bold text-gray-900">{resultado.estudiosConteo.total}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600 flex items-center gap-2">
                  <Scan className="w-4 h-4 text-blue-600" /> Imágenes
                </p>
                <p className="text-2xl font-bold text-gray-900">{resultado.estudiosConteo.imagenes}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600 flex items-center gap-2">
                  <FlaskConical className="w-4 h-4 text-purple-600" /> Laboratorio
                </p>
                <p className="text-2xl font-bold text-gray-900">{resultado.estudiosConteo.laboratorio}</p>
              </div>
              <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <p className="text-sm text-gray-600 flex items-center gap-2">
                  <ActivitySquare className="w-4 h-4 text-teal-600" /> Procedimientos
                </p>
                <p className="text-2xl font-bold text-gray-900">{resultado.estudiosConteo.procedimientos}</p>
              </div>
            </>
          )}
        </div>
      </div>

      {/* === NUEVO: Estudios realizados === */}
      {(resultado.estudios?.length ?? 0) > 0 && (
        <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <FileText className="w-8 h-8 text-gray-700" />
            <h2 className="text-2xl font-bold text-gray-900">Estudios realizados</h2>
          </div>

          <div className="space-y-4">
            {resultado.estudios!.map((e, idx) => (
              <div key={idx} className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getCategoriaClasses(e.categoria)}`}>
                      {e.categoria}
                    </span>
                    <h3 className="text-lg font-semibold text-gray-900">{e.tipo}</h3>
                  </div>
                  <InformePill ok={!!e.informe_presente} />
                </div>

                <div className="mt-2 grid sm:grid-cols-3 gap-3 text-sm text-gray-700">
                  <div>
                    <span className="text-gray-500">Fecha/Hora: </span>
                    <span>
                      {e.fecha ?? '—'}
                      {e.hora ? ` ${e.hora}` : ''}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Lugar: </span>
                    <span>{e.lugar ?? '—'}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Advertencias: </span>
                    <span>{e.advertencias?.length ? e.advertencias.join(', ') : '—'}</span>
                  </div>
                </div>

                {e.resultado && (
                  <div className="mt-3 bg-white p-3 rounded border border-gray-200">
                    <p className="text-xs font-semibold text-gray-600 mb-1">Resultado / Impresión</p>
                    <p className="text-gray-800">{e.resultado}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Errores Detectados (incluye bloque de Estudios) */}
      <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl p-8">
        <div className="flex items-center gap-3 mb-6">
          <AlertCircle className="w-8 h-8 text-red-600" />
          <h2 className="text-2xl font-bold text-gray-900">Errores Detectados</h2>
        </div>

        <div className="space-y-4">
          {resultado.erroresAdmision.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-red-600 rounded-full"></span>
                Errores de Admisión
              </h3>
              {resultado.erroresAdmision.map((error, idx) => (
                <div key={idx} className="ml-4 p-4 bg-red-50 border-l-4 border-red-600 rounded mb-2">
                  <p className="text-sm font-semibold text-red-900 mb-1">CRÍTICO</p>
                  <p className="text-gray-700">{error}</p>
                </div>
              ))}
            </div>
          )}

          {resultado.erroresEvolucion.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-red-600 rounded-full"></span>
                Errores en Evoluciones Médicas
              </h3>
              {resultado.erroresEvolucion.map((error, idx) => (
                <div key={idx} className="ml-4 p-4 bg-red-50 border-l-4 border-red-600 rounded mb-2">
                  <p className="text-sm font-semibold text-red-900 mb-1">CRÍTICO</p>
                  <p className="text-gray-700">{error}</p>
                  <p className="text-sm text-gray-600 mt-2">
                    <strong>Impacto:</strong> Impide el cierre completo de la internación y puede generar débitos.
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Sector responsable:</strong> Residentes / Área de Internación
                  </p>
                </div>
              ))}
            </div>
          )}

          {resultado.evolucionesRepetidas.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-600 rounded-full"></span>
                Evoluciones Repetidas
              </h3>
              {resultado.evolucionesRepetidas.map((ev, idx) => (
                <div key={idx} className="ml-4 p-4 bg-yellow-50 border-l-4 border-yellow-600 rounded mb-2">
                  <p className="text-sm font-semibold text-yellow-900 mb-1">ADVERTENCIA</p>
                  <p className="text-gray-700 mb-2">Fecha: {ev.fecha}</p>
                  <p className="text-gray-600 text-sm italic">{ev.texto}</p>
                  <p className="text-sm text-gray-600 mt-2">
                    <strong>Impacto:</strong> No invalida la facturación, pero se recomienda revisión.
                  </p>
                </div>
              ))}
            </div>
          )}

          {resultado.advertencias && resultado.advertencias.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-yellow-600 rounded-full"></span>
                Advertencias
              </h3>
              {resultado.advertencias.map((adv, idx) => (
                <div key={idx} className="ml-4 p-4 bg-yellow-50 border-l-4 border-yellow-600 rounded mb-2">
                  <p className="text-sm font-semibold text-yellow-900 mb-1">ADVERTENCIA</p>
                  <p className="text-gray-700 mb-2">{adv.tipo}</p>
                  <p className="text-gray-600 text-sm">{adv.descripcion}</p>
                  {adv.fecha && (
                    <p className="text-sm text-gray-600 mt-2">
                      <strong>Fecha:</strong> {adv.fecha}
                    </p>
                  )}
                  <p className="text-sm text-gray-600 mt-2">
                    <strong>Impacto:</strong> No invalida la facturación, pero se recomienda revisión.
                  </p>
                </div>
              ))}
            </div>
          )}

          {resultado.erroresFoja.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-red-600 rounded-full"></span>
                Errores en Foja Quirúrgica
              </h3>
              {resultado.erroresFoja.map((error, idx) => (
                <div key={idx} className="ml-4 p-4 bg-red-50 border-l-4 border-red-600 rounded mb-2">
                  <p className="text-sm font-semibold text-red-900 mb-1">CRÍTICO</p>
                  <p className="text-gray-700">{error}</p>
                </div>
              ))}
            </div>
          )}

          {resultado.erroresAltaMedica.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-red-600 rounded-full"></span>
                Errores de Alta Médica
              </h3>
              {resultado.erroresAltaMedica.map((error, idx) => (
                <div key={idx} className="ml-4 p-4 bg-red-50 border-l-4 border-red-600 rounded mb-2">
                  <p className="text-sm font-semibold text-red-900 mb-1">CRÍTICO</p>
                  <p className="text-gray-700">{error}</p>
                  <p className="text-sm text-gray-600 mt-2">
                    <strong>Impacto:</strong> Impide el cierre correcto de la internación.
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Sector responsable:</strong> Cirugía
                  </p>
                </div>
              ))}
            </div>
          )}

          {resultado.erroresEpicrisis.length > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-red-600 rounded-full"></span>
                Errores de Epicrisis
              </h3>
              {resultado.erroresEpicrisis.map((error, idx) => (
                <div key={idx} className="ml-4 p-4 bg-red-50 border-l-4 border-red-600 rounded mb-2">
                  <p className="text-sm font-semibold text-red-900 mb-1">CRÍTICO</p>
                  <p className="text-gray-700">{error}</p>
                  <p className="text-sm text-gray-600 mt-2">
                    <strong>Impacto:</strong> Impide el cierre correcto de la internación.
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Sector responsable:</strong> Cirugía
                  </p>
                </div>
              ))}
            </div>
          )}

          {/* === NUEVO: Errores de Estudios === */}
          {(resultado.erroresEstudios?.length ?? 0) > 0 && (
            <div>
              <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <span className="w-2 h-2 bg-red-600 rounded-full"></span>
                Errores en Estudios
              </h3>
              {resultado.erroresEstudios!.map((error, idx) => (
                <div key={idx} className="ml-4 p-4 bg-red-50 border-l-4 border-red-600 rounded mb-2">
                  <p className="text-sm font-semibold text-red-900 mb-1">CRÍTICO</p>
                  <p className="text-gray-700">{error}</p>
                  <p className="text-sm text-gray-600 mt-2">
                    <strong>Impacto:</strong> Si no hay informe/resultado, OSDE puede debitar el estudio.
                  </p>
                  <p className="text-sm text-gray-600">
                    <strong>Sector responsable:</strong> Diagnóstico por Imágenes / Laboratorio / Procedimientos
                  </p>
                </div>
              ))}
            </div>
          )}

          {resultado.totalErrores === 0 && (
            <div className="p-6 bg-green-50 border-l-4 border-green-600 rounded flex items-center gap-3">
              <CheckCircle className="w-8 h-8 text-green-600" />
              <div>
                <p className="font-semibold text-green-900 text-lg">No se detectaron errores</p>
                <p className="text-green-700">La historia clínica está completa y lista para el envío a OSDE</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Comunicaciones */}
      {resultado.comunicaciones.length > 0 && (
        <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl p-8">
          <div className="flex items-center gap-3 mb-6">
            <MessageSquare className="w-8 h-8 text-green-600" />
            <h2 className="text-2xl font-bold text-gray-900">Comunicaciones Generadas</h2>
          </div>

          <div className="space-y-6">
            {resultado.comunicaciones.map((com, idx) => (
              <div key={idx} className={`p-6 rounded-lg border-2 ${getUrgenciaColor(com.urgencia)}`}>
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 mb-1">Comunicación N.º {idx + 1}</h3>
                    <p className="text-sm text-gray-700">
                      <strong>Sector:</strong> {com.sector}
                    </p>
                  </div>
                  <span className="px-3 py-1 bg-white rounded-full text-sm font-bold border-2">{com.urgencia}</span>
                </div>

                <div className="space-y-2 mb-4">
                  <p className="text-sm">
                    <strong>Responsable:</strong> {com.responsable}
                    {com.matricula && <span className="ml-2 text-gray-600">(MP: {com.matricula})</span>}
                  </p>
                  <p className="text-sm">
                    <strong>Motivo:</strong> {com.motivo}
                  </p>
                </div>

                <div className="bg-white p-4 rounded border border-gray-300">
                  <p className="text-sm font-semibold text-gray-700 mb-2">Mensaje:</p>
                  <p className="text-gray-800 italic">{com.mensaje}</p>
                </div>

                {com.errores.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-semibold text-gray-700 mb-2">Errores asociados:</p>
                    <ul className="space-y-1">
                      {com.errores.map((error, errorIdx) => (
                        <li key={errorIdx} className="text-sm text-gray-700 flex items-start gap-2">
                          <span className="text-red-600">•</span>
                          <span>{error}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                <div className="mt-4 p-3 bg-white rounded border border-gray-300">
                  <p className="text-sm font-semibold text-gray-700">Acción sugerida:</p>
                  <p className="text-sm text-gray-700">Completar la información faltante y reenviar el archivo actualizado.</p>
                </div>

                <div className="mt-4 flex gap-3">
                  {mensajesEnviados.has(idx) ? (
                    <div className="flex-1 px-4 py-3 bg-green-50 border-2 border-green-500 rounded-lg flex items-center justify-center gap-2">
                      <CheckCircle2 className="w-5 h-5 text-green-600" />
                      <span className="text-green-700 font-semibold">Mensaje Enviado</span>
                    </div>
                  ) : (
                    <button
                      onClick={() => abrirModalEnvio(idx)}
                      disabled={enviando}
                      className="flex-1 px-6 py-3 bg-gradient-to-r from-green-600 to-green-700 text-white font-bold rounded-lg hover:from-green-700 hover:to-green-800 transition-all transform hover:scale-105 shadow-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {enviando ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Enviando...
                        </>
                      ) : (
                        <>
                          <Send className="w-5 h-5" />
                          Enviar por WhatsApp
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Verificaciones adicionales */}
      {resultado.resultadosFoja && (
        <div className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Verificaciones Adicionales</h2>

          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Alta médica</p>
              <p className="font-semibold text-gray-900">
                {resultado.erroresAltaMedica.length > 0 ? '❌ Faltante' : '✅ Presente y correcta'}
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Epicrisis</p>
              <p className="font-semibold text-gray-900">
                {resultado.erroresEpicrisis.length > 0 ? '❌ Faltante' : '✅ Detectada correctamente'}
              </p>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">Foja quirúrgica</p>
              <p className="font-semibold text-gray-900">
                {resultado.erroresFoja.some((e) => e.includes('foja')) ? '❌ No encontrada' : '✅ Completa'}
              </p>
            </div>

            <div
              className={`p-4 rounded-lg ${
                resultado.resultadosFoja.bisturi_armonico === 'SI' ? 'bg-red-100' : 'bg-green-50'
              }`}
            >
              <p className="text-sm text-gray-600 mb-1">Bisturí Armónico</p>
              <p className="font-semibold text-gray-900">
                {resultado.resultadosFoja.bisturi_armonico === 'SI'
                  ? '⚡ Utilizado - REQUIERE AUTORIZACIÓN'
                  : resultado.resultadosFoja.bisturi_armonico === 'NO'
                  ? '✅ No utilizado'
                  : '❓ No determinado'}
              </p>
            </div>

            {resultado.resultadosFoja.equipo_quirurgico.length > 0 && (
              <div className="p-4 bg-gray-50 rounded-lg md:col-span-2">
                <p className="text-sm text-gray-600 mb-2">Equipo quirúrgico</p>
                <div className="flex flex-wrap gap-2">
                  {resultado.resultadosFoja.equipo_quirurgico.map((miembro, idx) => (
                    <span key={idx} className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                      {miembro.rol.charAt(0).toUpperCase() + miembro.rol.slice(1)}: {miembro.nombre}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Conclusión + botón inferior PDF */}
      <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-xl shadow-lg p-8 text-white">
        <h2 className="text-2xl font-bold mb-4">Conclusión Final</h2>
        <p className="text-gray-200 mb-4">
          {resultado.pacienteInternado
            ? resultado.totalErrores > 0
              ? `El paciente se encuentra actualmente INTERNADO. Se detectaron ${resultado.totalErrores} errores que deben corregirse durante la internación para facilitar el proceso de cierre posterior.`
              : `El paciente se encuentra actualmente INTERNADO. La documentación está completa hasta el momento. Continuar registrando las evoluciones diarias.`
            : resultado.totalErrores > 0
            ? `El documento se encuentra en revisión, con necesidad de corrección antes del envío a OSDE. Una vez completadas las correcciones, el caso podrá marcarse como Aprobado.`
            : `El documento está completo y aprobado. Puede proceder con el envío a OSDE.`}
        </p>

        <div className="flex items-center gap-4 mb-4">
          <span className="text-gray-300">Estado actual:</span>
          <span
            className={`px-4 py-2 rounded-full font-bold ${
              resultado.pacienteInternado
                ? 'bg-green-600 text-white'
                : resultado.totalErrores > 0
                ? 'bg-red-600 text-white'
                : 'bg-green-600 text-white'
            }`}
          >
            {resultado.pacienteInternado ? 'Paciente Internado' : resultado.estado}
          </span>
        </div>

        {resultado.totalErrores > 0 && (
          <div className="p-4 bg-red-600 rounded-lg">
            <p className="font-bold mb-2">Acción requerida:</p>
            <p className="text-red-100">Completar todas las correcciones indicadas en las comunicaciones y reenviar el documento actualizado.</p>
          </div>
        )}

        <div className="mt-6 pt-6 border-t border-gray-700">
          <p className="text-gray-400 text-sm">
            Sistema desarrollado por <strong className="text-green-400">Grow Labs</strong> - Sanatorio Argentino, San Juan
          </p>
        </div>
      </div>

      {/* Botón inferior para PDF (duplicado por conveniencia de UX) */}
      <div className="flex justify-center mt-8">
        <button
          onClick={handleDescargarPDF}
          disabled={generandoPDF}
          className="px-8 py-4 bg-gradient-to-r from-green-600 to-green-700 text-white font-bold rounded-lg hover:from-green-700 hover:to-green-800 transition-all transform hover:scale-105 shadow-lg flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generandoPDF ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              Generando PDF...
            </>
          ) : (
            <>
              <Download className="w-6 h-6" />
              Descargar Informe en PDF
            </>
          )}
        </button>
      </div>

      {/* Notificaciones */}
      {notification && (
        <div className="fixed bottom-6 right-6 z-50 animate-slide-in">
          <div
            className={`px-6 py-4 rounded-lg shadow-2xl flex items-center gap-3 ${
              notification.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
            }`}
          >
            {notification.type === 'success' ? <CheckCircle2 className="w-6 h-6" /> : <AlertCircle className="w-6 h-6" />}
            <p className="font-semibold">{notification.message}</p>
          </div>
        </div>
      )}
    </div>
      {comunicacionSeleccionadaData && (
        <ConfirmacionEnvioModal
          isOpen={modalConfirmacionAbierto}
          onClose={cerrarModalEnvio}
          onConfirm={handleConfirmarEnvio}
          comunicacion={comunicacionSeleccionadaData}
          datosPaciente={resultado.datosPaciente}
          nombreArchivo={resultado.nombreArchivo}
          isLoading={enviando}
          numeroDestino={numeroDestinoSeleccionado}
          onNumeroDestinoChange={handleNumeroDestinoChange}
        />
      )}
    </>
  );
}
