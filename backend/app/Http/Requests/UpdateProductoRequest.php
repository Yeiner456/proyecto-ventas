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
            // Archivo nuevo (reemplaza al que hubiera) y bandera para
            // quitar la imagen actual sin subir una nueva. Se manejan por
            // separado porque un <input type="file"> nunca manda "false"
            // cuando está vacío, así que no hay forma de distinguir "no
            // toqué la imagen" de "quiero borrarla" sin este campo aparte.
            'imagen'          => ['sometimes', 'nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
            'eliminar_imagen' => ['sometimes', 'boolean'],
            'maneja_stock' => ['sometimes', 'boolean'],
            'stock_minimo' => ['sometimes', 'integer', 'min:0'],
            'activo'       => ['sometimes', 'boolean'],
        ];
    }
}
