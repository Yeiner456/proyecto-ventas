import React, { useState, useMemo } from "react";
import { Tags, Plus, Pencil, Trash2, X, AlertTriangle, Info, Lock } from "lucide-react";
import { useAuth, esAdminGeneral as actorEsAdminGeneral } from "../context/AuthContext";
import { sucursales as sucursalesSeed, categorias as categoriasSeed, productos as productosSeed, nombreSucursal } from "../mocks/seedData";
import "../styles/CategoriasView.css";

/* ============================================================================
 * CATEGORÍAS DE PRODUCTO — Vista CRUD
 * ----------------------------------------------------------------------------
 * Contrato real:
 *   GET/POST/PUT/DELETE /api/categorias-productos
 *
 * CategoriaProductoPolicy:
 *   - viewAny -> true para cualquiera (los productos la necesitan para
 *     filtrar), PERO el link de esta pantalla de gestión solo está en la
 *     Sidebar para admin_general/admin_sucursal — igual que UsuariosView,
 *     bloqueo completo si alguien más navega directo a la URL.
 *   - create/update -> esAdminSucursal() (admin_general por before()).
 *   - delete -> esAdminSucursal(); además el controlador bloquea con 409
 *     si la categoría tiene productos asociados.
 * ==========================================================================*/

const wait = (ms = 400) => new Promise((res) => setTimeout(res, ms));

const api = {
  async crear(payload) {
    await wait();
    return { id_categoria: Date.now(), ...payload };
  },
  async editar(id_categoria, payload) {
    await wait();
    return { id_categoria, ...payload };
  },
  async eliminar(id_categoria) {
    await wait(250);
    const tieneProductos = productosSeed.some((p) => p.categoria_id === id_categoria);
    if (tieneProductos) {
      const error = new Error("No se puede eliminar la categoría porque tiene productos asociados.");
      error.status = 409;
      throw error;
    }
    return true;
  },
};

function puedeGestionar(actor) {
  return actorEsAdminGeneral(actor) || actor.rol === "admin_sucursal";
}

function categoriaVisible(actor, categoria) {
  if (actorEsAdminGeneral(actor)) return true;
  const sucursalActorId = sucursalesSeed.find((s) => s.nombre === actor.sucursal)?.id_sucursal;
  return categoria.sucursal_id === sucursalActorId;
}


function FormModal({ actor, initial, onCancel, onSubmit, saving, existentes }) {
  const isEdit = Boolean(initial);
  const admin = actorEsAdminGeneral(actor);
  const sucursalActorId = sucursalesSeed.find((s) => s.nombre === actor.sucursal)?.id_sucursal ?? null;

  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [sucursalId, setSucursalId] = useState(initial ? initial.sucursal_id : admin ? "" : sucursalActorId);
  const [touched, setTouched] = useState(false);

  const nombreValido = nombre.trim().length >= 2;
  const sucursalValida = Boolean(sucursalId);
  const duplicada = existentes.some(
    (c) =>
      c.nombre.toLowerCase() === nombre.trim().toLowerCase() &&
      c.sucursal_id === Number(sucursalId) &&
      c.id_categoria !== initial?.id_categoria
  );
  const formValido = nombreValido && sucursalValida && !duplicada;

  function handleSubmit(e) {
    e.preventDefault();
    setTouched(true);
    if (!formValido) return;
    onSubmit({ nombre: nombre.trim(), sucursal_id: Number(sucursalId) });
  }

  return (
    <div className="modal-overlay" onMouseDown={onCancel}>
      <form className="modal" onMouseDown={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-header">
          <h3 className="modal-title">{isEdit ? "Editar categoría" : "Nueva categoría"}</h3>
          <button type="button" className="modal-close" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>

        <div className="field">
          <label className="field-label">Nombre</label>
          <input className="field-input" value={nombre} onChange={(e) => setNombre(e.target.value)} />
          {touched && !nombreValido && <p className="field-help error">Mínimo 2 caracteres.</p>}
          {touched && nombreValido && duplicada && (
            <p className="field-help error">Ya existe una categoría con ese nombre en esa sucursal.</p>
          )}
        </div>

        <div className="field">
          <label className="field-label">Sucursal</label>
          {admin ? (
            <select className="field-select" value={sucursalId} onChange={(e) => setSucursalId(e.target.value)} disabled={isEdit}>
              <option value="">Selecciona una sucursal</option>
              {sucursalesSeed.map((s) => (
                <option key={s.id_sucursal} value={s.id_sucursal}>
                  {s.nombre}
                </option>
              ))}
            </select>
          ) : (
            <div className="u-lock-note">
              <Lock size={13} /> {actor.sucursal}
            </div>
          )}
          {isEdit && admin && (
            <p className="field-help">
              No se puede mover una categoría a otra sucursal (sus productos quedarían inconsistentes).
            </p>
          )}
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear categoría"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ConfirmDeleteModal({ categoria, onCancel, onConfirm, deleting, error }) {
  return (
    <div className="modal-overlay" onMouseDown={onCancel}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Eliminar categoría</h3>
          <button className="modal-close" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        <p className="u-confirm-text">
          ¿Seguro que quieres eliminar <strong>{categoria.nombre}</strong>?
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
            {deleting ? "Eliminando..." : "Eliminar categoría"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CategoriasView() {
  const { usuario: actor } = useAuth();
  const [categorias, setCategorias] = useState(categoriasSeed);
  const [formModal, setFormModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);

  const autorizado = puedeGestionar(actor);

  const visibles = useMemo(() => categorias.filter((c) => categoriaVisible(actor, c)), [categorias, actor]);

  const conteoProductos = (id_categoria) => productosSeed.filter((p) => p.categoria_id === id_categoria).length;

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSubmit(payload) {
    setSaving(true);
    try {
      if (formModal.mode === "edit") {
        const actualizada = await api.editar(formModal.categoria.id_categoria, payload);
        setCategorias((prev) => prev.map((c) => (c.id_categoria === actualizada.id_categoria ? { ...c, ...actualizada } : c)));
        showToast("Categoría actualizada.");
      } else {
        const creada = await api.crear(payload);
        setCategorias((prev) => [...prev, creada]);
        showToast("Categoría creada.");
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
      await api.eliminar(deleteTarget.id_categoria);
      setCategorias((prev) => prev.filter((c) => c.id_categoria !== deleteTarget.id_categoria));
      setDeleteTarget(null);
      showToast("Categoría eliminada.");
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  if (!autorizado) {
    return (
      <div>
        <div className="breadcrumb">› Categorías</div>
        <h1 className="page-title">Categorías</h1>
        <div className="alert alert-danger u-max-480">
          <AlertTriangle size={16} className="u-icon-inline" />
          <span>No tienes permisos para gestionar categorías.</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="breadcrumb">› Categorías</div>
      <div className="cv-header">
        <div>
          <h1 className="page-title">Categorías</h1>
          <p className="cv-subtitle">
            {actorEsAdminGeneral(actor) ? "Categorías de producto de todas las sucursales." : `Categorías de ${actor.sucursal}.`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setFormModal({ mode: "create" })}>
          <Plus size={16} /> Nueva categoría
        </button>
      </div>

      <div className="cv-stats">
        <div className="stat-card">
          <div className="stat-label">Categorías</div>
          <div className="stat-value">{visibles.length}</div>
        </div>
      </div>

      <div className="data-table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              {actorEsAdminGeneral(actor) && <th>Sucursal</th>}
              <th>Productos</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={4}>No hay categorías registradas.</td>
              </tr>
            ) : (
              visibles.map((c) => (
                <tr key={c.id_categoria}>
                  <td>
                    <div className="cv-nombre-cell">
                      <Tags size={14} className="cv-nombre-icon" />
                      {c.nombre}
                    </div>
                  </td>
                  {actorEsAdminGeneral(actor) && <td>{nombreSucursal(c.sucursal_id)}</td>}
                  <td className="text-mono">{conteoProductos(c.id_categoria)}</td>
                  <td>
                    <div className="cv-actions-cell">
                      <button className="btn btn-outline btn-sm" onClick={() => setFormModal({ mode: "edit", categoria: c })}>
                        <Pencil size={14} />
                      </button>
                      <button
                        className="btn btn-danger-ghost btn-sm"
                        onClick={() => {
                          setDeleteTarget(c);
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
        <FormModal
          actor={actor}
          initial={formModal.mode === "edit" ? formModal.categoria : null}
          saving={saving}
          existentes={categorias}
          onCancel={() => setFormModal(null)}
          onSubmit={handleSubmit}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          categoria={deleteTarget}
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
