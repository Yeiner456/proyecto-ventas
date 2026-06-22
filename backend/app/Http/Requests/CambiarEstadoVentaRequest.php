<?php

namespace App\Http\Requests;

use App\Models\Venta;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class CambiarEstadoVentaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'estado' => ['required', Rule::in(Venta::ESTADOS)],
            // Motivo obligatorio solo cuando se cancela; lo exigimos
            // siempre que esté presente para guardarlo en la auditoría.
            'motivo' => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }
}
