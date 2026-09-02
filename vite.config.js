import { createHash } from "node:crypto";
import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = dirname(fileURLToPath(import.meta.url));
const BUILD_MANIFEST = ".lcafe-build.json";

function normalizeBasePath(value) {
  const path = value?.trim() || "/";
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  return withLeadingSlash.endsWith("/")
    ? withLeadingSlash
    : `${withLeadingSlash}/`;
}

const base = normalizeBasePath(process.env.VITE_BASE_PATH);
const menuFixturePath = resolve(root, "src/menu/fixtures/current.json");

const staticTrees = ["assets/fonts"];

const staticFiles = [
  ".htaccess",
  "robots.txt",
  "sitemap.xml",
  "assets/favicon.svg",
  "assets/icon-180.png",
  "assets/icon-512.png",
  "assets/l-cafe-pattern-inverted-tight.svg",
  "assets/l-cafe-sculptural-light.jpg",
  "assets/l-cafe-sculptural-light.webp",
  "assets/l-cafe-sculptural-light-1280.webp",
  "assets/l-cafe-sculptural-light-760.webp",
  "assets/l-cafe-sculptural-light-480.webp",
  "assets/menu/opt/item-placeholder-300.webp",
  "assets/menu/opt/item-placeholder.webp",
  "assets/brand/l-cafe-full-white.svg",
];

const buildInputFiles = [
  ".htaccess",
  "404.html",
  "admin/index.html",
  "index.html",
  "menu.html",
  "menu2.html",
  "package.json",
  "package-lock.json",
  "robots.txt",
  "sitemap.xml",
  "vite.admin.config.js",
  "vite.config.js",
];
const buildInputTrees = ["src", "assets", "server"];

async function listTree(relativeDir) {
  const entries = await readdir(resolve(root, relativeDir), { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = `${relativeDir}/${entry.name}`;
    if (entry.isDirectory()) files.push(...(await listTree(relative)));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
}

async function sha256(relativePath) {
  const bytes = await readFile(resolve(root, relativePath));
  return createHash("sha256").update(bytes).digest("hex");
}

async function writeBuildManifest(outDir) {
  const treeFiles = (await Promise.all(buildInputTrees.map(listTree))).flat();
  const inputPaths = [...new Set([...buildInputFiles, ...treeFiles])].sort();
  const inputs = Object.fromEntries(
    await Promise.all(inputPaths.map(async (path) => [path, await sha256(path)])),
  );
  const manifest = {
    version: 1,
    roots: { files: buildInputFiles, trees: buildInputTrees },
    inputs,
  };
  await writeFile(
    resolve(outDir, BUILD_MANIFEST),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8",
  );
}

function serveManagedMenuFixture() {
  const fixturePaths = new Set([
    `${base}managed-menu/current.json`,
    `${base}managed-menu/previous.json`,
  ]);
  const fixtureAssetPrefix = `${base}assets/menu/opt/`;
  const middleware = async (request, response, next) => {
    const pathname = new URL(request.url || "/", "http://localhost").pathname;
    const photoName = pathname.startsWith(fixtureAssetPrefix)
      ? pathname.slice(fixtureAssetPrefix.length)
      : "";
    const fixturePhoto = /^[a-z0-9-]+\.webp$/i.test(photoName)
      ? resolve(root, "assets/menu/opt", photoName)
      : null;
    const fixtureJson = fixturePaths.has(pathname) ? menuFixturePath : null;
    if (
      (!fixtureJson && !fixturePhoto)
      || !["GET", "HEAD"].includes(request.method || "GET")
    ) {
      next();
      return;
    }
    try {
      const bytes = await readFile(fixtureJson || fixturePhoto);
      response.statusCode = 200;
      response.setHeader(
        "Content-Type",
        fixtureJson ? "application/json; charset=utf-8" : "image/webp",
      );
      response.setHeader("Cache-Control", "no-store");
      response.setHeader("X-Content-Type-Options", "nosniff");
      response.end(request.method === "HEAD" ? undefined : bytes);
    } catch (error) {
      next(error);
    }
  };
  return {
    name: "serve-managed-menu-fixture",
    configureServer(server) {
      server.middlewares.use(middleware);
    },
    configurePreviewServer(server) {
      server.middlewares.use(middleware);
    },
  };
}

function copyStaticSiteAssets() {
  return {
    name: "copy-static-site-assets",
    apply: "build",
    async closeBundle() {
      const outDir = resolve(root, "dist");

      for (const tree of staticTrees) {
        await cp(resolve(root, tree), resolve(outDir, tree), {
          recursive: true,
        });
      }

      for (const file of staticFiles) {
        const destination = resolve(outDir, file);
        await mkdir(dirname(destination), { recursive: true });
        await cp(resolve(root, file), destination);
      }

      // 404.html is intentionally plain HTML, but unlike raw copy it still needs
      // the configured build base so root and subpath deployments both work.
      const errorPage = await readFile(resolve(root, "404.html"), "utf8");
      await writeFile(
        resolve(outDir, "404.html"),
        errorPage.replaceAll("__BASE_PATH__", base),
        "utf8",
      );

      await writeBuildManifest(outDir);
    },
  };
}

export default defineConfig({
  appType: "mpa",
  base,
  plugins: [react(), serveManagedMenuFixture(), copyStaticSiteAssets()],
  publicDir: false,
  build: {
    rollupOptions: {
      input: {
        landing: resolve(root, "index.html"),
        menu: resolve(root, "menu.html"),
        menu2: resolve(root, "menu2.html"),
      },
    },
  },
});
