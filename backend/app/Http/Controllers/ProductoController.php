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
use Illuminate\Support\Facades\Storage;

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

        // 'imagen' es el archivo subido, no una columna de productos —
        // no se manda a Producto::create() directo. Si llega, se guarda
        // en disco y se reemplaza por su ruta en 'imagen_ruta'.
        unset($datos['imagen']);
        if ($request->hasFile('imagen')) {
            $datos['imagen_ruta'] = $request->file('imagen')->store('productos', 'public');
        }

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

        // Igual que en store(): 'imagen' es el archivo, no una columna.
        // Si llega uno nuevo, se borra el anterior (si había) y se guarda
        // el nuevo. Si no llega archivo pero sí 'eliminar_imagen', se
        // borra el actual y se deja el producto sin imagen.
        $eliminarImagen = $datos['eliminar_imagen'] ?? false;
        unset($datos['imagen'], $datos['eliminar_imagen']);

        if ($request->hasFile('imagen')) {
            if ($producto->imagen_ruta) {
                Storage::disk('public')->delete($producto->imagen_ruta);
            }
            $datos['imagen_ruta'] = $request->file('imagen')->store('productos', 'public');
        } elseif ($eliminarImagen && $producto->imagen_ruta) {
            Storage::disk('public')->delete($producto->imagen_ruta);
            $datos['imagen_ruta'] = null;
        }

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

        if ($producto->imagen_ruta) {
            Storage::disk('public')->delete($producto->imagen_ruta);
        }

        $producto->delete();

        return response()->json(null, 204);
    }

    /**
     * Sirve el archivo de imagen del producto directamente desde Laravel,
     * igual que ComprobantePagoController::mostrarArchivo — evita depender
     * de `php artisan storage:link`, que en Windows + `php artisan serve`
     * puede devolver 403 aunque el archivo exista.
     *
     * Ruta pública a propósito (fuera de auth:sanctum): un <img src="">
     * no puede mandar el header Authorization, así que si esta ruta
     * exigiera Bearer token la imagen nunca cargaría en el POS.
     */
    public function mostrarImagen(Producto $producto)
    {
        if (!$producto->imagen_ruta || !Storage::disk('public')->exists($producto->imagen_ruta)) {
            abort(404, 'Este producto no tiene imagen.');
        }

        return Storage::disk('public')->response($producto->imagen_ruta);
    }
}
