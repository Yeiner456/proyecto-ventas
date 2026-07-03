import React, { useState, useMemo } from "react";
import { Receipt, X, AlertTriangle, Info, ArrowRight, Ban, Trash2, ChevronRight } from "lucide-react";
import { useAuth, esAdminGeneral as actorEsAdminGeneral } from "../context/AuthContext";
import {
  sucursales as sucursalesSeed,
  ventas as ventasSeed,
  usuarios as usuariosSeed,
  nombreSucursal,
  nombreMetodoPago,
} from "../mocks/seedData";

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

const wait = (ms = 350) => new Promise((res) => setTimeout(res, ms));

function nombreCajero(id_usuario) {
  return usuariosSeed.find((u) => u.id_usuario === id_usuario)?.nombre ?? "—";
}

function ventaVisible(actor, venta) {
  if (actorEsAdminGeneral(actor)) return true;
  const sucursalActorId = sucursalesSeed.find((s) => s.nombre === actor.sucursal)?.id_sucursal;
  return venta.sucursal_id === sucursalActorId;
}

function puedeCambiarEstado(actor, venta) {
  if (venta.estado === "cancelado") return false;
  if (actorEsAdminGeneral(actor)) return true;
  if (actor.rol !== "admin_sucursal" && actor.rol !== "cajero") return false;
  return ventaVisible(actor, venta);
}

function puedeEliminar(actor, venta) {
  // Regla del controlador, aplica a TODOS los roles (incluido admin_general):
  if (!["pendiente", "cancelado"].includes(venta.estado)) return false;
  if (actorEsAdminGeneral(actor)) return true;
  return actor.rol === "admin_sucursal" && ventaVisible(actor, venta);
}

function formatFecha(iso) {
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

function formatMoney(n) {
  return `$${Number(n).toLocaleString("es-CO")}`;
}

const styles = `
.vv-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; gap: 16px; flex-wrap: wrap; }
.vv-subtitle { font-family: 'Roboto', sans-serif; font-size: 14px; color: var(--text-secondary); margin: 0; max-width: 620px; line-height: 1.5; }
.vv-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 16px; margin-bottom: 20px; }
.vv-toolbar { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
.vv-select { max-width: 200px; }
.vv-date { max-width: 160px; }
.vv-row-actions { display: flex; gap: 6px; }
.vv-detalle-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border); font-family: 'Roboto', sans-serif; font-size: 13px; }
.vv-detalle-row:last-child { border-bottom: none; }
.vv-total-row { display: flex; justify-content: space-between; padding-top: 10px; margin-top: 4px; font-family: 'Inter', sans-serif; font-weight: 700; font-size: 15px; }
.vv-timeline { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin: 14px 0; }
.vv-timeline-step { font-family: 'Roboto', sans-serif; font-size: 11.5px; padding: 4px 10px; border-radius: 999px; background: #F3F4F6; color: var(--text-secondary); }
.vv-timeline-step.done { background: var(--green-soft); color: var(--sena-green-dark); }
.vv-timeline-step.current { background: var(--sena-green); color: var(--white); font-weight: 500; }
`;

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
            <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
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
        <p style={{ fontFamily: "'Roboto', sans-serif", fontSize: 14, lineHeight: 1.5 }}>
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

function DetalleModal({ venta, onClose }) {
  const pasos = ["pendiente", "en_preparacion", "listo_para_entregar", "pagado", "entregado"];
  const indiceActual = pasos.indexOf(venta.estado);

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
                {i < pasos.length - 1 && <ChevronRight size={12} style={{ color: "var(--text-secondary)" }} />}
              </React.Fragment>
            ))}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, margin: "16px 0", fontFamily: "'Roboto', sans-serif", fontSize: 13 }}>
          <div><div className="field-help">Sucursal</div>{nombreSucursal(venta.sucursal_id)}</div>
          <div><div className="field-help">Cajero</div>{nombreCajero(venta.cajero_id)}</div>
          <div><div className="field-help">Fecha</div>{formatFecha(venta.created_at)}</div>
          <div><div className="field-help">Método de pago</div>{venta.metodo_pago_id ? nombreMetodoPago(venta.metodo_pago_id) : "Sin definir"}</div>
        </div>

        {venta.observacion && (
          <div className="alert alert-info" style={{ fontSize: 12.5 }}>
            <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} />
            <span>{venta.observacion}</span>
          </div>
        )}

        <div className="field-help" style={{ marginBottom: 8, textTransform: "uppercase", letterSpacing: ".03em" }}>Productos</div>
        {venta.detalles.map((d, i) => (
          <div className="vv-detalle-row" key={i}>
            <span>{d.cantidad} × {d.nombre}</span>
            <span className="text-mono">{formatMoney(d.cantidad * d.precio_unitario_venta)}</span>
          </div>
        ))}
        <div className="vv-total-row">
          <span>Total</span>
          <span className="text-mono">{formatMoney(venta.total)}</span>
        </div>

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

export default function VentasView() {
  const { usuario: actor } = useAuth();
  const [ventas, setVentas] = useState(ventasSeed);
  const [filtroEstado, setFiltroEstado] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [detalleVenta, setDetalleVenta] = useState(null);
  const [cancelarVenta, setCancelarVenta] = useState(null);
  const [eliminarVenta, setEliminarVenta] = useState(null);
  const [procesando, setProcesando] = useState(false);
  const [toast, setToast] = useState(null);

  const visibles = useMemo(() => {
    return ventas
      .filter((v) => ventaVisible(actor, v))
      .filter((v) => !filtroEstado || v.estado === filtroEstado)
      .filter((v) => !desde || v.created_at.slice(0, 10) >= desde)
      .filter((v) => !hasta || v.created_at.slice(0, 10) <= hasta)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [ventas, actor, filtroEstado, desde, hasta]);

  const stats = useMemo(() => {
    const base = ventas.filter((v) => ventaVisible(actor, v));
    const facturables = base.filter((v) => ["pagado", "entregado"].includes(v.estado));
    return {
      total: base.length,
      pendientes: base.filter((v) => !["pagado", "entregado", "cancelado"].includes(v.estado)).length,
      vendido: facturables.reduce((sum, v) => sum + Number(v.total), 0),
    };
  }, [ventas, actor]);

  function showToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  }

  async function avanzarEstado(venta) {
    const siguiente = ESTADO_SIGUIENTE[venta.estado];
    if (!siguiente) return;
    setProcesando(true);
    try {
      await wait();
      // El backend descuenta inventario/factura solo al llegar a 'pagado'
      // (ver NuevaVentaView) — aquí solo reflejamos el cambio de estado.
      setVentas((prev) => prev.map((v) => (v.id_venta === venta.id_venta ? { ...v, estado: siguiente } : v)));
      showToast(`Venta #${venta.id_venta} → ${ESTADO_LABEL[siguiente]}`);
    } finally {
      setProcesando(false);
    }
  }

  async function confirmarCancelacion(motivo) {
    setProcesando(true);
    try {
      await wait();
      setVentas((prev) =>
        prev.map((v) => (v.id_venta === cancelarVenta.id_venta ? { ...v, estado: "cancelado", observacion: motivo ?? v.observacion } : v))
      );
      showToast(`Venta #${cancelarVenta.id_venta} cancelada.`);
      setCancelarVenta(null);
    } finally {
      setProcesando(false);
    }
  }

  async function confirmarEliminacion() {
    setProcesando(true);
    try {
      await wait();
      setVentas((prev) => prev.filter((v) => v.id_venta !== eliminarVenta.id_venta));
      showToast(`Venta #${eliminarVenta.id_venta} eliminada.`);
      setEliminarVenta(null);
    } finally {
      setProcesando(false);
    }
  }

  return (
    <div>
      <style>{styles}</style>
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
          <div className="stat-value" style={{ color: stats.pendientes > 0 ? "var(--warning)" : "inherit" }}>{stats.pendientes}</div>
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
            {visibles.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={7}>No hay ventas que coincidan con el filtro.</td>
              </tr>
            ) : (
              visibles.map((v) => (
                <tr key={v.id_venta}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <Receipt size={14} style={{ color: "var(--sena-green-dark)" }} />
                      <span className="text-mono">#{v.id_venta}</span>
                    </div>
                  </td>
                  <td className="text-mono">{formatFecha(v.created_at)}</td>
                  {actorEsAdminGeneral(actor) && <td>{nombreSucursal(v.sucursal_id)}</td>}
                  <td>{nombreCajero(v.cajero_id)}</td>
                  <td>
                    <span className={`badge ${ESTADO_BADGE[v.estado]}`}>{ESTADO_LABEL[v.estado]}</span>
                  </td>
                  <td className="text-mono">{formatMoney(v.total)}</td>
                  <td>
                    <div className="vv-row-actions">
                      <button className="btn btn-outline btn-sm" onClick={() => setDetalleVenta(v)}>
                        Ver
                      </button>
                      {ESTADO_SIGUIENTE[v.estado] && puedeCambiarEstado(actor, v) && (
                        <button className="btn btn-outline btn-sm" title={`Avanzar a ${ESTADO_LABEL[ESTADO_SIGUIENTE[v.estado]]}`} onClick={() => avanzarEstado(v)} disabled={procesando}>
                          <ArrowRight size={13} />
                        </button>
                      )}
                      {v.estado !== "cancelado" && puedeCambiarEstado(actor, v) && (
                        <button className="btn btn-danger-ghost btn-sm" title="Cancelar venta" onClick={() => setCancelarVenta(v)}>
                          <Ban size={13} />
                        </button>
                      )}
                      {puedeEliminar(actor, v) && (
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
        <div style={{ position: "fixed", bottom: 24, right: 24, background: "var(--ink)", color: "var(--white)", padding: "12px 18px", borderRadius: 8, fontFamily: "'Roboto', sans-serif", fontSize: 13.5, display: "flex", alignItems: "center", gap: 8, boxShadow: "0 8px 24px rgba(0,0,0,.25)" }}>
          <Info size={15} />
          {toast}
        </div>
      )}
    </div>
  );
}
