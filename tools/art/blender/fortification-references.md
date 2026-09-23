# Fortification model references

Read when changing `fortification_batch.py`, placing its modules, or comparing the fortification overview with exported models.

Created 22 September 2026. These are original static low-poly meshes for small battlefield scenes. They use the shared kit's matte materials and named editable parts, with no imported game mesh, texture or screenshot. One source unit is approximately one metre; Blender is Z-up and the glTF exports are Y-up. Their exterior/front convention is Blender -Y, exported as glTF +Z.

## References and interpretation

| Reference | Design cues used | Limits |
| --- | --- | --- |
| [KCD II fortified-residence screenshot](https://i0.wp.com/gameranx.com/wp-content/uploads/2025/03/Kingdom-Come_-Deliverance-II_20250311230711.png?fit=800%2C450&ssl=1), published in [Gameranx's passage guide](https://gameranx.com/features/id/532096/article/kingdom-come-deliverance-2-how-to-find-the-secret-maleshov-passage-save-capon/) | The inspected image supplied the combination of masonry, steep red/brown roofs, timber wall-walk construction, a modest timber-framed gate/watch structure and pointed palisade stakes. The kit translates these broad forms into the established miniature style. | The article's generic hero image is not treated as a measured Malešov plan. KCD II's 1403 setting predates this game's 1419–37 campaigns. Neither the game's materials nor its architectural details establish a particular building's historical appearance. |
| [KCD II plastered-tower screenshot](https://cdn.gracza.pl/gallery/gallery_big3/-2052907203.jpg), published in [Gamepressure's Taking French Leave guide](https://www.gamepressure.com/kingdom-come-deliverance-2/taking-french-leave/zd117d0) | Roughly plastered masonry, contrasting dressed corner stones and a supported external wooden stair/landing inform `fort_manor`. | Only the broad construction and silhouette are used. Window count, stair layout, proportions and roof are original design decisions; no game geometry is traced or extracted. |
| [NPÚ archaeological record: Malešov, site 11997](https://isad.npu.cz/malesov-mestecko-s-tvrzi-stredovekeho-puvodu-11997) | The record links the settlement to a 1303 mention, identifies the medieval seat, and notes the surviving large tower and perimeter fortification. This supports a compact residential tower as a useful regional type. | The record also describes sixteenth-century expansion into a chateau. Those later features are not copied, and the model is not a reconstruction of the surviving site. Source: National Heritage Institute. |
| [NPÚ: History of Trosky](https://www.hrad-trosky.cz/en/about/history) | Late-fourteenth-century defensive and residential towers, residential buildings and adaptation to local terrain support an irregular, practical composition of different building types. | Trosky's rock formations and particular towers are not reproduced. The square and round kit towers are generic game assets; this source is period context, not evidence for their exact shapes. Source: National Heritage Institute. |

The kit has no universal flags, religious devices or coats of arms. Plain rectangular crenels and restrained roofs avoid later ceremonial ornament or Renaissance bastions. Grey/ochre stone, pale worn plaster, dark oak and muted red/brown roof materials provide readable contrast without textures. Small stone patches are deliberately sparse relief, not individual masonry blocks throughout the wall.

## Modules and connection points

All dimensions below are measured source X × Y × Z, including eaves, stone dressings and braces. Ground is Z=0. Models are centred over their full footprint except `fort_wall_corner`, whose useful origin is the wall elbow. The manor's centre includes its stair, so its main rectangular body lies slightly behind the origin.

| Asset | Dimensions, metres | Triangles | Placement and construction |
| --- | --- | --- | --- |
| `fort_wall` | 6.000 × 1.180 × 4.450 | 2,972 | Straight wall along X. Main masonry is 1.10 m thick; sockets at `(-3, 0)` and `(3, 0)`. Wall-walk top is Z=3.30. Outer parapet/crenels face -Y; the inner side has a low upstand. |
| `fort_wall_corner` | 6.590 × 6.590 × 4.450 | 5,980 | L-shaped wall with elbow at `(0, 0)`, legs extending +X and +Y, sockets at `(6, 0)` and `(0, 6)`. Extent is -0.59 to +6 on both axes. Exterior faces -Y and -X. A continuous L-shaped body, walk and parapet return avoid holes or overlapping faces at the elbow. |
| `fort_gatehouse` | 6.440 × 3.620 × 7.521 | 4,632 | Masonry body 6.0 m wide, 3.0 m deep; passage runs through Y. The passage is truly open, 2.40 m wide with at least 2.70 m full-width headroom and an arch rising to 3.45 m. Walls connect at X=±3; side access doors begin at the shared walk height. Upper plaster/timber storey and steep gabled roof. |
| `fort_tower_square` | 4.400 × 4.400 × 8.100 | 5,794 | Stone body 3.60 m square, raised timber/plaster watch storey and simple pyramidal roof. Nominal wall connections at X=±1.80; doors begin at Z=3.30. The first quoin course sits above the plinth, avoiding coplanar surfaces. |
| `fort_tower_round` | 4.276 × 4.276 × 8.170 | 3,616 | Sixteen-sided stone body of radius 1.85 m and a closed conical roof. Use X=±1.70 for wall-end positions so the entire 1.18 m walk/coping width enters the curved body slightly. Side doors begin at Z=3.30. Geometry rotations are applied so reported bounds reflect the actual silhouette. |
| `fort_manor` | 6.450 × 5.925 × 10.021 | 9,948 | Compact residential keep with a 6.0 × 4.8 m body, small windows, quoins and steep gable roof. Door faces -Y with a 1.80 m raised landing and braced timber stair running along the facade. Full footprint remains below 7.8 × 6 m. |
| `timber_palisade` | 6.000 × 0.828 × 2.423 | 980 | Straight 6 m X module with 23 faceted pointed stakes, two inner rails, diagonals and ground braces. Exterior is -Y; braces face +Y. The origin is centred over the full depth, including braces. No flags or iron-spike ornament. |

To extend the corner, place a straight wall at `(9, 0, 0)` with no rotation, or at `(0, 9, 0)` rotated -90 degrees about Z. Both continuations retain the correct outward parapet. Walls centred at X=±6 join a gatehouse at the origin. For a square tower use wall centres at X=±4.80; for a round tower use X=±4.70. These are source-scale joins; apply one common scale to an assembled group. Different display scales are appropriate for representative buildings but will not preserve walk or socket alignment.

All structures are compact typological models, not surveyed fortifications. The straight modules use a deliberately narrow wall walk for small-game placement. The external door, window and arrow-loop details are opaque recess/door surrogates without interior rooms; only the gate has a genuine open passage. Placement does not by itself add movement rules, collision or siege mechanics. The game can use a few modules to suggest a fortified site without claiming a complete historical plan.

## Building and presentation

The shared generator handles registration, canonical Blender sources, GLB export and the manifest. Rebuild these assets sequentially from the repository root:

```sh
/opt/homebrew/bin/blender --background --factory-startup --python-exit-code 1 --python tools/art/blender/build_assets.py -- fort_wall fort_wall_corner fort_gatehouse fort_tower_square fort_tower_round fort_manor timber_palisade
/opt/homebrew/bin/blender --background --factory-startup --python-exit-code 1 --python tools/art/blender/render_fortification_batch.py
```

`render_fortification_batch.py` imports the actual exported GLBs, places all seven at the same physical scale, and renders a labelled orthographic gallery to `previews/fortification-batch.png`. The palisade is turned to expose its rails and braces. The script reads no catalog or manifest and changes no model files. For a private render, append `-- --output /tmp/fortification-batch.png`.

## Verification

Source-model inspection checks grounding, coherent wall-walk heights, the gate opening and contact between stonework, roof framing and the manor stair. Private BMesh checks found no open meshes, zero-area faces or inward closed-mesh volumes. Individual previews were inspected; the square plinth and corner parapet were corrected to remove overlapping coplanar faces. Small assets remain below 6,000 triangles and the manor below 10,000. The kit is static, with no rigs, animations or external texture dependencies. Renderer tests load the exported GLBs, cast rays through the gate, and check manor placement, hex-centre clearance and fog visibility. Both manor layouts were also inspected in the game renderer.
