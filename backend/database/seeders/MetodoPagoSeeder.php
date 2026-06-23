<?php

namespace Database\Seeders;

use App\Models\MetodoPago;
use Illuminate\Database\Seeder;

class MetodoPagoSeeder extends Seeder
{
    public function run(): void
    {
        MetodoPago::firstOrCreate(
            ['nombre' => 'Efectivo'],
            ['es_default' => true, 'requiere_comp' => false, 'activo' => true]
        );

        MetodoPago::firstOrCreate(
            ['nombre' => 'Tarjeta'],
            ['es_default' => false, 'requiere_comp' => false, 'activo' => true]
        );

        MetodoPago::firstOrCreate(
            ['nombre' => 'Transferencia bancaria'],
            ['es_default' => false, 'requiere_comp' => true, 'activo' => true]
        );
    }
}
