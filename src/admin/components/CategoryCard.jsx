import { memo, useState } from "react";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { ItemCard } from "./ItemCard";

function CategoryCardComponent({
  category,
  index,
  categoryCount,
  categoryChoices,
  disabled,
  uploadingIds,
  onUpdateCategory,
  onUpdateItem,
  onMoveItem,
  onUpload,
  onMoveCategoryByOffset,
}) {
  const [expanded, setExpanded] = useState(Boolean(category._expanded) || index === 0);
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
    disabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const itemDragIds = category.items.map((item) => `item:${item.id}`);

  return (
    <section
      ref={setNodeRef}
      style={style}
      className={`category-card${category.archived ? " is-archived" : ""}${isDragging ? " is-dragging" : ""}`}
    >
      <header className="category-header">
        <button
          type="button"
          className="drag-handle category-drag-handle"
          aria-label={`جابجایی دسته ${category.title}`}
          title="برای جابجایی دسته بکشید"
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <span aria-hidden="true">⠿</span>
        </button>
        <button
          type="button"
          className="category-toggle"
          aria-expanded={expanded}
          onClick={() => setExpanded((current) => !current)}
        >
          <span className="category-title-line">
            <strong>{category.title || "دسته بدون نام"}</strong>
            {category.archived ? <span className="archive-badge">آرشیو شده</span> : null}
          </span>
          <span className="category-count">{category.items.length} آیتم</span>
          <span className="chevron" aria-hidden="true">{expanded ? "−" : "+"}</span>
        </button>
        <div className="category-header-actions">
          <button
            type="button"
            className="icon-button"
            aria-label="انتقال دسته به بالا"
            onClick={() => onMoveCategoryByOffset(category.id, -1)}
            disabled={disabled || index === 0}
          >↑</button>
          <button
            type="button"
            className="icon-button"
            aria-label="انتقال دسته به پایین"
            onClick={() => onMoveCategoryByOffset(category.id, 1)}
            disabled={disabled || index === categoryCount - 1}
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

      {expanded ? (
        <div className="category-body">
          {category.archived ? (
            <p className="archive-explainer">این دسته و همه آیتم‌هایش در منوی عمومی نمایش داده نمی‌شوند.</p>
          ) : null}
          <div className="category-fields">
            <label>
              <span>نام دسته</span>
              <input
                dir="auto"
                value={category.title}
                onChange={(event) => onUpdateCategory(category.id, { title: event.target.value })}
                disabled={disabled}
                maxLength="191"
              />
            </label>
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
            <label className="wide-field">
              <span>توضیح کوتاه دسته</span>
              <textarea
                dir="auto"
                rows="2"
                value={category.intro ?? ""}
                onChange={(event) => onUpdateCategory(category.id, { intro: event.target.value || null })}
                disabled={disabled}
                maxLength="4000"
              />
            </label>
          </div>

          <SortableContext items={itemDragIds} strategy={verticalListSortingStrategy}>
            <div className="item-list">
              {category.items.length === 0 ? (
                <p className="empty-category">این دسته خالی است. یک آیتم را اینجا بکشید یا از انتخاب‌گر دسته استفاده کنید.</p>
              ) : null}
              {category.items.map((item) => (
                <ItemCard
                  key={item.id}
                  item={item}
                  categoryId={category.id}
                  categoryChoices={categoryChoices}
                  disabled={disabled}
                  uploading={uploadingIds.has(item.id)}
                  onUpdate={onUpdateItem}
                  onMove={onMoveItem}
                  onUpload={onUpload}
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
