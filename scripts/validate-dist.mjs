import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const dist = resolve(root, "dist");
const fail = (message) => {
  throw new Error(`dist validation: ${message}`);
};

if (!existsSync(dist)) fail("dist/ is missing; run npm run build first");
for (const file of ["index.html", "menu.html", "menu2.html", "404.html", ".lcafe-build.json"]) {
  if (!existsSync(resolve(dist, file))) fail(`${file} is missing from dist`);
}

const errorPage = readFileSync(resolve(dist, "404.html"), "utf8");
if (errorPage.includes("__BASE_PATH__")) fail("404 base-path marker was not replaced");

const htmlFiles = ["index.html", "menu.html", "menu2.html", "404.html"];
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

const PUBLIC_MENU_URL = "https://l-cafe.ir/menu";
const PHONE_DISPLAY = "09130005767";
const PHONE_E164 = "+989130005767";
const builtIndex = readFileSync(resolve(dist, "index.html"), "utf8");
const builtMenu = readFileSync(resolve(dist, "menu.html"), "utf8");
const builtMenu2 = readFileSync(resolve(dist, "menu2.html"), "utf8");
const built404 = readFileSync(resolve(dist, "404.html"), "utf8");
const builtSitemap = readFileSync(resolve(dist, "sitemap.xml"), "utf8");
const builtRobots = readFileSync(resolve(dist, "robots.txt"), "utf8");
const builtHtaccess = readFileSync(resolve(dist, ".htaccess"), "utf8");
const publicScripts = [...files]
  .filter((file) => /^assets\/.*\.js$/.test(file))
  .map((file) => readFileSync(resolve(dist, file), "utf8"))
  .join("\n");
const searchablePublicOutput = [
  builtIndex,
  builtMenu,
  builtMenu2,
  built404,
  builtSitemap,
  publicScripts,
].join("\n");

for (const retiredPhone of [
  "+989130005768",
  "09130005768",
  "۰۹۱۳ ۰۰۰ ۵۷۶۸",
  "۰۹۱۳۰۰۰۵۷۶۸",
]) {
  if (searchablePublicOutput.includes(retiredPhone)) {
    fail("built public output contains the retired phone number");
  }
}
if (!builtIndex.includes(`"telephone": "${PHONE_E164}"`)) {
  fail("built JSON-LD telephone is incorrect");
}
if (!builtIndex.includes(`"hasMenu": "${PUBLIC_MENU_URL}"`)) {
  fail("built JSON-LD hasMenu is not canonical");
}
if (!builtMenu.includes(`<link rel="canonical" href="${PUBLIC_MENU_URL}"`)) {
  fail("built menu canonical link is incorrect");
}
if (!builtMenu.includes(`<meta property="og:url" content="${PUBLIC_MENU_URL}"`)) {
  fail("built menu og:url is incorrect");
}
if (!builtMenu2.includes(`<link rel="canonical" href="${PUBLIC_MENU_URL}"`)) {
  fail("built menu2 canonical link is incorrect");
}
if (!builtMenu2.includes(`<meta name="robots" content="noindex,follow"`)) {
  fail("built menu2 must be noindex,follow");
}
if (
  !builtSitemap.includes(`<loc>${PUBLIC_MENU_URL}</loc>`)
  || builtSitemap.includes("menu.html")
  || builtSitemap.includes("menu2")
) {
  fail("built sitemap does not expose only the canonical menu URL");
}
if (!built404.includes(`href="${PUBLIC_MENU_URL}"`)) {
  fail("built 404 page does not link to the canonical menu URL");
}
if (publicScripts.includes("menu.html")) {
  fail("built public JavaScript exposes the physical menu.html entry");
}
if (!publicScripts.includes(`tel:${PHONE_E164}`) || !publicScripts.includes(PHONE_DISPLAY)) {
  fail("built public JavaScript does not contain the approved phone link and display");
}
if (!builtRobots.includes("Allow: /") || !builtRobots.includes("https://l-cafe.ir/sitemap.xml")) {
  fail("built robots.txt does not allow indexing and advertise the sitemap");
}
for (const requiredRule of [
  "# LCAFE-PUBLIC-MENU-CANONICAL",
  "RewriteRule ^menu\\.html$ https://l-cafe.ir/menu [R=301,L,NE]",
  "RewriteRule ^menu$ menu.html [L]",
  "# LCAFE-PUBLIC-MENU2-COMPARISON",
  "RewriteRule ^menu2\\.html$ https://l-cafe.ir/menu2 [R=301,L,NE]",
  "RewriteRule ^menu2$ menu2.html [L]",
]) {
  if (!builtHtaccess.includes(requiredRule)) {
    fail(`built .htaccess is missing ${requiredRule}`);
  }
}

const manifest = JSON.parse(readFileSync(resolve(dist, ".lcafe-build.json"), "utf8"));
if (manifest.version !== 1 || !manifest.inputs || !manifest.roots) {
  fail("build manifest is malformed");
}

console.log(`dist validation: ok (${files.size} files)`);
