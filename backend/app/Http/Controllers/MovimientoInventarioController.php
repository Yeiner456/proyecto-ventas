<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltraPorSucursal;
use App\Models\MovimientoInventario;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Historial de movimientos de inventario. Es de solo LECTURA: los
 * movimientos siempre se generan desde InventarioService, nunca se
 * crean ni editan a mano vía API.
 */
class MovimientoInventarioController extends Controller
{
    // FiltraPorSucursal se mantiene solo para esAdminGeneral() y
    // sucursalIdActual() (usados en el filtro manual de index, ya que
    // MovimientoInventario no tiene sucursal_id propio). La
    // autorización puntual la resuelve MovimientoInventarioPolicy.
    use FiltraPorSucursal;

    public function __construct()
    {
        // Solo expone index/show en las rutas; authorizeResource no se
        // dispara para los métodos que no existen.
        $this->authorizeResource(MovimientoInventario::class, 'movimiento_inventario');
    }

    public function index(Request $request): JsonResponse
    {
        $query = MovimientoInventario::query()->with(['producto', 'usuario', 'venta']);

        if (!$this->esAdminGeneral()) {
            $query->whereHas('producto', function ($q) {
                $q->where('sucursal_id', $this->sucursalIdActual());
            });
        }

        if ($request->filled('producto_id')) {
            $query->where('producto_id', $request->integer('producto_id'));
        }

        if ($request->filled('tipo')) {
            $query->where('tipo', $request->string('tipo')->toString());
        }

        if ($request->filled('desde')) {
            $query->whereDate('created_at', '>=', $request->date('desde'));
        }

        if ($request->filled('hasta')) {
            $query->whereDate('created_at', '<=', $request->date('hasta'));
        }

        $movimientos = $query->latest('created_at')->paginate($request->integer('per_page', 20));

        return response()->json($movimientos);
    }

    public function show(MovimientoInventario $movimientoInventario): JsonResponse
    {
        // Autorización de 'view' ya resuelta por authorizeResource().
        return response()->json($movimientoInventario->load(['producto', 'usuario', 'venta']));
    }
}
