import React from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

/* ============================================================================
 * RequireAuth — guardia de rutas.
 * ----------------------------------------------------------------------------
 * Tres estados posibles mientras se resuelve la sesión al cargar la app:
 *   1. loading=true  -> todavía se está validando el token contra GET /me.
 *      Mostrar un loader, NO redirigir todavía (si redirigimos aquí,
 *      alguien con sesión válida vería un parpadeo a /login antes de
 *      volver a /dashboard).
 *   2. loading=false, usuario=null -> no hay sesión válida -> a /login.
 *   3. loading=false, usuario existe -> renderizar la ruta protegida.
 * ==========================================================================*/
export default function RequireAuth() {
  const { usuario, loading } = useAuth();

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'Roboto', sans-serif", color: "var(--text-secondary)" }}>
        Cargando...
      </div>
    );
  }

  if (!usuario) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}