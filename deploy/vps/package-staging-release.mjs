import { createHash, randomUUID } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
const MANIFEST = ".lcafe-vps-release.json";
// Windows npm is npm.cmd: spawnSync cannot resolve it, and Node refuses to
// launch .cmd directly, so those three calls go through the shell instead.
const NPM_VIA_SHELL = process.platform === "win32";

function fail(message) {
  throw new Error(`VPS staging package: ${message}`);
}

function run(command, args, { cwd = root, stdio = "pipe", shell = false } = {}) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", stdio, shell });
  if (result.error) fail(`${command} could not start (${result.error.message})`);
  if (result.status !== 0) {
    const detail = `${result.stderr ?? result.stdout ?? ""}`.trim();
    fail(`${command} ${args.join(" ")} failed${detail ? `: ${detail}` : ""}`);
  }
  return `${result.stdout ?? ""}`.trim();
}

function git(args, options) {
  return run("git", args, options);
}

async function listFiles(directory, prefix = "") {
  const output = [];
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const absolute = resolve(directory, entry.name);
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) output.push(...await listFiles(absolute, name));
    else if (entry.isFile()) output.push(name);
    else fail(`unsupported artifact entry: ${name}`);
  }
  return output;
}

async function sha256(file) {
  return createHash("sha256").update(await readFile(file)).digest("hex");
}

function assertInside(parent, child) {
  const rel = relative(parent, child);
  if (!rel || rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel)) {
    fail(`refusing path outside ${parent}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 4 || args[0] !== "--approve" || args[2] !== "--out") {
    fail("usage: node deploy/vps/package-staging-release.mjs --approve <full-sha> --out <archive.tar.gz>");
  }

  const requested = args[1].toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(requested)) fail("approval must be a full 40-character SHA");

  const output = resolve(args[3]);
  if (!output.endsWith(".tar.gz")) fail("output must end in .tar.gz");

  const repoRoot = resolve(git(["rev-parse", "--show-toplevel"]));
  if (repoRoot.toLowerCase() !== root.toLowerCase()) fail("run from the canonical L Cafe Main Site repository");
  if (git(["status", "--porcelain=v1", "--untracked-files=all"])) fail("working tree must be clean");

  run(process.execPath, ["scripts/agent-scope-check.mjs"]);

  const commit = git(["rev-parse", "--verify", `${requested}^{commit}`]).toLowerCase();
  if (commit !== requested) fail("approved SHA did not resolve exactly");

  git(["fetch", "--quiet", "origin"]);
  const remoteRefs = git([
    "branch", "--remotes", "--contains", commit, "--format=%(refname:short)",
  ]).split(/\r?\n/).map((x) => x.trim()).filter((x) => x.startsWith("origin/") && x !== "origin/HEAD");
  if (remoteRefs.length === 0) fail("approved commit is not contained by an origin branch");

  const temp = await mkdtemp(join(tmpdir(), "lcafe-vps-package-"));
  const worktree = resolve(temp, "source");
  const staging = resolve(temp, "artifact");
  assertInside(temp, worktree);
  assertInside(temp, staging);
  let worktreeAdded = false;

  try {
    git(["worktree", "add", "--quiet", "--detach", worktree, commit]);
    worktreeAdded = true;

    run("npm", ["ci", "--no-audit", "--no-fund"], { cwd: worktree, stdio: "inherit", shell: NPM_VIA_SHELL });
    run("npm", ["run", "build"], { cwd: worktree, stdio: "inherit", shell: NPM_VIA_SHELL });
    run("npm", ["run", "validate:dist"], { cwd: worktree, stdio: "inherit", shell: NPM_VIA_SHELL });

    await mkdir(staging, { recursive: true });
    await cp(resolve(worktree, "dist"), resolve(staging, "dist"), { recursive: true });
    await cp(resolve(worktree, "server-node"), resolve(staging, "server-node"), {
      recursive: true,
      filter(source) {
        return basename(source) !== "node_modules";
      },
    });
    await cp(resolve(worktree, "deploy", "vps"), resolve(staging, "deploy", "vps"), { recursive: true });
    await cp(resolve(worktree, ".agent"), resolve(staging, ".agent"), { recursive: true });
    await mkdir(resolve(staging, "scripts"), { recursive: true });
    await cp(
      resolve(worktree, "scripts", "agent-scope-check.mjs"),
      resolve(staging, "scripts", "agent-scope-check.mjs"),
    );

    const files = await listFiles(staging);
    const hashes = Object.fromEntries(
      await Promise.all(files.map(async (name) => [name, await sha256(resolve(staging, name))])),
    );
    const manifest = {
      version: 1,
      project: "lcafe-main-site",
      repository: "Lcafee/su",
      gitCommit: commit,
      generatedAt: new Date().toISOString(),
      files: hashes,
    };
    await writeFile(resolve(staging, MANIFEST), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

    await mkdir(dirname(output), { recursive: true });
    await rm(output, { force: true });
    run("tar", ["-czf", output, "-C", staging, "."]);
    const archiveSha = await sha256(output);
    console.log(JSON.stringify({
      ok: true,
      archive: output,
      archiveSha256: archiveSha,
      gitCommit: commit,
      files: files.length + 1,
    }, null, 2));
  } finally {
    if (worktreeAdded) {
      spawnSync("git", ["worktree", "remove", "--force", worktree], { cwd: root, stdio: "ignore" });
    }
    await rm(temp, { recursive: true, force: true });
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
