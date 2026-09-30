import {
  Bell,
  LogOut,
  Menu,
  ChevronDown,
  X,
  CheckCheck,
  Trash2
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useNavigate } from "react-router-dom";

import { useAuth } from "../../../context/AuthContext";
import { supabase } from "../../../services/supabase";
import { useNotifications } from "../../../hooks/useNotifications";
import { usePermissions } from "../../../hooks/usePermissions";

const Navbar = ({ onMenuClick }) => {

  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [profileForm, setProfileForm] = useState({ nombre: "", apellido: "", telefono: "" });
  const [savingProfile, setSavingProfile] = useState(false);
  const notificationsRef = useRef(null);
  const userMenuRef = useRef(null);
  const {
    notifications,
    unreadCount,
    markAllRead,
    clearNotifications,
    notify
  } = useNotifications();

  const {
    profile,
    participant
  } = useAuth();
  const { cargarPerfil } = useAuth();
  const { can } = usePermissions();

  useEffect(() => {
    const handlePointerDown = (event) => {
      if (!notificationsRef.current?.contains(event.target)) {
        setNotificationsOpen(false);
      }
      if (!userMenuRef.current?.contains(event.target)) {
        setUserMenuOpen(false);
      }
    };

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        setNotificationsOpen(false);
        setUserMenuOpen(false);
        setProfileEditorOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const guardarPerfil = async (event) => {
    event.preventDefault();
    if (!profile?.id || savingProfile) return;

    setSavingProfile(true);
    try {
      const { data, error } = await supabase
        .from("perfiles")
        .update({
          nombre: profileForm.nombre.trim(),
          apellido: profileForm.apellido.trim(),
          telefono: profileForm.telefono.trim() || null
        })
        .eq("id", profile.id)
        .select("id")
        .maybeSingle();

      if (error) throw error;
      if (!data) throw new Error("No se actualizó ningún perfil.");

      await cargarPerfil(profile.id);
      setProfileEditorOpen(false);
      setUserMenuOpen(false);
      notify({
        title: "Perfil actualizado",
        message: "Tus datos personales se guardaron correctamente.",
        type: "success"
      });
    } catch (error) {
      console.error("Error actualizando perfil:", error);
      notify({
        title: "No se pudo guardar el perfil",
        message: "Verifica tu conexión y los permisos de actualización.",
        type: "error"
      });
    } finally {
      setSavingProfile(false);
    }
  };


  const handleLogout = async () => {

    const { error } =
      await supabase.auth.signOut();

    if (error) {

      console.error(
        "Error cerrando sesión:",
        error
      );
      notify({
        title: "No se pudo cerrar sesión",
        message: "Inténtalo nuevamente.",
        type: "error"
      });

      return;
    }

    clearNotifications();
    navigate("/login");
  };


  const inicial =
    profile?.nombre
      ?.charAt(0)
      ?.toUpperCase() || "U";


  return (
    <header
      className="
        sticky
        top-0
        z-30

        min-h-[82px]

        bg-white/95
        backdrop-blur

        border-b
        border-slate-200

        flex
        items-center
        justify-between

        px-4
        sm:px-6
        md:px-8
        xl:px-12
      "
    >

      {/* IZQUIERDA */}

      <div className="flex items-center gap-4">

        {/* BOTÓN MOBILE */}

        <button
          onClick={onMenuClick}
          className="
            lg:hidden

            w-11
            h-11

            flex
            items-center
            justify-center

            rounded-xl

            bg-emerald-50
            text-emerald-800

            hover:bg-emerald-100
            transition
          "
          aria-label="Abrir menú"
        >
          <Menu size={23} />
        </button>


        {/* SALUDO */}

        <div>

          <p
            className="
              hidden
              sm:block

              text-[11px]
              uppercase
              tracking-[0.15em]
              text-emerald-700
              font-semibold
            "
          >
            Panel principal
          </p>

          <h1
            className="
              text-lg
              sm:text-xl
              md:text-2xl
              font-bold
              text-slate-900
            "
          >
            Hola, {profile?.nombre || "Usuario"} 👋
          </h1>

          <p
            className="
              hidden
              sm:block
              text-sm
              text-slate-500
              mt-1
            "
          >
            Bienvenido a tu caja comunal.
          </p>

        </div>

      </div>


      {/* DERECHA */}

      <div className="flex items-center gap-2 sm:gap-3">

        {/* NOTIFICACIONES */}

        <div className="relative" ref={notificationsRef}>
          <button
            type="button"
            aria-label={`Notificaciones${unreadCount ? `, ${unreadCount} sin leer` : ""}`}
            aria-expanded={notificationsOpen}
            onClick={() => {
              setNotificationsOpen((open) => !open);
              setUserMenuOpen(false);
            }}
            className="relative flex size-11 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100"
          >
            <Bell size={20} />
            {unreadCount > 0 && (
              <span className="absolute right-1 top-1 flex min-h-4 min-w-4 items-center justify-center rounded-full border-2 border-white bg-red-600 px-1 text-[9px] font-bold text-white">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 top-14 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                <div>
                  <h2 className="text-sm font-semibold text-slate-900">Notificaciones</h2>
                  <p className="text-xs text-slate-500">{unreadCount} sin leer · {notifications.length} recientes</p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={markAllRead} disabled={unreadCount === 0} title={unreadCount ? "Marcar todas como leídas" : "Todas están leídas"} aria-label={unreadCount ? "Marcar todas como leídas" : "Todas están leídas"} className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-emerald-700 disabled:cursor-default disabled:opacity-40">
                    <CheckCheck size={17} />
                  </button>
                  <button type="button" onClick={clearNotifications} title="Limpiar notificaciones" aria-label="Limpiar notificaciones" className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-red-700">
                    <Trash2 size={17} />
                  </button>
                  <button type="button" onClick={() => setNotificationsOpen(false)} title="Cerrar" aria-label="Cerrar notificaciones" className="rounded-md p-2 text-slate-500 hover:bg-slate-100">
                    <X size={17} />
                  </button>
                </div>
              </div>
              <div className="max-h-[min(65vh,28rem)] overflow-y-auto">
                {notifications.length === 0 ? (
                  <p className="px-4 py-10 text-center text-sm text-slate-500">No tienes notificaciones todavía.</p>
                ) : notifications.map((item) => (
                  <article key={item.id} className={`border-b border-slate-100 px-4 py-3 last:border-b-0 ${item.read ? "bg-white" : "bg-emerald-50/60"}`}>
                    <div className="flex items-start gap-2">
                      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${item.type === "error" ? "bg-red-500" : item.type === "success" ? "bg-emerald-600" : "bg-blue-500"}`} />
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                        <p className="mt-0.5 text-sm text-slate-600">{item.message}</p>
                        {item.actionPath && (
                          <button
                            type="button"
                            onClick={() => {
                              navigate(item.actionPath);
                              setNotificationsOpen(false);
                            }}
                            className="mt-2 text-xs font-semibold text-emerald-800 hover:text-emerald-950"
                          >
                            {item.actionLabel || "Abrir"}
                          </button>
                        )}
                        <time className="mt-1 block text-[11px] text-slate-400" dateTime={item.createdAt}>
                          {new Date(item.createdAt).toLocaleString("es", { dateStyle: "short", timeStyle: "short" })}
                        </time>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          )}
        </div>


        {/* USUARIO */}

        <div className="relative" ref={userMenuRef}>
        <button
          type="button"
          aria-label="Abrir menú de perfil"
          aria-expanded={userMenuOpen}
          onClick={() => {
            setUserMenuOpen((open) => !open);
            setNotificationsOpen(false);
          }}
          className="flex max-w-[15rem] items-center gap-2 rounded-xl px-2 py-2 text-left transition hover:bg-slate-50 sm:gap-3 sm:px-3"
        >

          <span
            className="
              flex
              w-10
              h-10

              rounded-full

              bg-emerald-100
              text-emerald-700

              flex
              items-center
              justify-center

              font-bold
            "
          >
            {inicial}
          </span>

          <span className="min-w-0 md:block">

            <span
              className="
                block
                text-sm
                font-semibold
                text-slate-900
              "
            >
              {profile?.nombre}{" "}
              {profile?.apellido}
            </span>

            <span
              className="
                flex
                gap-2

                text-xs
                text-slate-500
              "
            >

              <span className="capitalize">
                {profile?.rol || "Socio"}
              </span>

              {participant && (
                <>
                  <span>•</span>

                  <span>
                    Puesto #{participant.posicion}
                  </span>
                </>
              )}

            </span>

          </span>

          <ChevronDown
            size={15}
            className="
                hidden
                sm:block
              text-slate-400
            "
          />

        </button>

        {userMenuOpen && (
          <div className="absolute right-0 top-14 z-50 w-64 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl">
            <div className="border-b border-slate-100 px-4 py-3">
              <p className="truncate text-sm font-semibold text-slate-900">{profile?.nombre} {profile?.apellido}</p>
              <p className="mt-0.5 text-xs capitalize text-slate-500">{profile?.rol || "Socio"}</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setProfileForm({
                  nombre: profile?.nombre || "",
                  apellido: profile?.apellido || "",
                  telefono: profile?.telefono || ""
                });
                setProfileEditorOpen(true);
                setUserMenuOpen(false);
              }}
              className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Editar perfil
              <span className="mt-0.5 block text-xs font-normal text-slate-500">Nombre, apellido y teléfono</span>
            </button>
            {can("verVistaSocio") && (
              <button
                type="button"
                onClick={() => {
                  navigate("/vista-socio");
                  setUserMenuOpen(false);
                }}
                className="w-full border-t border-slate-100 px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Vista de socio
                <span className="mt-0.5 block text-xs font-normal text-slate-500">Consultar integrantes en modo lectura</span>
              </button>
            )}
          </div>
        )}
        </div>


        {/* SALIR */}

        <button
          onClick={handleLogout}
          className="
            flex
            items-center
            gap-2

            px-3
            sm:px-4

            py-2.5

            rounded-xl

            text-red-600

            hover:bg-red-50

            transition
          "
        >

          <LogOut size={18} />

          <span className="hidden xl:block text-sm font-medium">
            Cerrar sesión
          </span>

        </button>

      </div>

      {profileEditorOpen && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto overscroll-contain bg-slate-950/40 p-4 sm:items-center" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setProfileEditorOpen(false);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="profile-dialog-title" className="my-auto max-h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-xl bg-white p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-emerald-700">Cuenta</p>
                <h2 id="profile-dialog-title" className="mt-1 text-xl font-bold text-slate-900">Editar perfil</h2>
              </div>
              <button type="button" onClick={() => setProfileEditorOpen(false)} aria-label="Cerrar edición de perfil" className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <form onSubmit={guardarPerfil} className="mt-5 space-y-4">
              {[
                ["nombre", "Nombre", "given-name"],
                ["apellido", "Apellido", "family-name"],
                ["telefono", "Teléfono", "tel"]
              ].map(([name, label, autoComplete]) => (
                <label key={name} className="block text-sm font-medium text-slate-700">
                  {label}
                  <input
                    name={name}
                    autoComplete={autoComplete}
                    value={profileForm[name]}
                    onChange={(event) => setProfileForm((current) => ({ ...current, [name]: event.target.value }))}
                    required={name === "nombre"}
                    className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20"
                  />
                </label>
              ))}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setProfileEditorOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Cancelar</button>
                <button type="submit" disabled={savingProfile} className="rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60">{savingProfile ? "Guardando..." : "Guardar cambios"}</button>
              </div>
            </form>
          </section>
        </div>,
        document.body
      )}

    </header>
  );
};

export default Navbar;