import unittest

from htaccess_ownership import (
    HtaccessOwnershipError,
    compose_htaccess,
    split_host_runtime_block,
    validate_release_payload,
)


APP = b"# app\n# LCAFE-DEPLOY-STAGING-DENY\n"
HOST = (
    b"# LCAFE-HOST-RUNTIME-BEGIN\r\n"
    b"opaque host bytes\r\n"
    b"# LCAFE-HOST-RUNTIME-END\r\n\r\n"
)


class HtaccessOwnershipTests(unittest.TestCase):
    def test_merge_preserves_complete_host_suffix_byte_for_byte(self):
        previous = b"# old app\n\n" + HOST
        _, host = split_host_runtime_block(previous)
        merged = compose_htaccess(APP, host)

        code, merged_host = split_host_runtime_block(merged)
        self.assertEqual(code, APP)
        self.assertEqual(merged_host, HOST)

    def test_merge_preserves_release_crlf_and_host_suffix_bytes(self):
        app = APP.replace(b"\n", b"\r\n")
        merged = compose_htaccess(app, HOST)

        code, merged_host = split_host_runtime_block(merged)
        self.assertEqual(code, app)
        self.assertEqual(merged_host, HOST)

    def test_rejects_duplicate_or_nonfinal_host_block(self):
        with self.assertRaises(HtaccessOwnershipError):
            split_host_runtime_block(HOST + HOST)
        with self.assertRaises(HtaccessOwnershipError):
            split_host_runtime_block(HOST + b"RewriteRule unsafe\n")

    def test_rejects_host_content_in_release_rules(self):
        with self.assertRaises(HtaccessOwnershipError):
            validate_release_payload(APP + b"# LCAFE-HOST-RUNTIME-BEGIN\n")
        with self.assertRaises(HtaccessOwnershipError):
            validate_release_payload(APP + b"php_value auto_prepend_file /private\n")

    def test_rejects_missing_release_staging_protection(self):
        with self.assertRaises(HtaccessOwnershipError):
            validate_release_payload(b"# app only\n")


if __name__ == "__main__":
    unittest.main()
