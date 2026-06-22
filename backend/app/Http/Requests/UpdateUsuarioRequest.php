<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateUsuarioRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $usuario = $this->route('usuario');

        return [
            'sucursal_id' => ['sometimes', 'nullable', 'integer', 'exists:sucursales,id_sucursal'],
            'rol_id'      => ['sometimes', 'integer', 'exists:roles,id_rol'],
            'nombre'      => ['sometimes', 'string', 'max:100'],
            'email'       => ['sometimes', 'email', 'max:150', Rule::unique('usuarios', 'email')->ignore($usuario, 'id_usuario')],
            'password'    => ['sometimes', 'nullable', 'string', 'min:8'],
            'activo'      => ['sometimes', 'boolean'],
        ];
    }
}
