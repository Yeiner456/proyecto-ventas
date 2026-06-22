<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltraPorSucursal;
use App\Http\Controllers\Controller;
use App\Models\DetalleVenta;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Los detalles de venta se crean junto con la Venta (ver VentaController::store)
 * y no se editan ni eliminan sueltos, para no romper la trazabilidad de
 * inventario y totales. Aquí solo se consultan.
 */
class DetalleVentaController extends Controller
{
    use FiltraPorSucursal;

    public function index(Request $request): JsonResponse
    {
        $query = DetalleVenta::query()->with(['venta', 'producto']);

        if (!$this->esAdminGeneral()) {
            $query->whereHas('venta', function ($q) {
                $q->where('sucursal_id', $this->sucursalIdActual());
            });
        }

        if ($request->filled('venta_id')) {
            $query->where('venta_id', $request->integer('venta_id'));
        }

        if ($request->filled('producto_id')) {
            $query->where('producto_id', $request->integer('producto_id'));
        }

        $detalles = $query->paginate($request->integer('per_page', 20));

        return response()->json($detalles);
    }

    public function show(DetalleVenta $detalleVenta): JsonResponse
    {
        $this->autorizarAccesoSucursal($detalleVenta->venta->sucursal_id);

        return response()->json($detalleVenta->load(['venta', 'producto']));
    }

    protected function autorizarAccesoSucursal(int $sucursalIdRecurso): void
    {
        if ($this->esAdminGeneral()) {
            return;
        }

        abort_if($sucursalIdRecurso !== $this->sucursalIdActual(), 403, 'No tienes acceso a recursos de otra sucursal.');
    }
}
