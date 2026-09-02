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
 * Filtro por fecha (agregado 2026-08-11, SOLO para "ventas"):
 *   Mismo criterio que el filtro de sucursal: se filtra en el navegador,
 *   sin tocar el backend. Cada tipo de reporte que admita este filtro
 *   trae 'fechaDe(fila)' — hoy solo "ventas" lo define, porque es el
 *   único de los 4 con una fecha de negocio relevante para filtrar. Los
 *   demás tipos simplemente no lo tienen y obtenerDatosReporte() lo
 *   ignora para ellos sin error.
 *
 *   'calcularRangoFecha()' traduce un preset ("semana", "mes", etc.) o
 *   una selección manual del usuario a un rango { desde, hasta } de
 *   objetos Date, en hora LOCAL del navegador (no UTC), para que
 *   coincida con cómo el usuario percibe "hoy" y con formatoFecha() de
 *   aquí mismo. "Última semana"/"último mes" son ventanas CORRIDAS de
 *   7/30 días incluyendo el día de hoy, no semana/mes calendario.
 *
 * Filtro por categoría (agregado 2026, SOLO para "ventas"):
 *   Mismo criterio que fecha y sucursal: se filtra en el navegador, sin
 *   tocar el backend (VentaController::index() ya trae
 *   'detalles.producto.categoria' anidado desde que se agregó el filtro
 *   de categorías a VentasView). A diferencia de sucursalDe/fechaDe, una
 *   venta puede tener productos de VARIAS categorías a la vez (café +
 *   pastel en la misma venta) — por eso 'categoriasDe(fila)' devuelve un
 *   ARRAY de categorías, no un solo valor, y obtenerDatosReporte() usa
 *   .some() para saber si esa venta tiene AL MENOS UN producto de la
 *   categoría elegida. 'categoriasUnicasDeVenta()' (más abajo) es la
 *   misma lógica que categoriasDeVenta() en VentasView.jsx, duplicada a
 *   propósito: es una función pura de pocas líneas, y crear un util
 *   compartido solo para esto hubiera significado que este archivo de
 *   servicio importe algo desde un archivo de vista, invirtiendo la
 *   dependencia esperada (services no deberían depender de views).
 *
 * Si en el futuro el volumen de datos crece y este "traer todo y filtrar
 * en el navegador" pesa demasiado, la mejora natural es agregar soporte a
 * '?sucursal_id=' y '?desde=/?hasta=' en los controllers (un cambio
 * pequeño y localizado, no un rediseño).
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

// Categorías ÚNICAS presentes en los detalles de una venta (puede haber
// más de una: café + pastel en la misma venta). Misma lógica que
// categoriasDeVenta() en VentasView.jsx — ver nota de cabecera sobre por
// qué está duplicada en vez de compartida.
function categoriasUnicasDeVenta(fila) {
  const mapa = new Map();
  (fila.detalles ?? []).forEach((d) => {
    if (d.producto?.categoria) mapa.set(d.producto.categoria.id_categoria, d.producto.categoria);
  });
  return [...mapa.values()];
}

/**
 * Un tipo de reporte = un recurso exportable.
 *   endpoint     -> de dónde se trae el dataset completo
 *   sucursalDe   -> cómo leer el sucursal_id de una fila de ESTE recurso
 *   fechaDe      -> (opcional) cómo leer la fecha de una fila, para el
 *                   filtro de fecha. Solo "ventas" lo trae por ahora.
 *   categoriasDe -> (opcional) cómo leer las categorías (plural: array)
 *                   de una fila. Solo "ventas" lo trae por ahora.
 *   columnas     -> encabezado + cómo leer/formatear cada celda
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
    fechaDe: (fila) => fila.created_at,
    categoriasDe: categoriasUnicasDeVenta,
    columnas: [
      { header: "Venta #", accessor: (f) => f.id_venta },
      { header: "Fecha", accessor: (f) => formatoFecha(f.created_at) },
      { header: "Categorías", accessor: (f) => categoriasUnicasDeVenta(f).map((c) => c.nombre).join(", ") || "—" },
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
 * Calcula el rango { desde, hasta } (objetos Date, en hora local) para
 * el filtro de fecha de Ventas. 'hasta' siempre cierra al final del día
 * (23:59:59.999) para no perder registros de "hoy" por la hora exacta
 * en la que se genera el reporte.
 *
 *   'semana'      -> últimos 7 días corridos, incluyendo hoy
 *   'mes'         -> últimos 30 días corridos, incluyendo hoy
 *   'especifica'  -> un solo día -> opciones.fecha ("YYYY-MM-DD")
 *   'rango'       -> rango libre -> opciones.desde / opciones.hasta ("YYYY-MM-DD")
 *   cualquier otro valor (ej. 'todo') o datos incompletos -> null (sin filtro)
 */
export function calcularRangoFecha(preset, opciones = {}) {
  const hoy = new Date();
  const finDeHoy = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate(), 23, 59, 59, 999);

  function parsearFechaLocal(yyyyMmDd, horas, minutos, segundos, ms) {
    const [anio, mes, dia] = yyyyMmDd.split("-").map(Number);
    return new Date(anio, mes - 1, dia, horas, minutos, segundos, ms);
  }

  switch (preset) {
    case "semana": {
      const desde = new Date(finDeHoy);
      desde.setDate(desde.getDate() - 6);
      desde.setHours(0, 0, 0, 0);
      return { desde, hasta: finDeHoy };
    }
    case "mes": {
      const desde = new Date(finDeHoy);
      desde.setDate(desde.getDate() - 29);
      desde.setHours(0, 0, 0, 0);
      return { desde, hasta: finDeHoy };
    }
    case "especifica": {
      if (!opciones.fecha) return null;
      const desde = parsearFechaLocal(opciones.fecha, 0, 0, 0, 0);
      const hasta = parsearFechaLocal(opciones.fecha, 23, 59, 59, 999);
      return { desde, hasta };
    }
    case "rango": {
      if (!opciones.desde || !opciones.hasta) return null;
      let desde = parsearFechaLocal(opciones.desde, 0, 0, 0, 0);
      let hasta = parsearFechaLocal(opciones.hasta, 23, 59, 59, 999);
      if (desde > hasta) {
        [desde, hasta] = [hasta, desde]; // defensivo: fechas invertidas
      }
      return { desde, hasta };
    }
    default:
      return null;
  }
}

/**
 * Etiqueta legible del filtro de fecha activo, para el subtítulo del
 * PDF exportado (trazabilidad: con qué filtro se generó el archivo).
 */
export function describirRangoFecha(preset, rango) {
  if (!rango) return null;
  const fmt = (d) => d.toLocaleDateString("es-CO");
  if (preset === "semana") return "Última semana";
  if (preset === "mes") return "Último mes";
  if (preset === "especifica") return `Fecha: ${fmt(rango.desde)}`;
  if (preset === "rango") return `Del ${fmt(rango.desde)} al ${fmt(rango.hasta)}`;
  return null;
}

/**
 * Dataset completo de un tipo de reporte.
 *   sucursalIdFiltro === null/undefined -> no filtra por sucursal (caso
 *     admin_sucursal: el backend ya limitó todo a su propia sucursal).
 *   sucursalIdFiltro (number) -> filtra en el navegador por esa sucursal
 *     (caso admin_general, que recibió todas mezcladas).
 *
 *   rangoFecha (objeto { desde, hasta } de calcularRangoFecha(), o null)
 *     -> si se pasa Y el tipo trae 'fechaDe', filtra también por fecha.
 *     Para tipos sin 'fechaDe' (hoy: productos, usuarios, inventario) se
 *     ignora sin error, así que es seguro pasar null siempre para ellos.
 *
 *   categoriaIdFiltro (number, o null) -> si se pasa Y el tipo trae
 *     'categoriasDe', filtra las filas que tengan AL MENOS UN producto
 *     de esa categoría (fila.categoriasDe() devuelve un ARRAY, no un
 *     solo valor — por eso .some() y no ===). Para tipos sin
 *     'categoriasDe' (hoy: productos, usuarios, inventario) se ignora
 *     sin error, igual que rangoFecha.
 */
export async function obtenerDatosReporte(tipo, sucursalIdFiltro, rangoFecha = null, categoriaIdFiltro = null) {
  let filas = await obtenerTodasLasPaginas(tipo.endpoint);

  if (sucursalIdFiltro != null) {
    filas = filas.filter((fila) => tipo.sucursalDe(fila) === sucursalIdFiltro);
  }

  if (rangoFecha && tipo.fechaDe) {
    filas = filas.filter((fila) => {
      const valor = tipo.fechaDe(fila);
      if (!valor) return false;
      const fecha = new Date(valor);
      return fecha >= rangoFecha.desde && fecha <= rangoFecha.hasta;
    });
  }

  if (categoriaIdFiltro != null && tipo.categoriasDe) {
    filas = filas.filter((fila) => tipo.categoriasDe(fila).some((c) => c.id_categoria === categoriaIdFiltro));
  }

  return filas;
}
