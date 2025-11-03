import { useState } from 'react';
import { FileText, Stethoscope, Menu, X, Instagram, Globe, MessageCircle, Linkedin, History } from 'lucide-react';
import { Documentacion } from './pages/Documentacion';
import { AuditarPDF } from './pages/AuditarPDF';
import { Historial } from './pages/Historial';
import { UpdatesHub } from './pages/UpdatesHub';

type Page = 'documentacion' | 'auditar' | 'historial' | 'actualizaciones';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('documentacion');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gray-50" style={{ backgroundImage: 'url("/fondogrow.png")', backgroundSize: 'cover', backgroundPosition: 'center', backgroundAttachment: 'fixed' }}>
      <header className="bg-white/95 backdrop-blur-sm shadow-lg sticky top-0 z-50 border-b-2 border-green-500">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img
                src="/logogrow.png"
                alt="Grow Labs Logo"
                className="h-16 w-16 object-contain"
              />
              <div>
                <h1 className="text-xl font-bold text-grey-900">Auditoría Médica</h1>
                <p className="text-sm text-green-600 font-medium">Donde tus ideas crecen</p>
              </div>
            </div>

            <nav className="hidden md:flex gap-2">
              <button
                onClick={() => setCurrentPage('documentacion')}
                className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                  currentPage === 'documentacion'
                    ? 'bg-green-600 text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-green-50 border border-gray-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Documentación
                </span>
              </button>
              <button
                onClick={() => setCurrentPage('auditar')}
                className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                  currentPage === 'auditar'
                    ? 'bg-green-600 text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-green-50 border border-gray-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Stethoscope className="w-4 h-4" />
                  Auditar PDF
                </span>
              </button>
              <button
                onClick={() => setCurrentPage('historial')}
                className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                  currentPage === 'historial'
                    ? 'bg-green-600 text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-green-50 border border-gray-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Historial
                </span>
              </button>
              <button
                onClick={() => setCurrentPage('actualizaciones')}
                className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                  currentPage === 'actualizaciones'
                    ? 'bg-green-600 text-white shadow-lg'
                    : 'bg-white text-gray-700 hover:bg-green-50 border border-gray-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Actualizaciones
                </span>
              </button>
            </nav>

            <button
              className="md:hidden p-2 rounded-lg hover:bg-green-50"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              {mobileMenuOpen ? (
                <X className="w-6 h-6 text-gray-700" />
              ) : (
                <Menu className="w-6 h-6 text-gray-700" />
              )}
            </button>
          </div>

          {mobileMenuOpen && (
            <nav className="md:hidden mt-4 flex flex-col gap-2 pb-2">
              <button
                onClick={() => {
                  setCurrentPage('documentacion');
                  setMobileMenuOpen(false);
                }}
                className={`px-6 py-3 rounded-lg font-semibold transition-all text-left ${
                  currentPage === 'documentacion'
                    ? 'bg-green-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Documentación
                </span>
              </button>
              <button
                onClick={() => {
                  setCurrentPage('auditar');
                  setMobileMenuOpen(false);
                }}
                className={`px-6 py-3 rounded-lg font-semibold transition-all text-left ${
                  currentPage === 'auditar'
                    ? 'bg-green-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Stethoscope className="w-4 h-4" />
                  Auditar PDF
                </span>
              </button>
              <button
                onClick={() => {
                  setCurrentPage('historial');
                  setMobileMenuOpen(false);
                }}
                className={`px-6 py-3 rounded-lg font-semibold transition-all text-left ${
                  currentPage === 'historial'
                    ? 'bg-green-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <History className="w-4 h-4" />
                  Historial
                </span>
              </button>
              <button
                onClick={() => {
                  setCurrentPage('actualizaciones');
                  setMobileMenuOpen(false);
                }}
                className={`px-6 py-3 rounded-lg font-semibold transition-all text-left ${
                  currentPage === 'actualizaciones'
                    ? 'bg-green-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4" />
                  Actualizaciones
                </span>
              </button>
            </nav>
          )}
        </div>
      </header>

      <main className="pb-12">
        {currentPage === 'documentacion' && <Documentacion />}
        {currentPage === 'auditar' && <AuditarPDF />}
        {currentPage === 'historial' && <Historial />}
        {currentPage === 'actualizaciones' && <UpdatesHub />}
      </main>

      <footer className="bg-gradient-to-br from-gray-900 via-gray-800 to-green-900 text-white py-12 mt-16">
        <div className="max-w-7xl mx-auto px-4">
          <div className="grid md:grid-cols-2 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img
                  src="/logo-header.png"
                  alt="Grow Labs Logo"
                  className="h-12 w-12 object-contain bg-white rounded-full p-1"
                />
                <div>
                  <h3 className="text-2xl font-bold text-white">Grow Labs</h3>
                  <p className="text-green-400 text-sm font-medium">Donde tus ideas crecen</p>
                </div>
              </div>
              <p className="text-gray-300 mb-4 leading-relaxed">
                Startup tecnológica especializada en inteligencia artificial y automatización de procesos.
                Transformamos ideas en soluciones innovadoras.
              </p>
              <div className="flex gap-4">
                <a
                  href="https://www.instagram.com/growsanjuan/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-gradient-to-br from-pink-500 to-orange-500 hover:from-pink-600 hover:to-orange-600 text-white px-4 py-2 rounded-lg transition-all shadow-md hover:shadow-lg"
                >
                  <Instagram className="w-5 h-5" />
                  <span className="text-sm font-medium">Instagram</span>
                </a>
                <a
                  href="https://api.whatsapp.com/send/?phone=5492643229503&text&type=phone_number&app_absent=0"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg transition-all shadow-md hover:shadow-lg"
                >
                  <MessageCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">WhatsApp</span>
                </a>
              </div>
              <div className="flex gap-4 mt-3">
                <a
                  href="https://www.growsanjuan.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg transition-all shadow-md hover:shadow-lg"
                >
                  <Globe className="w-5 h-5" />
                  <span className="text-sm font-medium">Sitio Web</span>
                </a>
                <a
                  href="https://www.linkedin.com/in/lucas-marinero-182521308/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg transition-all shadow-md hover:shadow-lg"
                >
                  <Linkedin className="w-5 h-5" />
                  <span className="text-sm font-medium">LinkedIn</span>
                </a>
              </div>
            </div>

            <div className="bg-white/10 backdrop-blur-sm rounded-xl p-6 border border-green-500/30">
              <h4 className="text-xl font-bold text-white mb-3 flex items-center gap-2">
                <Stethoscope className="w-6 h-6 text-green-400" />
                Cliente Exclusivo
              </h4>
              <div className="space-y-2">
                <p className="text-gray-300 text-sm">
                  Esta plataforma ha sido desarrollada única y exclusivamente para:
                </p>
                <p className="text-xl font-bold text-green-400">
                  Sanatorio Argentino
                </p>
                <p className="text-gray-400 text-sm">
                  San Juan, Argentina
                </p>
                <div className="mt-4 pt-4 border-t border-gray-600">
                  <p className="text-xs text-gray-400">
                    Sistema de auditoría médica con tecnología de IA para optimización de procesos clínicos.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-6 text-center">
            <p className="text-gray-400 text-sm">
              © 2025 Grow Labs. Todos los derechos reservados. | Powered by AI & Automation
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
