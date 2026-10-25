import assert from "node:assert/strict";
import { test } from "node:test";

process.env.VITE_SUPABASE_URL = "https://example.supabase.co";
process.env.VITE_SUPABASE_ANON_KEY = "anon-key";

const { supabase } = await import("./supabase.js");
const {
  obtenerResumenBilletera,
  obtenerGarantiaMinimaBilleteraAdmin,
  listarMovimientosBilletera,
  listarSolicitudesBilleteraPropias,
  solicitarDepositoBilletera,
  solicitarRetiroBilletera,
  listarSolicitudesBilleteraAdmin,
  resolverSolicitudBilletera,
} = await import("./walletService.js");
const {
  registrarEgreso,
  listarEgresosRecientes,
  obtenerTotalEgresos,
} = await import("./egresosService.js");

const rpcCalls = [];
const fromCalls = [];

supabase.rpc = async (name, params = {}) => {
  rpcCalls.push([name, params]);

  if (name === "resumen_billetera_propio") {
    return {
      data: [{ saldo: 125.5, disponible: 95.0 }],
      error: null,
    };
  }

  if (name === "garantia_minima_billetera_admin") {
    return { data: 20, error: null };
  }

  if (name === "historial_billetera_propio") {
    return { data: [{ tipo: "deposito", monto: 50 }], error: null };
  }

  if (name === "listar_solicitudes_billetera_admin") {
    return { data: [{ id: "req-1", aprobado: false }], error: null };
  }

  if (name === "resolver_solicitud_billetera") {
    return {
      data: { ok: true, aprobar: params.p_aprobar, nota: params.p_nota, referencia: params.p_referencia },
      error: null,
    };
  }

  if (name === "obtener_total_egresos_tesoreria") {
    return { data: 4100, error: null };
  }

  if (name === "solicitar_deposito_billetera") {
    return { data: { id: "deposito-1", monto: params.p_monto }, error: null };
  }

  if (name === "solicitar_retiro_billetera") {
    return { data: { id: "retiro-1", monto: params.p_monto }, error: null };
  }

  return { data: null, error: null };
};

const createQueryBuilder = (result) => ({
  then: (resolve) => resolve({ data: result, error: null }),
  in: () => createQueryBuilder(result),
  order: () => createQueryBuilder(result),
  limit: async () => ({ data: result, error: null }),
  select: () => createQueryBuilder(result),
  single: async () => ({ data: result, error: null }),
});

supabase.from = (table) => {
  fromCalls.push(table);

  if (table === "grupos") {
    return {
      select: () => createQueryBuilder([
        { id: "grupo-1", nombre: "Grupo prueba" },
      ]),
    };
  }

  return {
    insert: () => ({
      select: () => ({
        single: async () => ({ data: { id: "egreso-1" }, error: null }),
      }),
    }),
    select: () => createQueryBuilder([
      {
        id: "egreso-1",
        grupo_id: "grupo-1",
        concepto: "Pago de servicios",
        categoria: "Operativo",
        monto: 1250,
        fecha: "2026-10-20",
        created_at: "2026-10-20T12:00:00Z",
      },
    ]),
  };
};

test("wallet service exposes authenticated wallet reads and writes through RPC", async () => {
  const summary = await obtenerResumenBilletera();
  const garantia = await obtenerGarantiaMinimaBilleteraAdmin();
  const movimientos = await listarMovimientosBilletera();
  const solicitudes = await listarSolicitudesBilleteraPropias();
  const deposito = await solicitarDepositoBilletera(80, "receipts/deposito.pdf");
  const retiro = await solicitarRetiroBilletera(25);
  const adminSolicitudes = await listarSolicitudesBilleteraAdmin();
  const respuesta = await resolverSolicitudBilletera("req-1", true, "Aprobado", "REF-123");

  assert.deepEqual(summary, { saldo: 125.5, disponible: 95.0 });
  assert.equal(garantia, 20);
  assert.deepEqual(movimientos, [{ tipo: "deposito", monto: 50 }]);
  assert.deepEqual(solicitudes, null);
  assert.deepEqual(deposito, { id: "deposito-1", monto: 80 });
  assert.deepEqual(retiro, { id: "retiro-1", monto: 25 });
  assert.deepEqual(adminSolicitudes, [{ id: "req-1", aprobado: false }]);
  assert.deepEqual(respuesta, {
    ok: true,
    aprobar: true,
    nota: "Aprobado",
    referencia: "REF-123",
  });

  assert.equal(rpcCalls.length >= 8, true);
  assert.deepEqual(rpcCalls[0], ["resumen_billetera_propio", {}]);
  assert.deepEqual(rpcCalls[4], [
    "solicitar_deposito_billetera",
    { p_monto: 80, p_referencia: null, p_comprobante_path: "receipts/deposito.pdf" },
  ]);
});

test("expense service inserts records and totals treasury spend with role-guarded access", async () => {
  const inserted = await registrarEgreso({
    grupoId: "grupo-1",
    concepto: "Pago de servicios",
    categoria: "Operativo",
    monto: 1250,
    fecha: "2026-10-20",
  });

  const lastExpenses = await listarEgresosRecientes(["grupo-1"]);
  const total = await obtenerTotalEgresos();

  assert.deepEqual(inserted, { id: "egreso-1" });
  assert.deepEqual(lastExpenses, [{
    id: "egreso-1",
    grupo_id: "grupo-1",
    concepto: "Pago de servicios",
    categoria: "Operativo",
    monto: 1250,
    fecha: "2026-10-20",
    created_at: "2026-10-20T12:00:00Z",
    grupo: "Grupo prueba",
  }]);
  assert.equal(total, 4100);
  assert.equal(fromCalls.length > 0, true);
});
