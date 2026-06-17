<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ventas', function (Blueprint $table) {
            $table->unsignedInteger('id_venta')->autoIncrement()->primary();
            $table->unsignedInteger('sucursal_id');
            $table->unsignedInteger('cajero_id');           // usuario que registró la venta
            $table->enum('estado', [
                'pendiente',
                'en_preparacion',
                'listo_para_entregar',
                'pagado',
                'entregado',
                'cancelado',
            ])->default('pendiente');
            $table->unsignedInteger('metodo_pago_id')->nullable(); // se asigna al cobrar
            $table->decimal('total', 10, 2)->default(0.00);
            $table->text('observacion')->nullable();        // motivo de cancelación u otras notas
            $table->timestamps();

            $table->foreign('sucursal_id', 'fk_ventas_sucursal')
                  ->references('id_sucursal')->on('sucursales');

            $table->foreign('cajero_id', 'fk_ventas_cajero')
                  ->references('id_usuario')->on('usuarios');

            $table->foreign('metodo_pago_id', 'fk_ventas_metodo_pago')
                  ->references('id_metodo_pago')->on('metodos_pago')
                  ->onDelete('set null');

            // Índices de rendimiento
            $table->index(['sucursal_id', 'estado'], 'idx_ventas_sucursal_estado');
            $table->index('created_at', 'idx_ventas_created_at');
            $table->index('cajero_id', 'idx_ventas_cajero');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ventas');
    }
};
