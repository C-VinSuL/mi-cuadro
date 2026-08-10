import { Routes, Route } from "react-router-dom";

import MainLayout from "../components/layout/MainLayout";

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

      <Route
        path="/"
        element={
          <MainLayout>
            <Dashboard />
          </MainLayout>
        }
      />

      <Route
        path="/grupo"
        element={
          <MainLayout>
            <Grupos />
          </MainLayout>
        }
      />

      <Route
        path="/aportes"
        element={
          <MainLayout>
            <Aportes />
          </MainLayout>
        }
      />

      <Route
        path="/cuadro"
        element={
          <MainLayout>
            <MiCuadro />
          </MainLayout>
        }
      />

      <Route
        path="/prestamos"
        element={
          <MainLayout>
            <Prestamos />
          </MainLayout>
        }
      />

      <Route
        path="/historial"
        element={
          <MainLayout>
            <Historial />
          </MainLayout>
        }
      />

      <Route
        path="/configuracion"
        element={
          <MainLayout>
            <Configuracion />
          </MainLayout>
        }
      />

    </Routes>
  );
};

export default AppRoutes;