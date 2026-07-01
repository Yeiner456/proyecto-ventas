<?php

namespace App\Policies;

use App\Models\MetodoPago;
use App\Models\Usuario;

class MetodoPagoPolicy
{
    public function before(Usuario $actor, string $ability): ?bool
    {
        return $actor->esAdminGeneral() ? true : null;
    }

    public function viewAny(Usuario $actor): bool
    {
        return true; // el cajero necesita verlos para cobrar una venta
    }

    public function view(Usuario $actor, MetodoPago $metodoPago): bool
    {
        return true;
    }

    public function create(Usuario $actor): bool
    {
        return false;
    }

    public function update(Usuario $actor, MetodoPago $metodoPago): bool
    {
        return false;
    }

    public function delete(Usuario $actor, MetodoPago $metodoPago): bool
    {
        return false;
    }
}
