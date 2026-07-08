import React, { useState, useEffect, useCallback } from "react";
import { Database, RefreshCw, Download, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useAuth, esAdminGeneral } from "../context/AuthContext";
import { api, ApiError, triggerBrowserDownload } from "../services/apiClient";
import "../styles/BackupsView.css";

/* ============================================================================
 * BACKUPS — Generar, listar y descargar respaldos de la base de datos.
 * ----------------------------------------------------------------------------
 * Primera vista del frontend conectada 100% a la API real (las otras 13
 * todavía usan mocks/seedData.js) — no hay "modo demo" posible aquí, porque
 * un backup solo tiene sentido si es un dump real de la BD del backend.
 *
 * Autorización: refleja el Gate 'gestionar-backups' del backend (solo
 * admin_general, por sucursal_id === null — nunca por nombre de rol).
 * Si el Gate cambia, este guard debe actualizarse junto con él.
 *
 * Flujo de "Generar backup":
 *   1. POST /api/backups -> el backend corre mysqldump y guarda el .sql
 *   2. GET /api/backups/{filename}/descargar -> se trae el archivo como
 *      blob y se fuerza la descarga al dispositivo (requisito explícito:
 *      el respaldo debe llegar a la carpeta de Descargas, no solo quedar
 *      listado para descargar después).
 *   3. Se refresca la lista para reflejar el nuevo archivo + la retención
 *      automática que pudo haber borrado backups viejos (BackupService
 *      aplica retention_days en cada generar()).
 * ==========================================================================*/

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatFecha(iso) {
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

export default function BackupsView() {
  const { usuario: actor } = useAuth();
  const autorizado = esAdminGeneral(actor);

  const [backups, setBackups] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [generando, setGenerando] = useState(false);
  const [descargando, setDescargando] = useState(null); // filename en curso, o null
  const [error, setError] = useState(null);
  const [mensaje, setMensaje] = useState(null);

  const cargarBackups = useCallback(async () => {
    setCargando(true);
    setError(null);
    try {
      const data = await api.get("/backups");
      setBackups(data);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo cargar la lista de backups.");
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    if (autorizado) cargarBackups();
  }, [autorizado, cargarBackups]);

  async function descargarArchivo(filename) {
    setDescargando(filename);
    setError(null);
    try {
      const blob = await api.download(`/backups/${filename}/descargar`);
      triggerBrowserDownload(blob, filename);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo descargar el backup.");
    } finally {
      setDescargando(null);
    }
  }

  async function generarBackup() {
    setGenerando(true);
    setError(null);
    setMensaje(null);
    try {
      const nuevo = await api.post("/backups");
      await descargarArchivo(nuevo.filename);
      setMensaje(`Backup generado y descargado: ${nuevo.filename}`);
      await cargarBackups();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo generar el backup.");
    } finally {
      setGenerando(false);
    }
  }

  if (!autorizado) {
    return (
      <div>
        <div className="breadcrumb">› Backups</div>
        <h1 className="page-title">Backups</h1>
        <div className="alert alert-danger u-max-480">
          <AlertTriangle size={16} className="u-icon-inline" />
          <span>No tienes permisos para gestionar backups (Gate 'gestionar-backups': solo admin_general).</span>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="breadcrumb">› Backups</div>

      <div className="bv-header">
        <div>
          <h1 className="page-title">Copias de seguridad</h1>
          <p className="text-muted bv-subtitle">
            Respaldo completo de la base de datos (estructura + datos) en un archivo .sql de texto plano.
          </p>
        </div>
        <button className="btn btn-primary" onClick={generarBackup} disabled={generando}>
          {generando ? <Loader2 size={16} className="bv-spin" /> : <Database size={16} />}
          {generando ? "Generando..." : "Generar backup ahora"}
        </button>
      </div>

      {error && (
        <div className="alert alert-danger">
          <AlertTriangle size={16} className="u-icon-inline" />
          <span>{error}</span>
        </div>
      )}

      {mensaje && !error && (
        <div className="alert alert-success">
          <CheckCircle2 size={16} className="u-icon-inline" />
          <span>{mensaje} — revisa la carpeta de Descargas de tu navegador.</span>
        </div>
      )}

      <div className="bv-toolbar">
        <button className="btn btn-outline btn-sm" onClick={cargarBackups} disabled={cargando}>
          <RefreshCw size={14} className={cargando ? "bv-spin" : ""} />
          Actualizar lista
        </button>
      </div>

      <div className="data-table-card">
        <table className="data-table">
          <thead>
            <tr>
              <th>Archivo</th>
              <th>Tamaño</th>
              <th>Generado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cargando ? (
              <tr className="empty-row">
                <td colSpan={4}>Cargando backups...</td>
              </tr>
            ) : backups.length === 0 ? (
              <tr className="empty-row">
                <td colSpan={4}>Todavía no hay ningún backup generado.</td>
              </tr>
            ) : (
              backups.map((b) => (
                <tr key={b.filename}>
                  <td className="text-mono">{b.filename}</td>
                  <td>{formatBytes(b.size)}</td>
                  <td>{formatFecha(b.created_at)}</td>
                  <td>
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => descargarArchivo(b.filename)}
                      disabled={descargando === b.filename}
                    >
                      {descargando === b.filename ? (
                        <Loader2 size={13} className="bv-spin" />
                      ) : (
                        <Download size={13} />
                      )}
                      Descargar
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
