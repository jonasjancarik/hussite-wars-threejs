# 3D campaign view

Read when changing the Three.js presentation, asset loading, or its build.

This is a supported presentation of the same game as the [2D view](../2d/README.md). Shared rules, scenarios and battle controls remain in `js/`; `ThreeBattleMapView.js` adapts the live game to the renderer in `src/`. It does not own a second rules engine.

From the repository root:

```sh
npm --prefix views/3d ci
npm --prefix views/3d test
npm --prefix views/3d run build
```

The build typechecks TypeScript and writes `dist/`, then copies the browser bundle to tracked `integrated/hex-three.js` for the static campaign. Commit that bundle with renderer changes. Dependencies and `dist/` are ignored. No root package manager or new dependency was introduced.

Models, textures and authored scenario manifests live in [assets/3d](../../assets/3d/README.md). `model-paths.json` resolves stable model IDs to category folders; do not hardcode former experiment paths. Model generation lives in [tools/art](../../tools/art/README.md). Provenance is retained in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) and adjacent asset manifests.

Serve the repository root and use the campaign's 2D/3D buttons. The standalone page waits for its first rules snapshot before creating the renderer, since locale loading can finish after the bundle loads. The standalone Sudoměř page and Bevy comparisons remain [experimental fixtures](../../experiments/sudomer-diorama/README.md).

## Campaign behaviour

Units use compact, clickable banners with the same vector symbols, faction colours, health thresholds and localized status labels as the 2D map. `WoodcutRenderer.unitPresentation` supplies display facts through the campaign snapshot: the 3D renderer does not reimplement action rules. Health bars change at 60% and 30%; routing, fear, low morale, defense, veteran/elite traits and wagon state have separate badges. A dot marks an available action and a check marks a spent unit during its faction's turn. Names, exact health, morale and combat modifiers remain in the shared inspector and hover/touch details. **Unit details** in the cog menu additionally shows names, exact HP and morale for every visible on-screen unit at once. It starts off, persists through view switches during the battle, and expands both banner visuals and picking rectangles. Very crowded detail cards may overlap even when separation is enabled, rather than silently omitting units. Banner buttons also support keyboard selection; dragging over a banner continues to operate the map camera.

Banners remain a readable screen size when zooming and stay anchored directly above their formations during camera movement. Overlap is allowed by default: banners are not shuffled into spare slots or hidden to resolve a crowd. The optional **Separate banners** map control restores collision avoidance, including leader lines and suppression of crowded unselected markers; it starts off and retains the chosen setting when switching between 2D and 3D during a battle. Unselected banners are 85% opaque and stack by camera depth, with nearer banners covering farther ones. Selection makes a banner fully opaque and brings it to the front; overlapping clicks follow that same paint order. Map controls remain above the banner layer; markers clip naturally at the viewport edge. Switching to 2D or closing the battle removes/hides the overlay with its renderer, and fog-hidden enemies have no figures, markers, hit targets or wagon connections.

**Unit labels** in the map cog menu hides all floating unit markers, health bars, badges, details and leader lines. Hidden markers have no hit targets or keyboard stops; figures remain selectable on the map and the shared inspector still works. Labels start on, and the choice survives 2D/3D switches and renderer recreation within the same battle. Detail and separation preferences are retained while their controls are disabled. Winter maps use darker, slightly wider grid lines over snow and ice, with light lines retained on dark roads and mud. Action highlights and the grid visibility control keep their existing behaviour.

**Depth of field** follows the cursor's battlefield hit point, falling back to the camera target when the pointer leaves the view. It stays very subtle at strategic and mid zoom, then eases up toward the player-selected close-up strength as the camera approaches the battlefield. The 3D cog menu can disable the effect, tune its close-up strength, or choose Compact or Photo bokeh quality. Compact is the default; Photo bokeh uses the fuller and more demanding blur graph. These choices persist while switching views and recreating the renderer during the battle.

Infantry, cavalry and artillery crew lose figures in proportion to remaining health, rounding up and retaining at least one while alive. Observed losses leave non-interactive visual copies that settle slightly and fade over 460 ms at the impact position. Confirmed visible eliminations fade the remaining figures too; initial loads, fog disappearance and escaping units never replay deaths. Pausing freezes fades, leaving the 3D view clears them, and reduced motion skips them. Each fade owns only its cloned materials, which are released at completion. Survivors keep their original positions; healing restores the same slots. This is an abstract indication of losses, not literal soldier counts or a second damage formula. Commanders, guns, wagons and fixed fortifications remain until their unit is eliminated. Adjacent living, closed wagons of the same faction have physical chain links, with lighter, spaced links in marching formation, matching the 2D connection rules. Opening a wagon or losing sight of it removes the connection.

Each figure is grounded independently at its formation position using the rendered terrain height and its model's lowest point, including after movement, marching or routing. Real scene shadows provide contact shading; artificial shadow discs are omitted. Selection cylinders remain raycast targets but are invisible to rendering and post-processing.

The root campaign now loads the Three.js renderer on demand through `views/3d/ThreeBattleMapView.js`. The active root `HexGrid` remains authoritative, and the same generator provides a complete fallback for every campaign scenario. Optional art manifests must validate against that live map before they can change presentation. The standalone Sudoměř page below remains a renderer fixture.

Sudoměř additionally has an authored-art manifest in `assets/3d/scenarios/sudomer-landscape.json`. Its source-terrain hash must match the active map before it can replace the generated presentation. A mismatch falls back to generated terrain, so authored scenery cannot silently drift away from gameplay.

Authored decorations retain the key of their nearest gameplay hex even after static and instanced batching. Under advanced fog, explored cells reveal their own trees, landmarks, reeds, stones, grass and flowers while decorations assigned to unexplored cells remain hidden.

Sudoměř has no rules-level field terrain. Its playable `plains` therefore remain meadow, while crop fields, buildings, woodland framing, walls and heavier stones sit in the non-playable diorama fringe. The generic renderer still treats `field`, `fields`, `farmland` and `cropland` as cultivated terrain when those values occur in a scenario snapshot. The complete 3D hex grid is visible by default and can be toggled with **Hex grid** in the map controls.

`views/3d/src/terrain-regions.ts` is renderer-neutral. It merges same-terrain neighbours and applies deterministic coherent variation at region borders. The 75% terrain-coverage rule is an area minimum, not a requirement to reproduce hex outlines. The test suite measures both the field and rendered surface across all campaign scenarios. Roads use connected corridors; other terrain currently retains protected interiors while blending its edges.

Generator v2 adds the shared visual baseline before scenario authoring: world-scaled meadow, earth, grassy-slope and water materials, textured vertical soil sides, and semantic elevation inferred from connected hills and slopes. Meadow grass instances are currently disabled. Terrain blends ease into each protected hex interior to avoid abrupt mud-bank height jumps. The thin, muted grid meets at shared hex edges, respects unit occlusion, and omits steep segments instead of stretching across cliffs; selection and movement colors remain stronger. `performance.ts` provides resettable 240-frame captures with raw frame, preparation and renderer timings plus public Three.js counters. Vítkov is the primary visual and performance fixture; no Vítkov coordinates or scenario-name branches exist in the generator.

## Unit coverage

All 59 roster definitions have explicit recipes in `src/unit-recipes.ts`. Models use faction material variants and preserve the shared markers, fog, losses and wagon-link presentation. Civilians use a mixed adult/woman/child group; all commanders use one of three role bases and their own neutral standard. Both wagon types are rendered as wagons, and `POLNI_OPEVNENI` is a fixed blockhouse/garrison.

The engine's explicit `dismounted` flag chooses foot figures and is included in saves and renderer snapshots. The presenter rebuilds same-ID appearances when this flag or faction changes. Slower movement or a lost charge bonus does not imply dismounting. Existing saves without the field remain valid and default to mounted. The all-roster asset test loads actual GLBs and checks each unit's geometry against its recipe-specific picking volume.

## Settlement generation and authoring

Read when refining towns or editing `assets/3d/scenarios/settlement-authoring.json`.

Německý Brod and Žatec use the same settlement generator. It groups connected town hexes, connects road access through each group (or starts from an existing gate), and places houses facing the resulting street. Smaller sheds share their house's orientation. Packed ground makes the street visible. These streets are scenery: town hexes keep their original movement and combat rules. Other battles retain their existing environment arrangements.

The planner uses measured model footprints, keeps at least 1.3 world units clear around gameplay hex centres, reserves the street corridor, and avoids existing environment placements and non-town terrain. Placement is deterministic. It omits a building when no candidate fits; it does not force one into every hex. The renderer retains its existing terrain seating, slope rejection and explored-cell fog handling.

Edit the committed JSON to refine the generated result, then run `npm --prefix views/3d run build` and reload the campaign. A profile contains:

- `version: 1`, a deterministic integer `seed`, and `sourceTerrainHash` matching the complete gameplay map. A stale hash ignores the saved adjustments and reports a warning while keeping generated scenery.
- `edits`: a generated building's `id`, its `cell: [col, row]`, and optional `offset: [x, z]`, `model`, `rotation` in radians, or `scale`. Offsets are world units relative to that hex centre. Supply `remove: true` to omit it. House identities are `<scenario>:settlement:<col>,<row>:house`; sheds end in `:shed`. Identities do not depend on placement order or model choice.
- `openAreas`: named circular areas with `cell`, optional `offset`, and `radius`. Generated buildings relocate or are omitted to leave them clear.
- `landmarks`: a unique `id`, `cell`, optional `offset`, a catalogued settlement `model`, `rotation`, and optional `scale`. These reserve their space before generated buildings. Pinning a generated house uses an edit with explicit position and orientation.

Německý Brod demonstrates a townhouse replacement, a pinned well, an open bridge-side square and removal of a shed beside the approach. Žatec uses the same generator without manual adjustments. These are illustrative compositions, not surveyed historical reconstructions. The JSON is the authoring source; the generated bundle is not edited directly.

Malformed profile data fails validation. Unsafe edits report their identity in `EnvironmentPlan.settlement.issues` and the browser console; a rejected edit leaves the procedural slot available. Inspect these diagnostics after editing instead of assuming every requested placement was accepted. Available model dimensions, origins and front directions are in `src/settlement-models.ts`, checked against the shared GLB manifest. Full terrain-aware placement is still conservative: a model may be omitted at rendering time if its footprint crosses too steep a slope. There is no visual editor in this pass.

## Generated rivers and banks

Read when changing water geometry, ice, bridge grounding or terrain coverage.

Generated coasts combine neighbouring terrain contributions into one continuous field, with coherent seeded variation. A protected majority inside each hex retains its gameplay terrain; the existing 75% minimum is checked across all campaign maps. Banks ease down to a level water surface. Surface triangles are split at the contour where water outweighs each land type, so shorelines no longer inherit the jagged edges of whole mesh triangles. `renderedHeightAt` uses those split triangles for grounded figures and overlays. Terrain continues to the diorama rim without treating empty samples as water.

Frozen rivers use the same clipped water geometry, partitioned by gameplay hex for explored-cell fog and individual ice breakage. Unbroken ice shares one material across hex edges; only the small central patch opens when the game reports broken ice. Adjacent land hexes own any water contour that extends into their outer margin, so this scenery follows their visibility too. Rivers and ponds keep their original rules, movement costs and ice state.

The existing bridge profile and its approach models share one vertical datum, with a smooth blend into the adjoining bank. This improves seating without moving the crossing or changing the road terrain beneath it. The authored Sudoměř landscape remains on its separate terrain implementation. Woodland composition and landscape authoring controls are separate future passes.

## Generated roads

Read when changing road shapes, material selection or terrain coverage.

`road-corridors.ts` joins neighbouring road centres into continuous corridors with rounded bends and end caps. Straight runs keep their width across hex joins. The generator measures how much road would cover neighbouring terrain and adds circular clearances only where necessary to preserve the 75% minimum. It does not force a clearance at every hex edge. Outside each corridor, neighbouring ground replaces the former road-coloured hex corners.

Roads use a restrained, fine-grained packed-earth material separate from pond mud. The terrain mesh is cut along the road contour, and grounding follows the resulting triangles. This applies to the shared generated landscape without scenario-specific coordinates or new authored placements. Existing scenario layouts, movement costs and saved settlement adjustments remain authoritative.

## Connected town walls and formation clearance

Read when changing town enclosures, formation sizes, gate openings or movement presentation.

The existing fortified-town profiles now use `town-wall-plan.ts` and `town-wall-scenery.ts`. The planner joins town and adjoining church cells into exterior loops, removes internal courtyard walls, and simplifies each outline only where complete formations stay clear. It generates continuous masonry with terrain-fitted bases, battlements, fitted towers and open procedural gatehouses. Gates follow road approaches where available; additional entrances are allowed when necessary to preserve visual route connectivity. The small authored manor arrangements and the separate Sudoměř landscape remain unchanged.

River cells also constrain simplification: the outline cannot cut across their main area or enclose their centres. Safe corners are rounded after simplification. The rendered bank meets the city side of the wall, removing incidental strips of water inside the enclosure while preserving the original gameplay tiles. Regression tests inspect the actual water mesh and verify the 75% water-coverage minimum, rather than accepting the wall outline alone as proof.

`formation-envelope.ts` contains the measured horizontal convex envelope and height of all current unit recipes, including wagons, horses, artillery, commander standards, marching and dismounted variants. The asset regression test measures real model vertices against that envelope. Wall bodies, gate piers and towers must clear the full envelope at every passable hex, including frozen water. A tower must also preserve previously clear movement legs. Gate width, pier size and overhead clearance follow those measurements; the narrow decorative gatehouse GLB is not used for these passages.

The shared game still allows town entry from any legal neighbouring hex. `town-wall-routes.ts` therefore supplies cosmetic routes through gates while leaving destinations, movement costs, terrain rules and combat unchanged. The 3D view now uses the same pause-aware 180/220 ms movement animation as the 2D view. A moving formation follows the safe route as a whole and remains grounded at each intermediate position. Reduced motion, hidden movement and fast-forward retain their existing animation skips. A missing cosmetic route snaps to the authoritative destination instead of drawing a formation through masonry. Tests cover every cross-enclosure neighbour move in the current generated campaign profiles.

Masonry is split into exact hex-owned sections for fog, then rendered as joined surfaces. Gates and towers have explicit reveal owners. All new meshes, materials and procedural masonry textures are released with the scene. These are shared generation rules; no per-battle wall coordinates or new manual landscape edits were added.
