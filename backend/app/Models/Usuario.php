<?php

namespace App\Models;

use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Laravel\Sanctum\HasApiTokens;

class Usuario extends Authenticatable
{
    use HasApiTokens;

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

    // -----------------------------------------------------------------
    // Helpers de rol / sucursal, usados por las Policies (app/Policies)
    // -----------------------------------------------------------------

    public function tieneRol(string $nombre): bool
    {
        return $this->rol?->nombre === $nombre;
    }

    /**
     * admin_general se define por sucursal_id === null (así lo define
     * la migración de usuarios y la lógica original de los
     * controladores), NO por el nombre del rol. Un usuario podría en
     * teoría tener el rol "admin_general" y aun así tener sucursal_id
     * asignado por error de datos; en ese caso, para efectos de
     * autorización, seguimos la columna sucursal_id como fuente de verdad.
     */
    public function esAdminGeneral(): bool
    {
        return $this->sucursal_id === null;
    }

    public function esAdminSucursal(): bool
    {
        return $this->tieneRol('admin_sucursal');
    }

    public function esCajero(): bool
    {
        return $this->tieneRol('cajero');
    }

    public function esContador(): bool
    {
        return $this->tieneRol('contador');
    }

    /**
     * True si el recurso pertenece a la misma sucursal del usuario.
     * admin_general no debería depender de esto (sus Policies lo
     * resuelven antes, en before()).
     */
    public function perteneceASucursal(?int $sucursalId): bool
    {
        return $this->sucursal_id !== null && $this->sucursal_id === $sucursalId;
    }
}
