import { sitePath } from "../sitePath";

const CURRENT_SNAPSHOT_URL = sitePath("managed-menu/current.json");
const PREVIOUS_SNAPSHOT_URL = sitePath("managed-menu/previous.json");

function publicAssetUrl(value) {
  if (
    value.startsWith("/")
    || /^(?:https?:|data:|blob:)/i.test(value)
  ) {
    return value;
  }
  return sitePath(value);
}

function publicSrcSet(value) {
  return value
    .split(",")
    .map((candidate) => {
      const [url, ...descriptor] = candidate.trim().split(/\s+/);
      return [publicAssetUrl(url), ...descriptor].join(" ");
    })
    .join(", ");
}

function normalizeSnapshot(snapshot) {
  if (
    !snapshot
    || snapshot.schemaVersion !== 1
    || !Array.isArray(snapshot.categories)
  ) {
    throw new Error("Unsupported menu snapshot.");
  }
  return {
    ...snapshot,
    categories: snapshot.categories.map((category) => ({
      ...category,
      items: Array.isArray(category.items)
        ? category.items.map((item) => ({
            ...item,
            options: Array.isArray(item.options) ? item.options : [],
            image: item.image?.src
              ? {
                  ...item.image,
                  src: publicAssetUrl(item.image.src),
                  srcSet: item.image.srcSet
                    ? publicSrcSet(item.image.srcSet)
                    : undefined,
                }
              : null,
          }))
        : [],
    })),
  };
}

async function fetchSnapshot(url) {
  const response = await fetch(url, {
    cache: "no-cache",
    credentials: "same-origin",
  });
  if (!response.ok) {
    throw new Error(`Menu snapshot request failed with status ${response.status}.`);
  }
  return normalizeSnapshot(await response.json());
}

async function fetchManagedSnapshot() {
  try {
    return await fetchSnapshot(CURRENT_SNAPSHOT_URL);
  } catch (currentError) {
    try {
      return await fetchSnapshot(PREVIOUS_SNAPSHOT_URL);
    } catch (previousError) {
      throw new AggregateError(
        [currentError, previousError],
        "No managed menu snapshot is available.",
      );
    }
  }
}

let snapshotRequest;

export function loadMenuSnapshot() {
  if (!snapshotRequest) snapshotRequest = fetchManagedSnapshot();
  return snapshotRequest;
}
