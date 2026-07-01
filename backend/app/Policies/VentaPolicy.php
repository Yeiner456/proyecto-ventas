<?php

namespace App\Policies;

use App\Models\Usuario;
use App\Models\Venta;

class VentaPolicy
{
    public function before(Usuario $actor, string $ability): ?bool
    {
        return $actor->esAdminGeneral() ? true : null;
    }

    public function viewAny(Usuario $actor): bool
    {
        return true;
    }

    public function view(Usuario $actor, Venta $venta): bool
    {
        return $actor->perteneceASucursal($venta->sucursal_id);
    }

    public function create(Usuario $actor): bool
    {
        return $actor->esAdminSucursal() || $actor->esCajero();
    }

    public function update(Usuario $actor, Venta $venta): bool
    {
        return ($actor->esAdminSucursal() || $actor->esCajero())
            && $actor->perteneceASucursal($venta->sucursal_id);
    }

    /**
     * Cambiar estado dispara lógica de negocio (descuento de stock,
     * facturación), pero tanto cajero como admin_sucursal la usan
     * en el día a día.
     */
    public function cambiarEstado(Usuario $actor, Venta $venta): bool
    {
        return ($actor->esAdminSucursal() || $actor->esCajero())
            && $actor->perteneceASucursal($venta->sucursal_id);
    }

    /**
     * Eliminar una venta (aunque el controlador ya limita a estados
     * pendiente/cancelado) se deja solo para admin_sucursal.
     */
    public function delete(Usuario $actor, Venta $venta): bool
    {
        return $actor->esAdminSucursal() && $actor->perteneceASucursal($venta->sucursal_id);
    }
}
