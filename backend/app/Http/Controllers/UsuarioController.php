<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\FiltraPorSucursal;
use App\Http\Requests\StoreUsuarioRequest;
use App\Http\Requests\UpdateUsuarioRequest;
use App\Models\Usuario;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UsuarioController extends Controller
{
    // FiltraPorSucursal se mantiene solo para aplicarFiltroSucursal(),
    // resolverSucursalId() y registrarAuditoria(). La autorización de
    // un recurso puntual la resuelve UsuarioPolicy.
    use FiltraPorSucursal;

    public function __construct()
    {
        $this->authorizeResource(Usuario::class, 'usuario');
    }

    public function index(Request $request): JsonResponse
    {
        $query = Usuario::query()->with(['sucursal', 'rol']);

        $this->aplicarFiltroSucursal($query);

        if ($request->filled('rol_id')) {
            $query->where('rol_id', $request->integer('rol_id'));
        }

        if ($request->boolean('solo_activos')) {
            $query->where('activo', true);
        }

        $usuarios = $query->orderBy('nombre')->paginate($request->integer('per_page', 15));

        return response()->json($usuarios);
    }

    public function store(StoreUsuarioRequest $request): JsonResponse
    {
        // Autorización de 'create' ya resuelta por authorizeResource().
        $datos = $request->validated();
        $datos['sucursal_id'] = $this->resolverSucursalId($datos['sucursal_id'] ?? null);
        $datos['password_hash'] = Hash::make($datos['password']);
        unset($datos['password']);

        $usuario = Usuario::create($datos);

        $this->registrarAuditoria('crear_usuario', 'usuarios', $usuario->id_usuario, null, $usuario->toArray());

        return response()->json($usuario->load(['sucursal', 'rol']), 201);
    }

    public function show(Usuario $usuario): JsonResponse
    {
        // Autorización de 'view' ya resuelta por authorizeResource().
        return response()->json($usuario->load(['sucursal', 'rol']));
    }

    public function update(UpdateUsuarioRequest $request, Usuario $usuario): JsonResponse
    {
        // Autorización de 'update' ya resuelta por authorizeResource().
        $datos = $request->validated();

        if (array_key_exists('sucursal_id', $datos)) {
            $datos['sucursal_id'] = $this->resolverSucursalId($datos['sucursal_id']);
        }

        if (!empty($datos['password'])) {
            $datos['password_hash'] = Hash::make($datos['password']);
        }
        unset($datos['password']);

        $anteriores = $usuario->toArray();
        $usuario->update($datos);

        $this->registrarAuditoria('editar_usuario', 'usuarios', $usuario->id_usuario, $anteriores, $usuario->toArray());

        return response()->json($usuario->load(['sucursal', 'rol']));
    }

    public function destroy(Usuario $usuario): JsonResponse
    {
        // Autorización de 'delete' ya resuelta por authorizeResource()
        // (incluye la regla de "no puedes eliminarte a ti mismo").
        if ($usuario->ventas()->exists()) {
            return response()->json([
                'message' => 'No se puede eliminar el usuario porque tiene ventas registradas. Desactívalo en su lugar.',
            ], 409);
        }

        $usuario->delete();

        $this->registrarAuditoria('eliminar_usuario', 'usuarios', $usuario->id_usuario);

        return response()->json(null, 204);
    }
}
