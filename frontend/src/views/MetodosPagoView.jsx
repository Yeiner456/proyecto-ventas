import React, { useState } from "react";
import { CreditCard, Plus, Pencil, Trash2, X, AlertTriangle, Info, Lock, Star } from "lucide-react";
import { useAuth, esAdminGeneral as actorEsAdminGeneral } from "../context/AuthContext";
import { metodosPago as metodosPagoSeed, ventas as ventasSeed } from "../mocks/seedData";

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
 * (MetodoPagoController::store()/update()).
 * ==========================================================================*/

const wait = (ms = 350) => new Promise((res) => setTimeout(res, ms));

const api = {
  async crear(payload) {
    await wait();
    return { id_metodo_pago: Date.now(), activo: true, ...payload };
  },
  async editar(id_metodo_pago, payload) {
    await wait();
    return { id_metodo_pago, ...payload };
  },
  async eliminar(id_metodo_pago) {
    await wait(250);
    const tieneVentas = ventasSeed.some((v) => v.metodo_pago_id === id_metodo_pago);
    if (tieneVentas) {
      const error = new Error(
        "No se puede eliminar el método de pago porque tiene ventas asociadas. Desactívalo en su lugar."
      );
      error.status = 409;
      throw error;
    }
    return true;
  },
};

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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" id="mp-default" checked={esDefault} onChange={(e) => setEsDefault(e.target.checked)} />
            <label htmlFor="mp-default" className="field-label" style={{ margin: 0 }}>
              Método predeterminado
            </label>
          </div>
          <p className="field-help">Solo puede haber uno. Si marcas este, se desmarca el que era predeterminado antes.</p>
        </div>

        <div className="field">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" id="mp-comp" checked={requiereComp} onChange={(e) => setRequiereComp(e.target.checked)} />
            <label htmlFor="mp-comp" className="field-label" style={{ margin: 0 }}>
              Requiere comprobante de pago
            </label>
          </div>
        </div>

        <div className="field">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" id="mp-activo" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
            <label htmlFor="mp-activo" className="field-label" style={{ margin: 0 }}>
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
        <p style={{ fontFamily: "'Roboto', sans-serif", fontSize: 14, lineHeight: 1.5 }}>
          ¿Seguro que quieres eliminar <strong>{metodo.nombre}</strong>?
        </p>
        {error && (
          <div className="alert alert-danger">
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
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

  const [metodos, setMetodos] = useState(metodosPagoSeed);
  const [formModal, setFormModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSubmit(payload) {
    setSaving(true);
    try {
      if (formModal.mode === "edit") {
        const actualizado = await api.editar(formModal.metodo.id_metodo_pago, payload);
        setMetodos((prev) => {
          const base = payload.es_default ? prev.map((m) => ({ ...m, es_default: false })) : prev;
          return base.map((m) => (m.id_metodo_pago === actualizado.id_metodo_pago ? { ...m, ...actualizado } : m));
        });
        showToast("Método de pago actualizado.");
      } else {
        const creado = await api.crear(payload);
        setMetodos((prev) => {
          const base = payload.es_default ? prev.map((m) => ({ ...m, es_default: false })) : prev;
          return [...base, creado];
        });
        showToast("Método de pago creado.");
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
      await api.eliminar(deleteTarget.id_metodo_pago);
      setMetodos((prev) => prev.filter((m) => m.id_metodo_pago !== deleteTarget.id_metodo_pago));
      setDeleteTarget(null);
      showToast("Método de pago eliminado.");
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <div className="breadcrumb">› Métodos de pago</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 24, gap: 16, flexWrap: "wrap" }}>
        <div>
          <h1 className="page-title">Métodos de pago</h1>
          <p className="text-muted" style={{ maxWidth: 560 }}>
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
            {metodos.map((m) => (
              <tr key={m.id_metodo_pago}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <CreditCard size={14} style={{ color: "var(--sena-green-dark)" }} />
                    {m.nombre}
                  </div>
                </td>
                <td>
                  {m.es_default ? (
                    <span className="badge badge-success" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
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
                    <div style={{ display: "flex", gap: 6 }}>
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
                    <span style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--text-secondary)", fontSize: 12 }}>
                      <Lock size={12} /> Solo lectura
                    </span>
                  )}
                </td>
              </tr>
            ))}
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
        <div style={{ position: "fixed", bottom: 24, right: 24, background: "var(--ink)", color: "var(--white)", padding: "12px 18px", borderRadius: 8, fontFamily: "'Roboto', sans-serif", fontSize: 13.5, display: "flex", alignItems: "center", gap: 8, boxShadow: "0 8px 24px rgba(0,0,0,.25)" }}>
          <Info size={15} />
          {toast}
        </div>
      )}
    </div>
  );
}
