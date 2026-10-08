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

const Navbar = ({ onMenuClick }) => {

  const navigate = useNavigate();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [welcomeDismissedFor, setWelcomeDismissedFor] = useState(null);
  const [completingWelcome, setCompletingWelcome] = useState(false);
  const [identityDocumentPath, setIdentityDocumentPath] = useState("");
  const [identityDocumentVerified, setIdentityDocumentVerified] = useState(false);
  const [profileForm, setProfileForm] = useState({
    nombre: "",
    apellido: "",
    telefono: "",
    cedula: "",
    direccion: "",
    fechaNacimiento: "",
    biografia: "",
    instagram: "",
    facebook: "",
    linkedin: "",
    avatarUrl: ""
  });
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingIdentityDocument, setUploadingIdentityDocument] = useState(false);
  const notificationsRef = useRef(null);
  const userMenuRef = useRef(null);
  const {
    notifications,
    unreadCount,
    markAllRead,
    markRead,
    deleteNotification,
    clearNotifications,
    notify
  } = useNotifications();

  const {
    user,
    profile,
    grupo,
    participant
  } = useAuth();
  const { cargarPerfil } = useAuth();
  const welcomeOpen = profile?.rol?.toLowerCase() === "socio"
    && profile?.bienvenida_completada === false
    && welcomeDismissedFor !== profile.id;

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
    if (completingWelcome && (
      !profileForm.telefono.trim()
      || !profileForm.cedula.trim()
      || !profileForm.direccion.trim()
      || !identityDocumentPath
    )) {
      notify({
        title: "Completa la verificación del perfil",
        message: "Ingresa tu teléfono, cédula y dirección, y carga una imagen o PDF de tu documento.",
        type: "error"
      });
      return;
    }

    setSavingProfile(true);
    try {
      const { error } = await supabase.rpc("guardar_perfil_completo", {
        p_nombre: profileForm.nombre.trim(),
        p_apellido: profileForm.apellido.trim(),
        p_telefono: profileForm.telefono.trim() || null,
        p_avatar_url: profileForm.avatarUrl || null,
        p_biografia: profileForm.biografia.trim() || null,
        p_cedula: profileForm.cedula.trim(),
        p_direccion: profileForm.direccion.trim() || null,
        p_fecha_nacimiento: profileForm.fechaNacimiento || null,
        p_redes_sociales: {
          instagram: profileForm.instagram.trim() || null,
          facebook: profileForm.facebook.trim() || null,
          linkedin: profileForm.linkedin.trim() || null
        }
      });

      if (error) throw error;
      if (completingWelcome) {
        const { error: welcomeError } = await supabase.rpc("completar_bienvenida_flashmonkey");
        if (welcomeError) throw welcomeError;
      }

      await cargarPerfil(profile.id);
      setProfileEditorOpen(false);
      setCompletingWelcome(false);
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

  const abrirEditorPerfil = async () => {
    const initialForm = {
      nombre: profile?.nombre || "",
      apellido: profile?.apellido || "",
      telefono: profile?.telefono || "",
      cedula: "",
      direccion: "",
      fechaNacimiento: "",
      biografia: profile?.biografia || "",
      instagram: "",
      facebook: "",
      linkedin: "",
      avatarUrl: profile?.avatar_url || ""
    };
    try {
      const [{ data, error }, { data: documentData, error: documentError }] = await Promise.all([
        supabase.rpc("obtener_datos_personales"),
        supabase.rpc("estado_documento_propio")
      ]);
      if (error) throw error;
      if (documentError) throw documentError;
      const privateData = data?.[0];
      const socials = privateData?.redes_sociales || {};
      const documentStatus = documentData?.[0];
      setIdentityDocumentPath(documentStatus?.documento_identidad_path || "");
      setIdentityDocumentVerified(Boolean(documentStatus?.documento_verificado));
      setProfileForm({
        ...initialForm,
        cedula: privateData?.cedula || "",
        direccion: privateData?.direccion || "",
        fechaNacimiento: privateData?.fecha_nacimiento || "",
        instagram: socials.instagram || "",
        facebook: socials.facebook || "",
        linkedin: socials.linkedin || ""
      });
    } catch (loadError) {
      console.error("Error cargando datos personales privados:", loadError);
      setProfileForm(initialForm);
      notify({ title: "No se pudieron cargar los datos privados", message: loadError.message || "Verifica la conexión e inténtalo nuevamente.", type: "error" });
    }
    setProfileEditorOpen(true);
    setUserMenuOpen(false);
  };

  const cargarDocumentoIdentidad = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;
    const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
    if (!allowedTypes.includes(file.type) || file.size > 5 * 1024 * 1024) {
      notify({
        title: "Documento no válido",
        message: "Carga una imagen JPG, PNG o un PDF de hasta 5 MB.",
        type: "error"
      });
      event.target.value = "";
      return;
    }
    setUploadingIdentityDocument(true);
    try {
      const extension = file.type === "application/pdf" ? "pdf" : file.type.split("/")[1];
      const objectPath = `${user.id}/${crypto.randomUUID()}.${extension}`;
      const { error: uploadError } = await supabase.storage.from("identity-documents").upload(objectPath, file, {
        contentType: file.type,
        upsert: false
      });
      if (uploadError) throw uploadError;
      const { error: pathError } = await supabase.rpc("guardar_documento_identidad", {
        p_object_path: objectPath
      });
      if (pathError) throw pathError;
      setIdentityDocumentPath(objectPath);
      setIdentityDocumentVerified(false);
      notify({
        title: "Documento cargado",
        message: "El documento quedó guardado de forma privada para su revisión.",
        type: "success"
      });
    } catch (uploadError) {
      console.error("Error cargando documento de identidad:", uploadError);
      notify({
        title: "No se pudo cargar el documento",
        message: uploadError.message || "Verifica tu conexión e inténtalo nuevamente.",
        type: "error"
      });
    } finally {
      setUploadingIdentityDocument(false);
      event.target.value = "";
    }
  };

  const iniciarActualizacionBienvenida = () => {
    setCompletingWelcome(true);
    setWelcomeDismissedFor(profile.id);
    abrirEditorPerfil();
  };

  const cargarAvatar = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !profile?.id) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 2 * 1024 * 1024) {
      notify({ title: "Imagen no válida", message: "Usa JPG, PNG o WebP de hasta 2 MB.", type: "error" });
      event.target.value = "";
      return;
    }
    setUploadingAvatar(true);
    try {
      const extension = file.type === "image/jpeg" ? "jpg" : file.type.split("/")[1];
      const objectPath = `${profile.id}/${crypto.randomUUID()}.${extension}`;
      const { error } = await supabase.storage.from("profile-avatars").upload(objectPath, file, {
        contentType: file.type,
        upsert: false
      });
      if (error) throw error;
      const { data } = supabase.storage.from("profile-avatars").getPublicUrl(objectPath);
      setProfileForm((current) => ({ ...current, avatarUrl: data.publicUrl }));
    } catch (uploadError) {
      console.error("Error cargando avatar:", uploadError);
      notify({ title: "No se pudo cargar la imagen", message: uploadError.message || "Verifica tu conexión e inténtalo nuevamente.", type: "error" });
    } finally {
      setUploadingAvatar(false);
      event.target.value = "";
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
                              markRead(item.id);
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
                      <button
                        type="button"
                        onClick={() => deleteNotification(item.id)}
                        title="Eliminar notificación"
                        aria-label={`Eliminar notificación: ${item.title}`}
                        className="shrink-0 rounded-md p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 size={15} />
                      </button>
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
          className={`
            flex
            size-10
            overflow-hidden
            rounded-full
            bg-emerald-100
            text-emerald-700
            items-center
            justify-center
            font-bold
          `}
          >
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt="" className="size-full object-cover" />
            : inicial}
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

              {participant && grupo?.estado !== "borrador" && participant.posicion && (
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
              onClick={abrirEditorPerfil}
              className="w-full px-4 py-3 text-left text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Editar perfil
              <span className="mt-0.5 block text-xs font-normal text-slate-500">Datos, avatar y redes sociales</span>
            </button>
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

      {welcomeOpen && createPortal(
        <div className="fixed inset-0 z-[1100] flex items-center justify-center bg-slate-950/60 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="welcome-title" className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl sm:p-8">
            <img src="/flashmonkey.svg" alt="" className="mx-auto h-24 w-24 rounded-2xl" />
            <p className="mt-5 text-center text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">Bienvenido a FlashMonkey</p>
            <h2 id="welcome-title" className="mt-2 text-center text-2xl font-bold text-slate-900">¡Qué bueno tenerte aquí!</h2>
            <p className="mt-3 text-center text-sm leading-6 text-slate-600">
              El primer paso es completar y verificar tus datos. Desde <strong>Editar perfil</strong> confirma tu teléfono, cédula y dirección, y carga una imagen o PDF de tu documento de identidad para que administración o tesorería lo revise.
            </p>
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950">
              <p className="font-semibold">Garantía para participar en grupos</p>
              <p className="mt-1">Después de completar tu perfil, deposita al menos $10 en Mi billetera para solicitar ingreso a un grupo. El saldo aprobado podrá cubrir automáticamente los aportes que sigan pendientes al vencimiento.</p>
            </div>
            <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-center">
              <button type="button" onClick={() => setWelcomeDismissedFor(profile.id)} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">Más tarde</button>
              <button type="button" onClick={iniciarActualizacionBienvenida} className="rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900">Completar mi perfil</button>
            </div>
          </section>
        </div>,
        document.body
      )}

      {profileEditorOpen && createPortal(
        <div className="fixed inset-0 z-[1000] flex items-start justify-center overflow-y-auto overscroll-contain bg-slate-950/40 p-4 sm:items-center" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setProfileEditorOpen(false);
        }}>
          <section role="dialog" aria-modal="true" aria-labelledby="profile-dialog-title" className="my-auto max-h-[calc(100vh-2rem)] max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto overscroll-contain rounded-xl bg-white p-5 shadow-2xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase text-emerald-700">Cuenta</p>
                <h2 id="profile-dialog-title" className="mt-1 text-xl font-bold text-slate-900">Editar perfil</h2>
              </div>
              <button type="button" onClick={() => setProfileEditorOpen(false)} aria-label="Cerrar edición de perfil" className="rounded-md p-2 text-slate-500 hover:bg-slate-100"><X size={18} /></button>
            </div>
            <form onSubmit={guardarPerfil} className="mt-5 space-y-4">
              <div className="flex items-center gap-4">
                <span className="flex size-16 items-center justify-center overflow-hidden rounded-full bg-emerald-100 text-xl font-bold text-emerald-800">
                  {profileForm.avatarUrl ? <img src={profileForm.avatarUrl} alt="Vista previa del avatar" className="size-full object-cover" /> : inicial}
                </span>
                <label className="text-sm font-semibold text-emerald-800">
                  {uploadingAvatar ? "Cargando imagen..." : "Subir foto o avatar"}
                  <input type="file" accept="image/png,image/jpeg,image/webp" onChange={cargarAvatar} disabled={uploadingAvatar || savingProfile} className="mt-1 block max-w-full text-xs font-normal text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-emerald-50 file:px-3 file:py-2 file:font-semibold file:text-emerald-800" />
                  <span className="mt-1 block text-xs font-normal text-slate-500">JPG, PNG o WebP; máximo 2 MB.</span>
                </label>
              </div>
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
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-sm font-medium text-slate-700">
                  Cédula o documento <span className="text-red-700">*</span>
                  <input name="cedula" value={profileForm.cedula} onChange={(event) => setProfileForm((current) => ({ ...current, cedula: event.target.value }))} required minLength={6} maxLength={20} autoComplete="off" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20" />
                </label>
                <label className="block text-sm font-medium text-slate-700">
                  Fecha de nacimiento
                  <input name="fechaNacimiento" type="date" value={profileForm.fechaNacimiento} onChange={(event) => setProfileForm((current) => ({ ...current, fechaNacimiento: event.target.value }))} max={new Date().toISOString().slice(0, 10)} className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20" />
                </label>
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Dirección
                <input name="direccion" value={profileForm.direccion} onChange={(event) => setProfileForm((current) => ({ ...current, direccion: event.target.value }))} maxLength={250} autoComplete="street-address" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20" />
              </label>
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-800">Documento de identidad</p>
                <p className="mt-1 text-xs text-slate-500">Carga una imagen JPG/PNG o un PDF, máximo 5 MB. Solo tú y el personal que verifica documentos podrán acceder al archivo.</p>
                <label className="mt-3 inline-flex cursor-pointer items-center rounded-lg border border-emerald-700 px-3 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">
                  {uploadingIdentityDocument ? "Cargando documento..." : identityDocumentPath ? "Reemplazar documento" : "Cargar documento"}
                  <input type="file" accept="image/jpeg,image/png,application/pdf" onChange={cargarDocumentoIdentidad} disabled={uploadingIdentityDocument || savingProfile} className="sr-only" />
                </label>
                <p className={`mt-2 text-xs ${identityDocumentVerified ? "font-semibold text-emerald-700" : identityDocumentPath ? "text-blue-700" : "text-amber-700"}`}>
                  {identityDocumentVerified ? "Documento verificado" : identityDocumentPath ? "Documento cargado; pendiente de revisión" : "Aún no has cargado tu documento"}
                </p>
              </div>
              <label className="block text-sm font-medium text-slate-700">
                Sobre mí
                <textarea name="biografia" value={profileForm.biografia} onChange={(event) => setProfileForm((current) => ({ ...current, biografia: event.target.value }))} maxLength={500} rows={3} className="mt-1.5 w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20" />
              </label>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  ["instagram", "Instagram"],
                  ["facebook", "Facebook"],
                  ["linkedin", "LinkedIn"]
                ].map(([name, label]) => (
                  <label key={name} className="block text-sm font-medium text-slate-700">
                    {label}
                    <input type="url" name={name} value={profileForm[name]} onChange={(event) => setProfileForm((current) => ({ ...current, [name]: event.target.value }))} placeholder="https://" className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2.5 outline-none focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20" />
                  </label>
                ))}
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => {
                  setProfileEditorOpen(false);
                  if (completingWelcome) setWelcomeDismissedFor(null);
                  setCompletingWelcome(false);
                }} disabled={savingProfile || uploadingAvatar || uploadingIdentityDocument} className="rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50">Cancelar</button>
                <button type="submit" disabled={savingProfile || uploadingAvatar || uploadingIdentityDocument} className="rounded-lg bg-emerald-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-900 disabled:opacity-60">{savingProfile ? "Guardando..." : completingWelcome ? "Guardar y continuar" : "Guardar cambios"}</button>
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