// Per-user view continuity for the menu editor (search, filter, quick-add target).
// Kept apart from the editor component so the sign-in shell can clear it without
// loading the editing workspace.
const FILTER_VALUES = new Set(["active", "archived", "all"]);
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

export function readMenuEditorViewState(storageKey, advanced) {
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
      visibility: FILTER_VALUES.has(stored.visibility) ? stored.visibility : fallback.visibility,
      quickCategoryId: typeof stored.quickCategoryId === "string" ? stored.quickCategoryId : "",
    };
  } catch {
    return fallback;
  }
}

export function writeMenuEditorViewState(storageKey, viewState) {
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
