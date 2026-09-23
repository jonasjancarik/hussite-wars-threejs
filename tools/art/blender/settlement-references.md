# Settlement model references

Read when changing `settlement_batch.py` or placing the settlement assets. Created 22 September 2026.

The nine assets are original static, matte, low-poly geometry. No game mesh, texture or screenshot is embedded. The forms suit representative villages and towns in the 1419–37 campaigns, rather than reconstructing a particular street, monastery or church.

## Inspected references

| Reference | Cues used and limits |
| --- | --- |
| [KCD II Troskowitz screenshot](https://assetsio.gnwcdn.com/038_rPvFGn9.jpg?auto=webp&fit=bounds&format=jpg&height=1920&quality=80&width=1920), indexed with [Eurogamer's Troskowitz guide](https://www.eurogamer.de/kingdom-come-deliverance-2-unmarkierte-quests-und-interessante-orte) | The image was inspected directly: horizontal timber lower walls, plaster infill and timber framing upstairs, small shutters, steep plain roofs and simple yard fencing. These guide the cottages and narrow townhouse. The guide page returned HTTP 403 during this pass, but its published image was accessible. KCD II's 1403 setting is visual inspiration, not proof of every later campaign's buildings. |
| [Official KCD II battle-start screenshot](https://www.deepsilver.com/media/luqnre2z/kcd2_announce_05_battlestart-1920.jpg), from [Deep Silver's media gallery](https://www.deepsilver.com/games/kingdom-come-deliverance-ii/media) | Inspected directly: an open-front thatched outbuilding and simple rail fences with diagonal bracing. These inform the barn, shed and fence gate. The military banners and exact site layout are not copied. |
| [Official Mysteria Ecclesiae promotional image](https://www.deepsilver.com/media/3kfkaky0/kcd2_mysteria_desktop_3840x2160.jpg) | Inspected as promotional artwork, not treated as an in-game screenshot: repeated pointed cloister openings, stone reveals, modest wall buttresses and plain roofs. The wing retains only these broad Gothic cues; its windows use simple mullions instead of copying elaborate tracery. |
| [Parish of St Bartholomew, Plzeň: architecture and history](https://farnostbartolomej.cz/katedrala) | The primary parish account identifies the church as a fourteenth-/fifteenth-century Gothic building and describes its former high tent roof. It states that the present tall pyramidal spire followed the 1835 fire. `church_gothic` consequently uses a broad hall and high tent-like roof with a modest west tower, without reproducing the modern 102 m silhouette or later extensions. It is a compact generic church, not a claim about the exact 1433 building. |

The roof, well, doorway and window proportions are original kit decisions. Full straw/shingle textures, construction interiors and fine stone tracery are intentionally omitted. The well's hollow rim, windlass and rope communicate its function; no particular excavated medieval well is claimed as its source.

## Assets and conventions

Dimensions include roof overhangs, steps, shutters and open gate leaves. Source axes are X × Y × Z in metres. All complete footprints are centred and reach Z=0. Fronts face Blender -Y, exported as glTF +Z. The fence runs along X with its open gateway facing through Y.

| Asset | Dimensions, m | Triangles | Form |
| --- | --- | --- | --- |
| `house_timber` | 5.480 × 4.280 × 4.228 | 2,744 | 5 × 3.5 m timber cottage, horizontal boards, small shutters and shingle roof. |
| `house_plaster` | 5.460 × 4.730 × 4.910 | 2,028 | 5 × 4 m lime-plastered cottage, restrained framing, red roof and simple chimney. |
| `townhouse` | 4.640 × 5.870 × 7.433 | 3,292 | Narrow two-storey house with a modest timber upper-floor projection, front gable and plain shutters; no Renaissance facade. |
| `barn` | 6.480 × 4.660 × 4.926 | 2,776 | 6 × 4 m timber barn, folded door leaves and an actual open front doorway into a shallow closed-back interior. |
| `shed` | 3.320 × 2.420 × 2.680 | 1,304 | Small open-front timber shed with grounded posts and a single-pitch roof. |
| `fence_gate` | 6.000 × 1.815 × 1.380 | 1,396 | Rustic fence with a roughly 2 m genuine central opening; the gate leaf is folded rearward beside the right post. |
| `monastery_wing` | 8.420 × 4.215 × 5.595 | 1,340 | 8 × 3.5 m wing with small pointed windows, simple buttresses and a pointed door; intended to pair with a church. |
| `church_gothic` | 7.520 × 11.670 × 9.800 | 1,772 | Broad Gothic hall, polygonal choir, high tent-like roof and modest west tower; a town-scale counterpart to the retained village church. |
| `well` | 2.595 × 2.010 × 3.068 | 900 | Approximately 1.8 m stone rim, real hollow centre, oak roof posts, windlass, crank and rope. |

The building bodies are opaque. Doors and windows are closed surface/reveal models except for the explicitly open barn, shed and fence gateway. The well uses a dark bottom below its hollow stone ring. Game placement and movement rules are separate from these meshes; a visual doorway does not by itself alter pathfinding. There are no animations, colliders, LODs or faction materials.

## Build and verify

The shared generator owns registration and canonical exports. From the repository root:

```sh
/opt/homebrew/bin/blender --background --factory-startup --python-exit-code 1 --python tools/art/blender/build_assets.py -- house_timber house_plaster townhouse barn shed fence_gate monastery_wing church_gothic well
/opt/homebrew/bin/blender --background --factory-startup --python-exit-code 1 --python tools/art/blender/render_settlement_batch.py
```

The gallery imports the actual GLBs at one physical scale, without requiring a catalog or manifest, and writes `previews/settlement-batch.png`. Append `-- --output /tmp/settlement-batch.png` for a private render.

Private Blender checks covered all nine source models: no open meshes, zero-area faces or negative closed-mesh volumes; all assets grounded. Individual previews were inspected for silhouette, steps, roof supports and open spaces. Timber posts project beyond their crossing rails, and fence rail ends stop inside their posts, to avoid coplanar faces. The complete gallery was rendered from the exported GLBs and inspected for consistent scale, full framing and readable labels. Automated export and live-game checks belong to the shared integration pass.
