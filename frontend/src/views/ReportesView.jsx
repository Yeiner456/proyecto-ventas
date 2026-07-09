import React, { useState, useEffect, useCallback } from "react";
import {
  FileSpreadsheet,
  FileText,
  Boxes,
  Package,
  ShoppingCart,
  Users as UsersIcon,
  Building2,
  Lock,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { useAuth, esAdminGeneral as actorEsAdminGeneral } from "../context/AuthContext";
import { api, ApiError } from "../services/apiClient";
import { TIPOS_REPORTE, obtenerDatosReporte } from "../services/reportesService";
import { descargarExcel, descargarPDF, nombreArchivoConFecha } from "../utils/exportar";
import "../styles/ReportesView.css";

/* ============================================================================
 * REPORTES — exportación de Productos, Usuarios, Ventas e Inventario a
 * Excel/PDF, por sucursal.
 * ----------------------------------------------------------------------------
 * Autorización: mismo criterio que AuditoriaView (admin_general o
 * admin_sucursal; cajero no ve esta pantalla). No hay Policy ni Gate
 * nuevo en el backend — cada botón simplemente reutiliza el GET que ya
 * está autorizado para ese recurso (ProductoPolicy, UsuarioPolicy,
 * VentaPolicy, InventarioPolicy). Si alguien llega por URL directa sin
 * permiso, se degrada al mismo bloque de "sin permisos" que usa
 * BackupsView.
 *
 * Selector de sucursal: SOLO admin_general lo ve y lo necesita, porque
 * esos 4 endpoints le devuelven TODAS las sucursales mezcladas (ver
 * comentario largo en reportesService.js). admin_sucursal nunca elige:
 * su sucursal ya viene fija desde el backend, aquí solo se muestra como
 * referencia (mismo patrón "uv-lock-note" que UsuariosView/ProductosView).
 *
 * Generación de archivos: 100% en el navegador (ver utils/exportar.js).
 * Decisión tomada junto con el equipo el 2026-07-09: cero endpoints
 * nuevos en Laravel para esta funcionalidad.
 * ==========================================================================*/

const ICONO_POR_TIPO = {
  productos: Package,
  usuarios: UsersIcon,
  ventas: ShoppingCart,
  inventario: Boxes,
};

function puedeVer(actor) {
  return actorEsAdminGeneral(actor) || actor.rol === "admin_sucursal";
}

export default function ReportesView() {
  const { usuario: actor } = useAuth();
  const admin = actorEsAdminGeneral(actor);

  const [sucursales, setSucursales] = useState([]);
  const [cargandoSucursales, setCargandoSucursales] = useState(admin);
  const [errorSucursales, setErrorSucursales] = useState(null);
  const [sucursalId, setSucursalId] = useState("");

  const [estadoBoton, setEstadoBoton] = useState({}); // { "productos-excel": true, ... }
  const [errorPorTipo, setErrorPorTipo] = useState({}); // { productos: "mensaje", ... }

  // Solo admin_general necesita el selector; admin_sucursal ni siquiera
  // pide esta lista.
  useEffect(() => {
    if (!admin) return;
    let activo = true;
    setCargandoSucursales(true);
    api
      .get("/sucursales?per_page=100")
      .then((respuesta) => {
        if (!activo) return;
        // Defensivo: si SucursalController::index() no pagina y devuelve
        // un array plano, respuesta.data será undefined y usamos respuesta.
        setSucursales(respuesta.data ?? respuesta ?? []);
      })
      .catch((e) => {
        if (!activo) return;
        setErrorSucursales(e instanceof ApiError ? e.message : "No se pudieron cargar las sucursales.");
      })
      .finally(() => activo && setCargandoSucursales(false));
    return () => {
      activo = false;
    };
  }, [admin]);

  const sucursalSeleccionada = sucursales.find((s) => String(s.id_sucursal) === sucursalId);
  const nombreSucursalActual = admin ? sucursalSeleccionada?.nombre : actor.sucursal;
  const listoParaDescargar = admin ? Boolean(sucursalId) : true;

  const manejarDescarga = useCallback(
    async (tipo, formato) => {
      const clave = `${tipo.id}-${formato}`;
      setEstadoBoton((prev) => ({ ...prev, [clave]: true }));
      setErrorPorTipo((prev) => ({ ...prev, [tipo.id]: null }));

      try {
        const filtro = admin ? Number(sucursalId) : null;
        const filas = await obtenerDatosReporte(tipo, filtro);

        if (filas.length === 0) {
          setErrorPorTipo((prev) => ({
            ...prev,
            [tipo.id]: "No hay registros para exportar con este filtro.",
          }));
          return;
        }

        const nombreBase = nombreArchivoConFecha(tipo.id, nombreSucursalActual);
        const subtitulo = `Sucursal: ${nombreSucursalActual ?? "—"} · Generado el ${new Date().toLocaleDateString("es-CO")}`;

        if (formato === "excel") {
          descargarExcel({
            nombreArchivo: `${nombreBase}.xlsx`,
            hojaNombre: tipo.titulo,
            columnas: tipo.columnas,
            datos: filas,
          });
        } else {
          descargarPDF({
            nombreArchivo: `${nombreBase}.pdf`,
            titulo: tipo.titulo,
            subtitulo,
            columnas: tipo.columnas,
            datos: filas,
          });
        }
      } catch (e) {
        setErrorPorTipo((prev) => ({
          ...prev,
          [tipo.id]: e instanceof ApiError ? e.message : "No se pudo generar el archivo.",
        }));
      } finally {
        setEstadoBoton((prev) => ({ ...prev, [clave]: false }));
      }
    },
    [admin, sucursalId, nombreSucursalActual]
  );

  if (!puedeVer(actor)) {
    return (
      <div>
        <div className="breadcrumb">› Reportes</div>
        <h1 className="page-title">Reportes</h1>
        <div className="alert alert-danger u-max-480">
          <AlertTriangle size={16} className="u-icon-inline" />
          <span>No tienes permisos para ver esta sección.</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="breadcrumb">› Reportes</div>

      <div className="rv-header">
        <div>
          <h1 className="page-title">Reportes</h1>
          <p className="text-muted rv-subtitle">
            Exporta los registros de una sucursal a Excel o PDF. Cada tipo de dato se descarga por separado.
          </p>
        </div>
      </div>

      {admin ? (
        <div className="rv-picker-card">
          <label className="field-label" htmlFor="rv-sucursal">
            Sucursal
          </label>
          {cargandoSucursales ? (
            <p className="text-muted">Cargando sucursales...</p>
          ) : errorSucursales ? (
            <div className="alert alert-danger">
              <AlertTriangle size={16} className="u-icon-inline" />
              <span>{errorSucursales}</span>
            </div>
          ) : (
            <select
              id="rv-sucursal"
              className="field-select rv-select"
              value={sucursalId}
              onChange={(e) => setSucursalId(e.target.value)}
            >
              <option value="">Selecciona una sucursal...</option>
              {sucursales.map((s) => (
                <option key={s.id_sucursal} value={s.id_sucursal}>
                  {s.nombre}
                  {!s.activa ? " (inactiva)" : ""}
                </option>
              ))}
            </select>
          )}
          {!sucursalId && !cargandoSucursales && !errorSucursales && (
            <p className="field-help">Elige una sucursal para habilitar las descargas.</p>
          )}
        </div>
      ) : (
        <div className="rv-picker-card">
          <div className="rv-lock-note">
            <Lock size={13} />
            {actor.sucursal} — ves y exportas únicamente los registros de tu sucursal.
          </div>
        </div>
      )}

      <div className="rv-grid">
        {TIPOS_REPORTE.map((tipo) => {
          const Icono = ICONO_POR_TIPO[tipo.id] ?? Building2;
          const cargandoExcel = estadoBoton[`${tipo.id}-excel`];
          const cargandoPDF = estadoBoton[`${tipo.id}-pdf`];
          const error = errorPorTipo[tipo.id];

          return (
            <div className="rv-card" key={tipo.id}>
              <div className="rv-card-icon">
                <Icono size={20} />
              </div>
              <h2 className="section-title rv-card-title">{tipo.titulo}</h2>
              <p className="text-muted rv-card-desc">{tipo.descripcion}</p>

              {error && (
                <div className="alert alert-danger rv-card-error">
                  <AlertTriangle size={14} className="u-icon-inline" />
                  <span>{error}</span>
                </div>
              )}

              <div className="rv-card-actions">
                <button
                  className="btn btn-outline btn-sm"
                  disabled={!listoParaDescargar || cargandoExcel}
                  onClick={() => manejarDescarga(tipo, "excel")}
                >
                  {cargandoExcel ? <Loader2 size={14} className="rv-spin" /> : <FileSpreadsheet size={14} />}
                  Excel
                </button>
                <button
                  className="btn btn-outline btn-sm"
                  disabled={!listoParaDescargar || cargandoPDF}
                  onClick={() => manejarDescarga(tipo, "pdf")}
                >
                  {cargandoPDF ? <Loader2 size={14} className="rv-spin" /> : <FileText size={14} />}
                  PDF
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
