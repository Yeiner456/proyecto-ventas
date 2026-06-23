<?php

namespace Database\Seeders;

use App\Models\Rol;
use Illuminate\Database\Seeder;

class RolSeeder extends Seeder
{
    public function run(): void
    {
        $roles = [
            [
                'nombre'      => 'admin_general',
                'descripcion' => 'Administrador general del sistema. Ve y gestiona todas las sucursales.',
            ],
            [
                'nombre'      => 'admin_sucursal',
                'descripcion' => 'Administra una sucursal específica (incluye funciones contables de esa sucursal).',
            ],
            [
                'nombre'      => 'cajero',
                'descripcion' => 'Opera el día a día: registra ventas y cobra. Atado a una sucursal.',
            ],
        ];

        foreach ($roles as $rol) {
            Rol::firstOrCreate(['nombre' => $rol['nombre']], $rol);
        }
    }
}
