export interface MarkerAnchor {
  id: number;
  x: number;
  y: number;
  selected: boolean;
}

export interface MarkerPlacement extends MarkerAnchor {
  left: number;
  top: number;
  width: number;
  height: number;
}

/** Follow each projected unit directly. Array order is back-to-front paint order. */
export function layoutUnitMarkers(anchors: MarkerAnchor[], width: number, height: number): MarkerPlacement[] {
  if (width <= 0 || height <= 0) return [];
  return [...anchors]
    .sort((a, b) => Number(a.selected) - Number(b.selected) || a.id - b.id)
    .map(anchor => ({ ...anchor, width: 64, height: 58, left: anchor.x - 32, top: anchor.y - 64 }));
}

export type MarkerObstacle = Pick<MarkerPlacement, "left" | "top" | "width" | "height">;

const overlaps = (a: MarkerObstacle, b: MarkerObstacle): boolean =>
  a.left < b.left + b.width + 3 && a.left + a.width + 3 > b.left
  && a.top < b.top + b.height + 3 && a.top + a.height + 3 > b.top;

/** Deterministic screen-space packing. Selected troops get the first clear slot. */
export function separateUnitMarkers(anchors: MarkerAnchor[], width: number, height: number,
  obstacles: MarkerObstacle[] = []): MarkerPlacement[] {
  const placed: MarkerPlacement[] = [];
  for (const anchor of [...anchors].sort((a, b) => Number(b.selected) - Number(a.selected) || a.y - b.y || a.id - b.id)) {
    const w = 64;
    const h = 58;
    if (width < w + 8 || height < h + 8) continue;
    let result: MarkerPlacement | null = null;
    // Nearby positions only: a marker must still clearly belong to its formation.
    for (const [dx, dy] of [[0, 0], [0, -61], [-67, 0], [67, 0], [-67, -61], [67, -61],
      [0, -122], [-67, -122], [67, -122], [0, 61], [-67, 61], [67, 61]]) {
      const candidate = { ...anchor, width: w, height: h,
        left: Math.max(4, Math.min(width - w - 4, anchor.x - w / 2 + dx!)),
        top: Math.max(4, Math.min(height - h - 4, anchor.y - h - 6 + dy!)) };
      if (![...placed, ...obstacles].some(other => overlaps(candidate, other))) { result = candidate; break; }
    }
    // In very dense distant formations leave the figures visible rather than
    // stacking unreadable buttons. Zooming in restores every individual marker.
    if (result) placed.push(result);
  }
  return placed.reverse();
}

export function markerAt(placements: MarkerPlacement[], x: number, y: number): number | null {
  return [...placements].reverse().find(marker => x >= marker.left && x <= marker.left + marker.width
    && y >= marker.top && y <= marker.top + marker.height)?.id ?? null;
}
