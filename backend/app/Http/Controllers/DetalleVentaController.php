<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltraPorSucursal;
use App\Models\DetalleVenta;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Los detalles de venta se crean junto con la Venta (ver
 * VentaController::store) y no se editan ni eliminan sueltos. Aquí
 * solo se consultan.
 */
class DetalleVentaController extends Controller
{
    // FiltraPorSucursal se mantiene solo para esAdminGeneral() y
    // sucursalIdActual() (usados en el filtro manual de index, ya que
    // DetalleVenta no tiene sucursal_id propio). La autorización
    // puntual la resuelve DetalleVentaPolicy.
    use FiltraPorSucursal;

    public function __construct()
    {
        // Solo expone index/show en las rutas.
        $this->authorizeResource(DetalleVenta::class, 'detalle_venta');
    }

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
        // Autorización de 'view' ya resuelta por authorizeResource().
        return response()->json($detalleVenta->load(['venta', 'producto']));
    }
}
