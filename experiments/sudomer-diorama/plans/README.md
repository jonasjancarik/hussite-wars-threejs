# Battlefield implementation plans

Project plans and implementation decisions. The visual POC is implemented; later gameplay and scale work remains incremental.

| Plan | Purpose | Status |
|---|---|---|
| [001](001-battlefield-visual-poc.md) | Match the Hussite concept art, prove real terrain, and add a short interactive battle vignette | Proposed |
| [002](002-hybrid-soldier-visuals.md) | Keep detailed soldiers nearby and use flattened soldiers for large or distant formations | Agreed direction; not integrated |
| [003](003-procedural-landscapes.md) | Generate reusable, art-directed landscapes from geographic data, historical adjustments, and a seed | Proposed |
| [004](004-sudomer-playable-battle.md) | Full-scale Sudoměř with static figurines, real-time formation orders, pause and survival objectives | Partial implementation; milestones 1–2 complete, later acceptance gaps recorded |
| [005](005-sudomer-hex-diorama.md) | Initial hex prototype using the friend's turn-based rules, Bevy rendering and reduced figurine groups | Implemented baseline; renderer direction and visual acceptance superseded by 006 |
| [006](006-threejs-authored-hex-diorama.md) | Port the hex view to Three.js using procedural-worlds rendering, lighting and DoF, with an authored organic landscape | Implemented and browser-verified on WebGPU |

Plan 001 records the original visual POC. Plan 002 should be read before changing infantry spawning, selection visuals, formation rendering, or large-battle quality settings.

Plan 003 should be read before generalizing the Sudoměř prototype, adding another geographic map, or connecting generated terrain to gameplay.

Plan 004 is the next playable-battle handoff. Execute its milestones in order: scenario and accounting → full-roster static rendering → navigation → controls → combat and outcomes → enemy pressure → measured native/browser verification. It incorporates the applicable stable-root principles of plan 002, but does not depend on completing plan 002's optional hybrid detail switching or plan 003's generalized terrain generator. Default scenario assumptions are 400 people and 12 wagons against 2,000 riders, with an 800-rider alternative. All participants retain fixed poses; only whole pieces move and turn. Historical estimates and the invented role split are explicit in the plan.

Plan 005 is an independent experiment, not a dependency or replacement for plan 004. Its JavaScript rules, AI, bridge and parity tests form the baseline preserved by plan 006; its units remain illustrative groups rather than one figure per person. Plan 006 is now implemented as the default browser hex version: representative art sample and reused rendering pipeline → continuous authored terrain → existing gameplay integration → isolated packaging and visual/browser verification. Procedural-worlds remains the primary rendering source, including its TSL graph, lighting, sky, vegetation, focus behavior and batching. The held-still Bevy diorama remains the composition/model reference, and the other Bevy scenes are preserved.

The source project is `/Users/janca/projects/procedural-worlds`; plan 006 inspected HEAD `bada861` on 2026-09-20. Verify its working changes before transferring code and keep that project unchanged.
