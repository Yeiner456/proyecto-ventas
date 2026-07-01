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
            'id_usuario' => ['required', 'integer'],
            'password'   => ['required', 'string'],
            'device_name' => ['sometimes', 'string', 'max:100'],
        ];
    }
}