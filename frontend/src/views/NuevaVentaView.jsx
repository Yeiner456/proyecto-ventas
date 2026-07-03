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
  facturas as facturasSeed,
} from "../mocks/seedData";
import "../styles/NuevaVentaView.css";

/* ============================================================================
 * NUEVA VENTA — POS del cajero
 * ----------------------------------------------------------------------------
 * FLUJO REAL (esto es lo importante de esta vista, más que el layout):
 *
 *   1. POST /api/ventas            -> nace en 'pendiente'. NO descuenta
 *      stock ni genera factura (VentaController::store()).
 *   2. PATCH /api/ventas/{id}/estado  { estado: 'pagado' } -> AQUÍ SÍ se
 *      descuenta inventario (InventarioService::descontar) y se genera
 *      la factura (FacturaService::generarParaVenta), dentro de una
 *      transacción (VentaController::cambiarEstado()).
 *
 * Por qué dos llamadas y no una: StoreVentaRequest técnicamente permite
 * mandar 'estado' => 'pagado' desde el primer POST, pero si se hace así
 * NINGÚN efecto secundario se dispara (el descuento de stock y la
 * factura viven solo dentro de cambiarEstado()). Crear directo en
 * 'pagado' produciría ventas "pagadas" con inventario sin tocar y sin
 * factura — un bug silencioso. El botón "Cobrar" de abajo replica el
 * camino de 2 pasos a propósito.
 *
 * VentaPolicy::create = admin_sucursal || cajero (admin_general entra
 * por before(), pero no tiene sucursal propia — no tendría sentido que
 * operara una caja — por eso esta vista se bloquea para admin_general y
 * contador, igual que ya está oculta en la Sidebar).
 *
 * LIMITACIÓN DE ESTE PROTOTIPO: el stock y las ventas se llevan en
 * estado local de React (useState), no en un backend real. Al recargar
 * la página, todo vuelve a los valores del seed. Cuando se conecte la
 * API, cada acción aquí se vuelve una llamada real y esta limitación
 * desaparece sola.
 * ==========================================================================*/

function puedeVender(actor) {
  return actor.rol === "admin_sucursal" || actor.rol === "cajero";
}

function formatMoney(n) {
  return `$${Number(n).toLocaleString("es-CO")}`;
}

const wait = (ms = 350) => new Promise((res) => setTimeout(res, ms));


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
          <input className="field-input" value={nota} onChange={(e) => setNota(e.target.value)} placeholder="ej. cliente frecuente, producto por vencer..." />
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
  const [correlativoFactura, setCorrelativoFactura] = useState(facturasSeed.length);

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
            if (nuevaCantidad > stockTotal) return i; // no deja pasar del stock real
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

  async function cobrar() {
    if (cart.length === 0 || !metodoPagoId) return;
    setCobrando(true);
    setError(null);
    try {
      // Paso 1: POST /api/ventas -> nace 'pendiente' (simulado)
      await wait();
      const ventaId = Date.now();

      // Paso 2: PATCH /api/ventas/{id}/estado { estado: 'pagado' }
      // Aquí es donde el backend real descuenta inventario y factura.
      await wait();
      for (const item of cart) {
        if (item.maneja_stock) {
          const disponible = stockLocal[item.producto_id] ?? 0;
          if (disponible < item.cantidad) {
            throw new Error(`Stock insuficiente para "${item.nombre}". Disponible: ${disponible}.`);
          }
        }
      }
      setStockLocal((prev) => {
        const copia = { ...prev };
        cart.forEach((item) => {
          if (item.maneja_stock) copia[item.producto_id] = (copia[item.producto_id] ?? 0) - item.cantidad;
        });
        return copia;
      });

      const siguiente = correlativoFactura + 1;
      setCorrelativoFactura(siguiente);
      const numero = `SUC${String(sucursalId).padStart(2, "0")}-${String(siguiente).padStart(6, "0")}`;

      setFacturaGenerada({ id_factura: ventaId, numero_factura: numero, venta_id: ventaId, total });
      setCart([]);
      setObservacion("");
    } catch (err) {
      setError(err.message);
    } finally {
      setCobrando(false);
    }
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
              <span>Este método pide comprobante. Se sube después de cobrar (pantalla de comprobantes, aún no construida).</span>
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

      {facturaGenerada && (
        <ConfirmacionModal factura={facturaGenerada} onCerrar={() => setFacturaGenerada(null)} />
      )}
    </div>
  );
}
