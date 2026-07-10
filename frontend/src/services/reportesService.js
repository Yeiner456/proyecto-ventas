import { api } from "./apiClient";

/* ============================================================================
 * reportesService.js — datos para la vista de Reportes/Exportación.
 * ----------------------------------------------------------------------------
 * No agrega ningún endpoint nuevo al backend: reutiliza los 4 endpoints
 * que YA existen y YA están scoped por sucursal (ver Policies +
 * FiltraPorSucursal en el backend). Solo pide TODAS las páginas en vez
 * de una sola, porque exportar necesita el dataset completo, no una
 * página de 15-20 registros.
 *
 * Filtro por sucursal para admin_general:
 *   Ninguno de los 4 controladores (ProductoController, UsuarioController,
 *   VentaController, InventarioController) acepta un query param
 *   'sucursal_id' cuando quien pregunta es admin_general — en ese caso
 *   simplemente devuelven TODAS las sucursales mezcladas (es la única
 *   pieza de "generar todo en el frontend sin tocar el backend" que no
 *   viene gratis). Por eso cada tipo de reporte trae 'sucursalDe(fila)':
 *   una función que sabe leer el sucursal_id de ESE recurso (directo en
 *   productos/usuarios/ventas, anidado en producto.sucursal_id para
 *   inventario), y el filtrado final por la sucursal elegida ocurre en
 *   obtenerDatosReporte() de aquí abajo.
 *
 *   Para admin_sucursal no hace falta filtrar nada: el backend ya le
 *   devuelve solo su propia sucursal sin que la pida (aplicarFiltroSucursal
 *   en cada controller), así que sucursalIdFiltro llega como null.
 *
 * Si en el futuro el volumen de datos crece y este "traer todo y filtrar
 * en el navegador" pesa demasiado, la mejora natural es agregar soporte a
 * '?sucursal_id=' en esos 4 controladores (un cambio pequeño y localizado,
 * no un rediseño).
 * ==========================================================================*/

const TAMANO_PAGINA = 200;

/**
 * Trae TODAS las páginas de un endpoint paginado por Laravel (paginate()).
 * Los 4 endpoints que usa Reportes devuelven siempre la forma estándar
 * { data: [...], meta: { last_page, ... } }.
 */
async function obtenerTodasLasPaginas(endpoint) {
  const acumulado = [];
  let pagina = 1;
  let ultimaPagina = 1;

  do {
    const respuesta = await api.get(`${endpoint}?page=${pagina}&per_page=${TAMANO_PAGINA}`);
    acumulado.push(...(respuesta.data ?? []));
    ultimaPagina = respuesta.meta?.last_page ?? 1;
    pagina++;
  } while (pagina <= ultimaPagina);

  return acumulado;
}

const ESTADO_VENTA_LABEL = {
  pendiente: "Pendiente",
  en_preparacion: "En preparación",
  listo_para_entregar: "Listo para entregar",
  pagado: "Pagado",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

function formatoMoneda(valor) {
  return `$${Number(valor ?? 0).toLocaleString("es-CO")}`;
}

function formatoFecha(iso) {
  return new Date(iso).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" });
}

/**
 * Un tipo de reporte = un recurso exportable.
 *   endpoint    -> de dónde se trae el dataset completo
 *   sucursalDe  -> cómo leer el sucursal_id de una fila de ESTE recurso
 *   columnas    -> encabezado + cómo leer/formatear cada celda
 *
 * IMPORTANTE: 'usuarios' nunca expone password_hash aquí ni en el backend
 * (Usuario::$hidden ya lo excluye del JSON) — no agregues ese campo a las
 * columnas de abajo.
 */
export const TIPOS_REPORTE = [
  {
    id: "productos",
    titulo: "Productos",
    descripcion: "Catálogo de productos con precio, stock y estado.",
    endpoint: "/productos",
    sucursalDe: (fila) => fila.sucursal_id,
    columnas: [
      { header: "Producto", accessor: (f) => f.nombre },
      { header: "Categoría", accessor: (f) => f.categoria?.nombre ?? "Sin categoría" },
      { header: "Precio base", accessor: (f) => formatoMoneda(f.precio_base) },
      { header: "Maneja stock", accessor: (f) => (f.maneja_stock ? "Sí" : "No") },
      { header: "Stock mínimo", accessor: (f) => (f.maneja_stock ? f.stock_minimo : "—") },
      { header: "Stock actual", accessor: (f) => (f.maneja_stock ? f.inventario?.cantidad ?? 0 : "No aplica") },
      { header: "Activo", accessor: (f) => (f.activo ? "Sí" : "No") },
    ],
  },
  {
    id: "usuarios",
    titulo: "Usuarios",
    descripcion: "Personal con acceso al sistema, por rol.",
    endpoint: "/usuarios",
    sucursalDe: (fila) => fila.sucursal_id,
    columnas: [
      { header: "Nombre", accessor: (f) => f.nombre },
      { header: "Rol", accessor: (f) => f.rol?.nombre ?? "—" },
      { header: "Sucursal", accessor: (f) => f.sucursal?.nombre ?? "—" },
      { header: "Activo", accessor: (f) => (f.activo ? "Sí" : "No") },
    ],
  },
  {
    id: "ventas",
    titulo: "Ventas",
    descripcion: "Historial de ventas con estado y método de pago.",
    endpoint: "/ventas",
    sucursalDe: (fila) => fila.sucursal_id,
    columnas: [
      { header: "Venta #", accessor: (f) => f.id_venta },
      { header: "Fecha", accessor: (f) => formatoFecha(f.created_at) },
      { header: "Cajero", accessor: (f) => f.cajero?.nombre ?? "—" },
      { header: "Estado", accessor: (f) => ESTADO_VENTA_LABEL[f.estado] ?? f.estado },
      { header: "Método de pago", accessor: (f) => f.metodoPago?.nombre ?? "—" },
      { header: "Total", accessor: (f) => formatoMoneda(f.total) },
    ],
  },
  {
    id: "inventario",
    titulo: "Inventario",
    descripcion: "Stock actual por producto y alertas de mínimo.",
    endpoint: "/inventario",
    sucursalDe: (fila) => fila.producto?.sucursal_id,
    columnas: [
      { header: "Producto", accessor: (f) => f.producto?.nombre ?? "—" },
      { header: "Sucursal", accessor: (f) => f.producto?.sucursal?.nombre ?? "—" },
      { header: "Stock actual", accessor: (f) => f.cantidad },
      { header: "Stock mínimo", accessor: (f) => f.producto?.stock_minimo ?? "—" },
      {
        header: "Estado",
        accessor: (f) => (f.cantidad <= (f.producto?.stock_minimo ?? 0) ? "Bajo mínimo" : "Normal"),
      },
    ],
  },
];

/**
 * Dataset completo de un tipo de reporte.
 *   sucursalIdFiltro === null  -> no filtra (caso admin_sucursal: el
 *     backend ya limitó todo a su propia sucursal).
 *   sucursalIdFiltro (number)  -> filtra en el navegador por esa
 *     sucursal (caso admin_general, que recibió todas mezcladas).
 */
export async function obtenerDatosReporte(tipo, sucursalIdFiltro) {
  const filas = await obtenerTodasLasPaginas(tipo.endpoint);

  if (sucursalIdFiltro == null) return filas;

  return filas.filter((fila) => tipo.sucursalDe(fila) === sucursalIdFiltro);
}
