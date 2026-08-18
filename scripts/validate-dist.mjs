import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const fail = (message) => {
  throw new Error(`dist validation: ${message}`);
};

if (!existsSync(dist)) fail("dist/ is missing; run npm run build first");
for (const file of ["index.html", "menu.html", "404.html", ".lcafe-build.json"]) {
  if (!existsSync(resolve(dist, file))) fail(`${file} is missing from dist`);
}

const errorPage = readFileSync(resolve(dist, "404.html"), "utf8");
if (errorPage.includes("__BASE_PATH__")) fail("404 base-path marker was not replaced");

const htmlFiles = ["index.html", "menu.html", "404.html"];
for (const file of htmlFiles) {
  const text = readFileSync(resolve(dist, file), "utf8");
  if (text.includes("lcafe-esf.ir")) fail(`${file} contains the old public domain`);
}

function walk(dir, prefix = "") {
  const output = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) output.push(...walk(resolve(dir, entry.name), relative));
    else if (entry.isFile()) output.push(relative);
  }
  return output;
}

const files = new Set(walk(dist));
if (files.size < 20) fail(`dist looks incomplete (${files.size} files)`);

const manifest = JSON.parse(readFileSync(resolve(dist, ".lcafe-build.json"), "utf8"));
if (manifest.version !== 1 || !manifest.inputs || !manifest.roots) {
  fail("build manifest is malformed");
}

console.log(`dist validation: ok (${files.size} files)`);
