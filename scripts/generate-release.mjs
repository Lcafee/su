import { createHash, randomUUID } from "node:crypto";
import {
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const releaseRoot = resolve(root, "release");
const currentRelease = resolve(releaseRoot, "current");
const RELEASE_MANIFEST = ".lcafe-release.json";
const API_RELEASE_TOKEN = "__LCAFE_API_RELEASE__";

function fail(message) {
  throw new Error(`release generation: ${message}`);
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    env: options.env ?? process.env,
    encoding: options.encoding ?? "utf8",
    stdio: options.stdio ?? "pipe",
  });
  if (result.error) fail(`${command} could not start (${result.error.message})`);
  if (result.status !== 0) {
    const detail = `${result.stderr ?? result.stdout ?? ""}`.trim();
    fail(`${command} ${args.join(" ")} failed${detail ? `: ${detail}` : ""}`);
  }
  return `${result.stdout ?? ""}`.trim();
}

function git(args, options = {}) {
  return run("git", args, options);
}

function npm(args, options = {}) {
  const npmCli = process.env.npm_execpath;
  if (!npmCli) {
    fail("npm CLI path is unavailable; run through npm run release:generate");
  }
  return run(process.execPath, [npmCli, ...args], options);
}

function assertInside(parent, child) {
  const rel = relative(parent, child);
  if (!rel || rel.startsWith(`..${sep}`) || rel === ".." || isAbsolute(rel)) {
    fail(`refusing filesystem operation outside ${parent}`);
  }
}

async function listFiles(directory, prefix = "") {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((a, b) => a.name.localeCompare(b.name));
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    const name = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) files.push(...(await listFiles(path, name)));
    else if (entry.isFile()) files.push(name);
  }
  return files;
}

async function sha256(path) {
  return createHash("sha256").update(await readFile(path)).digest("hex");
}

async function writeReleaseManifest(staging, commit, remoteRefs) {
  const buildManifestPath = resolve(staging, ".lcafe-build.json");
  const buildManifest = JSON.parse(await readFile(buildManifestPath, "utf8"));
  buildManifest.gitCommit = commit;
  await writeFile(
    buildManifestPath,
    `${JSON.stringify(buildManifest, null, 2)}\n`,
    "utf8",
  );

  const paths = (await listFiles(staging)).filter(
    (name) => name !== RELEASE_MANIFEST,
  );
  const files = Object.fromEntries(
    await Promise.all(
      paths.map(async (name) => [name, await sha256(resolve(staging, name))]),
    ),
  );
  const manifest = {
    version: 1,
    gitCommit: commit,
    sourceRemoteRefs: remoteRefs,
    basePath: process.env.VITE_BASE_PATH?.trim() || "/",
    generatedAt: new Date().toISOString(),
    files,
  };
  await writeFile(
    resolve(staging, RELEASE_MANIFEST),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
}

async function copyBackendRelease(worktree, staging, commit) {
  const apiDirectory = resolve(staging, "api");
  await cp(resolve(worktree, "server", "public", "api"), apiDirectory, {
    recursive: true,
  });

  const appDirectory = resolve(apiDirectory, "_app", commit);
  await mkdir(appDirectory, { recursive: true });
  await cp(resolve(worktree, "server", "app"), appDirectory, {
    recursive: true,
  });
  await cp(resolve(worktree, "server", "bin"), resolve(appDirectory, "bin"), {
    recursive: true,
  });
  await cp(
    resolve(worktree, "server", "migrations"),
    resolve(appDirectory, "migrations"),
    { recursive: true },
  );
  await cp(
    resolve(worktree, "server", "config.example.php"),
    resolve(appDirectory, "config.example.php"),
  );

  const controllerPath = resolve(apiDirectory, "index.php");
  const controller = await readFile(controllerPath, "utf8");
  const occurrences = controller.split(API_RELEASE_TOKEN).length - 1;
  if (occurrences !== 1) {
    fail(`API front controller must contain exactly one ${API_RELEASE_TOKEN}`);
  }
  await writeFile(
    controllerPath,
    controller.replace(API_RELEASE_TOKEN, commit),
    "utf8",
  );
}

async function promote(staging) {
  await mkdir(releaseRoot, { recursive: true });
  assertInside(releaseRoot, staging);
  const previous = resolve(releaseRoot, `.previous-${randomUUID()}`);
  assertInside(releaseRoot, previous);

  let movedPrevious = false;
  try {
    await rename(currentRelease, previous);
    movedPrevious = true;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  try {
    await rename(staging, currentRelease);
  } catch (error) {
    if (movedPrevious) await rename(previous, currentRelease);
    throw error;
  }

  if (movedPrevious) await rm(previous, { recursive: true, force: true });
}

async function main() {
  const args = process.argv.slice(2);
  if (args.length !== 2 || args[0] !== "--approve") {
    fail(
      "explicit approval is required. Run: npm run release:generate -- --approve <full-commit-sha>",
    );
  }

  const requestedCommit = args[1].toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(requestedCommit)) {
    fail("approval must name a full 40-character Git commit SHA");
  }

  const repoRoot = resolve(git(["rev-parse", "--show-toplevel"]));
  if (repoRoot.toLowerCase() !== root.toLowerCase()) {
    fail(`run the command from the canonical repository at ${root}`);
  }
  if (git(["status", "--porcelain=v1", "--untracked-files=all"])) {
    fail("the working tree is not clean; commit or remove local changes first");
  }

  const commit = git([
    "rev-parse",
    "--verify",
    `${requestedCommit}^{commit}`,
  ]).toLowerCase();
  if (commit !== requestedCommit) fail("the approved SHA did not resolve exactly");

  git(["fetch", "--quiet", "origin"]);
  const remoteRefs = git([
    "branch",
    "--remotes",
    "--contains",
    commit,
    "--format=%(refname:short)",
  ])
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.startsWith("origin/") && line !== "origin/HEAD");
  if (remoteRefs.length === 0) {
    fail(`${commit} is not contained by any origin branch; push it to GitHub first`);
  }

  const temporaryRoot = await mkdtemp(join(tmpdir(), "lcafe-release-"));
  const worktree = resolve(temporaryRoot, "source");
  const staging = resolve(releaseRoot, `.staging-${randomUUID()}`);
  assertInside(temporaryRoot, worktree);
  assertInside(releaseRoot, staging);
  let worktreeAdded = false;

  try {
    await mkdir(releaseRoot, { recursive: true });
    git(["worktree", "add", "--quiet", "--detach", worktree, commit]);
    worktreeAdded = true;

    npm(["ci"], { cwd: worktree, stdio: "inherit" });
    npm(["run", "build"], { cwd: worktree, stdio: "inherit" });

    await cp(resolve(worktree, "dist"), staging, { recursive: true });
    await copyBackendRelease(worktree, staging, commit);
    await writeReleaseManifest(staging, commit, remoteRefs);
    await promote(staging);
  } finally {
    if (worktreeAdded) {
      spawnSync("git", ["worktree", "remove", "--force", worktree], {
        cwd: root,
        stdio: "ignore",
      });
    }
    await rm(temporaryRoot, { recursive: true, force: true });
    await rm(staging, { recursive: true, force: true });
  }

  console.log(`approved release ${commit} generated at release/current`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
