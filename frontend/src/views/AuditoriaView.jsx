import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ClipboardList, X, AlertTriangle, Search, Loader2 } from "lucide-react";
import { useAuth, esAdminGeneral as actorEsAdminGeneral } from "../context/AuthContext";
import { api, ApiError } from "../services/apiClient";
import "../styles/AuditoriaView.css";

/* ============================================================================
 * AUDITORÍA — Vista de solo lectura
 * ----------------------------------------------------------------------------
 * Contrato real: GET /api/auditoria-logs (paginado, scoped por sucursal).
 * AuditoriaLogController expone únicamente index/show. Se llena sola desde
 * FiltraPorSucursal::registrarAuditoria(), llamado por otros controladores
 * en acciones sensibles (crear venta, cambiar estado, ajustar inventario...).
 *
 * AuditoriaLogPolicy::viewAny() exige esAdminSucursal() — por eso esta
 * pantalla NO está en la Sidebar para 'cajero'. Este último caso ya lo
 * señalé antes (en Sidebar.jsx). Lo dejo fiel al backend tal como está.
 *
 * GET /api/auditoria-logs ya viene con 'usuario' y 'sucursal' anidados
 * (AuditoriaLogController::index hace ->with(['usuario', 'sucursal'])).
 * ==========================================================================*/

function puedeVer(actor) {
  return actorEsAdminGeneral(actor) || actor.rol === "admin_sucursal";
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

// Traducción de nombres de columnas de la BD a etiquetas legibles. Cubre
// las columnas más comunes que aparecen en datos_anteriores/datos_nuevos
// a través de las distintas tablas (usuarios, productos, ventas,
// inventario, categorías...). Lo que no está mapeado cae al fallback de
// etiquetaCampo() (snake_case -> "Snake Case").
const CAMPO_LABEL = {
  id_usuario: "Usuario", id_producto: "Producto", id_categoria: "Categoría",
  id_venta: "Venta", id_sucursal: "Sucursal", id_inventario: "Inventario",
  id_movimiento: "Movimiento", id_comprobante: "Comprobante", id_factura: "Factura",
  id_rol: "Rol", id_metodo_pago: "Método de pago", id_notificacion: "Notificación",
  sucursal_id: "Sucursal", rol_id: "Rol", categoria_id: "Categoría",
  producto_id: "Producto", usuario_id: "Usuario", cajero_id: "Cajero",
  venta_id: "Venta", metodo_pago_id: "Método de pago",
  nombre: "Nombre", descripcion: "Descripción",
  precio_base: "Precio base", precio: "Precio", precio_unitario: "Precio unitario",
  cantidad: "Cantidad", stock_minimo: "Stock mínimo",
  stock_antes: "Stock antes", stock_despues: "Stock después",
  maneja_stock: "Maneja inventario", activo: "Activo", activa: "Activa",
  estado: "Estado", total: "Total", subtotal: "Subtotal",
  observacion: "Observación", tipo: "Tipo",
  referencia_id: "Referencia", referencia_tipo: "Tipo de referencia",
  password_hash: "Contraseña", created_at: "Creado", updated_at: "Actualizado",
};

function etiquetaCampo(key) {
  return CAMPO_LABEL[key] ?? key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValorCampo(key, value) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Sí" : "No";
  if (key === "password_hash") return "••••••••";
  if (key.endsWith("_at")) {
    const fecha = new Date(value);
    if (!Number.isNaN(fecha.getTime())) return formatFecha(fecha.toISOString());
  }
  if (typeof value === "number" && /precio|total|subtotal/.test(key)) {
    return `$${value.toLocaleString("es-CO")}`;
  }
  return String(value);
}

// Lista simple "campo: valor" — se usa para creaciones (solo datos_nuevos)
// o eliminaciones (solo datos_anteriores), donde no hay nada que comparar.
// Oculta 'updated_at' cuando es idéntico a 'created_at' (el caso normal al
// crear un registro) para no repetir la misma fecha dos veces.
function CamposList({ datos }) {
  const entradas = Object.entries(datos).filter(
    ([k, v]) => !(k === "updated_at" && v === datos.created_at)
  );
  if (entradas.length === 0) return null;
  return (
    <div className="av-campos">
      {entradas.map(([k, v]) => (
        <div key={k} className="av-campo-row">
          <span className="av-campo-label">{etiquetaCampo(k)}</span>
          <span className="av-campo-valor">{formatValorCampo(k, v)}</span>
        </div>
      ))}
    </div>
  );
}

// Comparación antes/después — se usa cuando hay ambos lados (una edición).
// Solo muestra los campos que realmente cambiaron, para no repetir todo
// el registro con la mayoría de valores iguales.
function CamposDiff({ antes, despues }) {
  const claves = [...new Set([...Object.keys(antes), ...Object.keys(despues)])];
  const cambiadas = claves.filter((k) => JSON.stringify(antes[k]) !== JSON.stringify(despues[k]));
  if (cambiadas.length === 0) {
    return <p className="field-help">No hay cambios en los campos registrados.</p>;
  }
  return (
    <div className="av-campos">
      <div className="av-campo-row av-campo-row-3 av-campo-row-header">
        <span>Campo</span>
        <span>Antes</span>
        <span>Después</span>
      </div>
      {cambiadas.map((k) => (
        <div key={k} className="av-campo-row av-campo-row-3">
          <span className="av-campo-label">{etiquetaCampo(k)}</span>
          <span className="av-campo-valor av-campo-antes">{formatValorCampo(k, antes[k])}</span>
          <span className="av-campo-valor av-campo-despues">{formatValorCampo(k, despues[k])}</span>
        </div>
      ))}
    </div>
  );
}

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

        <div className="av-detalle-grid">
          <div><div className="field-help">Usuario</div>{log.usuario?.nombre ?? "Sistema"}</div>
          <div><div className="field-help">Sucursal</div>{log.sucursal?.nombre ?? "—"}</div>
          <div><div className="field-help">Fecha</div>{formatFecha(log.created_at)}</div>
          <div><div className="field-help">IP</div><span className="text-mono">{log.ip_address ?? "—"}</span></div>
          <div><div className="field-help">Tabla afectada</div>{log.tabla_afectada ?? "—"}</div>
          <div><div className="field-help">Registro</div>{log.registro_id ? `#${log.registro_id}` : "—"}</div>
        </div>

        {log.datos_anteriores && log.datos_nuevos ? (
          <>
            <div className="av-diff-label">Cambios</div>
            <CamposDiff antes={log.datos_anteriores} despues={log.datos_nuevos} />
          </>
        ) : log.datos_nuevos ? (
          <>
            <div className="av-diff-label">Datos</div>
            <CamposList datos={log.datos_nuevos} />
          </>
        ) : log.datos_anteriores ? (
          <>
            <div className="av-diff-label">Datos eliminados</div>
            <CamposList datos={log.datos_anteriores} />
          </>
        ) : null}

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

  const [logs, setLogs] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroAccion, setFiltroAccion] = useState("");
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [seleccionado, setSeleccionado] = useState(null);

  const cargarLogs = useCallback(async () => {
    setCargando(true);
    setErrorCarga(null);
    try {
      const data = await api.getAllPages("/auditoria-logs");
      setLogs(data);
    } catch (e) {
      setErrorCarga(e instanceof ApiError ? e.message : (e?.message ?? "No se pudo cargar la auditoría."));
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (autorizado) cargarLogs();
  }, [autorizado, cargarLogs]);

  const visibles = useMemo(() => {
    return logs
      .filter((l) => actorEsAdminGeneral(actor) || l.sucursal?.nombre === actor.sucursal)
      .filter((l) => !filtroAccion || l.accion === filtroAccion)
      .filter((l) => !busqueda.trim() || (l.usuario?.nombre ?? "Sistema").toLowerCase().includes(busqueda.toLowerCase()))
      .filter((l) => !desde || l.created_at.slice(0, 10) >= desde)
      .filter((l) => !hasta || l.created_at.slice(0, 10) <= hasta)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [logs, actor, filtroAccion, busqueda, desde, hasta]);

  const accionesDisponibles = [...new Set(logs.map((l) => l.accion))];

  if (!autorizado) {
    return (
      <div>
        <div className="breadcrumb">› Auditoría</div>
        <h1 className="page-title">Auditoría</h1>
        <div className="alert alert-danger u-max-480">
          <AlertTriangle size={16} className="u-icon-inline" />
          <span>No tienes permisos para ver la auditoría (AuditoriaLogPolicy::viewAny).</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="breadcrumb">› Auditoría</div>
      <div className="av-header">
        <div>
          <h1 className="page-title">Auditoría</h1>
          <p className="text-muted av-subtitle">
            {actorEsAdminGeneral(actor) ? "Bitácora de todas las sucursales." : `Bitácora de ${actor.sucursal}.`} Solo lectura — se llena sola desde las acciones del sistema.
          </p>
        </div>
      </div>

      <div className="av-toolbar">
        <div className="av-search-wrap">
          <Search size={15} className="av-search-icon" />
          <input className="field-input"  placeholder="Buscar por usuario..." value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
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
            {cargando ? (
              <tr className="empty-row">
                <td colSpan={6}>
                  <div className="u-loading-row">
                    <Loader2 size={18} className="u-spin" /> Cargando auditoría...
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
                <td colSpan={6}>No hay registros que coincidan con el filtro.</td>
              </tr>
            ) : (
              visibles.map((l) => (
                <tr key={l.id_auditoria}>
                  <td className="text-mono">{formatFecha(l.created_at)}</td>
                  <td>{l.usuario?.nombre ?? "Sistema"}</td>
                  <td>
                    <div className="av-action-cell">
                      <ClipboardList size={13} className="av-action-icon" />
                      {ACCION_LABEL[l.accion] ?? l.accion}
                    </div>
                  </td>
                  <td>{l.tabla_afectada ?? "—"}</td>
                  {actorEsAdminGeneral(actor) && <td>{l.sucursal?.nombre ?? "—"}</td>}
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