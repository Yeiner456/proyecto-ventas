<?php

namespace App\Policies;

use App\Models\DetalleVenta;
use App\Models\Usuario;

class DetalleVentaPolicy
{
    public function before(Usuario $actor, string $ability): ?bool
    {
        return $actor->esAdminGeneral() ? true : null;
    }

    public function viewAny(Usuario $actor): bool
    {
        return true;
    }

    public function view(Usuario $actor, DetalleVenta $detalleVenta): bool
    {
        return $actor->perteneceASucursal($detalleVenta->venta->sucursal_id);
    }
}
