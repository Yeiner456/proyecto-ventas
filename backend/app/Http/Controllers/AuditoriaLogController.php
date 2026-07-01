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
 */
class AuditoriaLogController extends Controller
{
    // FiltraPorSucursal se mantiene solo para aplicarFiltroSucursal()
    // (scoping del listado). La autorización puntual la resuelve
    // AuditoriaLogPolicy.
    use FiltraPorSucursal;

    public function __construct()
    {
        // La ruta solo expone index/show.
        $this->authorizeResource(AuditoriaLog::class, 'auditoria_log');
    }

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
        // Autorización de 'view' ya resuelta por authorizeResource().
        return response()->json($auditoriaLog->load(['usuario', 'sucursal']));
    }
}
