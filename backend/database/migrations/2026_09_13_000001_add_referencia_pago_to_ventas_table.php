<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Agrega 'referencia_pago' a ventas — nullable a propósito: la exigencia
 * de llenarlo vive en el frontend (ComprobanteModal, solo para métodos
 * que ya piden comprobante), no en la base de datos. Así, ventas
 * antiguas, otros métodos de pago (efectivo), o cualquier otro camino
 * que cree una venta sin pasar por ese modal específico, no se rompen
 * por una columna NOT NULL que no les aplica.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('ventas', function (Blueprint $table) {
            $table->string('referencia_pago', 100)->nullable()->after('metodo_pago_id');
        });
    }

    public function down(): void
    {
        Schema::table('ventas', function (Blueprint $table) {
            $table->dropColumn('referencia_pago');
        });
    }
};
