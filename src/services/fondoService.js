import { supabase } from "./supabase";

// ==========================================
// OBTENER SALDO REAL DEL FONDO
// ==========================================

export const obtenerSaldoFondo =
  async (grupoId) => {

    if (!grupoId) {
      return 0;
    }


    const {
      data,
      error
    } = await supabase.rpc(
      "obtener_saldo_fondo",
      {
        p_grupo_id:
          grupoId
      }
    );


    if (error) {

      console.error(
        "Error obteniendo saldo del fondo:",
        error
      );

      throw error;

    }


    return Number(
      data || 0
    );

  };


// ==========================================
// OBTENER MOVIMIENTOS
// ==========================================

export const obtenerMovimientosFondo =
  async (grupoId) => {

    if (!grupoId) {
      return [];
    }


    const {
      data,
      error
    } = await supabase
      .from(
        "movimientos_fondo"
      )
      .select(`
        id,
        grupo_id,
        tipo,
        concepto,
        monto,
        prestamo_id,
        aporte_id,
        cuota_id,
        descripcion,
        created_at
      `)
      .eq(
        "grupo_id",
        grupoId
      )
      .order(
        "created_at",
        {
          ascending: false
        }
      );


    if (error) {

      console.error(
        "Error obteniendo movimientos:",
        error
      );

      throw error;

    }


    return data || [];

  };
