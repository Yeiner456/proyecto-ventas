<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Producto extends Model
{
    protected $table = 'productos';
    protected $primaryKey = 'id_producto';

    protected $fillable = [
        'sucursal_id',
        'categoria_id',
        'nombre',
        'descripcion',
        'precio_base',
        'imagen_ruta',
        'maneja_stock',
        'stock_minimo',
        'activo',
    ];

    protected $casts = [
        'precio_base'   => 'decimal:2',
        'maneja_stock'  => 'boolean',
        'activo'        => 'boolean',
        'stock_minimo'  => 'integer',
    ];

    // Relaciones
    public function sucursal(): BelongsTo
    {
        return $this->belongsTo(Sucursal::class, 'sucursal_id', 'id_sucursal');
    }

    public function categoria(): BelongsTo
    {
        return $this->belongsTo(CategoriaProducto::class, 'categoria_id', 'id_categoria');
    }

    public function inventario(): HasOne
    {
        return $this->hasOne(Inventario::class, 'producto_id', 'id_producto');
    }

    public function detalleVentas(): HasMany
    {
        return $this->hasMany(DetalleVenta::class, 'producto_id', 'id_producto');
    }

    public function movimientosInventario(): HasMany
    {
        return $this->hasMany(MovimientoInventario::class, 'producto_id', 'id_producto');
    }
}