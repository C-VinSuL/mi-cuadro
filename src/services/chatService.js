import { getStorageUploadErrorMessage, getSupportedDocumentMimeType } from "../utils/fileUpload";
import { createUniqueId } from "../utils/uniqueId";
import { logOperationalError } from "../utils/logOperationalError";
import { supabase } from "./supabase";

const CHAT_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const CHAT_MAX_FILE_SIZE = 2 * 1024 * 1024;
const CHAT_SIGNED_URL_SECONDS = 300;

const unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};

const createFileUploadError = (message) => {
  const error = new Error(message);
  error.name = "FileUploadError";
  return error;
};

export const listarCanalesChat = async () => (
  unwrap(await supabase.rpc("chat_listar_canales")) || []
);

export const listarMensajesChat = async (canalId, antes = null, limite = 30, antesId = null) => (
  unwrap(await supabase.rpc("chat_listar_mensajes", {
    p_canal_id: canalId,
    p_antes: antes,
    p_limite: limite,
    p_antes_id: antesId
  })) || []
);

export const listarMiembrosChat = async (canalId) => (
  unwrap(await supabase.rpc("chat_listar_miembros", { p_canal_id: canalId })) || []
);

export const listarEscribiendoChat = async (canalId) => (
  unwrap(await supabase.rpc("chat_listar_escribiendo", { p_canal_id: canalId })) || []
);

export const establecerEscribiendoChat = async (canalId, escribiendo) => (
  unwrap(await supabase.rpc("chat_establecer_escribiendo", {
    p_canal_id: canalId,
    p_escribiendo: escribiendo
  }))
);

export const enviarMensajeChat = async ({ canalId, contenido, respondeA = null, archivo = null }) => {
  let adjuntoPath = null;

  if (archivo) {
    const mimeType = getSupportedDocumentMimeType(archivo, CHAT_IMAGE_TYPES);
    if (!mimeType) {
      throw createFileUploadError("Adjunta una imagen JPG, PNG o WebP.");
    }
    if (archivo.size > CHAT_MAX_FILE_SIZE) {
      throw createFileUploadError("La imagen no puede superar 2 MB.");
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!user?.id) throw new Error("Inicia sesión para adjuntar una imagen.");

    const safeName = archivo.name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120) || "imagen";
    adjuntoPath = `${canalId}/${user.id}/${createUniqueId()}-${safeName}`;
    const { error: uploadError } = await supabase.storage
      .from("chat-adjuntos")
      .upload(adjuntoPath, archivo, { contentType: mimeType, upsert: false });

    if (uploadError) {
      throw createFileUploadError(getStorageUploadErrorMessage(
        uploadError,
        "JPG, PNG o WebP",
        2
      ));
    }
  }

  const { data, error } = await supabase.rpc("chat_enviar_mensaje", {
    p_canal_id: canalId,
    p_contenido: contenido,
    p_responde_a: respondeA,
    p_adjunto_path: adjuntoPath
  });

  if (error) {
    if (adjuntoPath) {
      const { error: cleanupError } = await supabase.storage
        .from("chat-adjuntos")
        .remove([adjuntoPath]);
      if (cleanupError) {
        logOperationalError("No se pudo limpiar una imagen de chat que no se adjuntó:", cleanupError);
      }
    }
    throw error;
  }

  return { id: data, adjuntoPath };
};

export const marcarCanalChatLeido = async (canalId) => (
  unwrap(await supabase.rpc("chat_marcar_leido", { p_canal_id: canalId }))
);

export const eliminarMensajeChat = async (mensajeId) => (
  unwrap(await supabase.rpc("chat_eliminar_mensaje", { p_mensaje_id: mensajeId }))
);

export const silenciarUsuarioChat = async ({ canalId, usuarioId, minutos, motivo }) => (
  unwrap(await supabase.rpc("chat_silenciar_usuario", {
    p_canal_id: canalId,
    p_usuario_id: usuarioId,
    p_minutos: minutos,
    p_motivo: motivo
  }))
);

export const obtenerUrlAdjuntoChat = async (adjuntoPath) => {
  const { data, error } = await supabase.storage
    .from("chat-adjuntos")
    .createSignedUrl(adjuntoPath, CHAT_SIGNED_URL_SECONDS);
  if (error) throw error;
  return data.signedUrl;
};
