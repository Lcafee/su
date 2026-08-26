import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const projectRoot = dirname(fileURLToPath(import.meta.url));

function normalizeBasePath(value) {
  const path = value?.trim() || "/";
  const withLeadingSlash = path.startsWith("/") ? path : `/${path}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

const siteBase = normalizeBasePath(process.env.VITE_BASE_PATH);

export default defineConfig({
  root: resolve(projectRoot, "admin"),
  base: `${siteBase}admin/`,
  plugins: [react()],
  publicDir: false,
  server: {
    fs: { allow: [projectRoot] },
  },
  build: {
    outDir: resolve(projectRoot, "dist", "admin"),
    emptyOutDir: true,
    assetsDir: "assets",
  },
});
