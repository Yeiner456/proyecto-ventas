<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreMetodoPagoRequest;
use App\Http\Requests\UpdateMetodoPagoRequest;
use App\Models\MetodoPago;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Catálogo global de métodos de pago (efectivo, tarjeta, transferencia...).
 * No es multi-tenant. Autorización vía MetodoPagoPolicy: solo
 * admin_general crea/edita/elimina; el resto solo lee (lo necesitan
 * para cobrar una venta).
 */
class MetodoPagoController extends Controller
{
    public function __construct()
    {
        $this->authorizeResource(MetodoPago::class, 'metodo_pago');
    }

    public function index(Request $request): JsonResponse
    {
        $query = MetodoPago::query();

        if ($request->boolean('solo_activos')) {
            $query->where('activo', true);
        }

        $metodos = $query->orderBy('nombre')->get();

        return response()->json($metodos);
    }

    public function store(StoreMetodoPagoRequest $request): JsonResponse
    {
        $datos = $request->validated();

        // Si este método se marca como default, desmarcamos los demás
        if ($datos['es_default'] ?? false) {
            MetodoPago::where('es_default', true)->update(['es_default' => false]);
        }

        $metodo = MetodoPago::create($datos);

        return response()->json($metodo, 201);
    }

    public function show(MetodoPago $metodoPago): JsonResponse
    {
        return response()->json($metodoPago);
    }

    public function update(UpdateMetodoPagoRequest $request, MetodoPago $metodoPago): JsonResponse
    {
        $datos = $request->validated();

        if ($datos['es_default'] ?? false) {
            MetodoPago::where('id_metodo_pago', '!=', $metodoPago->id_metodo_pago)->update(['es_default' => false]);
        }

        $metodoPago->update($datos);

        return response()->json($metodoPago);
    }

    public function destroy(MetodoPago $metodoPago): JsonResponse
    {
        if ($metodoPago->ventas()->exists()) {
            return response()->json([
                'message' => 'No se puede eliminar el método de pago porque tiene ventas asociadas. Desactívalo en su lugar.',
            ], 409);
        }

        $metodoPago->delete();

        return response()->json(null, 204);
    }
}
