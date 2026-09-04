"""Safe split-ownership helpers for the production root .htaccess file."""

HOST_RUNTIME_BEGIN = b"# LCAFE-HOST-RUNTIME-BEGIN"
HOST_RUNTIME_END = b"# LCAFE-HOST-RUNTIME-END"
STAGING_DENY_MARKER = b"LCAFE-DEPLOY-STAGING-DENY"


class HtaccessOwnershipError(ValueError):
    """Raised before mutation when a split-ownership boundary is unsafe."""


def validate_release_payload(payload):
    """Return a release-owned payload after rejecting host-owned content."""
    if HOST_RUNTIME_BEGIN in payload or HOST_RUNTIME_END in payload:
        raise HtaccessOwnershipError(
            "approved release .htaccess contains host-runtime ownership markers"
        )
    if b"php_value auto_prepend_file" in payload:
        raise HtaccessOwnershipError(
            "approved release .htaccess contains a host-only runtime override"
        )
    if STAGING_DENY_MARKER not in payload:
        raise HtaccessOwnershipError(
            "approved release .htaccess is missing the staging deny rule"
        )
    return payload


def split_host_runtime_block(payload):
    """Return normalized app bytes and the exact opaque final host suffix."""
    if payload is None:
        raise HtaccessOwnershipError(
            "live .htaccess is missing; install the host runtime block first"
        )

    lines = payload.splitlines(keepends=True)
    begin = [
        index
        for index, line in enumerate(lines)
        if line.rstrip(b"\r\n") == HOST_RUNTIME_BEGIN
    ]
    end = [
        index
        for index, line in enumerate(lines)
        if line.rstrip(b"\r\n") == HOST_RUNTIME_END
    ]
    if len(begin) != 1 or len(end) != 1:
        raise HtaccessOwnershipError(
            "live .htaccess must contain exactly one fenced host runtime block; "
            "nothing was changed"
        )

    start, finish = begin[0], end[0]
    if finish <= start:
        raise HtaccessOwnershipError(
            "live .htaccess host runtime markers are out of order; nothing was changed"
        )
    if b"".join(lines[finish + 1 :]).strip():
        raise HtaccessOwnershipError(
            "live .htaccess has content after the host runtime block; nothing was changed"
        )

    raw_code_owned = b"".join(lines[:start])
    newline = b"\r\n" if b"\r\n" in raw_code_owned else b"\n"
    code_owned = raw_code_owned.rstrip(b"\r\n") + newline
    # The entire suffix is host-owned. Preserve its line endings and any final
    # whitespace byte-for-byte instead of normalizing it during composition.
    host_owned = b"".join(lines[start:])
    return code_owned, host_owned


def compose_htaccess(code_owned, host_owned):
    """Compose release rules with an already-validated opaque host suffix."""
    validate_release_payload(code_owned)
    if not host_owned.startswith(HOST_RUNTIME_BEGIN):
        raise HtaccessOwnershipError("host runtime block is not a validated suffix")
    newline = b"\r\n" if b"\r\n" in code_owned else b"\n"
    return code_owned.rstrip(b"\r\n") + newline + newline + host_owned
