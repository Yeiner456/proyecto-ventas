<?php

namespace App\Services;

use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Process;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

/**
 * Única fuente de verdad para generar, listar y depurar backups de la
 * base de datos. Ningún controlador debe construir el comando de
 * mysqldump directamente.
 */
class BackupService
{
    protected string $disk;
    protected string $directory;

    public function __construct()
    {
        $this->disk = config('backup.disk');
        $this->directory = config('backup.directory');
    }

    /**
     * Genera un nuevo dump de la conexión activa (database.default),
     * lo guarda en disco y aplica la política de retención.
     *
     * @return array{filename: string, size: int, created_at: string}
     */
    public function generar(): array
    {
        $connection = config('database.default');
        $conexion = config("database.connections.{$connection}");

        $filename = sprintf(
            'backup_%s_%s.sql',
            $conexion['database'],
            now()->format('Y-m-d_His')
        );

        Storage::disk($this->disk)->makeDirectory($this->directory);

        $comando = [
            config('backup.mysqldump_path'),
            '--host=' . $conexion['host'],
            '--port=' . $conexion['port'],
            '--user=' . $conexion['username'],
            '--single-transaction', // snapshot consistente en InnoDB sin bloquear tablas
            '--routines',
            '--triggers',
            '--no-tablespaces',     // evita el error de privilegio PROCESS típico en XAMPP
            $conexion['database'],
        ];

        // La contraseña NUNCA va como argumento de línea de comandos:
        // quedaría visible para cualquier otro proceso del sistema
        // (ej. `Get-Process` o el Administrador de tareas en Windows
        // pueden listar los argumentos de un proceso en ejecución).
        // MYSQL_PWD como variable de entorno del subproceso es la forma
        // segura de pasarla.
        $resultado = Process::env(['MYSQL_PWD' => $conexion['password'] ?? ''])
            ->timeout(300)
            ->run($comando);

        if (!$resultado->successful()) {
            Log::error('Fallo al generar backup de base de datos', [
                'exit_code' => $resultado->exitCode(),
                'error' => $resultado->errorOutput(),
            ]);

            throw new RuntimeException(
                'No se pudo generar el backup. Revisa el log de Laravel para el detalle técnico.'
            );
        }

        Storage::disk($this->disk)->put("{$this->directory}/{$filename}", $resultado->output());

        $eliminados = $this->aplicarRetencion();

        Log::info('Backup de base de datos generado', [
            'filename' => $filename,
            'eliminados_por_retencion' => $eliminados,
        ]);

        return [
            'filename' => $filename,
            'size' => Storage::disk($this->disk)->size("{$this->directory}/{$filename}"),
            'created_at' => now()->toIso8601String(),
        ];
    }

    /**
     * Lista los backups existentes, más reciente primero.
     *
     * @return array<int, array{filename: string, size: int, created_at: Carbon}>
     */
    public function listar(): array
    {
        $archivos = Storage::disk($this->disk)->files($this->directory);

        return collect($archivos)
            ->map(fn ($ruta) => [
                'filename' => basename($ruta),
                'size' => Storage::disk($this->disk)->size($ruta),
                'created_at' => Carbon::createFromTimestamp(
                    Storage::disk($this->disk)->lastModified($ruta)
                ),
            ])
            ->sortByDesc('created_at')
            ->values()
            ->all();
    }

    /**
     * Borra los backups más viejos que backup.retention_days.
     * Devuelve cuántos se eliminaron (útil para el log).
     */
    public function aplicarRetencion(): int
    {
        $limite = now()->subDays((int) config('backup.retention_days'));
        $eliminados = 0;

        foreach ($this->listar() as $backup) {
            if ($backup['created_at']->lt($limite)) {
                Storage::disk($this->disk)->delete("{$this->directory}/{$backup['filename']}");
                $eliminados++;
            }
        }

        return $eliminados;
    }

    /**
     * Resuelve la ruta absoluta de un backup para descarga, validando
     * el nombre de archivo estrictamente para evitar path traversal
     * (ej. alguien mandando "../../.env" como filename en la URL).
     */
    public function rutaParaDescarga(string $filename): string
    {
        $filename = basename($filename);

        if (!preg_match('/^backup_[\w\-]+_\d{4}-\d{2}-\d{2}_\d{6}\.sql$/', $filename)) {
            throw new RuntimeException('Nombre de archivo de backup inválido.');
        }

        $ruta = "{$this->directory}/{$filename}";

        if (!Storage::disk($this->disk)->exists($ruta)) {
            throw new RuntimeException('El backup solicitado no existe.');
        }

        return Storage::disk($this->disk)->path($ruta);
    }
}