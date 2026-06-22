<?php

namespace App\Http\Requests;

use App\Models\Venta;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreVentaRequest extends FormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'sucursal_id'    => ['nullable', 'integer', 'exists:sucursales,id_sucursal'],
            'cajero_id'      => ['nullable', 'integer', 'exists:usuarios,id_usuario'],
            'estado'         => ['sometimes', Rule::in(Venta::ESTADOS)],
            'metodo_pago_id' => ['nullable', 'integer', 'exists:metodos_pago,id_metodo_pago'],
            'observacion'    => ['nullable', 'string', 'max:255'],

            // La venta se crea junto con sus líneas de detalle
            'detalles'                       => ['required', 'array', 'min:1'],
            'detalles.*.producto_id'         => ['required', 'integer', 'exists:productos,id_producto'],
            'detalles.*.cantidad'            => ['required', 'integer', 'min:1'],
            // precio_unitario_venta es opcional: si no se manda, se usa
            // el precio_base actual del producto (snapshot automático).
            'detalles.*.precio_unitario_venta' => ['sometimes', 'numeric', 'min:0'],
            'detalles.*.observacion_ajuste'     => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }
}
