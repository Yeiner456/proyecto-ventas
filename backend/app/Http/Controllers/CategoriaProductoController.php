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
    use FiltraPorSucursal;

    public function index(Request $request): JsonResponse
    {
        $query = CategoriaProducto::query()->with('sucursal');

        $this->aplicarFiltroSucursal($query);

        $categorias = $query->orderBy('nombre')->paginate($request->integer('per_page', 15));

        return response()->json($categorias);
    }

    public function store(StoreCategoriaProductoRequest $request): JsonResponse
    {
        $datos = $request->validated();
        $datos['sucursal_id'] = $this->resolverSucursalId($datos['sucursal_id'] ?? null);

        $categoriaProducto = CategoriaProducto::create($datos);

        return response()->json($categoriaProducto->load('sucursal'), 201);
    }

    public function show(CategoriaProducto $categoriaProducto): JsonResponse
    {
        $this->autorizarAccesoSucursal($categoriaProducto->sucursal_id);

        return response()->json($categoriaProducto->load('sucursal'));
    }

    public function update(UpdateCategoriaProductoRequest $request, CategoriaProducto $categoriaProducto): JsonResponse
    {
        $this->autorizarAccesoSucursal($categoriaProducto->sucursal_id);

        $categoriaProducto->update($request->validated());

        return response()->json($categoriaProducto->load('sucursal'));
    }

    public function destroy(CategoriaProducto $categoriaProducto): JsonResponse
    {
        $this->autorizarAccesoSucursal($categoriaProducto->sucursal_id);

        if ($categoriaProducto->productos()->exists()) {
            return response()->json([
                'message' => 'No se puede eliminar la categoría porque tiene productos asociados.',
            ], 409);
        }

        $categoriaProducto->delete();

        return response()->json(null, 204);
    }

    protected function autorizarAccesoSucursal(int $sucursalIdRecurso): void
    {
        if ($this->esAdminGeneral()) {
            return;
        }

        abort_if($sucursalIdRecurso !== $this->sucursalIdActual(), 403, 'No tienes acceso a recursos de otra sucursal.');
    }
}
