import { useState, useEffect } from 'react';
import { History, Download, Eye, Search, Calendar, Filter, FileText, AlertCircle, CheckCircle, Clock, TrendingUp } from 'lucide-react';
import { obtenerHistorialAuditorias, obtenerEstadisticasHistorial, FiltrosHistorial, AuditoriaHistorial } from '../services/historialService';
import { downloadPDFFromStorage } from '../services/pdfStorageService';
import { DetalleAuditoriaModal } from '../components/DetalleAuditoriaModal';

export function Historial() {
  const [auditorias, setAuditorias] = useState<AuditoriaHistorial[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtrosVisible, setFiltrosVisible] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [selectedAuditoria, setSelectedAuditoria] = useState<AuditoriaHistorial | null>(null);
  const [estadisticas, setEstadisticas] = useState({
    totalAuditorias: 0,
    auditoriasPendientes: 0,
    auditoriasAprobadas: 0,
    totalErrores: 0,
  });

  const [filtros, setFiltros] = useState<FiltrosHistorial>({
    nombrePaciente: '',
    dni: '',
    fechaDesde: '',
    fechaHasta: '',
    estado: '',
    bisturiArmonico: '',
  });

  const pageSize = 10;

  useEffect(() => {
    cargarDatos();
  }, [currentPage, filtros]);

  const cargarDatos = async () => {
    setLoading(true);

    const filtrosAplicados = {
      nombrePaciente: filtros.nombrePaciente || undefined,
      dni: filtros.dni || undefined,
      fechaDesde: filtros.fechaDesde || undefined,
      fechaHasta: filtros.fechaHasta || undefined,
      estado: filtros.estado || undefined,
      bisturiArmonico: filtros.bisturiArmonico || undefined,
    };

    const { data, count } = await obtenerHistorialAuditorias(filtrosAplicados, currentPage, pageSize);
    setAuditorias(data);
    setTotalCount(count);

    const stats = await obtenerEstadisticasHistorial();
    setEstadisticas(stats);

    setLoading(false);
  };

  const handleDescargarPDF = async (pdfUrl: string | null) => {
    if (!pdfUrl) {
      alert('Este registro no tiene un PDF generado');
      return;
    }

    try {
      await downloadPDFFromStorage(pdfUrl);
    } catch (error) {
      console.error('Error downloading PDF:', error);
      alert('Error al descargar el PDF');
    }
  };

  const handleVerDetalle = (auditoria: AuditoriaHistorial) => {
    setSelectedAuditoria(auditoria);
  };

  const limpiarFiltros = () => {
    setFiltros({
      nombrePaciente: '',
      dni: '',
      fechaDesde: '',
      fechaHasta: '',
      estado: '',
      bisturiArmonico: '',
    });
    setCurrentPage(1);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('es-AR', {
      timeZone: 'America/Argentina/Buenos_Aires',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    }).format(date);
  };

  const getEstadoBadge = (_estado: string, totalErrores: number) => {
    if (totalErrores === 0) {
      return (
        <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm font-semibold flex items-center gap-1">
          <CheckCircle className="w-4 h-4" />
          Aprobado
        </span>
      );
    } else {
      return (
        <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm font-semibold flex items-center gap-1">
          <AlertCircle className="w-4 h-4" />
          Pendiente
        </span>
      );
    }
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <div className="text-center mb-8">
        <div className="flex items-center justify-center gap-3 mb-4">
          <History className="w-12 h-12 text-green-600" />
          <h1 className="text-4xl font-bold text-white">Historial de Auditorías</h1>
        </div>
        <p className="text-lg text-white">
          Registro completo de todas las auditorías realizadas
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Auditorías</p>
              <p className="text-3xl font-bold text-gray-900">{estadisticas.totalAuditorias}</p>
            </div>
            <FileText className="w-10 h-10 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-red-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Pendientes</p>
              <p className="text-3xl font-bold text-gray-900">{estadisticas.auditoriasPendientes}</p>
            </div>
            <Clock className="w-10 h-10 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-green-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Aprobadas</p>
              <p className="text-3xl font-bold text-gray-900">{estadisticas.auditoriasAprobadas}</p>
            </div>
            <CheckCircle className="w-10 h-10 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-6 border-l-4 border-orange-600">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600 mb-1">Total Errores</p>
              <p className="text-3xl font-bold text-gray-900">{estadisticas.totalErrores}</p>
            </div>
            <TrendingUp className="w-10 h-10 text-orange-600" />
          </div>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Filter className="w-6 h-6 text-green-600" />
            Filtros de Búsqueda
          </h2>
          <button
            onClick={() => setFiltrosVisible(!filtrosVisible)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            {filtrosVisible ? 'Ocultar Filtros' : 'Mostrar Filtros'}
          </button>
        </div>

        {filtrosVisible && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Nombre del Paciente
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="text"
                  value={filtros.nombrePaciente}
                  onChange={(e) => setFiltros({ ...filtros, nombrePaciente: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                  placeholder="Buscar por nombre..."
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">DNI</label>
              <input
                type="text"
                value={filtros.dni}
                onChange={(e) => setFiltros({ ...filtros, dni: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                placeholder="Buscar por DNI..."
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">Estado</label>
              <select
                value={filtros.estado}
                onChange={(e) => setFiltros({ ...filtros, estado: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Todos</option>
                <option value="Aprobado">Aprobado</option>
                <option value="Pendiente de corrección">Pendiente de corrección</option>
                <option value="En Revisión">En Revisión</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Fecha Desde
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="date"
                  value={filtros.fechaDesde}
                  onChange={(e) => setFiltros({ ...filtros, fechaDesde: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Fecha Hasta
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-3 w-5 h-5 text-gray-400" />
                <input
                  type="date"
                  value={filtros.fechaHasta}
                  onChange={(e) => setFiltros({ ...filtros, fechaHasta: e.target.value })}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                Bisturí Armónico
              </label>
              <select
                value={filtros.bisturiArmonico}
                onChange={(e) => setFiltros({ ...filtros, bisturiArmonico: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              >
                <option value="">Todos</option>
                <option value="SI">SI</option>
                <option value="NO">NO</option>
                <option value="No determinado">No determinado</option>
              </select>
            </div>

            <div className="md:col-span-3 flex gap-3 justify-end">
              <button
                onClick={limpiarFiltros}
                className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Limpiar Filtros
              </button>
              <button
                onClick={() => {
                  setCurrentPage(1);
                  cargarDatos();
                }}
                className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Aplicar Filtros
              </button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto mb-4"></div>
          <p className="text-gray-600 text-lg">Cargando historial...</p>
        </div>
      ) : auditorias.length === 0 ? (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h3 className="text-xl font-bold text-gray-900 mb-2">No se encontraron auditorías</h3>
          <p className="text-gray-600">
            No hay auditorías registradas con los filtros seleccionados
          </p>
        </div>
      ) : (
        <>
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gradient-to-r from-green-600 to-green-700 text-white">
                  <tr>
                    <th className="px-6 py-4 text-left text-sm font-bold">Fecha Auditoría</th>
                    <th className="px-6 py-4 text-left text-sm font-bold">Paciente</th>
                    <th className="px-6 py-4 text-left text-sm font-bold">DNI</th>
                    <th className="px-6 py-4 text-left text-sm font-bold">Obra Social</th>
                    <th className="px-6 py-4 text-center text-sm font-bold">Errores</th>
                    <th className="px-6 py-4 text-center text-sm font-bold">Estado</th>
                    <th className="px-6 py-4 text-left text-sm font-bold">Archivo</th>
                    <th className="px-6 py-4 text-center text-sm font-bold">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {auditorias.map((auditoria) => (
                    <tr key={auditoria.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {formatDate(auditoria.created_at)}
                      </td>
                      <td className="px-6 py-4 text-sm font-semibold text-gray-900">
                        {auditoria.nombre_paciente}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{auditoria.dni_paciente}</td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {auditoria.obra_social || 'N/A'}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span
                          className={`px-3 py-1 rounded-full text-sm font-bold ${
                            auditoria.total_errores === 0
                              ? 'bg-green-100 text-green-800'
                              : auditoria.total_errores <= 5
                              ? 'bg-yellow-100 text-yellow-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {auditoria.total_errores}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {getEstadoBadge(auditoria.estado, auditoria.total_errores)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                        {auditoria.nombre_archivo}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => handleVerDetalle(auditoria)}
                            className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                            title="Ver detalles"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDescargarPDF(auditoria.pdf_url)}
                            disabled={!auditoria.pdf_url}
                            className="p-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Descargar PDF"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Anterior
              </button>
              <span className="px-4 py-2 text-gray-700 font-semibold">
                Página {currentPage} de {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Siguiente
              </button>
            </div>
          )}
        </>
      )}

      {selectedAuditoria && (
        <DetalleAuditoriaModal
          auditoria={selectedAuditoria}
          onClose={() => setSelectedAuditoria(null)}
        />
      )}
    </div>
  );
}
