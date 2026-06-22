<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class UpdateVentaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // El estado tiene su propio endpoint (cambiarEstado) porque
            // dispara lógica de negocio (descontar stock, facturar, etc.)
            'metodo_pago_id' => ['sometimes', 'nullable', 'integer', 'exists:metodos_pago,id_metodo_pago'],
            'observacion'    => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }
}
