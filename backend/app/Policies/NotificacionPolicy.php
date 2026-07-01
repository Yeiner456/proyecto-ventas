<?php

namespace App\Policies;

use App\Models\Notificacion;
use App\Models\Usuario;

class NotificacionPolicy
{
    public function before(Usuario $actor, string $ability): ?bool
    {
        return $actor->esAdminGeneral() ? true : null;
    }

    public function viewAny(Usuario $actor): bool
    {
        return true;
    }

    public function view(Usuario $actor, Notificacion $notificacion): bool
    {
        return $this->puedeGestionar($actor, $notificacion);
    }

    public function marcarLeida(Usuario $actor, Notificacion $notificacion): bool
    {
        return $this->puedeGestionar($actor, $notificacion);
    }

    public function delete(Usuario $actor, Notificacion $notificacion): bool
    {
        return $this->puedeGestionar($actor, $notificacion);
    }

    /**
     * Una notificación es gestionable por: el usuario al que va
     * dirigida, o cualquier admin_sucursal de la sucursal cuando
     * usuario_id es null ("para todos los admins de la sucursal").
     */
    protected function puedeGestionar(Usuario $actor, Notificacion $notificacion): bool
    {
        if (!$actor->perteneceASucursal($notificacion->sucursal_id)) {
            return false;
        }

        if ($notificacion->usuario_id === null) {
            return $actor->esAdminSucursal();
        }

        return $notificacion->usuario_id === $actor->id_usuario;
    }
}
