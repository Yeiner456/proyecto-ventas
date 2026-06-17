<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MovimientoInventario extends Model
{
    protected $table = 'movimientos_inventario';
    protected $primaryKey = 'id_movimiento';

    public $timestamps = false; // solo tiene created_at

    protected $fillable = [
        'producto_id',
        'usuario_id',
        'venta_id',
        'tipo',
        'cantidad',
        'stock_antes',
        'stock_despues',
        'observacion',
    ];

    protected $casts = [
        'tipo'         => 'string', // 'entrada' | 'salida' | 'ajuste'
        'cantidad'     => 'integer',
        'stock_antes'  => 'integer',
        'stock_despues'=> 'integer',
        'created_at'   => 'datetime',
    ];

    // Relaciones

    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class, 'producto_id', 'id_producto');
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'usuario_id', 'id_usuario');
    }

    public function venta(): BelongsTo
    {
        return $this->belongsTo(Venta::class, 'venta_id', 'id_venta');
    }
}