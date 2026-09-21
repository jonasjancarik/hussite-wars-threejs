export interface MarkerAnchor {
  id: number;
  x: number;
  y: number;
  selected: boolean;
  /** Projected camera depth: larger values are farther away. */
  depth?: number;
}

export interface MarkerPlacement extends MarkerAnchor {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface MarkerDimensions { width: number; height: number; }

const compactMarkerDimensions: MarkerDimensions = { width: 64, height: 58 };
const detailMarkerDimensions: MarkerDimensions = { width: 152, height: 114 };

/** The visual box and canvas hit rectangle always use the same dimensions. */
export function unitMarkerDimensions(detailsVisible = false): MarkerDimensions {
  return detailsVisible ? detailMarkerDimensions : compactMarkerDimensions;
}

function paintOrder(a: MarkerAnchor, b: MarkerAnchor): number {
  return Number(a.selected) - Number(b.selected) || (b.depth ?? 0) - (a.depth ?? 0) || a.id - b.id;
}

/** Follow each projected unit directly. Array order is back-to-front paint order. */
export function layoutUnitMarkers(anchors: MarkerAnchor[], width: number, height: number,
  dimensions: MarkerDimensions = compactMarkerDimensions): MarkerPlacement[] {
  if (width <= 0 || height <= 0) return [];
  return [...anchors]
    .sort(paintOrder)
    .map(anchor => ({ ...anchor, width: dimensions.width, height: dimensions.height,
      left: anchor.x - dimensions.width / 2, top: anchor.y - dimensions.height - 6 }));
}

export type MarkerObstacle = Pick<MarkerPlacement, "left" | "top" | "width" | "height">;

const overlaps = (a: MarkerObstacle, b: MarkerObstacle): boolean =>
  a.left < b.left + b.width + 3 && a.left + a.width + 3 > b.left
  && a.top < b.top + b.height + 3 && a.top + a.height + 3 > b.top;

/** Deterministic screen-space packing. Selected troops get the first clear slot. */
export function separateUnitMarkers(anchors: MarkerAnchor[], width: number, height: number,
  obstacles: MarkerObstacle[] = [], dimensions: MarkerDimensions = compactMarkerDimensions): MarkerPlacement[] {
  const placed: MarkerPlacement[] = [];
  for (const anchor of [...anchors].sort((a, b) => Number(b.selected) - Number(a.selected) || a.y - b.y || a.id - b.id)) {
    const { width: w, height: h } = dimensions;
    if (width < w + 8 || height < h + 8) continue;
    let result: MarkerPlacement | null = null;
    // Nearby positions only: a marker must still clearly belong to its formation.
    const xStep = w + 3, yStep = h + 3;
    for (const [dx, dy] of [[0, 0], [0, -yStep], [-xStep, 0], [xStep, 0], [-xStep, -yStep], [xStep, -yStep],
      [0, -yStep * 2], [-xStep, -yStep * 2], [xStep, -yStep * 2], [0, yStep], [-xStep, yStep], [xStep, yStep]]) {
      const candidate = { ...anchor, width: w, height: h,
        left: Math.max(4, Math.min(width - w - 4, anchor.x - w / 2 + dx!)),
        top: Math.max(4, Math.min(height - h - 4, anchor.y - h - 6 + dy!)) };
      if (![...placed, ...obstacles].some(other => overlaps(candidate, other))) { result = candidate; break; }
    }
    // In very dense distant formations leave the figures visible rather than
    // stacking unreadable buttons. Zooming in restores every individual marker.
    if (result) placed.push(result);
  }
  return placed.sort(paintOrder);
}

/** Keep the requested army-wide cards visible when optional packing runs out of nearby slots. */
export function completeDetailMarkerPlacements(separated: MarkerPlacement[], direct: MarkerPlacement[],
  detailsVisible: boolean): MarkerPlacement[] {
  if (!detailsVisible || separated.length === direct.length) return separated;
  const separatedIds = new Set(separated.map(placement => placement.id));
  return [...separated, ...direct.filter(placement => !separatedIds.has(placement.id))].sort(paintOrder);
}

export function markerAt(placements: MarkerPlacement[], x: number, y: number): number | null {
  return [...placements].reverse().find(marker => x >= marker.left && x <= marker.left + marker.width
    && y >= marker.top && y <= marker.top + marker.height
    // Expanded text is full-width only below the flag. Do not let empty
    // space beside a small flag intercept a nearby formation or its label.
    && (y >= marker.top + compactMarkerDimensions.height
      || Math.abs(x - marker.left - marker.width / 2) <= compactMarkerDimensions.width / 2))?.id ?? null;
}
