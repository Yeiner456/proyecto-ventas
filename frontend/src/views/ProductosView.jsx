import React, { useState, useMemo } from "react";
import { Package, Plus, Pencil, Trash2, X, Search, AlertTriangle, Info, Lock } from "lucide-react";
import { useAuth, esAdminGeneral as actorEsAdminGeneral } from "../context/AuthContext";
import {
  sucursales as sucursalesSeed,
  productos as productosSeed,
  categoriasDeSucursal,
  nombreCategoria,
  nombreSucursal,
  stockDe,
} from "../mocks/seedData";

/* ============================================================================
 * PRODUCTOS — Vista CRUD
 * ----------------------------------------------------------------------------
 * Contrato real:
 *   GET    /api/productos               -> listar (scoped por sucursal)
 *   POST   /api/productos               -> crear (crea Inventario si maneja_stock)
 *   PUT    /api/productos/{id_producto} -> editar
 *   DELETE /api/productos/{id_producto} -> eliminar (409 si tiene ventas)
 *
 * ProductoPolicy: viewAny=true para todos (cajero necesita listarlos para
 * vender), create/update/delete=esAdminSucursal() (admin_general por
 * before()). Igual que Categorías: la pantalla de GESTIÓN (esta) solo
 * está en la Sidebar para admin_general/admin_sucursal — el cajero
 * accederá a los productos desde NuevaVentaView (aún no construida), que
 * es una experiencia de solo-consulta distinta a este CRUD.
 *
 * IMPORTANTE: 'stock' no vive en Producto sino en un modelo aparte
 * (Inventario, 1:1). Aquí se lee con stockDe() pero se sigue tratando
 * como un dato de OTRO recurso — cuando se conecte la API real, el
 * store()/update() de Inventario es una llamada aparte a
 * PATCH /api/inventario/{id}/ajustar, no a /api/productos.
 * ==========================================================================*/

const wait = (ms = 400) => new Promise((res) => setTimeout(res, ms));

const api = {
  async crear(payload) {
    await wait();
    return { id_producto: Date.now(), activo: true, ...payload };
  },
  async editar(id_producto, payload) {
    await wait();
    return { id_producto, ...payload };
  },
  async eliminar(id_producto, productos) {
    await wait(250);
    const producto = productos.find((p) => p.id_producto === id_producto);
    if (producto?.tieneVentas) {
      const error = new Error(
        "No se puede eliminar el producto porque tiene ventas registradas. Desactívalo en su lugar."
      );
      error.status = 409;
      throw error;
    }
    return true;
  },
};

function puedeGestionar(actor) {
  return actorEsAdminGeneral(actor) || actor.rol === "admin_sucursal";
}

function productoVisible(actor, producto) {
  if (actorEsAdminGeneral(actor)) return true;
  const sucursalActorId = sucursalesSeed.find((s) => s.nombre === actor.sucursal)?.id_sucursal;
  return producto.sucursal_id === sucursalActorId;
}

const styles = `
.pv-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; gap: 16px; flex-wrap: wrap; }
.pv-subtitle { font-family: 'Roboto', sans-serif; font-size: 14px; color: var(--text-secondary); margin: 0; max-width: 560px; line-height: 1.5; }
.pv-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 20px; }
.pv-toolbar { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
.pv-search { position: relative; flex: 1; min-width: 220px; }
.pv-search svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-secondary); }
.pv-search input { padding-left: 36px; }
.pv-select { max-width: 190px; }
.pv-stock-low { color: var(--danger); font-weight: 500; }
`;

function ProductoFormModal({ actor, initial, onCancel, onSubmit, saving, existentes, stockInicialActual }) {
  const isEdit = Boolean(initial);
  const admin = actorEsAdminGeneral(actor);
  const sucursalActorId = sucursalesSeed.find((s) => s.nombre === actor.sucursal)?.id_sucursal ?? null;

  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? "");
  const [precioBase, setPrecioBase] = useState(initial?.precio_base ?? "");
  const [sucursalId, setSucursalId] = useState(initial ? initial.sucursal_id : admin ? "" : sucursalActorId);
  const [categoriaId, setCategoriaId] = useState(initial?.categoria_id ?? "");
  const [manejaStock, setManejaStock] = useState(initial?.maneja_stock ?? false);
  const [stockMinimo, setStockMinimo] = useState(initial?.stock_minimo ?? 0);
  const [stockInicial, setStockInicial] = useState(stockInicialActual ?? 0);
  const [activo, setActivo] = useState(initial?.activo ?? true);
  const [touched, setTouched] = useState(false);

  const categoriasDisponibles = sucursalId ? categoriasDeSucursal(Number(sucursalId)) : [];

  const nombreValido = nombre.trim().length >= 2;
  const precioValido = precioBase !== "" && Number(precioBase) >= 0;
  const sucursalValida = Boolean(sucursalId);
  const duplicado = existentes.some(
    (p) =>
      p.nombre.toLowerCase() === nombre.trim().toLowerCase() &&
      p.sucursal_id === Number(sucursalId) &&
      p.id_producto !== initial?.id_producto
  );

  const formValido = nombreValido && precioValido && sucursalValida && !duplicado;

  function handleSucursalChange(value) {
    setSucursalId(value);
    setCategoriaId(""); // la categoría depende de la sucursal, se resetea
  }

  function handleSubmit(e) {
    e.preventDefault();
    setTouched(true);
    if (!formValido) return;

    const payload = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      precio_base: Number(precioBase),
      sucursal_id: Number(sucursalId),
      categoria_id: categoriaId ? Number(categoriaId) : null,
      maneja_stock: manejaStock,
      stock_minimo: manejaStock ? Number(stockMinimo) : 0,
      activo,
    };
    if (!isEdit && manejaStock) payload.stock_inicial = Number(stockInicial);
    onSubmit(payload);
  }

  return (
    <div className="modal-overlay" onMouseDown={onCancel}>
      <form className="modal modal-wide" onMouseDown={(e) => e.stopPropagation()} onSubmit={handleSubmit}>
        <div className="modal-header">
          <h3 className="modal-title">{isEdit ? "Editar producto" : "Nuevo producto"}</h3>
          <button type="button" className="modal-close" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 14 }}>
          <div className="field">
            <label className="field-label">Nombre</label>
            <input className="field-input" value={nombre} onChange={(e) => setNombre(e.target.value)} />
            {touched && !nombreValido && <p className="field-help error">Mínimo 2 caracteres.</p>}
            {touched && duplicado && <p className="field-help error">Ya existe un producto con ese nombre en esa sucursal.</p>}
          </div>
          <div className="field">
            <label className="field-label">Precio base</label>
            <input
              className="field-input"
              type="number"
              min="0"
              step="0.01"
              value={precioBase}
              onChange={(e) => setPrecioBase(e.target.value)}
            />
            {touched && !precioValido && <p className="field-help error">Ingresa un precio válido.</p>}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <div className="field">
            <label className="field-label">Sucursal</label>
            {admin ? (
              <select className="field-select" value={sucursalId} onChange={(e) => handleSucursalChange(e.target.value)} disabled={isEdit}>
                <option value="">Selecciona una sucursal</option>
                {sucursalesSeed.map((s) => (
                  <option key={s.id_sucursal} value={s.id_sucursal}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-secondary)", fontSize: 12.5 }}>
                <Lock size={13} /> {actor.sucursal}
              </div>
            )}
          </div>

          <div className="field">
            <label className="field-label">Categoría</label>
            <select
              className="field-select"
              value={categoriaId}
              onChange={(e) => setCategoriaId(e.target.value)}
              disabled={!sucursalId}
            >
              <option value="">Sin categoría</option>
              {categoriasDisponibles.map((c) => (
                <option key={c.id_categoria} value={c.id_categoria}>
                  {c.nombre}
                </option>
              ))}
            </select>
            {!sucursalId && <p className="field-help">Selecciona primero una sucursal.</p>}
          </div>
        </div>

        <div className="field">
          <label className="field-label">Descripción</label>
          <textarea className="field-textarea" value={descripcion} onChange={(e) => setDescripcion(e.target.value)} />
        </div>

        <div className="field">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" id="pv-stock" checked={manejaStock} onChange={(e) => setManejaStock(e.target.checked)} />
            <label htmlFor="pv-stock" className="field-label" style={{ margin: 0 }}>
              Maneja inventario
            </label>
          </div>
          <p className="field-help">
            Desactívalo para productos preparados al momento (ej. sanduches, cafés) que nunca descuentan stock.
          </p>
        </div>

        {manejaStock && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div className="field">
              <label className="field-label">Stock mínimo (alerta)</label>
              <input
                className="field-input"
                type="number"
                min="0"
                value={stockMinimo}
                onChange={(e) => setStockMinimo(e.target.value)}
              />
            </div>
            {!isEdit ? (
              <div className="field">
                <label className="field-label">Stock inicial</label>
                <input
                  className="field-input"
                  type="number"
                  min="0"
                  value={stockInicial}
                  onChange={(e) => setStockInicial(e.target.value)}
                />
              </div>
            ) : (
              <div className="field">
                <label className="field-label">Stock actual</label>
                <div style={{ display: "flex", alignItems: "center", gap: 6, color: "var(--text-secondary)", fontSize: 12.5 }}>
                  <Lock size={13} /> {stockInicialActual} unidades — ajústalo desde Inventario, no desde aquí.
                </div>
              </div>
            )}
          </div>
        )}

        <div className="field">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input type="checkbox" id="pv-activo" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
            <label htmlFor="pv-activo" className="field-label" style={{ margin: 0 }}>
              Producto activo
            </label>
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-outline" onClick={onCancel}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? "Guardando..." : isEdit ? "Guardar cambios" : "Crear producto"}
          </button>
        </div>
      </form>
    </div>
  );
}

function ConfirmDeleteModal({ producto, onCancel, onConfirm, deleting, error }) {
  return (
    <div className="modal-overlay" onMouseDown={onCancel}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Eliminar producto</h3>
          <button className="modal-close" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        <p style={{ fontFamily: "'Roboto', sans-serif", fontSize: 14, lineHeight: 1.5 }}>
          ¿Seguro que quieres eliminar <strong>{producto.nombre}</strong>?
        </p>
        {error && (
          <div className="alert alert-danger">
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{error}</span>
          </div>
        )}
        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onCancel}>
            Cancelar
          </button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={deleting}>
            {deleting ? "Eliminando..." : "Eliminar producto"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductosView() {
  const { usuario: actor } = useAuth();
  const [productos, setProductos] = useState(productosSeed);
  const [formModal, setFormModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");

  const autorizado = puedeGestionar(actor);

  const visibles = useMemo(() => {
    return productos
      .filter((p) => productoVisible(actor, p))
      .filter((p) => !filtroCategoria || p.categoria_id === Number(filtroCategoria))
      .filter((p) => !busqueda.trim() || p.nombre.toLowerCase().includes(busqueda.toLowerCase()));
  }, [productos, actor, filtroCategoria, busqueda]);

  const stats = useMemo(() => {
    const base = productos.filter((p) => productoVisible(actor, p));
    const bajoStock = base.filter((p) => p.maneja_stock && (stockDe(p.id_producto) ?? 0) < p.stock_minimo).length;
    return { total: base.length, activos: base.filter((p) => p.activo).length, bajoStock };
  }, [productos, actor]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSubmit(payload) {
    setSaving(true);
    try {
      if (formModal.mode === "edit") {
        const actualizado = await api.editar(formModal.producto.id_producto, payload);
        setProductos((prev) => prev.map((p) => (p.id_producto === actualizado.id_producto ? { ...p, ...actualizado } : p)));
        showToast("Producto actualizado.");
      } else {
        const creado = await api.crear(payload);
        setProductos((prev) => [...prev, creado]);
        showToast("Producto creado.");
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
      await api.eliminar(deleteTarget.id_producto, productos);
      setProductos((prev) => prev.filter((p) => p.id_producto !== deleteTarget.id_producto));
      setDeleteTarget(null);
      showToast("Producto eliminado.");
    } catch (err) {
      setDeleteError(err.message);
    } finally {
      setDeleting(false);
    }
  }

  if (!autorizado) {
    return (
      <div>
        <div className="breadcrumb">› Producto</div>
        <h1 className="page-title">Productos</h1>
        <div className="alert alert-danger" style={{ maxWidth: 480 }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>No tienes permisos para gestionar productos.</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <style>{styles}</style>
      <div className="breadcrumb">› Producto</div>
      <div className="pv-header">
        <div>
          <h1 className="page-title">Productos</h1>
          <p className="pv-subtitle">
            {actorEsAdminGeneral(actor) ? "Catálogo de todas las sucursales." : `Catálogo de ${actor.sucursal}.`}
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setFormModal({ mode: "create" })}>
          <Plus size={16} /> Nuevo producto
        </button>
      </div>

      <div className="pv-stats">
        <div className="stat-card">
          <div className="stat-label">Productos</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Activos</div>
          <div className="stat-value">{stats.activos}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Stock bajo</div>
          <div className="stat-value" style={{ color: stats.bajoStock > 0 ? "var(--danger)" : "inherit" }}>
            {stats.bajoStock}
          </div>
        </div>
      </div>

      <div className="pv-toolbar">
        <div className="pv-search">
          <Search size={15} />
          <input className="field-input" placeholder="Buscar producto..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
        <select className="field-select pv-select" value={filtroCategoria} onChange={(e) => setFiltroCategoria(e.target.value)}>
          <option value="">Todas las categorías</option>
          {(actorEsAdminGeneral(actor)
            ? [...new Map(productos.map((p) => [p.categoria_id, p.categoria_id])).keys()]
            : categoriasDeSucursal(sucursalesSeed.find((s) => s.nombre === actor.sucursal)?.id_sucursal).map((c) => c.id_categoria)
          )
            .filter(Boolean)
            .map((id) => (
              <option key={id} value={id}>
                {nombreCategoria(id)}
              </option>
            ))}
        </select>
      </div>

      <div className="data-table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Producto</th>
              <th>Categoría</th>
              {actorEsAdminGeneral(actor) && <th>Sucursal</th>}
              <th>Precio</th>
              <th>Stock</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={7}>No hay productos que coincidan con el filtro.</td>
              </tr>
            ) : (
              visibles.map((p) => {
                const stock = stockDe(p.id_producto);
                const stockBajo = p.maneja_stock && stock !== null && stock < p.stock_minimo;
                return (
                  <tr key={p.id_producto}>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <Package size={14} style={{ color: "var(--sena-green-dark)" }} />
                        {p.nombre}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-neutral">{nombreCategoria(p.categoria_id)}</span>
                    </td>
                    {actorEsAdminGeneral(actor) && <td>{nombreSucursal(p.sucursal_id)}</td>}
                    <td className="text-mono">${Number(p.precio_base).toLocaleString("es-CO")}</td>
                    <td>
                      {!p.maneja_stock ? (
                        <span className="text-muted">No aplica</span>
                      ) : (
                        <span className={stockBajo ? "text-mono pv-stock-low" : "text-mono"}>
                          {stock ?? 0}
                          {stockBajo && " ⚠"}
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge ${p.activo ? "badge-success" : "badge-neutral"}`}>
                        {p.activo ? "Activo" : "Inactivo"}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: "flex", gap: 6 }}>
                        <button className="btn btn-outline btn-sm" onClick={() => setFormModal({ mode: "edit", producto: p })}>
                          <Pencil size={14} />
                        </button>
                        <button
                          className="btn btn-danger-ghost btn-sm"
                          onClick={() => {
                            setDeleteTarget(p);
                            setDeleteError(null);
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {formModal && (
        <ProductoFormModal
          actor={actor}
          initial={formModal.mode === "edit" ? formModal.producto : null}
          saving={saving}
          existentes={productos}
          stockInicialActual={formModal.mode === "edit" ? stockDe(formModal.producto.id_producto) ?? 0 : 0}
          onCancel={() => setFormModal(null)}
          onSubmit={handleSubmit}
        />
      )}

      {deleteTarget && (
        <ConfirmDeleteModal
          producto={deleteTarget}
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
