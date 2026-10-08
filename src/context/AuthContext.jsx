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


  // =========================
  // CARGAR PERFIL
  // =========================

  const cargarPerfil = async (userId) => {

    if (!userId) {
      setProfile(null);
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
        bienvenida_completada
      `)
      .eq("id", userId)
      .single();

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
    puedeVerFondo = PERMISSIONS[profile?.rol?.toLowerCase()]?.verFondoComunitario === true
  ) => {

    if (!grupoId) {
      setGrupo(null);
      return;
    }

    const { data, error } = await supabase
      .from("grupos")
      .select("*")
      .eq("id", grupoId)
      .single();

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
      await cargarFondoComunitario(data.id, puedeVerFondo);
    } else {
      setFondoComunitario(0);
    }
  };


  // =========================
  // CARGAR PARTICIPANTE
  // =========================

  const cargarParticipante = async (
    userId,
    rol = profile?.rol
  ) => {

    if (!userId) {
      setParticipant(null);
      setParticipantes([]);
      setGrupo(null);
      setGrupos([]);
      setFondoComunitario(0);
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
      availableGroups = membershipGroups || [];
    }
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
      await cargarFondoComunitario(selectedGroup.id, puedeVerFondo);
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

  const cargarDatosUsuario = async (session) => {

    setSession(session);

    const currentUser =
      session?.user ?? null;

    setUser(currentUser);

    if (!currentUser) {

      setProfile(null);
      setParticipant(null);
      setParticipantes([]);
      setGrupo(null);
      setGrupos([]);
      setFondoComunitario(0);

      return;
    }

    const currentProfile = await cargarPerfil(
      currentUser.id
    );

    await cargarParticipante(
      currentUser.id,
      currentProfile?.rol
    );
  };

  // =========================
  // CARGAR FONDO COMUNITARIO
  // =========================


const cargarFondoComunitario =
  async (
    grupoId,
    puedeVerFondo = PERMISSIONS[profile?.rol?.toLowerCase()]?.verFondoComunitario === true
  ) => {

    if (!grupoId || !puedeVerFondo) {

      setFondoComunitario(0);

      return 0;

    }


    try {

      const saldo =
        await obtenerSaldoFondo(
          grupoId
        );


      setFondoComunitario(
        saldo
      );


      return saldo;

    } catch (error) {

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
    const {
      data: { subscription }
    } =
      supabase.auth.onAuthStateChange(
        (event, nextSession) => {
          const requestId = ++authRequest.current;

          setSession(nextSession);
          setUser(nextSession?.user ?? null);

          if (event === "TOKEN_REFRESHED") {
            return;
          }

          setLoading(true);

          // Supabase recomienda salir del callback antes de hacer otras consultas.
          setTimeout(async () => {
            try {
              await cargarDatosUsuario(nextSession);
            } finally {
              if (requestId === authRequest.current) {
                setLoading(false);
              }
            }
          }, 0);
        }
      );

    return () => {
      authRequest.current += 1;
      subscription.unsubscribe();
    };

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

export const useAuth = () => {

  return useContext(
    AuthContext
  );

};