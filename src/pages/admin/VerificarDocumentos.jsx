import { useCallback, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { useNotifications } from "../../hooks/useNotifications";
import { listarDocumentosPendientes, verificarDocumento } from "../../services/adminService";
import { supabase } from "../../services/supabase";

const VerificarDocumentos = () => {
  const { notify } = useNotifications();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState("");
  const [openingDocumentId, setOpeningDocumentId] = useState("");
  const [error, setError] = useState("");

  const cargar = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setProfiles(await listarDocumentosPendientes());
    } catch (loadError) {
      console.error("Error consultando documentos pendientes:", loadError);
      setError(loadError.message || "No se pudieron cargar los documentos pendientes.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(cargar, 0);
    return () => window.clearTimeout(timeoutId);
  }, [cargar]);

  const verificar = async (profile) => {
    if (!window.confirm(`Confirma que comparaste el documento original de ${profile.nombre} ${profile.apellido}.`)) return;
    setSavingId(profile.id);
    setError("");
    try {
      await verificarDocumento(profile.id);
      setProfiles((current) => current.filter((item) => item.id !== profile.id));
      notify({ title: "Documento verificado", message: "La verificación quedó registrada para revisión de roles.", type: "success" });
    } catch (verifyError) {
      console.error("Error verificando documento:", verifyError);
      setError(verifyError.message || "No se pudo registrar la verificación.");
    } finally {
      setSavingId("");
    }
  };

  const abrirDocumento = async (profile) => {
    setOpeningDocumentId(profile.id);
    setError("");
    try {
      const { data, error: urlError } = await supabase.storage
        .from("identity-documents")
        .createSignedUrl(profile.documento_identidad_path, 60);
      if (urlError) throw urlError;
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (documentError) {
      console.error("Error abriendo documento privado:", documentError);
      setError(documentError.message || "No se pudo abrir el documento.");
    } finally {
      setOpeningDocumentId("");
    }
  };

  return (
    <div className="space-y-6">
      <header className="border-b border-slate-200 pb-5">
        <p className="text-sm font-semibold text-emerald-700">Administración y tesorería</p>
        <h1 className="mt-1 text-3xl font-bold text-slate-900">Verificación documental</h1>
        <p className="mt-2 text-sm text-slate-600">Administración y tesorería pueden comparar los datos declarados con el documento original. Esta revisión humana queda registrada en auditoría; no valida automáticamente la identidad.</p>
      </header>
      {error && <p className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{error}</p>}
      {loading ? (
        <p className="py-8 text-sm text-slate-500" role="status">Cargando...</p>
      ) : profiles.length === 0 ? (
        <p className="rounded-xl border border-slate-200 bg-white p-7 text-sm text-slate-500">No hay documentos pendientes de revisión.</p>
      ) : (
        <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white px-5">
          {profiles.map((profile) => (
            <article key={profile.id} className="flex flex-wrap items-center justify-between gap-4 py-5">
              <div>
                <h2 className="font-semibold text-slate-900">{profile.nombre} {profile.apellido}</h2>
                <p className="mt-1 text-sm text-slate-700">Documento: {profile.cedula}</p>
                <p className="text-sm text-slate-500">Teléfono: {profile.telefono || "No registrado"} · Dirección: {profile.direccion || "No registrada"}</p>
                <button type="button" onClick={() => abrirDocumento(profile)} disabled={openingDocumentId === profile.id} className="mt-2 text-sm font-semibold text-emerald-800 underline disabled:opacity-50">{openingDocumentId === profile.id ? "Abriendo documento..." : "Abrir documento de identidad"}</button>
              </div>
              <button type="button" onClick={() => verificar(profile)} disabled={savingId === profile.id} className="inline-flex items-center gap-2 rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60">
                <ShieldCheck size={17} /> {savingId === profile.id ? "Guardando..." : "Confirmar revisión"}
              </button>
            </article>
          ))}
        </div>
      )}
    </div>
  );
};

export default VerificarDocumentos;
