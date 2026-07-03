import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { TrendingUp, PackageX, Bell, Receipt, ArrowRight, ShoppingCart, Users } from "lucide-react";
import { useAuth, esAdminGeneral as actorEsAdminGeneral } from "../context/AuthContext";
import {
  sucursales as sucursalesSeed,
  ventas as ventasSeed,
  facturas as facturasSeed,
  productos as productosSeed,
  notificaciones as notificacionesSeed,
  usuarios as usuariosSeed,
  nombreSucursal,
  stockDe,
} from "../mocks/seedData";

/* ============================================================================
 * DASHBOARD — vista de agregación, no un CRUD
 * ----------------------------------------------------------------------------
 * IMPORTANTE: no existe /api/dashboard en el backend. Esta pantalla
 * compone datos que YA vienen de otros endpoints (ventas, facturas,
 * inventario, notificaciones) — es responsabilidad del FRONTEND armar el
 * resumen, no algo que el backend calcule y entregue hecho.
 *
 * Implicación de rendimiento a tener en cuenta cuando esto se conecte a
 * la API real: si cada tarjeta dispara su propia llamada (GET ventas,
 * GET facturas, GET inventario, GET notificaciones), son 4 requests
 * solo para pintar el dashboard. Con pocos usuarios no importa; si
 * llega a pesar, la solución NO es crear más lógica en el frontend sino
 * pedirle al equipo de backend un endpoint de agregación
 * (GET /api/dashboard/resumen) que haga las sumas en SQL en vez de
 * traer todas las filas y sumarlas en el navegador. Lo señalo ahora
 * para que no se sorprendan si el dashboard se siente pesado más
 * adelante — no es un bug, es una decisión pendiente de escala.
 *
 * Contenido por rol (decisión de producto, no hay boceto para esto):
 *   - admin_general: panorama de todas las sucursales.
 *   - admin_sucursal / cajero: el día a día de SU sucursal + acceso
 *     directo a Nueva venta.
 *   - contador: enfoque en facturación.
 * ==========================================================================*/

function formatMoney(n) {
  return `$${Number(n).toLocaleString("es-CO")}`;
}

function formatFecha(iso) {
  return new Date(iso).toLocaleDateString("es-CO", { day: "2-digit", month: "short" });
}

const ESTADO_LABEL = {
  pendiente: "Pendiente",
  en_preparacion: "En preparación",
  listo_para_entregar: "Listo para entregar",
  pagado: "Pagado",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

const styles = `
.dv-header { margin-bottom: 22px; }
.dv-kpis { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
.dv-kpi { background: var(--white); border: 1px solid var(--border); border-radius: 12px; padding: 18px 20px; display: flex; flex-direction: column; gap: 10px; }
.dv-kpi-top { display: flex; justify-content: space-between; align-items: center; }
.dv-kpi-icon { width: 32px; height: 32px; border-radius: 8px; background: var(--green-soft); color: var(--sena-green-dark); display: flex; align-items: center; justify-content: center; }
.dv-cols { display: grid; grid-template-columns: 1.3fr 1fr; gap: 20px; align-items: start; }
.dv-card { background: var(--white); border: 1px solid var(--border); border-radius: 12px; padding: 18px 20px; }
.dv-card-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
.dv-card-title { font-family: 'Inter', sans-serif; font-weight: 700; font-size: 15px; margin: 0; }
.dv-link { font-family: 'Roboto', sans-serif; font-size: 12.5px; color: var(--sena-green-dark); background: none; border: none; cursor: pointer; display: flex; align-items: center; gap: 4px; }
.dv-row { display: flex; justify-content: space-between; align-items: center; padding: 9px 0; border-bottom: 1px solid var(--border); font-family: 'Roboto', sans-serif; font-size: 13px; }
.dv-row:last-child { border-bottom: none; }
.dv-empty { text-align: center; padding: 20px; color: var(--text-secondary); font-family: 'Roboto', sans-serif; font-size: 13px; }
.dv-quick-actions { display: flex; flex-direction: column; gap: 8px; margin-top: 20px; }
`;

export default function DashboardView() {
  const { usuario: actor } = useAuth();
  const navigate = useNavigate();
  const admin = actorEsAdminGeneral(actor);
  const sucursalActorId = sucursalesSeed.find((s) => s.nombre === actor.sucursal)?.id_sucursal;

  const ventasScope = useMemo(
    () => ventasSeed.filter((v) => admin || v.sucursal_id === sucursalActorId),
    [admin, sucursalActorId]
  );
  const facturasScope = useMemo(
    () => facturasSeed.filter((f) => admin || f.sucursal_id === sucursalActorId),
    [admin, sucursalActorId]
  );
  const productosScope = useMemo(
    () => productosSeed.filter((p) => admin || p.sucursal_id === sucursalActorId),
    [admin, sucursalActorId]
  );
  const notificacionesScope = useMemo(() => {
    return notificacionesSeed.filter((n) => {
      if (admin) return !n.leida;
      if (n.sucursal_id !== sucursalActorId) return false;
      if (n.usuario_id === null) return actor.rol === "admin_sucursal" && !n.leida;
      return n.usuario_id === actor.id_usuario && !n.leida;
    });
  }, [admin, sucursalActorId, actor]);

  const stockBajo = useMemo(
    () => productosScope.filter((p) => p.maneja_stock && (stockDe(p.id_producto) ?? 0) < p.stock_minimo),
    [productosScope]
  );

  const enCurso = ventasScope.filter((v) => !["pagado", "entregado", "cancelado"].includes(v.estado));
  const totalFacturado = facturasScope.reduce((sum, f) => sum + Number(f.total), 0);
  const ticketPromedio = facturasScope.length ? totalFacturado / facturasScope.length : 0;

  const ventasPorSucursal = useMemo(() => {
    if (!admin) return [];
    return sucursalesSeed.map((s) => ({
      sucursal: s.nombre,
      total: facturasSeed.filter((f) => f.sucursal_id === s.id_sucursal).reduce((sum, f) => sum + Number(f.total), 0),
    }));
  }, [admin]);

  const ventasRecientes = [...ventasScope].sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 5);

  function nombreCajero(id) {
    return usuariosSeed.find((u) => u.id_usuario === id)?.nombre ?? "—";
  }

  return (
    <div>
      <style>{styles}</style>
      <div className="breadcrumb">› Dashboard</div>
      <div className="dv-header">
        <h1 className="page-title">
          {admin ? "Panorama general" : `Hola, ${actor.nombre.split(" ")[0]}`}
        </h1>
        <p className="text-muted">
          {admin ? "Todas las sucursales." : actor.sucursal}
        </p>
      </div>

      {/* KPIs — distintos según el rol, no son las mismas 4 tarjetas para todos */}
      <div className="dv-kpis">
        {actor.rol === "contador" ? (
          <>
            <div className="dv-kpi">
              <div className="dv-kpi-top"><span className="text-muted">Facturas</span><div className="dv-kpi-icon"><Receipt size={16} /></div></div>
              <div className="stat-value">{facturasScope.length}</div>
            </div>
            <div className="dv-kpi">
              <div className="dv-kpi-top"><span className="text-muted">Total facturado</span><div className="dv-kpi-icon"><TrendingUp size={16} /></div></div>
              <div className="stat-value">{formatMoney(totalFacturado)}</div>
            </div>
            <div className="dv-kpi">
              <div className="dv-kpi-top"><span className="text-muted">Ticket promedio</span><div className="dv-kpi-icon"><TrendingUp size={16} /></div></div>
              <div className="stat-value">{formatMoney(Math.round(ticketPromedio))}</div>
            </div>
          </>
        ) : (
          <>
            <div className="dv-kpi">
              <div className="dv-kpi-top"><span className="text-muted">Ventas registradas</span><div className="dv-kpi-icon"><ShoppingCart size={16} /></div></div>
              <div className="stat-value">{ventasScope.length}</div>
            </div>
            <div className="dv-kpi">
              <div className="dv-kpi-top"><span className="text-muted">En curso</span><div className="dv-kpi-icon"><TrendingUp size={16} /></div></div>
              <div className="stat-value" style={{ color: enCurso.length > 0 ? "var(--warning)" : "inherit" }}>{enCurso.length}</div>
            </div>
            <div className="dv-kpi">
              <div className="dv-kpi-top"><span className="text-muted">Total facturado</span><div className="dv-kpi-icon"><Receipt size={16} /></div></div>
              <div className="stat-value">{formatMoney(totalFacturado)}</div>
            </div>
            <div className="dv-kpi">
              <div className="dv-kpi-top"><span className="text-muted">Stock bajo</span><div className="dv-kpi-icon"><PackageX size={16} /></div></div>
              <div className="stat-value" style={{ color: stockBajo.length > 0 ? "var(--danger)" : "inherit" }}>{stockBajo.length}</div>
            </div>
          </>
        )}
      </div>

      <div className="dv-cols">
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {admin && (
            <div className="dv-card">
              <div className="dv-card-header">
                <h3 className="dv-card-title">Facturado por sucursal</h3>
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
                    #{v.id_venta} · {nombreCajero(v.cajero_id)}
                    {admin && ` · ${nombreSucursal(v.sucursal_id)}`}
                  </span>
                  <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
                  <span>{p.nombre}{admin && ` · ${nombreSucursal(p.sucursal_id)}`}</span>
                  <span className="text-mono" style={{ color: "var(--danger)" }}>
                    {stockDe(p.id_producto)} / mín. {p.stock_minimo}
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
                <div className="dv-row" key={n.id_notificacion} style={{ alignItems: "flex-start" }}>
                  <Bell size={13} style={{ color: "var(--warning)", marginTop: 2, flexShrink: 0 }} />
                  <span style={{ marginLeft: 8, lineHeight: 1.4 }}>{n.mensaje}</span>
                </div>
              ))
            )}
          </div>

          <div className="dv-quick-actions">
            {(actor.rol === "admin_sucursal" || actor.rol === "cajero") && (
              <button className="btn btn-primary" style={{ justifyContent: "center" }} onClick={() => navigate("/ventas/nueva")}>
                <ShoppingCart size={15} /> Nueva venta
              </button>
            )}
            {admin && (
              <button className="btn btn-outline" style={{ justifyContent: "center" }} onClick={() => navigate("/usuarios")}>
                <Users size={15} /> Gestionar usuarios
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
