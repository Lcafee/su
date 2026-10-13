import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
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

import { readMenuEditorViewState, writeMenuEditorViewState } from "../editorViewState";
import { CategoryCard } from "./CategoryCard";

const FILTERS = [
  { value: "active", label: "فعال" },
  { value: "archived", label: "آرشیوی" },
  { value: "all", label: "همه" },
];

// Module constants: dnd-kit memoizes sensors by option identity, and a new sensor
// set re-renders every draggable card through its context.
const POINTER_SENSOR_OPTIONS = { activationConstraint: { distance: 8 } };
const KEYBOARD_SENSOR_OPTIONS = { coordinateGetter: sortableKeyboardCoordinates };

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
    useSensor(PointerSensor, POINTER_SENSOR_OPTIONS),
    useSensor(KeyboardSensor, KEYBOARD_SENSOR_OPTIONS),
  );

  // Editing one item replaces only its category object, so results for the others are
  // reused by identity and their memoized cards skip the render.
  const visibleCache = useRef(new WeakMap());
  const visibleCategories = useMemo(() => document.categories.flatMap((category) => {
    const cached = visibleCache.current.get(category);
    if (cached && cached.query === normalizedQuery && cached.visibility === visibility) return cached.entry;
    const entry = visibleEntry(category);
    visibleCache.current.set(category, { query: normalizedQuery, visibility, entry });
    return entry;
  }), [document.categories, normalizedQuery, visibility]);

  function visibleEntry(category) {
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
  }

  const reorderDisabled = disabled || Boolean(normalizedQuery) || visibility !== "all";
  const hasFilteredView = Boolean(normalizedQuery) || visibility !== "all";
  // Same reason as the item ids in CategoryCard: a new array here re-renders every
  // sortable category through dnd-kit's context.
  const categoryIdsKey = JSON.stringify(visibleCategories.map(({ category }) => category.id));
  const categoryDragIds = useMemo(
    () => JSON.parse(categoryIdsKey).map((id) => `category:${id}`),
    [categoryIdsKey],
  );

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

  // These reach the memoized category and item cards, so their identity stays stable
  // across the re-render every keystroke causes.
  const prepareViewForCreatedEntity = useCallback(() => {
    setViewState((current) => ({
      ...current,
      query: current.query.trim() ? "" : current.query,
      visibility: current.visibility === "archived" ? defaultVisibility : current.visibility,
    }));
  }, [defaultVisibility]);

  function handleCreateCategory() {
    prepareViewForCreatedEntity();
    onCreateCategory();
  }

  const handleCreateItem = useCallback((categoryId) => {
    if (!categoryId) return;
    prepareViewForCreatedEntity();
    onCreateItem(categoryId);
  }, [onCreateItem, prepareViewForCreatedEntity]);

  const handleToggleCategory = useCallback((categoryId) => {
    setActiveCategoryId((current) => (current === categoryId ? null : categoryId));
  }, []);

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
                  onToggle={handleToggleCategory}
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
