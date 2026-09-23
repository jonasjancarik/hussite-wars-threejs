# Cavalry batch

Read when revising light riders, scouts, heavy cavalry or mounted formations.

Created 21 September 2026. Three static horse-and-rider models cover all eight mounted unit definitions. They reuse the shared locally authored horse in a standing pose. On 23 September 2026 that horse was rebuilt from faceted lofts with a crest mane, shaped legs and cone hooves, keeping its pivots, saddle height and length; `cavalry.glb` keeps its `HorseWalk` clip. The heavy mount's forehead guard now follows the new head line. Equipment and riders are newly assembled with the same faceted primitives and matte materials as the infantry batches.

## References and interpretation

- [KCD II mounted rider screenshot](https://cdn.mos.cms.futurecdn.net/aFn3PiHZZXetTk4Q2WpsQY.png), reproduced in [TechRadar's KCD II horse guide](https://global.techradar.com/it-it/gaming/kingdom-come-deliverance-2-guida-per-ottenere-gratis-il-cavallo): visually inspected for the seated rider, reins, saddle, stirrups and the combination of cloth, mail and plate. It informs equipment relationships, not a named historical rider or horse breed.
- [The Met: Visored Bascinet, 04.3.235a,b](https://www.metmuseum.org/art/collection/search/21986), dated ca. 1375–1400: reference for the pointed visor, helmet profile and mail around the lower head. The museum describes the bascinet's use into about 1420. Our simplified helmet is an early-campaign visual baseline, not a claim that identical helmets equipped every rider throughout 1419–1437.
- [Royal Armouries: The Hundred Years' War](https://royalarmouries.org/objects-and-stories/stories/the-hundred-years-war-1337-1453): period context for mounted soldiers, armour and horse protection, including the Warwick shaffron. The heavy mount has cloth covering and a simple forehead guard; it is not a reconstruction of that object or a fully armoured later horse bard.

The horses retain the project's stylized proportions. Brown, grey/dun and dark-brown coats help distinguish the three model families in the diorama; these are design choices, not historical class or faction uniforms. Shields and pennants have plain team colours without invented coats of arms. Later national equipment, tournament armour and decorative crests are outside this generic batch.

## Models and mappings

| Model | Appearance | Existing definitions |
| --- | --- | --- |
| `cavalry_light` | Kettle hat, padded coat, upright spear, small shield and simple tack | `JIZDA_HUSITI`, `LEHKA_JIZDA`, `JIZDA_PRASKY` |
| `cavalry_scout` | Cloth cap, short cape, saddle bags, bedroll and sheathed sword; both hands on the reins | `ZVED`, `ZVED_KRIZACI` |
| `cavalry_heavy` | Visored bascinet, simplified mail/plate armour, lance and pennant, shield, horse cloth and forehead guard | `SLECHTICKA_JIZDA_HUSITI`, `TEZKY_RYTIR`, `TEZKOODENCI` |

The men-at-arms definition currently shares the heavy rider; a lighter armour variant can follow. Dismounted knights remain a separate future need. No unit definitions, side assignments, statistics or scenario compositions changed.

Each mounted unit displays two models at scale 0.98. Their positions were adjusted slightly inward from the original generic cavalry formation so the entire exported geometry remains inside the existing picking cylinder while the horses stay apart. Each mount follows terrain independently. `team_cloth` and `team_paint` use the existing red/blue material variants; neutral horse, skin, leather and metal materials retain their colours.

The four hooves are planted in the static source pose. No walk, attack or other animation is exported. Body parts and gear stay separately named in the Blender sources for later pose variants. Only the exported copy has transforms baked for accurate runtime bounds.

## Rebuild

From the repository root:

```sh
/opt/homebrew/bin/blender --background --factory-startup --python-exit-code 1 --python tools/art/blender/build_assets.py -- cavalry_light cavalry_scout cavalry_heavy
/opt/homebrew/bin/blender --background --factory-startup --python-exit-code 1 --python tools/art/blender/render_infantry_batch.py -- --cavalry
python3 tools/art/blender/validate_exports.py
npm --prefix views/3d test
npm --prefix views/3d run build
```

Generation is in `cavalry_batch.py`; editable scenes and individual previews are under `source/` and `previews/`. Runtime GLBs live in `assets/3d/models/units/`. `previews/cavalry-batch.png` compares all three exported mounts at the same scale in both palettes.

## Verification

Inspected individual Blender previews and the red/blue comparison rendered from the exported GLBs. A temporary fixture in the actual browser renderer displayed six two-mount formations without warnings or errors; selecting a heavy rider and a scout worked. Automated checks cover all eight mappings, four planted hooves, static exports, material slots, low-poly budgets and every visible vertex inside the existing picking volume on both sides. All 63 3D tests, 20 shared presentation tests, GLB/entrypoint validation and the TypeScript/Vite build passed. The broad rules/AI suite and native Bevy scenes were not rerun for this presentation-only change.
