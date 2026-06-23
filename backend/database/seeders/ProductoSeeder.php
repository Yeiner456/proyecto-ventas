<?php

namespace Database\Seeders;

use App\Models\CategoriaProducto;
use App\Models\Inventario;
use App\Models\Producto;
use App\Models\Sucursal;
use Illuminate\Database\Seeder;

/**
 * Crea productos de ejemplo, cubriendo ambos casos del negocio:
 *  - maneja_stock = true  -> productos embotellados/empacados, con su
 *    registro de Inventario y un stock_minimo para probar la alerta.
 *  - maneja_stock = false -> productos preparados al momento (comida),
 *    que nunca descuentan inventario al venderse.
 */
class ProductoSeeder extends Seeder
{
    public function run(): void
    {
        $sucursalCentro = Sucursal::where('nombre', 'Sucursal Centro')->first();

        if (!$sucursalCentro) {
            $this->command?->warn('ProductoSeeder: falta la Sucursal Centro. Corre SucursalSeeder primero.');
            return;
        }

        $bebidas = CategoriaProducto::where('sucursal_id', $sucursalCentro->id_sucursal)
            ->where('nombre', 'Bebidas')->first();
        $comidas = CategoriaProducto::where('sucursal_id', $sucursalCentro->id_sucursal)
            ->where('nombre', 'Comidas')->first();
        $snacks = CategoriaProducto::where('sucursal_id', $sucursalCentro->id_sucursal)
            ->where('nombre', 'Snacks')->first();

        // --- Productos CON manejo de stock ---
        $conStock = [
            ['nombre' => 'Gaseosa 400ml',     'categoria' => $bebidas, 'precio' => 3500,  'stock' => 50, 'minimo' => 10],
            ['nombre' => 'Agua 600ml',        'categoria' => $bebidas, 'precio' => 2500,  'stock' => 80, 'minimo' => 15],
            ['nombre' => 'Papas fritas 45g',  'categoria' => $snacks,  'precio' => 4000,  'stock' => 5,  'minimo' => 10], // a propósito por debajo del mínimo, para probar la alerta de stock bajo
            ['nombre' => 'Chocolatina',       'categoria' => $snacks,  'precio' => 2000,  'stock' => 40, 'minimo' => 10],
        ];

        foreach ($conStock as $datos) {
            $producto = Producto::firstOrCreate(
                ['sucursal_id' => $sucursalCentro->id_sucursal, 'nombre' => $datos['nombre']],
                [
                    'categoria_id'  => $datos['categoria']?->id_categoria,
                    'precio_base'   => $datos['precio'],
                    'maneja_stock'  => true,
                    'stock_minimo'  => $datos['minimo'],
                    'activo'        => true,
                ]
            );

            Inventario::firstOrCreate(
                ['producto_id' => $producto->id_producto],
                ['cantidad' => $datos['stock']]
            );
        }

        // --- Productos SIN manejo de stock (preparados al momento) ---
        $sinStock = [
            ['nombre' => 'Hamburguesa clásica', 'categoria' => $comidas, 'precio' => 15000],
            ['nombre' => 'Perro caliente',       'categoria' => $comidas, 'precio' => 9000],
            ['nombre' => 'Café americano',       'categoria' => $bebidas, 'precio' => 4500],
        ];

        foreach ($sinStock as $datos) {
            Producto::firstOrCreate(
                ['sucursal_id' => $sucursalCentro->id_sucursal, 'nombre' => $datos['nombre']],
                [
                    'categoria_id'  => $datos['categoria']?->id_categoria,
                    'precio_base'   => $datos['precio'],
                    'maneja_stock'  => false,
                    'stock_minimo'  => 0,
                    'activo'        => true,
                ]
            );
        }
    }
}
