<?php

namespace App\Policies;

use App\Models\Sucursal;
use App\Models\Usuario;

class SucursalPolicy
{
    public function before(Usuario $actor, string $ability): ?bool
    {
        return $actor->esAdminGeneral() ? true : null;
    }

    public function viewAny(Usuario $actor): bool
    {
        return true; // cualquier usuario autenticado puede listarlas (ej: selects)
    }

    public function view(Usuario $actor, Sucursal $sucursal): bool
    {
        return true;
    }

    // create/update/delete quedan en false: solo admin_general (cubierto en before())
    public function create(Usuario $actor): bool
    {
        return false;
    }

    public function update(Usuario $actor, Sucursal $sucursal): bool
    {
        return false;
    }

    public function delete(Usuario $actor, Sucursal $sucursal): bool
    {
        return false;
    }
}
