# Model inventory and optional refinements

Read when planning 3D assets, faction appearance, or scenery for another battle.

Inventory updated: 22 September 2026. Scope: this checkout's canonical unit/scenario data and the Three.js renderer in `views/3d`. “Available” means a GLB exists; it does not necessarily mean the renderer uses it or that its appearance has passed visual review. This is an asset-planning inventory, not a new historical audit.

## Art direction and historical references

Keep the existing low-poly diorama art direction: simple faceted geometry, readable silhouettes, restrained materials and colours, miniature proportions, and static figures. Historical detail should improve the recognisable shape and construction of an object without turning the scene into a photorealistic game.

Use **Kingdom Come: Deliverance II screenshots as a preferred visual reference** for Bohemian clothing, armour, helmets, weapons, horse equipment, buildings and everyday props. Start with the [official media gallery](https://www.deepsilver.com/games/kingdom-come-deliverance-ii/media) and the [released gameplay screenshots collected by Gematsu](https://www.gematsu.com/2024/08/kingdom-come-deliverance-ii-gameplay-showcase-video-screenshots). Record the particular screenshot used when developing an asset, so its reference remains inspectable.

The useful translation into our style is:

- Preserve clothing layers, helmet and weapon profiles, shield shapes, and differences in equipment between ordinary soldiers and wealthy nobles.
- For buildings and props, preserve structural features such as roof form, timber framing, masonry, gates and wagon construction.
- Simplify small fittings, fabric folds and surface wear into a few clear shapes and colour areas. Judge the result at normal gameplay zoom.
- Keep side colours as selective readability accents; retain variation in ordinary clothing and equipment. Continue with static figures and optional discrete poses as described below.

KCD II is set in **1403**, shortly before this game's **1419–1437** campaign ([setting and screenshot source](https://www.gematsu.com/2024/08/kingdom-come-deliverance-ii-gameplay-showcase-video-screenshots)). It is a useful nearby-period reference, not proof for every detail of a later Hussite battle. Cross-check date-sensitive armour, firearms, wagon defences, heraldry and named buildings against historical sources when choosing those details. Screenshots guide newly authored models; game meshes and textures are not part of our asset library.

## Current coverage

The basic unit set is complete: **all 59 unit definitions have explicit 3D recipes**, including the 27 commanders, both wagon types, mixed civilian groups and the fixed fieldwork garrison. Models use shared families rather than one unique mesh per definition. The environment baseline is also complete across all 18 battles: Sudoměř keeps its authored scenery, and the other 17 use scenario-specific placements from `environment-plan.ts` and `generated-scenery.ts`. There are **79 shared GLBs and six retained experimental variants (85 total)**.

The completed batches cover flails, crossbows, pavises, spears, archers, three artillery families and crew, light/scout/heavy cavalry, dismounted knights, civilians, three commander bases, halberdiers, a blockhouse with garrison, and a neutral commander standard. Older handgun, sword/shield and wagon models now support faction colours. Unit rules and scenario rosters are unchanged; the existing explicit dismount state is now displayed and preserved in saves.

[Infantry references](../tools/art/blender/infantry-references.md), [artillery references](../tools/art/blender/artillery-references.md), [cavalry references](../tools/art/blender/cavalry-references.md), [remaining figures](../tools/art/blender/people-references.md), [fieldwork/support references](../tools/art/blender/support-unit-references.md), and the settlement, camp and landscape references linked below record visual sources and interpretation limits. Remaining work is optional refinement, not missing baseline coverage.

### Available model files

Shared paths below are relative to `assets/3d/models/`. The six `battle/` and `benchmark/` variants remain under `experiments/sudomer-diorama/assets/models/`; they are available experimental exports, not production mappings. Shared logical IDs are resolved by `assets/3d/model-paths.json`, and measured export data is in `assets/3d/models/manifest.json`.

| Files | Count | What we have / limits |
| --- | ---: | --- |
| `units/infantry_flail.glb` | 1 | Iron-bound wooden flail, kettle hat and padded clothing; both flail unit types. |
| `units/infantry_crossbow.glb` | 1 | Crossbow, stirrup and bolt case; all four crossbow types. |
| `units/infantry_pavise.glb` | 1 | Tall ribbed pavise with wooden back and sword; both pavise types. |
| `units/infantry_spear.glb` | 1 | Long upright spear with a plain leaf-shaped head; both spearman types. |
| `units/infantry_archer.glb` | 1 | Static drawn wooden bow, nocked arrow, hip quiver and cloth cap; existing archer type. |
| `units/infantry_polearm.glb` | 1 | Dedicated sudlice silhouette, kettle helmet and faction-colour cloth; no generic fallback. |
| `units/infantry_handgun.glb` | 1 | Handgunner with faction-colour coat and neutral powder flask; used only for ručničáři. |
| `units/infantry_shield.glb` | 1 | Sword and plain striped shield with faction colours, used for mercenaries and dismounted scouts. |
| `units/cavalry.glb` | 1 | Original horse and polearm rider with `HorseWalk`; retained unchanged. The campaign now uses the static mounted variants below. |
| `units/cavalry_light.glb`, `units/cavalry_scout.glb`, `units/cavalry_heavy.glb` | 3 | Static light rider, equipped scout and armoured knight; all eight cavalry definitions, with side-colour cloth and shields. |
| `units/war_wagon.glb` | 1 | Battle wagon with planked walls, shooting slots, a hinged lower board, three crew, towing poles and chalice flag. |
| `units/war_wagon_open.glb` | 1 | The same wagon unchained: rear gate let down as a ramp, lower board hooked up, flailman in the gateway. Shown while a wagon's formation is open. |
| `units/artillery_houfnice.glb`, `units/artillery_tarasnice.glb`, `units/artillery_bombard.glb` | 3 | Short field gun, long light field gun and heavy siege gun; one model per artillery unit. |
| `units/artillery_gunner.glb` | 1 | Static ramrod-bearing crew figure with side-colour cloth; two independently grounded figures accompany each gun. |
| `props/banner.glb` | 1 | Original red chalice prop retained for legacy scenes. |
| `props/commander_standard.glb` | 1 | Faction-colour standard with two neutral pale stripes; every commander receives a separate instance. |
| `units/civilian_adult.glb`, `units/civilian_woman.glb`, `units/civilian_child.glb` | 3 | Mixed pilgrim group with ordinary clothing, bundles and walking staff. |
| `units/commander_captain.glb`, `units/commander_noble.glb`, `units/commander_cleric.glb` | 3 | Shared captain, armoured noble and cleric bases covering all 27 leaders. |
| `units/infantry_dismounted.glb` | 1 | Armoured foot soldier used when heavy cavalry explicitly dismounts. |
| `units/infantry_halberd.glb` | 1 | Distinct axe-and-hook halberd silhouette, with faction-colour clothing. |
| `buildings/field_blockhouse.glb` | 1 | Fixed timber/stone fieldwork with open firing bay and two visible crossbow defenders. |
| `buildings/church.glb`, `buildings/farmhouse.glb`, `props/bridge.glb`, `props/stakes.glb` | 4 | Generic church, house, timber bridge and crossed timber obstacle. |
| `buildings/fort_wall.glb`, `fort_wall_corner.glb`, `fort_gatehouse.glb`, `fort_tower_square.glb`, `fort_tower_round.glb`, `fort_manor.glb`; `props/timber_palisade.glb` | 7 | First reusable fortification kit: two wall modules, an open gatehouse, two roofed towers, a residential keep and a palisade. Composed manor scenery replaces the four farmhouses at Nekmíř and Malešov. The corner wall is available for later assemblies. |
| `buildings/house_timber.glb`, `house_plaster.glb`, `townhouse.glb`, `barn.glb`, `shed.glb`, `monastery_wing.glb`, `church_gothic.glb`; `props/fence_gate.glb`, `well.glb` | 9 | Settlement and landmark kit with timber/plaster cottages, town house, barn, shed, monastery wing, a Gothic church silhouette and small rural structures. |
| `props/tent_small.glb`, `tent_pavilion.glb`, `baggage_cart.glb`, `camp_barrels.glb`, `camp_sacks.glb`, `camp_fire.glb`, `ammunition_pile.glb`, `haystack.glb`, `timber_pile.glb`, `discarded_equipment.glb`, `wagon_abandoned.glb` | 11 | Camp and rural props used for siege positions and narrative retreat states; abandoned equipment and wagon appear only from their configured battle rounds. |
| `buildings/field_shelter.glb`; `props/rock_foundation.glb`, `low_stone_wall.glb`, `firing_platform.glb`, `bridge_approach.glb`, `ford_stones.glb`, `bank_rocks.glb`; `vegetation/reeds.glb` | 8 | Terrain-following fieldwork, castle footing, bridge and ford approaches, shoreline rocks and wetland vegetation. |
| `vegetation/broadleaf_olive.glb`, `vegetation/broadleaf_gold.glb`, `vegetation/cypress.glb` | 3 | Original stylized vegetation. |
| `vegetation/sudomer/tree-a.glb`, `vegetation/sudomer/tree-b.glb`, `vegetation/sudomer/tree-c.glb`, `vegetation/sudomer/shrub.glb` | 4 | Separate Sudoměř vegetation set. |
| `vegetation/procedural-worlds/pw_deciduous_01.glb`, `vegetation/procedural-worlds/pw_deciduous_02.glb`, `vegetation/procedural-worlds/pw_deciduous_03.glb`, `vegetation/procedural-worlds/pw_shrub_01.glb` | 4 | Additional vegetation; generated battle scenery currently selects deciduous 02. |
| `battle/unarmed_adult_static.glb` | 1 | Retained experimental export; its shared unarmed body construction is reused by the new civilian adult. |
| `battle/horse_rider_static.glb`, `battle/war_wagon_crewless.glb` | 2 | Experimental static rider and empty wagon; not separate gameplay classes. |
| `benchmark/infantry_polearm_flat.glb`, `infantry_handgun_flat.glb`, `infantry_shield_flat.glb` | 3 | Flattened benchmark copies, not additional troop identities. |

The original kit has editable Blender sources and an export manifest. The subfolders also have manifests. The flattened battle/benchmark exports use vertex colours, so selective coat recolouring is less straightforward than with separate cloth materials. Only the cavalry GLB contains an animation clip; the current Three.js unit presenter does not play it.

### Static figures and future poses

Static figurines are the intended diorama style. The lack of continuous character animation is acceptable and is not an asset gap to resolve. Walking, attack and death animation cycles are not required.

Later, discrete poses could make gameplay states easier to read while preserving the miniature appearance:

| Pose | Possible appearance |
| --- | --- |
| At ease | Weapons lowered and a relaxed stance. |
| Ready | Shields forward and weapons raised. |
| Fortified | Crouched behind a pavise or firing over wagon boards. |
| Marching | A fixed walking or riding pose, without a repeating movement cycle. |
| Routing | Turned away with weapons lowered. |

These are optional future variants, not a commitment to implement new gameplay states. Reuse bodies and equipment where practical; a pose change need not be animated. Prioritise recognisable unit types and side colours first, then add poses where they communicate an actual gameplay state.

### Environment baseline

Fortified-town perimeters now use connected procedural masonry and formation-sized gateways rather than repeated `fort_wall` / `fort_gatehouse` placements. Existing gate and wall GLBs remain available for the retained manor arrangements. The generator fits the enclosure to terrain and complete unit footprints, with cosmetic movement through the gates; see [connected town walls](../views/3d/README.md#connected-town-walls-and-formation-clearance). This changes no asset counts or gameplay rules.

Německý Brod and Žatec now arrange their existing settlement models around generated streets through `views/3d/src/settlement-plan.ts`. Saved adjustments in `assets/3d/scenarios/settlement-authoring.json` preserve a townhouse replacement, well and bridge-side open space at Brod; Žatec demonstrates the same generator without manual edits. No new models are required. See the [settlement authoring workflow](../views/3d/README.md#settlement-generation-and-authoring) for placement identities, clearance rules and regeneration.

The renderer generates terrain, water and meadow geometry. Sudoměř retains its complete authored scenery manifest, including grass/stubble, small stone field enclosures and flowers; the other 17 battles now receive deterministic scenario placements through `views/3d/src/environment-plan.ts` and `generated-scenery.ts`. This baseline adds 28 shared GLBs: nine settlement pieces, eleven camp pieces and eight landscape pieces. Together with explicit recipes for all 59 unit definitions and the existing seven-piece fortification kit, the shared library has 79 GLBs, counting the open-gate wagon; six battle/benchmark experiments remain in the experiment directory (85 total).

| Battle | Environment baseline |
| --- | --- |
| Živohošť 1419 | Vltava ford stones and bank rocks; no wagon fort is introduced. |
| Nekmíř 1419 | Retained illustrative manor composition, with haystack and timber pile rural details. |
| Sudoměř 1420 | Complete authored pond, muddy basin, embankment and wagon-line scenery remains in the retained reference map. |
| Vítkov 1420 | Three earthwork runs shape the ridge neck, with a low wall, field shelter and timber pile. |
| Vyšehrad 1420 | Fortified hill complex with wall/gate perimeter, church and keep landmarks, and a camp. |
| Žatec 1421 | Town walls, gates, towers and houses; abandoned camp props appear from round 6. |
| Kutná Hora 1421 | Walled town and winter-bare trees; night lighting begins at round 3. |
| Německý Brod 1422 | Walled town, winter terrain, bridge approaches and a frozen-river surface state. |
| Most 1421 | Hněvín hilltop castle, town walls and a monastery composition. |
| Ústí 1426 | Town houses and gate placed at the planned approach. |
| Tachov 1427 | Town perimeter and an initial retreat camp. |
| Nisa 1428 | Town wall/gate perimeter, a Gothic church and varied suburb houses. |
| Domažlice 1431 | Two camps; abandoned wagon, equipment and crewless gun details appear from round 4. |
| Plzeň 1433–34 | Walled siege city, Gothic church, camps and terrain-deformed trenches around the gun positions. |
| Lipany 1434 | Village houses and barns with haystacks beside the opposing wagon lines. |
| Sion 1437 | Rocky castle core and bailey, three defensive earthwork banks and two siege camps. |
| Hořice 1423 | Rural barns and timber details complement the existing hill, town and church terrain. |
| Malešov 1424 | Retained illustrative manor composition with ford stones and bank rocks. |

Walls and buildings use local stone footings; earth banks and ditches deform the terrain. Castle-core cells at Hněvín/Most, Sion and Vyšehrad receive visual elevation overrides to keep generic town terrain from flattening their hilltops. These visual changes do not change terrain semantics or rules. Small field structures are skipped on slopes too steep for safe placement. Placed scenery follows per-hex explored fog visibility. Brod's broken-ice marks are cosmetic game state: only breaks witnessed by the player are recorded, those marks remain on explored cells, and they do not affect movement, combat or drowning. Unknown and custom maps still receive generic town, church and shoreline scenery derived from their terrain.

These are compressed, stylized diorama compositions, not exact surveyed or archaeological reconstructions. [Fortification references](../tools/art/blender/fortification-references.md), [settlement references](../tools/art/blender/settlement-references.md), [camp references](../tools/art/blender/camp-references.md) and [landscape references](../tools/art/blender/landscape-references.md) record source images and interpretation limits, including KCD II references, the Plzeň parish history and warning about its modern 19th-century spire, and NPÚ/Archaeological Atlas material for Sion and earlier fortifications.

Site interpretation also uses the [City of Most history](https://www.mesto-most.cz/hrad-hnevin/d-4413), which distinguishes the demolished medieval castle from the later lookout reconstruction, the [study of Hussite-era Vyšehrad](https://staletapraha.cz/pdfs/pha/1984/01/12.pdf), and the [Archaeological Atlas Sion plan](https://www.archeologickyatlas.cz/cs/lokace/chlistovice_kh_hrad_sion). The compositions use medieval wall, tower and residential forms; they do not copy modern bastions or claim surveyed layouts.

## Unit coverage and optional variants

| Visual family | Unit types covered | Current coverage | Optional later work |
| --- | --- | --- | --- |
| Flail infantry | `CEPNICI`, `CEPNICI_PRASKY` | New `infantry_flail`, red/blue cloth | Covered for the first batch; optional clothing and pose variants later. |
| Polearm infantry | `SUDLICNICI`, `HALAPARTNICI` | Separate sudlice and halberd silhouettes, both with side colours | Additional weapon/stance variations. |
| Spearmen | `KOPINICI_HUSITI`, `KOPINICI` | Dedicated `infantry_spear`, red/blue cloth | Base coverage complete; braced/lowered spear poses can follow later. |
| Pavise infantry | `PAVEZNICI`, `PAVEZNICI_KRIZACI` | New `infantry_pavise`, red/blue cloth and shield paint | Covered for the first batch; planted/fortified pose and researched decoration remain future work. |
| Crossbowmen | `KUSINICI_HUSITI`, `KUSNICI`, `KUSNICI_JANOV`, `KUSINICI_PRASKY` | New `infantry_crossbow`, red/blue cloth | Shared weapon silhouette covered; Genoese equipment variation still needs reference checking. |
| Handgunners | `RUCNICARI` | Matching handgun model with side-colour coat | Weapon and loading-pose variants. |
| Archers | `LUCISTNICI` | Dedicated `infantry_archer`, drawn bow and hip quiver | Base coverage complete; relaxed/loading poses remain optional. The existing archer type belongs to the opposing side. |
| Mercenary infantry | `ZOLDNERI` | Sword and neutral striped shield, with side colours | Mixed equipment and clothing variations. |
| Light cavalry | `JIZDA_HUSITI`, `LEHKA_JIZDA`, `JIZDA_PRASKY` | Dedicated `cavalry_light`, red/blue cloth and shield | Base mounted coverage complete; more regional equipment and poses can follow. |
| Scouts | `ZVED`, `ZVED_KRIZACI` | Dedicated `cavalry_scout`, cloth cap, travel gear and no raised lance | Base mounted coverage complete; further clothing/horse variation optional. |
| Heavy cavalry | `SLECHTICKA_JIZDA_HUSITI`, `TEZKY_RYTIR`, `TEZKOODENCI` | Dedicated `cavalry_heavy`, armour, lance, shield and horse cloth | Mounted and explicit dismounted appearances complete. A less armoured men-at-arms variant remains optional. |
| Field artillery | `HOUFNICE`, `HOUFNICE_PRASKY`, `TARASNICE`, `POLNI_DELO` | Dedicated houfnice/tarasnice models, each with two visual crew figures | Base coverage complete; the generic field gun shares the tarasnice silhouette. Additional crew poses and equipment variants can follow. |
| Siege artillery | `BOMBARDA` | Dedicated bombard on a timber bed with stone shot and two visual crew figures | Base coverage complete. Definition belongs to `hussites`; the displayed pair is a crew abstraction, not the historical crew size. |
| War wagons | `VOZOVA_HRADBA`, `VOZOVA_HRADBA_PRASKY` | Both use the wagon, with red/blue crew clothing and flags; both retain the chalice | Crew poses and damaged/abandoned states. |
| Fieldwork garrison | `POLNI_OPEVNENI` | Fixed timber shelter, low stone front and two visible crossbow defenders | More site-specific fieldworks during battle-environment authoring. |
| Pilgrims | `POUTNICI` | Five figures combining adults, women and a child, with ordinary clothing and bundles | More clothing, luggage and poses. |
| Commanders | All 27 commander definitions; full list below | Explicit captain/noble/cleric assignments and independent faction-colour neutral standards | Individual portraits, dated equipment and researched personal heraldry. |

Dismounted heavy infantry is now shown when the engine explicitly sets `dismounted`. Merely losing a charge bonus, slowing down or appearing in dismount-related narration does not change the model. Existing saves without the optional flag default to mounted; new saves preserve it. Likewise routing, marching, damaged wagons and abandoned guns can be poses or prop states rather than entirely new models.

## Sides, colours and heraldry

Keep **game side**, **historical affiliation**, and **unit equipment** separate. The data uses two gameplay factions, `hussites` and `crusaders`, but the second can represent Prague/moderate Hussites or another coalition. Lipany explicitly defines blue Prague variants. A blue Hussite wagon should not automatically receive a crusader cross.

Every active unit family now has deliberate side-colour slots where appropriate, including the older soldiers and wagons. Civilian clothing stays mostly neutral, with small side accents. Wood, metal, skin and powder flasks retain their own colours. Commander standards use neutral geometric stripes; researched personal heraldry remains optional later work.

Proposed art scheme, not a claim about historical uniforms:

| Layer | Proposed coverage |
| --- | --- |
| Immediate side recognition | Muted red vs muted blue cloth accents, plus a small formation marker with differing symbol/shape. Keep neutral cloth, leather, wood and metal shared. |
| Hussite identity | Chalice shield/flag variants; optional distinctions between field armies, Prague and allied nobles only where scenario data supports them. |
| Catholic/royal/crusading identity | Appropriate cross, royal or noble banner variants. Verify specific heraldry before making named historical claims. |
| Hussite civil conflicts | Chalices on both sides where appropriate, with opposing side accents and commander standards. |
| Individual leaders | Cleric versus noble versus field captain silhouettes; Žižka-specific head/weapon detail after reference review; heraldic shields as interchangeable parts. |
| Variation within a formation | A few neutral coat colours, helmet/head variants, shield designs and horse coats. Avoid making every person look uniformly dressed. |

Use a small number of shared meshes with interchangeable weapons, shields, headgear, cloth materials and flag designs. The presenter clones and caches tagged materials per appearance variant, preserving the original prototype. Extend that convention to future models; `clone(true)` alone shares materials and must not be used to recolour both armies accidentally.

## Environment batches

| Batch | Pieces | Generator and references |
| --- | --- | --- |
| Settlement (9) | Timber/plaster houses, townhouse, barn, shed, monastery wing, Gothic church, fence gate and well | `tools/art/blender/settlement_batch.py`; [references](../tools/art/blender/settlement-references.md); `render_settlement_batch.py` |
| Camp (11) | Small/pavilion tents, baggage cart, barrels, sacks, cold cooking fire, ammunition, haystack, timber pile, discarded equipment and abandoned wagon | `tools/art/blender/camp_batch.py`; [references](../tools/art/blender/camp-references.md); `render_camp_batch.py` |
| Landscape (8) | Rock foundation, field shelter, low wall, firing platform, bridge approach, ford stones, reeds and bank rocks | `tools/art/blender/landscape_batch.py`; [references](../tools/art/blender/landscape-references.md); `render_landscape_batch.py` |

The batch builders register their outputs through `tools/art/blender/build_assets.py`; the shared model catalog and measured manifest are maintained at `assets/3d/model-paths.json` and `assets/3d/models/manifest.json`. Houses and camp pieces present their fronts along source Blender −Y, which exports as glTF +Z. Functional landscape pieces such as the shelter, firing bed and bridge approach face source +X and retain glTF +X.

## Optional refinements

The environment and roster baselines are complete. Follow-up art can add optional unit poses and equipment variation, personal heraldry after source checks, more exact archaeological/site-specific detail, or decorative livestock and lore props such as the Plzeň camel and Kutná Hora cattle. These are refinements, not missing map or roster coverage; no gameplay unit or rule depends on them.

## Evidence and verification

- Roster and scenarios: `js/data/unitTypes.js`, `js/data/scenarios.js`, and `js/data/battleLore.js`.
- Environment placement and terrain shaping: `views/3d/src/environment-plan.ts`, `generated-scenery.ts`, `scenery.ts`, `landscape-details.ts`, and `topography.ts`.
- Ice observation and save state: `js/core/game.js`, `js/systems/SaveGameSystem.js`, and `views/3d/src/generated-scenery.ts`.
- Unit recipes and appearance lifecycle: `views/3d/src/unit-recipes.ts` and `views/3d/src/units.ts`.
- Asset sources, references and conventions: `tools/art/blender/README.md`; shared GLBs and manifests under `assets/3d/`; experimental exports under `experiments/sudomer-diorama/assets/models/`.

The implementation pass verified all 28 environment exports for grounded static geometry, bounds and usage; the shared export validator and 3D build passed. The full project gate passed. After the final terrain and winter refinements, the production build and all 98 renderer tests passed; twelve targeted environment/topography checks also passed during the final corrections. All 18 campaign scenes loaded to Ready with their actual rosters and no errors or warnings. Representative scenes and all three canonical galleries were visually reviewed, but not every map was inspected from every angle. Environment changes are presentation-only: they do not change battle rosters, movement, combat or drowning rules.

## Complete roster mapping

This appendix records the current Three.js base-model selection, not whether that selection is suitable. Each commander also has a `commander_standard`; artillery adds two `artillery_gunner` figures. H/C are the definition's default faction; scenario-side assignment may differ.

| Type | Name | Default side | Current model |
| --- | --- | --- | --- |
| `CEPNICI` | Cepníci | H | `infantry_flail` |
| `SUDLICNICI` | Sudličníci | H | `infantry_polearm` |
| `PAVEZNICI` | Pavézníci | H | `infantry_pavise` |
| `KOPINICI_HUSITI` | Kopiníci | H | `infantry_spear` |
| `KUSINICI_HUSITI` | Kušiníci | H | `infantry_crossbow` |
| `RUCNICARI` | Ručničáři | H | `infantry_handgun` |
| `HOUFNICE` | Houfnice | H | `artillery_houfnice` + `artillery_gunner` |
| `TARASNICE` | Tarasnice | H | `artillery_tarasnice` + `artillery_gunner` |
| `POLNI_OPEVNENI` | Posádka srubu | H | `field_blockhouse` |
| `VOZOVA_HRADBA` | Bojový vůz | H | `war_wagon` (`war_wagon_open` when unchained) |
| `JIZDA_HUSITI` | Lehká jízda | H | `cavalry_light` |
| `SLECHTICKA_JIZDA_HUSITI` | Šlechtická jízda | H | `cavalry_heavy` |
| `POUTNICI` | Poutníci | H | `civilian_adult` + `civilian_woman` + `civilian_child` |
| `ZVED` | Zvěd | H | `cavalry_scout` |
| `TEZKY_RYTIR` | Těžký rytíř | C | `cavalry_heavy` |
| `TEZKOODENCI` | Těžkooděnci | C | `cavalry_heavy` |
| `LEHKA_JIZDA` | Lehká jízda | C | `cavalry_light` |
| `ZVED_KRIZACI` | Zvěd | C | `cavalry_scout` |
| `KOPINICI` | Kopiníci | C | `infantry_spear` |
| `HALAPARTNICI` | Halapartníci | C | `infantry_halberd` |
| `PAVEZNICI_KRIZACI` | Pavézníci | C | `infantry_pavise` |
| `KUSNICI_JANOV` | Janovští kušiníci | C | `infantry_crossbow` |
| `KUSNICI` | Kušiníci | C | `infantry_crossbow` |
| `LUCISTNICI` | Lučištníci | C | `infantry_archer` |
| `BOMBARDA` | Bombarda | H | `artillery_bombard` + `artillery_gunner` |
| `POLNI_DELO` | Polní dělo | C | `artillery_tarasnice` + `artillery_gunner` |
| `ZOLDNERI` | Žoldnéři | C | `infantry_shield` |
| `JAN_ZIZKA` | Jan Žižka | H | `commander_captain` |
| `PROKOP_HOLY` | Prokop Holý | H | `commander_cleric` |
| `JAN_ZELIVSKY` | Jan Želivský | H | `commander_cleric` |
| `VACLAV_KORANDA` | Václav Koranda | H | `commander_cleric` |
| `ZATECKY_HEJTMAN` | Žatecký hejtman | H | `commander_captain` |
| `JAN_ROHAC` | Jan Roháč z Dubé | H | `commander_noble` |
| `FRIDRICH_MISNENSKY` | Fridrich IV. Bojovný | C | `commander_noble` |
| `BOHUSLAV_SVAMBERK` | Bohuslav ze Švamberka | C | `commander_noble` |
| `ZIKMUND` | Zikmund Lucemburský | C | `commander_noble` |
| `FILIPPO_SCOLARI` | Filippo Scolari | C | `commander_noble` |
| `HEINRICH_ISENBURG` | Heinrich z Isenburgu | C | `commander_noble` |
| `ERKINGER_SEINSHEIM` | Erkinger ze Seinsheim | C | `commander_noble` |
| `FRIDRICH_SASKY` | Fridrich Saský | C | `commander_noble` |
| `BOSO_VITZTHUM` | Boso z Vitzthumu | C | `commander_noble` |
| `PETR_STERNBERK` | Petr ze Šternberka | C | `commander_noble` |
| `VILEM_SVIHOVSKY` | Vilém Švihovský | C | `commander_noble` |
| `BRENEK_SVIHOVSKY` | Břeněk Švihovský | H | `commander_noble` |
| `HYNEK_NEKMIRE` | Hynek z Nekmíře | C | `commander_noble` |
| `HYNEK_KRUSINA` | Hynek Krušina | H | `commander_noble` |
| `JINDRICH_PLUMOV` | Jindřich z Plumlova | C | `commander_noble` |
| `DIVIS_BOREK` | Diviš Bořek | H | `commander_noble` |
| `CENEK_VARTENBERK` | Čeněk z Vartenberka | C | `commander_noble` |
| `ARNOST_FLASKA` | Arnošt Flaška | C | `commander_noble` |
| `JINDRICH_BERKA` | Jindřich Berka z Dubé | C | `commander_noble` |
| `JAN_HVEZDA` | Jan Hvězda z Vícemilic | H | `commander_captain` |
| `HYNEK_PODEBRADY` | Hynek z Poděbrad | H | `commander_noble` |
| `VIKTORIN_BOCEK` | Viktorín Boček | H | `commander_noble` |
| `VOZOVA_HRADBA_PRASKY` | Pražské vozy | C | `war_wagon` (`war_wagon_open` when unchained) |
| `CEPNICI_PRASKY` | Pražští cepníci | C | `infantry_flail` |
| `KUSINICI_PRASKY` | Pražští kušiníci | C | `infantry_crossbow` |
| `HOUFNICE_PRASKY` | Pražské houfnice | C | `artillery_houfnice` + `artillery_gunner` |
| `JIZDA_PRASKY` | Pražská jízda | C | `cavalry_light` |
