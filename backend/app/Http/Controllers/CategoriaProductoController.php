<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltraPorSucursal;
use App\Http\Requests\StoreCategoriaProductoRequest;
use App\Http\Requests\UpdateCategoriaProductoRequest;
use App\Models\CategoriaProducto;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CategoriaProductoController extends Controller
{
    // FiltraPorSucursal se mantiene solo para aplicarFiltroSucursal()
    // (scoping del listado) y resolverSucursalId() (al crear). La
    // autorización de un recurso puntual la resuelve CategoriaProductoPolicy.
    use FiltraPorSucursal;

    public function __construct()
    {
        $this->authorizeResource(CategoriaProducto::class, 'categoria_producto');
    }

    public function index(Request $request): JsonResponse
    {
        $query = CategoriaProducto::query()->with('sucursal');

        $this->aplicarFiltroSucursal($query);

        $categorias = $query->orderBy('nombre')->paginate($request->integer('per_page', 15));

        return response()->json($categorias);
    }

    public function store(StoreCategoriaProductoRequest $request): JsonResponse
    {
        // Autorización de 'create' ya resuelta por authorizeResource().
        $datos = $request->validated();
        $datos['sucursal_id'] = $this->resolverSucursalId($datos['sucursal_id'] ?? null);

        $categoriaProducto = CategoriaProducto::create($datos);

        return response()->json($categoriaProducto->load('sucursal'), 201);
    }

    public function show(CategoriaProducto $categoriaProducto): JsonResponse
    {
        // Autorización de 'view' ya resuelta por authorizeResource().
        return response()->json($categoriaProducto->load('sucursal'));
    }

    public function update(UpdateCategoriaProductoRequest $request, CategoriaProducto $categoriaProducto): JsonResponse
    {
        // Autorización de 'update' ya resuelta por authorizeResource().
        $categoriaProducto->update($request->validated());

        return response()->json($categoriaProducto->load('sucursal'));
    }

    public function destroy(CategoriaProducto $categoriaProducto): JsonResponse
    {
        // Autorización de 'delete' ya resuelta por authorizeResource().
        if ($categoriaProducto->productos()->exists()) {
            return response()->json([
                'message' => 'No se puede eliminar la categoría porque tiene productos asociados.',
            ], 409);
        }

        $categoriaProducto->delete();

        return response()->json(null, 204);
    }
}
