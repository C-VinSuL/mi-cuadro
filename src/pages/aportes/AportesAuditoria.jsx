import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, FileSearch, RefreshCw } from "lucide-react";
import SectionPageTitle from "../../components/ui/SectionPageTitle";
import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../services/supabase";
import { logOperationalError } from "../../utils/logOperationalError";

const stateLabels = {
  pagado: "Pagado",
  pendiente: "Pendiente",
  aprobado: "Aprobado",
  rechazado: "Rechazado"
};

const AportesAuditoria = () => {
  const { grupos } = useAuth();
  const [aportes, setAportes] = useState([]);
  const [participants, setParticipants] = useState([]);
  const [groupFilter, setGroupFilter] = useState("");
  const [stateFilter, setStateFilter] = useState("");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [receipt, setReceipt] = useState(null);
  const [receiptError, setReceiptError] = useState("");
  const [receiptLoading, setReceiptLoading] = useState(false);

  const loadData = useCallback(async () => {
    const groupIds = grupos.map((group) => group.id);
    if (groupIds.length === 0) {
      setAportes([]);
      setParticipants([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError("");
    try {
      const [contributionRows, participantResponse] = await Promise.all([
        (async () => {
          const rows = [];
          const pageSize = 1000;
          for (let offset = 0; ; offset += pageSize) {
            const { data, error: queryError } = await supabase
              .from("aportes")
              .select("id, grupo_id, participante_id, semana, monto, estado, estado_revision, fecha_pago, comprobante_path, revisado_en, nota_revision")
              .in("grupo_id", groupIds)
              .order("fecha_pago", { ascending: false, nullsFirst: false })
              .range(offset, offset + pageSize - 1);
            if (queryError) throw queryError;
            rows.push(...(data || []));
            if (!data || data.length < pageSize) break;
          }
          return rows;
        })(),
        supabase
          .from("participantes")
          .select("id, grupo_id, nombre")
          .in("grupo_id", groupIds)
      ]);
      if (participantResponse.error) throw participantResponse.error;
      setAportes(contributionRows);
      setParticipants(participantResponse.data || []);
    } catch (loadError) {
      logOperationalError("Error cargando aportes para auditoría:", loadError);
      setError("No se pudieron cargar los aportes. Verifica que tu sesión tenga la verificación de seguridad activa e inténtalo de nuevo.");
    } finally {
      setLoading(false);
    }
  }, [grupos]);

  useEffect(() => {
    const timeoutId = window.setTimeout(loadData, 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadData]);

  const participantNames = useMemo(
    () => new Map(participants.map((participant) => [participant.id, participant.nombre])),
    [participants]
  );
  const groupNames = useMemo(
    () => new Map(grupos.map((group) => [group.id, group.nombre])),
    [grupos]
  );
  const visibleRows = useMemo(() => {
    const term = search.trim().toLocaleLowerCase("es-EC");
    return aportes.filter((aporte) => {
      if (groupFilter && aporte.grupo_id !== groupFilter) return false;
      const state = aporte.estado_revision || aporte.estado;
      if (stateFilter && state !== stateFilter) return false;
      if (fromDate && (!aporte.fecha_pago || aporte.fecha_pago.slice(0, 10) < fromDate)) return false;
      if (toDate && (!aporte.fecha_pago || aporte.fecha_pago.slice(0, 10) > toDate)) return false;
      if (!term) return true;
      const text = [
        participantNames.get(aporte.participante_id),
        groupNames.get(aporte.grupo_id),
        aporte.semana,
        aporte.estado,
        aporte.estado_revision,
        aporte.monto
      ].join(" ").toLocaleLowerCase("es-EC");
      return text.includes(term);
    });
  }, [aportes, fromDate, groupFilter, groupNames, participantNames, search, stateFilter, toDate]);

  const getReceiptLink = async (aporte) => {
    if (!aporte.comprobante_path) return;
    setReceiptLoading(true);
    setReceiptError("");
    setReceipt(null);
    try {
      const { data, error: signedUrlError } = await supabase.storage
        .from("contribution-receipts")
        .createSignedUrl(aporte.comprobante_path, 120);
      if (signedUrlError) throw signedUrlError;
      setReceipt({
        name: participantNames.get(aporte.participante_id) || "Socio",
        group: groupNames.get(aporte.grupo_id) || "Grupo",
        url: data.signedUrl
      });
    } catch (linkError) {
      logOperationalError("Error generando acceso temporal al comprobante:", linkError);
      setReceiptError("No se pudo abrir el comprobante. Comprueba que la verificación de seguridad esté activa.");
    } finally {
      setReceiptLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <SectionPageTitle
        icon={FileSearch}
        eyebrow="Consulta de solo lectura"
        title="Aportes de todos los grupos"
        description="Revisa estados, montos y comprobantes sin aprobar, rechazar ni modificar aportes."
      />
      {error && <p role="alert" className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm font-medium text-slate-700">
          Grupo
          <select value={groupFilter} onChange={(event) => setGroupFilter(event.target.value)} className="mt-1 block min-w-48 rounded-lg border border-slate-300 bg-white px-3 py-2.5">
            <option value="">Todos</option>
            {grupos.map((group) => <option key={group.id} value={group.id}>{group.nombre}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Estado
          <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} className="mt-1 block min-w-44 rounded-lg border border-slate-300 bg-white px-3 py-2.5">
            <option value="">Todos</option>
            {Object.entries(stateLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="text-sm font-medium text-slate-700">
          Buscar socio, grupo o período
          <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar" className="mt-1 block min-h-11 rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Desde
          <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} className="mt-1 block min-h-11 rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <label className="text-sm font-medium text-slate-700">
          Hasta
          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} className="mt-1 block min-h-11 rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <button type="button" onClick={loadData} disabled={loading} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          <RefreshCw size={15} className={loading ? "animate-spin" : ""} />
          Actualizar
        </button>
      </div>
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Registro de aportes</h2>
          <p className="mt-1 text-sm text-slate-500">{visibleRows.length} resultados de {aportes.length} aportes</p>
        </div>
        {loading ? (
          <p role="status" className="px-5 py-8 text-sm text-slate-500">Cargando aportes...</p>
        ) : visibleRows.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">No hay aportes para los filtros seleccionados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-4 py-3">Fecha de pago</th>
                  <th className="px-4 py-3">Grupo</th>
                  <th className="px-4 py-3">Socio</th>
                  <th className="px-4 py-3">Período</th>
                  <th className="px-4 py-3">Monto</th>
                  <th className="px-4 py-3">Estado</th>
                  <th className="px-4 py-3">Comprobante</th>
                  <th className="px-4 py-3">Revisado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {visibleRows.map((aporte) => {
                  const state = aporte.estado_revision || aporte.estado || "—";
                  return (
                    <tr key={aporte.id}>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{aporte.fecha_pago ? new Date(aporte.fecha_pago).toLocaleDateString("es-EC") : "Sin fecha"}</td>
                      <td className="px-4 py-3">{groupNames.get(aporte.grupo_id) || "—"}</td>
                      <td className="px-4 py-3">{participantNames.get(aporte.participante_id) || "Socio"}</td>
                      <td className="px-4 py-3">{aporte.semana}</td>
                      <td className="px-4 py-3">{new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(Number(aporte.monto || 0))}</td>
                      <td className="px-4 py-3">{stateLabels[state] || state}</td>
                      <td className="px-4 py-3">
                        {aporte.comprobante_path ? (
                          <button type="button" onClick={() => getReceiptLink(aporte)} disabled={receiptLoading} className="font-semibold text-emerald-800 hover:underline disabled:opacity-50">
                            Consultar comprobante
                          </button>
                        ) : "No adjunto"}
                      </td>
                      <td className="px-4 py-3">{aporte.revisado_en ? new Date(aporte.revisado_en).toLocaleString("es-EC") : "Sin revisar"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {receiptError && <p role="alert" className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">{receiptError}</p>}
      {receipt && (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50 p-4" aria-live="polite">
          <p className="text-sm text-emerald-950">Comprobante de {receipt.name} · {receipt.group}. El enlace expira en 2 minutos.</p>
          <a href={receipt.url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-2 text-sm font-semibold text-emerald-900 underline">
            Abrir comprobante
            <ExternalLink size={14} />
          </a>
        </section>
      )}
    </div>
  );
};

export default AportesAuditoria;
