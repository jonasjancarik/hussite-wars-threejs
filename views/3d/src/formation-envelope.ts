/**
 * Renderer-neutral X/Z clearance envelopes for the largest current unit
 * formation. Coordinates are local to its gameplay hex center in metres.
 *
 * Both are derived from transformed GLB mesh vertices for every recipe,
 * faction facing, marching yaw and route scale. The vertices have been expanded
 * from the measured hull by 0.00003 m before rounding to six decimals, so
 * rounding does not exclude source geometry. Planners that need a practical
 * safety gap should add it to their wall/route clearance separately.
 */

/**
 * Standing formations, which scenery around a hex centre must clear. War
 * wagons stand broadside, with their long side toward the enemy.
 */
export const FORMATION_FOOTPRINT: readonly (readonly [number, number])[] = [
  [-3.297407, -0.433055],
  [-3.295995, -0.496911],
  [-3.260265, -0.69367],
  [-1.775747, -1.753529],
  [-0.182629, -1.985336],
  [-0.063251, -1.992715],
  [-0.056354, -1.992922],
  [0.063254, -1.992715],
  [0.286359, -1.927014],
  [1.454083, -1.560028],
  [3.212802, -0.887924],
  [3.260267, -0.693658],
  [3.265506, -0.630002],
  [3.297407, 0.433055],
  [3.295995, 0.496911],
  [3.260265, 0.69367],
  [1.775747, 1.753529],
  [1.083252, 1.832715],
  [-0.971409, 1.894373],
  [-1.198052, 1.842169],
  [-1.238099, 1.827306],
  [-3.212803, 0.887923],
  [-3.260267, 0.693658],
  [-3.265506, 0.630002],
];

/**
 * Formations on the move, swept along route legs and used to size gates. War
 * wagons drive pole first, so they are narrow across the line of travel.
 */
export const FORMATION_TRAVEL_FOOTPRINT: readonly (readonly [number, number])[] = [
  [-1.753553, 1.710315],
  [-1.630416, -1.374752],
  [-0.890095, -3.233774],
  [-0.694583, -3.281329],
  [-0.630019, -3.28656],
  [0.43181, -3.318425],
  [0.496571, -3.317075],
  [0.694583, -3.281329],
  [1.753553, -1.775789],
  [1.753553, -1.710315],
  [1.700223, 0.050917],
  [1.672121, 0.787493],
  [1.6592, 1.030634],
  [1.630416, 1.374752],
  [0.890095, 3.233774],
  [0.694583, 3.281329],
  [0.630019, 3.28656],
  [-0.43181, 3.318425],
  [-0.496571, 3.317075],
  [-0.694583, 3.281329],
  [-1.753553, 1.775789],
];

/** Maximum current formation mesh height above the unit's flat-ground origin. */
export const FORMATION_HEIGHT = 4.13;

/** Return the support distance in the supplied X/Z direction (normalization optional). */
export function formationSupport(nx: number, nz: number,
  footprint: readonly (readonly [number, number])[] = FORMATION_FOOTPRINT): number {
  if (!Number.isFinite(nx) || !Number.isFinite(nz)) {
    throw new RangeError("Formation support direction must be finite");
  }
  let support = -Infinity;
  for (const [x, z] of footprint) support = Math.max(support, x * nx + z * nz);
  return support;
}
