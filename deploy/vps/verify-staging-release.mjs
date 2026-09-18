import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

const root = resolve(process.argv[2] || ".");
const expectedCommit = String(process.argv[3] || "").toLowerCase();
const manifestPath = resolve(root, ".lcafe-vps-release.json");

function fail(message) {
  throw new Error(`VPS staging verify: ${message}`);
}

async function listFiles(directory, prefix = "") {
  const output = [];
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const absolute = resolve(directory, entry.name);
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    const rel = relative(root, absolute);
    if (rel === ".." || rel.startsWith(`..${sep}`)) fail("path escaped artifact root");
    if (entry.isDirectory()) output.push(...await listFiles(absolute, name));
    else if (entry.isFile()) output.push(name);
    else fail(`unsupported artifact entry: ${name}`);
  }
  return output;
}

async function sha256(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

async function main() {
  if (!/^[0-9a-f]{40}$/.test(expectedCommit)) {
    fail("expected commit must be a full 40-character SHA");
  }

  let manifest;
  try {
    manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    fail(`manifest is missing or invalid (${error.message})`);
  }

  if (manifest.version !== 1
      || manifest.project !== "lcafe-main-site"
      || manifest.repository !== "Lcafee/su"
      || manifest.gitCommit !== expectedCommit
      || !manifest.files
      || typeof manifest.files !== "object"
      || Array.isArray(manifest.files)) {
    fail("manifest identity is invalid");
  }

  const actual = (await listFiles(root)).filter(
    (name) => name !== ".lcafe-vps-release.json"
      && !name.startsWith("server-node/node_modules/"),
  );
  const expected = Object.keys(manifest.files).sort();
  actual.sort();

  if (actual.length !== expected.length || actual.some((name, i) => name !== expected[i])) {
    const actualSet = new Set(actual);
    const expectedSet = new Set(expected);
    const missing = expected.filter((name) => !actualSet.has(name));
    const extra = actual.filter((name) => !expectedSet.has(name));
    fail(`file set mismatch: ${missing.length} missing, ${extra.length} extra`);
  }

  for (const name of expected) {
    const recorded = manifest.files[name];
    if (!/^[0-9a-f]{64}$/.test(recorded)) fail(`invalid recorded SHA for ${name}`);
    const actualSha = await sha256(resolve(root, name));
    if (actualSha !== recorded) fail(`SHA mismatch: ${name}`);
  }

  console.log(`VPS_STAGING_ARTIFACT_OK ${expectedCommit}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
