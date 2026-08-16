import { cp, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const root = dirname(fileURLToPath(import.meta.url));

function normalizeBasePath(value) {
  const path = value?.trim() || "/";
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  return withLeadingSlash.endsWith("/")
    ? withLeadingSlash
    : `${withLeadingSlash}/`;
}

const base = normalizeBasePath(process.env.VITE_BASE_PATH);

const staticTrees = ["assets/fonts", "assets/menu/opt"];

const staticFiles = [
  ".htaccess",
  "404.html",
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
  "uploads/L_Cafe_Full_NoTagline_White.svg",
];

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
    },
  };
}

export default defineConfig({
  appType: "mpa",
  base,
  plugins: [react(), copyStaticSiteAssets()],
  publicDir: false,
  build: {
    rollupOptions: {
      input: {
        landing: resolve(root, "index.html"),
        menu: resolve(root, "menu.html"),
      },
    },
  },
});
