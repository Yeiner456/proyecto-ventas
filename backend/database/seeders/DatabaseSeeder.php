<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    /**
     * Orden importante: cada seeder depende de que el anterior ya haya
     * insertado lo que referencia por foreign key.
     *
     *   Roles, Sucursales         -> no dependen de nada
     *   Usuarios                  -> depende de Roles y Sucursales
     *   MetodosPago               -> no depende de nada
     *   CategoriasProductos       -> depende de Sucursales
     *   Productos (+ Inventario)  -> depende de Sucursales y Categorias
     *   DemoVenta                 -> depende de todo lo anterior
     */
    public function run(): void
    {
        $this->call([
            RolSeeder::class,
            SucursalSeeder::class,
            UsuarioSeeder::class,
            MetodoPagoSeeder::class,
            CategoriaProductoSeeder::class,
            ProductoSeeder::class,
            DemoVentaSeeder::class,
        ]);
    }
}
