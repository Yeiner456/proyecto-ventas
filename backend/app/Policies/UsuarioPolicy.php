<?php

namespace App\Policies;

use App\Models\Usuario;

class UsuarioPolicy
{
    /**
     * admin_general puede hacer cualquier cosa; si esto devuelve
     * true/false, Laravel no evalúa el resto de métodos.
     */
    public function before(Usuario $actor, string $ability): ?bool
    {
        return $actor->esAdminGeneral() ? true : null;
    }

    public function viewAny(Usuario $actor): bool
    {
        return $actor->esAdminSucursal();
    }

    public function view(Usuario $actor, Usuario $usuario): bool
    {
        return $actor->esAdminSucursal() && $actor->perteneceASucursal($usuario->sucursal_id);
    }

    public function create(Usuario $actor): bool
    {
        return $actor->esAdminSucursal();
    }

    public function update(Usuario $actor, Usuario $usuario): bool
    {
        return $actor->esAdminSucursal() && $actor->perteneceASucursal($usuario->sucursal_id);
    }

    public function delete(Usuario $actor, Usuario $usuario): bool
    {
        // Nadie se elimina a sí mismo; un admin_sucursal solo elimina
        // usuarios de su propia sucursal.
        if ($actor->is($usuario)) {
            return false;
        }

        return $actor->esAdminSucursal() && $actor->perteneceASucursal($usuario->sucursal_id);
    }
}
