const clamp = (value) => Math.max(0, Math.min(1, value));

export function findSeasonalProduct(categories) {
  for (const category of categories) {
    if (category.archived || category.visible === false) continue;
    const item = category.items?.find((candidate) =>
      !candidate.archived && candidate.visible !== false
      && (candidate.id === 'item-cd02bda6aac3' || String(candidate.metadata?.code) === '22001'));
    if (item) return item;
  }
  return null;
}

export function keepSeasonalIntro(hash, enabled) {
  return enabled && !hash;
}

export function seasonalFrame(source, target, progress) {
  const t = clamp(progress);
  const eased = t * t * (3 - 2 * t);
  // Enter the photo column first; the later descent must never cross the copy.
  const approach = 1 - (1 - clamp(t / .22)) ** 3;
  return {
    x: source.x + (target.x - source.x) * approach,
    y: source.y + (target.y - source.y) * eased,
    width: source.width + (target.width - source.width) * approach,
    height: source.height + (target.height - source.height) * approach,
    progress: t,
  };
}
