function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

export function cloneDocument(document) {
  return cloneJson(document);
}

export function normalizeDocument(document) {
  return {
    revision: Number(document.revision || 0),
    publishedRevision: Number(document.publishedRevision || 0),
    categories: Array.isArray(document.categories)
      ? document.categories.map((category) => ({
          ...category,
          intro: category.intro ?? null,
          archived: Boolean(category.archived),
          items: Array.isArray(category.items)
            ? category.items.map((item) => ({
                ...item,
                description: item.description ?? null,
                price: item.price ?? null,
                mediaId: item.mediaId ?? null,
                media: item.media ?? null,
                metadata: item.metadata ?? {},
                archived: Boolean(item.archived),
                options: Array.isArray(item.options) ? item.options : [],
              }))
            : [],
        }))
      : [],
  };
}

export function toSavePayload(document) {
  return {
    baseRevision: document.revision,
    categories: document.categories.map((category) => ({
      id: category.id,
      publicId: category.publicId,
      title: category.title,
      intro: category.intro,
      layout: category.layout,
      archived: category.archived,
      items: category.items.map((item) => ({
        id: item.id,
        publicId: item.publicId,
        name: item.name,
        description: item.description,
        price: item.price,
        mediaId: item.mediaId,
        metadata: item.metadata,
        archived: item.archived,
        options: item.options.map((option) => ({
          id: option.id,
          label: option.label,
          price: option.price,
          code: option.code,
        })),
      })),
    })),
  };
}

export function editableSignature(document) {
  return JSON.stringify(toSavePayload(document));
}

function comparableCategory(category) {
  return {
    title: category.title,
    intro: category.intro,
    layout: category.layout,
    archived: category.archived,
  };
}

function comparableItem(item, categoryId, sortOrder) {
  return {
    categoryId,
    sortOrder,
    name: item.name,
    description: item.description,
    price: item.price,
    mediaId: item.mediaId,
    metadata: item.metadata,
    archived: item.archived,
    options: item.options,
  };
}

export function documentChangeCount(document, savedDocument) {
  if (!document || !savedDocument) return 0;

  let count = 0;
  const currentCategoryOrder = document.categories.map((category) => category.id);
  const savedCategoryOrder = savedDocument.categories.map((category) => category.id);
  if (JSON.stringify(currentCategoryOrder) !== JSON.stringify(savedCategoryOrder)) count += 1;

  const currentCategories = new Map(document.categories.map((category) => [category.id, category]));
  const savedCategories = new Map(savedDocument.categories.map((category) => [category.id, category]));
  const categoryIds = new Set([...currentCategories.keys(), ...savedCategories.keys()]);
  for (const categoryId of categoryIds) {
    const current = currentCategories.get(categoryId);
    const saved = savedCategories.get(categoryId);
    if (!current || !saved || JSON.stringify(comparableCategory(current)) !== JSON.stringify(comparableCategory(saved))) {
      count += 1;
    }
  }

  const collectItems = (source) => {
    const items = new Map();
    for (const category of source.categories) {
      category.items.forEach((item, index) => {
        items.set(item.id, comparableItem(item, category.id, index));
      });
    }
    return items;
  };
  const currentItems = collectItems(document);
  const savedItems = collectItems(savedDocument);
  const itemIds = new Set([...currentItems.keys(), ...savedItems.keys()]);
  for (const itemId of itemIds) {
    if (JSON.stringify(currentItems.get(itemId)) !== JSON.stringify(savedItems.get(itemId))) {
      count += 1;
    }
  }

  return count;
}

export function firstDocumentIssue(document) {
  for (const category of document.categories) {
    if (!category.title.trim()) return "نام همه دسته‌بندی‌ها باید وارد شود.";
    for (const item of category.items) {
      if (!item.name.trim()) return "نام همه آیتم‌ها باید وارد شود.";
    }
  }
  return null;
}

export function updateCategory(document, categoryId, patch) {
  return {
    ...document,
    categories: document.categories.map((category) =>
      category.id === categoryId ? { ...category, ...patch } : category,
    ),
  };
}

export function updateItem(document, categoryId, itemId, patch) {
  return {
    ...document,
    categories: document.categories.map((category) => {
      if (category.id !== categoryId) return category;
      return {
        ...category,
        items: category.items.map((item) =>
          item.id === itemId ? { ...item, ...patch } : item,
        ),
      };
    }),
  };
}

function moveInArray(values, fromIndex, toIndex) {
  if (fromIndex === toIndex || fromIndex < 0 || toIndex < 0) return values;
  const next = values.slice();
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export function moveCategory(document, categoryId, overCategoryId) {
  const fromIndex = document.categories.findIndex((category) => category.id === categoryId);
  const toIndex = document.categories.findIndex((category) => category.id === overCategoryId);
  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return document;
  return { ...document, categories: moveInArray(document.categories, fromIndex, toIndex) };
}

export function moveCategoryByOffset(document, categoryId, offset) {
  const fromIndex = document.categories.findIndex((category) => category.id === categoryId);
  const toIndex = Math.max(0, Math.min(document.categories.length - 1, fromIndex + offset));
  if (fromIndex < 0 || fromIndex === toIndex) return document;
  return { ...document, categories: moveInArray(document.categories, fromIndex, toIndex) };
}

export function moveItem(document, itemId, targetCategoryId, overItemId = null) {
  let sourceCategoryId = null;
  let sourceItem = null;
  for (const category of document.categories) {
    const item = category.items.find((candidate) => candidate.id === itemId);
    if (item) {
      sourceCategoryId = category.id;
      sourceItem = item;
      break;
    }
  }
  if (!sourceItem || !sourceCategoryId) return document;

  if (sourceCategoryId === targetCategoryId) {
    const category = document.categories.find((candidate) => candidate.id === sourceCategoryId);
    const fromIndex = category.items.findIndex((item) => item.id === itemId);
    const toIndex = overItemId
      ? category.items.findIndex((item) => item.id === overItemId)
      : category.items.length - 1;
    if (fromIndex === toIndex || toIndex < 0) return document;
    return updateCategory(document, category.id, {
      items: moveInArray(category.items, fromIndex, toIndex),
    });
  }

  const targetCategory = document.categories.find((category) => category.id === targetCategoryId);
  if (!targetCategory) return document;
  const targetItems = targetCategory.items.slice();
  const targetIndex = overItemId
    ? targetItems.findIndex((item) => item.id === overItemId)
    : targetItems.length;
  targetItems.splice(targetIndex < 0 ? targetItems.length : targetIndex, 0, sourceItem);

  return {
    ...document,
    categories: document.categories.map((category) => {
      if (category.id === sourceCategoryId) {
        return { ...category, items: category.items.filter((item) => item.id !== itemId) };
      }
      if (category.id === targetCategoryId) {
        return { ...category, items: targetItems };
      }
      return category;
    }),
  };
}

export function createCategory(document) {
  const id = crypto.randomUUID();
  const category = {
    id,
    publicId: `category-${id.replaceAll("-", "").slice(0, 12)}`,
    title: "دسته‌بندی جدید",
    intro: null,
    layout: "grid",
    archived: false,
    items: [],
    _expanded: true,
  };
  return {
    document: { ...document, categories: [...document.categories, category] },
    categoryId: id,
  };
}

export function createItem(document, categoryId) {
  const id = crypto.randomUUID();
  const item = {
    id,
    publicId: `item-${id.replaceAll("-", "").slice(0, 12)}`,
    name: "آیتم جدید",
    description: null,
    price: null,
    mediaId: null,
    media: null,
    metadata: {},
    archived: false,
    options: [],
  };
  return {
    document: {
      ...document,
      categories: document.categories.map((category) =>
        category.id === categoryId
          ? { ...category, items: [...category.items, item] }
          : category,
      ),
    },
    itemId: id,
  };
}

export function documentCounts(document) {
  let activeItems = 0;
  let archivedItems = 0;
  for (const category of document.categories) {
    for (const item of category.items) {
      if (item.archived) archivedItems += 1;
      else activeItems += 1;
    }
  }
  return {
    categories: document.categories.length,
    activeItems,
    archivedItems,
  };
}
