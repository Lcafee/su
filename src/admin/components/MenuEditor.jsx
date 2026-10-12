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

const validVisibilities = new Set(FILTERS.map((filter) => filter.value));
const viewStoragePrefix = "l-cafe-admin:view:v1:";

export function menuEditorViewStorageKey(user) {
  if (!user?.username || !user?.role) return null;
  return `${viewStoragePrefix}${encodeURIComponent(user.username)}:${encodeURIComponent(user.role)}`;
}

export function clearMenuEditorViewState(storageKey = null) {
  if (typeof window === "undefined") return;
  try {
    if (storageKey) {
      window.sessionStorage.removeItem(storageKey);
      return;
    }
    for (let index = window.sessionStorage.length - 1; index >= 0; index -= 1) {
      const key = window.sessionStorage.key(index);
      if (key?.startsWith(viewStoragePrefix)) window.sessionStorage.removeItem(key);
    }
  } catch {
    // Session storage can be unavailable; view continuity must never block editing.
  }
}

function readMenuEditorViewState(storageKey, advanced) {
  const fallback = {
    query: "",
    visibility: advanced ? "all" : "active",
    quickCategoryId: "",
  };
  if (!storageKey || typeof window === "undefined") return fallback;
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(storageKey));
    if (!stored || typeof stored !== "object") return fallback;
    return {
      query: typeof stored.query === "string" ? stored.query : fallback.query,
      visibility: validVisibilities.has(stored.visibility) ? stored.visibility : fallback.visibility,
      quickCategoryId: typeof stored.quickCategoryId === "string" ? stored.quickCategoryId : "",
    };
  } catch {
    return fallback;
  }
}

function writeMenuEditorViewState(storageKey, viewState) {
  if (!storageKey || typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(storageKey, JSON.stringify({
      query: viewState.query,
      visibility: viewState.visibility,
      quickCategoryId: viewState.quickCategoryId,
    }));
  } catch {
    // Editing remains available when session storage is disabled or full.
  }
}

function itemMatches(item, query) {
  return [item.name, item.price, item.description, ...item.options.flatMap((option) => [option.label, option.price])]
    .filter(Boolean)
    .some((value) => String(value).toLocaleLowerCase("fa").includes(query));
}

export function MenuEditor({
  document,
  categoryChoices,
  uploadingIds,
  disabled,
  advanced,
  storageKey,
  focusTarget,
  titleControls,
  toolbarActions,
  onUpdateCategory,
  onUpdateItem,
  onMoveCategory,
  onMoveCategoryByOffset,
  onMoveItem,
  onUpload,
  onCreateCategory,
  onCreateItem,
  onDeleteItem,
  onDeleteCategory,
}) {
  const defaultVisibility = advanced ? "all" : "active";
  const [viewState, setViewState] = useState(() => readMenuEditorViewState(storageKey, advanced));
  const [navigationTarget, setNavigationTarget] = useState(null);
  // The single open category; the side navigation highlights the same one.
  const [activeCategoryId, setActiveCategoryId] = useState(() => document.categories[0]?.id ?? null);
  const [handledFocusTarget, setHandledFocusTarget] = useState(focusTarget);
  if (focusTarget !== handledFocusTarget) {
    setHandledFocusTarget(focusTarget);
    if (focusTarget) setActiveCategoryId(focusTarget.type === "item" ? focusTarget.categoryId : focusTarget.id);
  }
  const { query, visibility, quickCategoryId } = viewState;
  const availableCategories = useMemo(
    () => categoryChoices.filter((category) => !category.archived),
    [categoryChoices],
  );
  const deferredQuery = useDeferredValue(query);
  const normalizedQuery = deferredQuery.trim().toLocaleLowerCase("fa");

  useEffect(() => {
    setViewState((current) => ({ ...current, query: "", visibility: advanced ? "all" : "active" }));
  }, [advanced]);

  useEffect(() => {
    writeMenuEditorViewState(storageKey, viewState);
  }, [storageKey, viewState]);

  useEffect(() => {
    if (availableCategories.some((category) => category.id === quickCategoryId)) return;
    const fallbackCategoryId = availableCategories[0]?.id || "";
    setViewState((current) => (
      current.quickCategoryId === fallbackCategoryId
        ? current
        : { ...current, quickCategoryId: fallbackCategoryId }
    ));
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
  const hasFilteredView = Boolean(normalizedQuery) || visibility !== "all";
  const categoryDragIds = visibleCategories.map(({ category }) => `category:${category.id}`);

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
    prepareViewForCreatedEntity();
    onCreateCategory();
  }

  function prepareViewForCreatedEntity() {
    setViewState((current) => ({
      ...current,
      query: current.query.trim() ? "" : current.query,
      visibility: current.visibility === "archived" ? defaultVisibility : current.visibility,
    }));
  }

  function handleCreateItem(categoryId) {
    if (!categoryId) return;
    prepareViewForCreatedEntity();
    onCreateItem(categoryId);
  }

  function handleResetView() {
    setViewState((current) => ({ ...current, query: "", visibility: "all" }));
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <section className="editor-workspace" aria-labelledby="menu-editor-title">
        <div className="editor-toolbar">
          <div className="editor-title">
            <h2 id="menu-editor-title">ویرایش منو</h2>
            {titleControls}
          </div>
          <div className="editor-toolbar-actions">
            {toolbarActions}
            <button type="button" className="secondary-button" onClick={handleCreateCategory} disabled={disabled}>
              دسته‌بندی جدید
            </button>
          </div>
        </div>

        <div className="editor-controls">
          <label className="search-control">
            <span>جست‌وجوی منو</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setViewState((current) => ({ ...current, query: event.target.value }))}
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
                  onClick={() => setViewState((current) => ({ ...current, visibility: filter.value }))}
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
                onChange={(event) => setViewState((current) => ({
                  ...current,
                  quickCategoryId: event.target.value,
                }))}
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
              onClick={() => handleCreateItem(quickCategoryId)}
              disabled={disabled || !quickCategoryId}
            >
              آیتم جدید
            </button>
          </div>
        </div>

        {hasFilteredView ? (
          <div className="editor-results-bar">
            <button
              type="button"
              className="text-button"
              onClick={handleResetView}
            >
              پاک کردن جست‌وجو و نمایش همه
            </button>
          </div>
        ) : null}

        <div className="editor-navigation-layout">
          <nav className="category-navigation" aria-label="رفتن به دسته‌بندی">
            <h3>دسته‌بندی‌ها</h3>
            <div>{categoryChoices.map((category) => (
              <button type="button" key={category.id} aria-controls={`admin-category-${category.id}`}
                aria-current={activeCategoryId === category.id ? "location" : undefined}
                onClick={() => {
                  setActiveCategoryId(category.id);
                  setViewState((current) => ({ ...current, query: "", visibility: "all" }));
                  setNavigationTarget({ id: category.id, sequence: (navigationTarget?.sequence || 0) + 1 });
                }}>
                <span>{category.title || "دسته بدون نام"}</span>
                {category.archived ? <small>آرشیوی</small> : null}
              </button>
            ))}</div>
          </nav>
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
                  onCreateItem={handleCreateItem}
                  onDeleteItem={onDeleteItem}
                  onDeleteCategory={onDeleteCategory}
                  navigationTarget={navigationTarget}
                  expanded={activeCategoryId === category.id}
                  onToggle={(categoryId) => setActiveCategoryId((current) => (current === categoryId ? null : categoryId))}
                />
              );
            })}
          </div>
        </SortableContext>
        </div>
      </section>
    </DndContext>
  );
}
