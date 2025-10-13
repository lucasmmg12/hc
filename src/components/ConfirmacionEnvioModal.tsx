import { X, Send, Loader2 } from 'lucide-react';

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

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  comunicacion: Comunicacion;
  datosPaciente: DatosPaciente;
  nombreArchivo: string;
  isLoading: boolean;
}

export function ConfirmacionEnvioModal({
  isOpen,
  onClose,
  onConfirm,
  comunicacion,
  datosPaciente,
  nombreArchivo,
  isLoading
}: Props) {
  if (!isOpen) return null;

  const construirPreview = () => {
    const urgenciaEmoji = comunicacion.urgencia === 'CRÍTICA' ? '🚨' :
                          comunicacion.urgencia === 'ALTA' ? '⚠️' : '📋';

    let preview = `${urgenciaEmoji} NOTIFICACIÓN DE AUDITORÍA MÉDICA ${urgenciaEmoji}\n\n`;
    preview += `👤 Responsable: ${comunicacion.responsable}\n`;
    if (comunicacion.matricula) {
      preview += `📋 Matrícula: ${comunicacion.matricula}\n`;
    }
    preview += `🏥 Sector: ${comunicacion.sector}\n`;
    preview += `⚠️ Urgencia: ${comunicacion.urgencia}\n\n`;
    preview += `📄 Motivo de la comunicación:\n${comunicacion.motivo}\n\n`;
    preview += `👨‍⚕️ Datos del Paciente:\n`;
    preview += `• Nombre: ${datosPaciente.nombre || 'No encontrado'}\n`;
    preview += `• DNI: ${datosPaciente.dni || 'No encontrado'}\n`;
    preview += `• Obra Social: ${datosPaciente.obra_social || 'No encontrada'}\n`;
    preview += `• Archivo: ${nombreArchivo}\n\n`;

    if (comunicacion.errores && comunicacion.errores.length > 0) {
      preview += `❌ Errores Detectados:\n`;
      comunicacion.errores.forEach((error, index) => {
        preview += `${index + 1}. ${error}\n`;
      });
      preview += `\n`;
    }

    preview += `📝 Acción Requerida:\n${comunicacion.mensaje}\n\n`;
    preview += `⚕️ Importante: Es necesario completar esta corrección antes del envío a OSDE para evitar débitos en la facturación.\n\n`;
    preview += `🤖 Automatización realizada por Grow Labs\n`;
    preview += `Sanatorio Argentino - Sistema Salus`;

    return preview;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold">Confirmar Envío por WhatsApp</h2>
            <p className="text-blue-100 text-sm mt-1">Revise el mensaje antes de enviar</p>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-2 hover:bg-blue-800 rounded-lg transition-colors disabled:opacity-50"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <Send className="w-5 h-5" />
              Destinatario
            </h3>
            <p className="text-gray-700">
              <strong>Número:</strong> +54 9 264 543-8114
            </p>
            <p className="text-gray-700">
              <strong>Responsable:</strong> {comunicacion.responsable}
            </p>
            <p className="text-gray-700">
              <strong>Sector:</strong> {comunicacion.sector}
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Vista Previa del Mensaje:</h3>
            <div className="bg-gray-50 border border-gray-300 rounded-lg p-4 whitespace-pre-wrap text-sm font-mono max-h-96 overflow-y-auto">
              {construirPreview()}
            </div>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <h3 className="font-semibold text-green-900 mb-2">Imagen adjunta:</h3>
            <div className="flex items-center gap-3">
              <img
                src="https://i.imgur.com/X2903s6.png"
                alt="Imagen adjunta"
                className="w-20 h-20 object-cover rounded border border-green-300"
              />
              <div className="text-sm text-gray-700">
                <p>Se enviará la imagen corporativa junto con el mensaje</p>
                <p className="text-xs text-gray-500 mt-1">https://i.imgur.com/X2903s6.png</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-50 p-6 flex gap-3 border-t border-gray-200">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="flex-1 px-6 py-3 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="flex-1 px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Send className="w-5 h-5" />
                Confirmar y Enviar
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
