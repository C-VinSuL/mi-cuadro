import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Send, Users } from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { supabase } from "../../services/supabase";
import {
  enviarMensajeEquipo,
  listarCanalEquipo,
  listarMensajesEquipo,
  marcarEquipoLeido
} from "../../services/teamChatService";
import { createUniqueId } from "../../utils/uniqueId";
import { logOperationalError } from "../../utils/logOperationalError";

const formatMessageTime = (value) => new Intl.DateTimeFormat("es", {
  hour: "2-digit",
  minute: "2-digit"
}).format(new Date(value));

const InternalTeamChat = ({ onBack }) => {
  const { user } = useAuth();
  const [channelId, setChannelId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const messagesEndRef = useRef(null);

  const refreshMessages = useCallback(async (id) => {
    const nextMessages = await listarMensajesEquipo(id);
    await marcarEquipoLeido(id);
    setMessages(nextMessages);
    setErrorMessage("");
  }, []);

  useEffect(() => {
    if (!user?.id) return undefined;

    let active = true;
    const load = async () => {
      try {
        const channel = await listarCanalEquipo();
        if (!channel) throw new Error("No se encontró el canal de comunicación interna.");
        const nextMessages = await listarMensajesEquipo(channel.canal_id);
        await marcarEquipoLeido(channel.canal_id);
        if (!active) return;
        setChannelId(channel.canal_id);
        setMessages(nextMessages);
        setErrorMessage("");
      } catch (error) {
        logOperationalError("No se pudo cargar la comunicación del equipo:", error);
        if (active) setErrorMessage("No se pudo cargar la comunicación interna. Inténtalo nuevamente.");
      } finally {
        if (active) setLoading(false);
      }
    };

    void load();
    return () => {
      active = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!channelId) return undefined;

    let active = true;
    const refresh = () => {
      void refreshMessages(channelId).catch((error) => {
        logOperationalError("No se pudieron actualizar los mensajes del equipo:", error);
        if (active) setErrorMessage("No se pudieron actualizar los mensajes. Revisa tu conexión.");
      });
    };
    const channel = supabase
      .channel(`equipo-chat-${channelId}-${createUniqueId()}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "chat_mensajes",
        filter: `canal_id=eq.${channelId}`
      }, refresh)
      .subscribe((status, subscriptionError) => {
        if (active && ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
          if (subscriptionError) {
            logOperationalError("Se perdió la actualización en tiempo real del equipo:", subscriptionError);
          }
          setErrorMessage("La actualización en tiempo real no está disponible; los mensajes se actualizarán periódicamente.");
        }
      });
    const intervalId = window.setInterval(refresh, 20000);

    return () => {
      active = false;
      window.clearInterval(intervalId);
      supabase.removeChannel(channel);
    };
  }, [channelId, refreshMessages]);

  useEffect(() => {
    const frameId = window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
    });
    return () => window.cancelAnimationFrame(frameId);
  }, [messages.length]);

  const sendMessage = async (event) => {
    event.preventDefault();
    const content = draft.trim();
    if (!content || !channelId || sending) return;

    setSending(true);
    setErrorMessage("");
    try {
      await enviarMensajeEquipo(channelId, content);
      setDraft("");
      await refreshMessages(channelId);
    } catch (error) {
      logOperationalError("No se pudo enviar el mensaje al equipo:", error);
      setErrorMessage("No se pudo enviar el mensaje. Inténtalo nuevamente.");
    } finally {
      setSending(false);
    }
  };

  return (
    <section aria-label="Comunicación interna del equipo" className="flex min-h-0 flex-1 flex-col bg-[#F7F8F7]">
      <header className="flex items-center gap-3 border-b border-slate-200 bg-white px-4 py-3">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            aria-label="Volver al resumen de Moki"
            className="rounded-full p-2 text-slate-600 transition hover:bg-slate-100"
          >
            <ArrowLeft size={18} />
          </button>
        )}
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-800">
          <Users size={19} />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-slate-900">Comunicación del equipo</h3>
          <p className="mt-0.5 text-xs text-slate-500">Sala privada de administración, tesorería y auditoría</p>
        </div>
      </header>

      <div aria-live="polite" className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4">
        {errorMessage && (
          <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-relaxed text-amber-800">
            {errorMessage}
          </p>
        )}
        {loading ? (
          <p className="py-8 text-center text-sm text-slate-500">Cargando mensajes del equipo…</p>
        ) : messages.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center">
            <Users size={26} className="mx-auto text-emerald-700" />
            <p className="mt-3 text-sm font-medium text-slate-700">Inicia la conversación del equipo</p>
            <p className="mt-1 text-xs text-slate-500">Los mensajes solo son visibles para los roles autorizados.</p>
          </div>
        ) : messages.map((message) => {
          const ownMessage = message.autor_id === user?.id;
          return (
            <article key={message.id} className={`flex ${ownMessage ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[88%] rounded-2xl px-3.5 py-2.5 shadow-sm ${ownMessage ? "rounded-br-sm bg-emerald-100 text-slate-800" : "rounded-bl-sm bg-white text-slate-700"}`}>
                {!ownMessage && (
                  <p className="mb-1 text-[11px] font-semibold text-emerald-900">
                    {message.autor_nombre} · {message.autor_rol}
                  </p>
                )}
                <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.contenido}</p>
                <time dateTime={message.creado_en} className="mt-1 block text-right text-[10px] text-slate-400">
                  {formatMessageTime(message.creado_en)}
                </time>
              </div>
            </article>
          );
        })}
        <div ref={messagesEndRef} aria-hidden="true" />
      </div>

      <form onSubmit={sendMessage} className="flex items-end gap-2 border-t border-slate-200 bg-white px-3 py-3">
        <label htmlFor="team-chat-message" className="sr-only">Escribe un mensaje para el equipo</label>
        <textarea
          id="team-chat-message"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          maxLength={2000}
          rows={1}
          placeholder="Escribe al equipo…"
          className="max-h-28 min-h-11 min-w-0 flex-1 resize-y rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10"
          disabled={sending || !channelId}
        />
        <button
          type="submit"
          aria-label="Enviar mensaje al equipo"
          disabled={sending || !channelId || !draft.trim()}
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-flash-forest text-white transition hover:bg-flash-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send size={18} />
        </button>
      </form>
    </section>
  );
};

export default InternalTeamChat;
