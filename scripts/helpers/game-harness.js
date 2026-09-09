const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { TestBattleView } = require('./test-battle-view');

// Skutečné herní třídy a data; nahrazujeme jen prohlížeč, zvuk a čas.
function createHarness({ browserView = false, pathname = '/', storage = new Map() } = {}) {
    let now = 0, nextTimer = 1;
    const timers = new Map(), elements = new Map();
    const noop = () => {};
    class Element extends EventTarget {
        constructor() {
            super();
            const classes = new Set();
            this.classList = {
                add: (...names) => names.forEach(name => classes.add(name)),
                remove: (...names) => names.forEach(name => classes.delete(name)),
                contains: name => classes.has(name),
                toggle: (name, force = !classes.has(name)) => {
                    if (force) classes.add(name); else classes.delete(name);
                    return force;
                }
            };
            this.style = {}; this.dataset = {}; this.children = [];
            this.textContent = ''; this.innerHTML = ''; this.disabled = false;
            this.clientWidth = 800; this.clientHeight = 600;
            this.scrollLeft = 0; this.scrollTop = 0;
            this.attributes = new Map();
        }
        getContext() { return {}; }
        focus() { document.activeElement = this; }
        setAttribute(key, value) { this.attributes.set(key, String(value)); }
        getAttribute(key) { return this.attributes.get(key) ?? null; }
        getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; }
        querySelector() { return null; }
        querySelectorAll() { return []; }
        appendChild(child) { this.children.push(child); child.parentNode = this; }
        append(...children) { children.forEach(child => this.appendChild(child)); }
        removeChild(child) { this.children = this.children.filter(item => item !== child); child.parentNode = null; }
        remove() { if (this.parentNode) this.parentNode.removeChild(this); }
        replaceChildren(...children) { this.children.forEach(child => { child.parentNode = null; }); this.children = []; this.append(...children); }
    }
    const document = new Element();
    document.getElementById = id => {
        if (!elements.has(id)) elements.set(id, new Element());
        return elements.get(id);
    };
    document.createElement = () => new Element();
    document.body = new Element();
    const random = Object.create(Math);
    random.random = () => 0.5;
    const context = vm.createContext({
        console, AbortController, Map, Set, Math: random,
        Date: class extends Date {
            constructor(...args) { super(...(args.length ? args : [now])); }
            static now() { return now; }
        },
        document, window: {}, location: { pathname },
        localStorage: {
            getItem: key => storage.get(key) ?? null,
            setItem: (key, value) => storage.set(key, String(value)),
            removeItem: key => storage.delete(key)
        },
        i18n: { t: (key, params = {}) => `${key} ${JSON.stringify(params)}`, hasTranslation: () => false },
        Sound: new Proxy({}, { get: () => noop }),
        setTimeout: (fn, ms = 0) => { const id = nextTimer++; timers.set(id, { fn, at: now + ms }); return id; },
        clearTimeout: id => timers.delete(id),
        requestAnimationFrame: noop, cancelAnimationFrame: noop
    });
    for (const file of [
        'core/GameStorage.js',
        'data/unitTypes.js', 'entities/Unit.js', 'entities/UnitFactory.js', 'ui/WoodcutRenderer.js', 'core/hex.js',
        'data/scenarios.js', 'data/campaign.js', 'systems/CampaignProgressSystem.js',
        'systems/CombatSystem.js', 'systems/FogOfWarSystem.js', 'systems/MoraleSystem.js',
        'systems/VictoryConditionsSystem.js', 'systems/TutorialSystem.js',
        'systems/BattleActionSystem.js', 'systems/SaveGameSystem.js', 'systems/ScenarioEventSystem.js',
        'ui/BattlePanels.js', 'ui/BattleTooltip.js', 'ui/BattleMapInput.js', 'ui/BattleOrders.js', 'ui/BattleView.js', 'core/game.js', 'ai.js'
    ]) {
        const filename = path.join(__dirname, '../../js', file);
        vm.runInContext(fs.readFileSync(filename, 'utf8'), context, { filename });
    }
    const api = vm.runInContext('({ Game, GameStorage, CampaignProgressSystem, HexGrid, Unit, UnitFactory, Scenarios, ScenarioManager, SaveGameSystem, ScenarioEventSystem, AI, BattleView, BattlePanels, BattleTooltip, BattleMapInput, BattleOrders })', context);
    const viewFactory = game => {
        if (!browserView) return new TestBattleView(game);
        // UI testy používají skutečný adaptér a DOM double; Canvas drawing není jejich předmět.
        game.hexGrid.render = noop;
        const view = new api.BattleView(game);
        view.minimap.render = noop;
        return view;
    };
    const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
    const advance = async ms => {
        const until = now + ms;
        await flush();
        let count = 0;
        while (true) {
            const next = [...timers].sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0];
            if (!next || next[1].at > until) break;
            timers.delete(next[0]); now = next[1].at; next[1].fn();
            await flush();
            if (++count > 10000) throw new Error('Timer loop did not settle');
        }
        now = until;
        await flush();
    };
    const newGame = (id = null) => {
        const scenario = id ? structuredClone(api.ScenarioManager.getScenario(id)) : null;
        const size = scenario?.mapSize || { width: 16, height: 10 };
        const game = new api.Game(new api.HexGrid(document.getElementById('game-canvas'), size.width, size.height, 40), { viewFactory });
        game.fogOfWar = false;
        if (scenario) game.initGameWithScenario(scenario);
        else game.initGame();
        return game;
    };
    return { ...api, newGame, document, storage, advance, flush, timers, context, viewFactory, now: () => now };
}

module.exports = { createHarness };
