<?php

namespace Database\Seeders;

use App\Models\Sucursal;
use Illuminate\Database\Seeder;

class SucursalSeeder extends Seeder
{
    public function run(): void
    {
        Sucursal::firstOrCreate(
            ['nombre' => 'Sucursal Centro'],
            [
                'direccion' => 'Calle 10 #5-50, Bogotá',
                'telefono'  => '3001112233',
                'email'     => 'centro@monito.com',
                'activa'    => true,
            ]
        );

        Sucursal::firstOrCreate(
            ['nombre' => 'Sucursal Norte'],
            [
                'direccion' => 'Av. 19 #120-30, Bogotá',
                'telefono'  => '3004445566',
                'email'     => 'norte@monito.com',
                'activa'    => true,
            ]
        );
    }
}
