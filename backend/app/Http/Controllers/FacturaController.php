<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltraPorSucursal;
use App\Http\Controllers\Controller;
use App\Models\Factura;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Las facturas se generan automáticamente al marcar una venta como
 * 'pagado' (ver VentaController::cambiarEstado -> FacturaService).
 * Aquí solo se consultan; no hay store ni destroy vía API.
 */
class FacturaController extends Controller
{
    use FiltraPorSucursal;

    public function index(Request $request): JsonResponse
    {
        $query = Factura::query()->with(['venta', 'sucursal', 'cajero']);

        $this->aplicarFiltroSucursal($query);

        if ($request->filled('desde')) {
            $query->whereDate('created_at', '>=', $request->date('desde'));
        }

        if ($request->filled('hasta')) {
            $query->whereDate('created_at', '<=', $request->date('hasta'));
        }

        $facturas = $query->latest('created_at')->paginate($request->integer('per_page', 15));

        return response()->json($facturas);
    }

    public function show(Factura $factura): JsonResponse
    {
        $this->autorizarAccesoSucursal($factura->sucursal_id);

        return response()->json($factura->load(['venta.detalles.producto', 'sucursal', 'cajero']));
    }

    protected function autorizarAccesoSucursal(int $sucursalIdRecurso): void
    {
        if ($this->esAdminGeneral()) {
            return;
        }

        abort_if($sucursalIdRecurso !== $this->sucursalIdActual(), 403, 'No tienes acceso a recursos de otra sucursal.');
    }
}
