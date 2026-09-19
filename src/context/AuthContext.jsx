import {
  createContext,
  useContext,
  useEffect,
  useState
} from "react";

import { supabase } from "../services/supabase";
import { obtenerSaldoFondo} from "../services/fondoService";

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {

  const [user, setUser] = useState(null);
  const [session, setSession] = useState(null);

  const [profile, setProfile] = useState(null);
  const [participant, setParticipant] = useState(null);
  const [grupo, setGrupo] = useState(null);
  const [fondoComunitario, setFondoComunitario] = useState(0);
  

  const [loading, setLoading] = useState(true);


  // =========================
  // CARGAR PERFIL
  // =========================

  const cargarPerfil = async (userId) => {

    if (!userId) {
      setProfile(null);
      return;
    }

    const { data, error } = await supabase
      .from("perfiles")
      .select(`
        id,
        nombre,
        apellido,
        telefono,
        rol
      `)
      .eq("id", userId)
      .single();

    if (error) {
      console.error("Error cargando perfil:", error);
      setProfile(null);
      return;
    }

    setProfile(data);
  };


  // =========================
  // CARGAR GRUPO
  // =========================

  const cargarGrupo = async (grupoId) => {

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
      return;
    }

    console.log("Grupo cargado:", data);

    setGrupo(data);
    await cargarFondoComunitario(data.id);
  };


  // =========================
  // CARGAR PARTICIPANTE
  // =========================

  const cargarParticipante = async (userId) => {

    if (!userId) {
      setParticipant(null);
      setGrupo(null);
      return;
    }

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
      .maybeSingle();

    if (error) {
      console.error(
        "Error cargando participante:",
        error
      );

      setParticipant(null);
      setGrupo(null);

      return;
    }

    setParticipant(data);

    console.log(
      "Participante cargado:",
      data
    );

    // Cargar grupo del participante
    if (data?.grupo_id) {
      await cargarGrupo(data.grupo_id);
    } else {
      setGrupo(null);
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
      setGrupo(null);

      return;
    }

    await cargarPerfil(
      currentUser.id
    );

    await cargarParticipante(
      currentUser.id
    );
  };

  // =========================
  // CARGAR FONDO COMUNITARIO
  // =========================


const cargarFondoComunitario =
  async (grupoId) => {

    if (!grupoId) {

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

    const iniciar = async () => {

      setLoading(true);

      const {
        data: { session }
      } =
        await supabase.auth.getSession();

      await cargarDatosUsuario(
        session
      );

      setLoading(false);
    };

    iniciar();


    // Escuchar Login / Logout

    const {
      data: { subscription }
    } =
      supabase.auth.onAuthStateChange(
        (_event, session) => {

          cargarDatosUsuario(
            session
          );

        }
      );


    return () => {
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
    grupo,
    fondoComunitario,
    loading,

    cargarPerfil,
    cargarParticipante,
    cargarGrupo,
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