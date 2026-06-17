<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class CategoriaProducto extends Model
{
    protected $table = 'categorias_productos';
    protected $primaryKey = 'id_categoria';

    // Solo tiene created_at (no updated_at)
    public $timestamps = false;
    const CREATED_AT = 'created_at';

    protected $fillable = [
        'sucursal_id',
        'nombre',
    ];

    // Relaciones
    public function sucursal(): BelongsTo
    {
        return $this->belongsTo(Sucursal::class, 'sucursal_id', 'id_sucursal');
    }

    public function productos(): HasMany
    {
        return $this->hasMany(Producto::class, 'categoria_id', 'id_categoria');
    }
}