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
    use FiltraPorSucursal;

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
        $this->autorizarAccesoSucursal($notificacion->sucursal_id);

        return response()->json($notificacion);
    }

    public function marcarLeida(Notificacion $notificacion): JsonResponse
    {
        $this->autorizarAccesoSucursal($notificacion->sucursal_id);

        $notificacion->update(['leida' => true]);

        return response()->json($notificacion);
    }

    public function destroy(Notificacion $notificacion): JsonResponse
    {
        $this->autorizarAccesoSucursal($notificacion->sucursal_id);

        $notificacion->delete();

        return response()->json(null, 204);
    }

    protected function autorizarAccesoSucursal(?int $sucursalIdRecurso): void
    {
        if ($this->esAdminGeneral()) {
            return;
        }

        abort_if($sucursalIdRecurso !== $this->sucursalIdActual(), 403, 'No tienes acceso a recursos de otra sucursal.');
    }
}
