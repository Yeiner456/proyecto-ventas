<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Notificacion extends Model
{
    protected $table = 'notificaciones';
    protected $primaryKey = 'id_notificacion';

    public $timestamps = false; // solo tiene created_at

    protected $fillable = [
        'sucursal_id',
        'usuario_id',
        'tipo',
        'mensaje',
        'leida',
        'referencia_id',
        'referencia_tipo',
    ];

    protected $casts = [
        'leida'      => 'boolean',
        'created_at' => 'datetime',
    ];

    // Relaciones

    public function sucursal(): BelongsTo
    {
        return $this->belongsTo(Sucursal::class, 'sucursal_id', 'id_sucursal');
    }

    public function usuario(): BelongsTo
    {
        return $this->belongsTo(Usuario::class, 'usuario_id', 'id_usuario');
    }
}