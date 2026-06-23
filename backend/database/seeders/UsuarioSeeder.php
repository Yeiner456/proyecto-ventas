<?php

namespace Database\Seeders;

use App\Models\Rol;
use App\Models\Sucursal;
use App\Models\Usuario;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

/**
 * Crea un usuario de prueba por cada rol, todos con la misma password
 * para que sea fácil probar el login durante desarrollo:
 *
 *   admin@monito.com       / password123   (admin_general, sin sucursal)
 *   adminsucursal@monito.com / password123 (admin_sucursal, Sucursal Centro)
 *   cajero@monito.com      / password123   (cajero, Sucursal Centro)
 *   cajeronorte@monito.com / password123   (cajero, Sucursal Norte)
 *
 * IMPORTANTE: cambia o elimina estos usuarios antes de ir a producción.
 */
class UsuarioSeeder extends Seeder
{
    public function run(): void
    {
        $passwordPrueba = Hash::make('password123');

        $rolAdminGeneral  = Rol::where('nombre', 'admin_general')->first();
        $rolAdminSucursal = Rol::where('nombre', 'admin_sucursal')->first();
        $rolCajero        = Rol::where('nombre', 'cajero')->first();

        $sucursalCentro = Sucursal::where('nombre', 'Sucursal Centro')->first();
        $sucursalNorte  = Sucursal::where('nombre', 'Sucursal Norte')->first();

        if (!$rolAdminGeneral || !$rolAdminSucursal || !$rolCajero || !$sucursalCentro || !$sucursalNorte) {
            $this->command?->warn('UsuarioSeeder: faltan Roles o Sucursales previos. Corre RolSeeder y SucursalSeeder primero.');
            return;
        }

        Usuario::firstOrCreate(
            ['email' => 'admin@monito.com'],
            [
                'sucursal_id'   => null, // admin_general no pertenece a ninguna sucursal
                'rol_id'        => $rolAdminGeneral->id_rol,
                'nombre'        => 'Admin General',
                'password_hash' => $passwordPrueba,
                'activo'        => true,
            ]
        );

        Usuario::firstOrCreate(
            ['email' => 'adminsucursal@monito.com'],
            [
                'sucursal_id'   => $sucursalCentro->id_sucursal,
                'rol_id'        => $rolAdminSucursal->id_rol,
                'nombre'        => 'Admin Sucursal Centro',
                'password_hash' => $passwordPrueba,
                'activo'        => true,
            ]
        );

        Usuario::firstOrCreate(
            ['email' => 'cajero@monito.com'],
            [
                'sucursal_id'   => $sucursalCentro->id_sucursal,
                'rol_id'        => $rolCajero->id_rol,
                'nombre'        => 'Cajero Centro',
                'password_hash' => $passwordPrueba,
                'activo'        => true,
            ]
        );

        Usuario::firstOrCreate(
            ['email' => 'cajeronorte@monito.com'],
            [
                'sucursal_id'   => $sucursalNorte->id_sucursal,
                'rol_id'        => $rolCajero->id_rol,
                'nombre'        => 'Cajero Norte',
                'password_hash' => $passwordPrueba,
                'activo'        => true,
            ]
        );
    }
}
