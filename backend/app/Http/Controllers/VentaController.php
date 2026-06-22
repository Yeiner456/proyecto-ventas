<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltraPorSucursal;
use App\Http\Controllers\Controller;
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
    use FiltraPorSucursal;

    public function __construct(
        protected InventarioService $inventarioService,
        protected FacturaService $facturaService
    ) {
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
     * cuando se confirma el pago, vía cambiarEstado(). Así, una venta
     * que se cancela antes de pagar nunca llegó a tocar el inventario.
     */
    public function store(StoreVentaRequest $request): JsonResponse
    {
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
                'total'          => 0, // se calcula abajo
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
        $this->autorizarAccesoSucursal($venta->sucursal_id);

        return response()->json($venta->load([
            'sucursal', 'cajero', 'metodoPago', 'detalles.producto', 'comprobantes', 'factura',
        ]));
    }

    /**
     * Actualiza datos generales (método de pago, observación). El estado
     * y los detalles NO se editan aquí: usa cambiarEstado() para el
     * estado, y no se permite editar detalles de una venta ya creada
     * (en su lugar, cancélala y crea una nueva) para mantener íntegro
     * el historial de inventario y auditoría.
     */
    public function update(UpdateVentaRequest $request, Venta $venta): JsonResponse
    {
        $this->autorizarAccesoSucursal($venta->sucursal_id);

        if ($venta->estado === 'cancelado') {
            return response()->json(['message' => 'No se puede editar una venta cancelada.'], 409);
        }

        $venta->update($request->validated());

        return response()->json($venta->load(['sucursal', 'cajero', 'metodoPago', 'detalles.producto']));
    }

    /**
     * Cambia el estado de la venta, disparando la lógica de negocio
     * correspondiente:
     *  - -> 'pagado': descuenta inventario de cada detalle y genera factura.
     *  - -> 'cancelado': si ya se había descontado stock (porque pasó por
     *    'pagado'), lo devuelve.
     */
    public function cambiarEstado(CambiarEstadoVentaRequest $request, Venta $venta): JsonResponse
    {
        $this->autorizarAccesoSucursal($venta->sucursal_id);

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
                // Pasar a 'pagado': descuenta stock por primera vez y factura
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

                // Cancelar una venta que ya había descontado stock: lo devuelve
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

    /**
     * Elimina una venta. Solo se permite si está en 'pendiente' o
     * 'cancelado' (nunca tocó o ya devolvió el inventario); de lo
     * contrario debe cancelarse primero para no perder la trazabilidad.
     */
    public function destroy(Venta $venta): JsonResponse
    {
        $this->autorizarAccesoSucursal($venta->sucursal_id);

        if (!in_array($venta->estado, ['pendiente', 'cancelado'], true)) {
            return response()->json([
                'message' => 'Solo se pueden eliminar ventas pendientes o canceladas. Cancela la venta primero.',
            ], 409);
        }

        $venta->delete();

        $this->registrarAuditoria('eliminar_venta', 'ventas', $venta->id_venta);

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
