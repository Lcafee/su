<?php

declare(strict_types=1);

namespace LCafe\Admin;

use JsonException;
use RuntimeException;

final class ApiException extends RuntimeException
{
    /** @var array<string, mixed> */
    public array $details;
    public string $errorName;
    public int $status;

    /** @param array<string, mixed> $details */
    public function __construct(int $status, string $errorName, string $message, array $details = [])
    {
        parent::__construct($message);
        $this->status = $status;
        $this->errorName = $errorName;
        $this->details = $details;
    }
}

/** @param array<string, mixed> $payload */
function json_response(array $payload, int $status = 200): never
{
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: private, no-store');
    header('Pragma: no-cache');
    header('X-Content-Type-Options: nosniff');
    echo json_encode(
        $payload,
        JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR
    );
    exit;
}

/** @return array<string, mixed> */
function json_input(int $maxBytes = 1_048_576): array
{
    $length = isset($_SERVER['CONTENT_LENGTH']) ? (int) $_SERVER['CONTENT_LENGTH'] : 0;
    if ($length > $maxBytes) {
        throw new ApiException(413, 'payload_too_large', 'The request body is too large.');
    }

    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        throw new ApiException(400, 'invalid_json', 'A JSON request body is required.');
    }
    if (strlen($raw) > $maxBytes) {
        throw new ApiException(413, 'payload_too_large', 'The request body is too large.');
    }

    try {
        $value = json_decode($raw, true, 64, JSON_THROW_ON_ERROR);
    } catch (JsonException) {
        throw new ApiException(400, 'invalid_json', 'The request body is not valid JSON.');
    }
    if (!is_array($value) || array_is_list($value)) {
        throw new ApiException(400, 'invalid_json', 'The JSON root must be an object.');
    }
    return $value;
}

function request_route(): string
{
    $uri = (string) ($_SERVER['REQUEST_URI'] ?? '/');
    $path = parse_url($uri, PHP_URL_PATH);
    if (!is_string($path)) {
        return '/';
    }
    if ($path === '/api') {
        return '/';
    }
    if (str_starts_with($path, '/api/')) {
        $path = substr($path, 4);
    }
    $path = '/' . ltrim($path, '/');
    return $path !== '/' ? rtrim($path, '/') : '/';
}

/** @param array<string, mixed> $config */
function require_allowed_origin(array $config): void
{
    $actual = (string) ($_SERVER['HTTP_ORIGIN'] ?? '');
    $expected = (string) $config['security']['allowed_origin'];
    if ($actual === '' || !hash_equals($expected, $actual)) {
        throw new ApiException(403, 'origin_rejected', 'The request origin is not allowed.');
    }
}

function uuid_v4(): string
{
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    $hex = bin2hex($bytes);
    return sprintf(
        '%s-%s-%s-%s-%s',
        substr($hex, 0, 8),
        substr($hex, 8, 4),
        substr($hex, 12, 4),
        substr($hex, 16, 4),
        substr($hex, 20, 12)
    );
}

function is_uuid(string $value): bool
{
    return preg_match(
        '/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i',
        $value
    ) === 1;
}

function text_length(string $value): int
{
    return function_exists('mb_strlen') ? mb_strlen($value, 'UTF-8') : strlen($value);
}

function required_text(mixed $value, string $field, int $maxLength): string
{
    if (!is_string($value)) {
        throw new ApiException(422, 'validation_error', "$field must be text.", ['field' => $field]);
    }
    $value = trim($value);
    if ($value === '' || text_length($value) > $maxLength) {
        throw new ApiException(
            422,
            'validation_error',
            "$field must contain between 1 and $maxLength characters.",
            ['field' => $field]
        );
    }
    return $value;
}

function optional_text(mixed $value, string $field, int $maxLength): ?string
{
    if ($value === null || $value === '') {
        return null;
    }
    if (!is_string($value) || text_length($value) > $maxLength) {
        throw new ApiException(
            422,
            'validation_error',
            "$field must be null or at most $maxLength characters.",
            ['field' => $field]
        );
    }
    return trim($value);
}

function boolean_value(mixed $value, string $field): bool
{
    if (!is_bool($value)) {
        throw new ApiException(422, 'validation_error', "$field must be boolean.", ['field' => $field]);
    }
    return $value;
}
