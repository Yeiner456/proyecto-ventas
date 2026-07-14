import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  UserPlus,
  Pencil,
  Trash2,
  X,
  Search,
  AlertTriangle,
  Info,
  Lock,
  Loader2,
} from "lucide-react";
import { useAuth, esAdminGeneral as actorEsAdminGeneral } from "../context/AuthContext";
import { api, ApiError } from "../services/apiClient";
import "../styles/UsuariosView.css";

/* ============================================================================
 * USUARIOS — Vista CRUD
 * ----------------------------------------------------------------------------
 * Contrato real (backend/routes/api.php):
 *   GET    /api/usuarios              -> listar (paginado, scoped por sucursal)
 *   POST   /api/usuarios              -> crear
 *   PUT    /api/usuarios/{id_usuario} -> editar
 *   DELETE /api/usuarios/{id_usuario} -> eliminar (409 si tiene ventas)
 *
 * Reglas de UsuarioPolicy replicadas aquí (ver backend/app/Policies/UsuarioPolicy.php):
 *   - admin_general: acceso total (before() bypass).
 *   - admin_sucursal: solo ve/crea/edita/elimina usuarios de SU sucursal.
 *   - cajero / contador: sin acceso (esta vista no debería ni ser
 *     alcanzable por ellos — el link ya está oculto en Sidebar, pero
 *     igual se valida aquí por si alguien navega directo a la URL).
 *   - Nadie puede eliminarse a sí mismo (UsuarioPolicy::delete).
 *
 * Regla adicional que impongo en el FRONTEND y que el backend NO valida
 * hoy (se lo señalo al usuario como mejora sugerida): sucursal_id debería
 * ser obligatorio para cualquier rol que no sea admin_general, y forzado
 * a null si el rol es admin_general. StoreUsuarioRequest solo valida
 * 'nullable', sin relacionar el campo con el rol elegido.
 *
 * NOTA: actor.sucursal (de AuthContext) es un NOMBRE, no un id — es una
 * limitación conocida y documentada en AuthContext.jsx. Por eso aquí se
 * resuelve el sucursal_id del actor buscando por nombre en la lista de
 * sucursales ya cargada, en vez de comparar ids directo.
 * ==========================================================================*/

// --- Reglas de permisos, espejo de UsuarioPolicy ---------------------------
function puedeGestionarUsuarios(actor) {
  return actorEsAdminGeneral(actor) || actor.rol === "admin_sucursal";
}

function usuarioVisibleParaActor(actor, usuario, sucursales) {
  if (actorEsAdminGeneral(actor)) return true;
  const sucursalActorId = sucursales.find((s) => s.nombre === actor.sucursal)?.id_sucursal;
  return usuario.sucursal_id === sucursalActorId;
}

function puedeEliminar(actor, usuario, actorIdUsuario, sucursales) {
  if (usuario.id_usuario === actorIdUsuario) return false; // nadie se elimina a sí mismo
  return usuarioVisibleParaActor(actor, usuario, sucursales);
}


function FieldWrap({ children }) {
  return <div className="field">{children}</div>;
}

function UserFormModal({ actor, initial, onCancel, onSubmit, saving, roles, sucursales }) {
  const isEdit = Boolean(initial);
  const admin = actorEsAdminGeneral(actor);
  const sucursalActorId = sucursales.find((s) => s.nombre === actor.sucursal)?.id_sucursal ?? null;

  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [rolId, setRolId] = useState(initial?.rol_id ?? "");
  const [sucursalId, setSucursalId] = useState(
    initial ? initial.sucursal_id : admin ? "" : sucursalActorId
  );
  const [password, setPassword] = useState("");
  const [activo, setActivo] = useState(initial?.activo ?? true);
  const [touched, setTouched] = useState(false);

  const rolSeleccionado = roles.find((r) => r.id_rol === Number(rolId));
  const esRolAdminGeneral = rolSeleccionado?.nombre === "admin_general";

  // Solo admin_general puede crear/dejar otro admin_general (sucursal null).
  // Si el actor no es admin_general, ese rol ni se lista como opción.
  const rolesDisponibles = admin
    ? roles.filter((r) => r.activo || r.id_rol === initial?.rol_id)
    : roles.filter((r) => r.nombre !== "admin_general" && (r.activo || r.id_rol === initial?.rol_id));

  const passwordValida = isEdit ? password === "" || password.length >= 8 : password.length >= 8;
  const sucursalRequerida = !esRolAdminGeneral;
  const sucursalValida = !sucursalRequerida || Boolean(sucursalId);

  const formValido = nombre.trim() && rolId && passwordValida && sucursalValida;

  function handleSubmit(e) {
    e.preventDefault();
    setTouched(true);
    if (!formValido) return;

    const payload = {
      nombre: nombre.trim(),
      rol_id: Number(rolId),
      sucursal_id: esRolAdminGeneral ? null : Number(sucursalId),
      activo,
    };
    if (password) payload.password = password;
    onSubmit(payload);
  }

  return (
    <div className="modal-overlay" onMouseDown={onCancel}>
      <form className="modal modal-wide" onMouseDown={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-header">
          <h3 className="modal-title">{isEdit ? "Editar usuario" : "Nuevo usuario"}</h3>
          <button type="button" className="modal-close" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>

        <FieldWrap>
          <label className="field-label">Nombre completo</label>
          <input className="field-input" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          {touched && !nombre.trim() && <p className="field-help error">El nombre es obligatorio.</p>}
        </FieldWrap>

        <div className="uv-form-grid-2">
          <FieldWrap>
            <label className="field-label">Rol</label>
            <select className="field-select" value={rolId} onChange={(e) => setRolId(e.target.value)}>
              <option value="">Selecciona un rol</option>
              {rolesDisponibles.map((r) => (
                <option key={r.id_rol} value={r.id_rol}>
                  {r.nombre}
                </option>
              ))}
            </select>
            {touched && !rolId && <p className="field-help error">Selecciona un rol.</p>}
            {!admin && (
              <p className="field-help">
                No ves "admin_general" en la lista: solo un admin_general puede asignar ese rol.
              </p>
            )}
          </FieldWrap>

          <FieldWrap>
            <label className="field-label">Sucursal</label>
            {esRolAdminGeneral ? (
              <div className="uv-lock-note">
                <Lock size={13} />
                No aplica — admin_general no pertenece a ninguna sucursal.
              </div>
            ) : admin ? (
              <select className="field-select" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)}>
                <option value="">Selecciona una sucursal</option>
                {sucursales.map((s) => (
                  <option key={s.id_sucursal} value={s.id_sucursal}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            ) : (
              <div className="uv-lock-note">
                <Lock size={13} />
                {actor.sucursal} (no puedes asignar usuarios a otra sucursal)
              </div>
            )}
            {touched && sucursalRequerida && !sucursalValida && (
              <p className="field-help error">Selecciona una sucursal.</p>
            )}
          </FieldWrap>
        </div>

        <FieldWrap>
          <label className="field-label">{isEdit ? "Nueva contraseña" : "Contraseña"}</label>
          <input
            className="field-input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={isEdit ? "Dejar en blanco para no cambiarla" : "Mínimo 8 caracteres"}
          />
          {touched && !passwordValida && (
            <p className="field-help error">La contraseña debe tener al menos 8 caracteres.</p>
          )}
        </FieldWrap>

        <FieldWrap>
          <div className="uv-checkbox-row">
            <input type="checkbox" id="uv-activo" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
            <label htmlFor="uv-activo" className="field-label u-label-inline">
              Usuario activo
            </label>
          </div>
        </FieldWrap>

        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear usuario"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ConfirmDeleteModal({ usuario, onCancel, onConfirm, deleting, error }) {
  return (
    <div className="modal-overlay" onMouseDown={onCancel}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Eliminar usuario</h3>
          <button className="modal-close" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        <p className="u-confirm-text">
          ¿Seguro que quieres eliminar a <strong>{usuario.nombre}</strong>? Esta acción no se puede deshacer.
        </p>
        {error && (
          <div className="alert alert-danger">
            <AlertTriangle size={16} className="u-icon-inline" />
            <span>{error}</span>
          </div>
        )}
        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onCancel}>
            Cancelar
          </button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={deleting}>
            {deleting ? "Eliminando..." : "Eliminar usuario"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function UsuariosView() {
  const { usuario: actor } = useAuth();
  const [usuarios, setUsuarios] = useState([]);
  const [roles, setRoles] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [formModal, setFormModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroRol, setFiltroRol] = useState("");

  const autorizado = puedeGestionarUsuarios(actor);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const [usuariosData, rolesData, sucursalesData] = await Promise.all([
        api.getAllPages("/usuarios"),
        api.getAllPages("/roles"),
        api.getAllPages("/sucursales"),
      ]);
      setUsuarios(usuariosData);
      setRoles(rolesData);
      setSucursales(sucursalesData);
    } catch (e) {
      setErrorCarga(e instanceof ApiError ? e.message : "No se pudieron cargar los usuarios.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (autorizado) cargarDatos();
  }, [autorizado, cargarDatos]);

  const visibles = useMemo(() => {
    return usuarios
      .filter((u) => usuarioVisibleParaActor(actor, u, sucursales))
      .filter((u) => !filtroRol || u.rol_id === Number(filtroRol))
      .filter((u) => !busqueda.trim() || u.nombre.toLowerCase().includes(busqueda.toLowerCase()));
  }, [usuarios, actor, sucursales, filtroRol, busqueda]);

  const stats = useMemo(() => {
    const base = usuarios.filter((u) => usuarioVisibleParaActor(actor, u, sucursales));
    return {
      total: base.length,
      activos: base.filter((u) => u.activo).length,
      inactivos: base.filter((u) => !u.activo).length,
    };
  }, [usuarios, actor, sucursales]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSubmit(payload) {
    setSaving(true);
    try {
      if (formModal.mode === "edit") {
        await api.put(`/usuarios/${formModal.usuario.id_usuario}`, payload);
        showToast("Usuario actualizado correctamente.");
      } else {
        await api.post("/usuarios", payload);
        showToast("Usuario creado correctamente.");
      }
      await cargarDatos();
      setFormModal(null);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "No se pudo guardar el usuario.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/usuarios/${deleteTarget.id_usuario}`);
      setDeleteTarget(null);
      showToast("Usuario eliminado.");
      await cargarDatos();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "No se pudo eliminar el usuario.");
    } finally {
      setDeleting(false);
    }
  }

  if (!autorizado) {
    return (
      <div>
        <div className="breadcrumb">› Usuarios</div>
        <h1 className="page-title">Usuarios</h1>
        <div className="alert alert-danger u-max-480">
          <AlertTriangle size={16} className="u-icon-inline" />
          <span>No tienes permisos para gestionar usuarios (UsuarioPolicy::viewAny).</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="breadcrumb">› Usuarios</div>
      <div className="uv-header">
        <div>
          <h1 className="page-title">Usuarios</h1>
          <p className="uv-subtitle">
            {actorEsAdminGeneral(actor)
              ? "Gestiona los usuarios de todas las sucursales."
              : `Gestiona los usuarios de ${actor.sucursal}.`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setFormModal({ mode: "create" })}>
          <UserPlus size={16} /> Nuevo usuario
        </button>
      </div>

      <div className="uv-stats">
        <div className="stat-card">
          <div className="stat-label">Usuarios</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Activos</div>
          <div className="stat-value">{stats.activos}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Inactivos</div>
          <div className="stat-value">{stats.inactivos}</div>
        </div>
      </div>

      <div className="uv-toolbar">
        <div className="uv-search">
          <Search size={15} />
          <input
            className="field-input"
            placeholder="Buscar por nombre..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <select
          className="field-select uv-select"
          value={filtroRol}
          onChange={(e) => setFiltroRol(e.target.value)}
        >
          <option value="">Todos los roles</option>
          {roles.map((r) => (
            <option key={r.id_rol} value={r.id_rol}>
              {r.nombre}
            </option>
          ))}
        </select>
      </div>

      <div className="data-table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Rol</th>
              <th>Sucursal</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr className="empty-row">
                <td colSpan={5}>
                  <div className="u-loading-row">
                    <Loader2 size={18} className="u-spin" /> Cargando usuarios...
                  </div>
                </td>
              </tr>
            ) : errorCarga ? (
              <tr className="empty-row">
                <td colSpan={5}>
                  <div className="alert alert-danger u-max-480">
                    <AlertTriangle size={16} className="u-icon-inline" />
                    <span>{errorCarga}</span>
                  </div>
                </td>
              </tr>
            ) : visibles.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={5}>No hay usuarios que coincidan con el filtro.</td>
              </tr>
            ) : (
              visibles.map((u) => (
                <tr key={u.id_usuario}>
                  <td>
                    <div className="uv-name-cell">
                      {u.nombre}
                      {u.id_usuario === actor.id_usuario && <span className="uv-you-tag">Tú</span>}
                    </div>
                  </td>
                  <td>
                    <span className="badge badge-neutral">{u.rol?.nombre ?? "—"}</span>
                  </td>
                  <td>{u.sucursal?.nombre ?? "—"}</td>
                  <td>
                    <span className={`badge ${u.activo ? "badge-success" : "badge-neutral"}`}>
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td>
                    <div className="uv-row-actions">
                      <button
                        className="btn btn-outline btn-sm"
                        onClick={() => setFormModal({ mode: "edit", usuario: u })}
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        className="btn btn-danger-ghost btn-sm"
                        disabled={!puedeEliminar(actor, u, actor.id_usuario, sucursales)}
                        title={
                          u.id_usuario === actor.id_usuario
                            ? "No puedes eliminar tu propio usuario"
                            : "Eliminar"
                        }
                        onClick={() => {
                          setDeleteTarget(u);
                          setDeleteError(null);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {formModal && (
        <UserFormModal
          actor={actor}
          initial={formModal.mode === "edit" ? formModal.usuario : null}
          saving={saving}
          roles={roles}
          sucursales={sucursales}
          onCancel={() => setFormModal(null)}
          onSubmit={handleSubmit}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          usuario={deleteTarget}
          deleting={deleting}
          error={deleteError}
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleDelete}
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
