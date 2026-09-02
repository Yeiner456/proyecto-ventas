import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, PackageX, Bell, Receipt, ArrowRight, ShoppingCart, Users, Loader2, AlertTriangle } from "lucide-react";
import { useAuth, esAdminGeneral as actorEsAdminGeneral } from "../context/AuthContext";
import { api, ApiError } from "../services/apiClient";
import "../styles/DashboardView.css";

/* ============================================================================
 * DASHBOARD — vista de agregación, no un CRUD
 * ----------------------------------------------------------------------------
 * IMPORTANTE: no existe /api/dashboard en el backend. Esta pantalla
 * compone datos que YA vienen de otros endpoints (ventas, facturas,
 * productos, notificaciones, sucursales) — es responsabilidad del
 * FRONTEND armar el resumen, no algo que el backend calcule y entregue
 * hecho.
 *
 * Implicación de rendimiento: son 5 requests solo para pintar el
 * dashboard. Con pocos usuarios no importa; si llega a pesar, la
 * solución NO es crear más lógica en el frontend sino pedirle al equipo
 * de backend un endpoint de agregación (GET /api/dashboard/resumen) que
 * haga las sumas en SQL en vez de traer todas las filas y sumarlas en
 * el navegador. Lo señalo ahora para que no se sorprendan si el
 * dashboard se siente pesado más adelante — no es un bug, es una
 * decisión pendiente de escala.
 *
 * ventas/facturas/productos ya llegan filtrados por sucursal para
 * cualquiera que no sea admin_general (FiltraPorSucursal en el
 * backend), así que no se repite ese filtro acá. notificaciones SÍ
 * necesita un filtro adicional en el frontend porque su index() no
 * replica la regla completa de NotificacionPolicy (ver NotificacionesView).
 *
 * Contenido por rol (decisión de producto, no hay boceto para esto):
 *   - admin_general: panorama de todas las sucursales.
 *   - admin_sucursal / cajero: el día a día de SU sucursal + acceso
 *     directo a Nueva venta.
 *
 * LIMPIEZA: se quitó una rama muerta que mostraba KPIs distintos para
 * actor.rol === "contador" — ese rol no existe en el sistema (ver
 * RolSeeder / migración de datos inicial: solo admin_general,
 * admin_sucursal, cajero), así que esa rama nunca se ejecutaba.
 *
 * "FACTURADO HOY" (antes "Total facturado", cambio del 2026):
 *   El KPI de dinero y su desglose por sucursal mostraban la suma
 *   HISTÓRICA de todas las facturas desde que existe el sistema. Los
 *   usuarios lo leían como "cuánto llevo hoy" y terminaban yendo a
 *   Reportes → Ventas a armar un filtro de fecha cada vez que querían
 *   saber el corte del día. Ahora ambos (KPI y desglose por sucursal)
 *   muestran solo lo facturado en la fecha de HOY. El histórico
 *   completo sigue disponible en Reportes → Ventas, que es su lugar
 *   natural — no se duplica aquí a propósito.
 *
 *   No se agregó ningún query param ni endpoint nuevo al backend:
 *   'facturas' ya se trae completo (getAllPages) y el corte por día se
 *   hace en memoria con useMemo, igual que el filtro de fecha de
 *   Reportes → Ventas (ver reportesService.js). Si el volumen de
 *   facturas crece mucho, esto entra en la misma nota de rendimiento
 *   de más arriba.
 *
 *   "Hoy" se calcula con la fecha LOCAL del navegador (hoyLocalISO(),
 *   NO toISOString() — que convierte a UTC y podría desfasar el corte
 *   de medianoche) y se compara contra los primeros 10 caracteres de
 *   created_at, el mismo criterio que ya usan los filtros 'desde'/
 *   'hasta' de VentasView/FacturasView. Al recalcularse en cada
 *   montaje del componente, basta con recargar/volver a entrar al
 *   Dashboard para que el corte quede en el día correcto — no hace
 *   falta polling ni auto-refresco (decisión explícita del equipo).
 *
 *   'Ventas registradas' y 'En curso' NO cambiaron: siguen siendo
 *   conteos de estado/histórico, no montos de dinero, y no fueron parte
 *   de la queja reportada.
 * ==========================================================================*/

function formatMoney(n) {
  return `$${Number(n).toLocaleString("es-CO")}`;
}

function formatFecha(iso) {
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

// Fecha LOCAL (no UTC) en formato YYYY-MM-DD, para comparar contra
// created_at.slice(0, 10) — mismo criterio que VentasView/FacturasView.
// OJO: no usar new Date().toISOString().slice(0,10) acá, porque
// convierte a UTC y cerca de medianoche podría marcar el día
// equivocado según la zona horaria del navegador.
function hoyLocalISO() {
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

const ESTADO_LABEL = {
  pendiente: "Pendiente",
  en_preparacion: "En preparación",
  listo_para_entregar: "Listo para entregar",
  pagado: "Pagado",
  entregado: "Entregado",
  cancelado: "Cancelado",
};


export default function DashboardView() {
  const { usuario: actor } = useAuth();
  const navigate = useNavigate();
  const admin = actorEsAdminGeneral(actor);

  const [ventas, setVentas] = useState([]);
  const [facturas, setFacturas] = useState([]);
  const [productos, setProductos] = useState([]);
  const [notificaciones, setNotificaciones] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const [ventasData, facturasData, productosData, notificacionesData, sucursalesData] = await Promise.all([
        api.getAllPages("/ventas"),
        api.getAllPages("/facturas"),
        api.getAllPages("/productos"),
        api.getAllPages("/notificaciones"),
        api.getAllPages("/sucursales"),
      ]);
      setVentas(ventasData);
      setFacturas(facturasData);
      setProductos(productosData);
      setNotificaciones(notificacionesData);
      setSucursales(sucursalesData);
    } catch (e) {
      setErrorCarga(e instanceof ApiError ? e.message : (e?.message ?? "No se pudo cargar el panorama general."));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  // ventas/facturas/productos: ya vienen scoped por sucursal desde el
  // backend para quien no es admin_general, así que se usan directo.
  const stockBajo = useMemo(
    () => productos.filter((p) => p.maneja_stock && (p.inventario?.cantidad ?? 0) < p.stock_minimo),
    [productos]
  );

  const notificacionesScope = useMemo(() => {
    return notificaciones.filter((n) => {
      if (n.leida) return false;
      if (admin) return true;
      if (n.usuario_id === null) return actor.rol === "admin_sucursal";
      return n.usuario_id === actor.id_usuario;
    });
  }, [notificaciones, admin, actor]);

  const enCurso = ventas.filter((v) => !["pagado", "entregado", "cancelado"].includes(v.estado));

  // Se recalcula en cada render/montaje, así que al abrir el Dashboard
  // un día distinto el corte cae automáticamente en la fecha nueva.
  const hoy = hoyLocalISO();

  const facturasHoy = useMemo(
    () => facturas.filter((f) => f.created_at?.slice(0, 10) === hoy),
    [facturas, hoy]
  );

  const totalFacturadoHoy = facturasHoy.reduce((sum, f) => sum + Number(f.total), 0);

  const ventasPorSucursal = useMemo(() => {
    if (!admin) return [];
    return sucursales.map((s) => ({
      sucursal: s.nombre,
      total: facturasHoy.filter((f) => f.sucursal_id === s.id_sucursal).reduce((sum, f) => sum + Number(f.total), 0),
    }));
  }, [admin, sucursales, facturasHoy]);

  const ventasRecientes = [...ventas].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);

  return (
    <div>
      <div className="breadcrumb">› Dashboard</div>
      <div className="dv-header">
        <h1 className="page-title">
          {admin ? "Panorama general" : `Hola, ${actor.nombre.split(" ")[0]}`}
        </h1>
        <p className="text-muted">
          {admin ? "Todas las sucursales." : actor.sucursal}
        </p>
      </div>

      {cargando ? (
        <div className="u-loading-row">
          <Loader2 size={18} className="u-spin" /> Cargando panorama general...
        </div>
      ) : errorCarga ? (
        <div className="alert alert-danger u-max-480">
          <AlertTriangle size={16} className="u-icon-inline" />
          <span>{errorCarga}</span>
        </div>
      ) : (
      <>
      {/* KPIs */}
      <div className="dv-kpis">
        <div className="dv-kpi">
          <div className="dv-kpi-top"><span className="text-muted">Ventas registradas</span><div className="dv-kpi-icon"><ShoppingCart size={16} /></div></div>
          <div className="stat-value">{ventas.length}</div>
        </div>
        <div className="dv-kpi">
          <div className="dv-kpi-top"><span className="text-muted">En curso</span><div className="dv-kpi-icon"><TrendingUp size={16} /></div></div>
          <div className={`stat-value${enCurso.length > 0 ? " u-value-warning" : ""}`}>{enCurso.length}</div>
        </div>
        <div className="dv-kpi">
          <div className="dv-kpi-top"><span className="text-muted">Facturado hoy</span><div className="dv-kpi-icon"><Receipt size={16} /></div></div>
          <div className="stat-value">{formatMoney(totalFacturadoHoy)}</div>
        </div>
        <div className="dv-kpi">
          <div className="dv-kpi-top"><span className="text-muted">Stock bajo</span><div className="dv-kpi-icon"><PackageX size={16} /></div></div>
          <div className={`stat-value${stockBajo.length > 0 ? " u-value-danger" : ""}`}>{stockBajo.length}</div>
        </div>
      </div>

      <div className="dv-cols">
        <div className="dv-col-left">
          {admin && (
            <div className="dv-card">
              <div className="dv-card-header">
                <h3 className="dv-card-title">Facturado hoy por sucursal</h3>
              </div>
              {ventasPorSucursal.map((s) => (
                <div className="dv-row" key={s.sucursal}>
                  <span>{s.sucursal}</span>
                  <span className="text-mono">{formatMoney(s.total)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="dv-card">
            <div className="dv-card-header">
              <h3 className="dv-card-title">Ventas recientes</h3>
              <button className="dv-link" onClick={() => navigate(admin ? "/ventas" : "/ventas/registro")}>
                Ver todas <ArrowRight size={13} />
              </button>
            </div>
            {ventasRecientes.length === 0 ? (
              <div className="dv-empty">No hay ventas registradas todavía.</div>
            ) : (
              ventasRecientes.map((v) => (
                <div className="dv-row" key={v.id_venta}>
                  <span>
                    #{v.id_venta} · {v.cajero?.nombre ?? "—"}
                    {admin && ` · ${v.sucursal?.nombre ?? "—"}`}
                  </span>
                  <span className="dv-row-meta">
                    <span className="text-muted">{formatFecha(v.created_at)}</span>
                    <span className="text-mono">{formatMoney(v.total)}</span>
                  </span>
                </div>
              ))
            )}
          </div>

          {stockBajo.length > 0 && (actor.rol === "admin_sucursal" || admin) && (
            <div className="dv-card">
              <div className="dv-card-header">
                <h3 className="dv-card-title">Alertas de stock bajo</h3>
                <button className="dv-link" onClick={() => navigate("/productos")}>
                  Ver productos <ArrowRight size={13} />
                </button>
              </div>
              {stockBajo.map((p) => (
                <div className="dv-row" key={p.id_producto}>
                  <span>{p.nombre}{admin && ` · ${p.sucursal?.nombre ?? "—"}`}</span>
                  <span className="text-mono u-value-danger">
                    {p.inventario?.cantidad ?? 0} / mín. {p.stock_minimo}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <div className="dv-card">
            <div className="dv-card-header">
              <h3 className="dv-card-title">Notificaciones sin leer</h3>
              <button className="dv-link" onClick={() => navigate("/notificaciones")}>
                Ver todas <ArrowRight size={13} />
              </button>
            </div>
            {notificacionesScope.length === 0 ? (
              <div className="dv-empty">Estás al día.</div>
            ) : (
              notificacionesScope.slice(0, 4).map((n) => (
                <div className="dv-row dv-row--notif" key={n.id_notificacion}>
                  <Bell size={13} className="dv-notif-icon" />
                  <span className="dv-notif-text">{n.mensaje}</span>
                </div>
              ))
            )}
          </div>

          <div className="dv-quick-actions">
            {(actor.rol === "admin_sucursal" || actor.rol === "cajero") && (
              <button className="btn btn-primary u-justify-center" onClick={() => navigate("/ventas/nueva")}>
                <ShoppingCart size={15} /> Nueva venta
              </button>
            )}
            {admin && (
              <button className="btn btn-outline u-justify-center" onClick={() => navigate("/usuarios")}>
                <Users size={15} /> Gestionar usuarios
              </button>
            )}
          </div>
        </div>
      </div>
      </>
      )}
    </div>
  );
}