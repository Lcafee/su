<?php

declare(strict_types=1);

// Copy this outside the public document root, replace every placeholder, and
// expose its absolute path to PHP as LCAFE_PRIVATE_CONFIG. Never commit the
// resulting file.
return [
    'database' => [
        'dsn' => 'mysql:host=127.0.0.1;dbname=__REPLACE_DATABASE__;charset=utf8mb4',
        'username' => '__REPLACE_DATABASE_USER__',
        'password' => '__REPLACE_DATABASE_PASSWORD__',
    ],
    'paths' => [
        // Private, persistent, and outside the web root.
        'session_dir' => '/home/__REPLACE_ACCOUNT__/private/lcafe/sessions',
        'snapshot_archive_dir' => '/home/__REPLACE_ACCOUNT__/private/lcafe/menu-revisions',
        'media_original_dir' => '/home/__REPLACE_ACCOUNT__/private/lcafe/media-originals',

        // Public, persistent directories in the site's document root. They are
        // deliberately absent from release/current and are never pruned by deploy.py.
        'snapshot_public_dir' => '/home/__REPLACE_ACCOUNT__/l-cafe.ir/managed-menu',
        'media_public_dir' => '/home/__REPLACE_ACCOUNT__/l-cafe.ir/managed-media',
    ],
    'urls' => [
        'media' => '/managed-media',
    ],
    'security' => [
        'allowed_origin' => 'https://l-cafe.ir',
        'session_name' => 'lcafe_admin',
        'idle_timeout_seconds' => 1800,
        'absolute_timeout_seconds' => 28800,
        'max_login_failures' => 5,
        'login_lock_seconds' => 900,
    ],
    'uploads' => [
        'max_bytes' => 8 * 1024 * 1024,
        'max_pixels' => 20_000_000,
        'rendition_sizes' => [300, 600],
        'webp_quality' => 82,
    ],
];
