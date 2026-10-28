import { useCallback, useEffect, useState } from "react";
import { ExternalLink, FileSearch, RefreshCw } from "lucide-react";

import SectionPageTitle from "../../components/ui/SectionPageTitle";
import { listarArchivosAuditoriaAdministrador } from "../../services/adminService";
import { supabase } from "../../services/supabase";
import { logOperationalError } from "../../utils/logOperationalError";

const ArchivosAuditoria = () => {
  const [files, setFiles] = useState([]);
  const [totalFiles, setTotalFiles] = useState(0);
  const [loading, setLoading] = useState(true);
  const [openingPath, setOpeningPath] = useState("");
  const [error, setError] = useState("");

  const loadFiles = useCallback(async (offset = 0, append = false) => {
    setLoading(true);
    setError("");
    try {
      const rows = await listarArchivosAuditoriaAdministrador(offset) || [];
      setFiles((current) => append ? [...current, ...rows] : rows);
      if (rows.length) setTotalFiles(Number(rows[0].total_count));
      else if (!append) setTotalFiles(0);
    } catch (loadError) {
      logOperationalError("Error cargando archivos para auditoría:", loadError);
      setError("No se pudieron cargar los archivos. Verifica tu sesión MFA y tus permisos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => loadFiles(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [loadFiles]);

  const openFile = async (file) => {
    if (openingPath) return;
    const fileWindow = window.open("about:blank", "_blank");
    if (!fileWindow) {
      setError("Permite las ventanas emergentes para abrir el archivo.");
      return;
    }
    fileWindow.opener = null;
    setOpeningPath(file.object_path);
    setError("");
    try {
      if (file.bucket_id === "profile-avatars") {
        const { data } = supabase.storage.from(file.bucket_id).getPublicUrl(file.object_path);
        fileWindow.location.href = data.publicUrl;
      } else {
        const { data, error: urlError } = await supabase.storage
          .from(file.bucket_id)
          .createSignedUrl(file.object_path, 60);
        if (urlError) throw urlError;
        fileWindow.location.href = data.signedUrl;
      }
    } catch (openError) {
      fileWindow.close();
      logOperationalError("Error abriendo archivo de auditoría:", openError);
      setError("No se pudo abrir el archivo. Verifica que tengas acceso vigente y vuelve a intentarlo.");
    } finally {
      setOpeningPath("");
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <SectionPageTitle
          icon={FileSearch}
          eyebrow="Administración · MFA requerido"
          title="Archivos de auditoría"
          description="Consulta los archivos cargados en la plataforma. Los documentos privados se abren mediante enlaces temporales."
        />
        <button
          type="button"
          onClick={() => loadFiles()}
          disabled={loading}
          aria-label="Actualizar archivos"
          className="mt-2 flex size-10 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          <RefreshCw size={17} className={loading ? "animate-spin" : ""} />
        </button>
      </header>

      <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
        Solo el rol administrador puede consultar este listado. Las identificaciones y comprobantes no son públicos; los avatares sí son imágenes públicas de perfil. Los enlaces privados vencen después de 60 segundos.
      </p>

      {error && <p role="alert" className="border-l-4 border-red-600 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <header className="border-b border-slate-200 px-4 py-4 sm:px-5">
          <h2 className="font-semibold text-slate-900">Archivos registrados</h2>
          <p className="mt-1 text-sm text-slate-500">
            {loading ? "Cargando…" : `${files.length} de ${totalFiles} archivos`}
          </p>
        </header>
        {loading && files.length === 0 ? (
          <p role="status" className="p-6 text-sm text-slate-500">Cargando archivos…</p>
        ) : files.length === 0 ? (
          <p className="p-6 text-sm text-slate-500">No se encontraron archivos vinculados a registros.</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {files.map((file) => (
              <li key={`${file.bucket_id}:${file.object_path}`} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div className="min-w-0">
                  <p className="font-semibold text-slate-800">{file.categoria}</p>
                  <p className="mt-0.5 break-all text-sm text-slate-600">{file.nombre_archivo}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {file.propietario} · {file.contexto}
                    {file.creado_en ? ` · ${new Date(file.creado_en).toLocaleString("es-EC")}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => openFile(file)}
                  disabled={Boolean(openingPath)}
                  className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-lg border border-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50 disabled:opacity-50"
                >
                  <ExternalLink size={16} />
                  {openingPath === file.object_path ? "Abriendo…" : "Abrir"}
                </button>
              </li>
            ))}
          </ul>
        )}
        {files.length < totalFiles && (
          <div className="border-t border-slate-100 p-4 text-center">
            <button
              type="button"
              onClick={() => loadFiles(files.length, true)}
              disabled={loading}
              className="min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              {loading ? "Cargando…" : "Cargar más archivos"}
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default ArchivosAuditoria;
