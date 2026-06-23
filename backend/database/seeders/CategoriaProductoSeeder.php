<?php

namespace Database\Seeders;

use App\Models\CategoriaProducto;
use App\Models\Sucursal;
use Illuminate\Database\Seeder;

class CategoriaProductoSeeder extends Seeder
{
    public function run(): void
    {
        $sucursalCentro = Sucursal::where('nombre', 'Sucursal Centro')->first();
        $sucursalNorte  = Sucursal::where('nombre', 'Sucursal Norte')->first();

        if (!$sucursalCentro || !$sucursalNorte) {
            $this->command?->warn('CategoriaProductoSeeder: faltan Sucursales previas. Corre SucursalSeeder primero.');
            return;
        }

        foreach ([$sucursalCentro, $sucursalNorte] as $sucursal) {
            CategoriaProducto::firstOrCreate([
                'sucursal_id' => $sucursal->id_sucursal,
                'nombre'      => 'Bebidas',
            ]);

            CategoriaProducto::firstOrCreate([
                'sucursal_id' => $sucursal->id_sucursal,
                'nombre'      => 'Comidas',
            ]);

            CategoriaProducto::firstOrCreate([
                'sucursal_id' => $sucursal->id_sucursal,
                'nombre'      => 'Snacks',
            ]);
        }
    }
}
