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

export function MenuEditor({
  document,
  categoryChoices,
  uploadingIds,
  disabled,
  advanced,
  onUpdateCategory,
  onUpdateItem,
  onMoveCategory,
  onMoveCategoryByOffset,
  onMoveItem,
  onUpload,
  onCreateCategory,
  onCreateItem,
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const categoryDragIds = document.categories.map((category) => `category:${category.id}`);

  function handleDragEnd({ active, over }) {
    if (!over || active.id === over.id) return;
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

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <div className="editor-toolbar">
        <div>
          <h2>دسته‌بندی‌ها و آیتم‌ها</h2>
          <p>برای تغییر ترتیب از دستگیره نقطه‌ای استفاده کنید.</p>
        </div>
        <button type="button" className="secondary-button" onClick={onCreateCategory} disabled={disabled}>
          + دسته‌بندی جدید
        </button>
      </div>

      <SortableContext items={categoryDragIds} strategy={verticalListSortingStrategy}>
        <div className="category-list">
          {document.categories.map((category, index) => (
            <CategoryCard
              key={category.id}
              category={category}
              index={index}
              categoryCount={document.categories.length}
              categoryChoices={categoryChoices}
              disabled={disabled}
              advanced={advanced}
              uploadingIds={uploadingIds}
              onUpdateCategory={onUpdateCategory}
              onUpdateItem={onUpdateItem}
              onMoveItem={onMoveItem}
              onUpload={onUpload}
              onMoveCategoryByOffset={onMoveCategoryByOffset}
              onCreateItem={onCreateItem}
            />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}
