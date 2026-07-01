<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltraPorSucursal;
use App\Http\Requests\StoreProductoRequest;
use App\Http\Requests\UpdateProductoRequest;
use App\Models\Inventario;
use App\Models\Producto;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ProductoController extends Controller
{
    use FiltraPorSucursal; // solo para aplicarFiltroSucursal() y resolverSucursalId()

    public function __construct()
    {
        $this->authorizeResource(Producto::class, 'producto');
    }

    public function index(Request $request): JsonResponse
    {
        $query = Producto::query()->with(['sucursal', 'categoria', 'inventario']);

        $this->aplicarFiltroSucursal($query);

        if ($request->filled('categoria_id')) {
            $query->where('categoria_id', $request->integer('categoria_id'));
        }

        if ($request->boolean('solo_activos')) {
            $query->where('activo', true);
        }

        if ($request->filled('buscar')) {
            $query->where('nombre', 'like', '%' . $request->string('buscar')->toString() . '%');
        }

        $productos = $query->orderBy('nombre')->paginate($request->integer('per_page', 15));

        return response()->json($productos);
    }

    public function store(StoreProductoRequest $request): JsonResponse
    {
        // Autorización de 'create' ya resuelta por authorizeResource().
        $datos = $request->validated();
        $datos['sucursal_id'] = $this->resolverSucursalId($datos['sucursal_id'] ?? null);
        $stockInicial = $datos['stock_inicial'] ?? 0;
        unset($datos['stock_inicial']);

        $producto = DB::transaction(function () use ($datos, $stockInicial) {
            $producto = Producto::create($datos);

            if ($producto->maneja_stock) {
                Inventario::create([
                    'producto_id' => $producto->id_producto,
                    'cantidad'    => $stockInicial,
                ]);
            }

            return $producto;
        });

        return response()->json($producto->load(['sucursal', 'categoria', 'inventario']), 201);
    }

    public function show(Producto $producto): JsonResponse
    {
        // Autorización de 'view' ya resuelta por authorizeResource().
        return response()->json($producto->load(['sucursal', 'categoria', 'inventario']));
    }

    public function update(UpdateProductoRequest $request, Producto $producto): JsonResponse
    {
        // Autorización de 'update' ya resuelta por authorizeResource().
        $datos = $request->validated();
        $habilitandoStock = ($datos['maneja_stock'] ?? null) === true && !$producto->maneja_stock;

        DB::transaction(function () use ($producto, $datos, $habilitandoStock) {
            $producto->update($datos);

            if ($habilitandoStock && !$producto->inventario) {
                Inventario::create([
                    'producto_id' => $producto->id_producto,
                    'cantidad'    => 0,
                ]);
            }
        });

        return response()->json($producto->load(['sucursal', 'categoria', 'inventario']));
    }

    public function destroy(Producto $producto): JsonResponse
    {
        // Autorización de 'delete' ya resuelta por authorizeResource().
        if ($producto->detalleVentas()->exists()) {
            return response()->json([
                'message' => 'No se puede eliminar el producto porque tiene ventas registradas. Desactívalo en su lugar.',
            ], 409);
        }

        $producto->delete();

        return response()->json(null, 204);
    }
}
