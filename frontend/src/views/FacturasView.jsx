import React, { useState, useEffect, useCallback, useMemo } from "react";
import { FileText, Search, X, AlertTriangle, Download, Receipt, Loader2, Paperclip, ExternalLink } from "lucide-react";
import { useAuth, esAdminGeneral as actorEsAdminGeneral } from "../context/AuthContext";
import { api, ApiError, storageUrl } from "../services/apiClient";
import { descargarFacturaPDF } from "../utils/exportar";
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
 * roles (por eso está en la Sidebar para admin_general, admin_sucursal y
 * cajero — es el único listado de "Ventas" al que el cajero también
 * tiene acceso además de Nueva venta/Registro de ventas).
 *
 * DESCARGA DE PDF: el modelo Factura tiene un campo 'pdf_ruta', pero
 * FacturaService nunca lo llena y no existe ningún endpoint que sirva o
 * genere un PDF — ni en FacturaController ni en routes/api.php. En vez
 * de tocar el backend (instalar librería PHP, endpoint nuevo) a días de
 * la entrega, el PDF se arma en el navegador con los mismos datos que
 * ya carga este modal (descargarFacturaPDF() en utils/exportar.js) —
 * mismo patrón ya probado en ReportesView, cero endpoints nuevos.
 *
 * DETALLE DE LA FACTURA: FacturaController::show() NO carga
 * venta.metodoPago (solo 'venta.detalles.producto', 'sucursal', 'cajero'),
 * así que ese dato no estaría disponible ahí. En vez de mostrar un
 * método de pago vacío o inventarlo, el modal de detalle pide
 * GET /api/ventas/{venta_id} en su lugar — VentaController::show() SÍ
 * carga sucursal, cajero, metodoPago, detalles.producto y factura en una
 * sola llamada, así que cubre todo lo que necesita este modal sin tener
 * que tocar el backend.
 * ==========================================================================*/

function facturaVisible(actor, factura, sucursales) {
  if (actorEsAdminGeneral(actor)) return true;
  const sucursalActorId = sucursales.find((s) => s.nombre === actor.sucursal)?.id_sucursal;
  return factura.sucursal_id === sucursalActorId;
}

function formatFecha(iso) {
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

function formatMoney(n) {
  return `$${Number(n).toLocaleString("es-CO")}`;
}

function FacturaDetalleModal({ factura, onClose }) {
  const [venta, setVenta] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const data = await api.get(`/ventas/${factura.venta_id}`);
        if (!cancelado) setVenta(data);
      } catch (e) {
        if (!cancelado) setError(e instanceof ApiError ? e.message : (e?.message ?? "No se pudo cargar el detalle de la venta."));
      } finally {
        if (!cancelado) setCargando(false);
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [factura.venta_id]);

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
            {factura.sucursal?.nombre ?? "—"}
          </div>
          <div>
            <div className="field-help">Cajero</div>
            {factura.cajero?.nombre ?? "—"}
          </div>
          <div>
            <div className="field-help">Método de pago</div>
            {cargando ? "Cargando..." : venta?.metodo_pago?.nombre ?? "—"}
          </div>
          <div>
            <div className="field-help">Venta asociada</div>
            <span className="text-mono">#{factura.venta_id}</span>
          </div>
        </div>

        {cargando ? (
          <div className="u-loading-row">
            <Loader2 size={18} className="u-spin" /> Cargando productos de la venta...
          </div>
        ) : error ? (
          <div className="alert alert-warning">
            <AlertTriangle size={16} className="u-icon-inline" />
            <span>{error}</span>
          </div>
        ) : venta ? (
          <div>
            <div className="field-help fv-productos-label">
              Productos
            </div>
            {venta.detalles.map((d, i) => (
              <div className="fv-detalle-row" key={i}>
                <span>{d.cantidad} × {d.producto?.nombre ?? "Producto eliminado"}</span>
                <span className="text-mono">{formatMoney(d.cantidad * d.precio_unitario_venta)}</span>
              </div>
            ))}
            <div className="fv-total-row">
              <span>Total</span>
              <span className="text-mono">{formatMoney(factura.total)}</span>
            </div>

            <div className="field-help fv-productos-label">Comprobante de pago</div>
            {(venta.comprobantes ?? []).length === 0 ? (
              <p className="text-muted">
                {venta.metodo_pago?.requiere_comp
                  ? "Esta venta requería comprobante, pero no tiene ninguno adjunto."
                  : "Este método de pago no requiere comprobante."}
              </p>
            ) : (
              <div className="fv-comprobantes">
                {venta.comprobantes.map((c) => (
                  <a
                    key={c.id_comprobante}
                    href={storageUrl(c.archivo_ruta)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="fv-comprobante-item"
                  >
                    {["jpg", "jpeg", "png"].includes((c.tipo_archivo ?? "").toLowerCase()) ? (
                      <img src={storageUrl(c.archivo_ruta)} alt="Comprobante de pago" className="fv-comprobante-thumb" />
                    ) : (
                      <span className="fv-comprobante-file">
                        <Paperclip size={14} /> Comprobante.{c.tipo_archivo}
                      </span>
                    )}
                    <ExternalLink size={12} />
                  </a>
                ))}
              </div>
            )}
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
            disabled={cargando || !venta}
            onClick={() => descargarFacturaPDF(factura, venta)}
            title={cargando ? "Cargando datos de la venta..." : undefined}
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
  const [facturas, setFacturas] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [seleccionada, setSeleccionada] = useState(null);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const [facturasData, sucursalesData] = await Promise.all([
        api.getAllPages("/facturas"),
        api.getAllPages("/sucursales"),
      ]);
      setFacturas(facturasData);
      setSucursales(sucursalesData);
    } catch (e) {
      setErrorCarga(e instanceof ApiError ? e.message : (e?.message ?? "No se pudieron cargar las facturas."));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const visibles = useMemo(() => {
    return facturas
      .filter((f) => facturaVisible(actor, f, sucursales))
      .filter((f) => !busqueda.trim() || f.numero_factura.toLowerCase().includes(busqueda.toLowerCase()))
      .filter((f) => !desde || f.created_at.slice(0, 10) >= desde)
      .filter((f) => !hasta || f.created_at.slice(0, 10) <= hasta)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [facturas, actor, sucursales, busqueda, desde, hasta]);

  const stats = useMemo(() => {
    const base = facturas.filter((f) => facturaVisible(actor, f, sucursales));
    const totalFacturado = base.reduce((sum, f) => sum + Number(f.total), 0);
    return {
      cantidad: base.length,
      totalFacturado,
      promedio: base.length ? totalFacturado / base.length : 0,
    };
  }, [facturas, actor, sucursales]);

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
            {cargando ? (
              <tr className="empty-row">
                <td colSpan={6}>
                  <div className="u-loading-row">
                    <Loader2 size={18} className="u-spin" /> Cargando facturas...
                  </div>
                </td>
              </tr>
            ) : errorCarga ? (
              <tr className="empty-row">
                <td colSpan={6}>
                  <div className="alert alert-danger u-max-480">
                    <AlertTriangle size={16} className="u-icon-inline" />
                    <span>{errorCarga}</span>
                  </div>
                </td>
              </tr>
            ) : visibles.length === 0 ? (
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
                  {actorEsAdminGeneral(actor) && <td>{f.sucursal?.nombre ?? "—"}</td>}
                  <td>{f.cajero?.nombre ?? "—"}</td>
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
