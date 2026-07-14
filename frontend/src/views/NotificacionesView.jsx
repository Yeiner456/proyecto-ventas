import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Bell, Check, Trash2, AlertTriangle, PackageX, Ban, Loader2 } from "lucide-react";
import { useAuth, esAdminGeneral as actorEsAdminGeneral } from "../context/AuthContext";
import { api, ApiError } from "../services/apiClient";
import "../styles/NotificacionesView.css";

/* ============================================================================
 * NOTIFICACIONES — Vista de solo gestión (sin creación manual)
 * ----------------------------------------------------------------------------
 * Contrato real:
 *   GET    /api/notificaciones               -> listar
 *   PATCH  /api/notificaciones/{id}/leida     -> marcar leída (sin body)
 *   DELETE /api/notificaciones/{id}           -> eliminar
 *
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
 *
 * OJO: esta regla vive en la Policy (view/marcarLeida/delete), NO en el
 * filtro de index() — el índice del backend solo filtra por sucursal y
 * por "usuario_id nulo o mío", sin distinguir el rol. Es decir, el
 * backend podría devolver en la lista una notificación "para todos los
 * admins" incluso a un cajero. Mantengo el filtro adicional en el
 * frontend (como ya estaba decidido antes de este cambio) para que la
 * UI sea consistente con lo que la Policy realmente autoriza a
 * gestionar, no solo con lo que el índice devuelve.
 * ==========================================================================*/

const ICONO_TIPO = {
  stock_bajo: PackageX,
  venta_cancelada: Ban,
};

function notificacionVisible(actor, n, sucursales) {
  if (actorEsAdminGeneral(actor)) return true;
  const sucursalActorId = sucursales.find((s) => s.nombre === actor.sucursal)?.id_sucursal;
  if (n.sucursal_id !== sucursalActorId) return false;
  if (n.usuario_id === null) return actor.rol === "admin_sucursal";
  return n.usuario_id === actor.id_usuario;
}

function formatFecha(iso) {
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}


export default function NotificacionesView() {
  const { usuario: actor } = useAuth();
  const [notificaciones, setNotificaciones] = useState([]);
  const [sucursales, setSucursales] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [soloNoLeidas, setSoloNoLeidas] = useState(false);
  const [procesando, setProcesando] = useState(null);

  const cargarDatos = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const [notificacionesData, sucursalesData] = await Promise.all([
        api.getAllPages("/notificaciones"),
        api.getAllPages("/sucursales"),
      ]);
      setNotificaciones(notificacionesData);
      setSucursales(sucursalesData);
    } catch (e) {
      setErrorCarga(e instanceof ApiError ? e.message : (e?.message ?? "No se pudieron cargar las notificaciones."));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    cargarDatos();
  }, [cargarDatos]);

  const visibles = useMemo(() => {
    return notificaciones
      .filter((n) => notificacionVisible(actor, n, sucursales))
      .filter((n) => !soloNoLeidas || !n.leida)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [notificaciones, actor, sucursales, soloNoLeidas]);

  const noLeidas = useMemo(
    () => notificaciones.filter((n) => notificacionVisible(actor, n, sucursales) && !n.leida).length,
    [notificaciones, actor, sucursales]
  );

  async function marcarLeida(id_notificacion) {
    setProcesando(id_notificacion);
    try {
      await api.patch(`/notificaciones/${id_notificacion}/leida`);
      setNotificaciones((prev) => prev.map((n) => (n.id_notificacion === id_notificacion ? { ...n, leida: true } : n)));
    } catch (e) {
      // silencioso a propósito: no hay toast en esta vista; el estado no
      // cambia visualmente si falla, lo que ya indica al usuario que no se guardó.
    } finally {
      setProcesando(null);
    }
  }

  async function eliminar(id_notificacion) {
    setProcesando(id_notificacion);
    try {
      await api.delete(`/notificaciones/${id_notificacion}`);
      setNotificaciones((prev) => prev.filter((n) => n.id_notificacion !== id_notificacion));
    } catch (e) {
      // idem: falla silenciosa, la notificación simplemente no desaparece.
    } finally {
      setProcesando(null);
    }
  }

  return (
    <div>
      <div className="breadcrumb">› Notificaciones</div>
      <div className="ntv-header">
        <div>
          <h1 className="page-title">Notificaciones</h1>
          <p className="text-muted ntv-subtitle">
            Se generan automáticamente por el sistema (ej. stock bajo) — no se crean manualmente aquí.
          </p>
        </div>
        <div className="stat-card ntv-stat-card">
          <div className="stat-label">Sin leer</div>
          <div className={`stat-value${noLeidas > 0 ? " u-value-warning" : ""}`}>{noLeidas}</div>
        </div>
      </div>

      <div className="ntv-toolbar">
        <label className="ntv-checkbox-label">
          <input type="checkbox" checked={soloNoLeidas} onChange={(e) => setSoloNoLeidas(e.target.checked)} />
          Solo no leídas
        </label>
      </div>

      <div className="data-table-card">
        {cargando ? (
          <div className="u-loading-row">
            <Loader2 size={18} className="u-spin" /> Cargando notificaciones...
          </div>
        ) : errorCarga ? (
          <div className="alert alert-danger u-max-480">
            <AlertTriangle size={16} className="u-icon-inline" />
            <span>{errorCarga}</span>
          </div>
        ) : visibles.length === 0 ? (
          <div className="ntv-empty">
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
                <div className="ntv-item-body">
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
