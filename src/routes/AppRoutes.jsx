import {
  Routes,
  Route
} from "react-router-dom";

import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";
import ForgotPassword from "../pages/auth/ForgotPassword";
import UpdatePassword from "../pages/auth/UpdatePassword";
import MfaSetup from "../pages/auth/MfaSetup";
import AcceptGroupInvite from "../pages/grupos/AcceptGroupInvite";

import MainLayout from "../components/layout/MainLayout";

import ProtectedRoute from "./ProtectedRoute";
import RoleRoute from "./RoleRoute";

import Dashboard from "../pages/dashboard/Dashboard";
import Grupos from "../pages/grupos/Grupos";
import Aportes from "../pages/aportes/Aportes";
import MiCuadro from "../pages/cuadro/MiCuadro";
import Prestamos from "../pages/prestamos/Prestamos";
import Historial from "../pages/reportes/Historial";
import Configuracion from "../pages/Configuracion";
import Usuarios from "../pages/admin/Usuarios";
import VerificarDocumentos from "../pages/admin/VerificarDocumentos";
import Auditoria from "../pages/reportes/Auditoria";
import Billetera from "../pages/Billetera";

const AppRoutes = () => {
  return (
    <Routes>

      

      {/* =========================
          RUTAS PÚBLICAS
      ========================== */}

      <Route
        path="/login"
        element={<Login />}
      />

      <Route
        path="/registro"
        element={<Register />}
      />

      <Route
        path="/recuperar-contrasena"
        element={<ForgotPassword />}
      />

      <Route
        path="/actualizar-contrasena"
        element={<UpdatePassword />}
      />

      <Route path="/seguridad/mfa" element={<MfaSetup />} />

      {/* =========================
          DASHBOARD
      ========================== */}

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <RoleRoute permission="verDashboard">

              <MainLayout>
                <Dashboard />
              </MainLayout>

            </RoleRoute>
          </ProtectedRoute>
        }
      />


      {/* =========================
          MI GRUPO
      ========================== */}

      <Route
        path="/grupo"
        element={
          <ProtectedRoute>
            <RoleRoute permission="verGrupo">

              <MainLayout>
                <Grupos />
              </MainLayout>

            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/aceptar-invitacion"
        element={
          <ProtectedRoute>
            <AcceptGroupInvite />
          </ProtectedRoute>
        }
      />


      {/* =========================
          APORTES
      ========================== */}

      <Route
        path="/aportes"
        element={
          <ProtectedRoute>
            <RoleRoute permission="verAportes">

              <MainLayout>
                <Aportes />
              </MainLayout>

            </RoleRoute>
          </ProtectedRoute>
        }
      />


      {/* =========================
          MI CUADRO
      ========================== */}

      <Route
        path="/cuadro"
        element={
          <ProtectedRoute>
            <RoleRoute permission="verCuadro">

              <MainLayout>
                <MiCuadro />
              </MainLayout>

            </RoleRoute>
          </ProtectedRoute>
        }
      />


      {/* =========================
          PRÉSTAMOS
      ========================== */}

      <Route
        path="/prestamos"
        element={
          <ProtectedRoute>
            <RoleRoute permission="verPrestamos">

              <MainLayout>
                <Prestamos />
              </MainLayout>

            </RoleRoute>
          </ProtectedRoute>
        }
      />


      {/* =========================
          HISTORIAL
      ========================== */}

      <Route
        path="/historial"
        element={
          <ProtectedRoute>
            <RoleRoute permission="verFondoComunitario">

            <MainLayout>
              <Historial />
            </MainLayout>
            </RoleRoute>

          </ProtectedRoute>
        }
      />


      {/* =========================
          CONFIGURACIÓN
          SOLO QUIEN TENGA PERMISO
      ========================== */}

      <Route
        path="/configuracion"
        element={
          <ProtectedRoute>
            <RoleRoute permission="verConfiguracion">

              <MainLayout>
                <Configuracion />
              </MainLayout>

            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/usuarios"
        element={
          <ProtectedRoute>
            <RoleRoute permission="gestionarUsuarios">
              <MainLayout><Usuarios /></MainLayout>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/verificar-documentos"
        element={
          <ProtectedRoute>
            <RoleRoute permission="verificarDocumentos">
              <MainLayout><VerificarDocumentos /></MainLayout>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/auditoria"
        element={
          <ProtectedRoute>
            <RoleRoute permission="verAuditoria">
              <MainLayout><Auditoria /></MainLayout>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/billetera"
        element={
          <ProtectedRoute>
            <RoleRoute permission="verBilletera">
              <MainLayout><Billetera /></MainLayout>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/billetera"
        element={
          <ProtectedRoute>
            <RoleRoute permission="gestionarBilletera">
              <MainLayout><Billetera /></MainLayout>
            </RoleRoute>
          </ProtectedRoute>
        }
      />

    </Routes>
  );
};

export default AppRoutes;