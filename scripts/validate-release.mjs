import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const fail = (message) => {
  throw new Error(`release validation: ${message}`);
};
const readText = (path) => readFileSync(resolve(root, path), "utf8");
const PUBLIC_MENU_URL = "https://l-cafe.ir/menu";
const PHONE_DISPLAY = "09130005767";
const PHONE_E164 = "+989130005767";
const OLD_PHONE_TOKENS = [
  "+989130005768",
  "09130005768",
  "۰۹۱۳ ۰۰۰ ۵۷۶۸",
  "۰۹۱۳۰۰۰۵۷۶۸",
];

for (const file of ["index.html", "menu.html", "robots.txt", "sitemap.xml"]) {
  const text = readText(file);
  if (text.includes("lcafe-esf.ir")) fail(`${file} still references lcafe-esf.ir`);
  if (text.includes("lcafee.github.io")) fail(`${file} still references GitHub Pages`);
}

const source404 = readText("404.html");
if (!source404.includes("__BASE_PATH__")) {
  fail("404.html must keep build-time __BASE_PATH__ markers");
}

const indexHtml = readText("index.html");
const menuHtml = readText("menu.html");
const sitemap = readText("sitemap.xml");
const robots = readText("robots.txt");
const htaccess = readText(".htaccess");
const landingSource = readText("src/landing/LandingApp.jsx");
const menuSource = readText("src/menu/MenuApp.jsx");
const publicTexts = new Map([
  ["index.html", indexHtml],
  ["menu.html", menuHtml],
  ["404.html", source404],
  ["sitemap.xml", sitemap],
  ["src/landing/LandingApp.jsx", landingSource],
  ["src/menu/MenuApp.jsx", menuSource],
]);

for (const [file, text] of publicTexts) {
  for (const token of OLD_PHONE_TOKENS) {
    if (text.includes(token)) fail(`${file} contains the retired phone number`);
  }
}

if (!indexHtml.includes(`"telephone": "${PHONE_E164}"`)) {
  fail("index.html JSON-LD telephone is not the approved E.164 number");
}
if (!indexHtml.includes(`"hasMenu": "${PUBLIC_MENU_URL}"`)) {
  fail("index.html JSON-LD hasMenu is not the canonical menu URL");
}
if (!menuHtml.includes(`<link rel="canonical" href="${PUBLIC_MENU_URL}" />`)) {
  fail("menu.html canonical link is not the canonical menu URL");
}
if (!menuHtml.includes(`<meta property="og:url" content="${PUBLIC_MENU_URL}" />`)) {
  fail("menu.html og:url is not the canonical menu URL");
}
if (!sitemap.includes(`<loc>${PUBLIC_MENU_URL}</loc>`) || sitemap.includes("menu.html")) {
  fail("sitemap.xml does not expose only the canonical menu URL");
}
if (!source404.includes(`href="${PUBLIC_MENU_URL}"`)) {
  fail("404.html does not link to the canonical menu URL");
}
if (landingSource.includes('sitePath("menu.html")')) {
  fail("LandingApp still links to the physical menu.html entry");
}
for (const [file, text] of [
  ["src/landing/LandingApp.jsx", landingSource],
  ["src/menu/MenuApp.jsx", menuSource],
]) {
  if (!text.includes(`href="tel:${PHONE_E164}"`) || !text.includes(PHONE_DISPLAY)) {
    fail(`${file} does not contain the approved phone display and tel target`);
  }
}
if (!robots.includes("Allow: /") || !robots.includes("https://l-cafe.ir/sitemap.xml")) {
  fail("robots.txt does not allow indexing and advertise the production sitemap");
}
for (const requiredRule of [
  "# LCAFE-PUBLIC-MENU-CANONICAL",
  "RewriteRule ^menu\\.html$ https://l-cafe.ir/menu [R=301,L,NE]",
  "RewriteRule ^menu$ menu.html [L]",
]) {
  if (!htaccess.includes(requiredRule)) fail(`.htaccess is missing ${requiredRule}`);
}

console.log("release validation: ok");
