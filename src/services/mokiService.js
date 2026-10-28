import { supabase } from "./supabase";
import { createUniqueId } from "../utils/uniqueId";
import { getStorageUploadErrorMessage, getSupportedDocumentMimeType } from "../utils/fileUpload";

const unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};

const createFileUploadError = (message) => {
  const error = new Error(message);
  error.name = "FileUploadError";
  return error;
};

export const listarMisConversacionesMoki = async (socioId) => {
  const { error: closeError } = await supabase.rpc("moki_cerrar_conversaciones_inactivas");
  if (closeError) throw closeError;

  const { data, error } = await supabase
    .from("moki_conversaciones")
    .select("id, estado, actualizado_en")
    .eq("socio_id", socioId)
    .is("archivado_en", null)
    .order("actualizado_en", { ascending: false })
    .limit(1);
  if (error) throw error;
  return data?.[0] || null;
};

export const listarMensajesMoki = async (conversacionId) => {
  const { data, error } = await supabase
    .from("moki_mensajes")
    .select("id, remitente_id, remitente_rol, contenido, creado_en, archivo_path, archivo_nombre, archivo_mime, archivo_tamano")
    .eq("conversacion_id", conversacionId)
    .order("creado_en", { ascending: true });
  if (error) throw error;
  return data || [];
};

export const iniciarConversacionMoki = async (mensaje) => unwrap(await supabase.rpc("moki_iniciar_conversacion", {
  p_mensaje: mensaje
}));

export const enviarMensajeMoki = async (conversacionId, mensaje) => unwrap(await supabase.rpc("moki_enviar_mensaje", {
  p_conversacion_id: conversacionId,
  p_mensaje: mensaje
}));

export const enviarArchivoMoki = async (conversacionId, file, mensaje = "") => {
  const fileType = getSupportedDocumentMimeType(file);
  if (!fileType) {
    throw createFileUploadError("Adjunta una imagen JPG, PNG, WebP o un documento PDF.");
  }
  if (file.size > 5 * 1024 * 1024) {
    throw createFileUploadError("El archivo no puede superar 5 MB.");
  }

  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  if (!user?.id) throw new Error("Inicia sesión para adjuntar un archivo.");

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "adjunto";
  const objectPath = `${conversacionId}/${user.id}/${createUniqueId()}-${safeName}`;
  const { error: uploadError } = await supabase.storage
    .from("moki-attachments")
    .upload(objectPath, file, { contentType: fileType, upsert: false });
  if (uploadError) {
    throw createFileUploadError(getStorageUploadErrorMessage(uploadError, "JPG, PNG, WebP o PDF"));
  }

  const { error: messageError } = await supabase.rpc("moki_enviar_mensaje", {
    p_conversacion_id: conversacionId,
    p_mensaje: mensaje.trim() || null,
    p_archivo_path: objectPath,
    p_archivo_nombre: safeName,
    p_archivo_mime: fileType,
    p_archivo_tamano: file.size
  });
  if (messageError) {
    const { error: cleanupError } = await supabase.storage.from("moki-attachments").remove([objectPath]);
    if (cleanupError) console.error("No se pudo limpiar un archivo Moki que no se adjuntó:", cleanupError);
    throw messageError;
  }
};

export const obtenerUrlAdjuntoMoki = async (archivoPath) => {
  const { data, error } = await supabase.storage
    .from("moki-attachments")
    .createSignedUrl(archivoPath, 60);
  if (error) throw error;
  return data.signedUrl;
};

export const listarBandejaMoki = async () => unwrap(await supabase.rpc("moki_listar_bandeja"));
export const listarConversacionesArchivadasMoki = async () => unwrap(
  await supabase.rpc("moki_listar_conversaciones_archivadas")
);

export const archivarConversacionMoki = async (conversacionId) => unwrap(
  await supabase.rpc("moki_archivar_conversacion", { p_conversacion_id: conversacionId })
);

export const restaurarConversacionMoki = async (conversacionId) => unwrap(
  await supabase.rpc("moki_restaurar_conversacion", { p_conversacion_id: conversacionId })
);

export const cambiarEstadoConversacionMoki = async (conversacionId, estado) => unwrap(
  await supabase.rpc("moki_cambiar_estado_conversacion", {
    p_conversacion_id: conversacionId,
    p_estado: estado
  })
);
