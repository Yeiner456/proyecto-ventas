<?php

namespace App\Http\Controllers;

use App\Http\Requests\LoginRequest;
use App\Models\Usuario;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    /**
     * Hash bcrypt válido pero de una contraseña que no le pertenece a
     * nadie. Se usa como "señuelo" cuando el id_usuario no existe, para
     * que Hash::check() tome un tiempo similar al de una verificación
     * real y así no se pueda distinguir por timing si el ID es válido.
     */
    private const DUMMY_HASH = '$2y$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

    public function login(LoginRequest $request): JsonResponse
    {
        $usuario = Usuario::with(['sucursal', 'rol'])->find($request->integer('id_usuario'));

        $hashAVerificar = $usuario?->password_hash ?? self::DUMMY_HASH;

        if (!$usuario || !Hash::check($request->string('password')->toString(), $hashAVerificar)) {
            throw ValidationException::withMessages([
                'id_usuario' => ['Las credenciales proporcionadas son incorrectas.'],
            ]);
        }

        if (!$usuario->activo) {
            throw ValidationException::withMessages([
                'id_usuario' => ['Esta cuenta está desactivada. Contacta a un administrador.'],
            ]);
        }

        // Regla multi-tenant: admin_general (sucursal_id null) no depende
        // de esto; el resto no puede operar si su sucursal fue desactivada.
        if ($usuario->sucursal_id !== null && $usuario->sucursal && !$usuario->sucursal->activa) {
            throw ValidationException::withMessages([
                'id_usuario' => ['La sucursal asociada a este usuario está desactivada.'],
            ]);
        }

        $deviceName = $request->string('device_name')->toString() ?: 'api';
        $token = $usuario->createToken($deviceName)->plainTextToken;

        return response()->json([
            'usuario' => $usuario, // ya viene con sucursal y rol cargados
            'token'   => $token,
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $request->user()?->currentAccessToken()->delete();

        return response()->json(['message' => 'Sesión cerrada correctamente.']);
    }

    public function logoutAll(Request $request): JsonResponse
    {
        $request->user()?->tokens()->delete();

        return response()->json(['message' => 'Todas las sesiones han sido cerradas.']);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json($request->user()?->load(['sucursal', 'rol']));
    }
}