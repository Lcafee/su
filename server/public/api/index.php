<?php

declare(strict_types=1);

use LCafe\Admin\ApiException;

$release = '__LCAFE_API_RELEASE__';
$appDirectory = str_contains($release, '__LCAFE_')
    ? dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'app'
    : __DIR__ . DIRECTORY_SEPARATOR . '_app' . DIRECTORY_SEPARATOR . $release;

require $appDirectory . DIRECTORY_SEPARATOR . 'Http.php';
require $appDirectory . DIRECTORY_SEPARATOR . 'Bootstrap.php';
require $appDirectory . DIRECTORY_SEPARATOR . 'Auth.php';
require $appDirectory . DIRECTORY_SEPARATOR . 'SnapshotPublisher.php';
require $appDirectory . DIRECTORY_SEPARATOR . 'MenuRepository.php';
require $appDirectory . DIRECTORY_SEPARATOR . 'MediaService.php';

try {
    $config = LCafe\Admin\load_private_config();
    LCafe\Admin\start_admin_session($config);
    $pdo = LCafe\Admin\connect_database($config);
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    $route = LCafe\Admin\request_route();

    if ($method === 'GET' && $route === '/session') {
        LCafe\Admin\json_response(LCafe\Admin\session_payload($pdo, $config));
    }
    if ($method === 'POST' && $route === '/session/login') {
        LCafe\Admin\json_response(LCafe\Admin\login($pdo, $config, LCafe\Admin\json_input(32_768)));
    }
    if ($method === 'DELETE' && $route === '/session') {
        LCafe\Admin\require_user($pdo, $config);
        LCafe\Admin\logout($config);
        LCafe\Admin\json_response(['authenticated' => false]);
    }
    if ($method === 'GET' && $route === '/admin/menu') {
        LCafe\Admin\require_user($pdo, $config);
        LCafe\Admin\json_response(LCafe\Admin\load_menu_document($pdo, $config));
    }
    if ($method === 'PUT' && $route === '/admin/menu') {
        $user = LCafe\Admin\require_user($pdo, $config);
        LCafe\Admin\require_csrf($config);
        $result = LCafe\Admin\save_menu_document(
            $pdo,
            $config,
            $user,
            LCafe\Admin\json_input(2_097_152)
        );
        LCafe\Admin\json_response($result, $result['published'] ? 200 : 202);
    }
    if ($method === 'POST' && $route === '/admin/media') {
        LCafe\Admin\require_user($pdo, $config);
        LCafe\Admin\require_csrf($config);
        LCafe\Admin\json_response(['media' => LCafe\Admin\upload_media($pdo, $config)], 201);
    }
    if ($method === 'GET' && $route === '/admin/publish-status') {
        LCafe\Admin\require_user($pdo, $config);
        LCafe\Admin\json_response(LCafe\Admin\publish_status($pdo));
    }
    if ($method === 'POST' && $route === '/admin/publish-retry') {
        $user = LCafe\Admin\require_user($pdo, $config);
        LCafe\Admin\require_owner($user);
        LCafe\Admin\require_csrf($config);
        LCafe\Admin\json_response(LCafe\Admin\retry_snapshot_publish($pdo, $config));
    }

    throw new ApiException(404, 'not_found', 'The API route does not exist.');
} catch (ApiException $exception) {
    LCafe\Admin\json_response([
        'error' => [
            'type' => $exception->errorName,
            'message' => $exception->getMessage(),
            'details' => $exception->details,
        ],
    ], $exception->status);
} catch (Throwable $exception) {
    $requestId = bin2hex(random_bytes(8));
    error_log("L Cafe admin request $requestId failed: " . $exception->getMessage());
    LCafe\Admin\json_response([
        'error' => [
            'type' => 'internal_error',
            'message' => 'The request could not be completed.',
            'requestId' => $requestId,
        ],
    ], 500);
}
