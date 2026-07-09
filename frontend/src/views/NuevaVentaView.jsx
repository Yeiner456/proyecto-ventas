import React, { useState, useMemo } from "react";
import { Search, Plus, Minus, Trash2, X, AlertTriangle, Info, Pencil, CheckCircle2 } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import {
  sucursales as sucursalesSeed,
  productos as productosSeed,
  categoriasDeSucursal,
  nombreCategoria,
  inventario as inventarioSeed,
  metodosPago as metodosPagoSeed,
} from "../mocks/seedData";
import { api, ApiError } from "../services/apiClient";
import ComprobanteModal from "../components/ComprobanteModal";
import "../styles/NuevaVentaView.css";

/* ============================================================================
 * NUEVA VENTA — POS del cajero
 * ----------------------------------------------------------------------------
 * FLUJO REAL, ya conectado:
 *
 *   1. POST /api/ventas               -> nace en 'pendiente'. NO descuenta
 *      stock ni genera factura (VentaController::store()).
 *   2. Si el método de pago exige comprobante (MetodoPago.requiere_comp) ->
 *      se abre ComprobanteModal, el cajero toma foto o adjunta archivo ->
 *      POST /api/comprobantes-pago.
 *   3. PATCH /api/ventas/{id}/estado { estado: 'pagado' } -> AQUÍ SÍ se
 *      descuenta inventario (InventarioService::descontar) y se genera
 *      la factura (FacturaService::generarParaVenta), dentro de una
 *      transacción (VentaController::cambiarEstado()).
 *
 * El comprobante se sube ANTES del PATCH a 'pagado' a propósito: si algo
 * falla a mitad de camino, la venta se queda en 'pendiente' sin haber
 * tocado el stock — nunca queda una venta "pagada" sin comprobante ni con
 * inventario ya descontado por un error de red.
 *
 * VentaPolicy::create = admin_sucursal || cajero (admin_general entra por
 * before(), pero no tiene sucursal propia — no tendría sentido que operara
 * una caja — por eso esta vista se bloquea para admin_general).
 *
 * LIMITACIÓN PENDIENTE (fuera del alcance de este cambio): el catálogo de
 * productos, categorías, inventario y métodos de pago que se muestran acá
 * siguen viniendo de mocks/seedData.js, no de GET /api/productos,
 * /api/inventario, /api/categorias-productos ni /api/metodos-pago. La
 * venta y el descuento de stock SÍ quedan bien registrados en la base de
 * datos real con este cambio; lo que puede quedar desactualizado es lo
 * que ve el cajero en pantalla (stock, catálogo) hasta que se conecte
 * también esa parte.
 * ==========================================================================*/

function puedeVender(actor) {
  return actor.rol === "admin_sucursal" || actor.rol === "cajero";
}

function formatMoney(n) {
  return `$${Number(n).toLocaleString("es-CO")}`;
}

function AjustePrecioModal({ item, onCancel, onSave }) {
  const [precio, setPrecio] = useState(item.precio_unitario_venta);
  const [nota, setNota] = useState(item.observacion_ajuste ?? "");

  const valido = precio !== "" && Number(precio) >= 0;

  return (
    <div className="modal-overlay" onMouseDown={onCancel}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Ajustar precio — {item.nombre}</h3>
          <button className="modal-close" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        <div className="field">
          <label className="field-label">Precio base: {formatMoney(item.precio_base)}</label>
          <input className="field-input" type="number" min="0" step="0.01" value={precio} onChange={(e) => setPrecio(e.target.value)} />
        </div>
        <div className="field">
          <label className="field-label">Motivo del ajuste (queda registrado)</label>
          <input
            className="field-input"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
            placeholder="ej. cliente frecuente, producto por vencer..."
          />
        </div>
        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onCancel}>Cancelar</button>
          <button className="btn btn-primary" disabled={!valido} onClick={() => onSave(Number(precio), nota.trim() || null)}>
            Aplicar ajuste
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmacionModal({ factura, onCerrar }) {
  return (
    <div className="modal-overlay" onMouseDown={onCerrar}>
      <div className="modal nv-confirm-modal" onMouseDown={(e) => e.stopPropagation()}>
        <CheckCircle2 size={40} className="nv-confirm-icon" />
        <h3 className="modal-title u-mb-4">Venta cobrada</h3>
        <p className="field-help u-mb-4">Factura generada</p>
        <p className="text-mono nv-confirm-numero">{factura.numero_factura}</p>
        <button className="btn btn-primary u-w-full" onClick={onCerrar}>
          Nueva venta
        </button>
      </div>
    </div>
  );
}

export default function NuevaVentaView() {
  const { usuario: actor } = useAuth();
  const autorizado = puedeVender(actor);
  const sucursalId = sucursalesSeed.find((s) => s.nombre === actor.sucursal)?.id_sucursal;

  const [stockLocal, setStockLocal] = useState(() =>
    Object.fromEntries(inventarioSeed.map((i) => [i.producto_id, i.cantidad]))
  );
  const [cart, setCart] = useState([]); // { producto_id, nombre, precio_base, precio_unitario_venta, cantidad, ajuste_precio, observacion_ajuste }
  const [busqueda, setBusqueda] = useState("");
  const [categoriaActiva, setCategoriaActiva] = useState("todos");
  const [metodoPagoId, setMetodoPagoId] = useState(metodosPagoSeed.find((m) => m.es_default)?.id_metodo_pago ?? "");
  const [observacion, setObservacion] = useState("");
  const [ajustando, setAjustando] = useState(null); // item del carrito que se está ajustando
  const [cobrando, setCobrando] = useState(false);
  const [error, setError] = useState(null);
  const [facturaGenerada, setFacturaGenerada] = useState(null);

  // Estado del paso "comprobante de pago" (nuevo)
  const [ventaPendiente, setVentaPendiente] = useState(null); // venta creada en POST, esperando comprobante
  const [mostrarComprobante, setMostrarComprobante] = useState(false);
  const [subiendoComprobante, setSubiendoComprobante] = useState(false);
  const [errorComprobante, setErrorComprobante] = useState(null);

  const productosSucursal = useMemo(() => productosSeed.filter((p) => p.sucursal_id === sucursalId && p.activo), [sucursalId]);
  const categorias = useMemo(() => categoriasDeSucursal(sucursalId), [sucursalId]);

  const productosFiltrados = useMemo(() => {
    return productosSucursal
      .filter((p) => categoriaActiva === "todos" || p.categoria_id === categoriaActiva)
      .filter((p) => !busqueda.trim() || p.nombre.toLowerCase().includes(busqueda.toLowerCase()));
  }, [productosSucursal, categoriaActiva, busqueda]);

  const subtotal = cart.reduce((sum, i) => sum + i.cantidad * i.precio_unitario_venta, 0);
  const ajusteTotal = cart.reduce((sum, i) => sum + (i.precio_base - i.precio_unitario_venta) * i.cantidad, 0);
  const total = subtotal;

  function stockDisponible(producto) {
    if (!producto.maneja_stock) return null;
    const enCarrito = cart.find((i) => i.producto_id === producto.id_producto)?.cantidad ?? 0;
    return (stockLocal[producto.id_producto] ?? 0) - enCarrito;
  }

  function agregarAlCarrito(producto) {
    const disponible = stockDisponible(producto);
    if (producto.maneja_stock && disponible <= 0) return;

    setCart((prev) => {
      const existente = prev.find((i) => i.producto_id === producto.id_producto);
      if (existente) {
        return prev.map((i) =>
          i.producto_id === producto.id_producto ? { ...i, cantidad: i.cantidad + 1 } : i
        );
      }
      return [
        ...prev,
        {
          producto_id: producto.id_producto,
          nombre: producto.nombre,
          precio_base: Number(producto.precio_base),
          precio_unitario_venta: Number(producto.precio_base),
          cantidad: 1,
          maneja_stock: producto.maneja_stock,
          ajuste_precio: false,
          observacion_ajuste: null,
        },
      ];
    });
  }

  function cambiarCantidad(producto_id, delta) {
    setCart((prev) => {
      return prev
        .map((i) => {
          if (i.producto_id !== producto_id) return i;
          const producto = productosSeed.find((p) => p.id_producto === producto_id);
          const nuevaCantidad = i.cantidad + delta;
          if (nuevaCantidad <= 0) return null;
          if (producto?.maneja_stock) {
            const stockTotal = stockLocal[producto_id] ?? 0;
            if (nuevaCantidad > stockTotal) return i; // no deja pasar del stock local
          }
          return { ...i, cantidad: nuevaCantidad };
        })
        .filter(Boolean);
    });
  }

  function quitarDelCarrito(producto_id) {
    setCart((prev) => prev.filter((i) => i.producto_id !== producto_id));
  }

  function guardarAjuste(precio, nota) {
    setCart((prev) =>
      prev.map((i) =>
        i.producto_id === ajustando.producto_id
          ? { ...i, precio_unitario_venta: precio, ajuste_precio: precio !== i.precio_base, observacion_ajuste: nota }
          : i
      )
    );
    setAjustando(null);
  }

  function cancelarVenta() {
    setCart([]);
    setObservacion("");
    setError(null);
  }

  function construirDetalles() {
    return cart.map((item) => ({
      producto_id: item.producto_id,
      cantidad: item.cantidad,
      ...(item.ajuste_precio
        ? { precio_unitario_venta: item.precio_unitario_venta, observacion_ajuste: item.observacion_ajuste }
        : {}),
    }));
  }

  async function finalizarPago(ventaId) {
    const ventaPagada = await api.patch(`/ventas/${ventaId}/estado`, { estado: "pagado" });
    setFacturaGenerada(ventaPagada.factura);
    setVentaPendiente(null);
    setMostrarComprobante(false);
    setCart([]);
    setObservacion("");
  }

  async function cobrar() {
    if (cart.length === 0 || !metodoPagoId) return;
    setError(null);
    setCobrando(true);
    try {
      // Paso 1: nace 'pendiente'. Todavía no descuenta stock ni factura.
      const venta = await api.post("/ventas", {
        metodo_pago_id: Number(metodoPagoId),
        observacion: observacion.trim() || null,
        detalles: construirDetalles(),
      });

      if (metodoSeleccionado?.requiere_comp) {
        // Este método exige comprobante: la venta queda 'pendiente' hasta
        // que el cajero suba la foto/archivo. El modal llama a
        // finalizarPago() cuando el comprobante ya se subió.
        setVentaPendiente(venta);
        setMostrarComprobante(true);
        return;
      }

      // Sin comprobante requerido: se confirma el pago directo.
      await finalizarPago(venta.id_venta);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "No se pudo registrar la venta. Intenta de nuevo.");
    } finally {
      setCobrando(false);
    }
  }

  async function confirmarComprobante(archivo) {
    if (!ventaPendiente) return;
    setSubiendoComprobante(true);
    setErrorComprobante(null);
    try {
      const formData = new FormData();
      formData.append("venta_id", ventaPendiente.id_venta);
      formData.append("archivo", archivo);
      await api.uploadFile("/comprobantes-pago", formData);

      // Con el comprobante ya guardado, recién ahora se confirma el pago:
      // descuenta stock y genera factura.
      await finalizarPago(ventaPendiente.id_venta);
    } catch (err) {
      setErrorComprobante(err instanceof ApiError ? err.message : "No se pudo subir el comprobante.");
    } finally {
      setSubiendoComprobante(false);
    }
  }

  async function cancelarComprobante() {
    // El cajero se arrepintió a mitad del cobro: cancelamos la venta
    // 'pendiente' en el backend para no dejar registros huérfanos.
    if (ventaPendiente) {
      try {
        await api.patch(`/ventas/${ventaPendiente.id_venta}/estado`, {
          estado: "cancelado",
          motivo: "Cancelada por el cajero antes de completar el comprobante",
        });
      } catch {
        // si ni siquiera se pudo cancelar, queda 'pendiente'; se puede
        // resolver luego desde Registro de ventas.
      }
    }
    setVentaPendiente(null);
    setMostrarComprobante(false);
    setErrorComprobante(null);
  }

  if (!autorizado) {
    return (
      <div>
        <div className="breadcrumb">› Nueva venta</div>
        <h1 className="page-title">Nueva venta</h1>
        <div className="alert alert-danger u-max-480">
          <AlertTriangle size={16} className="u-icon-inline" />
          <span>Esta pantalla es para cajeros y administradores de sucursal (VentaPolicy::create).</span>
        </div>
      </div>
    );
  }

  const metodoSeleccionado = metodosPagoSeed.find((m) => m.id_metodo_pago === Number(metodoPagoId));

  return (
    <div>
      <div className="breadcrumb">› Nueva venta</div>
      <h1 className="page-title u-mb-4">Nueva venta</h1>
      <p className="text-muted u-mb-18">{actor.sucursal}</p>

      <div className="nv-layout">
        <div>
          <div className="nv-search">
            <Search size={16} />
            <input className="field-input" placeholder="Buscar producto..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
          </div>

          <div className="nv-pills">
            <button className={`nv-pill${categoriaActiva === "todos" ? " active" : ""}`} onClick={() => setCategoriaActiva("todos")}>
              Todos
            </button>
            {categorias.map((c) => (
              <button
                key={c.id_categoria}
                className={`nv-pill${categoriaActiva === c.id_categoria ? " active" : ""}`}
                onClick={() => setCategoriaActiva(c.id_categoria)}
              >
                {c.nombre}
              </button>
            ))}
          </div>

          <div className="nv-grid">
            {productosFiltrados.map((p) => {
              const disponible = stockDisponible(p);
              const sinStock = p.maneja_stock && disponible <= 0;
              return (
                <button key={p.id_producto} className="nv-card" disabled={sinStock} onClick={() => agregarAlCarrito(p)}>
                  <span className="nv-card-cat">{nombreCategoria(p.categoria_id)}</span>
                  <span className="nv-card-name">{p.nombre}</span>
                  <span className="nv-card-price">{formatMoney(p.precio_base)}</span>
                  {p.maneja_stock && (
                    <span className={`nv-card-stock${disponible <= p.stock_minimo ? " low" : ""}`}>
                      {sinStock ? "Sin stock" : `Stock: ${disponible}`}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <div className="nv-cart">
          <h3 className="nv-cart-title">Orden actual ({cart.length})</h3>

          {cart.length === 0 ? (
            <div className="nv-cart-empty">Agrega productos tocando una tarjeta.</div>
          ) : (
            cart.map((item) => (
              <div className="nv-cart-item" key={item.producto_id}>
                <div className="nv-cart-item-top">
                  <div>
                    <div className="nv-cart-item-name">{item.nombre}</div>
                    <div className="nv-cart-item-price">{formatMoney(item.precio_unitario_venta)}</div>
                    {item.ajuste_precio && (
                      <div className="nv-cart-adjust-note">
                        Precio ajustado {item.observacion_ajuste ? `— ${item.observacion_ajuste}` : ""}
                      </div>
                    )}
                  </div>
                  <div className="nv-cart-item-actions">
                    <button title="Ajustar precio" onClick={() => setAjustando(item)}>
                      <Pencil size={13} />
                    </button>
                    <button title="Quitar" onClick={() => quitarDelCarrito(item.producto_id)}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>
                <div className="nv-qty">
                  <button onClick={() => cambiarCantidad(item.producto_id, -1)}>
                    <Minus size={12} />
                  </button>
                  <span>{item.cantidad}</span>
                  <button onClick={() => cambiarCantidad(item.producto_id, 1)}>
                    <Plus size={12} />
                  </button>
                </div>
              </div>
            ))
          )}

          <div className="nv-totals">
            <div className="nv-total-row">
              <span>Subtotal ({cart.reduce((n, i) => n + i.cantidad, 0)} items)</span>
              <span className="text-mono">{formatMoney(subtotal + ajusteTotal)}</span>
            </div>
            {ajusteTotal !== 0 && (
              <div className="nv-total-row nv-total-row--ajuste">
                <span>Ajuste de precios</span>
                <span className="text-mono">{ajusteTotal > 0 ? "-" : "+"}{formatMoney(Math.abs(ajusteTotal))}</span>
              </div>
            )}
            <div className="nv-total-row grand">
              <span>Total</span>
              <span className="text-mono">{formatMoney(total)}</span>
            </div>
          </div>

          <div className="nv-metodos">
            {metodosPagoSeed.filter((m) => m.activo).map((m) => (
              <button
                key={m.id_metodo_pago}
                className={`nv-metodo-pill${Number(metodoPagoId) === m.id_metodo_pago ? " active" : ""}`}
                onClick={() => setMetodoPagoId(m.id_metodo_pago)}
              >
                {m.nombre}
              </button>
            ))}
          </div>

          {metodoSeleccionado?.requiere_comp && (
            <div className="alert alert-info u-alert-sm">
              <Info size={14} className="u-icon-inline" />
              <span>Este método pide comprobante. Al cobrar te voy a pedir tomar la foto o adjuntarlo antes de finalizar la venta.</span>
            </div>
          )}

          <input
            className="field-input nv-observacion-input"
            placeholder="Observación de la venta..."
            value={observacion}
            onChange={(e) => setObservacion(e.target.value)}
          />

          {error && (
            <div className="alert alert-danger u-alert-xs">
              <AlertTriangle size={14} className="u-icon-inline" />
              <span>{error}</span>
            </div>
          )}

          <button
            className="btn btn-primary u-btn-block-mb"
            disabled={cart.length === 0 || !metodoPagoId || cobrando}
            onClick={cobrar}
          >
            {cobrando ? "Procesando..." : `Cobrar ${formatMoney(total)}`}
          </button>
          <button
            className="btn btn-danger-ghost u-btn-block"
            disabled={cart.length === 0 || cobrando}
            onClick={cancelarVenta}
          >
            Cancelar venta
          </button>
        </div>
      </div>

      {ajustando && (
        <AjustePrecioModal item={ajustando} onCancel={() => setAjustando(null)} onSave={guardarAjuste} />
      )}

      {mostrarComprobante && ventaPendiente && (
        <ComprobanteModal
          ventaId={ventaPendiente.id_venta}
          subiendo={subiendoComprobante}
          error={errorComprobante}
          onConfirmar={confirmarComprobante}
          onCancelar={cancelarComprobante}
        />
      )}

      {facturaGenerada && (
        <ConfirmacionModal factura={facturaGenerada} onCerrar={() => setFacturaGenerada(null)} />
      )}
    </div>
  );
}