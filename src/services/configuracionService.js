import {
  supabase
} from "./supabase";


// ======================================================
// ACTUALIZAR CONFIGURACIÓN DEL GRUPO
// ======================================================

export const actualizarConfiguracionGrupo =
  async ({
    grupoId,
    interesPrestamo,
    maxCuotasPrestamo,
    montoMaxPrestamo,
    prestamosSoloActivo
  }) => {

    const {
      data,
      error
    } = await supabase.rpc(
      "actualizar_configuracion_grupo",
      {
        p_grupo_id:
          grupoId,

        p_interes_prestamo:
          Number(
            interesPrestamo
          ),

        p_max_cuotas_prestamo:
          Number(
            maxCuotasPrestamo
          ),

        p_monto_max_prestamo:
          montoMaxPrestamo === null ||
          montoMaxPrestamo === "" ||
          typeof montoMaxPrestamo ===
            "undefined"

            ? null

            : Number(
                montoMaxPrestamo
              ),

        p_prestamos_solo_activo:
          Boolean(
            prestamosSoloActivo
          )
      }
    );


    if (error) {

      console.error(
        "Error RPC configuración:",
        error
      );

      throw error;

    }


    return data;
  };