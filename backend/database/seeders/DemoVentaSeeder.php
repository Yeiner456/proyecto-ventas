<?php

namespace Database\Seeders;

use App\Models\DetalleVenta;
use App\Models\MetodoPago;
use App\Models\Producto;
use App\Models\Sucursal;
use App\Models\Usuario;
use App\Models\Venta;
use App\Services\FacturaService;
use App\Services\InventarioService;
use Illuminate\Database\Seeder;

/**
 * Crea UNA venta de ejemplo, ya pagada, pasando por el mismo camino que
 * seguiría en producción (vía los Services), para que quede con:
 *  - sus detalles
 *  - el inventario ya descontado
 *  - su movimiento de inventario tipo 'salida'
 *  - su factura generada con numeración correlativa
 *
 * Útil para ver datos reales en GET /facturas, /movimientos-inventario,
 * etc. sin tener que hacer el flujo completo a mano por Postman.
 */
class DemoVentaSeeder extends Seeder
{
    public function run(): void
    {
        $sucursal = Sucursal::where('nombre', 'Sucursal Centro')->first();
        $cajero   = Usuario::where('email', 'cajero@monito.com')->first();
        $efectivo = MetodoPago::where('nombre', 'Efectivo')->first();

        $gaseosa = Producto::where('sucursal_id', $sucursal->id_sucursal)
            ->where('nombre', 'Gaseosa 400ml')->first();
        $hamburguesa = Producto::where('sucursal_id', $sucursal->id_sucursal)
            ->where('nombre', 'Hamburguesa clásica')->first();

        if (!$sucursal || !$cajero || !$efectivo || !$gaseosa || !$hamburguesa) {
            $this->command?->warn('DemoVentaSeeder: faltan datos previos (¿corriste los demás seeders?). Se omite.');
            return;
        }

        // Evita duplicar la venta de ejemplo si el seeder se corre dos veces
        if (Venta::where('sucursal_id', $sucursal->id_sucursal)->where('observacion', 'Venta de ejemplo (seeder)')->exists()) {
            return;
        }

        $venta = Venta::create([
            'sucursal_id'    => $sucursal->id_sucursal,
            'cajero_id'      => $cajero->id_usuario,
            'estado'         => 'pendiente',
            'metodo_pago_id' => $efectivo->id_metodo_pago,
            'observacion'    => 'Venta de ejemplo (seeder)',
            'total'          => 0,
        ]);

        $lineas = [
            ['producto' => $gaseosa, 'cantidad' => 2],
            ['producto' => $hamburguesa, 'cantidad' => 1],
        ];

        $total = 0;

        foreach ($lineas as $linea) {
            DetalleVenta::create([
                'venta_id'              => $venta->id_venta,
                'producto_id'           => $linea['producto']->id_producto,
                'cantidad'              => $linea['cantidad'],
                'precio_base_snapshot'  => $linea['producto']->precio_base,
                'precio_unitario_venta' => $linea['producto']->precio_base,
                'ajuste_precio'         => false,
            ]);

            $total += $linea['cantidad'] * $linea['producto']->precio_base;
        }

        $venta->update(['total' => $total]);

        // Pasamos la venta a 'pagado' replicando lo que hace
        // VentaController::cambiarEstado(): descuenta inventario y factura.
        $inventarioService = app(InventarioService::class);
        $facturaService    = app(FacturaService::class);

        foreach ($venta->detalles as $detalle) {
            if ($detalle->producto->maneja_stock) {
                $inventarioService->descontar(
                    $detalle->producto,
                    $detalle->cantidad,
                    $cajero->id_usuario,
                    $venta->id_venta,
                    "Venta #{$venta->id_venta} (seeder)"
                );
            }
        }

        $venta->update(['estado' => 'pagado']);
        $facturaService->generarParaVenta($venta);
    }
}
