import { useDeferredValue, useEffect, useMemo, useState } from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";

import { CategoryCard } from "./CategoryCard";

const FILTERS = [
  { value: "active", label: "فعال" },
  { value: "archived", label: "آرشیوی" },
  { value: "all", label: "همه" },
];

const faNumber = new Intl.NumberFormat("fa-IR");

function itemMatches(item, query) {
  return [item.name, item.price, item.description]
    .filter(Boolean)
    .some((value) => String(value).toLocaleLowerCase("fa").includes(query));
}

export function MenuEditor({
  document,
  categoryChoices,
  uploadingIds,
  disabled,
  advanced,
  focusTarget,
  onUpdateCategory,
  onUpdateItem,
  onMoveCategory,
  onMoveCategoryByOffset,
  onMoveItem,
  onUpload,
  onCreateCategory,
  onCreateItem,
}) {
  const [query, setQuery] = useState("");
  const [visibility, setVisibility] = useState(advanced ? "all" : "active");
  const availableCategories = useMemo(
    () => categoryChoices.filter((category) => !category.archived),
    [categoryChoices],
  );
  const [quickCategoryId, setQuickCategoryId] = useState(() => availableCategories[0]?.id || "");
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLocaleLowerCase("fa");

  useEffect(() => {
    if (availableCategories.some((category) => category.id === quickCategoryId)) return;
    setQuickCategoryId(availableCategories[0]?.id || "");
  }, [availableCategories, quickCategoryId]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const visibleCategories = useMemo(() => document.categories.flatMap((category) => {
    const categoryArchived = category.archived;
    const categoryMatches = category.title.toLocaleLowerCase("fa").includes(normalizedQuery);
    const statusItems = category.items.filter((item) => {
      if (visibility === "all") return true;
      if (visibility === "active") return !categoryArchived && !item.archived;
      return categoryArchived || item.archived;
    });
    const visibleItems = normalizedQuery && !categoryMatches
      ? statusItems.filter((item) => itemMatches(item, normalizedQuery))
      : statusItems;
    const categoryMatchesStatus = visibility === "all"
      || (visibility === "active" && !categoryArchived)
      || (visibility === "archived" && (categoryArchived || statusItems.length > 0));
    const shouldShow = categoryMatchesStatus
      && (categoryMatches || visibleItems.length > 0 || (!normalizedQuery && visibility !== "archived"));
    return shouldShow ? [{ category, visibleItems }] : [];
  }), [document.categories, normalizedQuery, visibility]);

  const reorderDisabled = disabled || Boolean(normalizedQuery) || visibility !== "all";
  const categoryDragIds = visibleCategories.map(({ category }) => `category:${category.id}`);
  const visibleItemCount = visibleCategories.reduce((total, entry) => total + entry.visibleItems.length, 0);

  function handleDragEnd({ active, over }) {
    if (reorderDisabled || !over || active.id === over.id) return;
    const activeData = active.data.current;
    const overData = over.data.current;
    if (!activeData || !overData) return;

    if (activeData.type === "category") {
      const targetCategoryId = overData.categoryId;
      if (targetCategoryId) onMoveCategory(activeData.categoryId, targetCategoryId);
      return;
    }

    if (activeData.type === "item") {
      const targetCategoryId = overData.categoryId;
      if (!targetCategoryId) return;
      onMoveItem(
        activeData.itemId,
        targetCategoryId,
        overData.type === "item" ? overData.itemId : null,
      );
    }
  }

  function handleCreateCategory() {
    setQuery("");
    setVisibility(advanced ? "all" : "active");
    onCreateCategory();
  }

  function handleQuickCreateItem() {
    if (!quickCategoryId) return;
    setQuery("");
    setVisibility(advanced ? "all" : "active");
    onCreateItem(quickCategoryId);
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <section className="editor-workspace" aria-labelledby="menu-editor-title">
        <div className="editor-toolbar">
          <div>
            <h2 id="menu-editor-title">ویرایش روزانه منو</h2>
            <p>آیتم را پیدا کنید، همان‌جا تغییر دهید و در پایان ذخیره و انتشار را بزنید.</p>
          </div>
          <button type="button" className="secondary-button" onClick={handleCreateCategory} disabled={disabled}>
            دسته‌بندی جدید
          </button>
        </div>

        <div className="editor-controls">
          <label className="search-control">
            <span>جست‌وجوی منو</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="نام آیتم، دسته یا قیمت"
            />
          </label>

          <fieldset className="visibility-filter">
            <legend>نمایش</legend>
            <div>
              {FILTERS.map((filter) => (
                <button
                  key={filter.value}
                  type="button"
                  className={visibility === filter.value ? "is-active" : ""}
                  aria-pressed={visibility === filter.value}
                  onClick={() => setVisibility(filter.value)}
                >
                  {filter.label}
                </button>
              ))}
            </div>
          </fieldset>

          <div className="quick-create">
            <label>
              <span>افزودن سریع آیتم به</span>
              <select
                value={quickCategoryId}
                onChange={(event) => setQuickCategoryId(event.target.value)}
                disabled={disabled || availableCategories.length === 0}
              >
                {availableCategories.map((category) => (
                  <option key={category.id} value={category.id}>{category.title}</option>
                ))}
              </select>
            </label>
            <button
              type="button"
              className="primary-button"
              onClick={handleQuickCreateItem}
              disabled={disabled || !quickCategoryId}
            >
              آیتم جدید
            </button>
          </div>
        </div>

        <div className="editor-results-bar" aria-live="polite">
          <span>{faNumber.format(visibleCategories.length)} دسته و {faNumber.format(visibleItemCount)} آیتم</span>
          {reorderDisabled && !disabled ? (
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setQuery("");
                setVisibility("all");
              }}
            >
              نمایش همه برای تغییر ترتیب
            </button>
          ) : (
            <span className="reorder-hint">برای تغییر ترتیب از دستگیره یا دکمه‌های جابجایی استفاده کنید.</span>
          )}
        </div>

        <SortableContext items={categoryDragIds} strategy={verticalListSortingStrategy}>
          <div className="category-list">
            {visibleCategories.length === 0 ? (
              <div className="empty-results">
                <strong>موردی پیدا نشد</strong>
                <span>عبارت جست‌وجو یا فیلتر نمایش را تغییر دهید.</span>
              </div>
            ) : null}
            {visibleCategories.map(({ category, visibleItems }) => {
              const originalIndex = document.categories.findIndex((candidate) => candidate.id === category.id);
              return (
                <CategoryCard
                  key={category.id}
                  category={category}
                  visibleItems={visibleItems}
                  index={originalIndex}
                  categoryCount={document.categories.length}
                  categoryChoices={categoryChoices}
                  disabled={disabled}
                  reorderDisabled={reorderDisabled}
                  autoExpand={Boolean(normalizedQuery)}
                  advanced={advanced}
                  focusTarget={focusTarget}
                  uploadingIds={uploadingIds}
                  onUpdateCategory={onUpdateCategory}
                  onUpdateItem={onUpdateItem}
                  onMoveItem={onMoveItem}
                  onUpload={onUpload}
                  onMoveCategoryByOffset={onMoveCategoryByOffset}
                  onCreateItem={onCreateItem}
                />
              );
            })}
          </div>
        </SortableContext>
      </section>
    </DndContext>
  );
}
