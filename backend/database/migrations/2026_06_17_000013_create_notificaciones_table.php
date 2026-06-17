<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('notificaciones', function (Blueprint $table) {
            $table->unsignedInteger('id_notificacion')->autoIncrement()->primary();
            $table->unsignedInteger('sucursal_id');
            $table->unsignedInteger('usuario_id')->nullable(); // NULL = para todos los admins de la sucursal
            $table->string('tipo', 50);                        // 'stock_bajo', 'venta_cancelada', etc.
            $table->text('mensaje');
            $table->boolean('leida')->default(false);
            $table->unsignedInteger('referencia_id')->nullable();   // ID del objeto relacionado
            $table->string('referencia_tipo', 50)->nullable();      // 'producto', 'venta'
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('sucursal_id', 'fk_notif_sucursal')
                  ->references('id_sucursal')->on('sucursales')
                  ->onDelete('cascade');

            $table->foreign('usuario_id', 'fk_notif_usuario')
                  ->references('id_usuario')->on('usuarios')
                  ->onDelete('set null');

            // Índice de rendimiento
            $table->index(['sucursal_id', 'leida'], 'idx_notificaciones_sucursal');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('notificaciones');
    }
};
