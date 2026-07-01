<?php

namespace App\Policies;

use App\Models\AuditoriaLog;
use App\Models\Usuario;

class AuditoriaLogPolicy
{
    public function before(Usuario $actor, string $ability): ?bool
    {
        return $actor->esAdminGeneral() ? true : null;
    }

    public function viewAny(Usuario $actor): bool
    {
        // Es sensible: solo roles de administración la consultan.
        return $actor->esAdminSucursal();
    }

    public function view(Usuario $actor, AuditoriaLog $auditoriaLog): bool
    {
        return $actor->esAdminSucursal() && $actor->perteneceASucursal($auditoriaLog->sucursal_id);
    }
}
