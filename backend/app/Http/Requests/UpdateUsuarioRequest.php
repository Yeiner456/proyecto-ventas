<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateUsuarioRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'sucursal_id' => ['sometimes', 'nullable', 'integer', 'exists:sucursales,id_sucursal'],
            'rol_id'      => ['sometimes', 'integer', 'exists:roles,id_rol'],
            'nombre'      => ['sometimes', 'string', 'max:100'],
            'password'    => ['sometimes', 'nullable', 'string', 'min:8'],
            'activo'      => ['sometimes', 'boolean'],
        ];
    }
}
