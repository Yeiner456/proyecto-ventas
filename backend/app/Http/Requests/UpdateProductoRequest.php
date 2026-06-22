<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateProductoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'categoria_id' => ['sometimes', 'nullable', 'integer', 'exists:categorias_productos,id_categoria'],
            'nombre'       => ['sometimes', 'string', 'max:120'],
            'descripcion'  => ['sometimes', 'nullable', 'string'],
            'precio_base'  => ['sometimes', 'numeric', 'min:0'],
            'imagen_ruta'  => ['sometimes', 'nullable', 'string', 'max:500'],
            'maneja_stock' => ['sometimes', 'boolean'],
            'stock_minimo' => ['sometimes', 'integer', 'min:0'],
            'activo'       => ['sometimes', 'boolean'],
        ];
    }
}
