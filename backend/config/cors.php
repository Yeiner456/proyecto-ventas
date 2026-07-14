<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Sin este archivo, Illuminate\Http\Middleware\HandleCors no agrega
    | ningún header CORS a las respuestas (lee 'cors.paths' con fallback
    | [] y, con la lista vacía, hasMatchingPath() nunca hace match). El
    | resultado: el navegador bloquea toda petición cross-origin del
    | frontend (Vite, otro puerto) hacia esta API (php artisan serve,
    | puerto 8000), aunque el backend responda bien — herramientas como
    | Invoke-RestMethod o Postman no se ven afectadas porque CORS es una
    | restricción exclusiva del navegador, no del servidor.
    |
    */

    'paths' => ['api/*'],

    'allowed_methods' => ['*'],

    // Proyecto de uso local, autenticación por Bearer token (no cookies),
    // así que un wildcard aquí es seguro: no hay sesión/credencial que
    // un origen malicioso pueda robar vía CORS. Si en algún momento se
    // agrega login por cookie de sesión, esto debe restringirse a la URL
    // exacta del frontend y 'supports_credentials' pasar a true.
    'allowed_origins' => ['*'],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
