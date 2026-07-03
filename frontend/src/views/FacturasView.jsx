import React, { useState, useMemo } from "react";
import { FileText, Search, X, AlertTriangle, Download, Receipt } from "lucide-react";
import { useAuth, esAdminGeneral as actorEsAdminGeneral } from "../context/AuthContext";
import {
  facturas as facturasSeed,
  ventaDe,
  nombreMetodoPago,
  nombreSucursal,
  sucursales as sucursalesSeed,
  usuarios as usuariosSeed,
} from "../mocks/seedData";
import "../styles/FacturasView.css";

/* ============================================================================
 * FACTURAS — Vista de solo lectura
 * ----------------------------------------------------------------------------
 * Contrato real:
 *   GET /api/facturas               -> listar (paginado, scoped por sucursal)
 *   GET /api/facturas/{id_factura}  -> ver detalle
 *
 * FacturaController SOLO expone index/show (ver routes/api.php:
 *   ->only(['index', 'show'])). No hay store/update/destroy: las facturas
 * nace automáticamente cuando una venta pasa a 'pagado', vía
 * FacturaService::generarParaVenta(). Por eso esta vista no tiene botón
 * "Nueva factura" ni de eliminar — sería una acción que la API ni
 * siquiera acepta.
 *
 * FacturaPolicy: viewAny=true y view=scoped por sucursal para todos los
 * roles (por eso está en la Sidebar para admin_general, admin_sucursal,
 * cajero Y contador — es el único CRUD de "Ventas" al que el cajero
 * también tiene acceso además de Nueva venta/Registro de ventas).
 *
 * NOTA: el modelo Factura tiene un campo 'pdf_ruta', pero no until que
 * revisé encontré ningún endpoint que lo sirva o genere un PDF
 * descargable — ni en FacturaController ni en routes/api.php. El botón
 * "Descargar PDF" de abajo está deshabilitado a propósito con esa
 * explicación; lo dejo como pendiente a discutir con el equipo, no lo
 * invento en el frontend.
 * ==========================================================================*/

function nombreCajero(id_usuario) {
  return usuariosSeed.find((u) => u.id_usuario === id_usuario)?.nombre ?? "—";
}

function facturaVisible(actor, factura) {
  if (actorEsAdminGeneral(actor)) return true;
  const sucursalActorId = sucursalesSeed.find((s) => s.nombre === actor.sucursal)?.id_sucursal;
  return factura.sucursal_id === sucursalActorId;
}

function formatFecha(iso) {
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

function formatMoney(n) {
  return `$${Number(n).toLocaleString("es-CO")}`;
}


function FacturaDetalleModal({ factura, onClose }) {
  const venta = ventaDe(factura.venta_id);

  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal modal-wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h3 className="modal-title text-mono">{factura.numero_factura}</h3>
            <p className="field-help fv-modal-fecha">{formatFecha(factura.created_at)}</p>
          </div>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="fv-detalle-grid">
          <div>
            <div className="field-help">Sucursal</div>
            {nombreSucursal(factura.sucursal_id)}
          </div>
          <div>
            <div className="field-help">Cajero</div>
            {nombreCajero(factura.cajero_id)}
          </div>
          <div>
            <div className="field-help">Método de pago</div>
            {venta ? nombreMetodoPago(venta.metodo_pago_id) : "—"}
          </div>
          <div>
            <div className="field-help">Venta asociada</div>
            <span className="text-mono">#{factura.venta_id}</span>
          </div>
        </div>

        {venta ? (
          <div>
            <div className="field-help fv-productos-label">
              Productos
            </div>
            {venta.detalles.map((d, i) => (
              <div className="fv-detalle-row" key={i}>
                <span>{d.cantidad} × {d.nombre}</span>
                <span className="text-mono">{formatMoney(d.cantidad * d.precio_unitario_venta)}</span>
              </div>
            ))}
            <div className="fv-total-row">
              <span>Total</span>
              <span className="text-mono">{formatMoney(factura.total)}</span>
            </div>
          </div>
        ) : (
          <div className="alert alert-warning">
            <AlertTriangle size={16} className="u-icon-inline" />
            <span>No se encontró la venta asociada a esta factura.</span>
          </div>
        )}

        <div className="modal-actions">
          <button
            className="btn btn-outline"
            disabled
            title="El backend aún no expone un endpoint para descargar el PDF de la factura"
          >
            <Download size={14} /> Descargar PDF
          </button>
          <button className="btn btn-primary" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}

export default function FacturasView() {
  const { usuario: actor } = useAuth();
  const [busqueda, setBusqueda] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [seleccionada, setSeleccionada] = useState(null);

  const visibles = useMemo(() => {
    return facturasSeed
      .filter((f) => facturaVisible(actor, f))
      .filter((f) => !busqueda.trim() || f.numero_factura.toLowerCase().includes(busqueda.toLowerCase()))
      .filter((f) => !desde || f.created_at.slice(0, 10) >= desde)
      .filter((f) => !hasta || f.created_at.slice(0, 10) <= hasta)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [actor, busqueda, desde, hasta]);

  const stats = useMemo(() => {
    const base = facturasSeed.filter((f) => facturaVisible(actor, f));
    const totalFacturado = base.reduce((sum, f) => sum + Number(f.total), 0);
    return {
      cantidad: base.length,
      totalFacturado,
      promedio: base.length ? totalFacturado / base.length : 0,
    };
  }, [actor]);

  return (
    <div>
      <div className="breadcrumb">› Facturas</div>
      <div className="fv-header">
        <div>
          <h1 className="page-title">Facturas</h1>
          <p className="fv-subtitle">
            {actorEsAdminGeneral(actor)
              ? "Facturas generadas en todas las sucursales."
              : `Facturas de ${actor.sucursal}.`}{" "}
            Se generan automáticamente al confirmar el pago de una venta — no se crean ni editan manualmente aquí.
          </p>
        </div>
      </div>

      <div className="fv-stats">
        <div className="stat-card">
          <div className="stat-label">Facturas</div>
          <div className="stat-value">{stats.cantidad}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Total facturado</div>
          <div className="stat-value">{formatMoney(stats.totalFacturado)}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Ticket promedio</div>
          <div className="stat-value">{formatMoney(Math.round(stats.promedio))}</div>
        </div>
      </div>

      <div className="fv-toolbar">
        <div className="fv-search">
          <Search size={15} />
          <input
            className="field-input"
            placeholder="Buscar por número de factura..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
          />
        </div>
        <input className="field-input fv-date" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} title="Desde" />
        <input className="field-input fv-date" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} title="Hasta" />
      </div>

      <div className="data-table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>N° Factura</th>
              <th>Fecha</th>
              {actorEsAdminGeneral(actor) && <th>Sucursal</th>}
              <th>Cajero</th>
              <th>Total</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={6}>No hay facturas que coincidan con el filtro.</td>
              </tr>
            ) : (
              visibles.map((f) => (
                <tr key={f.id_factura}>
                  <td>
                    <div className="fv-numero-cell">
                      <Receipt size={14} className="fv-numero-icon" />
                      <span className="text-mono">{f.numero_factura}</span>
                    </div>
                  </td>
                  <td className="text-mono">{formatFecha(f.created_at)}</td>
                  {actorEsAdminGeneral(actor) && <td>{nombreSucursal(f.sucursal_id)}</td>}
                  <td>{nombreCajero(f.cajero_id)}</td>
                  <td className="text-mono">{formatMoney(f.total)}</td>
                  <td>
                    <button className="btn btn-outline btn-sm" onClick={() => setSeleccionada(f)}>
                      <FileText size={14} /> Ver
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {seleccionada && <FacturaDetalleModal factura={seleccionada} onClose={() => setSeleccionada(null)} />}
    </div>
  );
}
