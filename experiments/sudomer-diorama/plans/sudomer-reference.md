# Sudoměř: battle context and gameplay options

`read_when`: designing the first playable Sudoměř scenario or choosing between turn-based and real-time combat.

Research note, 20 September 2026. No gameplay direction has been selected or implemented by this note.

## Reference project

Josef Šlerka's [Husitské války](https://github.com/josefslerka/husitske-valky) is cloned at `/Users/janca/oss/husitske-valky`, branch `main`, inspected commit `dbdf61907212476cda816ff2036a9a8d41bf3572`. It is a browser-based hex strategy game. Its MIT license permits reuse subject to retaining the copyright and permission notice in copies or substantial portions. No code or assets were copied into this project.

Start with these files in the clone:

- `js/data/scenarios.js:399`: current `sudomere_1420` scenario, terrain, deployments, phases and objectives.
- `js/data/battleLore.js:70`: commanders, traditional strength estimates, outcome and uncertainty.
- `js/i18n/locales/en.json:30` and the Czech equivalent: explicit distinction between history and reconstruction.
- `js/data/historicalSources.js`: source catalogue and scenario references.
- `docs/HISTORICAL_AUDIT.md`: historical editorial policy and known limitations.
- `PLAN_SUPERSTAR_II.md`: earlier design critique of passive wagon defence. Treat its measurements and implementation descriptions as dated notes, not verified current behavior.

Prefer current scenario data and historical notes over older design documents. Some encyclopedia and outcome text still uses more categorical language than the audit supports.

## Historical basis

The repository points to Jan Biederman's [VHÚ account](https://www.vhu.cz/bitva-u-sudomere-s-vozy-proti-zeleznym-panum/), checked on 20 September 2026. It describes a retreating group travelling from Plzeň toward Tábor, including noncombatants, defending with wagons between ponds on 25 March 1420. Restricted approaches and muddy ground reduced the attackers' advantage. Fighting continued until dusk; the attackers withdrew and the Hussites could continue their journey.

This supports a scenario about preserving the travelling group and its ability to move on. It does not require annihilating the enemy. Exact command roles and casualties remain uncertain. The often repeated roughly 400 people and 12 wagons are reported estimates, not a precise combat roster; do not turn 400 people into 400 infantry. The repository's lore gives 700–2,000 enemy cavalry, while VHÚ describes an advantage of almost two to one: there is no single verified headcount to import.

The clone models Markovec as water and Škaredý as mud. Its hex layout is an abstraction, not geographic evidence. Keep our sourced terrain and separately document proposed deployment positions; the existing scenic wagon placement does not establish a historical battle line.

## What the reference scenario actually specifies

| Element | Current scenario data | Use here |
|---|---|---|
| Battlefield | 20 × 12 hexes; water, muddy basin and a two-hex causeway | Preserve the tactical relationship, not the hex coordinates |
| Wagons | Three wagon units initially open, with nearby ranged troops and reserves | Make choosing and preparing a defensive position a player action |
| Attackers | Cavalry-led force; three additional units scheduled for turn 6 | Inspiration for changing pressure; timing is authored |
| Duration | 12 turns; survive with at least 50% of units, or eliminate the enemy field army | Starting design reference, not elapsed historical time or an agreed objective |
| Atmosphere | Phase messages describe fog, including a turn-10 message | Do not assume a message proves a visibility mechanic exists |

These are source-code observations, not a playtest. Unit tokens represent groups, not individual people or a reliable strength ratio.

## Two possible directions

Both can retain our miniature 3D landscape and formation visuals. Turn-based play does not require copying the reference's 2D presentation or adopting visible hexes.

| Decision | Turn-based interpretation | Real-time interpretation |
|---|---|---|
| Deploy wagons | Spend an action to establish or open the line | Deployment takes time and temporarily exposes crews |
| Use terrain | Show movement costs and attack previews before committing | Mud slows formations and disrupts charges; narrow routes limit frontage |
| Commit reserves | Choose which sector receives the next action | Time a counterattack while another formation holds |
| Survive until dusk | A limited number of rounds | A scenario clock, with pause available for orders |
| Protect the group | Keep a viable route and sufficient survivors | Hold approaches while preserving the column and a withdrawal route |

My suggested first experiment is a small Sudoměř defence with wagon deployment, one firm approach, one muddy flank and a survival objective. In real time this tests frontage, congestion and timely orders; in turns it tests positioning and action costs. Either needs terrain-aware movement and actual combat, which the landscape viewer does not yet provide.

The reference's earlier design critique identifies a useful question to test: does deploying the wagons once solve the whole encounter? Pressure on a second approach, a vulnerable section of the travelling group, or an opportunity for a risky sortie could create further decisions. These are proposed game devices, not established details of the battle. Choose one for the first experiment rather than adding all three.

Keep the scenario's terrain regions, forces and objectives separate from its timing rules. That leaves room to choose the combat format without rebuilding the landscape. This is a design recommendation, not a request to implement two combat engines.

## Verification

Clone completed and its working tree was clean after inspection. Compared the current Sudoměř scenario, lore, historical audit and source catalogue with this project's README and procedural-landscape plan. Checked the linked VHÚ account. No game was launched, no balance claim was tested, and no builds were run because this change only adds research notes.
