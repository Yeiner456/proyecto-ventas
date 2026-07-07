<?php

namespace App\Providers;

use App\Models\AuditoriaLog;
use App\Models\CategoriaProducto;
use App\Models\ComprobantePago;
use App\Models\DetalleVenta;
use App\Models\Factura;
use App\Models\Inventario;
use App\Models\MetodoPago;
use App\Models\MovimientoInventario;
use App\Models\Notificacion;
use App\Models\Producto;
use App\Models\Rol;
use App\Models\Sucursal;
use App\Models\Usuario;
use App\Models\Venta;
use App\Policies\AuditoriaLogPolicy;
use App\Policies\CategoriaProductoPolicy;
use App\Policies\ComprobantePagoPolicy;
use App\Policies\DetalleVentaPolicy;
use App\Policies\FacturaPolicy;
use App\Policies\InventarioPolicy;
use App\Policies\MetodoPagoPolicy;
use App\Policies\MovimientoInventarioPolicy;
use App\Policies\NotificacionPolicy;
use App\Policies\ProductoPolicy;
use App\Policies\RolPolicy;
use App\Policies\SucursalPolicy;
use App\Policies\UsuarioPolicy;
use App\Policies\VentaPolicy;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Mapa explícito Modelo => Policy. Laravel puede autodescubrirlas
     * por convención de nombres (App\Models\X -> App\Policies\XPolicy),
     * pero las registramos a mano para que quede documentado en un
     * solo lugar.
     */
    protected array $policies = [
        Usuario::class              => UsuarioPolicy::class,
        Sucursal::class             => SucursalPolicy::class,
        Rol::class                  => RolPolicy::class,
        MetodoPago::class           => MetodoPagoPolicy::class,
        CategoriaProducto::class    => CategoriaProductoPolicy::class,
        Producto::class             => ProductoPolicy::class,
        Inventario::class           => InventarioPolicy::class,
        Venta::class                => VentaPolicy::class,
        DetalleVenta::class         => DetalleVentaPolicy::class,
        ComprobantePago::class      => ComprobantePagoPolicy::class,
        Factura::class              => FacturaPolicy::class,
        MovimientoInventario::class => MovimientoInventarioPolicy::class,
        Notificacion::class         => NotificacionPolicy::class,
        AuditoriaLog::class         => AuditoriaLogPolicy::class,
    ];

    public function register(): void
    {
        //
    }

    public function boot(): void
    {
        foreach ($this->policies as $model => $policy) {
            Gate::policy($model, $policy);
        }

        // Acción de sistema sin modelo Eloquent asociado (no hay tabla
        // 'backups'), así que no encaja en el mapa $policies de arriba
        // como las demás. Por eso se registra aquí, con un Gate explícito
        // en vez de una Policy de modelo: solo admin_general.
        Gate::define('gestionar-backups', fn (Usuario $actor) => $actor->esAdminGeneral());
    }
}