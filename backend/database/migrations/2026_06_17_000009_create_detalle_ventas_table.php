<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('detalle_ventas', function (Blueprint $table) {
            $table->unsignedInteger('id_detalle_venta')->autoIncrement()->primary();
            $table->unsignedInteger('venta_id');
            $table->unsignedInteger('producto_id');
            $table->unsignedInteger('cantidad')->default(1);
            $table->decimal('precio_base_snapshot', 10, 2);   // precio base al momento de la venta (histórico)
            $table->decimal('precio_unitario_venta', 10, 2);  // precio efectivo cobrado (puede tener ajuste)
            $table->boolean('ajuste_precio')->default(false);  // true = fue modificado manualmente
            $table->text('observacion_ajuste')->nullable();    // justificación del ajuste (HU 08.3)
            // subtotal = cantidad * precio_unitario_venta  →  se calcula en PHP/Eloquent (columna generada no soportada uniformemente por todos los drivers)

            $table->foreign('venta_id', 'fk_detalle_venta')
                  ->references('id_venta')->on('ventas')
                  ->onDelete('cascade');

            $table->foreign('producto_id', 'fk_detalle_producto')
                  ->references('id_producto')->on('productos');

            // Índices de rendimiento
            $table->index('venta_id', 'idx_detalle_ventas_venta');
            $table->index('producto_id', 'idx_detalle_ventas_producto');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('detalle_ventas');
    }
};
