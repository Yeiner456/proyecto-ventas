<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('movimientos_inventario', function (Blueprint $table) {
            $table->unsignedInteger('id_movimiento')->autoIncrement()->primary();
            $table->unsignedInteger('producto_id');
            $table->unsignedInteger('usuario_id');           // quién realizó el movimiento
            $table->unsignedInteger('venta_id')->nullable(); // referencia a venta si aplica
            $table->enum('tipo', ['entrada', 'salida', 'ajuste']);
            $table->integer('cantidad');                     // positivo=entrada, negativo=salida/ajuste
            $table->integer('stock_antes');
            $table->integer('stock_despues');
            $table->text('observacion')->nullable();
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('producto_id', 'fk_movinv_producto')
                  ->references('id_producto')->on('productos');

            $table->foreign('usuario_id', 'fk_movinv_usuario')
                  ->references('id_usuario')->on('usuarios');

            $table->foreign('venta_id', 'fk_movinv_venta')
                  ->references('id_venta')->on('ventas')
                  ->onDelete('set null');

            // Índice de rendimiento
            $table->index(['producto_id', 'created_at'], 'idx_movimientos_producto');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('movimientos_inventario');
    }
};
