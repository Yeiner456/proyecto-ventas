<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Factura extends Model
{
    protected $table = 'facturas';
    protected $primaryKey = 'id_factura';

    public $timestamps = false; // solo tiene created_at

    protected $fillable = [
        'venta_id',
        'sucursal_id',
        'numero_factura',
        'cajero_id',
        'total',
        'pdf_ruta',
    ];

    protected $casts = [
        'total'      => 'decimal:2',
        'created_at' => 'datetime',
    ];

    // Relaciones

    public function venta(): BelongsTo
    {
        return $this->belongsTo(Venta::class, 'venta_id', 'id_venta');
    }

    public function sucursal(): BelongsTo
    {
        return $this->belongsTo(Sucursal::class, 'sucursal_id', 'id_sucursal');
    }

    public function cajero(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'cajero_id', 'id_usuario');
    }
}