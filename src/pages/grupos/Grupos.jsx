import { useEffect, useState } from "react";

import {
  AlertTriangle,
  LockKeyhole,
  Play,
  Users
} from "lucide-react";

import { supabase } from "../../services/supabase";
import { useAuth } from "../../context/AuthContext";
import { usePermissions } from "../../hooks/usePermissions";
import GroupAccessPanel from "../../components/cuadro/GroupAccessPanel";
import { iniciarCuadro } from "../../services/grupoService";

const Grupos = () => {
  const { grupo, cargarGrupo } = useAuth();
  const { can } = usePermissions();
  const [participantes, setParticipantes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [confirmandoInicio, setConfirmandoInicio] = useState(false);
  const [iniciando, setIniciando] = useState(false);

  useEffect(() => {
    if (!grupo?.id) return undefined;

    let active = true;
    Promise.resolve().then(async () => {
      if (!active) return;
      setLoading(true);
      const { data, error } = await supabase
        .from("participantes")
        .select("id, nombre, posicion, estado, perfil_id")
        .eq("grupo_id", grupo.id)
        .order("posicion", { ascending: true });

      if (active) {
        if (!active) return;
        if (error) {
          console.error("Error cargando participantes:", error);
          setMensaje("No se pudo cargar la lista de socios.");
          setParticipantes([]);
        } else {
          setMensaje("");
          setParticipantes(data || []);
        }
        setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [grupo?.id]);

  if (!grupo) {
    return (
      <div className="space-y-5">
        <header className="border-b border-slate-200 pb-4">
          <h1 className="text-2xl font-bold text-slate-900">Grupos y cuadros</h1>
          <p className="mt-1 text-sm text-slate-600">Solicita ingresar con un código o crea un grupo nuevo.</p>
        </header>
        <GroupAccessPanel />
      </div>
    );
  }

  const capacidad = Number(grupo.numero_integrantes || 0);
  const cuposDisponibles = Math.max(capacidad - participantes.length, 0);
  const grupoCompleto = capacidad > 0 && participantes.length === capacidad;
  const grupoExcedido = participantes.length > capacidad;
  const esBorrador = grupo.estado === "borrador";
  const esActivo = grupo.estado === "activo";
  const puedeIniciar = can("iniciarCuadro") && esBorrador && grupoCompleto && !grupoExcedido;
  const pozo = capacidad * Number(grupo.aporte_semanal || 0);

  const confirmarSorteo = async () => {
    if (!puedeIniciar || iniciando) return;

    setIniciando(true);
    setMensaje("");
    try {
      await iniciarCuadro(grupo.id);
      await cargarGrupo(grupo.id);
      setConfirmandoInicio(false);
    } catch (error) {
      console.error("Error aprobando el inicio del cuadro:", error);
      setMensaje(error.message || "No se pudo sortear e iniciar el cuadro.");
    } finally {
      setIniciando(false);
    }
  };

  return (
    <div className="space-y-7">
      <GroupAccessPanel />

      <header className="flex flex-col gap-5 border-b border-slate-200 pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-emerald-700">Grupo activo</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">{grupo.nombre}</h1>
          <p className="mt-2 text-sm text-slate-600">{esActivo ? "Cuadro activo" : grupo.estado === "finalizado" ? "Cuadro finalizado" : "En preparación"}</p>
        </div>
        {can("iniciarCuadro") && esBorrador && (
          <button
            type="button"
            onClick={() => setConfirmandoInicio(true)}
            disabled={!puedeIniciar}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-800 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            <Play size={17} /> Aprobar e iniciar sorteo
          </button>
        )}
        {esActivo && (
          <p className="inline-flex items-center gap-2 rounded-lg bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
            <LockKeyhole size={17} /> Posiciones bloqueadas
          </p>
        )}
      </header>

      {mensaje && <p className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{mensaje}</p>}

      <section className="grid gap-4 sm:grid-cols-3" aria-label="Resumen del grupo">
        <Metric icon={<Users size={19} />} label="Socios aprobados" value={`${participantes.length} / ${capacidad}`} />
        <Metric icon={<Users size={19} />} label="Cupos disponibles" value={cuposDisponibles} />
        <Metric label="Aporte semanal" value={`$${Number(grupo.aporte_semanal || 0).toFixed(2)}`} />
      </section>

      {grupoExcedido && (
        <div className="flex items-start gap-3 border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="alert">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <p>Este grupo supera su capacidad configurada. No se puede iniciar hasta revisar los datos existentes.</p>
        </div>
      )}

      {esBorrador && !grupoCompleto && !grupoExcedido && (
        <p className="border-l-4 border-blue-600 bg-blue-50 px-4 py-3 text-sm text-blue-950">
          Faltan {cuposDisponibles} socios aprobados para completar el grupo y habilitar el sorteo.
        </p>
      )}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <h2 className="font-semibold text-slate-900">Socios del grupo</h2>
          <p className="mt-1 text-sm text-slate-500">Las posiciones actuales son provisionales; al aprobar el inicio se sortearán al azar.</p>
        </div>
        {loading ? (
          <p className="px-5 py-8 text-sm text-slate-500" role="status">Cargando socios...</p>
        ) : participantes.length === 0 ? (
          <p className="px-5 py-8 text-sm text-slate-500">Aún no hay socios aprobados para este grupo.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="px-5 py-3 font-semibold">Posición provisional</th>
                  <th className="px-5 py-3 font-semibold">Socio</th>
                  <th className="px-5 py-3 font-semibold">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {participantes.map((participante) => (
                  <tr key={participante.id}>
                    <td className="px-5 py-3">{participante.posicion ?? "Pendiente"}</td>
                    <td className="px-5 py-3 font-medium text-slate-900">{participante.nombre}</td>
                    <td className="px-5 py-3 capitalize text-slate-600">{participante.estado || "pendiente"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {confirmandoInicio && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="presentation">
          <section className="w-full max-w-lg rounded-xl bg-white p-6 shadow-xl" role="dialog" aria-modal="true" aria-labelledby="confirmar-sorteo-titulo">
            <p className="text-sm font-semibold text-emerald-800">Aprobación de inicio</p>
            <h2 id="confirmar-sorteo-titulo" className="mt-1 text-xl font-bold text-slate-900">¿Sortear posiciones e iniciar?</h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">La base de datos asignará una posición aleatoria a cada socio y activará la primera ronda. Esta acción no se puede deshacer.</p>
            <dl className="mt-5 space-y-2 border-y border-slate-200 py-4 text-sm">
              <Row label="Grupo" value={grupo.nombre} />
              <Row label="Socios" value={capacidad} />
              <Row label="Aporte semanal" value={`$${Number(grupo.aporte_semanal || 0).toFixed(2)}`} />
              <Row label="Pozo estimado" value={`$${pozo.toFixed(2)}`} />
            </dl>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setConfirmandoInicio(false)} disabled={iniciando} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">Cancelar</button>
              <button type="button" onClick={confirmarSorteo} disabled={iniciando || !puedeIniciar} className="rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60">{iniciando ? "Procesando..." : "Confirmar sorteo"}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
};

const Metric = ({ icon, label, value }) => (
  <div className="flex items-center gap-3 border-y border-slate-200 py-4">
    {icon && <span className="text-emerald-800">{icon}</span>}
    <div>
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">{value}</p>
    </div>
  </div>
);

const Row = ({ label, value }) => (
  <div className="flex justify-between gap-4">
    <dt className="text-slate-500">{label}</dt>
    <dd className="font-semibold text-slate-900">{value}</dd>
  </div>
);

export default Grupos;
