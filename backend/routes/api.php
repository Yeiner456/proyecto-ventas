<?php

use App\Http\Controllers\AuditoriaLogController;
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

/*
|--------------------------------------------------------------------------
| API Routes
|--------------------------------------------------------------------------
|
| Mientras conectas Sanctum, estas rutas funcionan sin auth (auth()->user()
| devuelve null y los controladores no filtran por sucursal). En cuanto
| agregues el middleware 'auth:sanctum' aquí abajo, el filtro multi-tenant
| se activa solo, sin tocar ningún controlador.
|
*/

Route::middleware([/* 'auth:sanctum' */])->group(function () {

    // Catálogos globales (no multi-tenant)
    Route::apiResource('roles', RolController::class);
    Route::apiResource('sucursales', SucursalController::class);
    Route::apiResource('metodos-pago', MetodoPagoController::class);

    // Multi-tenant por sucursal
    Route::apiResource('usuarios', UsuarioController::class);
    Route::apiResource('categorias-productos', CategoriaProductoController::class);
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

    // Comprobantes de pago: sin update (se borra y se sube de nuevo)
    Route::apiResource('comprobantes-pago', ComprobantePagoController::class)->only(['index', 'store', 'show', 'destroy']);

    // Facturas: solo lectura (se generan automáticamente al pagar)
    Route::apiResource('facturas', FacturaController::class)->only(['index', 'show']);

    // Notificaciones: sin store manual
    Route::apiResource('notificaciones', NotificacionController::class)->only(['index', 'show', 'destroy']);
    Route::patch('notificaciones/{notificacion}/leida', [NotificacionController::class, 'marcarLeida']);

    // Auditoría: solo lectura
    Route::apiResource('auditoria-logs', AuditoriaLogController::class)->only(['index', 'show']);
});
