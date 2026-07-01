<?php

namespace App\Policies;

use App\Models\Rol;
use App\Models\Usuario;

class RolPolicy
{
    public function before(Usuario $actor, string $ability): ?bool
    {
        return $actor->esAdminGeneral() ? true : null;
    }

    public function viewAny(Usuario $actor): bool
    {
        return $actor->esAdminSucursal(); // lo necesita para el select al crear usuarios
    }

    public function view(Usuario $actor, Rol $rol): bool
    {
        return $actor->esAdminSucursal();
    }

    public function create(Usuario $actor): bool
    {
        return false;
    }

    public function update(Usuario $actor, Rol $rol): bool
    {
        return false;
    }

    public function delete(Usuario $actor, Rol $rol): bool
    {
        return false;
    }
}
