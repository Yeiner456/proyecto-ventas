<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltraPorSucursal;
use App\Models\AuditoriaLog;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Bitácora de auditoría. Se llena automáticamente desde los demás
 * controladores (ver FiltraPorSucursal::registrarAuditoria). Es de
 * solo LECTURA: nunca se crea, edita ni elimina manualmente vía API.
 *
 * Un admin_sucursal solo ve la auditoría de su propia sucursal; el
 * admin_general ve todo.
 */
class AuditoriaLogController extends Controller
{
    use FiltraPorSucursal;

    public function index(Request $request): JsonResponse
    {
        $query = AuditoriaLog::query()->with(['usuario', 'sucursal']);

        $this->aplicarFiltroSucursal($query);

        if ($request->filled('usuario_id')) {
            $query->where('usuario_id', $request->integer('usuario_id'));
        }

        if ($request->filled('accion')) {
            $query->where('accion', $request->string('accion')->toString());
        }

        if ($request->filled('tabla_afectada')) {
            $query->where('tabla_afectada', $request->string('tabla_afectada')->toString());
        }

        if ($request->filled('desde')) {
            $query->whereDate('created_at', '>=', $request->date('desde'));
        }

        if ($request->filled('hasta')) {
            $query->whereDate('created_at', '<=', $request->date('hasta'));
        }

        $logs = $query->latest('created_at')->paginate($request->integer('per_page', 25));

        return response()->json($logs);
    }

    public function show(AuditoriaLog $auditoriaLog): JsonResponse
    {
        $this->autorizarAccesoSucursal($auditoriaLog->sucursal_id);

        return response()->json($auditoriaLog->load(['usuario', 'sucursal']));
    }

    protected function autorizarAccesoSucursal(?int $sucursalIdRecurso): void
    {
        if ($this->esAdminGeneral()) {
            return;
        }

        abort_if($sucursalIdRecurso !== $this->sucursalIdActual(), 403, 'No tienes acceso a recursos de otra sucursal.');
    }
}
