<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('usuarios', function (Blueprint $table) {
            $table->unsignedInteger('id_usuario')->autoIncrement()->primary();
            $table->unsignedInteger('sucursal_id')->nullable();  // NULL = admin general (sin sucursal)
            $table->unsignedInteger('rol_id');
            $table->string('nombre', 100);
            $table->string('password_hash', 255);
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->foreign('sucursal_id', 'fk_usuarios_sucursal')
                  ->references('id_sucursal')->on('sucursales')
                  ->onDelete('set null');

            $table->foreign('rol_id', 'fk_usuarios_rol')
                  ->references('id_rol')->on('roles');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('usuarios');
    }
};
