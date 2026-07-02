/* ============================================================================
 * seedData.js — única fuente de datos de referencia para el prototipo.
 * ----------------------------------------------------------------------------
 * Equivalente en el frontend a lo que RolSeeder / SucursalSeeder /
 * UsuarioSeeder son en el backend: un set de datos consistente que todas
 * las vistas comparten mientras no hay conexión real a la API.
 *
 * REGLA: ninguna vista debe declarar su propia lista de roles/sucursales/
 * usuarios de ejemplo. Todas importan de aquí. Cuando se conecte la API
 * real, este archivo se reemplaza por las respuestas de
 * GET /api/roles, /api/sucursales, /api/usuarios — la forma de los
 * objetos ya coincide con esas respuestas para que el reemplazo sea directo.
 * ==========================================================================*/

export const sucursales = [
  { id_sucursal: 1, nombre: "Sucursal Centro" },
  { id_sucursal: 2, nombre: "Sucursal Norte" },
  { id_sucursal: 3, nombre: "Sucursal Sur" },
];

export const roles = [
  {
    id_rol: 1,
    nombre: "admin_general",
    descripcion: "Administrador general del sistema. Ve y gestiona todas las sucursales.",
    activo: true,
  },
  {
    id_rol: 2,
    nombre: "admin_sucursal",
    descripcion: "Administra una sucursal específica (incluye funciones contables de esa sucursal).",
    activo: true,
  },
  {
    id_rol: 3,
    nombre: "cajero",
    descripcion: "Opera el día a día: registra ventas y cobra. Atado a una sucursal.",
    activo: true,
  },
  {
    id_rol: 4,
    nombre: "contador",
    descripcion: "Consulta facturación, auditoría y genera reportes contables.",
    activo: false,
  },
];

// sucursal_id === null  ->  admin_general (misma regla que Usuario::esAdminGeneral() en el backend)
export const usuarios = [
  { id_usuario: 1, nombre: "Admin", email: "admin@example.com", rol_id: 1, sucursal_id: null, activo: true },
  { id_usuario: 2, nombre: "Yeiner Smith Quintero", email: "y.quintero@example.com", rol_id: 1, sucursal_id: null, activo: true },
  { id_usuario: 3, nombre: "Laura Pérez", email: "l.perez@example.com", rol_id: 2, sucursal_id: 1, activo: true },
  { id_usuario: 4, nombre: "Andrés Torres", email: "a.torres@example.com", rol_id: 2, sucursal_id: 2, activo: true },
  { id_usuario: 5, nombre: "Maria Gaviria", email: "m.gaviria@example.com", rol_id: 3, sucursal_id: 1, activo: true },
  { id_usuario: 6, nombre: "Sofia Montoya", email: "s.montoya@example.com", rol_id: 3, sucursal_id: 1, activo: true },
  { id_usuario: 7, nombre: "Santiago Ruiz", email: "s.ruiz@example.com", rol_id: 3, sucursal_id: 1, activo: true },
  { id_usuario: 8, nombre: "Camila Rojas", email: "c.rojas@example.com", rol_id: 3, sucursal_id: 2, activo: true },
  { id_usuario: 9, nombre: "Daniel Ospina", email: "d.ospina@example.com", rol_id: 3, sucursal_id: 3, activo: false },
  { id_usuario: 10, nombre: "Valentina Cárdenas", email: "v.cardenas@example.com", rol_id: 3, sucursal_id: 3, activo: true },
  { id_usuario: 11, nombre: "Felipe Naranjo", email: "f.naranjo@example.com", rol_id: 4, sucursal_id: 1, activo: false },
  { id_usuario: 12, nombre: "Isabella Castro", email: "i.castro@example.com", rol_id: 4, sucursal_id: 2, activo: false },
];

export function nombreRol(rol_id) {
  return roles.find((r) => r.id_rol === rol_id)?.nombre ?? "—";
}

export function nombreSucursal(sucursal_id) {
  if (sucursal_id === null) return null;
  return sucursales.find((s) => s.id_sucursal === sucursal_id)?.nombre ?? "—";
}

// Resuelve la forma "denormalizada" que usa AuthContext para el actor
// logueado (nombres en vez de ids, conveniente para mostrar en la Sidebar).
export function resolverActor(id_usuario) {
  const u = usuarios.find((x) => x.id_usuario === id_usuario);
  if (!u) return null;
  return {
    id_usuario: u.id_usuario,
    nombre: u.nombre,
    rol: nombreRol(u.rol_id),
    sucursal: nombreSucursal(u.sucursal_id),
  };
}
