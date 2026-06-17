<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('metodos_pago', function (Blueprint $table) {
            $table->unsignedInteger('id_metodo_pago')->autoIncrement()->primary();
            $table->string('nombre', 60)->unique();    // 'Transferencia bancaria', 'Efectivo'
            $table->boolean('es_default')->default(false);   // solo uno puede ser true
            $table->boolean('requiere_comp')->default(false); // ¿requiere comprobante?
            $table->boolean('activo')->default(true);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('metodos_pago');
    }
};
