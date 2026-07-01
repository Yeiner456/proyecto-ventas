<?php

namespace App\Http\Controllers;

use App\Http\Requests\StoreSucursalRequest;
use App\Http\Requests\UpdateSucursalRequest;
use App\Models\Sucursal;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Gestión de sucursales. Autorización vía SucursalPolicy: solo
 * admin_general puede crear/editar/eliminar; el resto de roles solo
 * puede listar/ver (lo necesitan para selects, etc.).
 */
class SucursalController extends Controller
{
    public function __construct()
    {
        $this->authorizeResource(Sucursal::class, 'sucursal');
    }

    public function index(Request $request): JsonResponse
    {
        $query = Sucursal::query();

        if ($request->boolean('solo_activas')) {
            $query->where('activa', true);
        }

        $sucursales = $query->orderBy('nombre')->paginate($request->integer('per_page', 15));

        return response()->json($sucursales);
    }

    public function store(StoreSucursalRequest $request): JsonResponse
    {
        $sucursal = Sucursal::create($request->validated());

        return response()->json($sucursal, 201);
    }

    public function show(Sucursal $sucursal): JsonResponse
    {
        return response()->json($sucursal);
    }

    public function update(UpdateSucursalRequest $request, Sucursal $sucursal): JsonResponse
    {
        $sucursal->update($request->validated());

        return response()->json($sucursal);
    }

    public function destroy(Sucursal $sucursal): JsonResponse
    {
        if ($sucursal->usuarios()->exists() || $sucursal->productos()->exists() || $sucursal->ventas()->exists()) {
            return response()->json([
                'message' => 'No se puede eliminar la sucursal porque tiene datos asociados (usuarios, productos o ventas).',
            ], 409);
        }

        $sucursal->delete();

        return response()->json(null, 204);
    }
}
