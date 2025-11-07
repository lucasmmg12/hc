import { useEffect, useMemo, useState } from 'react';
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
  onConfirm: (numeroDestino: string) => void;
  comunicacion: Comunicacion;
  datosPaciente: DatosPaciente;
  nombreArchivo: string;
  isLoading: boolean;
  numeroDestino?: string;
  onNumeroDestinoChange?: (numero: string) => void;
}

export function ConfirmacionEnvioModal({
  isOpen,
  onClose,
  onConfirm,
  comunicacion,
  datosPaciente,
  nombreArchivo,
  isLoading,
  numeroDestino,
  onNumeroDestinoChange
}: Props) {
  if (!isOpen) return null;

  const [numeroActual, setNumeroActual] = useState(() => numeroDestino || '');

  useEffect(() => {
    if (typeof numeroDestino === 'string' && numeroDestino !== numeroActual) {
      setNumeroActual(numeroDestino);
    }
  }, [numeroDestino, numeroActual]);

  const manejarCambioNumero = (valor: string) => {
    const soloDigitos = valor.replace(/\D/g, '');
    setNumeroActual(soloDigitos);
    onNumeroDestinoChange?.(soloDigitos);
  };

  const numeroValido = useMemo(() => {
    if (!numeroActual) return false;
    const formatoCorrecto = /^549\d{8,11}$/;
    return formatoCorrecto.test(numeroActual);
  }, [numeroActual]);

  const advertenciaNumero = useMemo(() => {
    if (!numeroActual) {
      return 'Ingresa el número en formato 5492645438114 (sin +, guiones ni espacios).';
    }
    if (!numeroValido) {
      return 'El número debe comenzar con 549 y contener solo dígitos, por ejemplo 5492645438114.';
    }
    return 'Formato válido. Se enviará al número ingresado.';
  }, [numeroActual, numeroValido]);

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
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-3">
            <h3 className="font-semibold text-blue-900 flex items-center gap-2">
              <Send className="w-5 h-5" />
              Destinatario
            </h3>
            <div className="space-y-2">
              <label className="flex flex-col gap-1 text-sm text-gray-700">
                <span className="font-semibold text-base text-gray-900">Número de WhatsApp</span>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={numeroActual}
                  onChange={(event) => manejarCambioNumero(event.target.value)}
                  placeholder="Ej: 5492645438114"
                  className="px-3 py-2 border border-blue-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                  disabled={isLoading}
                />
              </label>
              <p
                className={`text-xs ${
                  numeroValido ? 'text-green-700' : 'text-orange-600'
                }`}
              >
                {advertenciaNumero}
              </p>
            </div>
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
            onClick={() => onConfirm(numeroActual)}
            disabled={isLoading || !numeroValido}
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
