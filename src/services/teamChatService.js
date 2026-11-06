import { supabase } from "./supabase";

const unwrap = ({ data, error }) => {
  if (error) throw error;
  return data;
};

export const listarCanalEquipo = async () => {
  const channels = unwrap(await supabase.rpc("chat_listar_canales"));
  return channels.find((channel) => channel.tipo === "equipo") || null;
};

export const listarMensajesEquipo = async (channelId) => {
  const messages = unwrap(await supabase.rpc("chat_listar_mensajes", {
    p_canal_id: channelId,
    p_antes: null,
    p_limite: 100,
    p_antes_id: null
  }));
  return messages.reverse();
};

export const enviarMensajeEquipo = async (channelId, content) => unwrap(
  await supabase.rpc("chat_enviar_mensaje", {
    p_canal_id: channelId,
    p_contenido: content
  })
);

export const marcarEquipoLeido = async (channelId) => unwrap(
  await supabase.rpc("chat_marcar_leido", { p_canal_id: channelId })
);
