import React, { useState, useEffect, useCallback, useMemo } from "react";
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
  Loader2,
} from "lucide-react";
import { api, ApiError } from "../services/apiClient";
import "../styles/RolesView.css";

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
 * La tabla "Usuarios y sus roles" reutiliza GET /api/usuarios, que ya viene
 * con las relaciones sucursal/rol cargadas (UsuarioController::index hace
 * ->with(['sucursal', 'rol'])), así que no hace falta resolver nombres a
 * mano como sí era necesario con los datos planos del mock.
 *
 * NOTA DE ARQUITECTURA:
 * El modelo Rol NO tiene columna de permisos. Los "permisos principales"
 * que se muestran aquí son de SOLO LECTURA y vienen de un mapa estático
 * (PERMISOS_POR_ROL) que documenta en el frontend lo que las Policies del
 * backend ya hacen por nombre de rol. Si se crea un rol con un nombre que
 * no está en ese mapa, el formulario avisa que no tendrá permisos reales
 * hasta que se actualicen las Policies en el backend.
 * ==========================================================================*/

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
};

function permisosDe(nombreRol) {
  return PERMISOS_POR_ROL[nombreRol] ?? [];
}


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
        <div className="rv-role-info">
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
          className="u-ml-auto"
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
            <p className="rv-help rv-help--danger">
              Usa minúsculas y guiones bajos, sin espacios (ej. admin_sucursal).
            </p>
          )}
          {!isEdit && nombreValido && !esRolConocido && (
            <p className="rv-help rv-help--warning">
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
            <p className="rv-help rv-help--danger">
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
            <label htmlFor="rv-activo" className="rv-label u-label-inline">
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

        <p className="u-confirm-text">
          ¿Seguro que quieres eliminar el rol{" "}
          <strong className="rv-mono">
            {role.nombre}
          </strong>
          ? Esta acción no se puede deshacer.
        </p>

        {error && (
          <div className="rv-alert rv-alert-danger">
            <AlertTriangle size={16} className="u-icon-inline" />
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
            <p className="rv-help u-mt-4">
              {usuarios.length} usuario{usuarios.length !== 1 ? "s" : ""}
            </p>
          </div>
          <button className="rv-modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {usuarios.length === 0 ? (
          <p className="rv-empty-text">
            Ningún usuario tiene asignado este rol todavía.
          </p>
        ) : (
          usuarios.map((u) => (
            <div className="rv-user-mini" key={u.id_usuario}>
              <div>
                <div className="rv-user-mini-name">{u.nombre}</div>
                <div className="rv-user-mini-sub">{u.sucursal?.nombre ?? "—"}</div>
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
  const [roles, setRoles] = useState([]);
  const [usuarios, setUsuarios] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);

  const [formModal, setFormModal] = useState(null); // null | { mode: 'create' } | { mode:'edit', role }
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [usersModalRole, setUsersModalRole] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const [rolesData, usuariosData] = await Promise.all([
        api.getAllPages("/roles"),
        api.getAllPages("/usuarios"),
      ]);
      setRoles(rolesData);
      setUsuarios(usuariosData);
    } catch (e) {
      setErrorCarga(e instanceof ApiError ? e.message : (e?.message ?? "No se pudieron cargar los roles."));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

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
        await api.put(`/roles/${formModal.role.id_rol}`, payload);
        showToast("Rol actualizado correctamente.");
      } else {
        await api.post("/roles", payload);
        showToast("Rol creado correctamente.");
      }
      await cargarDatos();
      setFormModal(null);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : (e?.message ?? "No se pudo guardar el rol."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/roles/${deleteTarget.id_rol}`);
      setDeleteTarget(null);
      showToast("Rol eliminado.");
      await cargarDatos();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "No se pudo eliminar el rol.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="roles-view">
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
        {cargando ? (
          <div className="u-loading-row">
            <Loader2 size={18} className="u-spin" /> Cargando roles...
          </div>
        ) : errorCarga ? (
          <div className="rv-alert rv-alert-danger">
            <AlertTriangle size={16} className="u-icon-inline" />
            <span>{errorCarga}</span>
          </div>
        ) : (
          roles.map((role) => (
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
          ))
        )}
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
                <th>Rol</th>
                <th>Sucursal</th>
                <th>Estado</th>
              </tr>
            </thead>
            <tbody>
              {usuarios.length === 0 ? (
                <tr className="rv-empty-row">
                  <td colSpan={4}>No hay usuarios registrados.</td>
                </tr>
              ) : (
                usuarios.map((u) => (
                  <tr key={u.id_usuario}>
                    <td>{u.nombre}</td>
                    <td>
                      <Badge tone={u.rol ? "success" : "neutral"}>
                        {u.rol ? u.rol.nombre : "Sin rol"}
                      </Badge>
                    </td>
                    <td>{u.sucursal?.nombre ?? "—"}</td>
                    <td>
                      <Badge tone={u.activo ? "success" : "neutral"}>
                        {u.activo ? "Activo" : "Inactivo"}
                      </Badge>
                    </td>
                  </tr>
                ))
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
        <div className="toast">
          <Info size={15} />
          {toast}
        </div>
      )}
    </div>
  );
}
