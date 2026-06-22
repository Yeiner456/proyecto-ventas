<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltraPorSucursal;
use App\Http\Controllers\Controller;
use App\Http\Requests\AjustarInventarioRequest;
use App\Models\Inventario;
use App\Services\InventarioService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * El inventario NO se crea ni elimina directamente vía API: nace junto
 * con el Producto (ver ProductoController) y muere junto con él.
 * Aquí solo se consulta y se ajusta (entradas/salidas manuales),
 * siempre dejando rastro en movimientos_inventario.
 */
class InventarioController extends Controller
{
    use FiltraPorSucursal;

    public function __construct(protected InventarioService $inventarioService)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $query = Inventario::query()->with('producto.sucursal');

        if (!$this->esAdminGeneral()) {
            $query->whereHas('producto', function ($q) {
                $q->where('sucursal_id', $this->sucursalIdActual());
            });
        }

        if ($request->boolean('solo_bajo_minimo')) {
            $query->whereHas('producto', function ($q) {
                $q->whereColumn('inventario.cantidad', '<=', 'productos.stock_minimo');
            });
        }

        $inventarios = $query->paginate($request->integer('per_page', 15));

        return response()->json($inventarios);
    }

    public function show(Inventario $inventario): JsonResponse
    {
        $this->autorizarAccesoSucursal($inventario->producto->sucursal_id);

        return response()->json($inventario->load('producto.sucursal'));
    }

    /**
     * Ajuste manual de stock (ej: conteo físico, merma, corrección de error).
     * Usa una ruta dedicada en vez de "update" plano porque toda
     * modificación de cantidad debe pasar por InventarioService para
     * que quede registrado el movimiento.
     */
    public function ajustar(AjustarInventarioRequest $request, Inventario $inventario): JsonResponse
    {
        $this->autorizarAccesoSucursal($inventario->producto->sucursal_id);

        try {
            $movimiento = $this->inventarioService->ajustar(
                $inventario->producto,
                $request->integer('cantidad'),
                $this->usuarioActual()?->id_usuario,
                $request->string('observacion')->toString()
            );
        } catch (ValidationException $e) {
            return response()->json(['message' => $e->getMessage(), 'errors' => $e->errors()], 422);
        }

        $this->registrarAuditoria('ajustar_inventario', 'inventario', $inventario->id_inventario, null, $movimiento->toArray());

        return response()->json([
            'inventario' => $inventario->refresh()->load('producto'),
            'movimiento' => $movimiento,
        ]);
    }

    protected function autorizarAccesoSucursal(int $sucursalIdRecurso): void
    {
        if ($this->esAdminGeneral()) {
            return;
        }

        abort_if($sucursalIdRecurso !== $this->sucursalIdActual(), 403, 'No tienes acceso a recursos de otra sucursal.');
    }
}
