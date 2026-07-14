import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Building2,
  Plus,
  Pencil,
  Trash2,
  X,
  AlertTriangle,
  Info,
  Lock,
  Phone,
  Mail,
  MapPin,
  Loader2,
} from "lucide-react";
import { useAuth, esAdminGeneral as actorEsAdminGeneral } from "../context/AuthContext";
import { api, ApiError } from "../services/apiClient";
import "../styles/SucursalesView.css";

/* ============================================================================
 * SUCURSALES — Vista CRUD
 * ----------------------------------------------------------------------------
 * Contrato real (backend/routes/api.php):
 *   GET    /api/sucursales              -> listar
 *   POST   /api/sucursales              -> crear
 *   PUT    /api/sucursales/{id_sucursal}-> editar
 *   DELETE /api/sucursales/{id_sucursal}-> eliminar (409 si tiene datos asociados)
 *
 * SucursalPolicy (ver backend/app/Policies/SucursalPolicy.php):
 *   - viewAny/view -> TRUE para cualquier usuario autenticado (las
 *     necesitan para selects, p.ej. al crear un usuario).
 *   - create/update/delete -> false explícito; solo admin_general puede
 *     (vía before()).
 * Por eso esta vista NO se bloquea por completo para otros roles como en
 * UsuariosView — se degrada a solo lectura, que es lo que la Policy
 * realmente permite. La Sidebar ya la oculta para no-admin_general, pero
 * si alguien llega por URL directa, ve la lista sin poder mutarla.
 * ==========================================================================*/


function SucursalCard({ sucursal, puedeEditar, onEdit, onDelete }) {
  return (
    <div className="sv-card">
      <div className="sv-card-top">
        <div className="sv-card-info">
          <div className="sv-icon">
            <Building2 size={18} />
          </div>
          <p className="sv-name">{sucursal.nombre}</p>
        </div>
        <span className={`badge ${sucursal.activa ? "badge-success" : "badge-neutral"}`}>
          {sucursal.activa ? "Activa" : "Inactiva"}
        </span>
      </div>

      <div className="sv-meta">
        {sucursal.direccion && (
          <div className="sv-meta-row">
            <MapPin size={13} /> {sucursal.direccion}
          </div>
        )}
        {sucursal.telefono && (
          <div className="sv-meta-row">
            <Phone size={13} /> {sucursal.telefono}
          </div>
        )}
        {sucursal.email && (
          <div className="sv-meta-row">
            <Mail size={13} /> {sucursal.email}
          </div>
        )}
      </div>

      {puedeEditar ? (
        <div className="sv-actions">
          <button className="btn btn-outline btn-sm" onClick={() => onEdit(sucursal)}>
            <Pencil size={14} /> Editar
          </button>
          <button
            className="btn btn-danger-ghost btn-sm"
            onClick={() => onDelete(sucursal)}
            className="u-ml-auto"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ) : (
        <div className="sv-readonly-note">
          <Lock size={12} /> Solo admin_general puede editar sucursales
        </div>
      )}
    </div>
  );
}

function SucursalFormModal({ initial, onCancel, onSubmit, saving, existentes }) {
  const isEdit = Boolean(initial);
  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [direccion, setDireccion] = useState(initial?.direccion ?? "");
  const [telefono, setTelefono] = useState(initial?.telefono ?? "");
  const [email, setEmail] = useState(initial?.email ?? "");
  const [activa, setActiva] = useState(initial?.activa ?? true);
  const [touched, setTouched] = useState(false);

  const nombreValido = nombre.trim().length >= 3;
  const nombreDuplicado = existentes.some(
    (s) => s.nombre.toLowerCase() === nombre.trim().toLowerCase() && s.id_sucursal !== initial?.id_sucursal
  );
  const emailValido = email.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const formValido = nombreValido && !nombreDuplicado && emailValido;

  function handleSubmit(e) {
    e.preventDefault();
    setTouched(true);
    if (!formValido) return;
    onSubmit({
      nombre: nombre.trim(),
      direccion: direccion.trim() || null,
      telefono: telefono.trim() || null,
      email: email.trim() || null,
      activa,
    });
  }

  return (
    <div className="modal-overlay" onMouseDown={onCancel}>
      <form className="modal modal-wide" onMouseDown={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-header">
          <h3 className="modal-title">{isEdit ? "Editar sucursal" : "Nueva sucursal"}</h3>
          <button type="button" className="modal-close" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>

        <div className="field">
          <label className="field-label">Nombre</label>
          <input className="field-input" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          {touched && !nombreValido && <p className="field-help error">El nombre debe tener al menos 3 caracteres.</p>}
          {touched && nombreValido && nombreDuplicado && (
            <p className="field-help error">Ya existe una sucursal con ese nombre.</p>
          )}
        </div>

        <div className="sv-form-grid-2">
          <div className="field">
            <label className="field-label">Teléfono</label>
            <input className="field-input" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label">Email</label>
            <input className="field-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            {touched && !emailValido && <p className="field-help error">Ingresa un email válido.</p>}
          </div>
        </div>

        <div className="field">
          <label className="field-label">Dirección</label>
          <input className="field-input" value={direccion} onChange={(e) => setDireccion(e.target.value)} />
        </div>

        <div className="field">
          <div className="sv-checkbox-row">
            <input type="checkbox" id="sv-activa" checked={activa} onChange={(e) => setActiva(e.target.checked)} />
            <label htmlFor="sv-activa" className="field-label u-label-inline">
              Sucursal activa
            </label>
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear sucursal"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ConfirmDeleteModal({ sucursal, onCancel, onConfirm, deleting, error }) {
  return (
    <div className="modal-overlay" onMouseDown={onCancel}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Eliminar sucursal</h3>
          <button className="modal-close" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        <p className="u-confirm-text">
          ¿Seguro que quieres eliminar <strong>{sucursal.nombre}</strong>? Esta acción no se puede deshacer.
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
            {deleting ? "Eliminando..." : "Eliminar sucursal"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function SucursalesView() {
  const { usuario: actor } = useAuth();
  const puedeEditar = actorEsAdminGeneral(actor);

  const [sucursales, setSucursales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [formModal, setFormModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);

  const cargarSucursales = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const data = await api.getAllPages("/sucursales");
      setSucursales(data);
    } catch (e) {
      setErrorCarga(e instanceof ApiError ? e.message : "No se pudieron cargar las sucursales.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarSucursales();
  }, [cargarSucursales]);

  const stats = useMemo(
    () => ({
      total: sucursales.length,
      activas: sucursales.filter((s) => s.activa).length,
      inactivas: sucursales.filter((s) => !s.activa).length,
    }),
    [sucursales]
  );

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSubmit(payload) {
    setSaving(true);
    try {
      if (formModal.mode === "edit") {
        await api.put(`/sucursales/${formModal.sucursal.id_sucursal}`, payload);
        showToast("Sucursal actualizada correctamente.");
      } else {
        await api.post("/sucursales", payload);
        showToast("Sucursal creada correctamente.");
      }
      await cargarSucursales();
      setFormModal(null);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "No se pudo guardar la sucursal.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/sucursales/${deleteTarget.id_sucursal}`);
      setDeleteTarget(null);
      showToast("Sucursal eliminada.");
      await cargarSucursales();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "No se pudo eliminar la sucursal.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="breadcrumb">› Sucursales</div>
      <div className="sv-header">
        <div>
          <h1 className="page-title">Sucursales</h1>
          <p className="sv-subtitle">
            {puedeEditar
              ? "Administra las sedes del sistema."
              : "Consulta las sedes del sistema. Solo admin_general puede crear, editar o eliminar sucursales."}
          </p>
        </div>
        {puedeEditar && (
          <button className="btn btn-primary" onClick={() => setFormModal({ mode: "create" })}>
            <Plus size={16} /> Nueva sucursal
          </button>
        )}
      </div>

      <div className="sv-stats">
        <div className="stat-card">
          <div className="stat-label">Sucursales</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Activas</div>
          <div className="stat-value">{stats.activas}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Inactivas</div>
          <div className="stat-value">{stats.inactivas}</div>
        </div>
      </div>

      <div className="sv-grid">
        {cargando ? (
          <div className="u-loading-row">
            <Loader2 size={18} className="u-spin" /> Cargando sucursales...
          </div>
        ) : errorCarga ? (
          <div className="alert alert-danger u-max-480">
            <AlertTriangle size={16} className="u-icon-inline" />
            <span>{errorCarga}</span>
          </div>
        ) : sucursales.length === 0 ? (
          <p className="sv-subtitle">No hay sucursales registradas todavía.</p>
        ) : (
          sucursales.map((s) => (
            <SucursalCard
              key={s.id_sucursal}
              sucursal={s}
              puedeEditar={puedeEditar}
              onEdit={(s) => setFormModal({ mode: "edit", sucursal: s })}
              onDelete={(s) => {
                setDeleteTarget(s);
                setDeleteError(null);
              }}
            />
          ))
        )}
      </div>

      {formModal && (
        <SucursalFormModal
          initial={formModal.mode === "edit" ? formModal.sucursal : null}
          saving={saving}
          existentes={sucursales}
          onCancel={() => setFormModal(null)}
          onSubmit={handleSubmit}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          sucursal={deleteTarget}
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
