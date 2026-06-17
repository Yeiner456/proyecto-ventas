<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('categorias_productos', function (Blueprint $table) {
            $table->unsignedInteger('id_categoria')->autoIncrement()->primary();
            $table->unsignedInteger('sucursal_id');
            $table->string('nombre', 80);
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('sucursal_id', 'fk_cat_sucursal')
                  ->references('id_sucursal')->on('sucursales')
                  ->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('categorias_productos');
    }
};
