import { Routes, Route } from "react-router-dom";

import Login from "../pages/auth/Login";
import Register from "../pages/auth/Register";

import MainLayout from "../components/layout/MainLayout";
import ProtectedRoute from "./ProtectedRoute";

import Dashboard from "../pages/dashboard/Dashboard";
import Grupos from "../pages/grupos/Grupos";
import Aportes from "../pages/aportes/Aportes";
import MiCuadro from "../pages/cuadro/MiCuadro";
import Prestamos from "../pages/prestamos/Prestamos";
import Historial from "../pages/reportes/Historial";
import Configuracion from "../pages/Configuracion";

const AppRoutes = () => {
  return (
    <Routes>

      <Route path="/login" element={<Login />} />
      <Route path="/registro" element={<Register />} />

      <Route
        path="/"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Dashboard />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/grupo"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Grupos />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/aportes"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Aportes />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/cuadro"
        element={
          <ProtectedRoute>
            <MainLayout>
              <MiCuadro />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/prestamos"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Prestamos />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/historial"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Historial />
            </MainLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/configuracion"
        element={
          <ProtectedRoute>
            <MainLayout>
              <Configuracion />
            </MainLayout>
          </ProtectedRoute>
        }
      />

    </Routes>
  );
};

export default AppRoutes;