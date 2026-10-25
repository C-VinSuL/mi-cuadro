
import {
  useEffect,
  useState
} from "react";

import {
  Wallet,
  CalendarDays,
  CheckCircle2,
  Clock3,
  CircleDollarSign
} from "lucide-react";

import SectionPageTitle from "../../components/ui/SectionPageTitle";
import {
  supabase
} from "../../services/supabase";

import {
  useAuth
} from "../../context/AuthContext";
import { useNotifications } from "../../hooks/useNotifications";
import AportesAdmin from "./AportesAdmin";
import { etiquetaPeriodo, etiquetaPeriodoMinuscula } from "../../services/grupoService";
import { createUniqueId } from "../../utils/uniqueId";

const obtenerAportesSocio = async (participantId) => {
  const { data, error } = await supabase
    .from("aportes")
    .select("*")
    .eq("participante_id", participantId)
    .order("semana", { ascending: false });

  if (error) throw error;
  return data || [];
};


const AportesSocio = () => {

  const {
    user,
    grupo,
    participant,
  } = useAuth();
  const { notify } = useNotifications();


  const [aportes, setAportes] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [registrando, setRegistrando] =
    useState(false);

  const [mensaje, setMensaje] =
    useState("");

  const [comprobante, setComprobante] = useState(null);
  const [comprobanteInputKey, setComprobanteInputKey] = useState(0);

  // =========================
  // DATOS CALCULADOS
  // =========================

  const aporteSemanal =
    Number(
      grupo?.aporte_semanal || 0
    );

  const comisionApp = 0;

  const totalPagar =
    aporteSemanal + comisionApp;

  const semanaActual =
    grupo?.semana_actual || 0;
  const grupoActivo = grupo?.estado === "activo";
  const periodoActual = etiquetaPeriodo(grupo?.aporte_periodicidad);
  const periodoActualMinuscula = etiquetaPeriodoMinuscula(grupo?.aporte_periodicidad);


  // =========================
  // CARGAR APORTES
  // =========================

  const cargarAportes = async () => {

    if (!participant?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      setAportes(await obtenerAportesSocio(participant.id));
    } catch (error) {
      console.error(
        "Error cargando aportes:",
        error
      );
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    let active = true;
    const participantId = participant?.id;

    Promise.resolve().then(async () => {
      if (!participantId) {
        if (active) setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const data = await obtenerAportesSocio(participantId);
        if (active) setAportes(data);
      } catch (error) {
        console.error("Error cargando aportes:", error);
      } finally {
        if (active) setLoading(false);
      }
    });

    return () => {
      active = false;
    };
  }, [participant?.id]);


  // =========================
  // APORTE DE ESTA SEMANA
  // =========================

  const aporteSemanaActual =
    aportes.find(
      (aporte) =>
        aporte.semana ===
        semanaActual
    );


  // =========================
  // REGISTRAR APORTE
  // =========================

  const registrarAporte =
    async () => {

      if (!participant || !grupo || !user?.id) {
        return;
      }

      if (!grupoActivo) {
        setMensaje("El grupo aún no ha iniciado. Podrás registrar aportes cuando administración o tesorería inicie el cuadro.");
        return;
      }

      if (aporteSemanaActual && aporteSemanaActual.estado_revision !== "rechazado") {

        setMensaje(
          aporteSemanaActual.estado_revision === "pendiente"
            ? "Tu comprobante ya está pendiente de revisión."
            : "Este periodo ya tiene un aporte aprobado."
        );

        return;
      }

      if (!comprobante) {
        setMensaje("Adjunta el comprobante de pago para enviarlo a revisión.");
        return;
      }

      const tiposPermitidos = ["image/jpeg", "image/png", "application/pdf"];
      if (!tiposPermitidos.includes(comprobante.type) || comprobante.size > 5 * 1024 * 1024) {
        setMensaje("Adjunta un comprobante JPG, PNG o PDF de hasta 5 MB.");
        return;
      }

      setRegistrando(true);
      setMensaje("");

      let objectPath = null;
      const comprobanteAnterior = aporteSemanaActual?.estado_revision === "rechazado"
        ? aporteSemanaActual.comprobante_path
        : null;
      try {
        const extension = comprobante.type === "application/pdf"
          ? "pdf"
          : comprobante.type.split("/")[1];
        objectPath = `${user.id}/${createUniqueId()}.${extension}`;
        const { error: uploadError } = await supabase.storage
          .from("contribution-receipts")
          .upload(objectPath, comprobante, {
            contentType: comprobante.type,
            upsert: false
          });
        if (uploadError) throw uploadError;

        const { error } = await supabase.rpc("registrar_aporte_propio", {
          p_participante_id: participant.id,
          p_comprobante_path: objectPath
        });
        if (error) throw error;

        if (comprobanteAnterior && comprobanteAnterior !== objectPath) {
          const { error: cleanupError } = await supabase.storage
            .from("contribution-receipts")
            .remove([comprobanteAnterior]);
          if (cleanupError) {
            console.error("No se pudo limpiar el comprobante rechazado reemplazado:", cleanupError);
          }
        }

        setComprobante(null);
        setComprobanteInputKey((current) => current + 1);
        setMensaje("Comprobante enviado. El aporte quedará pendiente hasta que tesorería lo revise.");
        notify({
          title: "Comprobante enviado",
          message: `Tesorería revisará tu aporte del periodo ${semanaActual} (${periodoActualMinuscula}).`,
          type: "success"
        });

        await cargarAportes();
      } catch (error) {
        console.error("Error registrando aporte:", error);
        setMensaje(error.message || "No se pudo registrar el aporte.");
        if (objectPath) {
          const { error: cleanupError } = await supabase.storage
            .from("contribution-receipts")
            .remove([objectPath]);
          if (cleanupError) {
            console.error("No se pudo limpiar el comprobante sin solicitud:", cleanupError);
          }
        }
      } finally {
        setRegistrando(false);
      }
    };


  // =========================
  // SIN GRUPO
  // =========================

  if (!grupo) {

    return (
      <div
        className="
          bg-white
          rounded-2xl
          border
          border-slate-200
          p-6
        "
      >
        No perteneces a ningún grupo.
      </div>
    );
  }


  return (
    <div className="space-y-8">

      {/* =====================
          HEADER
      ====================== */}

      <SectionPageTitle
        icon={CircleDollarSign}
        eyebrow="Mis aportes"
        title="Aportes"
        description={`Revisa tus aportes y registra el pago correspondiente a cada ${periodoActualMinuscula}.`}
      />

      {/* =====================
          TARJETA PRINCIPAL
      ====================== */}

      {!grupoActivo && (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-5 py-4 text-sm text-blue-950" role="status">
          <p className="font-semibold">Aportes todavía no habilitados</p>
          <p className="mt-1">Podrás registrar tu aporte cuando administración o tesorería inicie el grupo.</p>
        </div>
      )}

      <section
        className="
          rounded-3xl
          bg-gradient-to-br
          from-emerald-700
          to-teal-800
          text-white
          p-6
          md:p-8
          shadow-lg
        "
      >

        <div
          className="
            flex
            flex-col
            lg:flex-row
            lg:items-center
            lg:justify-between
            gap-8
          "
        >

          <div>

            <p
              className="
                text-emerald-200
                text-sm
              "
            >
              {periodoActual} actual
            </p>

            <h2
              className="
                text-3xl
                font-bold
                mt-1
              "
            >
              {grupoActivo ? `${periodoActual} ${semanaActual}` : "Grupo en preparación"}
            </h2>

            <p
              className="
                mt-4
                text-emerald-100
              "
            >
              Grupo: {grupo.nombre}
            </p>

          </div>


          <div
            className="
              grid
              grid-cols-1
              sm:grid-cols-2
              gap-4
              w-full
              lg:max-w-2xl
            "
          >

            <div
              className="
                bg-white/10
                rounded-2xl
                p-4
              "
            >
              <p
                className="
                  text-xs
                  text-emerald-200
                "
              >
                Aporte
              </p>

              <p
                className="
                  text-2xl
                  font-bold
                  mt-1
                "
              >
                ${aporteSemanal.toFixed(2)}
              </p>
            </div>


            <div
              className="
                bg-white
                text-slate-900
                rounded-2xl
                p-4
              "
            >
              <p
                className="
                  text-xs
                  text-slate-500
                "
              >
                Total
              </p>

              <p
                className="
                  text-2xl
                  font-bold
                  mt-1
                "
              >
                ${totalPagar.toFixed(2)}
              </p>
            </div>

          </div>

        </div>


        {/* ESTADO Y BOTÓN */}

        <div
          className="
            mt-8
            flex
            flex-col
            sm:flex-row
            sm:items-center
            sm:justify-between
            gap-4
          "
        >

          <div
            className="
              flex
              items-center
              gap-3
            "
          >

            {aporteSemanaActual ? (

              <>
                {aporteSemanaActual.estado_revision === "pendiente"
                  ? <Clock3 className="text-amber-300" />
                  : <CheckCircle2 className="text-lime-300" />}

                <div>
                  <p className="font-semibold">
                    {aporteSemanaActual.estado_revision === "pendiente"
                      ? "Comprobante en revisión"
                      : aporteSemanaActual.estado_revision === "rechazado"
                      ? "Comprobante rechazado"
                      : "Aporte registrado"}
                  </p>

                  <p
                    className="
                      text-sm
                      text-emerald-200
                    "
                  >
                    {aporteSemanaActual.estado_revision === "pendiente"
                      ? "Tesorería confirmará el pago después de revisar el comprobante."
                      : aporteSemanaActual.estado_revision === "rechazado"
                      ? aporteSemanaActual.nota_revision || "Adjunta nuevamente el comprobante para solicitar otra revisión."
                      : "Este periodo ya está al día."}
                  </p>
                </div>
              </>

            ) : (

              <>
                <Clock3
                  className="
                    text-amber-300
                  "
                />

                <div>
                  <p className="font-semibold">
                    Pago pendiente
                  </p>

                  <p
                    className="
                      text-sm
                      text-emerald-200
                    "
                  >
                    Adjunta el comprobante de pago de este periodo.
                  </p>
                </div>
              </>

            )}

          </div>


          <div className="w-full space-y-3 lg:max-w-sm">
            {(!aporteSemanaActual || aporteSemanaActual.estado_revision === "rechazado") && (
              <>
                <label className="block text-sm font-semibold text-white" htmlFor="aporte-comprobante">
                  Comprobante (JPG, PNG o PDF; máximo 5 MB)
                  <input
                    key={comprobanteInputKey}
                    id="aporte-comprobante"
                    type="file"
                    accept="image/jpeg,image/png,application/pdf"
                    onChange={(event) => setComprobante(event.target.files?.[0] || null)}
                    className="mt-1.5 block w-full rounded-lg bg-white/10 p-2 text-xs file:mr-3 file:rounded-md file:border-0 file:bg-white file:px-3 file:py-2 file:font-semibold file:text-emerald-800"
                  />
                </label>
                <button
                  onClick={registrarAporte}
                  disabled={registrando || !grupoActivo || !comprobante}
                  className="w-full rounded-xl bg-white px-6 py-3 font-semibold text-emerald-800 transition hover:bg-emerald-50 disabled:opacity-60"
                >
                  {registrando
                    ? "Enviando comprobante..."
                    : !grupoActivo
                    ? "Disponible al iniciar el grupo"
                    : comprobante
                    ? `Enviar aporte de $${totalPagar.toFixed(2)} a revisión`
                    : "Adjunta el comprobante para continuar"}
                </button>
              </>
            )}
          </div>

        </div>

      </section>


      {/* MENSAJE */}

      {mensaje && (

        <div
          className="
            rounded-xl
            border
            border-emerald-200
            bg-emerald-50
            text-emerald-800
            px-5
            py-4
          "
        >
          {mensaje}
        </div>

      )}


      {/* =====================
          RESUMEN
      ====================== */}

      <div
        className="
          grid
          grid-cols-1
          md:grid-cols-3
          gap-5
        "
      >

        <div
          className="
            bg-white
            rounded-2xl
            border
            border-slate-200
            p-5
            shadow-sm
          "
        >
          <Wallet
            className="
              text-emerald-700
            "
          />

          <p
            className="
              text-sm
              text-slate-500
              mt-4
            "
          >
            Aportes realizados
          </p>

          <p
            className="
              text-3xl
              font-bold
              mt-1
            "
          >
            {aportes.filter((aporte) => aporte.estado?.toLowerCase() === "pagado").length}
          </p>
        </div>


        <div
          className="
            bg-white
            rounded-2xl
            border
            border-slate-200
            p-5
            shadow-sm
          "
        >
          <CircleDollarSign
            className="
              text-blue-600
            "
          />

          <p
            className="
              text-sm
              text-slate-500
              mt-4
            "
          >
            Total aportado
          </p>

          <p
            className="
              text-3xl
              font-bold
              mt-1
            "
          >
            $
            {aportes
              .reduce(
                (
                  total,
                  aporte
                ) =>
                  total +
                  Number(
                    aporte.monto
                  ),
                0
              )
              .toFixed(2)}
          </p>
        </div>


        <div
          className="
            bg-white
            rounded-2xl
            border
            border-slate-200
            p-5
            shadow-sm
          "
        >
          <CalendarDays
            className="
              text-orange-500
            "
          />

          <p
            className="
              text-sm
              text-slate-500
              mt-4
            "
          >
            {periodoActual} actual
          </p>

          <p
            className="
              text-3xl
              font-bold
              mt-1
            "
          >
            {semanaActual}
          </p>
        </div>

      </div>


      {/* =====================
          HISTORIAL
      ====================== */}

      <section
        className="
          bg-white
          rounded-3xl
          border
          border-slate-200
          shadow-sm
          overflow-hidden
        "
      >

        <div
          className="
            p-6
            border-b
            border-slate-200
          "
        >

          <h2
            className="
              text-xl
              font-bold
              text-slate-900
            "
          >
            Historial de aportes
          </h2>

          <p
            className="
              text-sm
              text-slate-500
              mt-1
            "
          >
            Tus pagos registrados
            dentro del cuadro.
          </p>

        </div>


        {loading ? (

          <div
            className="
              p-8
              text-slate-500
            "
          >
            Cargando aportes...
          </div>

        ) : aportes.length === 0 ? (

          <div
            className="
              p-10
              text-center
              text-slate-500
            "
          >
            Todavía no tienes aportes registrados.
          </div>

        ) : (

          <div className="overflow-x-auto">

            <table className="w-full">

              <thead
                className="
                  bg-slate-50
                "
              >

                <tr>

                  <th
                    className="
                      text-left
                      p-4
                    "
                  >
                    {periodoActual}
                  </th>

                  <th
                    className="
                      text-left
                      p-4
                    "
                  >
                    Aporte
                  </th>

                  <th
                    className="
                      text-left
                      p-4
                    "
                  >
                    Comisión
                  </th>

                  <th
                    className="
                      text-left
                      p-4
                    "
                  >
                    Estado
                  </th>

                  <th
                    className="
                      text-left
                      p-4
                    "
                  >
                    Fecha
                  </th>

                </tr>

              </thead>


              <tbody>

                {aportes.map(
                  (aporte) => (

                    <tr
                      key={
                        aporte.id
                      }
                      className="
                        border-t
                        border-slate-100
                      "
                    >

                      <td className="p-4">
                        {periodoActual} {aporte.semana}
                      </td>

                      <td className="p-4 font-semibold">
                        $
                        {Number(
                          aporte.monto
                        ).toFixed(2)}
                      </td>

                      <td className="p-4">
                        $
                        {Number(
                          aporte.comision_app
                        ).toFixed(2)}
                      </td>

                      <td className="p-4">

                        <span
                          className="
                            rounded-full
                            bg-emerald-100
                            text-emerald-700
                            px-3
                            py-1
                            text-xs
                            font-semibold
                          "
                        >
                          {aporte.estado_revision === "rechazado"
                            ? "Rechazado"
                            : aporte.estado_revision === "pendiente"
                            ? "En revisión"
                            : aporte.estado_revision === "aprobado"
                            ? "Aprobado"
                            : aporte.estado}
                          {aporte.estado_revision === "rechazado" && aporte.nota_revision && (
                            <span className="mt-1 block max-w-xs text-xs font-normal text-red-700">{aporte.nota_revision}</span>
                          )}
                        </span>

                      </td>

                      <td className="p-4 text-slate-500">
                        {aporte.fecha_pago
                          ? new Date(aporte.fecha_pago).toLocaleDateString("es-EC")
                          : "-"}
                      </td>

                    </tr>

                  )
                )}

              </tbody>

            </table>

          </div>

        )}

      </section>

    </div>
  );
};


const Aportes = () => {
  const { profile } = useAuth();
  return ["administrador", "tesorero"].includes(profile?.rol?.toLowerCase())
    ? <AportesAdmin />
    : <AportesSocio />;
};

export default Aportes;
