import { cp, mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(root, "dist-pages");
const base = "/su/";
const fixturePath = resolve(root, "src/menu/fixtures/current.json");

const runtimeAssets = [
  "assets/l-cafe-sculptural-light.webp",
  "assets/l-cafe-sculptural-light-1280.webp",
  "assets/l-cafe-sculptural-light-760.webp",
  "assets/l-cafe-sculptural-light-480.webp",
  "assets/menu/opt/item-placeholder-300.webp",
  "assets/menu/opt/item-placeholder.webp",
  "assets/brand/l-cafe-symbol-122.png",
  "assets/brand/l-cafe-full-white.svg",
];

const requiredOutput = [
  ".nojekyll",
  "index.html",
  "menu/index.html",
  "menu2/index.html",
  "robots.txt",
  "managed-menu/current.json",
  "managed-menu/previous.json",
  ...runtimeAssets,
];

function previewSearchIsolation() {
  const robotsMeta = '<meta name="robots" content="noindex,nofollow" />';
  return {
    name: "pages-preview-search-isolation",
    enforce: "pre",
    transformIndexHtml(html) {
      const existing = /\s*<meta\s+name="robots"\s+content="[^"]*"\s*\/>/i;
      return existing.test(html)
        ? html.replace(existing, `\n    ${robotsMeta}`)
        : html.replace("<head>", `<head>\n    ${robotsMeta}`);
    },
  };
}

async function listFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = resolve(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFiles(absolute)));
    else if (entry.isFile()) files.push(relative(outDir, absolute).split(sep).join("/"));
  }
  return files;
}

async function makeDirectoryRoute(name) {
  const directory = resolve(outDir, name);
  await mkdir(directory, { recursive: true });
  await rename(resolve(outDir, `${name}.html`), resolve(directory, "index.html"));
}

async function assertSafePreviewOutput() {
  const files = (await listFiles(outDir)).sort();
  const missing = requiredOutput.filter((file) => !files.includes(file));
  const unexpected = files.filter(
    (file) =>
      !requiredOutput.includes(file)
      && !file.startsWith("assets/"),
  );
  const forbidden = files.filter((file) =>
    /(^|\/)(?:admin|api|server|release)(?:\/|$)|(^|\/)\.htaccess$|\.lcafe-(?:build|release)\.json$/i.test(file),
  );

  if (missing.length || unexpected.length || forbidden.length) {
    throw new Error(
      `Unsafe Pages preview output. Missing: ${missing.join(", ") || "none"}; `
      + `unexpected: ${unexpected.join(", ") || "none"}; `
      + `forbidden: ${forbidden.join(", ") || "none"}.`,
    );
  }

  for (const page of ["index.html", "menu/index.html", "menu2/index.html"]) {
    const html = await readFile(resolve(outDir, page), "utf8");
    if (!/<meta name="robots" content="noindex,nofollow"\s*\/>/i.test(html)) {
      throw new Error(`${page} is missing preview search isolation.`);
    }
    if (/(?:href|src)="\/(?!su\/)/i.test(html)) {
      throw new Error(`${page} contains an asset URL outside ${base}.`);
    }
  }

  const fixture = await readFile(fixturePath);
  const current = await readFile(resolve(outDir, "managed-menu/current.json"));
  const previous = await readFile(resolve(outDir, "managed-menu/previous.json"));
  if (!fixture.equals(current) || !fixture.equals(previous)) {
    throw new Error("Pages menu snapshots must be byte-identical to the tracked fixture.");
  }
}

function buildPagesPreview() {
  return {
    name: "build-pages-preview",
    apply: "build",
    generateBundle(_options, bundle) {
      const privateModules = Object.values(bundle)
        .filter((output) => output.type === "chunk")
        .flatMap((chunk) => Object.keys(chunk.modules))
        .filter((id) => /[\\/](?:src[\\/]admin|server)[\\/]/i.test(id));
      if (privateModules.length) {
        throw new Error(`Private modules reached the Pages bundle: ${privateModules.join(", ")}`);
      }
    },
    async closeBundle() {
      for (const asset of runtimeAssets) {
        const destination = resolve(outDir, asset);
        await mkdir(dirname(destination), { recursive: true });
        await cp(resolve(root, asset), destination);
      }

      const managedMenu = resolve(outDir, "managed-menu");
      await mkdir(managedMenu, { recursive: true });
      await cp(fixturePath, resolve(managedMenu, "current.json"));
      await cp(fixturePath, resolve(managedMenu, "previous.json"));

      await makeDirectoryRoute("menu");
      await makeDirectoryRoute("menu2");
      await writeFile(resolve(outDir, ".nojekyll"), "", "utf8");
      await writeFile(
        resolve(outDir, "robots.txt"),
        "User-agent: *\nDisallow: /su/\n",
        "utf8",
      );

      await assertSafePreviewOutput();
    },
  };
}

export default defineConfig({
  appType: "mpa",
  base,
  plugins: [react(), previewSearchIsolation(), buildPagesPreview()],
  publicDir: false,
  build: {
    outDir,
    emptyOutDir: true,
    rollupOptions: {
      input: {
        landing: resolve(root, "index.html"),
        menu: resolve(root, "menu.html"),
        menu2: resolve(root, "menu2.html"),
      },
    },
  },
});
