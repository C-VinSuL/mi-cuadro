import { supabase } from "./supabase.js";
import { amountCentsToDecimal, parseAmountToCents } from "../utils/money.js";

export const registrarEgreso = async ({ grupoId, concepto, categoria, monto, fecha }) => {
  const normalizedConcept = typeof concepto === "string" ? concepto.trim() : "";
  const normalizedCategory = typeof categoria === "string" ? categoria.trim() : "";
  const amountInCents = parseAmountToCents(monto);
  const validDate = typeof fecha === "string"
    && /^\d{4}-\d{2}-\d{2}$/.test(fecha)
    && !Number.isNaN(Date.parse(`${fecha}T00:00:00.000Z`))
    && new Date(`${fecha}T00:00:00.000Z`).toISOString().slice(0, 10) === fecha;

  if (typeof grupoId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(grupoId)) {
    throw new TypeError("El identificador del grupo no es válido.");
  }
  if (!normalizedConcept || normalizedConcept.length > 500) {
    throw new TypeError("El concepto debe tener entre 1 y 500 caracteres.");
  }
  if (!normalizedCategory || normalizedCategory.length > 80) {
    throw new TypeError("La categoría debe tener entre 1 y 80 caracteres.");
  }
  if (amountInCents === null) {
    throw new TypeError("El monto debe ser positivo y tener como máximo dos decimales.");
  }
  if (!validDate) {
    throw new TypeError("La fecha debe ser una fecha válida en formato AAAA-MM-DD.");
  }

  const { data, error } = await supabase
    .from("egresos")
    .insert({
      grupo_id: grupoId,
      concepto: normalizedConcept,
      categoria: normalizedCategory,
      monto: amountCentsToDecimal(amountInCents),
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
  return String(data ?? 0);
};
