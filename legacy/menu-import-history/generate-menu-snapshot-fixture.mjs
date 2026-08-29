import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const sourcePath = resolve(root, "menu.json");
const outputPath = resolve(root, "src", "menu", "fixtures", "current.json");
const mappedItemKeys = new Set([
  "slotId",
  "name",
  "desc",
  "price",
  "photo",
  "options",
]);

function itemId(item, categoryId, index) {
  return item.slotId || `${categoryId}-item-${String(index + 1).padStart(2, "0")}`;
}

function metadataFor(item) {
  const metadata = Object.fromEntries(
    Object.entries(item).filter(([key]) => !mappedItemKeys.has(key)),
  );
  if (item.photo) metadata.sourcePhoto = item.photo;
  return metadata;
}

function imageFor(photo) {
  if (!photo) return null;
  const small = photo.replace(/\.webp$/i, "-300.webp");
  return {
    src: `assets/menu/opt/${photo}`,
    srcSet: `assets/menu/opt/${small} 300w, assets/menu/opt/${photo} 600w`,
    width: 600,
    height: 600,
  };
}

const legacy = JSON.parse(await readFile(sourcePath, "utf8"));
const snapshot = {
  schemaVersion: 1,
  revision: 0,
  publishedAt: "1970-01-01T00:00:00.000000Z",
  categories: legacy.categories.map((category) => ({
    id: category.id,
    title: category.title,
    intro: category.intro ?? null,
    layout: category.layout,
    items: category.items.map((item, index) => ({
      id: itemId(item, category.id, index),
      name: item.name,
      description: item.desc ?? null,
      price: item.price ?? null,
      metadata: metadataFor(item),
      options: (item.options || []).map((option) => ({
        label: option.label,
        price: option.price,
        ...(option.code ? { code: option.code } : {}),
      })),
      image: imageFor(item.photo),
    })),
  })),
};

await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
console.log(`wrote ${outputPath}`);
