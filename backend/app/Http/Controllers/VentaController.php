<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltraPorSucursal;
use App\Http\Requests\CambiarEstadoVentaRequest;
use App\Http\Requests\StoreVentaRequest;
use App\Http\Requests\UpdateVentaRequest;
use App\Models\DetalleVenta;
use App\Models\Producto;
use App\Models\Venta;
use App\Services\FacturaService;
use App\Services\InventarioService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class VentaController extends Controller
{
    // FiltraPorSucursal se mantiene SOLO para lo que las Policies no hacen:
    // aplicarFiltroSucursal() (scoping de listados), resolverSucursalId(),
    // usuarioActual() y registrarAuditoria(). La autorización de acceso a
    // un recurso puntual ahora la resuelve VentaPolicy.
    use FiltraPorSucursal;

    public function __construct(
        protected InventarioService $inventarioService,
        protected FacturaService $facturaService
    ) {
        // Mapea automáticamente index->viewAny, show->view, store->create,
        // update->update, destroy->delete contra VentaPolicy, usando el
        // parámetro de ruta {venta}.
        $this->authorizeResource(Venta::class, 'venta');
    }

    public function index(Request $request): JsonResponse
    {
        $query = Venta::query()->with(['sucursal', 'cajero', 'metodoPago', 'detalles.producto']);

        $this->aplicarFiltroSucursal($query);

        if ($request->filled('estado')) {
            $query->where('estado', $request->string('estado')->toString());
        }

        if ($request->filled('cajero_id')) {
            $query->where('cajero_id', $request->integer('cajero_id'));
        }

        if ($request->filled('desde')) {
            $query->whereDate('created_at', '>=', $request->date('desde'));
        }

        if ($request->filled('hasta')) {
            $query->whereDate('created_at', '<=', $request->date('hasta'));
        }

        $ventas = $query->latest('created_at')->paginate($request->integer('per_page', 15));

        return response()->json($ventas);
    }

    /**
     * Crea una venta junto con sus detalles. NO descuenta stock todavía
     * (la venta nace en estado 'pendiente'): el stock se descuenta
     * cuando se confirma el pago, vía cambiarEstado().
     */
    public function store(StoreVentaRequest $request): JsonResponse
    {
        // Autorización de 'create' ya resuelta por authorizeResource().
        $datos = $request->validated();
        $sucursalId = $this->resolverSucursalId($datos['sucursal_id'] ?? null);

        if (!$sucursalId) {
            throw ValidationException::withMessages([
                'sucursal_id' => 'Debes especificar la sucursal de la venta.',
            ]);
        }

        $venta = DB::transaction(function () use ($datos, $sucursalId) {
            $venta = Venta::create([
                'sucursal_id'    => $sucursalId,
                'cajero_id'      => $datos['cajero_id'] ?? $this->usuarioActual()?->id_usuario,
                'estado'         => $datos['estado'] ?? 'pendiente',
                'metodo_pago_id' => $datos['metodo_pago_id'] ?? null,
                'observacion'    => $datos['observacion'] ?? null,
                'total'          => 0,
            ]);

            $total = 0;

            foreach ($datos['detalles'] as $linea) {
                $producto = Producto::findOrFail($linea['producto_id']);

                $precioVenta = $linea['precio_unitario_venta'] ?? $producto->precio_base;
                $hayAjuste = isset($linea['precio_unitario_venta'])
                    && (float) $linea['precio_unitario_venta'] !== (float) $producto->precio_base;

                DetalleVenta::create([
                    'venta_id'               => $venta->id_venta,
                    'producto_id'            => $producto->id_producto,
                    'cantidad'               => $linea['cantidad'],
                    'precio_base_snapshot'   => $producto->precio_base,
                    'precio_unitario_venta'  => $precioVenta,
                    'ajuste_precio'          => $hayAjuste,
                    'observacion_ajuste'     => $linea['observacion_ajuste'] ?? null,
                ]);

                $total += $linea['cantidad'] * $precioVenta;
            }

            $venta->update(['total' => $total]);

            return $venta;
        });

        $this->registrarAuditoria('crear_venta', 'ventas', $venta->id_venta, null, $venta->toArray());

        return response()->json($venta->load(['sucursal', 'cajero', 'metodoPago', 'detalles.producto']), 201);
    }

    public function show(Venta $venta): JsonResponse
    {
        // Autorización de 'view' ya resuelta por authorizeResource().
        return response()->json($venta->load([
            'sucursal', 'cajero', 'metodoPago', 'detalles.producto', 'comprobantes', 'factura',
        ]));
    }

    /**
     * Actualiza campos generales de la venta y, opcionalmente, reemplaza
     * por completo sus líneas de detalle (para añadir/quitar productos o
     * cambiar cantidades). El reemplazo de 'detalles' solo se permite
     * mientras la venta está 'pendiente': una vez pagada ya se descontó
     * inventario y se generó factura sobre esas líneas, así que tocarlas
     * después rompería esa trazabilidad (para eso existe cancelar/crear
     * una venta nueva).
     */
    public function update(UpdateVentaRequest $request, Venta $venta): JsonResponse
    {
        // Autorización de 'update' ya resuelta por authorizeResource().
        if ($venta->estado === 'cancelado') {
            return response()->json(['message' => 'No se puede editar una venta cancelada.'], 409);
        }

        $datos = $request->validated();

        if (array_key_exists('detalles', $datos) && $venta->estado !== 'pendiente') {
            return response()->json([
                'message' => 'Solo se pueden editar los productos de una venta pendiente.',
            ], 409);
        }

        $detallesAnteriores = $venta->detalles->toArray();

        $venta = DB::transaction(function () use ($venta, $datos) {
            $venta->update(collect($datos)->except('detalles')->toArray());

            if (array_key_exists('detalles', $datos)) {
                // Reemplazo completo: se borran las líneas actuales y se
                // recrean desde cero (mismo criterio que store()). No hace
                // falta tocar inventario aquí: una venta pendiente todavía
                // no descontó stock (eso solo pasa al llegar a 'pagado').
                $venta->detalles()->delete();

                $total = 0;

                foreach ($datos['detalles'] as $linea) {
                    $producto = Producto::findOrFail($linea['producto_id']);

                    $precioVenta = $linea['precio_unitario_venta'] ?? $producto->precio_base;
                    $hayAjuste = isset($linea['precio_unitario_venta'])
                        && (float) $linea['precio_unitario_venta'] !== (float) $producto->precio_base;

                    DetalleVenta::create([
                        'venta_id'               => $venta->id_venta,
                        'producto_id'            => $producto->id_producto,
                        'cantidad'               => $linea['cantidad'],
                        'precio_base_snapshot'   => $producto->precio_base,
                        'precio_unitario_venta'  => $precioVenta,
                        'ajuste_precio'          => $hayAjuste,
                        'observacion_ajuste'     => $linea['observacion_ajuste'] ?? null,
                    ]);

                    $total += $linea['cantidad'] * $precioVenta;
                }

                $venta->update(['total' => $total]);
            }

            return $venta;
        });

        if (array_key_exists('detalles', $datos)) {
            $this->registrarAuditoria(
                'editar_detalles_venta',
                'ventas',
                $venta->id_venta,
                ['detalles' => $detallesAnteriores],
                ['detalles' => $datos['detalles'], 'total' => $venta->total]
            );
        }

        return response()->json($venta->load(['sucursal', 'cajero', 'metodoPago', 'detalles.producto']));
    }

    /**
     * Cambia el estado de la venta. Usa una ability propia
     * ('cambiarEstado') porque no forma parte del CRUD estándar que
     * cubre authorizeResource().
     */
    public function cambiarEstado(CambiarEstadoVentaRequest $request, Venta $venta): JsonResponse
    {
        $this->authorize('cambiarEstado', $venta);

        $estadoAnterior = $venta->estado;
        $estadoNuevo = $request->string('estado')->toString();

        if ($estadoAnterior === 'cancelado') {
            return response()->json(['message' => 'La venta ya está cancelada.'], 409);
        }

        if ($estadoAnterior === $estadoNuevo) {
            return response()->json(['message' => 'La venta ya se encuentra en ese estado.'], 409);
        }

        try {
            DB::transaction(function () use ($venta, $estadoAnterior, $estadoNuevo, $request) {
                if ($estadoNuevo === 'pagado' && $estadoAnterior !== 'pagado') {
                    foreach ($venta->detalles as $detalle) {
                        if ($detalle->producto->maneja_stock) {
                            $this->inventarioService->descontar(
                                $detalle->producto,
                                $detalle->cantidad,
                                $this->usuarioActual()?->id_usuario,
                                $venta->id_venta,
                                "Venta #{$venta->id_venta}"
                            );
                        }
                    }

                    $this->facturaService->generarParaVenta($venta);
                }

                if ($estadoNuevo === 'cancelado' && in_array($estadoAnterior, ['pagado', 'entregado'], true)) {
                    foreach ($venta->detalles as $detalle) {
                        if ($detalle->producto->maneja_stock) {
                            $this->inventarioService->devolver(
                                $detalle->producto,
                                $detalle->cantidad,
                                $this->usuarioActual()?->id_usuario,
                                $venta->id_venta,
                                "Cancelación venta #{$venta->id_venta}: " . ($request->input('motivo') ?: 'sin motivo especificado')
                            );
                        }
                    }
                }

                $venta->update(['estado' => $estadoNuevo]);
            });
        } catch (ValidationException $e) {
            return response()->json(['message' => $e->getMessage(), 'errors' => $e->errors()], 422);
        }

        $this->registrarAuditoria(
            'cambiar_estado_venta',
            'ventas',
            $venta->id_venta,
            ['estado' => $estadoAnterior],
            ['estado' => $estadoNuevo, 'motivo' => $request->input('motivo')]
        );

        return response()->json($venta->refresh()->load(['sucursal', 'cajero', 'metodoPago', 'detalles.producto', 'factura']));
    }

    public function destroy(Venta $venta): JsonResponse
    {
        // Autorización de 'delete' ya resuelta por authorizeResource().
        if (!in_array($venta->estado, ['pendiente', 'cancelado'], true)) {
            return response()->json([
                'message' => 'Solo se pueden eliminar ventas pendientes o canceladas. Cancela la venta primero.',
            ], 409);
        }

        $venta->delete();

        $this->registrarAuditoria('eliminar_venta', 'ventas', $venta->id_venta);

        return response()->json(null, 204);
    }
}