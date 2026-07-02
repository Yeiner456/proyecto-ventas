import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import AppLayout from "./layouts/AppLayout";
import RolesView from "./views/RolesView";

// TODO: importar el resto de vistas a medida que se construyan.
// import DashboardView from "./views/DashboardView";
// import UsuariosView from "./views/UsuariosView";
// import SucursalesView from "./views/SucursalesView";
// import ProductosView from "./views/ProductosView";
// import CategoriasView from "./views/CategoriasView";
// import FacturasView from "./views/FacturasView";
// import NuevaVentaView from "./views/NuevaVentaView";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<AppLayout />}>
            <Route index element={<Navigate to="/roles" replace />} />
            <Route path="/roles" element={<RolesView />} />
            {/* <Route path="/dashboard" element={<DashboardView />} /> */}
            {/* <Route path="/usuarios" element={<UsuariosView />} /> */}
            {/* <Route path="/sucursales" element={<SucursalesView />} /> */}
            {/* <Route path="/productos" element={<ProductosView />} /> */}
            {/* <Route path="/categorias" element={<CategoriasView />} /> */}
            {/* <Route path="/facturas" element={<FacturasView />} /> */}
            {/* <Route path="/ventas/nueva" element={<NuevaVentaView />} /> */}
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
