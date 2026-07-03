import React, { useState, useMemo } from "react";
import { ClipboardList, X, AlertTriangle, Search } from "lucide-react";
import { useAuth, esAdminGeneral as actorEsAdminGeneral } from "../context/AuthContext";
import { auditoriaLogs as auditoriaLogsSeed, usuarios as usuariosSeed, sucursales as sucursalesSeed, nombreSucursal } from "../mocks/seedData";

/* ============================================================================
 * AUDITORÍA — Vista de solo lectura
 * ----------------------------------------------------------------------------
 * AuditoriaLogController expone únicamente index/show. Se llena sola desde
 * FiltraPorSucursal::registrarAuditoria(), llamado por otros controladores
 * en acciones sensibles (crear venta, cambiar estado, ajustar inventario...).
 *
 * AuditoriaLogPolicy::viewAny() exige esAdminSucursal() — por eso esta
 * pantalla NO está en la Sidebar para 'cajero' ni 'contador'. Este último
 * caso ya lo señalé antes (en Sidebar.jsx): un contador probablemente
 * debería poder auditar, pero la Policy actual no se lo permite. Lo dejo
 * fiel al backend tal como está.
 * ==========================================================================*/

function puedeVer(actor) {
  return actorEsAdminGeneral(actor) || actor.rol === "admin_sucursal";
}

function nombreUsuario(id_usuario) {
  if (!id_usuario) return "Sistema";
  return usuariosSeed.find((u) => u.id_usuario === id_usuario)?.nombre ?? `Usuario #${id_usuario}`;
}

function formatFecha(iso) {
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

const ACCION_LABEL = {
  crear_venta: "Creó una venta",
  cambiar_estado_venta: "Cambió el estado de una venta",
  ajustar_inventario: "Ajustó inventario",
  crear_producto: "Creó un producto",
  login: "Inició sesión",
};

const styles = `
.av-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; gap: 16px; flex-wrap: wrap; }
.av-toolbar { display: flex; gap: 10px; margin-bottom: 16px; flex-wrap: wrap; align-items: center; }
.av-select { max-width: 200px; }
.av-date { max-width: 160px; }
.av-diff { background: #FAFAFA; border: 1px solid var(--border); border-radius: 8px; padding: 12px; font-family: 'Roboto Mono', monospace; font-size: 12px; white-space: pre-wrap; word-break: break-word; }
.av-diff-label { font-family: 'Roboto', sans-serif; font-size: 11px; font-weight: 500; color: var(--text-secondary); text-transform: uppercase; letter-spacing: .03em; margin: 12px 0 6px 0; }
`;

function DetalleModal({ log, onClose }) {
  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className="modal modal-wide" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">{ACCION_LABEL[log.accion] ?? log.accion}</h3>
          <button className="modal-close" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 8, fontFamily: "'Roboto', sans-serif", fontSize: 13 }}>
          <div><div className="field-help">Usuario</div>{nombreUsuario(log.usuario_id)}</div>
          <div><div className="field-help">Sucursal</div>{log.sucursal_id ? nombreSucursal(log.sucursal_id) : "—"}</div>
          <div><div className="field-help">Fecha</div>{formatFecha(log.created_at)}</div>
          <div><div className="field-help">IP</div><span className="text-mono">{log.ip_address ?? "—"}</span></div>
          <div><div className="field-help">Tabla afectada</div>{log.tabla_afectada ?? "—"}</div>
          <div><div className="field-help">Registro</div>{log.registro_id ? `#${log.registro_id}` : "—"}</div>
        </div>

        {log.datos_anteriores && (
          <>
            <div className="av-diff-label">Antes</div>
            <div className="av-diff">{JSON.stringify(log.datos_anteriores, null, 2)}</div>
          </>
        )}
        {log.datos_nuevos && (
          <>
            <div className="av-diff-label">Después</div>
            <div className="av-diff">{JSON.stringify(log.datos_nuevos, null, 2)}</div>
          </>
        )}

        <div className="modal-actions">
          <button className="btn btn-primary" onClick={onClose}>Cerrar</button>
        </div>
      </div>
    </div>
  );
}

export default function AuditoriaView() {
  const { usuario: actor } = useAuth();
  const autorizado = puedeVer(actor);

  const [busqueda, setBusqueda] = useState("");
  const [filtroAccion, setFiltroAccion] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [seleccionado, setSeleccionado] = useState(null);

  const sucursalActorId = sucursalesSeed.find((s) => s.nombre === actor.sucursal)?.id_sucursal;

  const visibles = useMemo(() => {
    return auditoriaLogsSeed
      .filter((l) => actorEsAdminGeneral(actor) || l.sucursal_id === sucursalActorId)
      .filter((l) => !filtroAccion || l.accion === filtroAccion)
      .filter((l) => !busqueda.trim() || nombreUsuario(l.usuario_id).toLowerCase().includes(busqueda.toLowerCase()))
      .filter((l) => !desde || l.created_at.slice(0, 10) >= desde)
      .filter((l) => !hasta || l.created_at.slice(0, 10) <= hasta)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [actor, sucursalActorId, filtroAccion, busqueda, desde, hasta]);

  const accionesDisponibles = [...new Set(auditoriaLogsSeed.map((l) => l.accion))];

  if (!autorizado) {
    return (
      <div>
        <div className="breadcrumb">› Auditoría</div>
        <h1 className="page-title">Auditoría</h1>
        <div className="alert alert-danger" style={{ maxWidth: 480 }}>
          <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
          <span>No tienes permisos para ver la auditoría (AuditoriaLogPolicy::viewAny).</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <style>{styles}</style>
      <div className="breadcrumb">› Auditoría</div>
      <div className="av-header">
        <div>
          <h1 className="page-title">Auditoría</h1>
          <p className="text-muted" style={{ maxWidth: 560 }}>
            {actorEsAdminGeneral(actor) ? "Bitácora de todas las sucursales." : `Bitácora de ${actor.sucursal}.`} Solo lectura — se llena sola desde las acciones del sistema.
          </p>
        </div>
      </div>

      <div className="av-toolbar">
        <div style={{ position: "relative", flex: 1, minWidth: 200 }}>
          <Search size={15} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)" }} />
          <input className="field-input" style={{ paddingLeft: 36 }} placeholder="Buscar por usuario..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
        </div>
        <select className="field-select av-select" value={filtroAccion} onChange={(e) => setFiltroAccion(e.target.value)}>
          <option value="">Todas las acciones</option>
          {accionesDisponibles.map((a) => (
            <option key={a} value={a}>{ACCION_LABEL[a] ?? a}</option>
          ))}
        </select>
        <input className="field-input av-date" type="date" value={desde} onChange={(e) => setDesde(e.target.value)} title="Desde" />
        <input className="field-input av-date" type="date" value={hasta} onChange={(e) => setHasta(e.target.value)} title="Hasta" />
      </div>

      <div className="data-table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Usuario</th>
              <th>Acción</th>
              <th>Tabla</th>
              {actorEsAdminGeneral(actor) && <th>Sucursal</th>}
              <th></th>
            </tr>
          </thead>
          <tbody>
            {visibles.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={6}>No hay registros que coincidan con el filtro.</td>
              </tr>
            ) : (
              visibles.map((l) => (
                <tr key={l.id_auditoria}>
                  <td className="text-mono">{formatFecha(l.created_at)}</td>
                  <td>{nombreUsuario(l.usuario_id)}</td>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <ClipboardList size={13} style={{ color: "var(--sena-green-dark)" }} />
                      {ACCION_LABEL[l.accion] ?? l.accion}
                    </div>
                  </td>
                  <td>{l.tabla_afectada ?? "—"}</td>
                  {actorEsAdminGeneral(actor) && <td>{l.sucursal_id ? nombreSucursal(l.sucursal_id) : "—"}</td>}
                  <td>
                    <button className="btn btn-outline btn-sm" onClick={() => setSeleccionado(l)}>Ver</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {seleccionado && <DetalleModal log={seleccionado} onClose={() => setSeleccionado(null)} />}
    </div>
  );
}
