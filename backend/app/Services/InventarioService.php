<?php

namespace App\Services;

use App\Models\Inventario;
use App\Models\MovimientoInventario;
use App\Models\Notificacion;
use App\Models\Producto;
use Illuminate\Validation\ValidationException;

/**
 * Centraliza toda modificación de inventario para que SIEMPRE quede
 * registrado un MovimientoInventario y se generen notificaciones de
 * stock bajo cuando corresponda.
 *
 * Ningún controlador debe tocar la tabla `inventario` directamente:
 * todos pasan por aquí.
 */
class InventarioService
{
    /**
     * Descuenta stock (salida), normalmente por una venta.
     *
     * @throws ValidationException si no hay stock suficiente
     */
    public function descontar(Producto $producto, int $cantidad, ?int $usuarioId, ?int $ventaId, ?string $observacion = null): MovimientoInventario
    {
        if (!$producto->maneja_stock) {
            throw ValidationException::withMessages([
                'producto_id' => 'Este producto no maneja inventario.',
            ]);
        }

        $inventario = $producto->inventario;

        if (!$inventario) {
            // Si por algún motivo no existe el registro de inventario, lo creamos en 0
            $inventario = Inventario::create([
                'producto_id' => $producto->id_producto,
                'cantidad'    => 0,
            ]);
        }

        if ($inventario->cantidad < $cantidad) {
            throw ValidationException::withMessages([
                'cantidad' => "Stock insuficiente para \"{$producto->nombre}\". Disponible: {$inventario->cantidad}.",
            ]);
        }

        $stockAntes = $inventario->cantidad;
        $stockDespues = $stockAntes - $cantidad;

        $inventario->update(['cantidad' => $stockDespues]);

        $movimiento = MovimientoInventario::create([
            'producto_id'    => $producto->id_producto,
            'usuario_id'     => $usuarioId,
            'venta_id'       => $ventaId,
            'tipo'           => 'salida',
            'cantidad'       => -$cantidad,
            'stock_antes'    => $stockAntes,
            'stock_despues'  => $stockDespues,
            'observacion'    => $observacion,
        ]);

        $this->notificarSiStockBajo($producto, $stockDespues);

        return $movimiento;
    }

    /**
     * Regresa stock (entrada), normalmente por cancelación de una venta
     * que ya había descontado inventario.
     */
    public function devolver(Producto $producto, int $cantidad, ?int $usuarioId, ?int $ventaId, ?string $observacion = null): MovimientoInventario
    {
        $inventario = $producto->inventario;

        if (!$inventario) {
            $inventario = Inventario::create([
                'producto_id' => $producto->id_producto,
                'cantidad'    => 0,
            ]);
        }

        $stockAntes = $inventario->cantidad;
        $stockDespues = $stockAntes + $cantidad;

        $inventario->update(['cantidad' => $stockDespues]);

        return MovimientoInventario::create([
            'producto_id'    => $producto->id_producto,
            'usuario_id'     => $usuarioId,
            'venta_id'       => $ventaId,
            'tipo'           => 'entrada',
            'cantidad'       => $cantidad,
            'stock_antes'    => $stockAntes,
            'stock_despues'  => $stockDespues,
            'observacion'    => $observacion ?? 'Devolución por cancelación de venta',
        ]);
    }

    /**
     * Ajuste manual de inventario (ej: conteo físico, merma, corrección).
     * $cantidad puede ser positiva o negativa.
     */
    public function ajustar(Producto $producto, int $cantidad, ?int $usuarioId, ?string $observacion = null): MovimientoInventario
    {
        $inventario = $producto->inventario;

        if (!$inventario) {
            $inventario = Inventario::create([
                'producto_id' => $producto->id_producto,
                'cantidad'    => 0,
            ]);
        }

        $stockAntes = $inventario->cantidad;
        $stockDespues = $stockAntes + $cantidad;

        if ($stockDespues < 0) {
            throw ValidationException::withMessages([
                'cantidad' => 'El ajuste resultaría en stock negativo.',
            ]);
        }

        $inventario->update(['cantidad' => $stockDespues]);

        $movimiento = MovimientoInventario::create([
            'producto_id'    => $producto->id_producto,
            'usuario_id'     => $usuarioId,
            'venta_id'       => null,
            'tipo'           => 'ajuste',
            'cantidad'       => $cantidad,
            'stock_antes'    => $stockAntes,
            'stock_despues'  => $stockDespues,
            'observacion'    => $observacion,
        ]);

        $this->notificarSiStockBajo($producto, $stockDespues);

        return $movimiento;
    }

    /**
     * Crea una notificación tipo 'stock_bajo' si el stock actual cayó
     * por debajo (o igual) del stock_minimo configurado en el producto.
     */
    protected function notificarSiStockBajo(Producto $producto, int $stockActual): void
    {
        if ($stockActual > $producto->stock_minimo) {
            return;
        }

        Notificacion::create([
            'sucursal_id'      => $producto->sucursal_id,
            'usuario_id'       => null, // null = para todos los admins de la sucursal
            'tipo'             => 'stock_bajo',
            'mensaje'          => "El producto \"{$producto->nombre}\" tiene stock bajo ({$stockActual} unidades, mínimo {$producto->stock_minimo}).",
            'referencia_id'    => $producto->id_producto,
            'referencia_tipo'  => 'producto',
        ]);
    }
}
