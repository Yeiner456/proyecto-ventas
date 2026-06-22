<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreUsuarioRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // sucursal_id es opcional aquí porque, si el usuario autenticado
            // NO es admin_general, el controlador la fuerza a la suya propia.
            'sucursal_id' => ['nullable', 'integer', 'exists:sucursales,id_sucursal'],
            'rol_id'      => ['required', 'integer', 'exists:roles,id_rol'],
            'nombre'      => ['required', 'string', 'max:100'],
            'email'       => ['required', 'email', 'max:150', 'unique:usuarios,email'],
            'password'    => ['required', 'string', 'min:8'],
            'activo'      => ['sometimes', 'boolean'],
        ];
    }
}
