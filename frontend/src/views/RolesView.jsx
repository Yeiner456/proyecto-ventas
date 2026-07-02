import React, { useState, useMemo } from "react";
import {
  Shield,
  Users,
  UserCheck,
  Plus,
  Pencil,
  Trash2,
  X,
  Eye,
  AlertTriangle,
  Info,
} from "lucide-react";

/* ============================================================================
 * ROLES — Vista CRUD
 * ----------------------------------------------------------------------------
 * Contrato real (backend/routes/api.php):
 *   GET    /api/roles              -> listar (paginado)
 *   POST   /api/roles              -> crear   { nombre, descripcion, activo }
 *   PUT    /api/roles/{id_rol}     -> editar
 *   DELETE /api/roles/{id_rol}     -> eliminar (409 si tiene usuarios asignados)
 * Todas requieren Authorization: Bearer {token}. Autorizado solo para
 * admin_general (ver RolPolicy::before). El resto de roles solo puede
 * listar/ver (viewAny/view -> admin_sucursal).
 *
 * NOTA DE ARQUITECTURA:
 * El modelo Rol NO tiene columna de permisos. Los "permisos principales"
 * que se muestran aquí son de SOLO LECTURA y vienen de un mapa estático
 * (PERMISOS_POR_ROL) que documenta en el frontend lo que las Policies del
 * backend ya hacen por nombre de rol. Si se crea un rol con un nombre que
 * no está en ese mapa, el formulario avisa que no tendrá permisos reales
 * hasta que se actualicen las Policies en el backend.
 * ==========================================================================*/

// --- Capa de datos (mock, con la misma forma que la API real) --------------
// Sustituir el cuerpo de estas funciones por fetch() reales cuando el
// frontend se conecte al backend. Las firmas ya están pensadas para eso.

const initialRoles = [
  {
    id_rol: 1,
    nombre: "admin_general",
    descripcion:
      "Administrador general del sistema. Ve y gestiona todas las sucursales.",
    activo: true,
  },
  {
    id_rol: 2,
    nombre: "admin_sucursal",
    descripcion:
      "Administra una sucursal específica (incluye funciones contables de esa sucursal).",
    activo: true,
  },
  {
    id_rol: 3,
    nombre: "cajero",
    descripcion:
      "Opera el día a día: registra ventas y cobra. Atado a una sucursal.",
    activo: true,
  },
  {
    id_rol: 4,
    nombre: "contador",
    descripcion:
      "Consulta facturación, auditoría y genera reportes contables.",
    activo: false,
  },
];

const initialUsuarios = [
  { id_usuario: 1, nombre: "Juan Pablo Montoya", email: "j.montoya@example.com", rol_id: 1, sucursal: "—", activo: true },
  { id_usuario: 2, nombre: "Yeiner Smith Quintero", email: "y.quintero@example.com", rol_id: 1, sucursal: "—", activo: true },
  { id_usuario: 3, nombre: "Laura Pérez", email: "l.perez@example.com", rol_id: 2, sucursal: "Sucursal Centro", activo: true },
  { id_usuario: 4, nombre: "Andrés Torres", email: "a.torres@example.com", rol_id: 2, sucursal: "Sucursal Norte", activo: true },
  { id_usuario: 5, nombre: "Maria Gaviria", email: "m.gaviria@example.com", rol_id: 3, sucursal: "Sucursal Centro", activo: true },
  { id_usuario: 6, nombre: "Sofia Montoya", email: "s.montoya@example.com", rol_id: 3, sucursal: "Sucursal Centro", activo: true },
  { id_usuario: 7, nombre: "Santiago Ruiz", email: "s.ruiz@example.com", rol_id: 3, sucursal: "Sucursal Centro", activo: true },
  { id_usuario: 8, nombre: "Camila Rojas", email: "c.rojas@example.com", rol_id: 3, sucursal: "Sucursal Norte", activo: true },
  { id_usuario: 9, nombre: "Daniel Ospina", email: "d.ospina@example.com", rol_id: 3, sucursal: "Sucursal Sur", activo: false },
  { id_usuario: 10, nombre: "Valentina Cárdenas", email: "v.cardenas@example.com", rol_id: 3, sucursal: "Sucursal Sur", activo: true },
  { id_usuario: 11, nombre: "Felipe Naranjo", email: "f.naranjo@example.com", rol_id: 4, sucursal: "Sucursal Centro", activo: false },
  { id_usuario: 12, nombre: "Isabella Castro", email: "i.castro@example.com", rol_id: 4, sucursal: "Sucursal Norte", activo: false },
];

// Solo lectura: refleja lo que las Policies ya deciden por nombre de rol.
const PERMISOS_POR_ROL = {
  admin_general: [
    "Gestionar usuarios",
    "Gestionar roles",
    "Gestionar sucursales",
    "Crear / anular ventas",
    "Ver auditoría",
    "Gestionar productos",
  ],
  admin_sucursal: [
    "Gestionar usuarios de su sucursal",
    "Gestionar productos y categorías",
    "Crear / anular ventas",
    "Ver auditoría de su sucursal",
  ],
  cajero: ["Registrar ventas", "Cobrar", "Consultar productos"],
  contador: ["Ver facturas", "Ver auditoría", "Generar reportes"],
};

function permisosDe(nombreRol) {
  return PERMISOS_POR_ROL[nombreRol] ?? [];
}

// Simula latencia de red para que el prototipo se sienta como una llamada real.
const wait = (ms = 400) => new Promise((res) => setTimeout(res, ms));

const api = {
  async listar() {
    await wait();
    return initialRoles;
  },
  async crear(payload) {
    await wait();
    return { id_rol: Date.now(), activo: true, ...payload };
  },
  async editar(id_rol, payload) {
    await wait();
    return { id_rol, ...payload };
  },
  async eliminar(id_rol, roles, usuarios) {
    await wait(250);
    const tieneUsuarios = usuarios.some((u) => u.rol_id === id_rol);
    if (tieneUsuarios) {
      const error = new Error(
        "No se puede eliminar el rol porque tiene usuarios asignados."
      );
      error.status = 409;
      throw error;
    }
    return true;
  },
};

// --- Estilos: tokens tomados literalmente del Acta de Colores y Tipografía --
const styles = `
@import url('https://fonts.googleapis.com/css2?family=Inter:wght@600;700&family=Roboto:wght@400;500&family=Roboto+Mono:wght@500&display=swap');

.roles-view {
  --sena-green: #39A900;
  --sena-green-dark: #2D8600;
  --ink: #1A1A1A;
  --bg: #F5F5F5;
  --white: #FFFFFF;
  --green-soft: #E8F5E0;
  --warning: #F59E0B;
  --danger: #EF4444;
  --info: #3B82F6;
  --text-secondary: #6B7280;
  --border: #E5E7EB;

  font-family: 'Roboto', sans-serif;
  background: var(--bg);
  color: var(--ink);
  min-height: 100%;
  padding: 28px 32px;
  box-sizing: border-box;
}
.roles-view * { box-sizing: border-box; }

.rv-breadcrumb { font-family: 'Roboto', sans-serif; font-size: 13px; color: var(--text-secondary); margin-bottom: 6px; }
.rv-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; gap: 16px; flex-wrap: wrap; }
.rv-title { font-family: 'Inter', sans-serif; font-weight: 700; font-size: 30px; margin: 0 0 6px 0; }
.rv-subtitle { font-family: 'Roboto', sans-serif; font-size: 14px; color: var(--text-secondary); margin: 0; max-width: 560px; line-height: 1.5; }

.btn { font-family: 'Roboto', sans-serif; font-weight: 500; font-size: 14px; border-radius: 8px; padding: 10px 18px; cursor: pointer; border: 1px solid transparent; display: inline-flex; align-items: center; gap: 8px; transition: background-color .15s ease, border-color .15s ease; white-space: nowrap; }
.btn:disabled { opacity: .55; cursor: not-allowed; }
.btn-primary { background: var(--sena-green); color: var(--white); }
.btn-primary:hover:not(:disabled) { background: var(--sena-green-dark); }
.btn-outline { background: var(--white); color: var(--ink); border-color: var(--border); }
.btn-outline:hover:not(:disabled) { border-color: var(--sena-green); color: var(--sena-green-dark); }
.btn-danger-ghost { background: var(--white); color: var(--danger); border-color: var(--border); }
.btn-danger-ghost:hover:not(:disabled) { border-color: var(--danger); background: #FEF2F2; }
.btn-danger { background: var(--danger); color: var(--white); }
.btn-danger:hover:not(:disabled) { background: #DC2626; }
.btn-sm { padding: 7px 12px; font-size: 13px; }

.rv-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }
.rv-stat-card { background: var(--white); border: 1px solid var(--border); border-radius: 12px; padding: 18px 20px; }
.rv-stat-label { font-family: 'Roboto', sans-serif; font-size: 13px; color: var(--text-secondary); margin-bottom: 8px; }
.rv-stat-value { font-family: 'Roboto Mono', monospace; font-weight: 500; font-size: 28px; line-height: 1; }
.rv-stat-note { font-family: 'Roboto', sans-serif; font-size: 12px; color: var(--text-secondary); margin-top: 6px; }

.rv-role-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-bottom: 28px; }
.rv-role-card { background: var(--white); border: 1px solid var(--border); border-radius: 12px; padding: 20px; display: flex; flex-direction: column; gap: 14px; }
.rv-role-card-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
.rv-role-icon { width: 38px; height: 38px; border-radius: 9px; background: var(--green-soft); color: var(--sena-green-dark); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.rv-role-name { font-family: 'Inter', sans-serif; font-weight: 700; font-size: 16px; margin: 0 0 4px 0; text-transform: none; }
.rv-role-desc { font-family: 'Roboto', sans-serif; font-size: 13px; color: var(--text-secondary); line-height: 1.45; margin: 0; }

.badge { font-family: 'Roboto', sans-serif; font-size: 12px; font-weight: 500; padding: 3px 10px; border-radius: 999px; white-space: nowrap; }
.badge-success { background: var(--green-soft); color: var(--sena-green-dark); }
.badge-neutral { background: #F3F4F6; color: var(--text-secondary); }

.rv-role-metrics { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 12px 0; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.rv-metric-value { font-family: 'Roboto Mono', monospace; font-weight: 500; font-size: 16px; }
.rv-metric-label { font-family: 'Roboto', sans-serif; font-size: 11px; color: var(--text-secondary); margin-top: 2px; }

.rv-perm-title { font-family: 'Roboto', sans-serif; font-size: 11px; font-weight: 500; color: var(--text-secondary); text-transform: uppercase; letter-spacing: .04em; margin-bottom: 8px; }
.rv-perm-list { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 10px; list-style: none; margin: 0; padding: 0; }
.rv-perm-item { font-family: 'Roboto', sans-serif; font-size: 12.5px; color: var(--ink); display: flex; align-items: center; gap: 6px; }
.rv-perm-dot { width: 5px; height: 5px; border-radius: 50%; background: var(--sena-green); flex-shrink: 0; }
.rv-perm-empty { font-family: 'Roboto', sans-serif; font-size: 12.5px; color: var(--warning); display: flex; align-items: center; gap: 6px; }

.rv-role-actions { display: flex; gap: 8px; margin-top: auto; }

.rv-section-title { font-family: 'Inter', sans-serif; font-weight: 700; font-size: 18px; margin: 0 0 4px 0; }
.rv-section-sub { font-family: 'Roboto', sans-serif; font-size: 13px; color: var(--text-secondary); margin: 0 0 14px 0; }

.rv-table-card { background: var(--white); border: 1px solid var(--border); border-radius: 12px; overflow: hidden; }
table.rv-table { width: 100%; border-collapse: collapse; }
.rv-table thead th { text-align: left; font-family: 'Roboto', sans-serif; font-weight: 500; font-size: 12px; color: var(--text-secondary); text-transform: uppercase; letter-spacing: .03em; padding: 12px 20px; background: #FAFAFA; border-bottom: 1px solid var(--border); }
.rv-table tbody td { padding: 13px 20px; font-family: 'Roboto', sans-serif; font-size: 13.5px; border-bottom: 1px solid var(--border); }
.rv-table tbody tr:last-child td { border-bottom: none; }
.rv-table tbody tr:hover { background: #FAFAFA; }
.rv-email-link { color: var(--info); text-decoration: underline; }
.rv-empty-row td { text-align: center; padding: 32px; color: var(--text-secondary); font-family: 'Roboto', sans-serif; font-size: 13px; }

.rv-overlay { position: fixed; inset: 0; background: rgba(26,26,26,.45); display: flex; align-items: center; justify-content: center; z-index: 50; padding: 20px; }
.rv-modal { background: var(--white); border-radius: 14px; width: 100%; max-width: 460px; padding: 24px; max-height: 88vh; overflow-y: auto; }
.rv-modal-wide { max-width: 560px; }
.rv-modal-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 18px; }
.rv-modal-title { font-family: 'Inter', sans-serif; font-weight: 700; font-size: 18px; margin: 0; }
.rv-modal-close { background: none; border: none; cursor: pointer; color: var(--text-secondary); padding: 4px; border-radius: 6px; }
.rv-modal-close:hover { background: #F3F4F6; }

.rv-field { margin-bottom: 16px; }
.rv-label { display: block; font-family: 'Roboto', sans-serif; font-size: 13px; font-weight: 500; margin-bottom: 6px; }
.rv-input, .rv-textarea { width: 100%; font-family: 'Roboto', sans-serif; font-size: 14px; padding: 10px 12px; border: 1px solid var(--border); border-radius: 8px; outline: none; }
.rv-input:focus, .rv-textarea:focus { border-color: var(--sena-green); box-shadow: 0 0 0 3px var(--green-soft); }
.rv-textarea { resize: vertical; min-height: 72px; font-family: 'Roboto', sans-serif; }
.rv-help { font-family: 'Roboto', sans-serif; font-size: 12px; color: var(--text-secondary); margin-top: 5px; line-height: 1.4; }
.rv-checkbox-row { display: flex; align-items: center; gap: 8px; }

.rv-alert { display: flex; gap: 10px; padding: 12px 14px; border-radius: 8px; font-family: 'Roboto', sans-serif; font-size: 13px; line-height: 1.5; margin-bottom: 16px; }
.rv-alert-warning { background: #FFFBEB; color: #92400E; border: 1px solid #FDE68A; }
.rv-alert-danger { background: #FEF2F2; color: #991B1B; border: 1px solid #FECACA; }
.rv-alert-info { background: #EFF6FF; color: #1E40AF; border: 1px solid #BFDBFE; }

.rv-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 20px; }

.rv-user-mini { display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border); }
.rv-user-mini:last-child { border-bottom: none; }
.rv-user-mini-name { font-family: 'Roboto', sans-serif; font-size: 13.5px; font-weight: 500; }
.rv-user-mini-email { font-family: 'Roboto', sans-serif; font-size: 12px; color: var(--text-secondary); }
`;

function Badge({ children, tone = "neutral" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function StatCard({ label, value, note }) {
  return (
    <div className="rv-stat-card">
      <div className="rv-stat-label">{label}</div>
      <div className="rv-stat-value">{value}</div>
      {note && <div className="rv-stat-note">{note}</div>}
    </div>
  );
}

function RoleCard({ role, usuariosDelRol, onEdit, onDelete, onVerUsuarios }) {
  const permisos = permisosDe(role.nombre);
  return (
    <div className="rv-role-card">
      <div className="rv-role-card-top">
        <div style={{ display: "flex", gap: 12 }}>
          <div className="rv-role-icon">
            <Shield size={18} />
          </div>
          <div>
            <p className="rv-role-name">{role.nombre}</p>
            <p className="rv-role-desc">{role.descripcion}</p>
          </div>
        </div>
        <Badge tone={role.activo ? "success" : "neutral"}>
          {role.activo ? "Activo" : "Inactivo"}
        </Badge>
      </div>

      <div className="rv-role-metrics">
        <div>
          <div className="rv-metric-value">{usuariosDelRol.length}</div>
          <div className="rv-metric-label">Usuarios asignados</div>
        </div>
        <div>
          <div className="rv-metric-value">{permisos.length}</div>
          <div className="rv-metric-label">Permisos definidos</div>
        </div>
      </div>

      <div>
        <div className="rv-perm-title">Permisos principales</div>
        {permisos.length > 0 ? (
          <ul className="rv-perm-list">
            {permisos.map((p) => (
              <li key={p} className="rv-perm-item">
                <span className="rv-perm-dot" />
                {p}
              </li>
            ))}
          </ul>
        ) : (
          <div className="rv-perm-empty">
            <AlertTriangle size={13} />
            Sin permisos definidos en las Policies del backend
          </div>
        )}
      </div>

      <div className="rv-role-actions">
        <button className="btn btn-outline btn-sm" onClick={() => onEdit(role)}>
          <Pencil size={14} /> Editar
        </button>
        <button
          className="btn btn-outline btn-sm"
          onClick={() => onVerUsuarios(role)}
        >
          <Eye size={14} /> Ver usuarios
        </button>
        <button
          className="btn btn-danger-ghost btn-sm"
          onClick={() => onDelete(role)}
          style={{ marginLeft: "auto" }}
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}

function RoleFormModal({ initial, onCancel, onSubmit, saving }) {
  const isEdit = Boolean(initial);
  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? "");
  const [activo, setActivo] = useState(initial?.activo ?? true);
  const [touched, setTouched] = useState(false);

  const nombreValido = /^[a-z][a-z_]{2,29}$/.test(nombre.trim());
  const esRolConocido = Boolean(PERMISOS_POR_ROL[nombre.trim()]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!nombreValido || !descripcion.trim()) return;
    onSubmit({ nombre: nombre.trim(), descripcion: descripcion.trim(), activo });
  };

  return (
    <div className="rv-overlay" onMouseDown={onCancel}>
      <form
        className="rv-modal"
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={handleSubmit}
      >
        <div className="rv-modal-header">
          <h3 className="rv-modal-title">
            {isEdit ? "Editar rol" : "Nuevo rol"}
          </h3>
          <button type="button" className="rv-modal-close" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>

        <div className="rv-field">
          <label className="rv-label">Nombre del rol</label>
          <input
            className="rv-input"
            placeholder="ej. admin_sucursal"
            value={nombre}
            disabled={isEdit}
            onChange={(e) => setNombre(e.target.value.trim().toLowerCase())}
          />
          {touched && !nombreValido && (
            <p className="rv-help" style={{ color: "var(--danger)" }}>
              Usa minúsculas y guiones bajos, sin espacios (ej. admin_sucursal).
            </p>
          )}
          {!isEdit && nombreValido && !esRolConocido && (
            <p className="rv-help" style={{ color: "var(--warning)" }}>
              Este nombre no coincide con ningún rol conocido por las Policies
              del backend. El rol se creará, pero no tendrá permisos reales
              hasta que se actualicen las Policies para reconocerlo.
            </p>
          )}
        </div>

        <div className="rv-field">
          <label className="rv-label">Descripción</label>
          <textarea
            className="rv-textarea"
            placeholder="Describe brevemente qué puede hacer este rol"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
          {touched && !descripcion.trim() && (
            <p className="rv-help" style={{ color: "var(--danger)" }}>
              La descripción es obligatoria.
            </p>
          )}
        </div>

        <div className="rv-field">
          <div className="rv-checkbox-row">
            <input
              type="checkbox"
              id="rv-activo"
              checked={activo}
              onChange={(e) => setActivo(e.target.checked)}
            />
            <label htmlFor="rv-activo" className="rv-label" style={{ margin: 0 }}>
              Rol activo
            </label>
          </div>
        </div>

        <div className="rv-modal-actions">
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear rol"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ConfirmDeleteModal({ role, onCancel, onConfirm, deleting, error }) {
  return (
    <div className="rv-overlay" onMouseDown={onCancel}>
      <div className="rv-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="rv-modal-header">
          <h3 className="rv-modal-title">Eliminar rol</h3>
          <button className="rv-modal-close" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>

        <p style={{ fontFamily: "'Roboto', sans-serif", fontSize: 14, lineHeight: 1.5 }}>
          ¿Seguro que quieres eliminar el rol{" "}
          <strong style={{ fontFamily: "'Roboto Mono', monospace" }}>
            {role.nombre}
          </strong>
          ? Esta acción no se puede deshacer.
        </p>

        {error && (
          <div className="rv-alert rv-alert-danger">
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}

        <div className="rv-modal-actions">
          <button className="btn btn-outline" onClick={onCancel}>
            Cancelar
          </button>
          <button
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={deleting}
          >
            {deleting ? "Eliminando..." : "Eliminar rol"}
          </button>
        </div>
      </div>
    </div>
  );
}

function UsersByRoleModal({ role, usuarios, onClose }) {
  return (
    <div className="rv-overlay" onMouseDown={onClose}>
      <div
        className="rv-modal rv-modal-wide"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="rv-modal-header">
          <div>
            <h3 className="rv-modal-title">Usuarios con rol {role.nombre}</h3>
            <p className="rv-help" style={{ marginTop: 4 }}>
              {usuarios.length} usuario{usuarios.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button className="rv-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {usuarios.length === 0 ? (
          <p style={{ fontFamily: "'Roboto', sans-serif", fontSize: 13, color: "var(--text-secondary)" }}>
            Ningún usuario tiene asignado este rol todavía.
          </p>
        ) : (
          usuarios.map((u) => (
            <div className="rv-user-mini" key={u.id_usuario}>
              <div>
                <div className="rv-user-mini-name">{u.nombre}</div>
                <div className="rv-user-mini-email">{u.email} · {u.sucursal}</div>
              </div>
              <Badge tone={u.activo ? "success" : "neutral"}>
                {u.activo ? "Activo" : "Inactivo"}
              </Badge>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default function RolesView() {
  const [roles, setRoles] = useState(initialRoles);
  const [usuarios] = useState(initialUsuarios);

  const [formModal, setFormModal] = useState(null); // null | { mode: 'create' } | { mode:'edit', role }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [usersModalRole, setUsersModalRole] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);

  const usuariosPorRol = useMemo(() => {
    const map = {};
    roles.forEach((r) => {
      map[r.id_rol] = usuarios.filter((u) => u.rol_id === r.id_rol);
    });
    return map;
  }, [roles, usuarios]);

  const stats = useMemo(() => {
    const activos = roles.filter((r) => r.activo).length;
    const sinRol = usuarios.filter((u) => !u.rol_id).length;
    return {
      total: roles.length,
      activos,
      inactivos: roles.length - activos,
      usuariosAsignados: usuarios.length,
      sinRol,
    };
  }, [roles, usuarios]);

  function showToast(message) {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleCreateOrEdit(payload) {
    setSaving(true);
    try {
      if (formModal.mode === "edit") {
        const actualizado = await api.editar(formModal.role.id_rol, payload);
        setRoles((prev) =>
          prev.map((r) => (r.id_rol === actualizado.id_rol ? { ...r, ...actualizado } : r))
        );
        showToast("Rol actualizado correctamente.");
      } else {
        const creado = await api.crear(payload);
        setRoles((prev) => [...prev, creado]);
        showToast("Rol creado correctamente.");
      }
      setFormModal(null);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.eliminar(deleteTarget.id_rol, roles, usuarios);
      setRoles((prev) => prev.filter((r) => r.id_rol !== deleteTarget.id_rol));
      setDeleteTarget(null);
      showToast("Rol eliminado.");
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="roles-view">
      <style>{styles}</style>

      <div className="rv-breadcrumb">› Roles</div>
      <div className="rv-header">
        <div>
          <h1 className="rv-title">Roles</h1>
          <p className="rv-subtitle">
            Define los roles del sistema y los permisos asociados a cada uno.
          </p>
        </div>
        <button
          className="btn btn-primary"
          onClick={() => setFormModal({ mode: "create" })}
        >
          <Plus size={16} /> Nuevo rol
        </button>
      </div>

      <div className="rv-stats">
        <StatCard
          label="Roles configurados"
          value={stats.total}
          note={`${stats.activos} activos · ${stats.inactivos} inactivo${stats.inactivos !== 1 ? "s" : ""}`}
        />
        <StatCard
          label="Usuarios asignados"
          value={stats.usuariosAsignados}
          note="En todas las sucursales"
        />
        <StatCard
          label="Sin rol asignado"
          value={stats.sinRol}
          note={stats.sinRol === 0 ? "Todos los usuarios tienen rol" : "Requieren asignación"}
        />
      </div>

      <div className="rv-role-grid">
        {roles.map((role) => (
          <RoleCard
            key={role.id_rol}
            role={role}
            usuariosDelRol={usuariosPorRol[role.id_rol] ?? []}
            onEdit={(r) => setFormModal({ mode: "edit", role: r })}
            onDelete={(r) => {
              setDeleteTarget(r);
              setDeleteError(null);
            }}
            onVerUsuarios={(r) => setUsersModalRole(r)}
          />
        ))}
      </div>

      <div>
        <h2 className="rv-section-title">Usuarios y sus roles</h2>
        <p className="rv-section-sub">
          Vista de referencia. Para reasignar el rol de un usuario, hazlo
          desde el CRUD de Usuarios.
        </p>
        <div className="rv-table-card">
          <table className="rv-table">
            <thead>
              <tr>
                <th>Usuario</th>
                <th>Email</th>
                <th>Rol</th>
                <th>Sucursal</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.length === 0 ? (
                <tr className="rv-empty-row">
                  <td colSpan={5}>No hay usuarios registrados.</td>
                </tr>
              ) : (
                usuarios.map((u) => {
                  const rol = roles.find((r) => r.id_rol === u.rol_id);
                  return (
                    <tr key={u.id_usuario}>
                      <td>{u.nombre}</td>
                      <td>
                        <a className="rv-email-link" href={`mailto:${u.email}`}>
                          {u.email}
                        </a>
                      </td>
                      <td>
                        <Badge tone={rol ? "success" : "neutral"}>
                          {rol ? rol.nombre : "Sin rol"}
                        </Badge>
                      </td>
                      <td>{u.sucursal}</td>
                      <td>
                        <Badge tone={u.activo ? "success" : "neutral"}>
                          {u.activo ? "Activo" : "Inactivo"}
                        </Badge>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {formModal && (
        <RoleFormModal
          initial={formModal.mode === "edit" ? formModal.role : null}
          saving={saving}
          onCancel={() => setFormModal(null)}
          onSubmit={handleCreateOrEdit}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          role={deleteTarget}
          deleting={deleting}
          error={deleteError}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
        />
      )}

      {usersModalRole && (
        <UsersByRoleModal
          role={usersModalRole}
          usuarios={usuariosPorRol[usersModalRole.id_rol] ?? []}
          onClose={() => setUsersModalRole(null)}
        />
      )}

      {toast && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            right: 24,
            background: "var(--ink)",
            color: "var(--white)",
            padding: "12px 18px",
            borderRadius: 8,
            fontFamily: "'Roboto', sans-serif",
            fontSize: 13.5,
            display: "flex",
            alignItems: "center",
            gap: 8,
            boxShadow: "0 8px 24px rgba(0,0,0,.25)",
          }}
        >
          <Info size={15} />
          {toast}
        </div>
      )}
    </div>
  );
}
