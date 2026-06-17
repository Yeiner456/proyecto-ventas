<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('productos', function (Blueprint $table) {
            $table->unsignedInteger('id_producto')->autoIncrement()->primary();
            $table->unsignedInteger('sucursal_id');
            $table->unsignedInteger('categoria_id')->nullable();
            $table->string('nombre', 120);
            $table->text('descripcion')->nullable();
            $table->decimal('precio_base', 10, 2);
            $table->string('imagen_ruta', 500)->nullable();  // ej: 'productos/uuid.jpg'
            $table->boolean('maneja_stock')->default(false); // false = elaborado, true = con inventario
            $table->unsignedInteger('stock_minimo')->default(0); // umbral de alerta
            $table->boolean('activo')->default(true);
            $table->timestamps();

            $table->foreign('sucursal_id', 'fk_prod_sucursal')
                  ->references('id_sucursal')->on('sucursales')
                  ->onDelete('cascade');

            $table->foreign('categoria_id', 'fk_prod_categoria')
                  ->references('id_categoria')->on('categorias_productos')
                  ->onDelete('set null');

            // Índice de rendimiento
            $table->index(['sucursal_id', 'activo'], 'idx_productos_sucursal');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('productos');
    }
};
