<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Ruta al binario mysqldump
    |--------------------------------------------------------------------------
    | En XAMPP (Windows) no está en el PATH del sistema por defecto, así que
    | se referencia explícitamente. Ajusta MYSQLDUMP_PATH en tu .env si tu
    | instalación de XAMPP está en otra unidad/carpeta.
    */
    'mysqldump_path' => env('MYSQLDUMP_PATH', 'C:\\xampp\\mysql\\bin\\mysqldump.exe'),

    /*
    |--------------------------------------------------------------------------
    | Disco de almacenamiento
    |--------------------------------------------------------------------------
    | 'local' apunta a storage/app (privado, NO storage/app/public). Nunca
    | tiene URL pública directa: la única forma de obtener el archivo es
    | vía BackupController::download(), que exige el Gate 'gestionar-backups'.
    */
    'disk' => env('BACKUP_DISK', 'local'),
    'directory' => 'backups',

    /*
    |--------------------------------------------------------------------------
    | Retención
    |--------------------------------------------------------------------------
    | Backups con más de este número de días se borran automáticamente
    | cada vez que se genera uno nuevo. Definí 30 días como valor por
    | defecto razonable para un POS de cafetería; ajústalo a tu criterio
    | en el .env sin tocar código.
    */
    'retention_days' => env('BACKUP_RETENTION_DAYS', 30),
];