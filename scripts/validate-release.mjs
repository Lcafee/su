import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const fail = (message) => {
  throw new Error(`release validation: ${message}`);
};
const readText = (path) => readFileSync(resolve(root, path), "utf8");
const menu = JSON.parse(readText("menu.json"));

if (!Array.isArray(menu.categories) || menu.categories.length === 0) {
  fail("menu.json must contain a non-empty categories array");
}

const categoryIds = new Set();
const slotIds = new Set();
const codes = new Set();
const referencedPhotos = new Set();

const addCode = (code, where) => {
  if (code == null || code === "") return;
  if (typeof code !== "string" || !/^\d+$/.test(code)) {
    fail(`${where} has malformed Sepidz code ${JSON.stringify(code)}`);
  }
  if (codes.has(code)) fail(`duplicate Sepidz code ${code}`);
  codes.add(code);
};

for (const [categoryIndex, category] of menu.categories.entries()) {
  const where = `categories[${categoryIndex}]`;
  if (!category || typeof category !== "object") fail(`${where} is not an object`);
  if (!category.id || typeof category.id !== "string") fail(`${where}.id is missing`);
  if (categoryIds.has(category.id)) fail(`duplicate category id ${category.id}`);
  categoryIds.add(category.id);
  if (!category.title?.trim()) fail(`${where}.title is missing`);
  if (!category.intro?.trim()) fail(`${where}.intro is missing`);
  if (!Array.isArray(category.items)) fail(`${where}.items must be an array`);

  for (const [itemIndex, item] of category.items.entries()) {
    const itemWhere = `${where}.items[${itemIndex}]`;
    if (!item?.name?.trim()) fail(`${itemWhere}.name is missing`);
    if (category.layout !== "addons") {
      if (typeof item.desc !== "string" || !item.desc.trim()) fail(`${itemWhere}.desc is missing`);
      if (item.desc !== item.desc.trim()) fail(`${itemWhere}.desc has leading/trailing whitespace`);
    }

    if (item.slotId) {
      if (slotIds.has(item.slotId)) fail(`duplicate slotId ${item.slotId}`);
      slotIds.add(item.slotId);
    }

    if (Array.isArray(item.options) && item.options.length > 0) {
      for (const [optionIndex, option] of item.options.entries()) {
        const optionWhere = `${itemWhere}.options[${optionIndex}]`;
        if (!option?.label?.trim()) fail(`${optionWhere}.label is missing`);
        if (!option?.price?.trim()) fail(`${optionWhere}.price is missing`);
        addCode(option.code, optionWhere);
      }
    } else {
      if (!item.price?.trim()) fail(`${itemWhere}.price is missing`);
      addCode(item.code, itemWhere);
      if (Array.isArray(item.codes)) item.codes.forEach((code) => addCode(code, itemWhere));
    }

    if (item.photo) {
      if (!/\.webp$/i.test(item.photo)) fail(`${itemWhere}.photo must be WebP`);
      referencedPhotos.add(item.photo);
      const full = resolve(root, "assets/menu/opt", item.photo);
      const small = resolve(root, "assets/menu/opt", item.photo.replace(/\.webp$/i, "-300.webp"));
      if (!existsSync(full)) fail(`missing menu photo assets/menu/opt/${item.photo}`);
      if (!existsSync(small)) fail(`missing 300w derivative for ${item.photo}`);
    }
  }
}

for (const file of ["index.html", "menu.html", "robots.txt", "sitemap.xml"]) {
  const text = readText(file);
  if (text.includes("lcafe-esf.ir")) fail(`${file} still references lcafe-esf.ir`);
  if (text.includes("lcafee.github.io")) fail(`${file} still references GitHub Pages`);
}

const source404 = readText("404.html");
if (!source404.includes("__BASE_PATH__")) {
  fail("404.html must keep build-time __BASE_PATH__ markers");
}

const optDir = resolve(root, "assets/menu/opt");
for (const name of readdirSync(optDir)) {
  const path = resolve(optDir, name);
  if (!statSync(path).isFile() || !name.endsWith(".webp")) continue;
  if (name === "item-placeholder.webp" || name === "item-placeholder-300.webp") continue;
  const baseName = name.replace(/-300(?=\.webp$)/, "");
  if (!referencedPhotos.has(baseName)) {
    fail(`orphan optimized menu image ${name}`);
  }
}

console.log(
  `release validation: ok (${menu.categories.length} categories, ${slotIds.size} product slots, ${codes.size} Sepidz codes)`,
);
