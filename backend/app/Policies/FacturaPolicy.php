<?php

namespace App\Policies;

use App\Models\Factura;
use App\Models\Usuario;

class FacturaPolicy
{
    public function before(Usuario $actor, string $ability): ?bool
    {
        return $actor->esAdminGeneral() ? true : null;
    }

    public function viewAny(Usuario $actor): bool
    {
        return true;
    }

    public function view(Usuario $actor, Factura $factura): bool
    {
        return $actor->perteneceASucursal($factura->sucursal_id);
    }
}
