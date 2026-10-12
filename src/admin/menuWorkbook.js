// Excel round trip for the menu editor, without a spreadsheet dependency: a minimal
// .xlsx writer (stored ZIP), a reader (ZIP + browser inflate + DOMParser), and the merge
// that applies workbook rows to the editor draft. Blank cells and absent rows never
// change or delete anything; the result still goes through the normal save and publish.
import { blankCategory, blankItem, cloneDocument, editableSignature } from "./document";

const faNumber = new Intl.NumberFormat("fa-IR");
const XLSX_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const MAIN_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
const PACKAGE_NS = "http://schemas.openxmlformats.org/package";
const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const MAX_FILE_BYTES = 5 * 1024 * 1024;

// columns: [field, header, width]. `marks` are the headers that identify a sheet on import.
const SHEETS = {
  categories: {
    name: "دسته‌ها",
    marks: ["شناسه دسته", "نام دسته"],
    columns: [["id", "شناسه دسته", 38], ["name", "نام دسته", 28], ["description", "توضیح", 50], ["order", "ترتیب", 8]],
  },
  items: {
    name: "آیتم‌ها",
    marks: ["شناسه آیتم", "نام آیتم"],
    columns: [
      ["id", "شناسه آیتم", 38], ["name", "نام آیتم", 28], ["description", "توضیح", 50], ["price", "قیمت", 12],
      ["category", "نام دسته", 24], ["categoryId", "شناسه دسته", 38], ["order", "ترتیب", 8],
    ],
  },
  variants: {
    name: "گزینه‌های قیمت",
    marks: ["شناسه گزینه", "عنوان گزینه"],
    columns: [
      ["id", "شناسه گزینه", 38], ["item", "نام آیتم", 28], ["itemId", "شناسه آیتم", 38],
      ["label", "عنوان گزینه", 20], ["price", "قیمت", 12], ["order", "ترتیب", 8],
    ],
  },
};
const LIMITS = { name: [191, "نام"], description: [4000, "توضیح"], price: [64, "قیمت"], label: [191, "عنوان گزینه"] };

// Names match regardless of spacing, half-spaces and Arabic/Persian letter variants.
function matchKey(value) {
  return String(value ?? "").replace(/[\s‌‎‏]/g, "").replace(/ي/g, "ی").replace(/ك/g, "ک").toLocaleLowerCase("fa");
}

function trimText(value) {
  return String(value ?? "").replace(/\r\n?/g, "\n").trim();
}

/* ---------- writing ---------- */

const crcTable = Uint32Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  return (value ^ 0xffffffff) >>> 0;
}

function zipBlob(files) {
  const encoder = new TextEncoder();
  const local = [];
  const central = [];
  let offset = 0;
  for (const [name, text] of files) {
    const nameBytes = encoder.encode(name);
    const data = encoder.encode(text);
    // Fields shared by the local and central headers: version, flags, method (stored),
    // time, date, CRC, both sizes, name length, extra length.
    const shared = new DataView(new ArrayBuffer(26));
    shared.setUint16(0, 20, true);
    shared.setUint16(8, 0x21, true);
    shared.setUint32(10, crc32(data), true);
    shared.setUint32(14, data.length, true);
    shared.setUint32(18, data.length, true);
    shared.setUint16(22, nameBytes.length, true);
    const tail = new DataView(new ArrayBuffer(14));
    tail.setUint32(10, offset, true);
    local.push(Uint8Array.of(0x50, 0x4b, 3, 4), shared.buffer, nameBytes, data);
    central.push(Uint8Array.of(0x50, 0x4b, 1, 2, 20, 0), shared.buffer, tail.buffer, nameBytes);
    offset += 30 + nameBytes.length + data.length;
  }
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, central.reduce((size, part) => size + part.byteLength, 0), true);
  end.setUint32(16, offset, true);
  return new Blob([...local, ...central, end.buffer], { type: XLSX_TYPE });
}

function escapeXml(value) {
  return String(value)
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function sheetXml(sheet, rows) {
  const columns = sheet.columns
    .map(([, , width], index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`)
    .join("");
  const body = [sheet.columns.map(([, header]) => header), ...rows].map((cells, rowIndex) => {
    const xml = cells.map((value, column) => {
      if (value == null || value === "") return "";
      const reference = `${String.fromCharCode(65 + column)}${rowIndex + 1}`;
      return typeof value === "number"
        ? `<c r="${reference}"><v>${value}</v></c>`
        : `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
    }).join("");
    return `<row r="${rowIndex + 1}">${xml}</row>`;
  }).join("");
  return `${XML_HEAD}<worksheet xmlns="${MAIN_NS}"><sheetViews><sheetView workbookViewId="0" rightToLeft="1">`
    + '<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews>'
    + `<cols>${columns}</cols><sheetData>${body}</sheetData></worksheet>`;
}

function menuRows(menu) {
  const categories = [];
  const items = [];
  const variants = [];
  menu.categories.forEach((category, categoryIndex) => {
    categories.push([category.id, category.title, category.intro, categoryIndex + 1]);
    category.items.forEach((item, itemIndex) => {
      items.push([item.id, item.name, item.description, item.price, category.title, category.id, itemIndex + 1]);
      item.options.forEach((option, optionIndex) => {
        variants.push([option.id, item.name, item.id, option.label, option.price, optionIndex + 1]);
      });
    });
  });
  return [categories, items, variants];
}

// Downloads the whole menu, or (without a menu) a template that holds only the headers.
export function downloadWorkbook(menu, filename) {
  const sheets = Object.values(SHEETS);
  const rows = menu ? menuRows(menu) : sheets.map(() => []);
  const sheetPath = (index) => `worksheets/sheet${index + 1}.xml`;
  const blob = zipBlob([
    ["[Content_Types].xml", `${XML_HEAD}<Types xmlns="${PACKAGE_NS}/2006/content-types">`
      + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
      + '<Default Extension="xml" ContentType="application/xml"/>'
      + `<Override PartName="/xl/workbook.xml" ContentType="${XLSX_TYPE}.main+xml"/>`
      + sheets.map((_, index) => `<Override PartName="/xl/${sheetPath(index)}" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join("")
      + "</Types>"],
    ["_rels/.rels", `${XML_HEAD}<Relationships xmlns="${PACKAGE_NS}/2006/relationships">`
      + `<Relationship Id="rId1" Type="${REL_NS}/officeDocument" Target="xl/workbook.xml"/></Relationships>`],
    ["xl/workbook.xml", `${XML_HEAD}<workbook xmlns="${MAIN_NS}" xmlns:r="${REL_NS}"><bookViews><workbookView/></bookViews><sheets>`
      + sheets.map((sheet, index) => `<sheet name="${escapeXml(sheet.name)}" sheetId="${index + 1}" r:id="rId${index + 1}"/>`).join("")
      + "</sheets></workbook>"],
    ["xl/_rels/workbook.xml.rels", `${XML_HEAD}<Relationships xmlns="${PACKAGE_NS}/2006/relationships">`
      + sheets.map((_, index) => `<Relationship Id="rId${index + 1}" Type="${REL_NS}/worksheet" Target="${sheetPath(index)}"/>`).join("")
      + "</Relationships>"],
    ...sheets.map((sheet, index) => [`xl/${sheetPath(index)}`, sheetXml(sheet, rows[index])]),
  ]);
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/* ---------- reading ---------- */

function unzip(buffer) {
  const view = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let end = buffer.byteLength - 22;
  while (end >= 0 && view.getUint32(end, true) !== 0x06054b50) end -= 1;
  if (end < 0) throw new Error("not a zip archive");
  const entries = new Map();
  let pointer = view.getUint32(end + 16, true);
  for (let index = view.getUint16(end + 10, true); index > 0; index -= 1) {
    if (view.getUint32(pointer, true) !== 0x02014b50) throw new Error("corrupt zip directory");
    const nameLength = view.getUint16(pointer + 28, true);
    const local = view.getUint32(pointer + 42, true);
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    entries.set(new TextDecoder().decode(bytes.subarray(pointer + 46, pointer + 46 + nameLength)), {
      method: view.getUint16(pointer + 10, true),
      data: bytes.subarray(start, start + view.getUint32(pointer + 20, true)),
    });
    pointer += 46 + nameLength + view.getUint16(pointer + 30, true) + view.getUint16(pointer + 32, true);
  }
  return entries;
}

async function entryXml(entries, name) {
  const entry = entries.get(name);
  if (!entry || (entry.method !== 0 && entry.method !== 8)) throw new Error(`unreadable part: ${name}`);
  const text = entry.method === 0
    ? new TextDecoder().decode(entry.data)
    : await new Response(new Blob([entry.data]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).text();
  const xml = new DOMParser().parseFromString(text, "application/xml");
  if (xml.getElementsByTagName("parsererror").length) throw new Error(`invalid xml: ${name}`);
  return xml;
}

function xmlElements(node, name) {
  return [...node.getElementsByTagNameNS("*", name)];
}

// Text of a shared or inline string, joining rich-text runs and skipping phonetic hints.
function richText(node) {
  return xmlElements(node, "t").filter((text) => text.parentNode.localName !== "rPh").map((text) => text.textContent).join("");
}

function sheetRows(xml, shared) {
  return xmlElements(xml, "row").map((row, rowIndex) => {
    const cells = [];
    xmlElements(row, "c").forEach((cell, cellIndex) => {
      let column = 0;
      for (const letter of (cell.getAttribute("r") || "").replace(/[^A-Z]/g, "")) {
        column = column * 26 + letter.charCodeAt(0) - 64;
      }
      const type = cell.getAttribute("t") || "n";
      const raw = xmlElements(cell, "v")[0]?.textContent ?? "";
      let value = raw;
      if (type === "inlineStr") value = richText(cell);
      else if (type === "s") value = shared[Number(raw)] ?? "";
      else if (type === "n" && raw !== "" && Number.isFinite(Number(raw))) value = String(Number(raw));
      cells[column ? column - 1 : cellIndex] = trimText(
        value.replace(/_x([0-9a-f]{4})_/gi, (_, hex) => String.fromCharCode(parseInt(hex, 16))),
      );
    });
    return { number: Number(row.getAttribute("r")) || rowIndex + 1, cells };
  });
}

function collectTable(rows, sheetName, tables, errors) {
  const [header, ...body] = rows.filter((row) => row.cells.some(Boolean));
  if (!header) return;
  const labels = Array.from(header.cells, matchKey);
  const kind = ["variants", "items", "categories"].find(
    (key) => SHEETS[key].marks.some((mark) => labels.includes(matchKey(mark))),
  );
  if (!kind) return;
  if (tables[kind]) {
    errors.push(`بیش از یک برگه «${SHEETS[kind].name}» در فایل وجود دارد.`);
    return;
  }
  const fields = labels.map(
    (label) => SHEETS[kind].columns.find(([, title]) => matchKey(title) === label)?.[0] ?? null,
  );
  labels.forEach((label, index) => {
    if (label && !fields[index]) errors.push(`برگه «${sheetName}»: ستون «${header.cells[index]}» شناخته نشد.`);
  });
  tables[kind] = body.map(({ number, cells }) => {
    const values = {};
    fields.forEach((field, index) => {
      if (field && cells[index]) values[field] = cells[index];
    });
    return { row: number, values };
  }).filter(({ values }) => Object.keys(values).length > 0);
}

// Reads an .xlsx file into { tables: { categories, items, variants }, errors }.
// Throws when the file is not a readable workbook.
export async function readWorkbook(file) {
  if (file.size > MAX_FILE_BYTES) throw new Error("workbook too large");
  const entries = unzip(await file.arrayBuffer());
  const relations = xmlElements(await entryXml(entries, "xl/_rels/workbook.xml.rels"), "Relationship");
  const partPath = (target) => (target.startsWith("/") ? target.slice(1) : `xl/${target}`);
  const sharedTarget = relations
    .find((relation) => String(relation.getAttribute("Type")).endsWith("/sharedStrings"))?.getAttribute("Target");
  const shared = sharedTarget
    ? xmlElements(await entryXml(entries, partPath(sharedTarget)), "si").map(richText)
    : [];
  const tables = {};
  const errors = [];
  for (const sheet of xmlElements(await entryXml(entries, "xl/workbook.xml"), "sheet")) {
    const relationId = sheet.getAttributeNS(REL_NS, "id") || sheet.getAttribute("r:id");
    const target = relations.find((relation) => relation.getAttribute("Id") === relationId)?.getAttribute("Target");
    if (!target) continue;
    collectTable(sheetRows(await entryXml(entries, partPath(target)), shared), sheet.getAttribute("name"), tables, errors);
  }
  if (!Object.keys(tables).length) {
    errors.push("هیچ برگه‌ای با سرستون‌های قالب در فایل پیدا نشد. از «قالب خالی اکسل» یا «خروجی اکسل» استفاده کنید.");
  }
  return { tables, errors };
}

/* ---------- applying ---------- */

function nameIndex() {
  const entries = new Map();
  return {
    add(name, entity) {
      const key = matchKey(name);
      if (!entries.has(key)) entries.set(key, new Set());
      entries.get(key).add(entity);
    },
    find(name) {
      return [...(entries.get(matchKey(name)) || [])];
    },
  };
}

// Applies workbook rows to a copy of the menu. Rows address records by identifier, or by
// name when the identifier cell is blank; unmatched named rows create new records.
// Returns { errors } without a document when any row is invalid.
export function applyWorkbook(menu, { tables, errors: readErrors }, { canEditCategoryDescription = true } = {}) {
  const next = cloneDocument(menu);
  const errors = [...readErrors];
  const fail = (sheet, row, message) => {
    errors.push(`برگه «${SHEETS[sheet].name}»، ردیف ${faNumber.format(row)}: ${message}`);
  };

  const categoryById = new Map();
  const itemById = new Map();
  const optionById = new Map();
  // Old and new names both resolve, so a renamed record can still be referenced by either.
  const categoryNames = nameIndex();
  const itemNames = nameIndex();
  const categoryOf = new Map();
  const itemOf = new Map();
  const positions = new Map();
  const seen = new Set();
  const prices = [];

  function registerCategory(category) {
    categoryById.set(category.id.toLowerCase(), category);
    categoryNames.add(category.title, category);
  }
  function registerItem(item, category) {
    itemById.set(item.id.toLowerCase(), item);
    itemNames.add(item.name, item);
    categoryOf.set(item, category);
  }
  function registerOption(option, item) {
    optionById.set(option.id.toLowerCase(), option);
    itemOf.set(option, item);
  }
  for (const category of next.categories) {
    registerCategory(category);
    for (const item of category.items) {
      registerItem(item, category);
      prices.push(item.price);
      for (const option of item.options) {
        registerOption(option, item);
        prices.push(option.price);
      }
    }
  }
  // Excel stores typed numbers with Latin digits; keep the menu's Persian-digit prices consistent.
  const persianPrices = prices.some((price) => /[۰-۹]/.test(price ?? "")) && !prices.some((price) => /\d/.test(price ?? ""));
  const priceText = (value) => (value && persianPrices ? value.replace(/\d/g, (digit) => "۰۱۲۳۴۵۶۷۸۹"[digit]) : value);

  function withinLimits(sheet, row, values) {
    let valid = true;
    for (const [field, [limit, label]] of Object.entries(LIMITS)) {
      if (values[field] && [...values[field]].length > limit) {
        fail(sheet, row, `${label} نباید بیش از ${faNumber.format(limit)} نویسه باشد.`);
        valid = false;
      }
    }
    return valid;
  }
  function firstUse(sheet, row, entity) {
    if (seen.has(entity)) {
      fail(sheet, row, "این رکورد در ردیف دیگری از همین فایل هم آمده است.");
      return false;
    }
    seen.add(entity);
    return true;
  }
  function setText(target, field, value) {
    if (value && trimText(target[field]) !== value) target[field] = value;
  }
  function setPosition(sheet, row, target, value) {
    if (!value) return;
    const position = Number(value
      .replace(/[۰-۹]/g, (digit) => "۰۱۲۳۴۵۶۷۸۹".indexOf(digit))
      .replace(/[٠-٩]/g, (digit) => "٠١٢٣٤٥٦٧٨٩".indexOf(digit)));
    if (!Number.isInteger(position) || position < 1) {
      fail(sheet, row, `ترتیب «${value}» باید عدد صحیح مثبت باشد.`);
      return;
    }
    positions.set(target, position);
  }
  // Rows without a position keep their relative order; positioned rows are placed at it.
  function reorder(list) {
    const result = list.filter((entity) => !positions.has(entity));
    let floor = 0;
    for (const entity of list.filter((candidate) => positions.has(candidate)).sort((a, b) => positions.get(a) - positions.get(b))) {
      const index = Math.min(Math.max(positions.get(entity) - 1, floor), result.length);
      result.splice(index, 0, entity);
      floor = index + 1;
    }
    return result;
  }

  for (const { row, values } of tables.categories || []) {
    if (!withinLimits("categories", row, values)) continue;
    let category;
    if (values.id) {
      category = categoryById.get(values.id.toLowerCase());
      if (!category) {
        fail("categories", row, `شناسه دسته «${values.id}» در منو وجود ندارد. برای ساخت دسته جدید، خانه شناسه را خالی بگذارید.`);
        continue;
      }
    } else if (values.name) {
      const matches = categoryNames.find(values.name);
      if (matches.length > 1) {
        fail("categories", row, `چند دسته با نام «${values.name}» وجود دارد؛ شناسه دسته را وارد کنید.`);
        continue;
      }
      category = matches[0];
      if (!category) {
        category = Object.assign(blankCategory(), { title: values.name });
        next.categories.push(category);
        registerCategory(category);
      }
    } else {
      fail("categories", row, "شناسه دسته یا نام دسته لازم است.");
      continue;
    }
    if (!firstUse("categories", row, category)) continue;
    if (!canEditCategoryDescription && values.description && trimText(category.intro) !== values.description) {
      fail("categories", row, "تغییر توضیح دسته فقط با حساب مالک ممکن است.");
      continue;
    }
    setText(category, "title", values.name);
    if (values.name) categoryNames.add(values.name, category);
    setText(category, "intro", values.description);
    setPosition("categories", row, category, values.order);
  }

  for (const { row, values } of tables.items || []) {
    if (!withinLimits("items", row, values)) continue;
    let category = null;
    if (values.categoryId) {
      category = categoryById.get(values.categoryId.toLowerCase());
      if (!category) {
        fail("items", row, `شناسه دسته «${values.categoryId}» در منو وجود ندارد.`);
        continue;
      }
      if (values.category && !categoryNames.find(values.category).includes(category)) {
        fail("items", row, `نام دسته «${values.category}» با شناسه دسته هم‌خوان نیست؛ یکی را اصلاح یا خالی کنید.`);
        continue;
      }
    } else if (values.category) {
      const matches = categoryNames.find(values.category);
      if (matches.length !== 1) {
        fail("items", row, matches.length
          ? `چند دسته با نام «${values.category}» وجود دارد؛ شناسه دسته را وارد کنید.`
          : `دسته «${values.category}» پیدا نشد؛ آن را در برگه «${SHEETS.categories.name}» اضافه کنید.`);
        continue;
      }
      category = matches[0];
    }

    let item;
    if (values.id) {
      item = itemById.get(values.id.toLowerCase());
      if (!item) {
        fail("items", row, `شناسه آیتم «${values.id}» در منو وجود ندارد. برای ساخت آیتم جدید، خانه شناسه را خالی بگذارید.`);
        continue;
      }
    } else if (values.name) {
      const matches = itemNames.find(values.name)
        .filter((candidate) => !category || categoryOf.get(candidate) === category);
      if (matches.length > 1) {
        fail("items", row, `چند آیتم با نام «${values.name}» وجود دارد؛ شناسه آیتم را وارد کنید.`);
        continue;
      }
      item = matches[0];
      if (!item) {
        if (!category) {
          fail("items", row, `آیتم «${values.name}» در منو نیست؛ برای ساخت آن، نام دسته یا شناسه دسته لازم است.`);
          continue;
        }
        item = Object.assign(blankItem(), { name: values.name });
        category.items.push(item);
        registerItem(item, category);
      }
    } else {
      fail("items", row, "شناسه آیتم یا نام آیتم لازم است.");
      continue;
    }
    if (!firstUse("items", row, item)) continue;
    if (category && categoryOf.get(item) !== category) {
      const source = categoryOf.get(item);
      source.items = source.items.filter((candidate) => candidate !== item);
      category.items.push(item);
      categoryOf.set(item, category);
    }
    setText(item, "name", values.name);
    if (values.name) itemNames.add(values.name, item);
    setText(item, "description", values.description);
    setText(item, "price", priceText(values.price));
    setPosition("items", row, item, values.order);
  }

  for (const { row, values } of tables.variants || []) {
    if (!withinLimits("variants", row, values)) continue;
    let item = null;
    if (values.itemId) {
      item = itemById.get(values.itemId.toLowerCase());
      if (!item) {
        fail("variants", row, `شناسه آیتم «${values.itemId}» در منو وجود ندارد.`);
        continue;
      }
      if (values.item && !itemNames.find(values.item).includes(item)) {
        fail("variants", row, `نام آیتم «${values.item}» با شناسه آیتم هم‌خوان نیست؛ یکی را اصلاح یا خالی کنید.`);
        continue;
      }
    } else if (values.item) {
      const matches = itemNames.find(values.item);
      if (matches.length !== 1) {
        fail("variants", row, matches.length
          ? `چند آیتم با نام «${values.item}» وجود دارد؛ شناسه آیتم را وارد کنید.`
          : `آیتم «${values.item}» پیدا نشد؛ آن را در برگه «${SHEETS.items.name}» اضافه کنید.`);
        continue;
      }
      item = matches[0];
    }

    let option;
    if (values.id) {
      option = optionById.get(values.id.toLowerCase());
      if (!option) {
        fail("variants", row, `شناسه گزینه «${values.id}» در منو وجود ندارد. برای ساخت گزینه جدید، خانه شناسه را خالی بگذارید.`);
        continue;
      }
      if (item && itemOf.get(option) !== item) {
        fail("variants", row, "این گزینه به آیتم دیگری تعلق دارد؛ گزینه‌ها بین آیتم‌ها جابه‌جا نمی‌شوند.");
        continue;
      }
    } else {
      if (!item || !values.label) {
        fail("variants", row, "برای گزینه بدون شناسه، آیتم (شناسه یا نام) و عنوان گزینه لازم است.");
        continue;
      }
      const matches = item.options.filter((candidate) => matchKey(candidate.label) === matchKey(values.label));
      if (matches.length > 1) {
        fail("variants", row, `آیتم «${item.name}» چند گزینه با عنوان «${values.label}» دارد؛ شناسه گزینه را وارد کنید.`);
        continue;
      }
      option = matches[0];
      if (!option) {
        if (!values.price) {
          fail("variants", row, "برای گزینه جدید، قیمت لازم است.");
          continue;
        }
        option = { id: crypto.randomUUID(), label: values.label, price: priceText(values.price), code: null };
        item.options.push(option);
        registerOption(option, item);
      }
    }
    if (!firstUse("variants", row, option)) continue;
    setText(option, "label", values.label);
    setText(option, "price", priceText(values.price));
    setPosition("variants", row, option, values.order);
  }

  if (errors.length) return { errors };
  next.categories = reorder(next.categories);
  for (const category of next.categories) {
    category.items = reorder(category.items);
    for (const item of category.items) item.options = reorder(item.options);
  }
  return {
    errors,
    document: next,
    changed: editableSignature(next) !== editableSignature(menu),
    counts: Object.fromEntries(Object.keys(SHEETS).map((key) => [key, tables[key]?.length || 0])),
  };
}
