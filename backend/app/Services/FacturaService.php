<?php

namespace App\Services;

use App\Models\Factura;
use App\Models\Venta;
use Illuminate\Support\Facades\DB;

/**
 * Genera facturas a partir de una venta pagada, con numeración
 * correlativa por sucursal (ej: 'SUC01-000123').
 */
class FacturaService
{
    /**
     * Genera (o devuelve la existente) la factura de una venta.
     * Usa una transacción + lockForUpdate para evitar números
     * duplicados si dos ventas se facturan al mismo tiempo.
     */
    public function generarParaVenta(Venta $venta): Factura
    {
        if ($venta->factura) {
            return $venta->factura;
        }

        return DB::transaction(function () use ($venta) {
            $ultimoNumero = Factura::where('sucursal_id', $venta->sucursal_id)
                ->lockForUpdate()
                ->count();

            $siguiente = $ultimoNumero + 1;
            $numeroFactura = sprintf('SUC%02d-%06d', $venta->sucursal_id, $siguiente);

            return Factura::create([
                'venta_id'       => $venta->id_venta,
                'sucursal_id'    => $venta->sucursal_id,
                'numero_factura' => $numeroFactura,
                'cajero_id'      => $venta->cajero_id,
                'total'          => $venta->total,
            ]);
        });
    }
}
