import React, { useState, useEffect, useCallback } from "react";
import { CreditCard, Plus, Pencil, Trash2, X, AlertTriangle, Info, Lock, Star, Loader2 } from "lucide-react";
import { useAuth, esAdminGeneral as actorEsAdminGeneral } from "../context/AuthContext";
import { api, ApiError } from "../services/apiClient";
import "../styles/MetodosPagoView.css";

/* ============================================================================
 * MÉTODOS DE PAGO — Vista CRUD
 * ----------------------------------------------------------------------------
 * MetodoPagoPolicy: viewAny/view = true para todos (el cajero los necesita
 * para cobrar); create/update/delete = false explícito, solo admin_general
 * (before()). Mismo patrón de degradación a solo-lectura que SucursalesView,
 * no bloqueo total como en UsuariosView — la Policy en sí ya lo permite así.
 *
 * Regla de negocio replicada del controlador: es_default es EXCLUSIVO.
 * Marcar uno como predeterminado desmarca automáticamente los demás
 * (MetodoPagoController::store()/update()) — el backend ya lo hace, por
 * eso tras guardar simplemente se recarga la lista completa en vez de
 * intentar replicar ese desmarcado a mano en el frontend.
 *
 * OJO: MetodoPagoController::index() usa ->get(), NO ->paginate() (a
 * diferencia de casi todos los demás listados) — la respuesta es un
 * array plano, no { data, meta }. Por eso aquí se usa api.get() directo
 * y NO api.getAllPages().
 * ==========================================================================*/

function FormModal({ initial, onCancel, onSubmit, saving, existentes }) {
  const isEdit = Boolean(initial);
  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [esDefault, setEsDefault] = useState(initial?.es_default ?? false);
  const [requiereComp, setRequiereComp] = useState(initial?.requiere_comp ?? false);
  const [activo, setActivo] = useState(initial?.activo ?? true);
  const [touched, setTouched] = useState(false);

  const nombreValido = nombre.trim().length >= 2;
  const duplicado = existentes.some(
    (m) => m.nombre.toLowerCase() === nombre.trim().toLowerCase() && m.id_metodo_pago !== initial?.id_metodo_pago
  );
  const formValido = nombreValido && !duplicado;

  function handleSubmit(e) {
    e.preventDefault();
    setTouched(true);
    if (!formValido) return;
    onSubmit({ nombre: nombre.trim(), es_default: esDefault, requiere_comp: requiereComp, activo });
  }

  return (
    <div className="modal-overlay" onMouseDown={onCancel}>
      <form className="modal" onMouseDown={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-header">
          <h3 className="modal-title">{isEdit ? "Editar método de pago" : "Nuevo método de pago"}</h3>
          <button type="button" className="modal-close" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>

        <div className="field">
          <label className="field-label">Nombre</label>
          <input className="field-input" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          {touched && !nombreValido && <p className="field-help error">Mínimo 2 caracteres.</p>}
          {touched && duplicado && <p className="field-help error">Ya existe un método con ese nombre.</p>}
        </div>

        <div className="field">
          <div className="u-flex-gap-8">
            <input type="checkbox" id="mp-default" checked={esDefault} onChange={(e) => setEsDefault(e.target.checked)} />
            <label htmlFor="mp-default" className="field-label u-label-inline">
              Método predeterminado
            </label>
          </div>
          <p className="field-help">Solo puede haber uno. Si marcas este, se desmarca el que era predeterminado antes.</p>
        </div>

        <div className="field">
          <div className="u-flex-gap-8">
            <input type="checkbox" id="mp-comp" checked={requiereComp} onChange={(e) => setRequiereComp(e.target.checked)} />
            <label htmlFor="mp-comp" className="field-label u-label-inline">
              Requiere comprobante de pago
            </label>
          </div>
        </div>

        <div className="field">
          <div className="u-flex-gap-8">
            <input type="checkbox" id="mp-activo" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
            <label htmlFor="mp-activo" className="field-label u-label-inline">
              Activo
            </label>
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onCancel}>Cancelar</button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear método"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ConfirmDeleteModal({ metodo, onCancel, onConfirm, deleting, error }) {
  return (
    <div className="modal-overlay" onMouseDown={onCancel}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Eliminar método de pago</h3>
          <button className="modal-close" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        <p className="u-confirm-text">
          ¿Seguro que quieres eliminar <strong>{metodo.nombre}</strong>?
        </p>
        {error && (
          <div className="alert alert-danger">
            <AlertTriangle size={16} className="u-icon-inline" />
            <span>{error}</span>
          </div>
        )}
        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onCancel}>Cancelar</button>
          <button className="btn btn-danger" disabled={deleting} onClick={onConfirm}>
            {deleting ? "Eliminando..." : "Eliminar"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MetodosPagoView() {
  const { usuario: actor } = useAuth();
  const puedeEditar = actorEsAdminGeneral(actor);

  const [metodos, setMetodos] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [formModal, setFormModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);

  const cargarMetodos = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const data = await api.get("/metodos-pago");
      setMetodos(data);
    } catch (e) {
      setErrorCarga(e instanceof ApiError ? e.message : "No se pudieron cargar los métodos de pago.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarMetodos();
  }, [cargarMetodos]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSubmit(payload) {
    setSaving(true);
    try {
      if (formModal.mode === "edit") {
        await api.put(`/metodos-pago/${formModal.metodo.id_metodo_pago}`, payload);
        showToast("Método de pago actualizado.");
      } else {
        await api.post("/metodos-pago", payload);
        showToast("Método de pago creado.");
      }
      await cargarMetodos();
      setFormModal(null);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : "No se pudo guardar el método de pago.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/metodos-pago/${deleteTarget.id_metodo_pago}`);
      setDeleteTarget(null);
      showToast("Método de pago eliminado.");
      await cargarMetodos();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "No se pudo eliminar el método de pago.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="breadcrumb">› Métodos de pago</div>
      <div className="mpv-header">
        <div>
          <h1 className="page-title">Métodos de pago</h1>
          <p className="text-muted mpv-subtitle">
            {puedeEditar ? "Catálogo global, no depende de la sucursal." : "Solo admin_general puede crear, editar o eliminar métodos de pago."}
          </p>
        </div>
        {puedeEditar && (
          <button className="btn btn-primary" onClick={() => setFormModal({ mode: "create" })}>
            <Plus size={16} /> Nuevo método
          </button>
        )}
      </div>

      <div className="data-table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Predeterminado</th>
              <th>Requiere comprobante</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr className="empty-row">
                <td colSpan={5}>
                  <div className="u-loading-row">
                    <Loader2 size={18} className="u-spin" /> Cargando métodos de pago...
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
            ) : metodos.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={5}>No hay métodos de pago registrados.</td>
              </tr>
            ) : (
              metodos.map((m) => (
              <tr key={m.id_metodo_pago}>
                <td>
                  <div className="u-flex-gap-8">
                    <CreditCard size={14} className="mpv-nombre-icon" />
                    {m.nombre}
                  </div>
                </td>
                <td>
                  {m.es_default ? (
                    <span className="badge badge-success mpv-badge-star">
                      <Star size={11} /> Sí
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td>{m.requiere_comp ? <span className="badge badge-info">Sí</span> : <span className="text-muted">No</span>}</td>
                <td>
                  <span className={`badge ${m.activo ? "badge-success" : "badge-neutral"}`}>{m.activo ? "Activo" : "Inactivo"}</span>
                </td>
                <td>
                  {puedeEditar ? (
                    <div className="mpv-actions-cell">
                      <button className="btn btn-outline btn-sm" onClick={() => setFormModal({ mode: "edit", metodo: m })}>
                        <Pencil size={14} />
                      </button>
                      <button
                        className="btn btn-danger-ghost btn-sm"
                        onClick={() => {
                          setDeleteTarget(m);
                          setDeleteError(null);
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : (
                    <span className="mpv-readonly-note">
                      <Lock size={12} /> Solo lectura
                    </span>
                  )}
                </td>
              </tr>
            ))
            )}
          </tbody>
        </table>
      </div>

      {formModal && (
        <FormModal
          initial={formModal.mode === "edit" ? formModal.metodo : null}
          saving={saving}
          existentes={metodos}
          onCancel={() => setFormModal(null)}
          onSubmit={handleSubmit}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          metodo={deleteTarget}
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
