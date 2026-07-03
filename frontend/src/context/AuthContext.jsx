import React, { createContext, useContext, useState } from "react";
import { resolverActor } from "../mocks/seedData";

/* ============================================================================
 * AuthContext — punto único de verdad sobre "quién está logueado".
 * ----------------------------------------------------------------------------
 * Contrato real (backend/routes/api.php + AuthController):
 *   POST /api/login   { id_usuario, password, device_name? } -> { usuario, token }
 *   GET  /api/me       (Bearer token)                        -> usuario
 *   POST /api/logout   (Bearer token)
 *
 * PENDIENTE DE INTEGRACIÓN (marcado con TODO): hoy este contexto arranca
 * con un usuario de ejemplo para poder construir y previsualizar las
 * vistas sin backend levantado. Cuando el login esté conectado:
 *   1. Quitar DEMO_USERS y loginDemo().
 *   2. `login()` hace el POST real, guarda el token (localStorage o memoria)
 *      y guarda `usuario` con la respuesta del backend.
 *   3. Al montar la app, si hay token guardado, llamar GET /api/me para
 *      revalidar sesión en vez de asumir el usuario demo.
 *
 * Forma de `usuario` (igual a la respuesta de la API, ver Usuario.php):
 *   { id_usuario, nombre, email, activo, sucursal_id, rol: { id_rol, nombre } }
 * `sucursal` aquí es el nombre ya resuelto (relación cargada) para no
 * obligar a cada vista a hacer el join visualmente.
 * ==========================================================================*/

const AuthContext = createContext(null);

// TODO: borrar este bloque cuando el login real esté conectado.
// Los ids vienen de src/mocks/seedData.js — un representante por rol.
const DEMO_USERS = {
  admin_general: resolverActor(1),   // Admin
  admin_sucursal: resolverActor(3),  // Laura Pérez — Sucursal Centro
  cajero: resolverActor(5),          // Maria Gaviria — Sucursal Centro
  contador: resolverActor(11),       // Felipe Naranjo — Sucursal Centro
};

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(DEMO_USERS.admin_general);

  // TODO: reemplazar por el POST /api/login real.
  async function login(id_usuario, password) {
    throw new Error("login() aún no está conectado al backend.");
  }

  function logout() {
    setUsuario(null);
    // TODO: POST /api/logout con el Bearer token, y limpiar el token guardado.
  }

  // Solo para desarrollo: cambiar de usuario sin pasar por login real.
  // Quitar esta función (y cualquier UI que la use) antes de producción.
  function loginDemo(rol) {
    setUsuario(DEMO_USERS[rol]);
  }

  return (
    <AuthContext.Provider value={{ usuario, login, logout, loginDemo }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth() debe usarse dentro de <AuthProvider>");
  return ctx;
}

// Helper de rol — espejo exacto de Usuario::esAdminGeneral() en el backend.
// admin_general se define por sucursal === null, NUNCA por el nombre del rol.
export function esAdminGeneral(usuario) {
  return usuario?.sucursal === null;
}
