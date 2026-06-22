<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreCategoriaProductoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // sucursal_id es opcional aquí: si el usuario no es admin_general,
            // el controlador la fuerza automáticamente a la suya.
            'sucursal_id' => ['nullable', 'integer', 'exists:sucursales,id_sucursal'],
            'nombre'      => ['required', 'string', 'max:80'],
        ];
    }
}
