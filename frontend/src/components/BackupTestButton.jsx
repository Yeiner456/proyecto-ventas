import React, { useState } from "react";

/* ============================================================================
 * BackupTestButton — SOLO PARA VERIFICACIÓN MANUAL.
 * ----------------------------------------------------------------------------
 * No es parte del diseño final. Sirve para confirmar que
 * POST /api/backups responde bien antes de invertir tiempo en la vista
 * definitiva (BackupsView, con useAuth(), estilos, tabla de historial, etc).
 *
 * Bórralo (o el import que lo monte) una vez confirmemos que funciona.
 * ==========================================================================*/

const API_URL = "http://localhost:8000/api";

export default function BackupTestButton() {
  const [token, setToken] = useState("");
  const [estado, setEstado] = useState("idle"); // idle | cargando | ok | error
  const [mensaje, setMensaje] = useState("");

  async function generarBackup() {
    if (!token.trim()) {
      setEstado("error");
      setMensaje("Pega primero el Bearer token de un usuario admin_general.");
      return;
    }

    setEstado("cargando");
    setMensaje("");

    try {
      const res = await fetch(`${API_URL}/backups`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.trim()}`,
          Accept: "application/json",
        },
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || `Error HTTP ${res.status}`);
      }

      setEstado("ok");
      setMensaje(`Backup creado: ${data.filename} (${data.size} bytes)`);
    } catch (err) {
      setEstado("error");
      setMensaje(err.message);
    }
  }

  return (
    <div style={{ padding: 16, border: "1px dashed #999", borderRadius: 8, maxWidth: 480 }}>
      <p style={{ marginBottom: 8, fontWeight: 600 }}>Prueba manual — Generar backup</p>

      <input
        type="text"
        placeholder="Pega aquí el Bearer token (admin_general)"
        value={token}
        onChange={(e) => setToken(e.target.value)}
        style={{ width: "100%", padding: 8, marginBottom: 8, fontFamily: "monospace" }}
      />

      <button onClick={generarBackup} disabled={estado === "cargando"}>
        {estado === "cargando" ? "Generando..." : "Generar backup"}
      </button>

      {mensaje && (
        <p style={{ marginTop: 8, color: estado === "error" ? "#EF4444" : "#39A900" }}>
          {mensaje}
        </p>
      )}
    </div>
  );
}