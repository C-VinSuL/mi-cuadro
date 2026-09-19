import { supabase } from "./supabase";

// ======================================================
// PRÉSTAMOS DEL GRUPO
// ADMIN / TESORERO
// ======================================================

export const obtenerPrestamosGrupo =
  async (grupoId) => {

    const {
      data,
      error
    } = await supabase
      .from("prestamos")
      .select(`
        id,
        grupo_id,
        participante_id,
        monto,
        interes_porcentaje,
        numero_cuotas,
        total_pagar,
        cuota_mensual,
        motivo,
        estado,
        fecha_solicitud,
        fecha_aprobacion,
        aprobado_por,
        observacion_revision,

        participantes (
          id,
          nombre,
          posicion
        )
      `)
      .eq(
        "grupo_id",
        grupoId
      )
      .order(
        "fecha_solicitud",
        {
          ascending: false
        }
      );

    if (error) {
      throw error;
    }

    return data || [];
  };

// ======================================================
// PRÉSTAMOS DE UN SOCIO
// ======================================================

export const obtenerPrestamosSocio =
  async (participanteId) => {

    const {
      data,
      error
    } = await supabase
      .from("prestamos")
      .select(`
        id,
        grupo_id,
        participante_id,
        monto,
        interes_porcentaje,
        numero_cuotas,
        total_pagar,
        cuota_mensual,
        motivo,
        estado,
        fecha_solicitud,
        fecha_aprobacion,
        observacion_revision
      `)
      .eq(
        "participante_id",
        participanteId
      )
      .order(
        "fecha_solicitud",
        {
          ascending: false
        }
      );

    if (error) {
      throw error;
    }

    return data || [];
  };

// ======================================================
// SOLICITAR PRÉSTAMO
// RPC SEGURA
// ======================================================

export const solicitarPrestamo =
  async ({
    monto,
    cuotas,
    motivo
  }) => {

    const {
      data,
      error
    } = await supabase.rpc(
      "solicitar_prestamo",
      {
        p_monto:
          Number(monto),

        p_numero_cuotas:
          Number(cuotas),

        p_motivo:
          motivo?.trim() ||
          null
      }
    );

    if (error) {
      throw error;
    }

    return data;
  };

// ======================================================
// APROBAR
// ======================================================

export const aprobarPrestamo =
  async (prestamoId) => {

    const {
      data,
      error
    } = await supabase.rpc(
      "aprobar_prestamo",
      {
        p_prestamo_id:
          prestamoId
      }
    );

    if (error) {
      throw error;
    }

    return data;
  };

// ======================================================
// RECHAZAR
// ======================================================

export const rechazarPrestamo =
  async (
    prestamoId,
    observacion
  ) => {

    const {
      data,
      error
    } = await supabase.rpc(
      "rechazar_prestamo",
      {
        p_prestamo_id:
          prestamoId,

        p_observacion:
          observacion || null
      }
    );

    if (error) {
      throw error;
    }

    return data;
  };

// ======================================================
// CUOTAS
// ======================================================

export const obtenerCuotasPrestamo =
  async (prestamoId) => {

    const {
      data,
      error
    } = await supabase
      .from("cuotas_prestamo")
      .select(`
        id,
        prestamo_id,
        numero_cuota,
        monto,
        fecha_vencimiento,
        estado,
        fecha_pago,
        created_at
      `)
      .eq(
        "prestamo_id",
        prestamoId
      )
      .order(
        "numero_cuota",
        {
          ascending: true
        }
      );

    if (error) {
      throw error;
    }

    return data || [];
  };

// ======================================================
// PAGAR CUOTA
// ======================================================

export const pagarCuotaPrestamo =
  async (cuotaId) => {

    const {
      data,
      error
    } = await supabase.rpc(
      "pagar_cuota_prestamo",
      {
        p_cuota_id:
          cuotaId
      }
    );

    if (error) {
      throw error;
    }

    return data;
  };

// ======================================================
// RESUMEN DE CUOTAS
// ======================================================

export const obtenerResumenCuotasPrestamo =
  async (prestamoId) => {

    const cuotas =
      await obtenerCuotasPrestamo(
        prestamoId
      );

    const totalCuotas =
      cuotas.length;

    const pagadas =
      cuotas.filter(
        (cuota) =>
          cuota.estado ===
          "pagado"
      );

    const cuotasPagadas =
      pagadas.length;

    const totalPagado =
      pagadas.reduce(
        (
          total,
          cuota
        ) =>
          total +
          Number(
            cuota.monto || 0
          ),
        0
      );

    const totalPrestamo =
      cuotas.reduce(
        (
          total,
          cuota
        ) =>
          total +
          Number(
            cuota.monto || 0
          ),
        0
      );

    const saldoPendiente =
      Math.max(
        totalPrestamo -
        totalPagado,
        0
      );

    const porcentaje =
      totalCuotas > 0
        ? Math.round(
            (
              cuotasPagadas /
              totalCuotas
            ) * 100
          )
        : 0;

    const hoy =
      new Date();

    hoy.setHours(
      0,
      0,
      0,
      0
    );

    const cuotasVencidas =
      cuotas.filter(
        (cuota) => {

          if (
            cuota.estado ===
            "pagado" ||
            !cuota.fecha_vencimiento
          ) {
            return false;
          }

          const fecha =
            new Date(
              `${cuota.fecha_vencimiento}T00:00:00`
            );

          return fecha < hoy;
        }
      );

    const totalVencido =
      cuotasVencidas.reduce(
        (
          total,
          cuota
        ) =>
          total +
          Number(
            cuota.monto || 0
          ),
        0
      );

    return {
      totalCuotas,
      cuotasPagadas,
      totalPagado,
      totalPrestamo,
      saldoPendiente,
      porcentaje,
      cuotasVencidas:
        cuotasVencidas.length,
      totalVencido
    };
  };