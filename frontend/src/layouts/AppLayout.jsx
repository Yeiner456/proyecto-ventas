import React from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "../components/layout/Sidebar";

/* ============================================================================
 * AppLayout — responsabilidad única: estructura de página (sidebar + área
 * de contenido). No conoce rutas específicas ni lógica de ningún CRUD.
 *
 * Se usa como elemento de layout de react-router:
 *
 *   <Route element={<AppLayout />}>
 *     <Route path="/dashboard" element={<DashboardView />} />
 *     <Route path="/roles" element={<RolesView />} />
 *     ...
 *   </Route>
 *
 * <Outlet /> es donde react-router inyecta la vista de la ruta activa.
 * ==========================================================================*/
export default function AppLayout() {
  return (
    <div className="app-shell">
      <Sidebar />
      <main className="app-content">
        <Outlet />
      </main>
    </div>
  );
}
