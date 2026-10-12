-- Short, persistent category codes (G01, G02, ...) used as the Excel identifier.
-- They are assigned once, here in the current display order, and are never
-- renumbered when categories are reordered. Internal UUIDs stay the keys.
ALTER TABLE menu_categories ADD COLUMN code TEXT NULL;

UPDATE menu_categories
SET code = 'G' || printf('%02d', (
    SELECT ranked.position
    FROM (
        SELECT id, ROW_NUMBER() OVER (
            ORDER BY (archived_at IS NOT NULL), sort_order, id
        ) AS position
        FROM menu_categories
    ) AS ranked
    WHERE ranked.id = menu_categories.id
));

CREATE UNIQUE INDEX IF NOT EXISTS ux_menu_categories_code ON menu_categories (code);

-- Highest number ever assigned, so a deleted category's code is not handed out again.
ALTER TABLE menu_state ADD COLUMN category_code_seq INTEGER NOT NULL DEFAULT 0;
UPDATE menu_state SET category_code_seq = (SELECT COUNT(*) FROM menu_categories);
