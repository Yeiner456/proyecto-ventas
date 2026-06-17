<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Usuario extends Authenticatable
{
    protected $table = 'usuarios';
    protected $primaryKey = 'id_usuario';

    protected $fillable = [
        'sucursal_id',
        'rol_id',
        'nombre',
        'email',
        'password_hash',
        'activo',
    ];

    protected $hidden = [
        'password_hash',
    ];

    protected $casts = [
        'activo' => 'boolean',
    ];

    // Eloquent usa 'password' por defecto para Auth; mapeamos el campo personalizado
    public function getAuthPassword(): string
    {
        return $this->password_hash;
    }

    // Relaciones
    public function sucursal(): BelongsTo
    {
        return $this->belongsTo(Sucursal::class, 'sucursal_id', 'id_sucursal');
    }

    public function rol(): BelongsTo
    {
        return $this->belongsTo(Rol::class, 'rol_id', 'id_rol');
    }

    public function ventas(): HasMany
    {
        return $this->hasMany(Venta::class, 'cajero_id', 'id_usuario');
    }

    public function comprobantesSubidos(): HasMany
    {
        return $this->hasMany(ComprobantePago::class, 'subido_por', 'id_usuario');
    }

    public function facturas(): HasMany
    {
        return $this->hasMany(Factura::class, 'cajero_id', 'id_usuario');
    }

    public function movimientosInventario(): HasMany
    {
        return $this->hasMany(MovimientoInventario::class, 'usuario_id', 'id_usuario');
    }

    public function notificaciones(): HasMany
    {
        return $this->hasMany(Notificacion::class, 'usuario_id', 'id_usuario');
    }

    public function auditoriaLogs(): HasMany
    {
        return $this->hasMany(AuditoriaLog::class, 'usuario_id', 'id_usuario');
    }
}