(function () {
    'use strict';
    let game = null;
    let generation = 0;
    let visibilityPaused = false;
    const noop = () => {};
    globalThis.Sound = new Proxy({}, { get: () => noop });
    globalThis.Music = new Proxy({}, { get: () => noop });
    let locale = null;
    globalThis.i18n = { t(key, params = {}) {
        const value = key.split('.').reduce((current, part) => current?.[part], locale) || key;
        return Object.entries(params).reduce((text, [name, replacement]) => text.replaceAll(`{${name}}`, replacement).replaceAll(`{{${name}}}`, replacement), String(value));
    }, hasTranslation(key) { return key.split('.').reduce((current, part) => current?.[part], locale) != null; } };

    async function start() {
        game?.destroy();
        generation += 1;
        locale ||= await fetch('hex-diorama/vendor/husitske-valky/js/i18n/locales/cs.json').then(response => response.json());
        const canvas = document.createElement('canvas');
        const scenario = structuredClone(ScenarioManager.getScenario('sudomere_1420'));
        const grid = new HexGrid(canvas, scenario.mapSize.width, scenario.mapSize.height, 40);
        grid.render = noop;
        game = new Game(grid, { viewFactory: current => new DioramaBattleView(current) });
        game.fogOfWar = false;
        SudomerHexBridge.bind(game, game.view, generation);
        game.initGameWithScenario(scenario);
        game.view.publish('boot');
        return game;
    }
    function rendererFailed(error) {
        game?.destroy(); game = null; SudomerHexBridge.reset();
        const box = document.querySelector('#error'); box.hidden = false;
        box.textContent = `The 3D board stopped: ${error?.message || error}`;
    }
    document.addEventListener('visibilitychange', () => {
        if (!game) return;
        if (document.hidden && !game.isPaused) {
            visibilityPaused = true; game.setPaused(true);
        } else if (!document.hidden && visibilityPaused) {
            visibilityPaused = false; game.setPaused(false);
        }
    });
    globalThis.SudomerHexBoot = { start, restart: start, rendererFailed, get game() { return game; } };
    addEventListener('DOMContentLoaded', () => start().catch(error => { const box=document.querySelector('#error'); box.hidden=false; box.textContent=`The rules engine could not start: ${error.message}`; }), { once: true });
})();
