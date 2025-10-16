import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://gtafpsqkerbxgzplxsym.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imd0YWZwc3FrZXJieGd6cGx4c3ltIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2ODkxMTUsImV4cCI6MjA3NTI2NTExNX0.ytVMT6cpWFC2TjAcGxdmf_eexhe8pHZhPA6wsQ6aTDI';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export function getSupabaseConfig() {
  return {
    url: supabaseUrl,
    anonKey: supabaseAnonKey
  };
}
