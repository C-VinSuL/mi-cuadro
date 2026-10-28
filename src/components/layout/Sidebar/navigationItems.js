import {
  Home,
  Users,
  Wallet,
  CircleDollarSign,
  Landmark,
  HandCoins,
  History,
  Settings,
  ShieldCheck,
  UserRoundCog,
  FileClock,
  FileSearch,
  MessageCircle
} from "lucide-react";

export const menu = [
  {
    title: "Inicio",
    icon: Home,
    path: "/",
    permission: "verDashboard"
  },
  {
    title: "Mi Grupo",
    icon: Users,
    path: "/grupo",
    permission: "verGrupo"
  },
  {
    title: "Mi billetera",
    icon: Wallet,
    path: "/billetera",
    permission: "verBilletera"
  },
  {
    title: "Aportes",
    icon: CircleDollarSign,
    path: "/aportes",
    permission: "verAportes"
  },
  {
    title: "Cuadro rotativo",
    icon: Landmark,
    path: "/cuadro",
    permission: "verCuadro"
  },
  {
    title: "Préstamos",
    icon: HandCoins,
    path: "/prestamos",
    permission: "verPrestamos"
  },
  {
    title: "Solicitudes de billetera",
    icon: Wallet,
    path: "/admin/billetera",
    permission: "gestionarBilletera"
  },
  {
    title: "Historial",
    icon: History,
    path: "/historial",
    permission: "verFondoComunitario"
  },
  {
    title: "Auditoría",
    icon: FileClock,
    path: "/auditoria",
    permission: "verAuditoria"
  },
  {
    title: "Archivos de auditoría",
    icon: FileSearch,
    path: "/admin/archivos",
    permission: "gestionarUsuarios"
  },
  {
    title: "Socios y roles",
    icon: UserRoundCog,
    path: "/usuarios",
    permission: "gestionarUsuarios"
  },
  {
    title: "Atención a socios",
    icon: MessageCircle,
    path: "/atencion-socios",
    permission: "gestionarAtencionSocios"
  },
  {
    title: "Verificar documentos",
    icon: ShieldCheck,
    path: "/verificar-documentos",
    permission: "verificarDocumentos"
  },
  {
    title: "Configuración",
    icon: Settings,
    path: "/configuracion",
    permission: "verConfiguracion"
  }
];

export const getVisibleMenu = (can, rol) => menu
  .filter((item) => can(item.permission))
  .map((item) => {
    if (rol !== "administrador") return item;
    const adminTitles = {
      "/grupo": "Grupos",
      "/aportes": "Control de aportes",
      "/cuadro": "Revisar cuadro",
      "/historial": "Reportes"
    };
    return { ...item, title: adminTitles[item.path] || item.title };
  });
