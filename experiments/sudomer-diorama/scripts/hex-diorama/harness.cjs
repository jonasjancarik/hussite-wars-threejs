const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const files = [
    'core/GameStorage.js', 'data/unitTypes.js', 'entities/Unit.js', 'entities/UnitFactory.js', 'ui/WoodcutRenderer.js', 'core/hex.js',
    'data/scenarios.js', 'data/campaign.js', 'systems/CampaignProgressSystem.js',
    'systems/CombatSystem.js', 'systems/FogOfWarSystem.js', 'systems/MoraleSystem.js',
    'systems/VictoryConditionsSystem.js', 'systems/TutorialSystem.js', 'systems/BattleActionSystem.js',
    'systems/SaveGameSystem.js', 'systems/ScenarioEventSystem.js', 'ui/BattlePanels.js', 'ui/BattleTooltip.js',
    'ui/BattleMapInput.js', 'ui/BattleOrders.js', 'ui/BattleView.js', 'core/game.js', 'ai.js'
];

function createHarness({ root, adapter = false } = {}) {
    let now = 0, nextTimer = 1, randomCalls = 0;
    const timers = new Map(), storage = new Map(), listeners = new Map();
    const noop = () => {};
    class Element extends EventTarget {
        constructor() { super(); this.style = {}; this.dataset = {}; this.children = []; this.classList = { add: noop, remove: noop, contains: () => false, toggle: () => false }; }
        getContext() { return {}; }
        appendChild(child) { this.children.push(child); }
        getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; }
        querySelector() { return null; }
        querySelectorAll() { return []; }
        setAttribute() {}
    }
    const document = new Element();
    const elements = new Map();
    document.getElementById = id => { if (!elements.has(id)) elements.set(id, new Element()); return elements.get(id); };
    document.createElement = () => new Element();
    document.body = new Element();
    const random = Object.create(Math); random.random = () => { randomCalls += 1; return 0.5; };
    const context = vm.createContext({
        console, AbortController, EventTarget, structuredClone, Map, Set, Math: random,
        Date: class extends Date { constructor(...args) { super(...(args.length ? args : [now])); } static now() { return now; } },
        document, window: {}, location: { pathname: '/sudomer-hex.html' }, CustomEvent: class { constructor(type, init) { this.type = type; this.detail = init?.detail; } },
        addEventListener(type, fn) { listeners.set(type, fn); }, dispatchEvent(event) { listeners.get(event.type)?.(event); },
        localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)), removeItem: key => storage.delete(key) },
        i18n: { t: (key, params = {}) => `${key} ${JSON.stringify(params)}`, hasTranslation: () => false },
        Sound: new Proxy({}, { get: () => noop }), Music: new Proxy({}, { get: () => noop }),
        setTimeout: (fn, ms = 0) => { const id = nextTimer++; timers.set(id, { fn, at: now + ms }); return id; }, clearTimeout: id => timers.delete(id),
        requestAnimationFrame: noop, cancelAnimationFrame: noop
    });
    context.globalThis = context;
    for (const file of files) vm.runInContext(fs.readFileSync(path.join(root, 'js', file), 'utf8'), context, { filename: file });
    if (adapter) {
        for (const file of ['bridge.js', 'view.js']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../../web/hex-diorama', file), 'utf8'), context, { filename: file });
    } else {
        vm.runInContext(fs.readFileSync(path.join(root, 'scripts/helpers/test-battle-view.js'), 'utf8').replace(/module\.exports[^;]+;/g, ''), context, { filename: 'test-battle-view.js' });
    }
    const api = vm.runInContext('({ Game, HexGrid, ScenarioManager, TestBattleView: typeof TestBattleView === "undefined" ? null : TestBattleView, DioramaBattleView: globalThis.DioramaBattleView })', context);
    const flush = async () => { for (let index = 0; index < 30; index++) await Promise.resolve(); };
    const advance = async ms => {
        const end = now + ms; await flush(); let count = 0;
        while (true) {
            const next = [...timers].sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
            if (!next || next[1].at > end) break;
            timers.delete(next[0]); now = next[1].at; next[1].fn(); await flush();
            if (++count > 20000) throw new Error('Timer loop did not settle');
        }
        now = end; await flush();
    };
    const newGame = () => {
        const scenario = structuredClone(api.ScenarioManager.getScenario('sudomere_1420'));
        const grid = new api.HexGrid(document.getElementById('rules-canvas'), 20, 12, 40); grid.render = noop;
        const View = adapter ? api.DioramaBattleView : api.TestBattleView;
        const game = new api.Game(grid, { viewFactory: current => new View(current) });
        game.fogOfWar = false;
        if (adapter) context.SudomerHexBridge.bind(game, game.view, 1);
        game.initGameWithScenario(scenario);
        return game;
    };
    return { ...api, context, newGame, advance, flush, timers, randomCalls: () => randomCalls };
}

module.exports = { createHarness };
