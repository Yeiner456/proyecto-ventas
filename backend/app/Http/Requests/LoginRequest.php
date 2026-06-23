<?php

namespace App\Http\Requests;

use Illuminate\Foundation\Http\FormRequest;

class LoginRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'email'    => ['required', 'email'],
            'password' => ['required', 'string'],
            // Opcional: nombre del dispositivo/cliente, útil para luego
            // poder revocar tokens específicos (ej: "iphone-juan", "postman")
            'device_name' => ['sometimes', 'string', 'max:100'],
        ];
    }
}
