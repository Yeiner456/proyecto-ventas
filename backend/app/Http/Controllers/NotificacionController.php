<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltraPorSucursal;
use App\Models\Notificacion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Las notificaciones se generan automáticamente por el sistema (ej:
 * stock bajo, ver InventarioService). Vía API solo se listan, se
 * consultan y se marcan como leídas; no hay store manual.
 */
class NotificacionController extends Controller
{
    // FiltraPorSucursal se mantiene solo para aplicarFiltroSucursal()
    // y usuarioActual(). La autorización puntual la resuelve
    // NotificacionPolicy.
    use FiltraPorSucursal;

    public function __construct()
    {
        // La ruta solo expone index/show/destroy (sin store/update).
        $this->authorizeResource(Notificacion::class, 'notificacion');
    }

    public function index(Request $request): JsonResponse
    {
        $query = Notificacion::query();

        $this->aplicarFiltroSucursal($query);

        // Las notificaciones con usuario_id null son "para todos los
        // admins de la sucursal"; si el usuario tiene id, le mostramos
        // tanto las suyas como las generales.
        if ($usuario = $this->usuarioActual()) {
            $query->where(function ($q) use ($usuario) {
                $q->whereNull('usuario_id')->orWhere('usuario_id', $usuario->id_usuario);
            });
        }

        if ($request->boolean('solo_no_leidas')) {
            $query->where('leida', false);
        }

        if ($request->filled('tipo')) {
            $query->where('tipo', $request->string('tipo')->toString());
        }

        $notificaciones = $query->latest('created_at')->paginate($request->integer('per_page', 20));

        return response()->json($notificaciones);
    }

    public function show(Notificacion $notificacion): JsonResponse
    {
        // Autorización de 'view' ya resuelta por authorizeResource().
        return response()->json($notificacion);
    }

    /**
     * Marcar como leída. Usa una ability propia ('marcarLeida') porque
     * no forma parte del CRUD estándar que cubre authorizeResource().
     */
    public function marcarLeida(Notificacion $notificacion): JsonResponse
    {
        $this->authorize('marcarLeida', $notificacion);

        $notificacion->update(['leida' => true]);

        return response()->json($notificacion);
    }

    public function destroy(Notificacion $notificacion): JsonResponse
    {
        // Autorización de 'delete' ya resuelta por authorizeResource().
        $notificacion->delete();

        return response()->json(null, 204);
    }
}
