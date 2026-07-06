/* ============================================================================
 * seedData.js — única fuente de datos de referencia para el prototipo.
 * ----------------------------------------------------------------------------
 * Equivalente en el frontend a lo que RolSeeder / SucursalSeeder /
 * UsuarioSeeder son en el backend: un set de datos consistente que todas
 * las vistas comparten mientras no hay conexión real a la API.
 *
 * REGLA: ninguna vista debe declarar su propia lista de roles/sucursales/
 * usuarios de ejemplo. Todas importan de aquí. Cuando se conecte la API
 * real, este archivo se reemplaza por las respuestas de
 * GET /api/roles, /api/sucursales, /api/usuarios — la forma de los
 * objetos ya coincide con esas respuestas para que el reemplazo sea directo.
 * ==========================================================================*/

// Coincide con backend/database/seeders/SucursalSeeder.php — solo existen
// estas 2 sucursales en los datos reales. Si el equipo agrega una tercera
// sucursal al seeder del backend, agrégala aquí también.
export const sucursales = [
  {
    id_sucursal: 1,
    nombre: "Sucursal Centro",
    direccion: "Calle 10 #5-50, Bogotá",
    telefono: "3001112233",
    email: "centro@monito.com",
    activa: true,
  },
  {
    id_sucursal: 2,
    nombre: "Sucursal Norte",
    direccion: "Av. 19 #120-30, Bogotá",
    telefono: "3004445566",
    email: "norte@monito.com",
    activa: true,
  },
];

export const roles = [
  {
    id_rol: 1,
    nombre: "admin_general",
    descripcion: "Administrador general del sistema. Ve y gestiona todas las sucursales.",
    activo: true,
  },
  {
    id_rol: 2,
    nombre: "admin_sucursal",
    descripcion: "Administra una sucursal específica (incluye funciones contables de esa sucursal).",
    activo: true,
  },
  {
    id_rol: 3,
    nombre: "cajero",
    descripcion: "Opera el día a día: registra ventas y cobra. Atado a una sucursal.",
    activo: true,
  },
];

// sucursal_id === null  ->  admin_general (misma regla que Usuario::esAdminGeneral() en el backend)
export const usuarios = [
  // --- Reales, coinciden exactamente con UsuarioSeeder.php (password: password123) ---
  { id_usuario: 1, nombre: "Admin General", email: "admin@monito.com", rol_id: 1, sucursal_id: null, activo: true },
  { id_usuario: 2, nombre: "Admin Sucursal Centro", email: "adminsucursal@monito.com", rol_id: 2, sucursal_id: 1, activo: true },
  { id_usuario: 3, nombre: "Cajero Centro", email: "cajero@monito.com", rol_id: 3, sucursal_id: 1, activo: true },
  { id_usuario: 4, nombre: "Cajero Norte", email: "cajeronorte@monito.com", rol_id: 3, sucursal_id: 2, activo: true },
  // --- Demo de UI únicamente — NO existen en el backend real, solo dan
  // variedad para probar tablas/filtros con más de una fila por sucursal ---
  { id_usuario: 5, nombre: "Laura Pérez", email: "l.perez@example.com", rol_id: 2, sucursal_id: 1, activo: true },
  { id_usuario: 6, nombre: "Maria Gaviria", email: "m.gaviria@example.com", rol_id: 3, sucursal_id: 1, activo: true },
  { id_usuario: 7, nombre: "Sofia Montoya", email: "s.montoya@example.com", rol_id: 3, sucursal_id: 1, activo: true },
  { id_usuario: 8, nombre: "Camila Rojas", email: "c.rojas@example.com", rol_id: 3, sucursal_id: 2, activo: true },
  { id_usuario: 9, nombre: "Daniel Ospina", email: "d.ospina@example.com", rol_id: 3, sucursal_id: 2, activo: false },
  { id_usuario: 10, nombre: "Valentina Cárdenas", email: "v.cardenas@example.com", rol_id: 3, sucursal_id: 2, activo: true },
];

// Coincide con backend/database/seeders/CategoriaProductoSeeder.php
export const categorias = [
  { id_categoria: 1, sucursal_id: 1, nombre: "Bebidas" },
  { id_categoria: 2, sucursal_id: 1, nombre: "Comidas" },
  { id_categoria: 3, sucursal_id: 1, nombre: "Snacks" },
  { id_categoria: 4, sucursal_id: 2, nombre: "Bebidas" },
  { id_categoria: 5, sucursal_id: 2, nombre: "Comidas" },
  { id_categoria: 6, sucursal_id: 2, nombre: "Snacks" },
];

// Coincide con backend/database/seeders/ProductoSeeder.php (solo Sucursal
// Centro tiene productos sembrados en el backend real). tieneVentas marca
// los 2 productos que DemoVentaSeeder.php ya vendió, para reproducir el
// mismo bloqueo de eliminación (409) que tendría la API real.
export const productos = [
  { id_producto: 1, sucursal_id: 1, categoria_id: 1, nombre: "Gaseosa 400ml", descripcion: null, precio_base: 3500, maneja_stock: true, stock_minimo: 10, activo: true, tieneVentas: true },
  { id_producto: 2, sucursal_id: 1, categoria_id: 1, nombre: "Agua 600ml", descripcion: null, precio_base: 2500, maneja_stock: true, stock_minimo: 15, activo: true, tieneVentas: false },
  { id_producto: 3, sucursal_id: 1, categoria_id: 3, nombre: "Papas fritas 45g", descripcion: null, precio_base: 4000, maneja_stock: true, stock_minimo: 10, activo: true, tieneVentas: false },
  { id_producto: 4, sucursal_id: 1, categoria_id: 3, nombre: "Chocolatina", descripcion: null, precio_base: 2000, maneja_stock: true, stock_minimo: 10, activo: true, tieneVentas: false },
  { id_producto: 5, sucursal_id: 1, categoria_id: 2, nombre: "Hamburguesa clásica", descripcion: null, precio_base: 15000, maneja_stock: false, stock_minimo: 0, activo: true, tieneVentas: true },
  { id_producto: 6, sucursal_id: 1, categoria_id: 2, nombre: "Perro caliente", descripcion: null, precio_base: 9000, maneja_stock: false, stock_minimo: 0, activo: true, tieneVentas: false },
  { id_producto: 7, sucursal_id: 1, categoria_id: 1, nombre: "Café americano", descripcion: null, precio_base: 4500, maneja_stock: false, stock_minimo: 0, activo: true, tieneVentas: false },
];

// Inventario.cantidad por producto_id. 'Papas fritas 45g' queda a propósito
// por debajo de su stock_minimo (5 < 10) — el mismo caso de prueba que
// ProductoSeeder.php deja para validar la alerta de stock bajo.
export const inventario = [
  { producto_id: 1, cantidad: 50 },
  { producto_id: 2, cantidad: 80 },
  { producto_id: 3, cantidad: 5 },
  { producto_id: 4, cantidad: 40 },
];

// Coincide con backend/database/seeders/MetodoPagoSeeder.php
export const metodosPago = [
  { id_metodo_pago: 1, nombre: "Efectivo", es_default: true, requiere_comp: false, activo: true },
  { id_metodo_pago: 2, nombre: "Tarjeta", es_default: false, requiere_comp: false, activo: true },
  { id_metodo_pago: 3, nombre: "Transferencia bancaria", es_default: false, requiere_comp: true, activo: true },
];

// Coincide con backend/database/seeders/DemoVentaSeeder.php: 1 venta ya
// pagada (Gaseosa 400ml x2 + Hamburguesa clásica x1), con su factura
// generada. Cuando construyamos VentasView completo, este arreglo pasa a
// tener más entradas para probar los demás estados (pendiente,
// en_preparacion, listo_para_entregar, cancelado).
// id_venta:1 es la única venta REAL de DemoVentaSeeder.php. Las demás
// (2, 3, 4) NO existen en el backend sembrado — las agrego únicamente
// para poder mostrar en la UI los otros estados de Venta::ESTADOS
// (pendiente, en_preparacion, cancelado) sin tener que operar el POS
// varias veces a mano. Bórralas de aquí cuando haya API real: allí el
// registro reflejará lo que de verdad exista en la base de datos.
export const ventas = [
  {
    id_venta: 1,
    sucursal_id: 1,
    cajero_id: 3, // Cajero Centro (real, cajero@monito.com)
    estado: "pagado",
    metodo_pago_id: 1,
    total: 22000,
    observacion: "Venta de ejemplo (seeder)",
    created_at: "2026-06-20T10:15:00",
    detalles: [
      { producto_id: 1, nombre: "Gaseosa 400ml", cantidad: 2, precio_unitario_venta: 3500 },
      { producto_id: 5, nombre: "Hamburguesa clásica", cantidad: 1, precio_unitario_venta: 15000 },
    ],
  },
  // --- A partir de aquí: solo demo de UI, no existen en el backend ---
  {
    id_venta: 2,
    sucursal_id: 1,
    cajero_id: 6, // Maria Gaviria (demo)
    estado: "pendiente",
    metodo_pago_id: null,
    total: 4500,
    observacion: null,
    created_at: "2026-07-01T09:40:00",
    detalles: [{ producto_id: 7, nombre: "Café americano", cantidad: 1, precio_unitario_venta: 4500 }],
  },
  {
    id_venta: 3,
    sucursal_id: 1,
    cajero_id: 6, // Maria Gaviria (demo)
    estado: "en_preparacion",
    metodo_pago_id: null,
    total: 7000,
    observacion: null,
    created_at: "2026-07-01T10:05:00",
    detalles: [
      { producto_id: 2, nombre: "Agua 600ml", cantidad: 2, precio_unitario_venta: 2500 },
      { producto_id: 4, nombre: "Chocolatina", cantidad: 1, precio_unitario_venta: 2000 },
    ],
  },
  {
    id_venta: 4,
    sucursal_id: 1,
    cajero_id: 7, // Sofia Montoya (demo)
    estado: "cancelado",
    metodo_pago_id: 1,
    total: 4000,
    observacion: "Cliente se arrepintió",
    created_at: "2026-06-30T16:20:00",
    detalles: [{ producto_id: 3, nombre: "Papas fritas 45g", cantidad: 1, precio_unitario_venta: 4000 }],
  },
];

// Coincide con FacturaService::generarParaVenta() — numeración
// correlativa 'SUCxx-000001' por sucursal.
export const facturas = [
  {
    id_factura: 1,
    venta_id: 1,
    sucursal_id: 1,
    numero_factura: "SUC01-000001",
    cajero_id: 3, // Cajero Centro (real)
    total: 22000,
    pdf_ruta: null, // el backend aún no expone un endpoint de descarga (ver nota en FacturasView)
    created_at: "2026-06-20T10:16:00",
  },
];

// Demo de UI — replican los eventos que InventarioService/VentaController
// generarían automáticamente a partir de los datos ya sembrados
// (Papas fritas con stock bajo, la cancelación de la venta #4, etc.)
// No existen literalmente en el backend porque nunca se corrió ese flujo
// completo contra una base de datos real.
export const notificaciones = [
  {
    id_notificacion: 1,
    sucursal_id: 1,
    usuario_id: null, // null = para todos los admin_sucursal de esa sucursal
    tipo: "stock_bajo",
    mensaje: 'El producto "Papas fritas 45g" tiene stock bajo (5 unidades, mínimo 10).',
    leida: false,
    referencia_id: 3,
    referencia_tipo: "producto",
    created_at: "2026-07-01T08:30:00",
  },
  {
    id_notificacion: 2,
    sucursal_id: 1,
    usuario_id: null,
    tipo: "venta_cancelada",
    mensaje: "La venta #4 fue cancelada. Motivo: Cliente se arrepintió.",
    leida: true,
    referencia_id: 4,
    referencia_tipo: "venta",
    created_at: "2026-06-30T16:21:00",
  },
];

export const auditoriaLogs = [
  {
    id_auditoria: 1,
    usuario_id: 3, // Cajero Centro (real)
    sucursal_id: 1,
    accion: "crear_venta",
    tabla_afectada: "ventas",
    registro_id: 1,
    datos_anteriores: null,
    datos_nuevos: { estado: "pendiente", total: 0 },
    ip_address: "192.168.1.20",
    created_at: "2026-06-20T10:15:00",
  },
  {
    id_auditoria: 2,
    usuario_id: 3, // Cajero Centro (real)
    sucursal_id: 1,
    accion: "cambiar_estado_venta",
    tabla_afectada: "ventas",
    registro_id: 1,
    datos_anteriores: { estado: "pendiente" },
    datos_nuevos: { estado: "pagado", motivo: null },
    ip_address: "192.168.1.20",
    created_at: "2026-06-20T10:16:00",
  },
  {
    id_auditoria: 3,
    usuario_id: 7, // Sofia Montoya (demo)
    sucursal_id: 1,
    accion: "cambiar_estado_venta",
    tabla_afectada: "ventas",
    registro_id: 4,
    datos_anteriores: { estado: "pagado" },
    datos_nuevos: { estado: "cancelado", motivo: "Cliente se arrepintió" },
    ip_address: "192.168.1.21",
    created_at: "2026-06-30T16:20:00",
  },
  {
    id_auditoria: 4,
    usuario_id: 5, // Laura Pérez (demo)
    sucursal_id: 1,
    accion: "ajustar_inventario",
    tabla_afectada: "inventario",
    registro_id: 3,
    datos_anteriores: { cantidad: 20 },
    datos_nuevos: { cantidad: 5, observacion: "Conteo físico semanal" },
    ip_address: "192.168.1.15",
    created_at: "2026-06-29T18:00:00",
  },
];

export function nombreMetodoPago(id_metodo_pago) {
  return metodosPago.find((m) => m.id_metodo_pago === id_metodo_pago)?.nombre ?? "—";
}

export function ventaDe(id_venta) {
  return ventas.find((v) => v.id_venta === id_venta) ?? null;
}

export function nombreCategoria(id_categoria) {
  return categorias.find((c) => c.id_categoria === id_categoria)?.nombre ?? "Sin categoría";
}

export function categoriasDeSucursal(sucursal_id) {
  return categorias.filter((c) => c.sucursal_id === sucursal_id);
}

export function stockDe(producto_id) {
  return inventario.find((i) => i.producto_id === producto_id)?.cantidad ?? null;
}

export function nombreRol(rol_id) {
  return roles.find((r) => r.id_rol === rol_id)?.nombre ?? "—";
}

export function nombreSucursal(sucursal_id) {
  if (sucursal_id === null) return null;
  return sucursales.find((s) => s.id_sucursal === sucursal_id)?.nombre ?? "—";
}

// Resuelve la forma "denormalizada" que usa AuthContext para el actor
// logueado (nombres en vez de ids, conveniente para mostrar en la Sidebar).
export function resolverActor(id_usuario) {
  const u = usuarios.find((x) => x.id_usuario === id_usuario);
  if (!u) return null;
  return {
    id_usuario: u.id_usuario,
    nombre: u.nombre,
    rol: nombreRol(u.rol_id),
    sucursal: nombreSucursal(u.sucursal_id),
  };
}