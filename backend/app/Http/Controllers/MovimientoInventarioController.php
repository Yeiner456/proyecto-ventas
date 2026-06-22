<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltraPorSucursal;
use App\Http\Controllers\Controller;
use App\Models\MovimientoInventario;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Historial de movimientos de inventario. Es de solo LECTURA: los
 * movimientos siempre se generan desde InventarioService (al vender,
 * cancelar o ajustar stock), nunca se crean ni editan a mano vía API,
 * para que el historial sea confiable como bitácora de auditoría.
 */
class MovimientoInventarioController extends Controller
{
    use FiltraPorSucursal;

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
        $this->autorizarAccesoSucursal($movimientoInventario->producto->sucursal_id);

        return response()->json($movimientoInventario->load(['producto', 'usuario', 'venta']));
    }

    protected function autorizarAccesoSucursal(int $sucursalIdRecurso): void
    {
        if ($this->esAdminGeneral()) {
            return;
        }

        abort_if($sucursalIdRecurso !== $this->sucursalIdActual(), 403, 'No tienes acceso a recursos de otra sucursal.');
    }
}
