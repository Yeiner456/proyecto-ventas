<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('inventario', function (Blueprint $table) {
            $table->unsignedInteger('id_inventario')->autoIncrement()->primary();
            $table->unsignedInteger('producto_id')->unique(); // relación 1-a-1 con producto
            $table->integer('cantidad')->default(0);
            $table->timestamp('updated_at')->useCurrent()->useCurrentOnUpdate();

            $table->foreign('producto_id', 'fk_inv_producto')
                  ->references('id_producto')->on('productos')
                  ->onDelete('cascade');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('inventario');
    }
};
