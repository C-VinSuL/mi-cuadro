import { supabase } from "./supabase";

export const registrarEgreso = async ({ grupoId, concepto, categoria, monto, fecha }) => {
  const { data, error } = await supabase
    .from("egresos")
    .insert({
      grupo_id: grupoId,
      concepto,
      categoria,
      monto: Number(monto),
      fecha
    })
    .select("id")
    .single();

  if (error) throw error;
  return data;
};

export const listarEgresosRecientes = async (grupoIds) => {
  if (!grupoIds.length) return [];

  const { data, error } = await supabase
    .from("egresos")
    .select("id, grupo_id, concepto, categoria, monto, fecha, created_at")
    .in("grupo_id", grupoIds)
    .order("fecha", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;

  const { data: grupos, error: gruposError } = await supabase
    .from("grupos")
    .select("id, nombre")
    .in("id", grupoIds);
  if (gruposError) throw gruposError;

  const nombresGrupo = new Map((grupos || []).map((grupo) => [grupo.id, grupo.nombre]));
  return (data || []).map((egreso) => ({
    ...egreso,
    grupo: nombresGrupo.get(egreso.grupo_id) || "Grupo"
  }));
};

export const obtenerTotalEgresos = async () => {
  const { data, error } = await supabase.rpc("obtener_total_egresos_tesoreria");
  if (error) throw error;
  return Number(data || 0);
};
