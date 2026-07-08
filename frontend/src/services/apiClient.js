/* ============================================================================
 * apiClient.js — único punto de contacto con el backend Laravel.
 * ----------------------------------------------------------------------------
 * Responsabilidades:
 *   1. Saber la URL base (VITE_API_URL, configurable en .env).
 *   2. Adjuntar "Authorization: Bearer {token}" automáticamente.
 *   3. Traducir las respuestas de error de Laravel a algo que la UI
 *      pueda mostrar sin que cada vista tenga que saber de status codes.
 *
 * Ningún componente debe usar fetch() directamente contra el backend —
 * todos pasan por aquí, igual que en el backend ningún controlador toca
 * la tabla `inventario` directo y todos pasan por InventarioService.
 * ==========================================================================*/

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000";
const TOKEN_KEY = "proyecto_ventas_token";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

/**
 * Error con forma consistente para toda la app:
 *   - status: código HTTP (o null si fue un fallo de red, no de la API)
 *   - message: texto listo para mostrar al usuario
 *   - errors: objeto de validación de Laravel ({ campo: ["mensaje"] }), si aplica
 */
export class ApiError extends Error {
  constructor(message, status, errors = null) {
    super(message);
    this.status = status;
    this.errors = errors;
  }
}

async function request(path, { method = "GET", body, auth = true } = {}) {
  const headers = { Accept: "application/json" };
  if (body) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  let response;
  try {
    response = await fetch(`${BASE_URL}/api${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkError) {
    // fetch() solo llega aquí si ni siquiera hubo respuesta HTTP: CORS,
    // backend caído, o 'php artisan serve' no está corriendo.
    throw new ApiError(
      `No se pudo conectar con el backend en ${BASE_URL}. Verifica que "php artisan serve" esté corriendo y que la URL en .env sea correcta.`,
      null
    );
  }

  if (response.status === 204) return null;

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    if (response.status === 401) {
      clearToken();
      throw new ApiError("Tu sesión expiró. Inicia sesión de nuevo.", 401);
    }
    if (response.status === 422) {
      // Laravel manda { message, errors: { campo: ["msg1", "msg2"] } }
      const primerError = data?.errors ? Object.values(data.errors)[0]?.[0] : null;
      throw new ApiError(primerError ?? data?.message ?? "Datos inválidos.", 422, data?.errors);
    }
    if (response.status === 429) {
      throw new ApiError("Demasiados intentos. Espera un minuto e intenta de nuevo.", 429);
    }
    if (response.status === 403) {
      throw new ApiError(data?.message ?? "No tienes permiso para hacer esto.", 403);
    }
    if (response.status === 409) {
      throw new ApiError(data?.message ?? "Conflicto con el estado actual del recurso.", 409);
    }
    throw new ApiError(data?.message ?? `Error inesperado (${response.status}).`, response.status);
  }

  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body, opts = {}) => request(path, { method: "POST", body, ...opts }),
  put: (path, body) => request(path, { method: "PUT", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  delete: (path) => request(path, { method: "DELETE" }),
  // Para endpoints que devuelven un archivo (ej. descarga de backups), no
  // JSON. request() no sirve aquí: llama response.json() incondicionalmente,
  // lo que rompería el binario. download() es análogo pero para blobs.
  download: (path) => requestBlob(path),
};

/**
 * Igual que request(), pero para respuestas binarias (application/*,
 * no JSON). Se mantiene separado de request() en vez de forzar una rama
 * condicional ahí adentro: son dos contratos distintos (JSON vs Blob) y
 * mezclarlos en una función hace más frágil el camino feliz de JSON que
 * usan las otras ~13 vistas.
 */
async function requestBlob(path) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let response;
  try {
    response = await fetch(`${BASE_URL}/api${path}`, { method: "GET", headers });
  } catch (networkError) {
    throw new ApiError(
      `No se pudo conectar con el backend en ${BASE_URL}. Verifica que "php artisan serve" esté corriendo.`,
      null
    );
  }

  if (!response.ok) {
    // BackupController::download() manda JSON incluso en error (404/422),
    // así que sí podemos leer un mensaje útil aquí antes de fallar.
    const data = await response.json().catch(() => null);
    if (response.status === 401) {
      clearToken();
      throw new ApiError("Tu sesión expiró. Inicia sesión de nuevo.", 401);
    }
    if (response.status === 403) throw new ApiError(data?.message ?? "No tienes permiso para hacer esto.", 403);
    if (response.status === 404) throw new ApiError(data?.message ?? "El archivo solicitado no existe.", 404);
    throw new ApiError(data?.message ?? `Error inesperado (${response.status}).`, response.status);
  }

  return response.blob();
}

/**
 * Fuerza la descarga de un Blob al dispositivo del usuario (carpeta de
 * Descargas por defecto del navegador). No depende de que el backend
 * exponga el header Content-Disposition vía CORS — el nombre de archivo
 * lo decide quien llama, que ya lo conoce (viene de generar() o listar()).
 */
export function triggerBrowserDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}