<?php

namespace App\Policies;

use App\Models\CategoriaProducto;
use App\Models\Usuario;

class CategoriaProductoPolicy
{
    public function before(Usuario $actor, string $ability): ?bool
    {
        return $actor->esAdminGeneral() ? true : null;
    }

    public function viewAny(Usuario $actor): bool
    {
        return true; // todos los roles necesitan listarlas (ej: al filtrar productos)
    }

    public function view(Usuario $actor, CategoriaProducto $categoriaProducto): bool
    {
        return $actor->perteneceASucursal($categoriaProducto->sucursal_id);
    }

    public function create(Usuario $actor): bool
    {
        return $actor->esAdminSucursal();
    }

    public function update(Usuario $actor, CategoriaProducto $categoriaProducto): bool
    {
        return $actor->esAdminSucursal() && $actor->perteneceASucursal($categoriaProducto->sucursal_id);
    }

    public function delete(Usuario $actor, CategoriaProducto $categoriaProducto): bool
    {
        return $actor->esAdminSucursal() && $actor->perteneceASucursal($categoriaProducto->sucursal_id);
    }
}
