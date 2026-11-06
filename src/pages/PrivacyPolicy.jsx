import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";

const DATA_CATEGORIES = [
  {
    title: "Cuenta e identificación",
    items: [
      "Nombre, apellido, correo electrónico, número de teléfono y rol en la plataforma.",
      "Credenciales de acceso, gestionadas por el proveedor de autenticación; FlashMonkey no necesita conocer tu contraseña en texto legible.",
      "Número de cédula o documento de identidad, dirección, fecha de nacimiento y enlaces a redes sociales cuando los proporcionas para completar o verificar el perfil.",
      "Fotografía de perfil, biografía y documentos de identidad que presentes para verificación."
    ]
  },
  {
    title: "Actividad comunitaria y financiera",
    items: [
      "Grupos, membresías, posiciones y participación en cuadros o rondas.",
      "Aportes, comprobantes, movimientos, solicitudes y saldos de billetera, egresos y registros relacionados con la administración de la comunidad.",
      "Solicitudes de préstamos y otros registros financieros que la plataforma permita gestionar."
    ]
  },
  {
    title: "Mensajes, archivos y soporte",
    items: [
      "Mensajes enviados en Atención a socios (Moki) y en la comunicación interna del equipo.",
      "Archivos y comprobantes que adjuntas en esas funciones o en otras secciones de la plataforma."
    ]
  },
  {
    title: "Seguridad y uso técnico",
    items: [
      "Eventos de seguridad y auditoría, como acciones realizadas, fecha y hora, dirección IP y agente de usuario cuando se registran para revisar invitaciones o actividad administrativa.",
      "Información necesaria para mantener la sesión, autenticación multifactor, prevenir abusos, diagnosticar errores y mantener la disponibilidad del servicio."
    ]
  }
];

const DATA_USES = [
  "Crear y administrar tu cuenta, verificar tu identidad y proteger el acceso.",
  "Operar grupos, aportes, cuadros, billeteras y demás funciones financieras o comunitarias.",
  "Atender consultas, enviar avisos operativos y facilitar la comunicación entre socios y personal autorizado.",
  "Mantener registros de auditoría, investigar incidentes, prevenir fraude y cumplir obligaciones aplicables.",
  "Entender el uso general de la plataforma y mejorar su funcionamiento mediante analítica."
];

const THIRD_PARTIES = [
  {
    name: "Supabase",
    detail: "Proporciona autenticación, base de datos, almacenamiento de archivos y funciones del backend. Los datos necesarios para esas funciones se procesan en su infraestructura."
  },
  {
    name: "Vercel",
    detail: "Aloja la aplicación y proporciona Vercel Analytics, que recopila métricas de uso del sitio para entender y mejorar su rendimiento."
  },
  {
    name: "Google",
    detail: "Si eliges iniciar sesión con Google, Google participa en la autenticación y comparte con la plataforma la información de cuenta autorizada para completar el acceso, como tu correo y perfil básico."
  },
  {
    name: "Brevo",
    detail: "Envía correos operativos, como mensajes de bienvenida e invitaciones. Para ello recibe los datos necesarios del destinatario y del mensaje."
  }
];

const PrivacyPolicy = () => (
  <main className="min-h-dvh bg-[#F4F7F5] px-4 py-8 sm:px-6 sm:py-12">
    <article className="mx-auto max-w-4xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-emerald-950/5">
      <header className="bg-[#023A2D] px-6 py-8 text-white sm:px-10 sm:py-10">
        <Link
          to="/login"
          className="inline-flex items-center gap-2 rounded-lg text-sm font-medium text-emerald-100 transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
        >
          <ArrowLeft size={17} /> Volver al inicio
        </Link>
        <div className="mt-7 flex items-center gap-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-white/10">
            <ShieldCheck size={23} />
          </span>
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-emerald-100">FlashMonkey</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">Política de privacidad</h1>
          </div>
        </div>
        <p className="mt-5 max-w-2xl text-sm leading-6 text-emerald-50">
          Esta página explica qué información puede tratar la plataforma, para qué se utiliza y qué servicios tecnológicos participan.
        </p>
        <p className="mt-3 text-xs text-emerald-100">Última actualización: 6 de noviembre de 2026</p>
      </header>

      <div className="space-y-8 px-6 py-8 sm:px-10 sm:py-10">
        <section>
          <h2 className="text-lg font-bold text-slate-900">Responsable y alcance</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Esta política está preparada para una organización que opera en Ecuador y debe revisarse conforme a la Ley Orgánica de Protección de Datos Personales y demás normas aplicables. Los datos son administrados por la organización responsable de FlashMonkey y por el administrador autorizado de tu comunidad, según sus funciones. La razón social o identidad legal del responsable y un correo directo de privacidad están pendientes de confirmación. Puedes dirigir consultas iniciales al administrador mediante Atención a socios.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">Datos que recopilamos</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            La información depende de las funciones que utilices y de los datos que entregues. Puede incluir:
          </p>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            {DATA_CATEGORIES.map(({ title, items }) => (
              <section key={title} className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
                <ul className="mt-2 list-disc space-y-2 pl-5 text-sm leading-5 text-slate-600">
                  {items.map((item) => <li key={item}>{item}</li>)}
                </ul>
              </section>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">Para qué usamos los datos</h2>
          <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-6 text-slate-600">
            {DATA_USES.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">Moki e inteligencia artificial</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Moki es un asistente automatizado que ofrece opciones rápidas, respuestas predefinidas y accesos a secciones de la plataforma. La versión del código revisada para esta política no muestra una conexión a un servicio externo de inteligencia artificial generativa: los mensajes de soporte se guardan en la infraestructura de Supabase y pueden ser consultados por el personal autorizado para responderlos.
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Si se incorpora una función de IA generativa, antes de activarla se deberá actualizar esta política para identificar al proveedor, describir qué datos se enviarían y con qué finalidad. No compartas información que no sea necesaria en los mensajes.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">Terceros que procesan datos</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Para operar la aplicación se utilizan los siguientes proveedores; cada uno procesa la información necesaria para prestar su servicio:
          </p>
          <div className="mt-4 divide-y divide-slate-200 rounded-2xl border border-slate-200">
            {THIRD_PARTIES.map(({ name, detail }) => (
              <div key={name} className="p-4 sm:px-5">
                <h3 className="text-sm font-semibold text-slate-900">{name}</h3>
                <p className="mt-1 text-sm leading-5 text-slate-600">{detail}</p>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs leading-5 text-slate-500">
            La lista refleja las integraciones identificadas en el código de la aplicación. La organización debe confirmar la configuración de producción, la región de alojamiento y cualquier proveedor adicional configurado fuera de este repositorio.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">Acceso, conservación y seguridad</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Los datos se muestran según el rol y los permisos de cada cuenta. El acceso a información personal y documentos se limita a las funciones necesarias de la plataforma y a personal autorizado. La información se conserva mientras sea necesaria para prestar el servicio, mantener los registros de la comunidad, atender obligaciones aplicables y resolver disputas; los plazos concretos deben ser definidos por la organización responsable.
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            La aplicación incorpora controles como autenticación multifactor, permisos por rol y políticas de acceso a datos. Ningún sistema conectado a Internet puede garantizar seguridad absoluta.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-bold text-slate-900">Tus solicitudes y contacto</h2>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Puedes solicitar acceso a tus datos, su actualización o rectificación, eliminación, oposición, suspensión o portabilidad, y retirar un consentimiento cuando corresponda, mediante el administrador de tu comunidad en Atención a socios. La atención y el alcance de cada solicitud dependerán de la normativa aplicable y de los registros que deban conservarse.
          </p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Antes de publicar esta política como versión definitiva, la organización responsable debe completar su razón social o identidad legal, agregar un correo de contacto directo para privacidad y confirmar los plazos de conservación y las condiciones de sus proveedores.
          </p>
        </section>

        <div className="border-t border-slate-200 pt-5 text-sm text-slate-500">
          <Link to="/registro" className="font-semibold text-emerald-800 hover:text-emerald-950 hover:underline">
            Volver al registro
          </Link>
        </div>
      </div>
    </article>
  </main>
);

export default PrivacyPolicy;
