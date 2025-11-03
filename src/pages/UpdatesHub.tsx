import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { Plus, Save, Loader2 } from 'lucide-react';

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
    tags: '',
    status: 'publicado' as 'publicado' | 'borrador'
  });

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return items;
    return items.filter(i =>
      i.title.toLowerCase().includes(query) ||
      i.content_md.toLowerCase().includes(query) ||
      (i.tags || []).some(t => t.toLowerCase().includes(query))
    );
  }, [q, items]);

  const cargar = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('updates')
      .select('id,title,content_md,tags,status,created_at')
      .order('created_at', { ascending: false });
    if (!error && data) setItems(data as UpdateRow[]);
    setLoading(false);
  };

  const guardar = async () => {
    if (!form.title.trim() || !form.content_md.trim()) return;
    setLoading(true);
    const tags = form.tags
      .split(',')
      .map(t => t.trim())
      .filter(Boolean);
    const { error } = await supabase.from('updates').insert({
      title: form.title.trim(),
      content_md: form.content_md.trim(),
      tags,
      status: form.status
    });
    if (!error) {
      setForm({ title: '', content_md: '', tags: '', status: 'publicado' });
      setTab('listado');
      await cargar();
    }
    setLoading(false);
  };

  useEffect(() => {
    cargar();
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Actualizaciones</h2>
        <div className="flex gap-2">
          <button
            className={`px-4 py-2 rounded-lg border ${tab==='listado'?'bg-green-600 text-white border-green-600':'bg-white text-gray-700'}`}
            onClick={() => setTab('listado')}
          >
            Listado
          </button>
          <button
            className={`px-4 py-2 rounded-lg border ${tab==='nuevo'?'bg-green-600 text-white border-green-600':'bg-white text-gray-700'}`}
            onClick={() => setTab('nuevo')}
          >
            <span className="inline-flex items-center gap-1"><Plus className="w-4 h-4" />Nuevo</span>
          </button>
        </div>
      </div>

      {tab === 'listado' && (
        <div className="bg-white rounded-xl shadow p-6">
          <input
            placeholder="Buscar por título, contenido o tag..."
            className="w-full mb-4 px-3 py-2 border rounded-lg"
            value={q}
            onChange={(e)=>setQ(e.target.value)}
          />
          {loading ? (
            <div className="flex items-center gap-2 text-gray-600">
              <Loader2 className="w-4 h-4 animate-spin" /> Cargando...
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-gray-500">Sin actualizaciones aún.</p>
          ) : (
            <ul className="divide-y">
              {filtered.map((u) => (
                <li key={u.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-gray-900">{u.title}</h3>
                      <p className="text-sm text-gray-600 line-clamp-2">{u.content_md}</p>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {(u.tags || []).map(t=>(
                          <span key={t} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">{t}</span>
                        ))}
                      </div>
                    </div>
                    <div className="text-right">
                      <span className={`text-xs px-2 py-1 rounded ${u.status==='publicado'?'bg-green-100 text-green-700':'bg-gray-100 text-gray-700'}`}>
                        {u.status}
                      </span>
                      <div className="text-xs text-gray-500 mt-1">
                        {new Date(u.created_at).toLocaleString('es-AR')}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {tab === 'nuevo' && (
        <div className="bg-white rounded-xl shadow p-6 space-y-3">
          <input
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="Título"
            value={form.title}
            onChange={e=>setForm({...form, title: e.target.value})}
          />
          <textarea
            className="w-full h-48 px-3 py-2 border rounded-lg"
            placeholder="Contenido (Markdown)"
            value={form.content_md}
            onChange={e=>setForm({...form, content_md: e.target.value})}
          />
          <input
            className="w-full px-3 py-2 border rounded-lg"
            placeholder="Tags (separadas por coma, ej: UI,Kinesiología)"
            value={form.tags}
            onChange={e=>setForm({...form, tags: e.target.value})}
          />
          <div className="flex items-center gap-3">
            <label className="text-sm text-gray-700">Estado</label>
            <select
              className="border rounded px-2 py-1"
              value={form.status}
              onChange={e=>setForm({...form, status: e.target.value as any})}
            >
              <option value="publicado">Publicado</option>
              <option value="borrador">Borrador</option>
            </select>
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