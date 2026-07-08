<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Ruta al binario mysqldump
    |--------------------------------------------------------------------------
    | En XAMPP (Windows) no está en el PATH del sistema por defecto, así que
    | se referencia explícitamente. Ajusta MYSQLDUMP_PATH en tu .env si tu
    | instalación de XAMPP está en otra unidad/carpeta.
    |
    | IMPORTANTE: en el .env, escribe la ruta con "/" (forward slash), NO
    | con "\": ej. C:/xampp/mysql/bin/mysqldump.exe. phpdotenv interpreta
    | "\" dentro de valores con comillas dobles como inicio de secuencia de
    | escape (igual que PHP), y "\x" no es una secuencia válida — esto
    | rompe el parseo de TODO el archivo .env, no solo de esta línea.
    | Windows acepta "/" como separador de ruta sin ningún problema.
    */
    'mysqldump_path' => env('MYSQLDUMP_PATH', 'C:\\xampp\\mysql\\bin\\mysqldump.exe'),

    /*
    |--------------------------------------------------------------------------
    | Ruta al binario mysql (cliente de línea de comandos, para restaurar)
    |--------------------------------------------------------------------------
    | Mismo binario que mysqldump pero sin el sufijo "dump" — normalmente
    | vive en la misma carpeta. Aplican las mismas reglas de escape que
    | MYSQLDUMP_PATH: usa "/" en el .env, nunca "\".
    */
    'mysql_path' => env('MYSQL_PATH', 'C:\\xampp\\mysql\\bin\\mysql.exe'),

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
    | cada vez que se genera uno nuevo. 30 días es un valor por defecto
    | razonable para un POS de cafetería; ajústalo en el .env sin tocar
    | código.
    */
    'retention_days' => env('BACKUP_RETENTION_DAYS', 30),
];
