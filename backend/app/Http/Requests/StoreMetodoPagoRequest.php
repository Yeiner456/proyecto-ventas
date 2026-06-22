<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class StoreMetodoPagoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'nombre'        => ['required', 'string', 'max:50', 'unique:metodos_pago,nombre'],
            'es_default'    => ['sometimes', 'boolean'],
            'requiere_comp' => ['sometimes', 'boolean'],
            'activo'        => ['sometimes', 'boolean'],
        ];
    }
}
