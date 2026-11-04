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

export function seasonalFrame(source, target, progress, travel = 360) {
  const t = clamp(progress);
  if (t === 0) return { ...source, progress: 0 };
  if (t === 1) return { ...target, progress: 1 };
  const eased = t * t * (3 - 2 * t);
  const width = source.width + (target.width - source.width) * eased;
  const height = source.height + (target.height - source.height) * eased;
  const sourceCenterY = source.y + source.height / 2;
  const distanceY = target.y + target.height / 2 - sourceCenterY;
  // One document coordinate system: the browser supplies normal page scrolling.
  // Match the finger at entry, then join document flow with zero local velocity.
  const vertical = distanceY > 0 && distanceY < travel
    ? 1 - (1 - t) ** (travel / distanceY)
    : eased;
  return {
    x: source.x + source.width / 2
      + (target.x + target.width / 2 - source.x - source.width / 2) * eased - width / 2,
    y: sourceCenterY + distanceY * vertical - height / 2,
    width,
    height,
    progress: t,
  };
}

export function seasonalDetailsOpacity(progress) {
  const t = clamp((progress - .84) / .16);
  return t * t * (3 - 2 * t);
}
