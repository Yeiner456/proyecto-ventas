<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateSucursalRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'nombre'    => ['sometimes', 'string', 'max:100'],
            'direccion' => ['sometimes', 'nullable', 'string', 'max:255'],
            'telefono'  => ['sometimes', 'nullable', 'string', 'max:30'],
            'email'     => ['sometimes', 'nullable', 'email', 'max:100'],
            'activa'    => ['sometimes', 'boolean'],
        ];
    }
}
