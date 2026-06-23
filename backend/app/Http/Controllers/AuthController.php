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
     * Login: valida credenciales y devuelve un token de Sanctum.
     * Ese token es el que el cliente debe mandar en cada request
     * siguiente como: Authorization: Bearer {token}
     */
    public function login(LoginRequest $request): JsonResponse
    {
        $usuario = Usuario::where('email', $request->string('email')->toString())->first();

        if (!$usuario || !Hash::check($request->string('password')->toString(), $usuario->password_hash)) {
            throw ValidationException::withMessages([
                'email' => ['Las credenciales no son correctas.'],
            ]);
        }

        if (!$usuario->activo) {
            throw ValidationException::withMessages([
                'email' => ['Este usuario está desactivado. Contacta a un administrador.'],
            ]);
        }

        $nombreDispositivo = $request->string('device_name')->toString() ?: 'default';

        $token = $usuario->createToken($nombreDispositivo)->plainTextToken;

        return response()->json([
            'usuario' => $usuario->load(['sucursal', 'rol']),
            'token'   => $token,
        ]);
    }

    /**
     * Cierra sesión SOLO del dispositivo/token actual (el que se usó
     * para autenticar este request).
     */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Sesión cerrada correctamente.']);
    }

    /**
     * Cierra sesión en TODOS los dispositivos del usuario (revoca todos
     * sus tokens). Útil para "cerrar sesión en todas partes" o tras un
     * cambio de password.
     */
    public function logoutAll(Request $request): JsonResponse
    {
        $request->user()->tokens()->delete();

        return response()->json(['message' => 'Sesión cerrada en todos los dispositivos.']);
    }

    /**
     * Devuelve el usuario autenticado actual (útil para que el
     * frontend sepa quién es, su rol y su sucursal al cargar la app).
     */
    public function me(Request $request): JsonResponse
    {
        return response()->json($request->user()->load(['sucursal', 'rol']));
    }
}
