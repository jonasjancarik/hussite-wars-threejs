# Hybrid soldier visuals

`read_when`: changing infantry spawning, formation rendering, selection visuals, quality settings, or large-battle performance.

Status: agreed direction, not yet integrated into the playable battlefield.

## Decision

Keep both infantry representations:

- Use the original multi-material GLBs for nearby, selected, or otherwise important formations.
- Use the flattened shared-mesh versions for distant formations and larger battles.
- Choose and switch representation at formation level, not independently for every soldier.

The flattened infantry retain the original geometry, silhouettes, variants, and base colors. Each soldier becomes one mesh/material entity instead of an instantiated GLB hierarchy. The accepted visual compromise is the loss of separate metallic response on helmets and weapons.

The original decision applied to the three rigid infantry variants. On 20 September 2026 the user chose a static figurine look for the new playable battle: cavalry should also use a baked fixed-pose horse-and-rider mesh, with no skeletal animation at any distance. Preserving cavalry animation is no longer a requirement for that battle. Existing animated studies are not part of this change. Plan 004 starts with shared static meshes at all distances; detailed static variants remain optional, subject to visual benefit and measured cost.

## Structure

Each soldier should have one stable gameplay root containing identity, formation membership, position, selection, collision, health, morale, and later combat state. Rendering is replaceable presentation attached to that root:

- **Detailed:** original `WorldAssetRoot` GLB hierarchy.
- **Flat:** shared `Mesh3d` and material handles from `assets/models/benchmark/`.

Gameplay systems must not depend on visual descendants. Changing representation must not replace the logical soldier entity or lose selection and simulation state.

Introduce an explicit visual policy rather than scattering army-size checks through spawn code. It should support detailed, flattened, and hybrid modes. Exact distance and army-size thresholds remain tuning decisions, not requirements recorded here.

## Switching policy

Start with a predictable quality mode: detailed visuals for small battles and flattened visuals above a configurable count. Then add a hybrid formation-level policy if close-up quality is worth the extra complexity.

For the hybrid policy:

- Keep selected formations detailed where practical.
- Prefer detailed visuals for the nearest formations within a configurable budget.
- Use flattened visuals for the remaining formations.
- Apply separate upgrade and downgrade distances so orbiting the camera does not cause rapid switching.
- Limit upgrades per frame or pool detailed visual instances to prevent a camera move from spawning thousands of GLB hierarchies at once.
- Never render both representations simultaneously during a transition.

Team colors and selection feedback should use shared materials, instance data, or separate root-level markers without recreating per-soldier material assets.

## Evidence and limits

The corrected benchmark is in `benchmark-results/flat-20260920-141421/README.md`. With every soldier visible, flattened infantry materially reduced entity count, memory, and moving-frame cost. Native Metal reached about 60 FPS median at 20,000 flattened soldiers and 57.5 FPS at 50,000, but tail performance was lower. Browser WebGPU was faster than WebGL 2 at 50,000 but remained much slower than native.

These measurements cover rendering and simple formation movement only. Collision, congestion, combat, morale, formation steering, pathfinding, full scenery, effects, and UI remain outside the benchmark. Do not treat 50,000 rendered figures as proven full-battle capacity.

## First integration slice

1. Add one visual-policy resource and one representation marker.
2. Route existing infantry spawning through a shared function that attaches either detailed or flat presentation to the same logical root.
3. Add a manual detailed/flat toggle to the playable battlefield for matched visual checks.
4. Add a formation-level hybrid mode with conservative hysteresis and an upgrade budget.
5. Verify selection, orders, reset, shadows, terrain grounding, and entity cleanup across repeated switches.
6. Measure the real battlefield at 10,000 and 20,000 soldiers before considering a 50,000-person gameplay target.

Do not add a full LOD or GPU-animation architecture before this slice demonstrates a useful visual/performance tradeoff in the actual battlefield.
