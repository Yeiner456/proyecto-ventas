<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
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
        //
        // SystemRoot también se pasa explícitamente: en Windows, un
        // proceso hijo lanzado con un entorno personalizado puede quedar
        // sin esta variable, y sin ella Winsock no logra inicializarse
        // (mysqldump falla con "Can't create TCP/IP socket (10106)"
        // aunque MySQL esté corriendo y las credenciales sean correctas).
        $resultado = Process::env([
            'MYSQL_PWD' => $conexion['password'] ?? '',
            'SystemRoot' => getenv('SystemRoot'),
        ])
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
     * Restaura la base de datos completa a partir de un archivo .sql
     * subido por el usuario. DESTRUCTIVO: sobrescribe todos los datos
     * actuales (el dump empieza con DROP TABLE IF EXISTS por cada tabla).
     *
     * Por eso, antes de tocar la base de datos, SIEMPRE se genera un
     * backup de seguridad del estado actual. Si ese backup de seguridad
     * falla, se aborta la restauración completa — preferimos no
     * restaurar a restaurar sin red de seguridad.
     *
     * @return array{restaurado: bool, backup_previo: string}
     */
    public function restaurar(UploadedFile $archivo): array
    {
        if (strtolower($archivo->getClientOriginalExtension()) !== 'sql') {
            throw new RuntimeException('El archivo debe tener extensión .sql.');
        }

        // Red de seguridad: si esto falla, no seguimos. Una restauración
        // sin poder deshacerla es exactamente el escenario que este
        // sistema existe para evitar.
        $backupPrevio = $this->generar();

        $connection = config('database.default');
        $conexion = config("database.connections.{$connection}");

        $rutaTemporal = $archivo->store('backups/tmp');
        $rutaAbsoluta = Storage::disk($this->disk)->path($rutaTemporal);

        $comando = [
            config('backup.mysql_path'),
            '--host=' . $conexion['host'],
            '--port=' . $conexion['port'],
            '--user=' . $conexion['username'],
            $conexion['database'],
        ];

        // Mismas dos reglas de seguridad que en generar(): la contraseña
        // viaja como variable de entorno (nunca como argumento visible),
        // y SystemRoot se pasa explícitamente para que Winsock inicialice
        // bien en Windows (mismo bug que ya resolvimos en generar()).
        $handle = fopen($rutaAbsoluta, 'r');

        try {
            $resultado = Process::env([
                'MYSQL_PWD' => $conexion['password'] ?? '',
                'SystemRoot' => getenv('SystemRoot'),
            ])
                ->input($handle)
                ->timeout(300)
                ->run($comando);
        } finally {
            if (is_resource($handle)) {
                fclose($handle);
            }
            Storage::disk($this->disk)->delete($rutaTemporal);
        }

        if (!$resultado->successful()) {
            Log::error('Fallo al restaurar backup de base de datos', [
                'exit_code' => $resultado->exitCode(),
                'error' => $resultado->errorOutput(),
                'backup_previo' => $backupPrevio['filename'],
            ]);

            throw new RuntimeException(
                "No se pudo completar la restauración. Como el archivo se ejecuta " .
                "sentencia por sentencia, es posible que la base de datos haya quedado " .
                "en un estado parcial. Se generó un backup del estado ANTERIOR al intento " .
                "de restauración: {$backupPrevio['filename']}. Restaura ese archivo para " .
                "volver al estado anterior, y revisa el log de Laravel para el detalle técnico."
            );
        }

        Log::info('Base de datos restaurada desde backup', [
            'archivo_subido' => $archivo->getClientOriginalName(),
            'backup_previo' => $backupPrevio['filename'],
        ]);

        return [
            'restaurado' => true,
            'backup_previo' => $backupPrevio['filename'],
        ];
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
