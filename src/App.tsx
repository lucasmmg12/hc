import { useState } from 'react';
import { FileText, Stethoscope, Menu, X } from 'lucide-react';
import { Documentacion } from './pages/Documentacion';
import { AuditarPDF } from './pages/AuditarPDF';

type Page = 'documentacion' | 'auditar';

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('documentacion');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white shadow-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-700 rounded-lg flex items-center justify-center">
                <Stethoscope className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">Auditoría Médica</h1>
                <p className="text-sm text-gray-600">Sanatorio Argentino</p>
              </div>
            </div>

            <nav className="hidden md:flex gap-2">
              <button
                onClick={() => setCurrentPage('documentacion')}
                className={`px-6 py-2 rounded-lg font-semibold transition-all ${
                  currentPage === 'documentacion'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Stethoscope className="w-4 h-4" />
                  Auditar PDF
                </span>
              </button>
            </nav>

            <button
              className="md:hidden p-2 rounded-lg hover:bg-gray-100"
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
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700'
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
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Stethoscope className="w-4 h-4" />
                  Auditar PDF
                </span>
              </button>
            </nav>
          )}
        </div>
      </header>

      <main className="pb-12">
        {currentPage === 'documentacion' && <Documentacion />}
        {currentPage === 'auditar' && <AuditarPDF />}
      </main>

      <footer className="bg-gray-900 text-white py-6">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-gray-400">
            Sistema desarrollado por <span className="text-blue-400 font-semibold">Grow Labs</span>
          </p>
          <p className="text-gray-500 text-sm mt-1">
            Sanatorio Argentino - San Juan, Argentina
          </p>
        </div>
      </footer>
    </div>
  );
}

export default App;
