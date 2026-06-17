<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class MetodoPago extends Model
{
    protected $table = 'metodos_pago';
    protected $primaryKey = 'id_metodo_pago';

    // No tiene timestamps
    public $timestamps = false;

    protected $fillable = [
        'nombre',
        'es_default',
        'requiere_comp',
        'activo',
    ];

    protected $casts = [
        'es_default'    => 'boolean',
        'requiere_comp' => 'boolean',
        'activo'        => 'boolean',
    ];

    // Relaciones
    public function ventas(): HasMany
    {
        return $this->hasMany(Venta::class, 'metodo_pago_id', 'id_metodo_pago');
    }
}