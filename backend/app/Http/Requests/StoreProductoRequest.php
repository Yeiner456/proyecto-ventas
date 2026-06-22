<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreProductoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'sucursal_id'   => ['nullable', 'integer', 'exists:sucursales,id_sucursal'],
            'categoria_id'  => ['nullable', 'integer', 'exists:categorias_productos,id_categoria'],
            'nombre'        => ['required', 'string', 'max:120'],
            'descripcion'   => ['nullable', 'string'],
            'precio_base'   => ['required', 'numeric', 'min:0'],
            'imagen_ruta'   => ['nullable', 'string', 'max:500'],
            'maneja_stock'  => ['sometimes', 'boolean'],
            'stock_minimo'  => ['sometimes', 'integer', 'min:0'],
            'activo'        => ['sometimes', 'boolean'],
            // Si maneja_stock = true, opcionalmente puede mandar el stock inicial
            'stock_inicial' => ['sometimes', 'integer', 'min:0'],
        ];
    }
}
