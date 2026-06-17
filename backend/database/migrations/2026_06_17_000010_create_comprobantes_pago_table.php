<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('comprobantes_pago', function (Blueprint $table) {
            $table->unsignedInteger('id_comprobante')->autoIncrement()->primary();
            $table->unsignedInteger('venta_id');
            $table->unsignedInteger('subido_por');           // usuario que adjuntó el comprobante
            $table->string('archivo_ruta', 500);             // ej: 'comprobantes/uuid.jpg'
            $table->string('tipo_archivo', 20)->nullable();  // 'image/jpeg', 'image/png', etc.
            $table->timestamp('created_at')->useCurrent();

            $table->foreign('venta_id', 'fk_comp_venta')
                  ->references('id_venta')->on('ventas')
                  ->onDelete('cascade');

            $table->foreign('subido_por', 'fk_comp_usuario')
                  ->references('id_usuario')->on('usuarios');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comprobantes_pago');
    }
};
