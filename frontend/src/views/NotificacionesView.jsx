import React, { useState, useMemo } from "react";
import { Bell, Check, Trash2, AlertTriangle, PackageX, Ban } from "lucide-react";
import { useAuth, esAdminGeneral as actorEsAdminGeneral } from "../context/AuthContext";
import { notificaciones as notificacionesSeed, sucursales as sucursalesSeed } from "../mocks/seedData";

/* ============================================================================
 * NOTIFICACIONES — Vista de solo gestión (sin creación manual)
 * ----------------------------------------------------------------------------
 * NotificacionController expone index/show/destroy + marcarLeida. NO hay
 * store: las notificaciones nacen solas desde el backend (hoy, solo
 * InventarioService::notificarSiStockBajo() las genera; a futuro podrían
 * salir de otros eventos como 'venta_cancelada').
 *
 * NotificacionPolicy::puedeGestionar() tiene una regla de dos caminos que
 * replico en notificacionVisible():
 *   - usuario_id === null  -> "para todos los admins de la sucursal":
 *     solo admin_sucursal (de esa sucursal) puede verla/gestionarla.
 *   - usuario_id !== null  -> solo ESE usuario puede verla/gestionarla.
 * admin_general por before() ve y gestiona todo, sin importar sucursal.
 * ==========================================================================*/

const wait = (ms = 300) => new Promise((res) => setTimeout(res, ms));

const ICONO_TIPO = {
  stock_bajo: PackageX,
  venta_cancelada: Ban,
};

function notificacionVisible(actor, n) {
  if (actorEsAdminGeneral(actor)) return true;
  const sucursalActorId = sucursalesSeed.find((s) => s.nombre === actor.sucursal)?.id_sucursal;
  if (n.sucursal_id !== sucursalActorId) return false;
  if (n.usuario_id === null) return actor.rol === "admin_sucursal";
  return n.usuario_id === actor.id_usuario;
}

function formatFecha(iso) {
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

const styles = `
.ntv-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; gap: 16px; flex-wrap: wrap; }
.ntv-toolbar { display: flex; gap: 10px; margin-bottom: 16px; align-items: center; }
.ntv-item { display: flex; gap: 12px; padding: 14px 16px; border-bottom: 1px solid var(--border); align-items: flex-start; }
.ntv-item:last-child { border-bottom: none; }
.ntv-item.no-leida { background: #FAFCF8; }
.ntv-icon { width: 34px; height: 34px; border-radius: 8px; background: #FFFBEB; color: var(--warning); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ntv-msg { font-family: 'Roboto', sans-serif; font-size: 13.5px; line-height: 1.5; }
.ntv-meta { font-family: 'Roboto', sans-serif; font-size: 11.5px; color: var(--text-secondary); margin-top: 4px; }
.ntv-actions { display: flex; gap: 6px; margin-left: auto; flex-shrink: 0; }
`;

export default function NotificacionesView() {
  const { usuario: actor } = useAuth();
  const [notificaciones, setNotificaciones] = useState(notificacionesSeed);
  const [soloNoLeidas, setSoloNoLeidas] = useState(false);
  const [procesando, setProcesando] = useState(null);

  const visibles = useMemo(() => {
    return notificaciones
      .filter((n) => notificacionVisible(actor, n))
      .filter((n) => !soloNoLeidas || !n.leida)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [notificaciones, actor, soloNoLeidas]);

  const noLeidas = useMemo(
    () => notificaciones.filter((n) => notificacionVisible(actor, n) && !n.leida).length,
    [notificaciones, actor]
  );

  async function marcarLeida(id_notificacion) {
    setProcesando(id_notificacion);
    try {
      await wait();
      setNotificaciones((prev) => prev.map((n) => (n.id_notificacion === id_notificacion ? { ...n, leida: true } : n)));
    } finally {
      setProcesando(null);
    }
  }

  async function eliminar(id_notificacion) {
    setProcesando(id_notificacion);
    try {
      await wait();
      setNotificaciones((prev) => prev.filter((n) => n.id_notificacion !== id_notificacion));
    } finally {
      setProcesando(null);
    }
  }

  return (
    <div>
      <style>{styles}</style>
      <div className="breadcrumb">› Notificaciones</div>
      <div className="ntv-header">
        <div>
          <h1 className="page-title">Notificaciones</h1>
          <p className="text-muted" style={{ maxWidth: 560 }}>
            Se generan automáticamente por el sistema (ej. stock bajo) — no se crean manualmente aquí.
          </p>
        </div>
        <div className="stat-card" style={{ minWidth: 140 }}>
          <div className="stat-label">Sin leer</div>
          <div className="stat-value" style={{ color: noLeidas > 0 ? "var(--warning)" : "inherit" }}>{noLeidas}</div>
        </div>
      </div>

      <div className="ntv-toolbar">
        <label style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: "'Roboto', sans-serif", fontSize: 13 }}>
          <input type="checkbox" checked={soloNoLeidas} onChange={(e) => setSoloNoLeidas(e.target.checked)} />
          Solo no leídas
        </label>
      </div>

      <div className="data-table-card">
        {visibles.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)", fontFamily: "'Roboto', sans-serif", fontSize: 13 }}>
            No hay notificaciones{soloNoLeidas ? " sin leer" : ""}.
          </div>
        ) : (
          visibles.map((n) => {
            const Icono = ICONO_TIPO[n.tipo] ?? Bell;
            return (
              <div className={`ntv-item${n.leida ? "" : " no-leida"}`} key={n.id_notificacion}>
                <div className="ntv-icon">
                  <Icono size={16} />
                </div>
                <div style={{ flex: 1 }}>
                  <div className="ntv-msg">{n.mensaje}</div>
                  <div className="ntv-meta">{formatFecha(n.created_at)}{n.usuario_id === null && " · Para todos los admins de la sucursal"}</div>
                </div>
                <div className="ntv-actions">
                  {!n.leida && (
                    <button
                      className="btn btn-outline btn-sm"
                      disabled={procesando === n.id_notificacion}
                      onClick={() => marcarLeida(n.id_notificacion)}
                      title="Marcar como leída"
                    >
                      <Check size={13} />
                    </button>
                  )}
                  <button
                    className="btn btn-danger-ghost btn-sm"
                    disabled={procesando === n.id_notificacion}
                    onClick={() => eliminar(n.id_notificacion)}
                    title="Eliminar"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
