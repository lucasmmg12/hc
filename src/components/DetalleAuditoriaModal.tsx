import { X, FileText, User, Calendar, AlertCircle, CheckCircle, Download } from 'lucide-react';
import { AuditoriaHistorial } from '../services/historialService';
import { downloadPDFFromStorage } from '../services/pdfStorageService';

interface Props {
  auditoria: AuditoriaHistorial;
  onClose: () => void;
}

export function DetalleAuditoriaModal({ auditoria, onClose }: Props) {
  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleDateString('es-AR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDescargarPDF = async () => {
    if (!auditoria.pdf_url) {
      alert('Este registro no tiene un PDF generado');
      return;
    }

    try {
      await downloadPDFFromStorage(auditoria.pdf_url);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Error al descargar el PDF');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-gradient-to-r from-green-600 to-green-700 text-white p-6 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8" />
            <div>
              <h2 className="text-2xl font-bold">Detalle de Auditoría</h2>
              <p className="text-green-100 text-sm">ID: {auditoria.id.slice(0, 8)}...</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-green-800 rounded-lg transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <FileText className="w-5 h-5 text-green-600" />
              Información General
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Fecha de Auditoría</p>
                <p className="text-base font-semibold text-gray-900">{formatDate(auditoria.created_at)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Última Actualización</p>
                <p className="text-base font-semibold text-gray-900">{formatDate(auditoria.updated_at)}</p>
              </div>
              <div className="md:col-span-2">
                <p className="text-sm text-gray-600">Archivo Original</p>
                <p className="text-base font-semibold text-gray-900">{auditoria.nombre_archivo}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <User className="w-5 h-5 text-green-600" />
              Datos del Paciente
            </h3>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Nombre Completo</p>
                <p className="text-base font-semibold text-gray-900">{auditoria.nombre_paciente}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">DNI</p>
                <p className="text-base font-semibold text-gray-900">{auditoria.dni_paciente}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Obra Social</p>
                <p className="text-base font-semibold text-gray-900">{auditoria.obra_social}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Habitación</p>
                <p className="text-base font-semibold text-gray-900">{auditoria.habitacion}</p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <Calendar className="w-5 h-5 text-green-600" />
              Período de Hospitalización
            </h3>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <p className="text-sm text-gray-600">Fecha de Ingreso</p>
                <p className="text-base font-semibold text-gray-900">{formatDate(auditoria.fecha_ingreso)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Fecha de Alta</p>
                <p className="text-base font-semibold text-gray-900">
                  {auditoria.fecha_alta ? formatDate(auditoria.fecha_alta) : 'Paciente Internado'}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Bisturí Armónico</p>
                <p
                  className={`text-base font-semibold ${
                    auditoria.bisturi_armonico === 'SI'
                      ? 'text-red-600'
                      : auditoria.bisturi_armonico === 'NO'
                      ? 'text-green-600'
                      : 'text-gray-600'
                  }`}
                >
                  {auditoria.bisturi_armonico}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-bold text-gray-900 mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5 text-red-600" />
              Resumen de Errores
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-600">Total Errores</p>
                <p className="text-2xl font-bold text-red-600">{auditoria.total_errores}</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-600">Admisión</p>
                <p className="text-2xl font-bold text-gray-900">{auditoria.errores_admision}</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-600">Evoluciones</p>
                <p className="text-2xl font-bold text-gray-900">{auditoria.errores_evoluciones}</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-600">Foja Quirúrgica</p>
                <p className="text-2xl font-bold text-gray-900">{auditoria.errores_foja_quirurgica}</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-600">Alta Médica</p>
                <p className="text-2xl font-bold text-gray-900">{auditoria.errores_alta_medica}</p>
              </div>
              <div className="bg-white p-3 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-600">Epicrisis</p>
                <p className="text-2xl font-bold text-gray-900">{auditoria.errores_epicrisis}</p>
              </div>
            </div>
          </div>

          {auditoria.errores_detalle && auditoria.errores_detalle.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-bold text-gray-900 mb-3">Detalle de Errores</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {auditoria.errores_detalle.map((error: any, idx: number) => (
                  <div key={idx} className="bg-red-50 border-l-4 border-red-600 p-3 rounded">
                    <p className="text-sm font-semibold text-red-900">{error.tipo}</p>
                    <p className="text-sm text-gray-700">{error.descripcion}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {auditoria.comunicaciones && auditoria.comunicaciones.length > 0 && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-lg font-bold text-gray-900 mb-3">Comunicaciones Generadas</h3>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {auditoria.comunicaciones.map((com: any, idx: number) => (
                  <div key={idx} className="bg-white border border-gray-200 p-3 rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-semibold text-gray-900">{com.sector}</p>
                      <span
                        className={`px-2 py-1 rounded text-xs font-bold ${
                          com.urgencia === 'CRÍTICA'
                            ? 'bg-red-100 text-red-800'
                            : com.urgencia === 'ALTA'
                            ? 'bg-orange-100 text-orange-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}
                      >
                        {com.urgencia}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">
                      <strong>Responsable:</strong> {com.responsable}
                    </p>
                    <p className="text-sm text-gray-600">
                      <strong>Motivo:</strong> {com.motivo}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bg-gradient-to-r from-gray-900 to-gray-800 rounded-lg p-4 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-300 mb-1">Estado de la Auditoría</p>
                <div className="flex items-center gap-2">
                  {auditoria.total_errores === 0 ? (
                    <>
                      <CheckCircle className="w-6 h-6 text-green-400" />
                      <span className="text-xl font-bold text-green-400">Aprobado</span>
                    </>
                  ) : (
                    <>
                      <AlertCircle className="w-6 h-6 text-red-400" />
                      <span className="text-xl font-bold text-red-400">Pendiente de Corrección</span>
                    </>
                  )}
                </div>
              </div>
              {auditoria.pdf_url && (
                <button
                  onClick={handleDescargarPDF}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 rounded-lg font-semibold flex items-center gap-2 transition-colors"
                >
                  <Download className="w-5 h-5" />
                  Descargar PDF
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-4 rounded-b-xl flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
