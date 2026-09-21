---
name: quiet-blocks-visual-iteration
description: Refine and review the Quiet Blocks Three.js scene against its approved low-poly diorama art direction. Use for reference-matching, procedural mesh modeling, the floating island and rim, vegetation, buildings, materials and textures, lighting, weather, camera composition, or any visual-parity pass in this repository.
---

# Quiet Blocks Visual Iteration

Treat the approved reference as a visual specification. Preserve a navigable, procedural town that reads well from every angle; do not optimize only one hero shot.

## Define the pass before editing

State the largest visible mismatch and one or two observable acceptance checks. Keep a pass limited to that mismatch, or to two properties that cannot be judged separately. Do not treat the presence of new geometry, materials, or settings as evidence that the intended visual outcome has been reached.

## Start from evidence

1. Inspect `git status` and preserve unrelated work.
2. Identify the current reference image and the live implementation. Prefer stable repository references over temporary clipboard paths when both exist.
3. Reuse the running app when practical. For `localhost` visual checks, use the in-app browser when available.
4. Read `docs/concept-comparison.md` before a reference-matching pass and use its development-only comparison harness.
5. Establish a repeatable comparison camera and viewport before editing. Capture the full diorama and a relevant close-up from the same view before and after a pass.
6. When Safari native WebGPU alone darkens textured materials while flat,
   emissive, and sky colors remain plausible, inspect the source PNG encoding
   before changing lights or color management. Re-encode indexed-color maps as
   pixel-identical 8-bit RGB/RGBA and repeat the same comparison.

## Fix mismatches in visual order

Evaluate and change the largest mismatch first:

1. silhouette and overall mass
2. proportions and spatial composition
3. topology, facet size, and shape language
4. palette, lighting, roughness, and texture
5. props, vegetation variation, and small details

Keep a pass focused on one category unless two properties are inseparable. A different camera angle is not evidence of improved parity.

## Model procedural forms deliberately

- Express important forms with named parameters or normalized curves. For layered terrain, prefer a profile such as `radiusScaleAtDepth(t)` over manually tuning many unrelated rings.
- Separate topology by purpose: a fine irregular rim, broader cliff faces, a controlled transition, and a lower taper.
- Check triangle aspect ratios. Do not reduce density by skipping angular vertices when it creates long ribbon-like faces; adjust both axes or change the triangulation.
- Keep generated shells closed, opaque, consistently wound, and free of cracks at topology transitions.
- Build material transitions into existing faces. Grass crossing a cliff break should normally use selected rim faces, not detached decorative blobs.
- Use deterministic variation so regeneration and screenshot comparison remain reproducible.

## Match the established art direction

- Preserve the intentional contrast between stylized objects and realistic
  effects. Buildings, terrain, vegetation, and props use deliberate low-poly
  geometry and materials; depth of field, lighting, shadows, mist, fog,
  precipitation, wetness, and related phenomena may pursue photorealistic
  depth, motion, scattering, and occlusion. Do not flatten or toon-shade an
  effect merely to make the whole image stylistically uniform.
- Keep realistic effects spatially integrated with the miniature world. They
  must respect geometry and depth, remain convincing while orbiting, and scale
  through explicit quality budgets. Realism is not a license for screen-space
  grain, dirty-lens overlays, implausible bloom, or effects that hide the town.
- Aim for a detailed low-poly Czechoslovak housing diorama: simple block architecture surrounded by richer terrain, vegetation, paths, vehicles, and small civic details.
- Keep the floating island thick and weighty. The upper cliff should remain close to vertical before turning inward lower down; avoid a boat-hull or pointed-bow profile.
- Bring grass close to an irregular fracture line. Allow occasional upper cliff faces to carry grass, but avoid a clean grey collar or separate grass pancakes.
- Keep rock matte, dusty, and predominantly mid-to-light neutral grey. Use restrained value variation and subtle dirty texture rather than colorful alternating facets.
- Make deciduous trees from several overlapping bulbous crown masses with branching trunks. Vary crown size, placement, facet scale, and color without making every tree unique noise.
- Keep conifers intentionally constructed and make trunk or branch intersections coherent from all viewing angles.
- Preserve simple buildings, but use subtle plaster variation, recesses, entrances, balconies, roof details, and asynchronous window lighting to keep them inhabited.
- Favor soft overcast illumination, atmospheric depth, and muted warm/olive colors. Avoid glossy materials, harsh black shadows, excessive emissive fill, and screen overlays that read as a dirty lens.
- Remember that the player can orbit and zoom around the entire model; do not rely on fixed near-, mid-, or far-distance cheats.

## Use img2threejs selectively for props

Use the `img2threejs` staged workflow for a discrete prop when a clear reference image can reveal useful proportions, component hierarchy, repetition, or material evidence. Do not make it the default for terrain, procedural vegetation, or modular buildings whose native parametric rules provide better control.

1. Store the source and staged artifacts under `web/source-data/img2threejs/<asset>/`.
2. Use the generated specification, component tree, PBR evidence, blockout, and comparison render as reconstruction evidence—not as automatically accepted production code.
3. Hand-refine the runtime factory for connected topology, pivots, instancing, performance, and consistency with the town's stylized low-poly language.
4. Validate the result in an isolated close-up and at the normal town-view scale.

Use the municipal bench as the precedent. Read the `img2threejs bench reconstruction reference` section in `web/source-data/README.md`, inspect its staged artifacts, and compare the hand-refined production factory in `web/src/world/environment-props.ts` before reconstructing another prop.

## Compare in the live scene

After each meaningful visual pass:

1. Restore the same comparison camera and viewport used for the baseline.
2. Inspect the full silhouette and a close view for stretching, cracks, intersections, repetition, texture scale, and unintended transparency.
3. For edits, loading, weather transitions, or staged rebuilds, observe or
   record the transition itself. A final screenshot cannot prove that trees,
   props, lighting, or atmosphere did not briefly disappear or pop.
4. Compare concrete properties rather than saying it merely “feels closer.” Classify the pass as matched, visibly closer, or insufficient.
5. Name the three largest remaining mismatches. If the original mismatch is still the largest, iterate again when the correction is local instead of moving to smaller details.
6. Call a visual goal complete only when the locked comparison demonstrates its acceptance checks. Distinguish implemented ingredients from achieved parity in every handoff.

## Validate proportionally

- Keep the live app running after changes when practical.
- For a small visual change, use the live browser check, the narrowest relevant automated check, and `git diff --check`.
- Run broader tests and a production build for cross-cutting geometry, interaction, dependency, or release work.
- Before handoff, state what was visually inspected, what automated checks ran, and what remains unverified.
- Follow the global `AGENTS.md` for commit policy and any active operating mode. Do not redefine MFBT behavior in this skill.

For controls, mobile layout, construction behavior, saved settings, starting-state rules, or development-versus-production UI, use the companion `quiet-blocks-product-iteration` skill.

For Android or desktop renderer stalls, backend comparisons, benchmark captures, quality budgets, or rendering optimization, use `quiet-blocks-renderer-performance`. Return to this skill to verify that lighting, weather, atmosphere, shadows, and post-processing still match the intended High-quality scene.
