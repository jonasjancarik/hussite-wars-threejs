# Civilian and commander figures

Read when editing the completed unit families or adding individual character variants.

Created 21–22 September 2026. The models use the same faceted proportions, neutral materials and static poses as the earlier batches. They are original authored geometry. Three civilian models, three commander bases and one armoured foot model complete the remaining figure roles; no mesh or texture was extracted from another game.

## References and choices

- [KCD II village clothing screenshot](https://cdn.gracza.pl/gallery/gallery_big3/-1962354578.jpg), published with [GamePressure's Invaders guide](https://www.gamepressure.com/kingdom-come-deliverance-2/what-to-do-with-the-cumans/z6117f7): visually inspected for long skirts, cloth head coverings, tied waists and ordinary clothing layers. The civilian woman uses a head wrap, long dress and curved apron; she carries a bundle. This is a generic travelling civilian, not a copy of an NPC.
- The adult reuses the body construction of the existing `battle_unarmed_adult` authoring source, with the helmet removed and a soft cap, walking staff and bundle added. The child is a smaller civilian with adjusted head proportions and a small bundle. The child is an authored interpretation, not a KCD II reference character.
- [The Met's visored bascinet, ca. 1375–1400](https://www.metmuseum.org/art/collection/search/21986), also used for the cavalry batch, informs the armoured foot figure. The noble's open face and cloak distinguish the commander from the closed-visored dismounted soldier. Neither is a measured reconstruction of a complete suit.
- Commander role assignments use the roster's equipment descriptions. Captain, armoured noble and cleric are shared visual bases. The captain carries a mace, the noble a sword and shield, and the cleric a book and chalice. No individual likeness, personal arms, crown or date-specific blindness is asserted. Žižka currently uses the captain base; distinct personal details can be added later.

The cleric's robe, collar, tonsure, book and chalice communicate the role at game scale. They are a generic interpretation rather than a claim about the exact battlefield dress of each of the three clerical commanders. The neutral striped standard from the support kit replaces the former universal Hussite chalice flag on commanders; its red/blue accents follow actual game side.

## Runtime coverage

| Models | Used for |
| --- | --- |
| `civilian_adult`, `civilian_woman`, `civilian_child` | `POUTNICI`: two adults, two women and one child as an abstract group |
| `commander_captain` | Žižka, the Žatec captain and Jan Hvězda |
| `commander_cleric` | Prokop Holý, Jan Želivský and Václav Koranda |
| `commander_noble` | The other 21 commanders, including Jan Roháč |
| `infantry_dismounted` | Heavy cavalry when the existing explicit `dismounted` state is true |

Dismounted light cavalry uses spear infantry, and dismounted scouts use the plain sword/shield infantry. Losing a charge bonus or movement points alone does not imply a change of mount. The explicit flag now survives save/load; older saves without it default to mounted. There are no new unit definitions, balance changes or altered scenario rosters.

The commander standard is cloned for each figure; faction palette materials are shared safely. Civilian losses use the same stable visible-figure slots as other infantry. The blockhouse retains its two baked defenders as part of the fortification model.

## Rebuild and verification

```sh
/opt/homebrew/bin/blender --background --factory-startup --python-exit-code 1 --python tools/art/blender/build_assets.py -- civilian_adult civilian_woman civilian_child commander_captain commander_noble commander_cleric infantry_dismounted
/opt/homebrew/bin/blender --background --factory-startup --python-exit-code 1 --python tools/art/blender/render_unit_completion.py
```

The support models are described in [support-unit-references.md](support-unit-references.md). Astra extra-high reviewed the support modelling and these figure previews. Corrections included grounded/contacting parts, a draped apron, a connected cleric neckline, the child's cap placement, and a hollow chalice. The combined `previews/unit-completion.png` is rendered from final GLBs.

Validation includes the full project gate, 83 3D tests, GLB checks, TypeScript/Vite build, all-59-type real-asset coverage, mounted/dismounted save and appearance regressions, civilian visible losses, and browser rendering/selection. Native Bevy scenes, mobile-device performance and new individual portrait/heraldry work are outside this pass.
