import { memo, useEffect, useRef, useState } from "react";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { ItemCard } from "./ItemCard";

const faNumber = new Intl.NumberFormat("fa-IR");

function CategoryCardComponent({
  category,
  visibleItems,
  index,
  categoryCount,
  categoryChoices,
  disabled,
  reorderDisabled,
  autoExpand,
  advanced,
  focusTarget,
  uploadingIds,
  onUpdateCategory,
  onUpdateItem,
  onMoveItem,
  onUpload,
  onMoveCategoryByOffset,
  onCreateItem,
  onDeleteItem,
  onDeleteCategory,
  navigationTarget,
}) {
  const [expanded, setExpanded] = useState(Boolean(category._expanded) || index === 0);
  const categoryTitleRef = useRef(null);
  const sectionRef = useRef(null);
  const handledNavigation = useRef(null);
  const dragId = `category:${category.id}`;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: dragId,
    data: { type: "category", categoryId: category.id },
    disabled: disabled || reorderDisabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const itemDragIds = visibleItems.map((item) => `item:${item.id}`);

  useEffect(() => {
    if (navigationTarget?.id === category.id) setExpanded(true);
  }, [category.id, navigationTarget]);

  useEffect(() => {
    if (navigationTarget?.id !== category.id || !expanded || handledNavigation.current === navigationTarget.sequence) return undefined;
    const frame = requestAnimationFrame(() => {
      sectionRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
      categoryTitleRef.current?.focus({ preventScroll: true });
      handledNavigation.current = navigationTarget.sequence;
    });
    return () => cancelAnimationFrame(frame);
  }, [category.id, expanded, navigationTarget]);

  useEffect(() => {
    const targetsCategory = focusTarget?.type === "category" && focusTarget.id === category.id;
    const targetsItem = focusTarget?.type === "item" && focusTarget.categoryId === category.id;
    if (!targetsCategory && !targetsItem) return undefined;
    setExpanded(true);
    if (!targetsCategory) return undefined;
    const frame = requestAnimationFrame(() => {
      categoryTitleRef.current?.focus();
      categoryTitleRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [category.id, focusTarget]);

  const displayExpanded = advanced || autoExpand || expanded;
  const countLabel = visibleItems.length === category.items.length
    ? `${faNumber.format(category.items.length)} آیتم`
    : `${faNumber.format(visibleItems.length)} از ${faNumber.format(category.items.length)} آیتم`;

  return (
    <section
      ref={(node) => { setNodeRef(node); sectionRef.current = node; }}
      id={`admin-category-${category.id}`}
      style={style}
      className={`category-card${category.archived ? " is-archived" : ""}${isDragging ? " is-dragging" : ""}`}
    >
      <header className="category-header">
        <button
          type="button"
          className="drag-handle category-drag-handle"
          aria-label={`جابجایی دسته ${category.title}`}
          title={reorderDisabled ? "برای جابجایی، همه موارد را نمایش دهید" : "برای جابجایی دسته بکشید"}
          disabled={disabled || reorderDisabled}
          {...attributes}
          {...listeners}
        >
          <span aria-hidden="true">⠿</span>
        </button>
        <button
          type="button"
          className="category-toggle"
          aria-expanded={displayExpanded}
          aria-disabled={advanced || autoExpand || undefined}
          title={autoExpand ? "نتیجه‌های جست‌وجو موقتاً باز هستند" : undefined}
          onClick={() => {
            if (!advanced && !autoExpand) setExpanded((current) => !current);
          }}
        >
          <span className="category-title-line">
            <strong>{category.title || "دسته بدون نام"}</strong>
            {category.archived ? <span className="archive-badge">آرشیو شده</span> : null}
          </span>
          <span className="category-count">{countLabel}</span>
          <span className="chevron" aria-hidden="true">{displayExpanded ? "−" : "+"}</span>
        </button>
        <div className="category-header-actions">
          <button type="button" className="quiet-button danger-button" disabled={disabled || uploadingIds.size > 0}
            onClick={() => onDeleteCategory(category.id)}>حذف دسته</button>
          <button
            type="button"
            className="icon-button"
            aria-label="انتقال دسته به بالا"
            onClick={() => onMoveCategoryByOffset(category.id, -1)}
            disabled={disabled || reorderDisabled || index === 0}
          >↑</button>
          <button
            type="button"
            className="icon-button"
            aria-label="انتقال دسته به پایین"
            onClick={() => onMoveCategoryByOffset(category.id, 1)}
            disabled={disabled || reorderDisabled || index === categoryCount - 1}
          >↓</button>
          <button
            type="button"
            className={category.archived ? "quiet-button restore-button" : "quiet-button danger-button"}
            onClick={() => onUpdateCategory(category.id, { archived: !category.archived })}
            disabled={disabled}
          >
            {category.archived ? "بازگردانی" : "آرشیو"}
          </button>
        </div>
      </header>

      {displayExpanded ? (
        <div className="category-body">
          {category.archived ? (
            <p className="archive-explainer">این دسته و همه آیتم‌هایش در منوی عمومی نمایش داده نمی‌شوند.</p>
          ) : null}
          <div className="category-fields">
            <label>
              <span>نام دسته</span>
              <input
                ref={categoryTitleRef}
                dir="auto"
                value={category.title}
                onChange={(event) => onUpdateCategory(category.id, { title: event.target.value })}
                disabled={disabled}
                maxLength="191"
              />
            </label>
            {advanced ? <label className="wide-field">
              <span>توضیح کوتاه دسته</span>
              <textarea
                dir="auto"
                rows="2"
                value={category.intro ?? ""}
                onChange={(event) => onUpdateCategory(category.id, { intro: event.target.value || null })}
                disabled={disabled}
                maxLength="4000"
              />
            </label> : null}
          </div>

          {advanced ? (
            <section className="owner-settings">
              <div className="category-fields owner-settings-fields">
                <label>
                  <span>نوع نمایش</span>
                  <select
                    value={category.layout}
                    onChange={(event) => onUpdateCategory(category.id, { layout: event.target.value })}
                    disabled={disabled}
                  >
                    <option value="grid">کارت‌های منو</option>
                    <option value="addons">فهرست افزودنی‌ها</option>
                  </select>
                </label>
              </div>
            </section>
          ) : null}

          <div className="category-item-actions">
            <button
              type="button"
              className="secondary-button"
              onClick={() => onCreateItem(category.id)}
              disabled={disabled || category.archived}
            >
              آیتم جدید در این دسته
            </button>
          </div>

          <SortableContext items={itemDragIds} strategy={verticalListSortingStrategy}>
            <div className="item-list">
              {visibleItems.length === 0 ? (
                <p className="empty-category">
                  {category.items.length === 0
                    ? "این دسته خالی است. یک آیتم جدید بسازید یا آیتمی را از دسته دیگر منتقل کنید."
                    : "در فیلتر فعلی آیتمی از این دسته نمایش داده نمی‌شود."}
                </p>
              ) : null}
              {visibleItems.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  categoryId={category.id}
                  categoryChoices={categoryChoices}
                  disabled={disabled}
                  reorderDisabled={reorderDisabled}
                  advanced={advanced}
                  focusTarget={focusTarget}
                  uploading={uploadingIds.has(item.id)}
                  onUpdate={onUpdateItem}
                  onMove={onMoveItem}
                  onUpload={onUpload}
                  onDelete={onDeleteItem}
                />
              ))}
            </div>
          </SortableContext>
        </div>
      ) : null}
    </section>
  );
}

export const CategoryCard = memo(CategoryCardComponent);
