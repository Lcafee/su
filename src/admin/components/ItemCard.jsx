import { memo } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

import { MetadataEditor } from "./MetadataEditor";

function ItemCardComponent({
  item,
  categoryId,
  categoryChoices,
  disabled,
  advanced,
  uploading,
  onUpdate,
  onMove,
  onUpload,
}) {
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
    disabled,
  });
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  const previewUrl = item.media?.urls?.["300"] || item.media?.urls?.["600"] || null;
  const fileInputId = `media-${item.id}`;

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
          title="برای جابجایی بکشید"
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <span aria-hidden="true">⠿</span>
        </button>
        <div className="item-heading">
          <strong>{item.name || "آیتم بدون نام"}</strong>
          {item.archived ? <span className="archive-badge">آرشیو شده</span> : null}
        </div>
        <button
          type="button"
          className={item.archived ? "quiet-button restore-button" : "quiet-button danger-button"}
          onClick={() => update({ archived: !item.archived })}
          disabled={disabled}
        >
          {item.archived ? "بازگردانی" : "آرشیو"}
        </button>
      </header>

      <div className="item-card-body">
        <div className="image-editor">
          <div className="image-preview">
            {previewUrl ? (
              <img src={previewUrl} alt="" width="150" height="150" />
            ) : (
              <span>بدون تصویر</span>
            )}
          </div>
          <div className="image-actions">
            <label className={`quiet-button upload-button${disabled || uploading ? " is-disabled" : ""}`} htmlFor={fileInputId}>
              {uploading ? "در حال بارگذاری…" : previewUrl ? "جایگزینی تصویر" : "بارگذاری تصویر"}
            </label>
            <input
              id={fileInputId}
              className="visually-hidden"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleFile}
              disabled={disabled || uploading}
            />
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
        </div>

        <div className="field-grid">
          <label>
            <span>نام آیتم</span>
            <input
              dir="auto"
              value={item.name}
              onChange={(event) => update({ name: event.target.value })}
              disabled={disabled}
              maxLength="191"
            />
          </label>
          <label>
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
          <label className="wide-field">
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
          <label className="wide-field">
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
            <small>اگر کشیدن سخت است، دسته مقصد را از اینجا انتخاب کنید.</small>
          </label>
        </div>

        {advanced ? (
          <>
            <MetadataEditor
              metadata={item.metadata}
              onChange={(metadata) => update({ metadata })}
            />
            {item.options.length > 0 ? (
              <p className="preserved-note">{item.options.length} گزینه قیمت این آیتم بدون تغییر حفظ می‌شود.</p>
            ) : null}
          </>
        ) : null}
      </div>
    </article>
  );
}

export const ItemCard = memo(ItemCardComponent);
