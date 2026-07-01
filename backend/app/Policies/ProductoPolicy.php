<?php

namespace App\Policies;

use App\Models\Producto;
use App\Models\Usuario;

class ProductoPolicy
{
    public function before(Usuario $actor, string $ability): ?bool
    {
        return $actor->esAdminGeneral() ? true : null;
    }

    public function viewAny(Usuario $actor): bool
    {
        return true;
    }

    public function view(Usuario $actor, Producto $producto): bool
    {
        return $actor->perteneceASucursal($producto->sucursal_id);
    }

    public function create(Usuario $actor): bool
    {
        return $actor->esAdminSucursal();
    }

    public function update(Usuario $actor, Producto $producto): bool
    {
        return $actor->esAdminSucursal() && $actor->perteneceASucursal($producto->sucursal_id);
    }

    public function delete(Usuario $actor, Producto $producto): bool
    {
        return $actor->esAdminSucursal() && $actor->perteneceASucursal($producto->sucursal_id);
    }
}
