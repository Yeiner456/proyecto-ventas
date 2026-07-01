<?php

namespace App\Policies;

use App\Models\ComprobantePago;
use App\Models\Usuario;

class ComprobantePagoPolicy
{
    public function before(Usuario $actor, string $ability): ?bool
    {
        return $actor->esAdminGeneral() ? true : null;
    }

    public function viewAny(Usuario $actor): bool
    {
        return true;
    }

    public function view(Usuario $actor, ComprobantePago $comprobantePago): bool
    {
        return $actor->perteneceASucursal($comprobantePago->venta->sucursal_id);
    }

    public function create(Usuario $actor): bool
    {
        return $actor->esAdminSucursal() || $actor->esCajero();
    }

    public function delete(Usuario $actor, ComprobantePago $comprobantePago): bool
    {
        if (!$actor->perteneceASucursal($comprobantePago->venta->sucursal_id)) {
            return false;
        }

        // admin_sucursal borra cualquiera de su sucursal;
        // un cajero solo el que él mismo subió.
        return $actor->esAdminSucursal() || $comprobantePago->subido_por === $actor->id_usuario;
    }
}
