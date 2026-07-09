<?php

namespace App\Http\Controllers;

use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Routing\ControllerMiddlewareOptions;


/**
 * Laravel 11+ eliminó $this->middleware() del Controller base (lo
 * reemplazó por la interfaz HasMiddleware con un método estático). Pero
 * AuthorizesRequests::authorizeResource() -que usan los 14 controladores
 * de este proyecto para registrar el middleware 'can:...' de cada acción-
 * TODAVÍA depende del método de instancia middleware()/getMiddleware()
 * al estilo Laravel 10. Sin este shim, authorizeResource() truena con
 * "Call to undefined method middleware()" apenas se le hace una petición
 * real (ver VentaController).
 */
abstract class Controller 
{
    use AuthorizesRequests;

    protected array $middleware = [];

    public function middleware($middleware, array $options = []): ControllerMiddlewareOptions
    {
        foreach ((array) $middleware as $m) {
            $this->middleware[] = [
                'middleware' => $m,
                'options' => &$options,
            ];
        }

        return new ControllerMiddlewareOptions($options);
    }

    public function getMiddleware(): array
    {
        return $this->middleware;
    }
}