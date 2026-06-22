<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateMetodoPagoRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        $metodo = $this->route('metodo_pago');

        return [
            'nombre'        => ['sometimes', 'string', 'max:50', Rule::unique('metodos_pago', 'nombre')->ignore($metodo, 'id_metodo_pago')],
            'es_default'    => ['sometimes', 'boolean'],
            'requiere_comp' => ['sometimes', 'boolean'],
            'activo'        => ['sometimes', 'boolean'],
        ];
    }
}
