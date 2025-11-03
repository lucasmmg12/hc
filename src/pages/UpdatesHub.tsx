import { useEffect, useState } from 'react';
import { Loader2, Plus, Save } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

type UpdateRow = {
  id: string;
  title: string;
  content_md: string;
  tags: string[] | null;
  status: 'publicado' | 'borrador';
  created_at: string;
};

const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL!,
  import.meta.env.VITE_SUPABASE_ANON_KEY!
);

export function UpdatesHub() {
  const [tab, setTab] = useState<'listado' | 'nuevo'>('listado');
  const [loading, setLoading] = useState(false);
  const [items, setItems] = useState<UpdateRow[]>([]);
  const [q, setQ] = useState('');
  const [form, setForm] = useState({
    title: '',
    content_md: '',
  });
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const ensureAuth = async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) {
      // Requiere habilitar "Anonymous Sign-ins" en Supabase Auth
      await supabase.auth.signInAnonymously();
    }
  };

  const cargar = async () => {
    setLoading(true);
    setErrorMsg(null);
    const { data, error } = await supabase
      .from('updates')
      .select('id,title,content_md,tags,status,created_at')
      .order('created_at', { ascending: false });
    if (error) {
      setErrorMsg(error.message);
    }
    setItems((data as UpdateRow[]) || []);
    setLoading(false);
  };

  const guardar = async () => {
    if (!form.title.trim() || !form.content_md.trim()) return;
    setLoading(true);
    setErrorMsg(null);
    setOkMsg(null);
    const { error } = await supabase.from('updates').insert({
      title: form.title.trim(),
      content_md: form.content_md.trim(),
    });
    if (error) {
      setErrorMsg(error.message);
      setLoading(false);
      return;
    }
    setForm({ title: '', content_md: '' });
    setTab('listado');
    await cargar();
    setOkMsg('Actualización guardada');
    setLoading(false);
  };

  useEffect(() => {
    (async () => {
      await ensureAuth();
      await cargar();
    })();
  }, []);

  const filtered = items.filter((i) => {
    const query = q.trim().toLowerCase();
    if (!query) return true;
    return (
      i.title.toLowerCase().includes(query) ||
      i.content_md.toLowerCase().includes(query) ||
      (i.tags || []).some((t) => t.toLowerCase().includes(query))
    );
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-3xl font-extrabold text-white tracking-tight">Actualizaciones</h2>
          <p className="text-white">Notas de cambios y novedades del proyecto</p>
        </div>
        <div className="flex gap-2">
          <button
            className={`px-4 py-2 rounded-lg border transition-all ${
              tab === 'listado'
                ? 'bg-green-600 text-white border-green-600 shadow'
                : 'bg-white text-gray-700 hover:bg-green-50 border-gray-200'
            }`}
            onClick={() => setTab('listado')}
          >
            Listado
          </button>
          <button
            className={`px-4 py-2 rounded-lg border transition-all ${
              tab === 'nuevo'
                ? 'bg-green-600 text-white border-green-600 shadow'
                : 'bg-white text-gray-700 hover:bg-green-50 border-gray-200'
            }`}
            onClick={() => setTab('nuevo')}
          >
            <span className="inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> Nueva
            </span>
          </button>
        </div>
      </div>

      {tab === 'listado' && (
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100">
          {errorMsg && (
            <div className="mb-3 p-3 rounded-lg bg-red-50 text-red-700 text-sm border border-red-200">{errorMsg}</div>
          )}
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
            <input
              placeholder="Buscar por título, contenido o tag..."
              className="w-full md:w-96 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <div className="text-sm text-gray-500">{filtered.length} resultado(s)</div>
          </div>
          {loading ? (
            <div className="flex items-center gap-2 text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-10 text-gray-500">No hay actualizaciones todavía.</div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {filtered.map((u) => (
                <article key={u.id} className="rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">{u.title}</h3>
                      <p className="mt-1 text-sm text-gray-600 line-clamp-3 whitespace-pre-wrap">{u.content_md}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(u.tags || []).map((t) => (
                          <span key={t} className="px-2.5 py-0.5 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs">
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span
                        className={`inline-block text-xs px-2 py-1 rounded-full ${
                          u.status === 'publicado' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                        }`}
                      >
                        {u.status}
                      </span>
                      <div className="text-xs text-gray-500 mt-2">{new Date(u.created_at).toLocaleString('es-AR')}</div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === 'nuevo' && (
        <div className="bg-white rounded-2xl shadow-lg p-6 border border-gray-100 space-y-3">
          {errorMsg && (
            <div className="p-2 rounded bg-red-50 text-red-700 text-sm">{errorMsg}</div>
          )}
          {okMsg && (
            <div className="p-2 rounded bg-green-50 text-green-700 text-sm">{okMsg}</div>
          )}
          <div className="space-y-3">
            <input
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Título"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <textarea
              className="w-full h-56 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
              placeholder="Desarrollo (Markdown o texto)"
              value={form.content_md}
              onChange={(e) => setForm({ ...form, content_md: e.target.value })}
            />
          </div>
          <button
            onClick={guardar}
            disabled={loading}
            className="px-4 py-2 bg-green-600 text-white rounded-lg inline-flex items-center gap-2 disabled:opacity-50"
          >
            <Save className="w-4 h-4" /> {loading ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      )}
    </div>
  );
}


