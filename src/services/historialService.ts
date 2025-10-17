import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface AuditoriaHistorial {
  id: string;
  created_at: string;
  updated_at: string;
  nombre_archivo: string;
  nombre_paciente: string;
  dni_paciente: string;
  obra_social: string;
  habitacion: string;
  fecha_ingreso: string;
  fecha_alta: string | null;
  total_errores: number;
  errores_admision: number;
  errores_evoluciones: number;
  errores_foja_quirurgica: number;
  errores_alta_medica: number;
  errores_epicrisis: number;
  bisturi_armonico: string;
  estado: string;
  pdf_url: string | null;
  errores_detalle: any[];
  comunicaciones: any[];
  datos_adicionales: any;
}

export interface FiltrosHistorial {
  nombrePaciente?: string;
  dni?: string;
  fechaDesde?: string;
  fechaHasta?: string;
  estado?: string;
  bisturiArmonico?: string;
}

export async function obtenerHistorialAuditorias(
  filtros?: FiltrosHistorial,
  page: number = 1,
  pageSize: number = 20
): Promise<{ data: AuditoriaHistorial[]; count: number; error?: string }> {
  try {
    let query = supabase
      .from('auditorias')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (filtros?.nombrePaciente) {
      query = query.ilike('nombre_paciente', `%${filtros.nombrePaciente}%`);
    }

    if (filtros?.dni) {
      query = query.ilike('dni_paciente', `%${filtros.dni}%`);
    }

    if (filtros?.fechaDesde) {
      query = query.gte('created_at', filtros.fechaDesde);
    }

    if (filtros?.fechaHasta) {
      query = query.lte('created_at', filtros.fechaHasta);
    }

    if (filtros?.estado) {
      query = query.eq('estado', filtros.estado);
    }

    if (filtros?.bisturiArmonico) {
      query = query.eq('bisturi_armonico', filtros.bisturiArmonico);
    }

    const start = (page - 1) * pageSize;
    const end = start + pageSize - 1;
    query = query.range(start, end);

    const { data, error, count } = await query;

    if (error) {
      console.error('Error fetching auditorias:', error);
      return { data: [], count: 0, error: error.message };
    }

    return {
      data: data || [],
      count: count || 0,
    };
  } catch (error) {
    console.error('Error in obtenerHistorialAuditorias:', error);
    return {
      data: [],
      count: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function obtenerAuditoriaPorId(
  id: string
): Promise<{ data: AuditoriaHistorial | null; error?: string }> {
  try {
    const { data, error } = await supabase
      .from('auditorias')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching auditoria by ID:', error);
      return { data: null, error: error.message };
    }

    return { data };
  } catch (error) {
    console.error('Error in obtenerAuditoriaPorId:', error);
    return {
      data: null,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}

export async function obtenerEstadisticasHistorial(): Promise<{
  totalAuditorias: number;
  auditoriasPendientes: number;
  auditoriasAprobadas: number;
  totalErrores: number;
  error?: string;
}> {
  try {
    const { data, error } = await supabase
      .from('auditorias')
      .select('estado, total_errores');

    if (error) {
      console.error('Error fetching estadisticas:', error);
      return {
        totalAuditorias: 0,
        auditoriasPendientes: 0,
        auditoriasAprobadas: 0,
        totalErrores: 0,
        error: error.message,
      };
    }

    const totalAuditorias = data.length;
    const auditoriasPendientes = data.filter(
      (a) => a.estado === 'Pendiente de corrección' || a.estado === 'En Revisión'
    ).length;
    const auditoriasAprobadas = data.filter((a) => a.estado === 'Aprobado').length;
    const totalErrores = data.reduce((sum, a) => sum + (a.total_errores || 0), 0);

    return {
      totalAuditorias,
      auditoriasPendientes,
      auditoriasAprobadas,
      totalErrores,
    };
  } catch (error) {
    console.error('Error in obtenerEstadisticasHistorial:', error);
    return {
      totalAuditorias: 0,
      auditoriasPendientes: 0,
      auditoriasAprobadas: 0,
      totalErrores: 0,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
