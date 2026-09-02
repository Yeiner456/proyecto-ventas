<?php

use App\Http\Controllers\BackupController;
use App\Http\Controllers\AuditoriaLogController;
use App\Http\Controllers\AuthController;
use App\Http\Controllers\CategoriaProductoController;
use App\Http\Controllers\ComprobantePagoController;
use App\Http\Controllers\DetalleVentaController;
use App\Http\Controllers\FacturaController;
use App\Http\Controllers\InventarioController;
use App\Http\Controllers\MetodoPagoController;
use App\Http\Controllers\MovimientoInventarioController;
use App\Http\Controllers\NotificacionController;
use App\Http\Controllers\ProductoController;
use App\Http\Controllers\RolController;
use App\Http\Controllers\SucursalController;
use App\Http\Controllers\UsuarioController;
use App\Http\Controllers\VentaController;
use Illuminate\Support\Facades\Route;

// --- Pública: login (con límite de intentos para evitar fuerza bruta) ---
Route::middleware('throttle:6,1')->post('login', [AuthController::class, 'login']);

// --- Pública: servir el archivo de un comprobante (ver comentario en
// ComprobantePagoController::mostrarArchivo) — un <img src=""> no puede
// mandar el header Authorization, así que esta ruta queda fuera del
// grupo auth:sanctum a propósito. ---
Route::get('comprobantes-pago/{comprobante}/archivo', [ComprobantePagoController::class, 'mostrarArchivo']);

// --- Pública: servir la imagen de un producto (ver comentario en
// ProductoController::mostrarImagen) — el POS del cajero pinta esta URL
// en un <img src=""> plano, así que tampoco puede llevar Authorization. ---
Route::get('productos/{producto}/imagen', [ProductoController::class, 'mostrarImagen']);

// --- Protegidas: requieren token válido ---
Route::middleware('auth:sanctum')->group(function () {

    // Auth: logout y datos del usuario autenticado
    Route::post('logout', [AuthController::class, 'logout']);
    Route::post('logout-all', [AuthController::class, 'logoutAll']);
    Route::get('me', [AuthController::class, 'me']);

    // Catálogos globales (no multi-tenant)
    Route::apiResource('roles', RolController::class)
    ->parameter('roles', 'rol');
    Route::apiResource('sucursales', SucursalController::class)
    ->parameter('sucursales', 'sucursal');
    // Mismo problema que categorias-productos: 'metodos-pago' termina en
    // 'o', así que Laravel ni siquiera intenta singularizarlo (su regla
    // genérica solo quita una 's' final) y el wildcard queda 'metodos_pago',
    // mientras que MetodoPagoController espera 'metodo_pago'.
    Route::apiResource('metodos-pago', MetodoPagoController::class)
        ->parameter('metodos-pago', 'metodo_pago');

    // Multi-tenant por sucursal
    Route::apiResource('usuarios', UsuarioController::class);
    // OJO: forzamos el nombre del parámetro a 'categoria_producto'. Por
    // defecto Laravel singulariza 'categorias-productos' quitando solo la
    // 's' final de toda la cadena -> 'categorias_producto' (deja "categorias"
    // en plural), que no coincide con el 'categoria_producto' que usa
    // CategoriaProductoController::authorizeResource() ni con el
    // $categoriaProducto de sus métodos show/update/destroy. Ese desajuste
    // hacía que el middleware 'can:...' de authorizeResource() no encontrara
    // el modelo en la ruta y negara el permiso por defecto (así se veía como
    // "sin permisos" al eliminar, aunque el Policy en sí era correcto).
    Route::apiResource('categorias-productos', CategoriaProductoController::class)
        ->parameter('categorias-productos', 'categoria_producto');
    Route::apiResource('productos', ProductoController::class);

    // Inventario: sin store/destroy (nace y muere con el Producto)
    Route::apiResource('inventario', InventarioController::class)->only(['index', 'show']);
    Route::patch('inventario/{inventario}/ajustar', [InventarioController::class, 'ajustar']);

    // Historial de movimientos: solo lectura
    Route::apiResource('movimientos-inventario', MovimientoInventarioController::class)->only(['index', 'show']);

    // Ventas: CRUD + cambio de estado dedicado
    Route::apiResource('ventas', VentaController::class);
    Route::patch('ventas/{venta}/estado', [VentaController::class, 'cambiarEstado']);

    // Detalles de venta: solo lectura (se crean junto con la Venta)
    Route::apiResource('detalle-ventas', DetalleVentaController::class)->only(['index', 'show']);

    // Comprobantes de pago: sin update (se borra y se sube de nuevo).
    // Mismo problema: 'comprobantes-pago' termina en 'o', Laravel no lo
    // singulariza y el wildcard queda 'comprobantes_pago', mientras que
    // ComprobantePagoController espera 'comprobante_pago' (rompía el show
    // y el destroy de un comprobante puntual).
    Route::apiResource('comprobantes-pago', ComprobantePagoController::class)
        ->only(['index', 'store', 'show', 'destroy'])
        ->parameter('comprobantes-pago', 'comprobante_pago');

    // Facturas: solo lectura (se generan automáticamente al pagar)
    Route::apiResource('facturas', FacturaController::class)->only(['index', 'show']);

    // Notificaciones: sin store manual
    Route::apiResource('notificaciones', NotificacionController::class)->only(['index', 'show', 'destroy']);
    Route::patch('notificaciones/{notificacion}/leida', [NotificacionController::class, 'marcarLeida']);

    // Auditoría: solo lectura
    Route::apiResource('auditoria-logs', AuditoriaLogController::class)->only(['index', 'show']);

    // Backups de base de datos: solo admin_general (Gate 'gestionar-backups')
    Route::prefix('backups')->group(function () {
        Route::get('/', [BackupController::class, 'index']);
        Route::post('/', [BackupController::class, 'store']);
        Route::post('/restaurar', [BackupController::class, 'restaurar']);
        Route::get('/{filename}/descargar', [BackupController::class, 'download']);
    });
});