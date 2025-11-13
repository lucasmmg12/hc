import { FileText, Target, Workflow, AlertTriangle, MessageSquare, Shield } from 'lucide-react';

export function Documentacion() {
  return (
    <div className="max-w-7xl mx-auto px-4 py-12 space-y-12">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold text-white drop-shadow-sm">Sistema de Auditoría Médica</h1>
        <p className="text-xl text-green-700 font-semibold">Sanatorio Argentino - San Juan</p>
        <p className="text-lg text-white max-w-3xl mx-auto font-medium">
          Automatización inteligente de auditorías de historias clínicas para prevenir débitos
        </p>
      </div>

      <section className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl p-8 border-l-4 border-green-600">
        <div className="flex items-start gap-4">
          <FileText className="w-8 h-8 text-blue-600 flex-shrink-0 mt-1" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Descripción General</h2>
            <p className="text-gray-800 leading-relaxed">
              Este sistema automatiza la auditoría de historias clínicas en formato PDF para detectar errores y omisiones
              que podrían causar débitos en OSDE. Analiza evoluciones médicas, foja quirúrgica, alta, epicrisis y genera
              comunicaciones automáticas por sector responsable.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl p-8 border-l-4 border-green-600">
        <div className="flex items-start gap-4">
          <Target className="w-8 h-8 text-green-600 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Objetivos del Sistema</h2>

            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Objetivo Principal</h3>
                <p className="text-gray-700">
                  Reducir débitos económicos por parte de OSDE mediante la detección temprana de errores
                  y omisiones en historias clínicas antes del envío a auditoría.
                </p>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Objetivos Específicos</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">•</span>
                    <span>Verificar completitud de datos de admisión del paciente</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">•</span>
                    <span>Asegurar la existencia de evoluciones médicas diarias</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">•</span>
                    <span>Validar información completa en foja quirúrgica</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">•</span>
                    <span>Confirmar presencia de alta médica y epicrisis</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">•</span>
                    <span>Detectar uso de bisturí armónico (requiere autorización especial)</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-green-600 font-bold">•</span>
                    <span>Generar comunicaciones automáticas dirigidas a sectores responsables</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl p-8 border-l-4 border-green-700">
        <div className="flex items-start gap-4">
          <Workflow className="w-8 h-8 text-green-700 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Flujo de Trabajo</h2>

            <div className="space-y-4">
              <div className="flex items-start gap-4 p-4 bg-green-50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                  1
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Carga del PDF</h4>
                  <p className="text-gray-600">El usuario sube la historia clínica en formato PDF</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-green-50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                  2
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Extracción de Texto</h4>
                  <p className="text-gray-600">El sistema extrae el texto completo del documento PDF</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-green-50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                  3
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Análisis Automatizado</h4>
                  <p className="text-gray-600">Se ejecutan validaciones sobre datos del paciente, evoluciones, foja quirúrgica y alta</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-green-50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                  4
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Detección de Errores</h4>
                  <p className="text-gray-600">Se identifican y clasifican todos los errores encontrados</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-green-50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                  5
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Generación de Comunicaciones</h4>
                  <p className="text-gray-600">Se crean mensajes formales dirigidos a cada sector responsable</p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-4 bg-green-50 rounded-lg">
                <div className="flex-shrink-0 w-8 h-8 bg-green-600 text-white rounded-full flex items-center justify-center font-bold">
                  6
                </div>
                <div>
                  <h4 className="font-semibold text-gray-900">Informe Narrativo</h4>
                  <p className="text-gray-600">Se presenta un informe profesional con todos los hallazgos y acciones requeridas</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl p-8 border-l-4 border-red-600">
        <div className="flex items-start gap-4">
          <AlertTriangle className="w-8 h-8 text-red-600 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Tipos de Errores Detectados</h2>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="font-semibold text-red-600 text-lg">Errores de Admisión</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">•</span>
                    <span>Nombre del paciente faltante</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">•</span>
                    <span>DNI no encontrado</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">•</span>
                    <span>Fecha de nacimiento no especificada</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">•</span>
                    <span>Sexo no registrado</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-red-600 text-lg">Errores de Evoluciones</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">•</span>
                    <span>Días sin evolución médica diaria</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">•</span>
                    <span>Evoluciones repetidas o duplicadas</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">•</span>
                    <span>Falta de firma y matrícula médica</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-red-600 text-lg">Errores de Foja Quirúrgica</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">•</span>
                    <span>Foja quirúrgica no encontrada</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">•</span>
                    <span>Fecha de cirugía faltante</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">•</span>
                    <span>Hora de inicio/fin no registrada</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">•</span>
                    <span>Equipo quirúrgico incompleto</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-3">
                <h3 className="font-semibold text-red-600 text-lg">Errores de Alta/Epicrisis</h3>
                <ul className="space-y-2 text-gray-700">
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">•</span>
                    <span>Falta registro de alta médica</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">•</span>
                    <span>Epicrisis no encontrada</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-red-600">•</span>
                    <span>Resumen de internación incompleto</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl p-8 border-l-4 border-orange-600">
        <div className="flex items-start gap-4">
          <MessageSquare className="w-8 h-8 text-orange-600 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Lógica de Comunicaciones por Sector</h2>

            <div className="space-y-6">
              <div className="p-4 bg-orange-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Admisión</h3>
                <p className="text-gray-700 mb-2">
                  Se genera comunicación cuando hay errores en datos de admisión del paciente.
                </p>
                <p className="text-sm text-gray-600 italic">
                  Responsable: Personal de Admisión / Urgencia: ALTA
                </p>
              </div>

              <div className="p-4 bg-orange-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Residentes / Área de Internación</h3>
                <p className="text-gray-700 mb-2">
                  Se genera comunicación cuando faltan evoluciones médicas diarias o hay evoluciones repetidas.
                </p>
                <p className="text-sm text-gray-600 italic">
                  Responsable: Dr/a identificado o Jefe de Residentes / Urgencia: CRÍTICA
                </p>
              </div>

              <div className="p-4 bg-orange-50 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-2">Cirugía</h3>
                <p className="text-gray-700 mb-2">
                  Se genera comunicación cuando falta alta médica, hay problemas en foja quirúrgica,
                  o se detecta uso de bisturí armónico.
                </p>
                <p className="text-sm text-gray-600 italic">
                  Responsable: Cirujano identificado / Urgencia: CRÍTICA
                </p>
              </div>
            </div>

            <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-3">Ejemplo de Comunicación</h3>
              <div className="bg-white p-4 rounded border border-gray-200">
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Sector:</strong> Residencia médica
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Responsable:</strong> Dr/a García (MP: 12345)
                </p>
                <p className="text-sm text-gray-600 mb-2">
                  <strong>Motivo:</strong> Ausencia de evolución médica
                </p>
                <p className="text-sm text-gray-600 mb-3">
                  <strong>Urgencia:</strong> <span className="text-red-600 font-bold">CRÍTICA</span>
                </p>
                <p className="text-gray-700 italic">
                  "Estimado/a Dr/a García: Se detectó la falta de evolución médica correspondiente al 17/09/2025.
                  Solicitamos completar el registro en la historia clínica para garantizar la trazabilidad del
                  tratamiento y evitar débitos por parte de OSDE."
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="bg-white/95 backdrop-blur-sm rounded-xl shadow-xl p-8 border-l-4 border-yellow-600">
        <div className="flex items-start gap-4">
          <Shield className="w-8 h-8 text-yellow-600 flex-shrink-0 mt-1" />
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Elementos Críticos</h2>

            <div className="space-y-4">
              <div className="p-4 bg-yellow-50 border-l-4 border-yellow-600">
                <h3 className="font-semibold text-gray-900 mb-2">Alta Médica</h3>
                <p className="text-gray-700">
                  Documento obligatorio que certifica el egreso del paciente. Su ausencia impide el cierre
                  de la internación y genera débito automático.
                </p>
              </div>

              <div className="p-4 bg-yellow-50 border-l-4 border-yellow-600">
                <h3 className="font-semibold text-gray-900 mb-2">Evoluciones Médicas Diarias</h3>
                <p className="text-gray-700">
                  Registro obligatorio de la condición del paciente día a día. Cada día de internación
                  debe contar con al menos una evolución médica firmada.
                </p>
              </div>

              <div className="p-4 bg-red-50 border-l-4 border-red-600">
                <h3 className="font-semibold text-gray-900 mb-2">Bisturí Armónico</h3>
                <p className="text-gray-700 mb-2">
                  <strong className="text-red-600">CRÍTICO:</strong> Si se detecta el uso de bisturí armónico,
                  se debe verificar la autorización previa de OSDE antes de la facturación.
                </p>
                <p className="text-sm text-gray-600">
                  El bisturí armónico es un dispositivo de alto costo que requiere aprobación especial.
                  Facturar sin autorización resulta en débito total del procedimiento.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

    </div>
  );
}
