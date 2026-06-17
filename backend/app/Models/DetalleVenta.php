<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class DetalleVenta extends Model
{
    protected $table = 'detalle_ventas';
    protected $primaryKey = 'id_detalle_venta';

    // No tiene timestamps propios
    public $timestamps = false;

    protected $fillable = [
        'venta_id',
        'producto_id',
        'cantidad',
        'precio_base_snapshot',
        'precio_unitario_venta',
        'ajuste_precio',
        'observacion_ajuste',
    ];

    protected $casts = [
        'cantidad'               => 'integer',
        'precio_base_snapshot'   => 'decimal:2',
        'precio_unitario_venta'  => 'decimal:2',
        'ajuste_precio'          => 'boolean',
    ];

    // Subtotal calculado en PHP (no columna generada en BD)
    public function getSubtotalAttribute(): float
    {
        return $this->cantidad * $this->precio_unitario_venta;
    }

    // Relaciones
    public function venta(): BelongsTo
    {
        return $this->belongsTo(Venta::class, 'venta_id', 'id_venta');
    }

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class, 'producto_id', 'id_producto');
    }
}