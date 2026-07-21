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

            // 'detalles' es opcional: solo se manda cuando se está editando
            // el pedido de una venta pendiente (añadir/quitar productos,
            // cambiar cantidades). Cuando viene, REEMPLAZA por completo las
            // líneas existentes (mismo criterio que StoreVentaRequest).
            // VentaController::update() es quien valida que la venta esté
            // en estado 'pendiente' antes de aplicar este reemplazo.
            'detalles'                          => ['sometimes', 'array', 'min:1'],
            'detalles.*.producto_id'            => ['required', 'integer', 'exists:productos,id_producto'],
            'detalles.*.cantidad'               => ['required', 'integer', 'min:1'],
            'detalles.*.precio_unitario_venta'  => ['sometimes', 'numeric', 'min:0'],
            'detalles.*.observacion_ajuste'     => ['sometimes', 'nullable', 'string', 'max:255'],
        ];
    }
}