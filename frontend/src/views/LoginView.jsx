import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Eye, EyeOff, AlertTriangle, LogIn } from "lucide-react";
import { useAuth } from "../context/AuthContext";

/* ============================================================================
 * LOGIN — POST /api/login
 * ----------------------------------------------------------------------------
 * El backend pide id_usuario (el ID numérico, PK de la tabla). La tabla
 * usuarios no tiene columna de email (proyecto de uso local, sin
 * necesidad de correo) — LoginRequest solo acepta el número de ID.
 *
 * Anti-enumeración (AuthController::login): la API devuelve el MISMO
 * mensaje genérico tanto si el id_usuario no existe como si la
 * contraseña es incorrecta, para que no se pueda adivinar qué IDs son
 * válidos probando uno por uno. Por eso este formulario muestra el
 * error como una alerta general, no pegado a un campo específico — así
 * no reintroduzco esa fuga de información con un detalle visual.
 * ==========================================================================*/

const styles = `
.login-shell { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg); font-family: 'Roboto', sans-serif; }
.login-card { background: var(--white); border: 1px solid var(--border); border-radius: 14px; padding: 36px 34px; width: 100%; max-width: 380px; }
.login-brand { text-align: center; margin-bottom: 26px; }
.login-brand-name { font-family: 'Inter', sans-serif; font-weight: 700; font-size: 22px; color: var(--ink); margin: 0; }
.login-brand-sub { font-family: 'Roboto', sans-serif; font-size: 13px; color: var(--text-secondary); margin-top: 4px; }
.login-password-wrap { position: relative; }
.login-password-wrap button { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--text-secondary); padding: 4px; }
.login-help { margin-top: 18px; padding-top: 16px; border-top: 1px solid var(--border); font-size: 11.5px; color: var(--text-secondary); line-height: 1.5; }
.login-help code { background: #F3F4F6; padding: 1px 5px; border-radius: 4px; font-family: 'Roboto Mono', monospace; }
`;

export default function LoginView() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [idUsuario, setIdUsuario] = useState("");
  const [password, setPassword] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);

    if (!idUsuario || !password) {
      setError("Completa ambos campos.");
      return;
    }

    setEnviando(true);
    try {
      await login(idUsuario, password);
      navigate("/dashboard", { replace: true });
    } catch (err) {
      setError(err.message ?? "No se pudo iniciar sesión.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="login-shell">
      <style>{styles}</style>
      <div className="login-card">
        <div className="login-brand">
          <p className="login-brand-name">CafeteriaApp</p>
          <p className="login-brand-sub">Panel de gestión</p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label className="field-label">ID de usuario</label>
            <input
              className="field-input"
              type="number"
              inputMode="numeric"
              value={idUsuario}
              onChange={(e) => setIdUsuario(e.target.value)}
              placeholder="ej. 1"
              autoFocus
            />
          </div>

          <div className="field">
            <label className="field-label">Contraseña</label>
            <div className="login-password-wrap">
              <input
                className="field-input"
                type={mostrarPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button type="button" onClick={() => setMostrarPassword((v) => !v)} tabIndex={-1}>
                {mostrarPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="alert alert-danger">
              <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" className="btn btn-primary" style={{ width: "100%", justifyContent: "center" }} disabled={enviando}>
            <LogIn size={16} />
            {enviando ? "Ingresando..." : "Iniciar sesión"}
          </button>
        </form>

        <div className="login-help">
          <p>Si olvidaste la contraseña o el ID, consulta el manual de instalacion o consultalo con un adminstrador.</p>
        </div>
      </div>
    </div>
  );
}