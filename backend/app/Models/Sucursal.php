<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Sucursal extends Model
{
    protected $table = 'sucursales';
    protected $primaryKey = 'id_sucursal';

    protected $fillable = [
        'nombre',
        'direccion',
        'telefono',
        'email',
        'activa',
    ];

    protected $casts = [
        'activa' => 'boolean',
    ];

    // Relaciones
    public function usuarios(): HasMany
    {
        return $this->hasMany(Usuario::class, 'sucursal_id', 'id_sucursal');
    }

    public function categorias(): HasMany
    {
        return $this->hasMany(CategoriaProducto::class, 'sucursal_id', 'id_sucursal');
    }

    public function productos(): HasMany
    {
        return $this->hasMany(Producto::class, 'sucursal_id', 'id_sucursal');
    }

    public function ventas(): HasMany
    {
        return $this->hasMany(Venta::class, 'sucursal_id', 'id_sucursal');
    }

    public function facturas(): HasMany
    {
        return $this->hasMany(Factura::class, 'sucursal_id', 'id_sucursal');
    }

    public function notificaciones(): HasMany
    {
        return $this->hasMany(Notificacion::class, 'sucursal_id', 'id_sucursal');
    }

    public function auditoriaLogs(): HasMany
    {
        return $this->hasMany(AuditoriaLog::class, 'sucursal_id', 'id_sucursal');
    }
}