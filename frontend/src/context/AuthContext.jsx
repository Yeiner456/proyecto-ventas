/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useEffect } from "react";
import { api, getToken, setToken, clearToken } from "../services/apiClient";

/* ============================================================================
 * AuthContext — login real contra POST /api/login.
 * ----------------------------------------------------------------------------
 * PUNTO DE ADAPTACIÓN (lo más importante de este archivo):
 * La API devuelve el usuario con relaciones anidadas:
 *   { id_usuario, nombre, activo, sucursal_id,
 *     rol: { id_rol, nombre }, sucursal: { id_sucursal, nombre, ... } | null }
 *
 * Pero las 13 vistas que ya existen (Sidebar, UsuariosView, VentasView...)
 * fueron construidas esperando la forma "denormalizada" que ya usaba el
 * modo demo:
 *   { id_usuario, nombre, rol: "admin_sucursal", sucursal: "Sucursal Centro" | null }
 *
 * En vez de refactorizar 13 archivos para que entiendan objetos anidados,
 * la transformación ocurre UNA sola vez, aquí, en adaptarUsuario(). El
 * resto de la aplicación nunca sabe si el usuario vino de la API real o
 * de datos de prueba — solo conoce la forma interna estable. Es el mismo
 * principio de aislamiento que ya aplicamos separando AppLayout/Sidebar.
 *
 * LIMITACIÓN CONOCIDA: sucursal se expone como nombre (string), no como
 * id numérico, porque así es como las demás vistas ya hacen el lookup
 * (`sucursalesSeed.find(s => s.nombre === actor.sucursal)`). Esto
 * funciona hoy porque los nombres de sucursalesSeed coinciden con
 * SucursalSeeder.php real, pero es frágil: si alguien renombra una
 * sucursal en la base de datos, el emparejamiento por nombre se rompe
 * silenciosamente. La mejora correcta a futuro es exponer sucursal_id
 * aquí y refactorizar las vistas para buscar por id, no por nombre — no
 * lo hago ahora porque implica tocar los 13 archivos ya construidos y
 * no es lo que se pidió en este paso.
 * ==========================================================================*/

const AuthContext = createContext(null);

function adaptarUsuario(usuarioApi) {
  return {
    id_usuario: usuarioApi.id_usuario,
    nombre: usuarioApi.nombre,
    rol: usuarioApi.rol?.nombre ?? null,
    sucursal: usuarioApi.sucursal?.nombre ?? null,
  };
}

export function AuthProvider({ children }) {
  const [usuario, setUsuario] = useState(null);
  const [loading, setLoading] = useState(() => Boolean(getToken())); // true solo si hay token guardado

  // Al montar la app: si hay un token guardado de una sesión anterior,
  // validarlo contra GET /me en vez de asumir que sigue siendo válido
  // (pudo expirar, o el usuario pudo ser desactivado desde entonces).
  useEffect(() => {
    const token = getToken();
    if (!token) {
      return;
    }
    api
      .get("/me")
      .then((usuarioApi) => setUsuario(adaptarUsuario(usuarioApi)))
      .catch(() => clearToken()) // token inválido/expirado -> queda deslogueado
      .finally(() => setLoading(false));
  }, []);

  async function login(id_usuario, password) {
    // Deja que ApiError se propague — LoginView decide cómo mostrarla.
    const data = await api.post(
      "/login",
      { id_usuario: Number(id_usuario), password, device_name: "web" },
      { auth: false } // no hay token todavía, es justo lo que estamos pidiendo
    );
    setToken(data.token);
    setUsuario(adaptarUsuario(data.usuario));
  }

  async function logout() {
    try {
      await api.post("/logout");
    } catch {
      // Si el logout en el servidor falla (ej. token ya expiró), no
      // bloqueamos al usuario: igual lo sacamos localmente.
    }
    clearToken();
    setUsuario(null);
  }

  return (
    <AuthContext.Provider value={{ usuario, loading, login, logout }}>
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