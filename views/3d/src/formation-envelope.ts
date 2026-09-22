/**
 * Renderer-neutral X/Z clearance envelope for the largest current unit
 * formation. Coordinates are local to its gameplay hex center in metres.
 *
 * Derived from transformed GLB mesh vertices for every recipe, faction facing,
 * marching yaw and route scale. The vertices have been expanded from the
 * measured hull by 0.00003 m before rounding to six decimals, so rounding does
 * not exclude source geometry. Planners that need a practical safety gap should
 * add it to their wall/route clearance separately.
 */
export const FORMATION_FOOTPRINT: readonly (readonly [number, number])[] = [
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
export function formationSupport(nx: number, nz: number): number {
  if (!Number.isFinite(nx) || !Number.isFinite(nz)) {
    throw new RangeError("Formation support direction must be finite");
  }
  let support = -Infinity;
  for (const [x, z] of FORMATION_FOOTPRINT) support = Math.max(support, x * nx + z * nz);
  return support;
}
