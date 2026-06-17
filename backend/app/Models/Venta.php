<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;

class Venta extends Model
{
    protected $table = 'ventas';
    protected $primaryKey = 'id_venta';

    const ESTADOS = [
        'pendiente',
        'en_preparacion',
        'listo_para_entregar',
        'pagado',
        'entregado',
        'cancelado',
    ];

    protected $fillable = [
        'sucursal_id',
        'cajero_id',
        'estado',
        'metodo_pago_id',
        'total',
        'observacion',
    ];

    protected $casts = [
        'total' => 'decimal:2',
    ];

    // Relaciones
    public function sucursal(): BelongsTo
    {
        return $this->belongsTo(Sucursal::class, 'sucursal_id', 'id_sucursal');
    }

    public function cajero(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'cajero_id', 'id_usuario');
    }

    public function metodoPago(): BelongsTo
    {
        return $this->belongsTo(MetodoPago::class, 'metodo_pago_id', 'id_metodo_pago');
    }

    public function detalles(): HasMany
    {
        return $this->hasMany(DetalleVenta::class, 'venta_id', 'id_venta');
    }

    public function comprobantes(): HasMany
    {
        return $this->hasMany(ComprobantePago::class, 'venta_id', 'id_venta');
    }

    public function factura(): HasOne
    {
        return $this->hasOne(Factura::class, 'venta_id', 'id_venta');
    }

    public function movimientosInventario(): HasMany
    {
        return $this->hasMany(MovimientoInventario::class, 'venta_id', 'id_venta');
    }
}