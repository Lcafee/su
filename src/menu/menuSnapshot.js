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

async function fetchSnapshot(url, signal) {
  const response = await fetch(url, {
    cache: "no-cache",
    credentials: "same-origin",
    signal,
  });
  if (!response.ok) {
    throw new Error(`Menu snapshot request failed with status ${response.status}.`);
  }
  return normalizeSnapshot(await response.json());
}

async function fetchManagedSnapshot(signal) {
  try {
    return {
      snapshot: await fetchSnapshot(CURRENT_SNAPSHOT_URL, signal),
      source: "current",
    };
  } catch (currentError) {
    if (signal.aborted) throw currentError;
    try {
      return {
        snapshot: await fetchSnapshot(PREVIOUS_SNAPSHOT_URL, signal),
        source: "previous",
      };
    } catch (previousError) {
      throw new AggregateError(
        [currentError, previousError],
        "No managed menu snapshot is available.",
      );
    }
  }
}

let snapshotRequest;
let snapshotController;
let snapshotGeneration = 0;

export function loadMenuSnapshot({ force = false } = {}) {
  if (!force && snapshotRequest) return snapshotRequest;

  snapshotGeneration += 1;
  const generation = snapshotGeneration;
  if (force) snapshotController?.abort();
  const controller = new AbortController();
  snapshotController = controller;

  const request = fetchManagedSnapshot(controller.signal).then((result) => {
    if (generation !== snapshotGeneration) {
      throw new DOMException("Menu snapshot request was superseded.", "AbortError");
    }
    return result;
  }).finally(() => {
    if (generation === snapshotGeneration) snapshotController = undefined;
  });
  snapshotRequest = request;
  return snapshotRequest;
}
