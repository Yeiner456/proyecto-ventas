<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('auditoria_logs', function (Blueprint $table) {
            $table->unsignedBigInteger('id_auditoria')->autoIncrement()->primary();
            $table->unsignedInteger('usuario_id')->nullable();
            $table->unsignedInteger('sucursal_id')->nullable();
            $table->string('accion', 100);           // 'crear_venta', 'ajuste_precio', 'login', etc.
            $table->string('tabla_afectada', 60)->nullable();
            $table->unsignedInteger('registro_id')->nullable();  // ID del registro afectado
            $table->json('datos_anteriores')->nullable();        // snapshot antes del cambio
            $table->json('datos_nuevos')->nullable();            // snapshot después del cambio
            $table->string('ip_address', 45)->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('usuario_id', 'fk_audit_usuario')
                  ->references('id_usuario')->on('usuarios')
                  ->onDelete('set null');

            $table->foreign('sucursal_id', 'fk_audit_sucursal')
                  ->references('id_sucursal')->on('sucursales')
                  ->onDelete('set null');

            // Índice de rendimiento
            $table->index(['usuario_id', 'created_at'], 'idx_auditoria_usuario');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('auditoria_logs');
    }
};
