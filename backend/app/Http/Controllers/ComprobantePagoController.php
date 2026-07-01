<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltraPorSucursal;
use App\Http\Requests\StoreComprobantePagoRequest;
use App\Models\ComprobantePago;
use App\Models\Venta;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Comprobantes de pago (ej: foto del voucher de transferencia). No
 * tiene update: si subieron el archivo equivocado, se elimina y se
 * sube de nuevo.
 */
class ComprobantePagoController extends Controller
{
    // FiltraPorSucursal se mantiene solo para esAdminGeneral() y
    // sucursalIdActual() (usados en el filtro manual de index, ya que
    // ComprobantePago no tiene sucursal_id propio). La autorización
    // puntual la resuelve ComprobantePagoPolicy.
    use FiltraPorSucursal;

    public function __construct()
    {
        // La ruta solo expone index/store/show/destroy (sin update).
        $this->authorizeResource(ComprobantePago::class, 'comprobante_pago');
    }

    public function index(Request $request): JsonResponse
    {
        $query = ComprobantePago::query()->with(['venta', 'subidoPor']);

        if (!$this->esAdminGeneral()) {
            $query->whereHas('venta', function ($q) {
                $q->where('sucursal_id', $this->sucursalIdActual());
            });
        }

        if ($request->filled('venta_id')) {
            $query->where('venta_id', $request->integer('venta_id'));
        }

        $comprobantes = $query->latest('created_at')->paginate($request->integer('per_page', 15));

        return response()->json($comprobantes);
    }

    public function store(StoreComprobantePagoRequest $request): JsonResponse
    {
        // ComprobantePagoPolicy::create() solo valida el rol (cajero o
        // admin_sucursal); la venta puntual la validamos aquí porque
        // recién la obtenemos del payload.
        $venta = Venta::findOrFail($request->integer('venta_id'));

        if (!$this->esAdminGeneral() && $venta->sucursal_id !== $this->sucursalIdActual()) {
            abort(403, 'No tienes acceso a recursos de otra sucursal.');
        }

        $archivo = $request->file('archivo');
        $ruta = $archivo->store('comprobantes_pago', 'public');

        $comprobante = ComprobantePago::create([
            'venta_id'     => $venta->id_venta,
            'subido_por'   => $this->usuarioActual()?->id_usuario,
            'archivo_ruta' => $ruta,
            'tipo_archivo' => $archivo->getClientOriginalExtension(),
        ]);

        return response()->json($comprobante->load(['venta', 'subidoPor']), 201);
    }

    public function show(ComprobantePago $comprobantePago): JsonResponse
    {
        // Autorización de 'view' ya resuelta por authorizeResource().
        return response()->json($comprobantePago->load(['venta', 'subidoPor']));
    }

    public function destroy(ComprobantePago $comprobantePago): JsonResponse
    {
        // Autorización de 'delete' ya resuelta por authorizeResource()
        // (incluye la regla de "un cajero solo borra lo que él subió").
        Storage::disk('public')->delete($comprobantePago->archivo_ruta);
        $comprobantePago->delete();

        return response()->json(null, 204);
    }
}
