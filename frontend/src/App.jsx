import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import AppLayout from "./layouts/AppLayout";
import RequireAuth from "./components/RequireAuth";
import LoginView from "./views/LoginView";
import RolesView from "./views/RolesView";
import UsuariosView from "./views/UsuariosView";
import SucursalesView from "./views/SucursalesView";
import CategoriasView from "./views/CategoriasView";
import ProductosView from "./views/ProductosView";
import FacturasView from "./views/FacturasView";
import NuevaVentaView from "./views/NuevaVentaView";
import VentasView from "./views/VentasView";
import MetodosPagoView from "./views/MetodosPagoView";
import NotificacionesView from "./views/NotificacionesView";
import AuditoriaView from "./views/AuditoriaView";
import BackupsView from "./views/BackupsView";
import DashboardView from "./views/DashboardView";
import ReportesView from "./views/ReportesView";
// ...


export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginView />} />

          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route index element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<DashboardView />} />
              <Route path="/roles" element={<RolesView />} />
              <Route path="/usuarios" element={<UsuariosView />} />
              <Route path="/sucursales" element={<SucursalesView />} />
              <Route path="/categorias" element={<CategoriasView />} />
              <Route path="/productos" element={<ProductosView />} />
              <Route path="/facturas" element={<FacturasView />} />
              <Route path="/ventas/nueva" element={<NuevaVentaView />} />
              <Route path="/ventas" element={<VentasView />} />
              <Route path="/ventas/registro" element={<VentasView />} />
              <Route path="/metodos-pago" element={<MetodosPagoView />} />
              <Route path="/notificaciones" element={<NotificacionesView />} />
              <Route path="/auditoria" element={<AuditoriaView />} />
              <Route path="/backups" element={<BackupsView />} />
              <Route path="/reportes" element={<ReportesView />} />
            </Route>
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}