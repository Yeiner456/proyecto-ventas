import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Pencil, Trash2, X, Search, AlertTriangle, Info, Lock, Loader2, ImagePlus } from "lucide-react";
import { useAuth, esAdminGeneral as actorEsAdminGeneral } from "../context/AuthContext";
import { api, ApiError } from "../services/apiClient";
import ImagenProducto from "../components/ImagenProducto";
import "../styles/ProductosView.css";

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
 * accederá a los productos desde NuevaVentaView, que es una experiencia
 * de solo-consulta distinta a este CRUD.
 *
 * IMPORTANTE: 'stock' no vive en Producto sino en un modelo aparte
 * (Inventario, 1:1). GET /api/productos ya viene con 'inventario' anidado
 * (ProductoController::index hace ->with(['sucursal', 'categoria',
 * 'inventario'])), así que se lee con p.inventario?.cantidad — pero
 * ajustar el stock sigue siendo una llamada aparte a
 * PATCH /api/inventario/{id}/ajustar, no a /api/productos (por eso este
 * CRUD no toca el stock de un producto ya creado, solo lo fija al crear).
 * ==========================================================================*/

function puedeGestionar(actor) {
  return actorEsAdminGeneral(actor) || actor.rol === "admin_sucursal";
}

function productoVisible(actor, producto, sucursales) {
  if (actorEsAdminGeneral(actor)) return true;
  const sucursalActorId = sucursales.find((s) => s.nombre === actor.sucursal)?.id_sucursal;
  return producto.sucursal_id === sucursalActorId;
}


function ProductoFormModal({ actor, initial, onCancel, onSubmit, saving, existentes, stockInicialActual, sucursales, categorias }) {
  const isEdit = Boolean(initial);
  const admin = actorEsAdminGeneral(actor);
  const sucursalActorId = sucursales.find((s) => s.nombre === actor.sucursal)?.id_sucursal ?? null;

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

  // Imagen: 'imagenFile' es el archivo nuevo elegido (aún no subido);
  // 'imagenPreview' es su URL local para pintar la vista previa sin
  // esperar al servidor; 'quitarImagen' señala "borrar la foto actual"
  // cuando se edita un producto que ya tenía una y no se elige una nueva.
  const [imagenFile, setImagenFile] = useState(null);
  const [quitarImagen, setQuitarImagen] = useState(false);

  const imagenPreview = useMemo(() => (imagenFile ? URL.createObjectURL(imagenFile) : null), [imagenFile]);

  useEffect(() => {
    // Libera el object URL cuando se elige otro archivo o se cierra el
    // modal — si no, cada selección nueva deja el anterior vivo en memoria.
    return () => {
      if (imagenPreview) URL.revokeObjectURL(imagenPreview);
    };
  }, [imagenPreview]);

  function handleImagenChange(e) {
    const file = e.target.files?.[0] ?? null;
    setImagenFile(file);
    if (file) setQuitarImagen(false);
  }

  function handleQuitarImagen() {
    setImagenFile(null);
    setQuitarImagen(true);
  }

  const categoriasDisponibles = sucursalId ? categorias.filter((c) => c.sucursal_id === Number(sucursalId)) : [];

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
    onSubmit(payload, { imagenFile, quitarImagen });
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

        <div className="pv-imagen-field">
          {imagenPreview ? (
            <img src={imagenPreview} alt="Vista previa" className="pv-imagen-preview" />
          ) : (
            <ImagenProducto
              producto={quitarImagen ? { imagen_ruta: null } : initial ?? { imagen_ruta: null }}
              width={72}
              height={72}
              className="pv-imagen-preview"
            />
          )}
          <div className="pv-imagen-controls">
            <label className="btn btn-outline btn-sm pv-imagen-upload-btn">
              <ImagePlus size={14} />
              {initial?.imagen_ruta || imagenFile ? "Cambiar imagen" : "Subir imagen"}
              <input type="file" accept="image/jpeg,image/png,image/webp" className="pv-imagen-input" onChange={handleImagenChange} />
            </label>
            {(initial?.imagen_ruta || imagenFile) && !quitarImagen && (
              <button type="button" className="btn btn-danger-ghost btn-sm" onClick={handleQuitarImagen}>
                Quitar imagen
              </button>
            )}
            <p className="field-help">JPG, PNG o WEBP. Máximo 2MB.</p>
          </div>
        </div>

        <div className="pv-form-grid-2fr1fr">
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

        <div className="pv-form-grid-2">
          <div className="field">
            <label className="field-label">Sucursal</label>
            {admin ? (
              <select className="field-select" value={sucursalId} onChange={(e) => handleSucursalChange(e.target.value)} disabled={isEdit}>
                <option value="">Selecciona una sucursal</option>
                {sucursales.map((s) => (
                  <option key={s.id_sucursal} value={s.id_sucursal}>
                    {s.nombre}
                  </option>
                ))}
              </select>
            ) : (
              <div className="pv-lock-note">
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
          <div className="pv-checkbox-row">
            <input type="checkbox" id="pv-stock" checked={manejaStock} onChange={(e) => setManejaStock(e.target.checked)} />
            <label htmlFor="pv-stock" className="field-label u-label-inline">
              Maneja inventario
            </label>
          </div>
          <p className="field-help">
            Desactívalo para productos preparados al momento (ej. sanduches, cafés) que nunca descuentan stock.
          </p>
        </div>

        {manejaStock && (
          <div className="pv-form-grid-2">
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
                <div className="pv-lock-note">
                  <Lock size={13} /> {stockInicialActual} unidades — ajústalo desde Inventario, no desde aquí.
                </div>
              </div>
            )}
          </div>
        )}

        <div className="field">
          <div className="pv-checkbox-row">
            <input type="checkbox" id="pv-activo" checked={activo} onChange={(e) => setActivo(e.target.checked)} />
            <label htmlFor="pv-activo" className="field-label u-label-inline">
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
        <p className="u-confirm-text">
          ¿Seguro que quieres eliminar <strong>{producto.nombre}</strong>?
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
            {deleting ? "Eliminando..." : "Eliminar producto"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ProductosView() {
  const { usuario: actor } = useAuth();
  const [productos, setProductos] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [formModal, setFormModal] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroCategoria, setFiltroCategoria] = useState("");

  const autorizado = puedeGestionar(actor);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const [productosData, sucursalesData, categoriasData] = await Promise.all([
        api.getAllPages("/productos"),
        api.getAllPages("/sucursales"),
        api.getAllPages("/categorias-productos"),
      ]);
      setProductos(productosData);
      setSucursales(sucursalesData);
      setCategorias(categoriasData);
    } catch (e) {
      setErrorCarga(e instanceof ApiError ? e.message : (e?.message ?? "No se pudieron cargar los productos."));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (autorizado) cargarDatos();
  }, [autorizado, cargarDatos]);

  const visibles = useMemo(() => {
    return productos
      .filter((p) => productoVisible(actor, p, sucursales))
      .filter((p) => !filtroCategoria || p.categoria_id === Number(filtroCategoria))
      .filter((p) => !busqueda.trim() || p.nombre.toLowerCase().includes(busqueda.toLowerCase()));
  }, [productos, actor, sucursales, filtroCategoria, busqueda]);

  const stats = useMemo(() => {
    const base = productos.filter((p) => productoVisible(actor, p, sucursales));
    const bajoStock = base.filter((p) => p.maneja_stock && (p.inventario?.cantidad ?? 0) < p.stock_minimo).length;
    return { total: base.length, activos: base.filter((p) => p.activo).length, bajoStock };
  }, [productos, actor, sucursales]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function handleSubmit(payload, { imagenFile, quitarImagen } = {}) {
    setSaving(true);
    try {
      if (imagenFile || quitarImagen) {
        // FormData en vez de JSON porque hay que mandar el archivo real.
        // Los valores null (ej. categoria_id sin elegir) se mandan como
        // "" — el middleware global de Laravel los convierte de vuelta a
        // null antes de llegar a la validación, igual que si hubieran
        // venido en un body JSON normal.
        const formData = new FormData();
        Object.entries(payload).forEach(([key, value]) => {
          if (value === null || value === undefined) {
            formData.append(key, "");
          } else if (typeof value === "boolean") {
            formData.append(key, value ? "1" : "0");
          } else {
            formData.append(key, value);
          }
        });
        if (imagenFile) formData.append("imagen", imagenFile);
        if (quitarImagen && !imagenFile) formData.append("eliminar_imagen", "1");

        if (formModal.mode === "edit") {
          // Laravel no parsea multipart en verbos PUT reales, así que se
          // manda por POST con el spoof estándar de _method (igual que
          // cualquier <form method="POST"><input name="_method" value="PUT">).
          formData.append("_method", "PUT");
          await api.uploadFile(`/productos/${formModal.producto.id_producto}`, formData);
        } else {
          await api.uploadFile("/productos", formData);
        }
      } else if (formModal.mode === "edit") {
        await api.put(`/productos/${formModal.producto.id_producto}`, payload);
      } else {
        await api.post("/productos", payload);
      }
      showToast(formModal.mode === "edit" ? "Producto actualizado." : "Producto creado.");
      await cargarDatos();
      setFormModal(null);
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : (e?.message ?? "No se pudo guardar el producto."));
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      await api.delete(`/productos/${deleteTarget.id_producto}`);
      setDeleteTarget(null);
      showToast("Producto eliminado.");
      await cargarDatos();
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : "No se pudo eliminar el producto.");
    } finally {
      setDeleting(false);
    }
  }

  if (!autorizado) {
    return (
      <div>
        <div className="breadcrumb">› Producto</div>
        <h1 className="page-title">Productos</h1>
        <div className="alert alert-danger u-max-480">
          <AlertTriangle size={16} className="u-icon-inline" />
          <span>No tienes permisos para gestionar productos.</span>
        </div>
      </div>
    );
  }

  return (
    <div>
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
          <div className={`stat-value${stats.bajoStock > 0 ? " u-value-danger" : ""}`}>
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
            ? [...new Map(productos.filter((p) => p.categoria).map((p) => [p.categoria.id_categoria, p.categoria])).values()]
            : categorias.filter((c) => c.sucursal_id === sucursales.find((s) => s.nombre === actor.sucursal)?.id_sucursal)
          ).map((c) => (
            <option key={c.id_categoria} value={c.id_categoria}>
              {c.nombre}
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
            {cargando ? (
              <tr className="empty-row">
                <td colSpan={7}>
                  <div className="u-loading-row">
                    <Loader2 size={18} className="u-spin" /> Cargando productos...
                  </div>
                </td>
              </tr>
            ) : errorCarga ? (
              <tr className="empty-row">
                <td colSpan={7}>
                  <div className="alert alert-danger u-max-480">
                    <AlertTriangle size={16} className="u-icon-inline" />
                    <span>{errorCarga}</span>
                  </div>
                </td>
              </tr>
            ) : visibles.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={7}>No hay productos que coincidan con el filtro.</td>
              </tr>
            ) : (
              visibles.map((p) => {
                const stock = p.inventario?.cantidad ?? null;
                const stockBajo = p.maneja_stock && stock !== null && stock < p.stock_minimo;
                return (
                  <tr key={p.id_producto}>
                    <td>
                      <div className="pv-checkbox-row">
                        <ImagenProducto producto={p} width={28} height={28} iconSize={14} />
                        {p.nombre}
                      </div>
                    </td>
                    <td>
                      <span className="badge badge-neutral">{p.categoria?.nombre ?? "Sin categoría"}</span>
                    </td>
                    {actorEsAdminGeneral(actor) && <td>{p.sucursal?.nombre ?? "—"}</td>}
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
                      <div className="pv-actions-cell">
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
          stockInicialActual={formModal.mode === "edit" ? formModal.producto.inventario?.cantidad ?? 0 : 0}
          sucursales={sucursales}
          categorias={categorias}
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
        <div className="toast">
          <Info size={15} />
          {toast}
        </div>
      )}
    </div>
  );
}
