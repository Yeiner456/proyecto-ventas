<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;

/**
 * Reemplaza a los antiguos RolSeeder, SucursalSeeder, UsuarioSeeder y
 * MetodoPagoSeeder (database/seeders/, ya eliminados). El sistema necesita
 * estos datos para poder funcionar desde el primer arranque (sin ellos
 * nadie podría ni iniciar sesión), así que se insertan aquí como datos
 * fijos de producción en vez de como seeders opcionales.
 *
 * NO se incluyen los antiguos ProductoSeeder / CategoriaProductoSeeder /
 * DemoVentaSeeder: esos eran datos de ejemplo (así lo decían sus propios
 * comentarios) y ahora se crean desde la interfaz real, como el resto del
 * catálogo de negocio.
 *
 * insertOrIgnore() hace esta migración segura de correr más de una vez
 * (p. ej. si alguien ya tenía estos datos de una corrida anterior de los
 * seeders): no truena por PK/unique duplicado, simplemente no repite la fila.
 */
return new class extends Migration
{
    public function up(): void
    {
        // --- Roles: catálogo fijo del sistema, nunca cambia ---
        DB::table('roles')->insertOrIgnore([
            ['nombre' => 'admin_general', 'descripcion' => 'Administrador general del sistema. Ve y gestiona todas las sucursales.', 'activo' => true, 'created_at' => now(), 'updated_at' => now()],
            ['nombre' => 'admin_sucursal', 'descripcion' => 'Administra una sucursal específica (incluye funciones contables de esa sucursal).', 'activo' => true, 'created_at' => now(), 'updated_at' => now()],
            ['nombre' => 'cajero', 'descripcion' => 'Opera el día a día: registra ventas y cobra. Atado a una sucursal.', 'activo' => true, 'created_at' => now(), 'updated_at' => now()],
        ]);

        // --- Sucursales reales del proyecto ---
        DB::table('sucursales')->insertOrIgnore([
            ['nombre' => 'Sucursal Centro', 'direccion' => 'Calle 10 #5-50, Bogotá', 'telefono' => '3001112233', 'email' => 'centro@monito.com', 'activa' => true, 'created_at' => now(), 'updated_at' => now()],
            ['nombre' => 'Sucursal Norte', 'direccion' => 'Av. 19 #120-30, Bogotá', 'telefono' => '3004445566', 'email' => 'norte@monito.com', 'activa' => true, 'created_at' => now(), 'updated_at' => now()],
        ]);

        // --- Métodos de pago: catálogo fijo (una venta no puede existir sin uno) ---
        DB::table('metodos_pago')->insertOrIgnore([
            ['nombre' => 'Efectivo', 'es_default' => true, 'requiere_comp' => false, 'activo' => true],
            ['nombre' => 'Tarjeta', 'es_default' => false, 'requiere_comp' => false, 'activo' => true],
            ['nombre' => 'Transferencia bancaria', 'es_default' => false, 'requiere_comp' => true, 'activo' => true],
        ]);

        // --- Usuarios: se resuelven los FK por nombre, igual que hacía UsuarioSeeder ---
        $rolAdminGeneral  = DB::table('roles')->where('nombre', 'admin_general')->value('id_rol');
        $rolAdminSucursal = DB::table('roles')->where('nombre', 'admin_sucursal')->value('id_rol');
        $rolCajero        = DB::table('roles')->where('nombre', 'cajero')->value('id_rol');

        $sucursalCentro = DB::table('sucursales')->where('nombre', 'Sucursal Centro')->value('id_sucursal');
        $sucursalNorte  = DB::table('sucursales')->where('nombre', 'Sucursal Norte')->value('id_sucursal');

        // Nota: sin columna de email (proyecto de uso local). Cada usuario
        // se identifica por su id_usuario al iniciar sesión, no por nombre,
        // así que 'nombre' no necesita ser único aquí — solo es descriptivo.
        DB::table('usuarios')->insertOrIgnore([
            [
                'sucursal_id'   => null, // admin_general no pertenece a ninguna sucursal
                'rol_id'        => $rolAdminGeneral,
                'nombre'        => 'Admin General',
                'password_hash' => Hash::make('AdminGeneral#2026'),
                'activo'        => true,
                'created_at'    => now(),
                'updated_at'    => now(),
            ],
            [
                'sucursal_id'   => $sucursalCentro,
                'rol_id'        => $rolAdminSucursal,
                'nombre'        => 'Admin Sucursal Centro',
                'password_hash' => Hash::make('AdminCentro#2026'),
                'activo'        => true,
                'created_at'    => now(),
                'updated_at'    => now(),
            ],
            [
                'sucursal_id'   => $sucursalCentro,
                'rol_id'        => $rolCajero,
                'nombre'        => 'Cajero Centro',
                'password_hash' => Hash::make('CajeroCentro#2026'),
                'activo'        => true,
                'created_at'    => now(),
                'updated_at'    => now(),
            ],
            [
                'sucursal_id'   => $sucursalNorte,
                'rol_id'        => $rolCajero,
                'nombre'        => 'Cajero Norte',
                'password_hash' => Hash::make('CajeroNorte#2026'),
                'activo'        => true,
                'created_at'    => now(),
                'updated_at'    => now(),
            ],
        ]);
    }

    public function down(): void
    {
        // Orden inverso por dependencias de FK: usuarios primero (hijo),
        // luego sucursales/roles/metodos_pago (padres).
        DB::table('usuarios')->whereIn('nombre', [
            'Admin General',
            'Admin Sucursal Centro',
            'Cajero Centro',
            'Cajero Norte',
        ])->delete();

        DB::table('metodos_pago')->whereIn('nombre', [
            'Efectivo',
            'Tarjeta',
            'Transferencia bancaria',
        ])->delete();

        DB::table('sucursales')->whereIn('nombre', [
            'Sucursal Centro',
            'Sucursal Norte',
        ])->delete();

        DB::table('roles')->whereIn('nombre', [
            'admin_general',
            'admin_sucursal',
            'cajero',
        ])->delete();
    }
};
