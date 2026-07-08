import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ShoppingCart,
  ClipboardList,
  FileText,
  CreditCard,
  Package,
  Tags,
  Users as UsersIcon,
  Shield,
  Building2,
  Bell,
  Database,
  LogOut,
} from "lucide-react";
import { useAuth, esAdminGeneral } from "../../context/AuthContext";

/* ============================================================================
 * Sidebar — responsabilidad única: navegación global filtrada por rol.
 * No sabe nada de ningún CRUD específico.
 *
 * Visibilidad de cada item verificada contra las Policies reales del
 * backend (ver comentarios inline). Si el backend cambia una Policy,
 * este mapa debe actualizarse junto con ella.
 * ==========================================================================*/

function rolEfectivo(usuario) {
  return esAdminGeneral(usuario) ? "admin_general" : usuario.rol;
}

function puedeVer(usuario, rolesPermitidos) {
  if (rolesPermitidos === "todos") return true;
  return rolesPermitidos.includes(rolEfectivo(usuario));
}

const NAV_CONFIG = [
  {
    group: null,
    items: [{ key: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "/dashboard", roles: "todos" }],
  },
  {
    group: "Ventas",
    items: [
      { key: "ventas", label: "Ventas", icon: ShoppingCart, path: "/ventas", roles: ["admin_general"] },
      { key: "nueva-venta", label: "Nueva venta", icon: ShoppingCart, path: "/ventas/nueva", roles: ["admin_sucursal", "cajero"] },
      { key: "registro-ventas", label: "Registro de ventas", icon: ClipboardList, path: "/ventas/registro", roles: ["admin_sucursal", "cajero"] },
      // FacturaPolicy::viewAny() => true para todos los roles autenticados.
      { key: "facturas", label: "Facturas", icon: FileText, path: "/facturas", roles: ["admin_general", "admin_sucursal", "cajero"] },
      { key: "metodos-pago", label: "Métodos de pago", icon: CreditCard, path: "/metodos-pago", roles: ["admin_general"] },
    ],
  },
  {
    group: "Catálogo",
    items: [
      { key: "productos", label: "Producto", icon: Package, path: "/productos", roles: ["admin_general", "admin_sucursal"] },
      { key: "categorias", label: "Categorías", icon: Tags, path: "/categorias", roles: ["admin_general", "admin_sucursal"] },
    ],
  },
  {
    group: "Administración",
    items: [
      { key: "usuarios", label: "Usuario", icon: UsersIcon, path: "/usuarios", roles: ["admin_general", "admin_sucursal"] },
      // RolPolicy: create/update/delete en false, solo admin_general (before()).
      { key: "roles", label: "Roles", icon: Shield, path: "/roles", roles: ["admin_general"] },
      // SucursalPolicy: create/update/delete en false, solo admin_general.
      { key: "sucursales", label: "Sucursales", icon: Building2, path: "/sucursales", roles: ["admin_general"] },
    ],
  },
  {
    group: "Sistema",
    items: [
      { key: "notificaciones", label: "Notificaciones", icon: Bell, path: "/notificaciones", roles: "todos" },
      // AuditoriaLogPolicy::viewAny() exige esAdminSucursal(); coincide
      // con esta lista (cajero nunca gestiona auditoría).
      { key: "auditoria", label: "Auditoría", icon: ClipboardList, path: "/auditoria", roles: ["admin_general", "admin_sucursal"] },
      // Gate 'gestionar-backups' (AppServiceProvider): exige
      // esAdminGeneral(), no una Policy de modelo — no hay tabla 'backups'.
      { key: "backups", label: "Backups", icon: Database, path: "/backups", roles: ["admin_general"] },
    ],
  },
];

export default function Sidebar() {
  const { usuario, logout } = useAuth();
  const admin = esAdminGeneral(usuario);

  return (
    <aside className="app-sidebar">
      <div className="app-sidebar-brand">
        <p className="app-sidebar-brand-name">CafeteriaApp</p>
        {admin ? (
          <p className="app-sidebar-brand-sub">Panel de Administración</p>
        ) : (
          <span className="app-sidebar-chip">{usuario.sucursal}</span>
        )}
      </div>

      <nav className="app-nav">
        {NAV_CONFIG.map((section, i) => {
          const items = section.items.filter((item) => puedeVer(usuario, item.roles));
          if (items.length === 0) return null;
          return (
            <div key={i}>
              {section.group && <div className="app-nav-group-label">{section.group}</div>}
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.key}
                    to={item.path}
                    className={({ isActive }) => `app-nav-item${isActive ? " active" : ""}`}
                  >
                    <Icon size={16} />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          );
        })}
      </nav>

      <div className="app-sidebar-footer">
        <div className="app-sidebar-avatar">{usuario.nombre.slice(0, 1).toUpperCase()}</div>
        <div>
          <div className="app-sidebar-user-name">{usuario.nombre}</div>
          <div className="app-sidebar-user-role">
            {admin ? "Admin supremo" : usuario.rol.replace("_", " ")}
          </div>
        </div>
        <button className="app-sidebar-logout" title="Cerrar sesión" onClick={logout}>
          <LogOut size={16} />
        </button>
      </div>
    </aside>
  );
}