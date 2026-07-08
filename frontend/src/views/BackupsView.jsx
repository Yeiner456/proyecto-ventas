import React, { useState, useEffect, useCallback, useRef } from "react";
import { Database, RefreshCw, Download, Upload, Loader2, AlertTriangle, CheckCircle2, X } from "lucide-react";
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

/**
 * Confirmación reforzada: como restaurar sobrescribe TODA la base de
 * datos (el .sql empieza con DROP TABLE por cada tabla), un simple
 * "¿seguro?" no es suficiente advertencia. Se exige escribir RESTAURAR
 * textualmente para habilitar el botón — mismo espíritu que los demás
 * modales de confirmación del proyecto (ConfirmDeleteModal en
 * UsuariosView), pero con una fricción extra deliberada acorde al riesgo.
 */
function RestaurarModal({ archivo, onCancel, onConfirm, restaurando, error }) {
  const [confirmText, setConfirmText] = useState("");
  const habilitado = confirmText.trim().toUpperCase() === "RESTAURAR";

  return (
    <div className="modal-overlay" onMouseDown={onCancel}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3 className="modal-title">Restaurar base de datos</h3>
          <button className="modal-close" onClick={onCancel}>
            <X size={18} />
          </button>
        </div>

        <div className="alert alert-danger">
          <AlertTriangle size={16} className="u-icon-inline" />
          <span>
            Esto reemplaza <strong>toda</strong> la base de datos actual con el contenido de{" "}
            <strong>{archivo.name}</strong>. Todo lo registrado después de la fecha de ese backup
            se perderá. Esta acción no se puede deshacer directamente (aunque se genera un backup
            del estado actual justo antes, por si hay que volver atrás).
          </span>
        </div>

        <p className="u-confirm-text">
          Para confirmar, escribe <strong>RESTAURAR</strong> en el campo:
        </p>
        <input
          className="field-input u-mb-10"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          placeholder="RESTAURAR"
          disabled={restaurando}
          autoFocus
        />

        {error && (
          <div className="alert alert-danger">
            <AlertTriangle size={16} className="u-icon-inline" />
            <span>{error}</span>
          </div>
        )}

        <div className="modal-actions">
          <button className="btn btn-outline" onClick={onCancel} disabled={restaurando}>
            Cancelar
          </button>
          <button className="btn btn-danger" onClick={onConfirm} disabled={!habilitado || restaurando}>
            {restaurando ? "Restaurando..." : "Restaurar base de datos"}
          </button>
        </div>
      </div>
    </div>
  );
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

  const [archivoSeleccionado, setArchivoSeleccionado] = useState(null);
  const [mostrarConfirmacion, setMostrarConfirmacion] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [errorRestaurar, setErrorRestaurar] = useState(null);
  const inputArchivoRef = useRef(null);

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

  async function restaurarBackup() {
    if (!archivoSeleccionado) return;
    setRestaurando(true);
    setErrorRestaurar(null);
    try {
      const formData = new FormData();
      formData.append("archivo", archivoSeleccionado);
      const resultado = await api.uploadFile("/backups/restaurar", formData);
      setMostrarConfirmacion(false);
      setArchivoSeleccionado(null);
      if (inputArchivoRef.current) inputArchivoRef.current.value = "";
      setError(null);
      setMensaje(
        `Base de datos restaurada correctamente. Se generó un backup del estado anterior: ${resultado.backup_previo}.`
      );
      await cargarBackups();
    } catch (e) {
      // El error se muestra DENTRO del modal (no se cierra), para que el
      // usuario pueda reintentar sin tener que volver a seleccionar el
      // archivo y volver a escribir "RESTAURAR".
      setErrorRestaurar(e instanceof ApiError ? e.message : "No se pudo restaurar el backup.");
    } finally {
      setRestaurando(false);
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

      <div className="bv-restore-card">
        <h2 className="bv-restore-title">Restaurar desde un archivo</h2>
        <p className="text-muted bv-subtitle">
          Sube un backup .sql (por ejemplo, uno que hayas descargado antes) para reemplazar la
          base de datos actual con su contenido.
        </p>
        <div className="u-flex-gap-10">
          <input
            ref={inputArchivoRef}
            type="file"
            accept=".sql"
            className="field-input"
            onChange={(e) => setArchivoSeleccionado(e.target.files?.[0] ?? null)}
          />
          <button
            className="btn btn-danger-ghost"
            disabled={!archivoSeleccionado}
            onClick={() => setMostrarConfirmacion(true)}
          >
            <Upload size={14} />
            Restaurar este archivo
          </button>
        </div>
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

      {mostrarConfirmacion && archivoSeleccionado && (
        <RestaurarModal
          archivo={archivoSeleccionado}
          restaurando={restaurando}
          error={errorRestaurar}
          onCancel={() => {
            if (restaurando) return; // no cerrar a mitad de una restauración en curso
            setMostrarConfirmacion(false);
            setErrorRestaurar(null);
          }}
          onConfirm={restaurarBackup}
        />
      )}
    </div>
  );
}
