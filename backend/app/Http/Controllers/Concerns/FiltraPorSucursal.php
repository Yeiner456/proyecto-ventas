<?php

namespace App\Http\Controllers\Concerns;

use App\Models\AuditoriaLog;
use App\Models\Usuario;
use Illuminate\Database\Eloquent\Builder;

/**
 * Trait compartido por los controladores de la API.
 *
 * Centraliza dos cosas que se repiten en casi todo el sistema:
 *
 *  1) Multi-tenant por sucursal: un admin_general (sucursal_id = null) ve
 *     todo; cualquier otro usuario solo ve/opera sobre su propia sucursal.
 *
 *  2) Auditoría: registro de quién hizo qué, útil para trazabilidad.
 *
 * Con el middleware 'auth:sanctum' activo en routes/api.php, auth()->user()
 * devuelve el Usuario real autenticado por su token, y el filtro
 * multi-tenant de abajo aplica de verdad. El caso "$user es null" se
 * mantiene como salvaguarda defensiva (ej: una ruta que por error quede
 * sin el middleware), no como comportamiento esperado.
 */
trait FiltraPorSucursal
{
    /**
     * Usuario autenticado actual (o null si todavía no hay auth montado).
     */
    protected function usuarioActual(): ?Usuario
    {
        /** @var Usuario|null $user */
        $user = auth()->user();
        return $user;
    }

    /**
     * true si el usuario autenticado es admin_general (sucursal_id NULL)
     * o si todavía no hay autenticación configurada (modo desarrollo).
     *
     * La regla en sí ("qué es un admin_general") vive en
     * Usuario::esAdminGeneral() para que sea una única fuente de verdad,
     * compartida con las Policies (app/Policies/*.php).
     */
    protected function esAdminGeneral(): bool
    {
        $user = $this->usuarioActual();

        // Sin auth montado todavía -> no restringimos (modo desarrollo)
        if (!$user) {
            return true;
        }

        return $user->esAdminGeneral();
    }

    /**
     * sucursal_id del usuario autenticado. Null si es admin_general
     * o si todavía no hay auth (en cuyo caso el caller debe seguir
     * exigiendo sucursal_id explícito en el request).
     */
    protected function sucursalIdActual(): ?int
    {
        return $this->usuarioActual()?->sucursal_id;
    }

    /**
     * Aplica el filtro multi-tenant a una query: si el usuario pertenece
     * a una sucursal, solo ve esa sucursal. Si es admin_general (o no
     * hay auth aún), no filtra.
     *
     * Uso: Producto::query()->tap(fn($q) => $this->aplicarFiltroSucursal($q))
     * o más simple, llamar $this->aplicarFiltroSucursal($query) y usar $query.
     */
    protected function aplicarFiltroSucursal(Builder $query, string $columna = 'sucursal_id'): Builder
    {
        if (!$this->esAdminGeneral()) {
            $query->where($columna, $this->sucursalIdActual());
        }

        return $query;
    }

    /**
     * Verifica que el sucursal_id de un dato a crear/actualizar coincida
     * con la sucursal del usuario autenticado. Devuelve la sucursal_id
     * "correcta" a usar (la fuerza, no confía en lo que mande el cliente).
     *
     * Si es admin_general, respeta lo que venga en el request (o null).
     */
    protected function resolverSucursalId(?int $sucursalIdSolicitada): ?int
    {
        if (!$this->esAdminGeneral()) {
            return $this->sucursalIdActual();
        }

        return $sucursalIdSolicitada;
    }

    /**
     * Registra una entrada en auditoria_logs. Pensado para llamarse desde
     * acciones sensibles (crear venta, cancelar venta, ajustar precio,
     * ajustar inventario manualmente, etc.)
     */
    protected function registrarAuditoria(
        string $accion,
        ?string $tablaAfectada = null,
        ?int $registroId = null,
        ?array $datosAnteriores = null,
        ?array $datosNuevos = null
    ): void {
        AuditoriaLog::create([
            'usuario_id'        => $this->usuarioActual()?->id_usuario,
            'sucursal_id'       => $this->sucursalIdActual(),
            'accion'            => $accion,
            'tabla_afectada'    => $tablaAfectada,
            'registro_id'       => $registroId,
            'datos_anteriores'  => $datosAnteriores,
            'datos_nuevos'      => $datosNuevos,
            'ip_address'        => request()->ip(),
        ]);
    }
}
