<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateRolRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $rol = $this->route('rol');

        return [
            'nombre'      => ['sometimes', 'string', 'max:50', Rule::unique('roles', 'nombre')->ignore($rol, 'id_rol')],
            'descripcion' => ['sometimes', 'nullable', 'string', 'max:255'],
            'activo'      => ['sometimes', 'boolean'],
        ];
    }
}
