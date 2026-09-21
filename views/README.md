# Game views

Read when choosing where presentation code belongs.

Both views present the same live game. `js/core`, `js/systems`, `js/entities` and `js/data` own the rules and state. Shared battle panels, input coordination and lifecycle remain in `js/ui/BattleView.js` and its helpers.

- [2D](2d/README.md): the default canvas/woodcut map and vector unit symbols.
- [3D](3d/README.md): the Three.js landscape, campaign adapter, tests and built browser bundle.

Switching views does not create another game, reload a scenario or change its rules. `index.html` loads the two presentation entrypoints; the larger 3D bundle is loaded on demand. Keep experimental viewers and benchmarks under `experiments/`, not here.

The shared map toolbar keeps **2D**, **3D**, zoom, **Find unit** and **Minimap** visible. In 3D its cog opens **Map options** for Hex grid, Separate banners and Unit details; the cog is hidden in 2D, where neither setting applies. Escape or a click outside closes the menu; Escape returns focus to the cog. Display toggles keep the menu open, while Find unit and Minimap close it after the action.
