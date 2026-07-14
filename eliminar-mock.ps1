# Ejecutar desde: C:\xampp\htdocs\proyecto-ventas\frontend
# Elimina el mock de datos: ya ninguna vista lo usa (las 12 que faltaban
# quedaron migradas a la API real). BackupsView y ReportesView ya estaban
# conectadas desde antes.

$archivo = "src\mocks\seedData.js"

if (Test-Path $archivo) {
    Remove-Item $archivo -Force
    Write-Host "Eliminado: $archivo" -ForegroundColor Green
} else {
    Write-Host "No encontrado (ya estaba eliminado): $archivo" -ForegroundColor Yellow
}

# La carpeta mocks/ queda vacia; si prefieres borrarla tambien:
# Remove-Item "src\mocks" -Force -Recurse

Write-Host ""
Write-Host "Listo. El frontend ya no depende de datos simulados." -ForegroundColor Cyan
