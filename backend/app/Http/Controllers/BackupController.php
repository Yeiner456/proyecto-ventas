<?php

namespace App\Http\Controllers;

use App\Services\BackupService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\HttpFoundation\BinaryFileResponse;

/**
 * Gestión de backups de la base de datos.
 *
 * Es una acción de sistema sin modelo Eloquent asociado (no existe una
 * tabla 'backups'), así que la autorización no usa authorizeResource()
 * sino el Gate 'gestionar-backups' definido en AppServiceProvider
 * (solo admin_general, ver Usuario::esAdminGeneral()).
 *
 * Este controlador NUNCA construye el comando de mysqldump ni toca el
 * disco directamente: toda esa lógica vive en BackupService. Aquí solo
 * se traduce HTTP <-> servicio y se mapean las excepciones a códigos
 * de estado adecuados.
 */
class BackupController extends Controller
{
    public function __construct(protected BackupService $backupService)
    {
        // Un único Gate cubre las tres acciones (index/store/download):
        // no hay niveles distintos de acceso dentro de "gestionar backups".
        $this->authorize('gestionar-backups');
    }

    /**
     * Lista los backups existentes, más reciente primero.
     */
    public function index(): JsonResponse
    {
        $backups = collect($this->backupService->listar())
            ->map(fn (array $backup) => [
                'filename' => $backup['filename'],
                'size' => $backup['size'],
                // Se normaliza a ISO8601 (string) para que index() y
                // store() devuelvan created_at con el mismo formato;
                // BackupService::listar() lo entrega como Carbon.
                'created_at' => $backup['created_at']->toIso8601String(),
            ])
            ->all();

        return response()->json($backups);
    }

    /**
     * Genera un nuevo backup on-demand (mysqldump + retención).
     */
    public function store(): JsonResponse
    {
        try {
            $backup = $this->backupService->generar();
        } catch (RuntimeException $e) {
            // generar() ya registró el detalle técnico en el log; al
            // cliente solo le llega el mensaje pensado para mostrarse.
            return response()->json(['message' => $e->getMessage()], 500);
        }

        return response()->json($backup, 201);
    }

    /**
     * Descarga un backup existente por su nombre de archivo.
     */
    public function download(string $filename): BinaryFileResponse|JsonResponse
    {
        try {
            $ruta = $this->backupService->rutaParaDescarga($filename);
        } catch (RuntimeException $e) {
            // rutaParaDescarga() lanza el mismo tipo de excepción para dos
            // causas distintas (nombre con formato inválido vs archivo
            // inexistente); se distingue por el texto del mensaje para
            // devolver 422 o 404 en vez de un 500 genérico.
            $status = Str::contains($e->getMessage(), 'no existe') ? 404 : 422;

            return response()->json(['message' => $e->getMessage()], $status);
        }

        return response()->download($ruta, basename($ruta));
    }

    /**
     * Restaura la base de datos completa desde un archivo .sql subido.
     * DESTRUCTIVO — ver advertencias en BackupService::restaurar().
     */
    public function restaurar(Request $request): JsonResponse
    {
        $request->validate([
            // Se valida la extensión con una regla explícita en vez de
            // 'mimes:sql': el detector de MIME de Laravel no reconoce
            // ".sql" de forma confiable (puede llegar como text/plain
            // o application/sql según el sistema operativo del usuario).
            'archivo' => ['required', 'file', 'max:51200', function ($attribute, $value, $fail) {
                if (strtolower($value->getClientOriginalExtension()) !== 'sql') {
                    $fail('El archivo debe tener extensión .sql.');
                }
            }],
        ]);

        try {
            $resultado = $this->backupService->restaurar($request->file('archivo'));
        } catch (RuntimeException $e) {
            return response()->json(['message' => $e->getMessage()], 500);
        }

        return response()->json($resultado);
    }
}
