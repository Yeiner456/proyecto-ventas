<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class ComprobantePago extends Model
{
    protected $table = 'comprobantes_pago';
    protected $primaryKey = 'id_comprobante';

    public $timestamps = false; // solo tiene created_at

    protected $fillable = [
        'venta_id',
        'subido_por',
        'archivo_ruta',
        'tipo_archivo',
    ];

    protected $casts = [
        'created_at' => 'datetime',
    ];

    // Relaciones

    public function venta(): BelongsTo
    {
        return $this->belongsTo(Venta::class, 'venta_id', 'id_venta');
    }

    public function subidoPor(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'subido_por', 'id_usuario');
    }
}