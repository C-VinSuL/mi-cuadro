import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState
} from "react";

import { supabase } from "../services/supabase";
import { obtenerSaldoFondo} from "../services/fondoService";
import { PERMISSIONS } from "../config/permissions";
import {
  shouldResetIdentity,
  shouldSendWelcomeEmail,
  shouldClearSessionForInactiveProfile,
  shouldApplySessionHydration,
  getSessionIdentity,
  getSessionUser,
} from "./authSession";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {

  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);

  const [profile, setProfile] = useState(null);
  const [participant, setParticipant] = useState(null);
  const [participantes, setParticipantes] = useState([]);
  const [grupo, setGrupo] = useState(null);
  const [grupos, setGrupos] = useState([]);
  const [fondoComunitario, setFondoComunitario] = useState(0);
  

  const [loading, setLoading] = useState(true);
  const authRequest = useRef(0);
  const identity = useRef(null);

  const isCurrentRequest = (requestId, userId = identity.current) =>
    requestId === authRequest.current && userId === identity.current;

  const clearIdentityData = () => {
    setProfile(null);
    setParticipant(null);
    setParticipantes([]);
    setGrupo(null);
    setGrupos([]);
    setFondoComunitario(0);
  };

  // =========================
  // CARGAR PERFIL
  // =========================

  const cargarPerfil = async (userId, requestId = authRequest.current) => {

    if (!userId) {
      if (isCurrentRequest(requestId, null)) setProfile(null);
      return null;
    }

    const { data, error } = await supabase
      .from("perfiles")
      .select(`
        id,
        nombre,
        apellido,
        telefono,
        rol,
        avatar_url,
        biografia,
        bienvenida_completada,
        activo
      `)
      .eq("id", userId)
      .single();

    if (!isCurrentRequest(requestId, userId)) return null;

    if (error) {
      console.error("Error cargando perfil:", error);
      setProfile(null);
      return null;
    }

    setProfile(data);
    return data;
  };


  // =========================
  // CARGAR GRUPO
  // =========================

  const cargarGrupo = async (
    grupoId,
    puedeVerFondo = PERMISSIONS[profile?.rol?.toLowerCase()]?.verFondoComunitario === true,
    requestId = authRequest.current
  ) => {
    const requestIdentity = identity.current;

    if (!grupoId) {
      if (isCurrentRequest(requestId, requestIdentity)) setGrupo(null);
      return;
    }

    const { data, error } = await supabase
      .from("grupos")
      .select("*")
      .eq("id", grupoId)
      .single();

    if (!isCurrentRequest(requestId, requestIdentity)) return;

    if (error) {
      console.error("Error cargando grupo:", error);
      setGrupo(null);
      setFondoComunitario(0);
      return;
    }

    setGrupos((current) => [
      ...current.filter((item) => item.id !== data.id),
      data
    ]);
    setGrupo(data);
    if (puedeVerFondo) {
      await cargarFondoComunitario(data.id, puedeVerFondo, requestId);
    } else {
      setFondoComunitario(0);
    }
  };


  // =========================
  // CARGAR PARTICIPANTE
  // =========================

  const cargarParticipante = async (
    userId,
    rol = profile?.rol,
    requestId = authRequest.current
  ) => {

    if (!userId) {
      if (isCurrentRequest(requestId, null)) clearIdentityData();
      return;
    }

    let membresias = [];
    if (!["administrador", "auditor"].includes(rol?.toLowerCase())) {
      const { data, error } = await supabase
        .from("participantes")
        .select(`
          id,
          nombre,
          posicion,
          estado,
          grupo_id,
          perfil_id
        `)
        .eq("perfil_id", userId)
        .order("grupo_id", { ascending: true });

      if (!isCurrentRequest(requestId, userId)) return;

      if (error) {
        console.error(
          "Error cargando participante:",
          error
        );

        setParticipant(null);
        setParticipantes([]);
        setGrupo(null);
        setGrupos([]);
        setFondoComunitario(0);

        return;
      }

      membresias = data || [];
    }

    const groupIds = [...new Set(membresias.map((item) => item.grupo_id))];
    const esGestor = ["administrador", "tesorero", "auditor"].includes(rol?.toLowerCase());

    let groupsQuery = supabase.from("grupos").select("*").order("nombre", { ascending: true });
    if (!esGestor) {
      if (groupIds.length === 0) {
        setParticipantes([]);
        setParticipant(null);
        setGrupos([]);
        setGrupo(null);
        setFondoComunitario(0);
        return;
      }
      groupsQuery = groupsQuery.in("id", groupIds);
    }

    const { data: groupsData, error: groupsError } = await groupsQuery;
    if (!isCurrentRequest(requestId, userId)) return;

    if (groupsError) {
      console.error("Error cargando grupos:", groupsError);
    }

    let availableGroups = groupsData || [];
    if ((groupsError || !groupsData?.length) && groupIds.length > 0) {
      const { data: membershipGroups } = await supabase
        .from("grupos")
        .select("*")
        .in("id", groupIds)
        .order("nombre", { ascending: true });
      if (!isCurrentRequest(requestId, userId)) return;
      availableGroups = membershipGroups || [];
    }
    if (!isCurrentRequest(requestId, userId)) return;

    const savedGroupId = window.localStorage.getItem(`mi-cuadro-grupo-${userId}`);
    const selectedGroup = availableGroups.find((item) => item.id === savedGroupId)
      || availableGroups[0]
      || null;

    setParticipantes(membresias);
    setGrupos(availableGroups);
    setGrupo(selectedGroup);
    setParticipant(membresias.find((item) => item.grupo_id === selectedGroup?.id) || null);

    const puedeVerFondo = PERMISSIONS[rol?.toLowerCase()]?.verFondoComunitario === true;
    if (selectedGroup && puedeVerFondo) {
      await cargarFondoComunitario(selectedGroup.id, puedeVerFondo, requestId);
    } else {
      setFondoComunitario(0);
    }
  };

  const seleccionarGrupo = async (grupoId) => {
    const selectedGroup = grupos.find((item) => item.id === grupoId);
    if (!selectedGroup) return;

    const selectedParticipant = participantes.find((item) => item.grupo_id === grupoId) || null;
    setGrupo(selectedGroup);
    setParticipant(selectedParticipant);
    window.localStorage.setItem(`mi-cuadro-grupo-${user?.id}`, grupoId);

    const puedeVerFondo = PERMISSIONS[profile?.rol?.toLowerCase()]?.verFondoComunitario === true;
    if (puedeVerFondo) {
      await cargarFondoComunitario(grupoId, puedeVerFondo);
    } else {
      setFondoComunitario(0);
    }
  };


  // =========================
  // CARGAR USUARIO
  // =========================

  const cargarDatosUsuario = async (session, requestId) => {
    const currentUser = session?.user ?? null;
    if (!isCurrentRequest(requestId, currentUser?.id ?? null)) return;

    setSession(session);

    setUser(currentUser);

    if (!currentUser) {
      clearIdentityData();
      return;
    }

    const currentProfile = await cargarPerfil(
      currentUser.id,
      requestId
    );
    if (!isCurrentRequest(requestId, currentUser.id)) return;

    if (shouldClearSessionForInactiveProfile(currentProfile)) {
      console.warn("La sesión pertenece a una cuenta desactivada; se cerrará.");
      const { error: signOutError } = await supabase.auth.signOut({ scope: "local" });
      if (!isCurrentRequest(requestId, currentUser.id)) return;
      if (signOutError) {
        console.error("No se pudo cerrar la sesión de la cuenta desactivada:", signOutError);
      }
      identity.current = null;
      setSession(null);
      setUser(null);
      clearIdentityData();
      return;
    }

    await cargarParticipante(
      currentUser.id,
      currentProfile?.rol,
      requestId
    );
  };

  // =========================
  // CARGAR FONDO COMUNITARIO
  // =========================


const cargarFondoComunitario =
  async (
    grupoId,
    puedeVerFondo = PERMISSIONS[profile?.rol?.toLowerCase()]?.verFondoComunitario === true,
    requestId = authRequest.current
  ) => {
    const requestIdentity = identity.current;

    if (!isCurrentRequest(requestId, requestIdentity)) return 0;

    if (!grupoId || !puedeVerFondo) {

      setFondoComunitario(0);

      return 0;

    }


    try {

      const saldo =
        await obtenerSaldoFondo(
          grupoId
        );

      if (!isCurrentRequest(requestId, requestIdentity)) return 0;

      setFondoComunitario(
        saldo
      );


      return saldo;

    } catch (error) {

      if (!isCurrentRequest(requestId, requestIdentity)) return 0;

      console.error(
        "Error cargando fondo comunitario:",
        error
      );

      setFondoComunitario(0);

      return 0;

    }

  };


  // =========================
  // SESIÓN
  // =========================

  useEffect(() => {
    let authStateRevision = 0;

    const handleAuthSession = async (event, nextSession) => {
      const nextIdentity = getSessionIdentity(nextSession);
      const requestId = ++authRequest.current;

      if (shouldResetIdentity(identity.current, nextSession)) {
        identity.current = nextIdentity;
        clearIdentityData();
      }

      setSession(nextSession);
      setUser(getSessionUser(nextSession));
      setLoading(true);

      // Supabase recomienda salir del callback antes de hacer otras consultas.
      setTimeout(async () => {
        try {
          if (!isCurrentRequest(requestId, nextIdentity)) return;

          if (shouldSendWelcomeEmail(event, nextSession)) {
            try {
              const { error } = await supabase.functions.invoke("send-welcome-email");
              if (error) throw error;
            } catch (error) {
              console.error("No se pudo enviar el correo de bienvenida:", error);
            }
          }

          if (!isCurrentRequest(requestId, nextIdentity)) return;
          await cargarDatosUsuario(nextSession, requestId);
        } finally {
          if (requestId === authRequest.current) {
            setLoading(false);
          }
        }
      }, 0);
    };

    const {
      data: { subscription }
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      authStateRevision += 1;
      handleAuthSession(event, nextSession);
    });

    const hydrateSession = async () => {
      const eventRevisionAtStart = authStateRevision;
      try {
        const { data: { session: initialSession }, error } = await supabase.auth.getSession();
        if (!shouldApplySessionHydration(eventRevisionAtStart, authStateRevision)) return;

        if (error) {
          console.error("Error inicializando sesión:", error);
          await handleAuthSession("INITIAL_SESSION", null);
          return;
        }

        await handleAuthSession("INITIAL_SESSION", initialSession);
      } catch (error) {
        if (!shouldApplySessionHydration(eventRevisionAtStart, authStateRevision)) return;
        console.error("Error cargando la sesión inicial:", error);
        await handleAuthSession("INITIAL_SESSION", null);
      }
    };

    hydrateSession();

    return () => {
      authRequest.current += 1;
      subscription.unsubscribe();
    };

    // The auth listener must be registered once for the provider lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // =========================
  // CONTEXTO
  // =========================

  const value = {
    user,
    session,

    profile,
    participant,
    participantes,
    grupo,
    grupos,
    fondoComunitario,
    loading,

    cargarPerfil,
    cargarParticipante,
    cargarGrupo,
    seleccionarGrupo,
    cargarFondoComunitario
  };


  return (

    <AuthContext.Provider
      value={value}
    >

      {children}

    </AuthContext.Provider>

  );
};

// =========================
// HOOK
// =========================

// The context hook is intentionally colocated with the provider for existing imports.
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {

  return useContext(
    AuthContext
  );

};