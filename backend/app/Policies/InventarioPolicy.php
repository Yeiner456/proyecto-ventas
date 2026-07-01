<?php

namespace App\Policies;

use App\Models\Inventario;
use App\Models\Usuario;

class InventarioPolicy
{
    public function before(Usuario $actor, string $ability): ?bool
    {
        return $actor->esAdminGeneral() ? true : null;
    }

    public function viewAny(Usuario $actor): bool
    {
        return true;
    }

    public function view(Usuario $actor, Inventario $inventario): bool
    {
        return $actor->perteneceASucursal($inventario->producto->sucursal_id);
    }

    /**
     * Ajuste manual de stock (conteo físico, merma, corrección).
     * Solo admin_sucursal de la sucursal dueña del producto (además
     * de admin_general, cubierto en before()). El cajero NO ajusta
     * inventario a mano.
     */
    public function ajustar(Usuario $actor, Inventario $inventario): bool
    {
        return $actor->esAdminSucursal() && $actor->perteneceASucursal($inventario->producto->sucursal_id);
    }
}
