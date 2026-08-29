import { memo, useEffect, useRef, useState } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { MetadataEditor } from "./MetadataEditor";

function ItemCardComponent({
  item,
  categoryId,
  categoryChoices,
  disabled,
  reorderDisabled,
  advanced,
  focusTarget,
  uploading,
  onUpdate,
  onMove,
  onUpload,
}) {
  const [expanded, setExpanded] = useState(false);
  const nameInputRef = useRef(null);
  const dragId = `item:${item.id}`;
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({
    id: dragId,
    data: { type: "item", itemId: item.id, categoryId },
    disabled: disabled || reorderDisabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const previewUrl = item.media?.urls?.["300"] || item.media?.urls?.["600"] || null;
  const fileInputId = `media-${item.id}`;

  useEffect(() => {
    if (focusTarget?.type !== "item" || focusTarget.id !== item.id) return undefined;
    setExpanded(true);
    const frame = requestAnimationFrame(() => {
      nameInputRef.current?.focus();
      nameInputRef.current?.select();
    });
    return () => cancelAnimationFrame(frame);
  }, [focusTarget, item.id]);

  function update(patch) {
    onUpdate(categoryId, item.id, patch);
  }

  function handleFile(event) {
    const [file] = event.target.files;
    event.target.value = "";
    if (file) onUpload(categoryId, item.id, file);
  }

  return (
    <article
      ref={setNodeRef}
      style={style}
      className={`item-card${item.archived ? " is-archived" : ""}${isDragging ? " is-dragging" : ""}`}
    >
      <header className="item-card-header">
        <button
          type="button"
          className="drag-handle"
          aria-label={`جابجایی ${item.name || "آیتم"}`}
          title={reorderDisabled ? "برای جابجایی، همه موارد را نمایش دهید" : "برای جابجایی بکشید"}
          disabled={disabled || reorderDisabled}
          {...attributes}
          {...listeners}
        >
          <span aria-hidden="true">⠿</span>
        </button>

        <label
          className={`item-thumbnail${disabled || uploading ? " is-disabled" : ""}`}
          htmlFor={fileInputId}
          aria-label={previewUrl ? `جایگزینی تصویر ${item.name}` : `بارگذاری تصویر ${item.name}`}
        >
          {previewUrl ? <img src={previewUrl} alt="" width="64" height="64" /> : <span>تصویر</span>}
          {uploading ? <span className="uploading-label">در حال بارگذاری</span> : null}
        </label>
        <input
          id={fileInputId}
          className="visually-hidden"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFile}
          disabled={disabled || uploading}
        />

        <div className="item-quick-fields">
          <label className="item-name-field">
            <span>نام آیتم</span>
            <input
              ref={nameInputRef}
              dir="auto"
              value={item.name}
              onChange={(event) => update({ name: event.target.value })}
              disabled={disabled}
              maxLength="191"
            />
          </label>
          <label className="item-price-field">
            <span>قیمت</span>
            <input
              dir="auto"
              value={item.price ?? ""}
              onChange={(event) => update({ price: event.target.value || null })}
              placeholder="مثلاً ۱۸۰"
              disabled={disabled}
              maxLength="64"
            />
          </label>
          <label className="item-category-field">
            <span>دسته‌بندی</span>
            <select
              value={categoryId}
              onChange={(event) => onMove(item.id, event.target.value)}
              disabled={disabled}
            >
              {categoryChoices.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.title}{category.archived ? " — آرشیو شده" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="item-quick-actions">
          <button
            type="button"
            className="quiet-button item-details-toggle"
            aria-expanded={expanded}
            onClick={() => setExpanded((current) => !current)}
          >
            {expanded ? "بستن جزئیات" : "جزئیات"}
          </button>
          <button
            type="button"
            className={item.archived ? "quiet-button restore-button" : "quiet-button danger-button"}
            onClick={() => update({ archived: !item.archived })}
            disabled={disabled}
          >
            {item.archived ? "بازگردانی" : "آرشیو"}
          </button>
        </div>

        {item.archived ? <span className="archive-badge item-archive-badge">آرشیو شده</span> : null}
      </header>

      {expanded ? (
        <div className="item-card-body">
          <div className="item-detail-grid">
            <label className="item-description-field">
              <span>توضیحات</span>
              <textarea
                dir="auto"
                rows="3"
                value={item.description ?? ""}
                onChange={(event) => update({ description: event.target.value || null })}
                disabled={disabled}
                maxLength="4000"
              />
            </label>

            <div className="image-detail-actions">
              <span>تصویر آیتم</span>
              <div>
                <label className={`quiet-button upload-button${disabled || uploading ? " is-disabled" : ""}`} htmlFor={fileInputId}>
                  {uploading ? "در حال بارگذاری…" : previewUrl ? "جایگزینی تصویر" : "بارگذاری تصویر"}
                </label>
                {previewUrl ? (
                  <button
                    type="button"
                    className="text-button danger-text"
                    onClick={() => update({ mediaId: null, media: null })}
                    disabled={disabled || uploading}
                  >
                    حذف تصویر
                  </button>
                ) : null}
              </div>
              <small>برای جایگزینی سریع تصویر می‌توانید روی تصویر کوچک همین ردیف بزنید.</small>
            </div>
          </div>

          {advanced ? (
            <details className="owner-settings item-owner-settings">
              <summary>تنظیمات پیشرفته مالک</summary>
              <MetadataEditor
                metadata={item.metadata}
                onChange={(metadata) => update({ metadata })}
              />
              {item.options.length > 0 ? (
                <p className="preserved-note">{item.options.length} گزینه قیمت این آیتم بدون تغییر حفظ می‌شود.</p>
              ) : null}
            </details>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}

export const ItemCard = memo(ItemCardComponent);
