<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('facturas', function (Blueprint $table) {
            $table->unsignedInteger('id_factura')->autoIncrement()->primary();
            $table->unsignedInteger('venta_id')->unique();
            $table->unsignedInteger('sucursal_id');
            $table->string('numero_factura', 30);            // ej: 'SUC01-000123'
            $table->unsignedInteger('cajero_id');
            $table->decimal('total', 10, 2);
            $table->string('pdf_ruta', 500)->nullable();     // ruta del PDF generado
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('venta_id', 'fk_factura_venta')
                  ->references('id_venta')->on('ventas');

            $table->foreign('sucursal_id', 'fk_factura_sucursal')
                  ->references('id_sucursal')->on('sucursales');

            $table->foreign('cajero_id', 'fk_factura_cajero')
                  ->references('id_usuario')->on('usuarios');

            // Número de factura único por sucursal
            $table->unique(['sucursal_id', 'numero_factura'], 'uq_factura_numero');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('facturas');
    }
};
