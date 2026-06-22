<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class AjustarInventarioRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            // Puede ser positivo (entra mercadería) o negativo (merma, daño, etc.)
            'cantidad'    => ['required', 'integer', 'not_in:0'],
            'observacion' => ['required', 'string', 'max:255'],
        ];
    }
}
