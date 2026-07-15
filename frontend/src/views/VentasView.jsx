import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Receipt, X, AlertTriangle, Info, ArrowRight, Ban, Trash2, ChevronRight, Loader2, Paperclip, ExternalLink } from "lucide-react";
import { useAuth, esAdminGeneral as actorEsAdminGeneral } from "../context/AuthContext";
import { api, ApiError, comprobanteUrl } from "../services/apiClient";
import "../styles/VentasView.css";

/* ============================================================================
 * VENTAS — Registro / listado, con la máquina de estados
 * ----------------------------------------------------------------------------
 * Un solo componente para 2 rutas de la Sidebar:
 *   /ventas          (admin_general — ve todas las sucursales)
 *   /ventas/registro (admin_sucursal, cajero — ve solo la suya)
 * Mismo patrón que ya usamos en Facturas: mismo componente, el scope lo
 * decide el actor logueado, no la ruta.
 *
 * Venta::ESTADOS = pendiente, en_preparacion, listo_para_entregar,
 * pagado, entregado, cancelado.
 *
 * HALLAZGO IMPORTANTE: el backend (CambiarEstadoVentaRequest +
 * VentaController::cambiarEstado) NO impone un orden de transición —
 * solo bloquea (a) cambiar una venta ya cancelada, y (b) "cambiar" al
 * mismo estado en el que ya está. Es decir, la API aceptaría saltar de
 * 'pendiente' directo a 'entregado' sin pasar por los estados
 * intermedios. Elegí NO exponer eso en la UI: solo ofrezco "avanzar al
 * siguiente estado" + "cancelar", porque un salto libre de estados es
 * un error operativo esperando a pasar (ej. marcar 'entregado' una
 * venta que nunca se pagó). Si el equipo quiere permitir saltos, es un
 * cambio de UI, no de este análisis.
 *
 * VentaPolicy:
 *   - cambiarEstado: admin_sucursal || cajero, de SU sucursal (admin_general
 *     por before()).
 *   - delete: SOLO admin_sucursal (no cajero) de su sucursal. Además el
 *     controlador exige estado en ['pendiente','cancelado'] sin importar
 *     el rol — lo replico literal, incluso para admin_general.
 *
 * GET /api/ventas ya viene con TODO anidado (VentaController::index hace
 * ->with(['sucursal', 'cajero', 'metodoPago', 'detalles.producto'])), así
 * que no hace falta pedir /api/usuarios ni /api/metodos-pago aparte para
 * mostrar nombres. OJO con el nombre de la clave: Eloquent serializa las
 * relaciones camelCase en snake_case — la relación metodoPago() llega
 * como venta.metodo_pago, NO venta.metodoPago.
 * ==========================================================================*/

const ESTADO_SIGUIENTE = {
  pendiente: "en_preparacion",
  en_preparacion: "listo_para_entregar",
  listo_para_entregar: "pagado",
  pagado: "entregado",
};

const ESTADO_LABEL = {
  pendiente: "Pendiente",
  en_preparacion: "En preparación",
  listo_para_entregar: "Listo para entregar",
  pagado: "Pagado",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

const ESTADO_BADGE = {
  pendiente: "badge-warning",
  en_preparacion: "badge-info",
  listo_para_entregar: "badge-info",
  pagado: "badge-success",
  entregado: "badge-success",
  cancelado: "badge-danger",
};

function ventaVisible(actor, venta, sucursales) {
  if (actorEsAdminGeneral(actor)) return true;
  const sucursalActorId = sucursales.find((s) => s.nombre === actor.sucursal)?.id_sucursal;
  return venta.sucursal_id === sucursalActorId;
}

function puedeCambiarEstado(actor, venta, sucursales) {
  if (venta.estado === "cancelado") return false;
  if (actorEsAdminGeneral(actor)) return true;
  if (actor.rol !== "admin_sucursal" && actor.rol !== "cajero") return false;
  return ventaVisible(actor, venta, sucursales);
}

function puedeEliminar(actor, venta, sucursales) {
  // Regla del controlador, aplica a TODOS los roles (incluido admin_general):
  if (!["pendiente", "cancelado"].includes(venta.estado)) return false;
  if (actorEsAdminGeneral(actor)) return true;
  return actor.rol === "admin_sucursal" && ventaVisible(actor, venta, sucursales);
}

function formatFecha(iso) {
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

function formatMoney(n) {
  return `$${Number(n).toLocaleString("es-CO")}`;
}


function CancelarModal({ venta, onCancel, onConfirm, procesando }) {
  const [motivo, setMotivo] = useState("");
  return (
    <div className="modal-overlay" onMouseDown={onCancel}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Cancelar venta #{venta.id_venta}</h3>
          <button className="modal-close" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        {["pagado", "entregado"].includes(venta.estado) && (
          <div className="alert alert-warning">
            <AlertTriangle size={16} className="u-icon-inline" />
            <span>Esta venta ya estaba {ESTADO_LABEL[venta.estado].toLowerCase()}: al cancelarla se devuelve el inventario descontado.</span>
          </div>
        )}
        <div className="field">
          <label className="field-label">Motivo (queda en la auditoría)</label>
          <input className="field-input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ej. cliente se arrepintió" />
        </div>
        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onCancel}>Volver</button>
          <button className="btn btn-danger" disabled={procesando} onClick={() => onConfirm(motivo.trim() || null)}>
            {procesando ? "Cancelando..." : "Confirmar cancelación"}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDeleteModal({ venta, onCancel, onConfirm, deleting }) {
  return (
    <div className="modal-overlay" onMouseDown={onCancel}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Eliminar venta #{venta.id_venta}</h3>
          <button className="modal-close" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>
        <p className="u-confirm-text">
          Esta acción borra el registro por completo (a diferencia de cancelar, que conserva el historial). ¿Continuar?
        </p>
        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onCancel}>Cancelar</button>
          <button className="btn btn-danger" disabled={deleting} onClick={onConfirm}>
            {deleting ? "Eliminando..." : "Eliminar venta"}
          </button>
        </div>
      </div>
    </div>
  );
}

function DetalleModal({ venta: ventaInicial, onClose }) {
  // La lista (GET /api/ventas) no trae 'comprobantes' — solo
  // VentaController::show() lo carga. Se pide fresco al abrir el modal,
  // igual que ya se hace en FacturasView para el método de pago.
  const [venta, setVenta] = useState(ventaInicial);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const data = await api.get(`/ventas/${ventaInicial.id_venta}`);
        if (!cancelado) setVenta(data);
      } catch {
        // si falla, se sigue mostrando lo que ya se tenía de la lista
        // (todo excepto comprobantes, que en ese caso queda vacío).
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [ventaInicial.id_venta]);

  const pasos = ["pendiente", "en_preparacion", "listo_para_entregar", "pagado", "entregado"];
  const indiceActual = pasos.indexOf(venta.estado);
  const comprobantes = venta.comprobantes ?? [];
  const esImagen = (tipo) => ["jpg", "jpeg", "png"].includes((tipo ?? "").toLowerCase());

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal modal-wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Venta #{venta.id_venta}</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        {venta.estado === "cancelado" ? (
          <span className="badge badge-danger">Cancelado</span>
        ) : (
          <div className="vv-timeline">
            {pasos.map((p, i) => (
              <React.Fragment key={p}>
                <span className={`vv-timeline-step${i < indiceActual ? " done" : i === indiceActual ? " current" : ""}`}>
                  {ESTADO_LABEL[p]}
                </span>
                {i < pasos.length - 1 && <ChevronRight size={12} className="vv-timeline-arrow" />}
              </React.Fragment>
            ))}
          </div>
        )}

        <div className="vv-detalle-grid">
          <div><div className="field-help">Sucursal</div>{venta.sucursal?.nombre ?? "—"}</div>
          <div><div className="field-help">Cajero</div>{venta.cajero?.nombre ?? "—"}</div>
          <div><div className="field-help">Fecha</div>{formatFecha(venta.created_at)}</div>
          <div><div className="field-help">Método de pago</div>{venta.metodo_pago?.nombre ?? "Sin definir"}</div>
        </div>

        {venta.observacion && (
          <div className="alert alert-info vv-obs-alert">
            <Info size={14} className="u-icon-inline" />
            <span>{venta.observacion}</span>
          </div>
        )}

        <div className="field-help vv-productos-label">Productos</div>
        {venta.detalles.map((d, i) => (
          <div className="vv-detalle-row" key={i}>
            <span>{d.cantidad} × {d.producto?.nombre ?? "Producto eliminado"}</span>
            <span className="text-mono">{formatMoney(d.cantidad * d.precio_unitario_venta)}</span>
          </div>
        ))}
        <div className="vv-total-row">
          <span>Total</span>
          <span className="text-mono">{formatMoney(venta.total)}</span>
        </div>

        <div className="field-help vv-productos-label">Comprobante de pago</div>
        {cargando ? (
          <div className="u-loading-row">
            <Loader2 size={16} className="u-spin" /> Cargando...
          </div>
        ) : comprobantes.length === 0 ? (
          <p className="text-muted">
            {venta.metodo_pago?.requiere_comp
              ? "Esta venta requería comprobante, pero no tiene ninguno adjunto."
              : "Este método de pago no requiere comprobante."}
          </p>
        ) : (
          <div className="vv-comprobantes">
            {comprobantes.map((c) => (
              <a
                key={c.id_comprobante}
                href={comprobanteUrl(c.id_comprobante)}
                target="_blank"
                rel="noopener noreferrer"
                className="vv-comprobante-item"
              >
                {esImagen(c.tipo_archivo) ? (
                  <img src={comprobanteUrl(c.id_comprobante)} alt="Comprobante de pago" className="vv-comprobante-thumb" />
                ) : (
                  <span className="vv-comprobante-file">
                    <Paperclip size={14} /> Comprobante.{c.tipo_archivo}
                  </span>
                )}
                <ExternalLink size={12} />
              </a>
            ))}
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

export default function VentasView() {
  const { usuario: actor } = useAuth();
  const [ventas, setVentas] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [detalleVenta, setDetalleVenta] = useState(null);
  const [cancelarVenta, setCancelarVenta] = useState(null);
  const [eliminarVenta, setEliminarVenta] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [toast, setToast] = useState(null);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const [ventasData, sucursalesData] = await Promise.all([
        api.getAllPages("/ventas"),
        api.getAllPages("/sucursales"),
      ]);
      setVentas(ventasData);
      setSucursales(sucursalesData);
    } catch (e) {
      setErrorCarga(e instanceof ApiError ? e.message : (e?.message ?? "No se pudieron cargar las ventas."));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const visibles = useMemo(() => {
    return ventas
      .filter((v) => ventaVisible(actor, v, sucursales))
      .filter((v) => !filtroEstado || v.estado === filtroEstado)
      .filter((v) => !desde || v.created_at.slice(0, 10) >= desde)
      .filter((v) => !hasta || v.created_at.slice(0, 10) <= hasta)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [ventas, actor, sucursales, filtroEstado, desde, hasta]);

  const stats = useMemo(() => {
    const base = ventas.filter((v) => ventaVisible(actor, v, sucursales));
    const facturables = base.filter((v) => ["pagado", "entregado"].includes(v.estado));
    return {
      total: base.length,
      pendientes: base.filter((v) => !["pagado", "entregado", "cancelado"].includes(v.estado)).length,
      vendido: facturables.reduce((sum, v) => sum + Number(v.total), 0),
    };
  }, [ventas, actor, sucursales]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function avanzarEstado(venta) {
    const siguiente = ESTADO_SIGUIENTE[venta.estado];
    if (!siguiente) return;
    setProcesando(true);
    try {
      // El backend descuenta inventario/factura solo al llegar a 'pagado'
      // (ver NuevaVentaView) — aquí solo reflejamos el cambio de estado.
      await api.patch(`/ventas/${venta.id_venta}/estado`, { estado: siguiente });
      showToast(`Venta #${venta.id_venta} → ${ESTADO_LABEL[siguiente]}`);
      await cargarDatos();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : (e?.message ?? "No se pudo cambiar el estado de la venta."));
    } finally {
      setProcesando(false);
    }
  }

  async function confirmarCancelacion(motivo) {
    setProcesando(true);
    try {
      await api.patch(`/ventas/${cancelarVenta.id_venta}/estado`, { estado: "cancelado", motivo });
      showToast(`Venta #${cancelarVenta.id_venta} cancelada.`);
      setCancelarVenta(null);
      await cargarDatos();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : (e?.message ?? "No se pudo cancelar la venta."));
    } finally {
      setProcesando(false);
    }
  }

  async function confirmarEliminacion() {
    setProcesando(true);
    try {
      await api.delete(`/ventas/${eliminarVenta.id_venta}`);
      showToast(`Venta #${eliminarVenta.id_venta} eliminada.`);
      setEliminarVenta(null);
      await cargarDatos();
    } catch (e) {
      showToast(e instanceof ApiError ? e.message : (e?.message ?? "No se pudo eliminar la venta."));
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div>
      <div className="breadcrumb">› Ventas</div>
      <div className="vv-header">
        <div>
          <h1 className="page-title">{actorEsAdminGeneral(actor) ? "Ventas" : "Registro de ventas"}</h1>
          <p className="vv-subtitle">
            {actorEsAdminGeneral(actor) ? "Todas las sucursales." : `Ventas de ${actor.sucursal}.`}{" "}
            Las ventas se crean desde "Nueva venta" — aquí se hace seguimiento y cambio de estado.
          </p>
        </div>
      </div>

      <div className="vv-stats">
        <div className="stat-card">
          <div className="stat-label">Ventas</div>
          <div className="stat-value">{stats.total}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">En curso</div>
          <div className={`stat-value${stats.pendientes > 0 ? " u-value-warning" : ""}`}>{stats.pendientes}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total vendido (pagado + entregado)</div>
          <div className="stat-value">{formatMoney(stats.vendido)}</div>
        </div>
      </div>

      <div className="vv-toolbar">
        <select className="field-select vv-select" value={filtroEstado} onChange={(e) => setFiltroEstado(e.target.value)}>
          <option value="">Todos los estados</option>
          {Object.keys(ESTADO_LABEL).map((e) => (
            <option key={e} value={e}>{ESTADO_LABEL[e]}</option>
          ))}
        </select>
        <input className="field-input vv-date" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} title="Desde" />
        <input className="field-input vv-date" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} title="Hasta" />
      </div>

      <div className="data-table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Venta</th>
              <th>Fecha</th>
              {actorEsAdminGeneral(actor) && <th>Sucursal</th>}
              <th>Cajero</th>
              <th>Estado</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr className="empty-row">
                <td colSpan={7}>
                  <div className="u-loading-row">
                    <Loader2 size={18} className="u-spin" /> Cargando ventas...
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
                <td colSpan={7}>No hay ventas que coincidan con el filtro.</td>
              </tr>
            ) : (
              visibles.map((v) => (
                <tr key={v.id_venta}>
                  <td>
                    <div className="vv-numero-cell">
                      <Receipt size={14} className="vv-numero-icon" />
                      <span className="text-mono">#{v.id_venta}</span>
                    </div>
                  </td>
                  <td className="text-mono">{formatFecha(v.created_at)}</td>
                  {actorEsAdminGeneral(actor) && <td>{v.sucursal?.nombre ?? "—"}</td>}
                  <td>{v.cajero?.nombre ?? "—"}</td>
                  <td>
                    <span className={`badge ${ESTADO_BADGE[v.estado]}`}>{ESTADO_LABEL[v.estado]}</span>
                  </td>
                  <td className="text-mono">{formatMoney(v.total)}</td>
                  <td>
                    <div className="vv-row-actions">
                      <button className="btn btn-outline btn-sm" onClick={() => setDetalleVenta(v)}>
                        Ver
                      </button>
                      {ESTADO_SIGUIENTE[v.estado] && puedeCambiarEstado(actor, v, sucursales) && (
                        <button className="btn btn-outline btn-sm" title={`Avanzar a ${ESTADO_LABEL[ESTADO_SIGUIENTE[v.estado]]}`} onClick={() => avanzarEstado(v)} disabled={procesando}>
                          <ArrowRight size={13} />
                        </button>
                      )}
                      {v.estado !== "cancelado" && puedeCambiarEstado(actor, v, sucursales) && (
                        <button className="btn btn-danger-ghost btn-sm" title="Cancelar venta" onClick={() => setCancelarVenta(v)}>
                          <Ban size={13} />
                        </button>
                      )}
                      {puedeEliminar(actor, v, sucursales) && (
                        <button className="btn btn-danger-ghost btn-sm" title="Eliminar" onClick={() => setEliminarVenta(v)}>
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {detalleVenta && <DetalleModal venta={detalleVenta} onClose={() => setDetalleVenta(null)} />}

      {cancelarVenta && (
        <CancelarModal venta={cancelarVenta} procesando={procesando} onCancel={() => setCancelarVenta(null)} onConfirm={confirmarCancelacion} />
      )}

      {eliminarVenta && (
        <ConfirmDeleteModal venta={eliminarVenta} deleting={procesando} onCancel={() => setEliminarVenta(null)} onConfirm={confirmarEliminacion} />
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
