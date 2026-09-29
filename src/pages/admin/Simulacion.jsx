import { useEffect, useState } from "react";
import { Activity, Check, CircleDollarSign, RotateCcw, ShieldAlert } from "lucide-react";

const STORAGE_KEY = "mi-cuadro-demo-v1";

const INITIAL_STATE = {
  participants: [
    { id: "p1", name: "Ana Morales", position: 1, weeklyPayment: 51, paid: false },
    { id: "p2", name: "Carlos Vega", position: 2, weeklyPayment: 51, paid: true },
    { id: "p3", name: "Lucía Rojas", position: 3, weeklyPayment: 51, paid: true },
    { id: "p4", name: "Mateo Ruiz", position: 4, weeklyPayment: 51, paid: false }
  ],
  loans: [
    { id: "l1", participantId: "p1", amount: 240, installments: 6, status: "Pendiente" },
    { id: "l2", participantId: "p2", amount: 150, installments: 5, status: "Aprobado" }
  ],
  events: [
    { id: "e1", label: "Préstamo de Carlos aprobado", amount: 150, createdAt: "Escenario inicial" },
    { id: "e2", label: "Aporte de Carlos registrado", amount: 51, createdAt: "Escenario inicial" }
  ]
};

const createInitialState = () => JSON.parse(JSON.stringify(INITIAL_STATE));

const loadState = () => {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : createInitialState();
  } catch {
    return createInitialState();
  }
};

const money = (amount) => `$${Number(amount).toFixed(2)}`;

const Simulacion = () => {
  const [demo, setDemo] = useState(loadState);
  const [view, setView] = useState("administrador");

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(demo));
  }, [demo]);

  useEffect(() => {
    const syncDemo = (event) => {
      if (event.key !== STORAGE_KEY || !event.newValue) return;
      try {
        setDemo(JSON.parse(event.newValue));
      } catch {
        setDemo(createInitialState());
      }
    };

    window.addEventListener("storage", syncDemo);
    return () => window.removeEventListener("storage", syncDemo);
  }, []);

  const paidCount = demo.participants.filter((person) => person.paid).length;
  const collected = demo.participants
    .filter((person) => person.paid)
    .reduce((total, person) => total + person.weeklyPayment, 0);
  const communityFund = collected + 425;
  const personalParticipant = demo.participants[0];
  const personalLoans = demo.loans.filter((loan) => loan.participantId === personalParticipant.id);

  const registerPayment = (participantId) => {
    const participant = demo.participants.find((person) => person.id === participantId);
    if (!participant || participant.paid) return;

    setDemo((current) => ({
      ...current,
      participants: current.participants.map((person) =>
        person.id === participantId ? { ...person, paid: true } : person
      ),
      events: [
        { id: crypto.randomUUID(), label: `Aporte de ${participant.name} registrado`, amount: participant.weeklyPayment, createdAt: new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }) },
        ...current.events
      ]
    }));
  };

  const approveLoan = (loanId) => {
    const loan = demo.loans.find((item) => item.id === loanId);
    const participant = demo.participants.find((person) => person.id === loan?.participantId);
    if (!loan || loan.status !== "Pendiente") return;

    setDemo((current) => ({
      ...current,
      loans: current.loans.map((item) => item.id === loanId ? { ...item, status: "Aprobado" } : item),
      events: [
        { id: crypto.randomUUID(), label: `Préstamo de ${participant?.name ?? "socio"} aprobado`, amount: loan.amount, createdAt: new Date().toLocaleTimeString("es", { hour: "2-digit", minute: "2-digit" }) },
        ...current.events
      ]
    }));
  };

  const resetDemo = () => {
    setDemo(createInitialState());
    window.localStorage.removeItem(STORAGE_KEY);
  };

  return (
    <div className="space-y-7 pb-10">
      <header className="flex flex-col gap-5 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase text-emerald-700">Entorno de prueba local</p>
          <h1 className="mt-1 text-3xl font-bold text-slate-900">Simulación operativa</h1>
          <p className="mt-2 max-w-2xl text-slate-600">Prueba aportes, préstamos e historial en un escenario ficticio que se actualiza al instante.</p>
        </div>
        <button onClick={resetDemo} className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
          <RotateCcw size={17} /> Reiniciar escenario
        </button>
      </header>

      <div className="flex items-start gap-3 border-l-4 border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-950" role="note">
        <ShieldAlert size={19} className="mt-0.5 shrink-0" />
        <p><strong>Solo datos ficticios.</strong> Esta simulación se guarda en este navegador y no crea pagos, préstamos ni movimientos en Supabase.</p>
      </div>

      <section className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">Vista previa del rol</h2>
          <p className="text-sm text-slate-500">Cambia de perspectiva sin modificar usuarios reales.</p>
        </div>
        <div className="inline-flex w-fit rounded-lg border border-slate-300 bg-white p-1" role="group" aria-label="Seleccionar vista de prueba">
          {["administrador", "tesorero", "socio"].map((role) => (
            <button key={role} onClick={() => setView(role)} aria-pressed={view === role} className={`rounded-md px-3 py-2 text-sm capitalize ${view === role ? "bg-emerald-700 text-white" : "text-slate-600 hover:bg-slate-100"}`}>
              {role}
            </button>
          ))}
        </div>
      </section>

      {view === "socio" ? (
        <section className="grid gap-5 lg:grid-cols-[1fr_1fr]">
          <div className="border-y border-slate-200 py-6">
            <p className="text-sm text-slate-500">Mi aporte de la semana</p>
            <p className="mt-2 text-3xl font-bold text-slate-900">{personalParticipant.paid ? "Pagado" : "Pendiente"}</p>
            <p className="mt-1 text-sm text-slate-500">{money(personalParticipant.weeklyPayment)} · Puesto #{personalParticipant.position}</p>
            {!personalParticipant.paid && <button onClick={() => registerPayment(personalParticipant.id)} className="mt-5 rounded-lg bg-emerald-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-800">Simular mi pago</button>}
          </div>
          <div className="border-y border-slate-200 py-6">
            <p className="text-sm text-slate-500">Mi historial de préstamos</p>
            {personalLoans.length ? personalLoans.map((loan) => <p key={loan.id} className="mt-3 font-semibold text-slate-900">{money(loan.amount)} · {loan.installments} cuotas · {loan.status}</p>) : <p className="mt-3 text-slate-600">No hay préstamos en este escenario.</p>}
            <p className="mt-3 text-xs text-slate-500">El saldo total del fondo no se muestra a los socios.</p>
          </div>
        </section>
      ) : (
        <>
          <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <Metric label="Aportes pagados" value={`${paidCount} / ${demo.participants.length}`} />
            <Metric label="Recaudado" value={money(collected)} />
            <Metric label="Solicitudes pendientes" value={demo.loans.filter((loan) => loan.status === "Pendiente").length} />
            <Metric label="Fondo simulado" value={money(communityFund)} />
          </section>

          <section className="grid gap-7 xl:grid-cols-[1fr_0.8fr]">
            <div>
              <div className="mb-3 flex items-center gap-2"><CircleDollarSign size={19} className="text-emerald-700" /><h2 className="font-semibold text-slate-900">Aportes · semana 4</h2></div>
              <div className="divide-y divide-slate-200 border-y border-slate-200">
                {demo.participants.map((person) => (
                  <div key={person.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div><p className="font-medium text-slate-900">{person.name}</p><p className="text-sm text-slate-500">Puesto #{person.position} · {money(person.weeklyPayment)}</p></div>
                    {person.paid ? <span className="inline-flex items-center gap-1 text-sm font-semibold text-emerald-700"><Check size={16} /> Pagado</span> : <button onClick={() => registerPayment(person.id)} className="rounded-md border border-emerald-700 px-3 py-1.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-50">Simular pago</button>}
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-3 flex items-center gap-2"><Activity size={19} className="text-blue-700" /><h2 className="font-semibold text-slate-900">Préstamos e historial</h2></div>
              <div className="divide-y divide-slate-200 border-y border-slate-200">
                {demo.loans.map((loan) => {
                  const participant = demo.participants.find((person) => person.id === loan.participantId);
                  return <div key={loan.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                    <div><p className="font-medium text-slate-900">{participant?.name} · {money(loan.amount)}</p><p className="text-sm text-slate-500">{loan.installments} cuotas · {loan.status}</p></div>
                    {loan.status === "Pendiente" && <button onClick={() => approveLoan(loan.id)} className="rounded-md border border-blue-700 px-3 py-1.5 text-sm font-semibold text-blue-800 hover:bg-blue-50">Simular aprobación</button>}
                  </div>;
                })}
              </div>
            </div>
          </section>
        </>
      )}

      <section>
        <h2 className="mb-3 font-semibold text-slate-900">Actividad reciente</h2>
        <div className="divide-y divide-slate-200 border-y border-slate-200">
          {demo.events.map((event) => <div key={event.id} className="flex flex-wrap justify-between gap-2 py-3 text-sm"><span className="text-slate-700">{event.label}</span><span className="text-slate-500">{money(event.amount)} · {event.createdAt}</span></div>)}
        </div>
      </section>
    </div>
  );
};

const Metric = ({ label, value }) => (
  <div className="border-y border-slate-200 py-4">
    <p className="text-sm text-slate-500">{label}</p>
    <p className="mt-1 text-2xl font-bold text-slate-900">{value}</p>
  </div>
);

export default Simulacion;