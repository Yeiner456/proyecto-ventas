<?php

namespace App\Policies;

use App\Models\MovimientoInventario;
use App\Models\Usuario;

class MovimientoInventarioPolicy
{
    public function before(Usuario $actor, string $ability): ?bool
    {
        return $actor->esAdminGeneral() ? true : null;
    }

    public function viewAny(Usuario $actor): bool
    {
        return true;
    }

    public function view(Usuario $actor, MovimientoInventario $movimientoInventario): bool
    {
        return $actor->perteneceASucursal($movimientoInventario->producto->sucursal_id);
    }
}
