# Ejecutar desde: C:\xampp\htdocs\proyecto-ventas\backend
# Elimina los seeders obsoletos, reemplazados por la migracion de datos
# 2026_07_10_000001_seed_datos_iniciales.php

$seeders = @(
    "database\seeders\RolSeeder.php",
    "database\seeders\SucursalSeeder.php",
    "database\seeders\UsuarioSeeder.php",
    "database\seeders\MetodoPagoSeeder.php",
    "database\seeders\CategoriaProductoSeeder.php",
    "database\seeders\ProductoSeeder.php",
    "database\seeders\DemoVentaSeeder.php",
    "database\seeders\DatabaseSeeder.php"
)

foreach ($archivo in $seeders) {
    if (Test-Path $archivo) {
        Remove-Item $archivo -Force
        Write-Host "Eliminado: $archivo" -ForegroundColor Green
    } else {
        Write-Host "No encontrado (ya estaba eliminado): $archivo" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "Listo. Ahora corre 'php artisan migrate:fresh' para reconstruir la base de datos." -ForegroundColor Cyan
