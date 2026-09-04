"""Prepare a verified split-ownership .htaccess for cPanel File Manager.

Download the live root .htaccess to a secure ignored local path, then run this
tool. It reads the approved release rules, preserves the live host-owned suffix
byte-for-byte, and writes a separate composite file for staged upload.
"""

import argparse
import os

import package
from htaccess_ownership import (
    HtaccessOwnershipError,
    compose_htaccess,
    split_host_runtime_block,
    validate_release_payload,
)


HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT_OUTPUT = os.path.join(HERE, "lcafe-merged.htaccess")


def fail(message):
    raise SystemExit("merge-htaccess: " + message)


def main():
    parser = argparse.ArgumentParser(
        description="Merge approved application rules with a downloaded live host block."
    )
    parser.add_argument(
        "--live",
        required=True,
        help="secure local copy of the current live root .htaccess",
    )
    parser.add_argument(
        "--output",
        default=DEFAULT_OUTPUT,
        help="separate composite output path (default: lcafe-merged.htaccess)",
    )
    args = parser.parse_args()

    live_path = os.path.abspath(args.live)
    output_path = os.path.abspath(args.output)
    if live_path == output_path:
        fail("refusing to overwrite the downloaded live file; choose a separate output")
    if not os.path.isfile(live_path):
        fail("downloaded live .htaccess does not exist")
    if os.path.exists(output_path):
        fail("output already exists; remove it only after confirming it is disposable")

    try:
        release = package.verify_release()
        with open(package.source_path(".htaccess"), "rb") as source:
            code_owned = validate_release_payload(source.read())
        with open(live_path, "rb") as source:
            _, host_owned = split_host_runtime_block(source.read())
        merged = compose_htaccess(code_owned, host_owned)
        merged_code, merged_host = split_host_runtime_block(merged)
    except (HtaccessOwnershipError, OSError, SystemExit) as error:
        fail(str(error))

    if merged_code != code_owned:
        fail("composite application rules did not verify; no output was written")
    if merged_host != host_owned:
        fail("host-owned runtime suffix changed; no output was written")

    try:
        with open(output_path, "xb") as output:
            output.write(merged)
    except OSError as error:
        fail("could not write composite output: %s" % error)

    print(
        "merge-htaccess: prepared %s for approved release %s; "
        "host-owned runtime suffix preserved byte-for-byte"
        % (os.path.basename(output_path), release["gitCommit"])
    )


if __name__ == "__main__":
    main()
