<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreRolRequest;
use App\Http\Requests\UpdateRolRequest;
use App\Models\Rol;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Catálogo de roles del sistema (admin_general, admin_sucursal, cajero, contador).
 * No es multi-tenant: los roles son globales.
 */
class RolController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = Rol::query();

        if ($request->boolean('solo_activos')) {
            $query->where('activo', true);
        }

        $roles = $query->orderBy('nombre')->paginate($request->integer('per_page', 15));

        return response()->json($roles);
    }

    public function store(StoreRolRequest $request): JsonResponse
    {
        $rol = Rol::create($request->validated());

        return response()->json($rol, 201);
    }

    public function show(Rol $rol): JsonResponse
    {
        return response()->json($rol);
    }

    public function update(UpdateRolRequest $request, Rol $rol): JsonResponse
    {
        $rol->update($request->validated());

        return response()->json($rol);
    }

    public function destroy(Rol $rol): JsonResponse
    {
        if ($rol->usuarios()->exists()) {
            return response()->json([
                'message' => 'No se puede eliminar el rol porque tiene usuarios asignados.',
            ], 409);
        }

        $rol->delete();

        return response()->json(null, 204);
    }
}
