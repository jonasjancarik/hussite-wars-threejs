# Sudoměř hex diorama design QA

Final result: passed on the WebGPU target, with the limitations below.

## Visual references

- Principal held-still target: `/var/folders/1j/t72zmxvn6cs1bmnxdqqgvkqw0000gn/T/codex-clipboard-1be12d9c-7c3c-42b0-a823-85b957e39eab.png`
- Earlier hex version: `/var/folders/1j/t72zmxvn6cs1bmnxdqqgvkqw0000gn/T/codex-clipboard-4452ec49-2e2b-4482-b5a2-cb1faf00a39f.png`
- Concept art: `/Users/janca/projects/battle-game/ChatGPT Image Sep 19, 2026, 10_29_07 PM.png`
- Overhead composition reference: `/Users/janca/projects/battle-game/assets/diorama/landscape-plan.png`
- Implementation: `http://localhost:8082/sudomer-hex.html`

The integrated browser was used for fixed overview, close formation, selected-unit, grid-on, camera-orbit, effects-on and effects-off checks. The default view was also checked at 1440×900 and an emulated 390×844 viewport.

## Visual result

The new view reads as a composed landscape rather than a colored rules board. It has continuous organic pond and drained-basin contours, shallow banks, reeds, drainage channels, irregular fields, a curving causeway, a village silhouette and woodland masses. Real wagon, infantry, cavalry and building GLBs keep the held-still model language. Groups meet the sampled terrain and use small contact shadows; no large colored formation pedestal remains.

Procedural-worlds is the primary rendering source. The implementation now carries its environment as a coherent high-quality preset rather than independently tuned pieces: WebGPU/TSL, full-resolution 12-sample GTAO, SMAA, compact cursor-driven DoF, split-toned grade, dithering, up to 2× display resolution, 16× ground anisotropy, high-resolution shadows, clear-afternoon key/hemisphere/fill lighting, painted cloud sky, matching fog palette and the lower-sky atmospheric veil. Its actual generated deciduous trees and shrubs form the woodland. The user asked to retain the existing soil plinth, so the planned floating-island replacement was intentionally not made.

The tactical agreement remains clear with the grid hidden: Markovec is visibly water, Škaredý is visibly drained mud, and the causeway stays open. All 240 gameplay anchors pass automated terrain agreement checks even though the visible region edges do not trace hexes.

## Runtime and interaction evidence

The original gameplay sample used the Codex in-app Chromium browser at 1440×900 and included selection, orbit, camera reset and a genuine AI turn returning control in round 2. After the environment-quality correction, the live default-window check rendered an actual 1138×914 drawing buffer for a 569×458 CSS canvas on the 2× display. A rolling 60-second WebGPU sample reported 16.7 ms median and 17.0 ms p95 frame time. Cursor-focus verification moved the smoothed focal distance from 87.19 to 119.29 world units across two terrain points while selection snapshots left it unchanged. The current bundle produced no console errors or warnings.

An effects-off check remained visually coherent and interactive. The emulated 390×844 layout kept the board and controls readable without horizontal overflow; a short WebGPU sample remained near refresh rate. That is responsive-layout evidence, not real mobile-device performance proof.

Browser checks covered unit selection, legal-state HUD updates, explicit grid control, orbit, zoom, camera reset, pause, resume, a completed AI turn and restart. Dragging the camera did not issue an order. The retained Node parity suite reaches a genuine terminal result and the bridge suite covers ten restarts, stale commands, busy/AI/pause fencing and hidden units.

## Remaining gaps

- No physical mobile device was available, so the 30 fps mobile target is unverified.
- WebGL 2 fallback remains available through Three.js but received no dedicated compatibility work or acceptance pass, by user direction.
- The concept art shows much larger armies and distant countryside. This prototype deliberately uses compact illustrative groups and a finite tabletop plinth.
- The water and drained basin occupy broad areas because the unchanged scenario assigns 40 anchors to each. Their contours are organic, but their tactical extent cannot be reduced without changing the rules map.

## Landscape polish follow-up, 20 September 2026

The pass after the completed Three.js port reused procedural-worlds' ground and cliff textures with mirrored ground wrapping, added seeded meadow tufts, wildflowers, shoreline-only reeds and field-edge stone walls, and replaced the road strip with a terrain-following ribbon with soft verges and wagon ruts. Field meshes are subdivided before terrain projection. The soil plinth retains its tabletop footprint but now follows the ground edge and has tapered, colored strata. A generated blue daylight sky replaces the mauve cloud panorama; warm sun and cooler sky fill support it. Water uses a subtle periodic normal texture and the sky as its reflection environment.

The wider opening camera exposed an old fixed initial focus distance. Focus now initializes at the camera target, updates under the cursor during camera changes, and resets to the battlefield on camera reset. The final normal-window observation reported focus and target depth both 156.1085, with a 1138 by 914 drawing buffer at 2x pixel ratio.

Validation: final TypeScript/Vite build `8c911fdbba53` and all 10 renderer tests passed. Gameplay reference parity and bridge suites passed during this pass; subsequent changes were terrain presentation and camera focus only. Integrated-browser checks covered the 1440 by 900 desktop layout, wagon selection, grid on/off, orbit, reset, and the 390 by 844 narrow layout. No console errors or warnings were captured. The browser viewport override was reset and the completed scene was left open.

Performance caveat: the large desktop viewport at full 2x resolution (2236 by 1620 drawing buffer) recorded an approximately 82-second rolling sample with 33.3 ms median and 52.1 ms p95 frame time, including interactions. This is not a 60 fps acceptance result. The earlier 1x desktop sample was 16.7 ms median. No quality settings were reduced to hide the cost. No new physical-mobile or WebGL fallback validation was performed, and no Rust rebuild was needed.

## Map overlays, 21 September 2026

Corrected downward-facing overlay triangles and subdivided the rings and fills to follow terrain slopes. Overlays stay above the pond surface. Hover uses an ivory outline and soft fill; selection is gold, legal movement/march mint, and legal attacks coral. Hover preserves action colors. Materials avoid lighting and fog discoloration. An unchanged hovered coordinate no longer refreshes all overlays.

All 11 renderer tests passed, including a new regression asserting upward normals and pond clearance for both rings and fills; TypeScript and Vite build passed. The integrated browser confirmed a visible hover fill over Markovec pond with the full grid hidden, and a gold selected wagon cell. No console errors or warnings were captured. No broader gameplay or Rust gate was rerun for this presentation-only change.

## Shoreline alignment, 21 September 2026

Replaced the sawtooth causeway-facing banks with continuous banks and rounded corners. Kept the rules grid unchanged. Added uniform 0.1-unit area sampling across all 240 hexes: minimum matching water/mud/dry area is 76.0%, above the 75% threshold. Dam cells count as dry for this area test. All 12 renderer tests and the TypeScript/Vite build passed. Broader gameplay and Rust gates were not rerun for this outline-only change.

## Gentle shoreline irregularity

After the usage reset, added broad, unequal curves to both basins. Variation is greater along the outer banks and restrained next to the narrow causeway to preserve terrain readability. All 240 cells still meet the 75% sampled-area requirement (minimum 76.0%). All 12 renderer tests and TypeScript/Vite build passed. The integrated browser was checked with the hex grid both visible and hidden. The stopped preview server was restarted on port 8082 and registered runtime metadata refreshed in PortPilot. No broader gameplay or Rust gate was rerun.

## Cursor zoom and fork preparation

Enabled OrbitControls zoom-to-cursor. Verified in the integrated browser by scrolling over the church away from the view center: the camera approaches the church rather than the central target. No change to orbit or reset controls. The public development fork preserves upstream history at https://github.com/jonasjancarik/hussite-wars-threejs and keeps the diorama under experiments/sudomer-diorama. Washed-out lighting and far clipping are separate known issues, not fixed by cursor zoom.

## Authored campaign integration, 21 September 2026

Restored the approved Sudoměř terrain and scenery inside the root campaign rather than the standalone vendored game. The integrated renderer now selects the authored manifest only when its terrain hash matches the live 20×12 rules map; all other maps retain the generated fallback. The restored view includes the painted pond and drained basin, worn causeway, fields and furrows, woodland masses, village landmarks, reeds, grass, flowers, stone walls, layered plinth and the existing static figurines.

The in-app WebGPU browser confirmed the authored mode, selection and mint/gold tactical overlays at the live campaign URL. Diagnostics reported `artMode: authored`, a 1300×1708 drawing buffer, 16.7 ms median and 17.5 ms p95 frame time over 1,080 sampled frames, and no console warnings or errors. The existing uniform 0.1-unit Sudoměř coverage test remains at 76.0%, above the 75% floor.

Advanced fog now keeps a gameplay-hex key for ordinary decorations and every instance inside shared draw calls. Explored cells reveal their trees, landmarks and ground details independently; unexplored cells remain concealed without disabling the whole authored layer. A focused regression test covers both batched reveal and restoration when fog is disabled.
