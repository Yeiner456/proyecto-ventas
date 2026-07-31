import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Pencil, Trash2, X, Search, AlertTriangle, Info, Lock, Loader2, ImagePlus, Store } from "lucide-react";
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
 * 'inventario'])), así que se lee con p.inventario?.cantidad. El PUT de
 * este CRUD nunca toca el stock de un producto ya creado (solo lo fija
 * al crear, vía stock_inicial) — el ajuste en modo edición usa una
 * llamada aparte a PATCH /api/inventario/{id}/ajustar, disparada desde
 * un widget inline en el propio modal (ver ProductoFormModal), así el
 * admin de sucursal no tiene que salir a la vista de Inventario.
 * ==========================================================================*/

function puedeGestionar(actor) {
  return actorEsAdminGeneral(actor) || actor.rol === "admin_sucursal";
}

function productoVisible(actor, producto, sucursales) {
  if (actorEsAdminGeneral(actor)) return true;
  const sucursalActorId = sucursales.find((s) => s.nombre === actor.sucursal)?.id_sucursal;
  return producto.sucursal_id === sucursalActorId;
}

// Estado de stock de un producto, usado por el filtro de stock del listado.
// "no_aplica": el producto no maneja stock (maneja_stock=false).
// "sin_stock": maneja stock y la cantidad es 0 (o negativa).
// "bajo": maneja stock, hay cantidad pero está por debajo de stock_minimo.
// "disponible": maneja stock y la cantidad cubre el mínimo.
function stockEstado(producto) {
  if (!producto.maneja_stock) return "no_aplica";
  const stock = producto.inventario?.cantidad ?? 0;
  if (stock <= 0) return "sin_stock";
  if (stock < producto.stock_minimo) return "bajo";
  return "disponible";
}


function ProductoFormModal({ actor, initial, onCancel, onSubmit, saving, existentes, stockInicialActual, sucursales, categorias, onStockAjustado }) {
  const isEdit = Boolean(initial);
  const admin = actorEsAdminGeneral(actor);
  const sucursalActorId = sucursales.find((s) => s.nombre === actor.sucursal)?.id_sucursal ?? null;

  const [nombre, setNombre] = useState(initial?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(initial?.descripcion ?? "");
  const [precioBase, setPrecioBase] = useState(initial?.precio_base ?? "");
  const [sucursalId, setSucursalId] = useState(initial ? initial.sucursal_id : admin ? "" : sucursalActorId);
  const [categoriaId, setCategoriaId] = useState(initial?.categoria_id ?? "");
  const [crearTodas, setCrearTodas] = useState(false);
  const [manejaStock, setManejaStock] = useState(initial?.maneja_stock ?? false);
  const [stockMinimo, setStockMinimo] = useState(initial?.stock_minimo ?? 0);
  const [stockInicial, setStockInicial] = useState(stockInicialActual ?? 0);
  const [activo, setActivo] = useState(initial?.activo ?? true);
  const [touched, setTouched] = useState(false);

  // Ajuste de stock en línea (solo edición): permite fijar directamente
  // el nuevo stock (no un delta +/-) sin salir al módulo de Inventario.
  // El backend (PATCH /inventario/{id}/ajustar) sigue esperando un delta,
  // así que aquí se calcula como nuevoStock - stockMostrado antes de
  // mandarlo. 'stockMostrado' es el valor que se ve en pantalla y se
  // actualiza al vuelo tras un ajuste exitoso, sin esperar a que se
  // recargue toda la lista de productos.
  const [stockMostrado, setStockMostrado] = useState(stockInicialActual ?? 0);
  const [nuevoStock, setNuevoStock] = useState("");
  const [ajusteObservacion, setAjusteObservacion] = useState("");
  const [ajustando, setAjustando] = useState(false);
  const [ajusteError, setAjusteError] = useState(null);

  async function handleAjustarStock() {
    setAjusteError(null);
    if (nuevoStock === "") {
      setAjusteError("Ingresa el nuevo stock.");
      return;
    }
    const valor = Number(nuevoStock);
    if (!Number.isInteger(valor) || valor < 0) {
      setAjusteError("El stock debe ser un número entero de 0 o mayor.");
      return;
    }
    const delta = valor - stockMostrado;
    if (delta === 0) {
      setAjusteError("Ese ya es el stock actual.");
      return;
    }
    if (!ajusteObservacion.trim()) {
      setAjusteError("Escribe una observación (ej. conteo físico, merma, mercancía nueva).");
      return;
    }
    setAjustando(true);
    try {
      const resp = await api.patch(`/inventario/${initial.inventario.id_inventario}/ajustar`, {
        cantidad: delta,
        observacion: ajusteObservacion.trim(),
      });
      setStockMostrado(resp.inventario.cantidad);
      setNuevoStock("");
      setAjusteObservacion("");
      onStockAjustado?.();
    } catch (e) {
      setAjusteError(e instanceof ApiError ? e.message : (e?.message ?? "No se pudo ajustar el stock."));
    } finally {
      setAjustando(false);
    }
  }

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
  const duplicado =
    !crearTodas &&
    existentes.some(
      (p) =>
        p.nombre.toLowerCase() === nombre.trim().toLowerCase() &&
        p.sucursal_id === Number(sucursalId) &&
        p.id_producto !== initial?.id_producto
    );

  const formValido = nombreValido && precioValido && (crearTodas || (sucursalValida && !duplicado));

  function handleSucursalChange(value) {
    setSucursalId(value);
    setCategoriaId(""); // la categoría depende de la sucursal, se resetea
  }

  function handleCrearTodasChange(checked) {
    setCrearTodas(checked);
    if (checked) {
      setSucursalId("");
      setCategoriaId("");
    }
  }

  function handleSubmit(e) {
    e.preventDefault();
    setTouched(true);
    if (!formValido) return;

    const payload = {
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      precio_base: Number(precioBase),
      categoria_id: crearTodas ? null : categoriaId ? Number(categoriaId) : null,
      maneja_stock: manejaStock,
      stock_minimo: manejaStock ? Number(stockMinimo) : 0,
      activo,
    };
    if (!isEdit && manejaStock) payload.stock_inicial = Number(stockInicial);
    if (crearTodas) {
      payload.crear_para_todas = true;
    } else {
      payload.sucursal_id = Number(sucursalId);
    }
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

        {!isEdit && admin && (
          <label className={`pv-todas-toggle${crearTodas ? " is-activo" : ""}`}>
            <input
              type="checkbox"
              className="pv-todas-toggle-input"
              checked={crearTodas}
              onChange={(e) => handleCrearTodasChange(e.target.checked)}
            />
            <div>
              <span className="pv-todas-toggle-title">
                <Store size={18} />
                Crear para todas las sucursales
              </span>
              <p className="pv-todas-toggle-help">
                Crea este producto (mismo precio y stock inicial) en cada sucursal existente. Se omite en las que ya
                tengan un producto con este nombre. Queda sin categoría en todas — asígnala luego en cada una si la
                necesitas.
              </p>
            </div>
          </label>
        )}

        <div className="pv-form-grid-2">
          <div className="field">
            <label className="field-label">Sucursal</label>
            {crearTodas ? (
              <div className="pv-lock-note">
                <Lock size={13} /> Todas las sucursales
              </div>
            ) : admin ? (
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
              disabled={!sucursalId || crearTodas}
            >
              <option value="">Sin categoría</option>
              {categoriasDisponibles.map((c) => (
                <option key={c.id_categoria} value={c.id_categoria}>
                  {c.nombre}
                </option>
              ))}
            </select>
            {crearTodas ? (
              <p className="field-help">No disponible: las categorías son propias de cada sucursal.</p>
            ) : (
              !sucursalId && <p className="field-help">Selecciona primero una sucursal.</p>
            )}
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
                <div className="pv-stock-ajuste">
                  <div className="pv-stock-ajuste-actual">{stockMostrado} unidades</div>
                  <div className="pv-stock-ajuste-row">
                    <input
                      type="number"
                      className="field-input pv-stock-ajuste-cantidad"
                      placeholder="Nuevo stock"
                      min="0"
                      step="1"
                      value={nuevoStock}
                      onChange={(e) => setNuevoStock(e.target.value)}
                    />
                    <input
                      type="text"
                      className="field-input"
                      placeholder="Observación (ej. conteo físico, merma...)"
                      value={ajusteObservacion}
                      onChange={(e) => setAjusteObservacion(e.target.value)}
                    />
                    <button type="button" className="btn btn-outline btn-sm" onClick={handleAjustarStock} disabled={ajustando}>
                      {ajustando ? "Ajustando..." : "Ajustar"}
                    </button>
                  </div>
                  {ajusteError && <p className="field-help error">{ajusteError}</p>}
                  <p className="field-help">
                    Escribe el nuevo stock total (no puede ser negativo). Queda registrado en el historial de movimientos.
                  </p>
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
  const [filtroSucursal, setFiltroSucursal] = useState("");
  const [precioMin, setPrecioMin] = useState("");
  const [precioMax, setPrecioMax] = useState("");
  const [filtroStock, setFiltroStock] = useState("");

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
      .filter((p) => !filtroSucursal || p.sucursal_id === Number(filtroSucursal))
      .filter((p) => !precioMin || Number(p.precio_base) >= Number(precioMin))
      .filter((p) => !precioMax || Number(p.precio_base) <= Number(precioMax))
      .filter((p) => !filtroStock || stockEstado(p) === filtroStock)
      .filter((p) => !busqueda.trim() || p.nombre.toLowerCase().includes(busqueda.toLowerCase()));
  }, [productos, actor, sucursales, filtroCategoria, filtroSucursal, precioMin, precioMax, filtroStock, busqueda]);

  const stats = useMemo(() => {
    const base = productos.filter((p) => productoVisible(actor, p, sucursales));
    const bajoStock = base.filter((p) => p.maneja_stock && (p.inventario?.cantidad ?? 0) < p.stock_minimo).length;
    return { total: base.length, activos: base.filter((p) => p.activo).length, bajoStock };
  }, [productos, actor, sucursales]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  // Hace el POST/PUT real de un producto (con o sin imagen). Separado de
  // handleSubmit para poder reutilizarlo en el loop de "crear para todas
  // las sucursales", donde se llama una vez por sucursal con el mismo
  // archivo de imagen (si hay) pero un sucursal_id distinto cada vez.
  async function crearOEditarProducto(payload, { imagenFile, quitarImagen } = {}, idParaEditar = null) {
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

      if (idParaEditar) {
        // Laravel no parsea multipart en verbos PUT reales, así que se
        // manda por POST con el spoof estándar de _method (igual que
        // cualquier <form method="POST"><input name="_method" value="PUT">).
        formData.append("_method", "PUT");
        await api.uploadFile(`/productos/${idParaEditar}`, formData);
      } else {
        await api.uploadFile("/productos", formData);
      }
    } else if (idParaEditar) {
      await api.put(`/productos/${idParaEditar}`, payload);
    } else {
      await api.post("/productos", payload);
    }
  }

  async function handleSubmit(payload, { imagenFile, quitarImagen } = {}) {
    setSaving(true);
    try {
      if (payload.crear_para_todas) {
        const { crear_para_todas, ...datos } = payload;
        let creados = 0;
        let omitidos = 0;
        for (const s of sucursales) {
          const yaExiste = productos.some(
            (p) => p.sucursal_id === s.id_sucursal && p.nombre.toLowerCase() === datos.nombre.toLowerCase()
          );
          if (yaExiste) {
            omitidos++;
            continue;
          }
          await crearOEditarProducto({ ...datos, sucursal_id: s.id_sucursal }, { imagenFile, quitarImagen });
          creados++;
        }
        showToast(
          omitidos > 0
            ? `Producto creado en ${creados} sucursal(es). Omitido en ${omitidos} donde ya existía un producto con ese nombre.`
            : `Producto creado en las ${creados} sucursales.`
        );
      } else if (formModal.mode === "edit") {
        await crearOEditarProducto(payload, { imagenFile, quitarImagen }, formModal.producto.id_producto);
        showToast("Producto actualizado.");
      } else {
        await crearOEditarProducto(payload, { imagenFile, quitarImagen });
        showToast("Producto creado.");
      }
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
        {actorEsAdminGeneral(actor) && (
          <select className="field-select pv-select" value={filtroSucursal} onChange={(e) => setFiltroSucursal(e.target.value)}>
            <option value="">Todas las sucursales</option>
            {sucursales.map((s) => (
              <option key={s.id_sucursal} value={s.id_sucursal}>
                {s.nombre}
              </option>
            ))}
          </select>
        )}
        <input
          className="field-input pv-precio"
          type="number"
          min="0"
          step="0.01"
          placeholder="Precio mín"
          value={precioMin}
          onChange={(e) => setPrecioMin(e.target.value)}
        />
        <input
          className="field-input pv-precio"
          type="number"
          min="0"
          step="0.01"
          placeholder="Precio máx"
          value={precioMax}
          onChange={(e) => setPrecioMax(e.target.value)}
        />
        <select className="field-select pv-select" value={filtroStock} onChange={(e) => setFiltroStock(e.target.value)}>
          <option value="">Todo el stock</option>
          <option value="disponible">Disponible</option>
          <option value="bajo">Stock bajo</option>
          <option value="sin_stock">Sin stock</option>
          <option value="no_aplica">No maneja stock</option>
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
          onStockAjustado={cargarDatos}
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