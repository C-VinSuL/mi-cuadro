import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { CheckCircle2, CircleAlert, MailCheck } from "lucide-react";
import { supabase } from "../../services/supabase";
import { useAuth } from "../../context/AuthContext";

const AcceptGroupInvite = () => {
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const token = searchParams.get("token") || "";
  const [status, setStatus] = useState("confirm");
  const [error, setError] = useState("");

  const aceptarInvitacion = async () => {
    if (!token || !user?.id) return;
    setStatus("loading");
    setError("");
    const { data, error: invokeError } = await supabase.functions.invoke("group-invitations", {
      body: { action: "accept", token }
    });

    if (invokeError || data?.error) {
      console.error("Error aceptando invitación:", invokeError || data.error);
      setError(data?.error || invokeError.message || "No se pudo aceptar la invitación.");
      setStatus("error");
      return;
    }

    setStatus("success");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-10">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-7 shadow-xl">
        {status === "success" ? (
          <>
            <CheckCircle2 size={42} className="text-emerald-700" />
            <h1 className="mt-4 text-2xl font-bold text-slate-950">Invitación aceptada</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Tu solicitud llegó al administrador. El ingreso al grupo será efectivo cuando administración la apruebe.</p>
            <Link to="/grupo" className="mt-6 inline-flex rounded-lg bg-emerald-800 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-900">Ir a mis grupos</Link>
          </>
        ) : status === "error" ? (
          <>
            <CircleAlert size={42} className="text-red-700" />
            <h1 className="mt-4 text-2xl font-bold text-slate-950">No se pudo aceptar la invitación</h1>
            <p className="mt-2 text-sm text-red-800" role="alert">{error}</p>
            <Link to="/grupo" className="mt-6 inline-flex rounded-lg border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">Volver a mis grupos</Link>
          </>
        ) : (
          <>
            <MailCheck size={42} className="text-emerald-700" />
            <h1 className="mt-4 text-2xl font-bold text-slate-950">Confirmar invitación al grupo</h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">Estás conectado como <strong>{user?.email}</strong>. Al continuar, aceptarás la invitación enviada a este correo; luego el administrador deberá aprobar tu ingreso.</p>
            {!token && <p className="mt-4 text-sm text-red-700" role="alert">El enlace no incluye un token de invitación válido.</p>}
            <button type="button" onClick={aceptarInvitacion} disabled={!token || status === "loading"} className="mt-6 w-full rounded-lg bg-emerald-800 px-4 py-3 text-sm font-semibold text-white hover:bg-emerald-900 disabled:cursor-not-allowed disabled:opacity-50">
              {status === "loading" ? "Confirmando..." : "Aceptar invitación"}
            </button>
          </>
        )}
      </section>
    </main>
  );
};

export default AcceptGroupInvite;
