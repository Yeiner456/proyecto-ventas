<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltraPorSucursal;
use App\Http\Requests\AjustarInventarioRequest;
use App\Models\Inventario;
use App\Services\InventarioService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/**
 * El inventario NO se crea ni elimina directamente vía API: nace junto
 * con el Producto y muere junto con él. Aquí solo se consulta y se
 * ajusta, siempre dejando rastro en movimientos_inventario.
 */
class InventarioController extends Controller
{
    // FiltraPorSucursal se mantiene solo para esAdminGeneral() (usado
    // en el filtro manual de index, ya que Inventario no tiene
    // sucursal_id propio) y registrarAuditoria(). La autorización de
    // un recurso puntual la resuelve InventarioPolicy.
    use FiltraPorSucursal;

    public function __construct(protected InventarioService $inventarioService)
    {
        // 'inventario' solo expone index/show en las rutas; authorizeResource
        // simplemente no se dispara para los métodos que no existen (store/update/destroy).
        $this->authorizeResource(Inventario::class, 'inventario');
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
        // Autorización de 'view' ya resuelta por authorizeResource().
        return response()->json($inventario->load('producto.sucursal'));
    }

    /**
     * Ajuste manual de stock. Usa una ability propia ('ajustar') porque
     * no forma parte del CRUD estándar que cubre authorizeResource().
     */
    public function ajustar(AjustarInventarioRequest $request, Inventario $inventario): JsonResponse
    {
        $this->authorize('ajustar', $inventario);

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
}
