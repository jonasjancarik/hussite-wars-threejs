#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHarness } = require('./helpers/game-harness');
const { createLocalizedHarness } = require('./helpers/localized-harness');
const tests = [];
const test = (name, run) => tests.push({ name, run });
const plain = value => JSON.parse(JSON.stringify(value));
const quiet = h => { h.context.console = { ...console, warn() {}, error() {} }; };

for (const language of ['cs', 'en']) {
    test(`${language}: pokyny jsou lokalizované pro výběr, pohyb, ústup i konec tahu`, async () => {
        const h = await createLocalizedHarness(language), game = h.newGame('zivohost_1419');
        const panels = new h.BattlePanels(game), unit = game.units.find(u => u.type === 'CEPNICI');
        const check = key => {
            assert.equal(panels.getGuidance()?.key, key);
            panels.updateGuidance();
            assert.equal(h.document.getElementById('turn-guidance').textContent,
                h.i18n.t(`onboarding.hints.${key}`, { unit: panels.getGuidance().unit }));
            assert.equal(h.i18n.hasTranslation(`onboarding.hints.${key}`), true);
        };
        check('select'); game.selectUnit(unit); check('move');
        unit.hasMoved = true; check('attack');
        unit.isRouting = true; check('routing'); unit.isRouting = false;
        unit.hasAttacked = true; check('spent');
        for (const u of game.getUnitsOfFaction('hussites')) { u.hasMoved = true; u.hasAttacked = true; }
        check('endTurn');
        game.actions.busy = true; check('busy'); game.actions.busy = false;
        game.currentFaction = 'crusaders'; check('enemyTurn');
        game.setPaused(true); check('paused');
        game.destroy(); assert.equal(panels.getGuidance(), null);
        panels.updateGuidance(); assert.equal(h.document.getElementById('turn-guidance').classList.contains('hidden'), true);
    });

    test(`${language}: sepnutý vůz a přesunuté dělo nedostanou nemožný rozkaz`, async () => {
        const h = await createLocalizedHarness(language), game = h.newGame('sudomere_1420');
        const panels = new h.BattlePanels(game), wagon = game.units.find(u => u.isWagon() && u.faction === 'hussites');
        wagon.formationClosed = true; game.selectUnit(wagon);
        assert.equal(panels.getGuidance().key, 'wagon');
        game.toggleWagonFormation(wagon);
        assert.notEqual(panels.getGuidance().key, 'wagon');
        const gun = game.unitFactory.createUnit('HOUFNICE', 0, 0);
        game.units.push(gun); game.selectedUnit = gun; gun.hasMoved = true;
        assert.equal(gun.canAttack(), false);
        assert.equal(panels.getGuidance().key, 'defend');
    });
}

test('situační pokyny nemění bitvu a nečtou skryté nepřátelské pozice', async () => {
    const h = await createLocalizedHarness(), game = h.newGame('zivohost_1419');
    const panels = new h.BattlePanels(game);
    const snapshot = () => JSON.stringify({ units: game.units.map(u => u.serialize()), turn: game.turnNumber,
        events: [...game.processedEvents], fog: [...game.visibleHexes], log: game.log });
    const before = snapshot();
    game.getEnemyUnits = () => { throw new Error('hint nesmí zkoumat protivníka'); };
    game.combatSystem.getValidAttackTargets = () => { throw new Error('hint nesmí odhalit cíl'); };
    for (let i = 0; i < 3; i++) { panels.getGuidance(); panels.updateGuidance(); }
    assert.equal(snapshot(), before);
});

test('skutečný prezentační adaptér obnovuje pokyn po výběru, pohybu, pauze a save/load', async () => {
    const h = createHarness({ browserView: true }), game = h.newGame('zivohost_1419');
    const text = () => h.document.getElementById('turn-guidance').textContent;
    assert.match(text(), /onboarding.hints.select/);
    const unit = game.units.find(u => u.type === 'CEPNICI'); game.selectUnit(unit);
    assert.match(text(), /onboarding.hints.move/);
    const target = game.getValidMoves(unit)[0];
    const moving = game.moveUnit(unit, target.col, target.row);
    assert.match(text(), /onboarding.hints.busy/);
    await h.advance(600); await moving;
    assert.doesNotMatch(text(), /onboarding.hints.busy/);
    game.setPaused(true); assert.match(text(), /onboarding.hints.paused/);
    game.setPaused(false); assert.doesNotMatch(text(), /onboarding.hints.paused/);
    assert.equal(game.saveGame(), true);
    const restored = h.SaveGameSystem.load(h.document.getElementById('game-canvas'), game);
    assert.match(text(), /onboarding.hints.select/);
    restored.destroy();
});

test('neplatný jazyk nikdy nevyvolá požadavek mimo podporované locale', async () => {
    const h = await createLocalizedHarness(); let fetched = false;
    h.context.fetch = () => { fetched = true; throw new Error('unexpected fetch'); };
    for (const lang of ['../secret', 'de', '__proto__', '', null]) {
        assert.equal(await h.i18n.loadLanguage(lang), false);
        assert.equal(await h.i18n.setLanguage(lang), false);
    }
    assert.equal(fetched, false); assert.equal(h.i18n.getCurrentLanguage(), 'cs');
});

for (const [label, response] of [
    ['404', { ok: false, status: 404, statusText: 'Not found' }],
    ['prázdný JSON', { ok: true, json: async () => ({}) }],
    ['HTML místo JSON', { ok: true, json: async () => { throw new SyntaxError('Unexpected <'); } }]
]) {
    test(`start s chybou překladů (${label}) selže čitelně a jde zopakovat`, async () => {
        const h = await createLocalizedHarness(), locale = h.i18n.translations.cs; quiet(h);
        h.context.navigator = { language: 'cs-CZ' };
        h.i18n.loadedLanguages.clear(); h.i18n.translations = {};
        h.context.fetch = async () => response;
        await assert.rejects(() => h.i18n.init(), /Translations unavailable/);
        assert.equal(h.i18n.loadedLanguages.has('cs'), false);
        assert.equal(h.i18n.translations.cs, undefined, 'nevytvářet prázdný překladač s klíči místo textů');
        h.context.fetch = async () => ({ ok: true, json: async () => locale });
        await h.i18n.init();
        assert.equal(h.i18n.t('menu.newGame'), 'Vybrat bitvu');
    });
}

test('nedostupná angličtina zachová funkční český start', async () => {
    const h = await createLocalizedHarness(); quiet(h);
    h.context.navigator = { language: 'en-GB' };
    h.storage.set('gameLanguage', 'en');
    h.i18n.loadedLanguages.delete('en'); delete h.i18n.translations.en;
    h.context.fetch = async () => { throw new Error('offline'); };
    await h.i18n.init();
    assert.equal(h.i18n.getCurrentLanguage(), 'cs');
    assert.equal(h.i18n.t('onboarding.firstBattle'), 'První bitva: Živohošť');
});

test('blokované úložiště jazyka nebrání načtení ani přepnutí hry', async () => {
    const h = await createLocalizedHarness(); quiet(h);
    h.context.navigator = { language: 'en-US' };
    h.context.localStorage.getItem = h.context.localStorage.setItem = () => { throw new Error('SecurityError'); };
    await h.i18n.init(); assert.equal(h.i18n.getCurrentLanguage(), 'en');
    assert.equal(await h.i18n.setLanguage('cs'), true); assert.equal(h.i18n.getCurrentLanguage(), 'cs');
});

test('poškozené nastavení neblokuje start a nikdy se automaticky nepřepisuje', async () => {
    const h = await createLocalizedHarness(); quiet(h);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/ui/main.js'), 'utf8'), h.context);
    const read = () => plain(vm.runInContext('readGamePreferences()', h.context));
    for (const raw of ['{', '[]', 'false', 'null', '42', '"text"']) {
        h.storage.set('husitskeValky_settings', raw);
        assert.deepEqual(read(), {}); assert.equal(h.storage.get('husitskeValky_settings'), raw);
    }
    h.storage.set('husitskeValky_settings', JSON.stringify({ soundEnabled: false, soundVolume: 40, aiSpeed: 'fast',
        difficultyLevel: 'advanced', showDamage: true, confirmEndTurn: false, extra: 'ignored' }));
    assert.deepEqual(read(), { soundEnabled: false, showDamage: true, confirmEndTurn: false,
        soundVolume: 40, aiSpeed: 'fast', difficultyLevel: 'advanced' });
    h.storage.set('husitskeValky_settings', '{"soundEnabled":"false","soundVolume":-1,"aiSpeed":"warp","difficultyLevel":"expert","__proto__":{"polluted":true}}');
    assert.deepEqual(read(), {});
    h.context.localStorage.getItem = () => { throw new Error('SecurityError'); };
    assert.deepEqual(read(), {});
});

test('všechny texty prvního zážitku mají neprázdný překlad a shodné parametry CS/EN', async () => {
    const h = await createLocalizedHarness();
    const flatten = (obj, prefix = '') => Object.entries(obj).flatMap(([key, value]) => typeof value === 'string'
        ? [[prefix + key, value]] : flatten(value, `${prefix}${key}.`));
    const cs = Object.fromEntries(flatten(h.i18n.translations.cs.onboarding));
    const en = Object.fromEntries(flatten(h.i18n.translations.en.onboarding));
    assert.deepEqual(Object.keys(cs).sort(), Object.keys(en).sort());
    for (const key of Object.keys(cs)) {
        assert.ok(cs[key].trim() && en[key].trim());
        assert.deepEqual(cs[key].match(/\{\w+\}/g), en[key].match(/\{\w+\}/g), key);
    }
});

test('výsledkové hodnocení zahrne posily i uprchlé a nevydává dílčí úspěch za úplné zničení', async () => {
    const h = await createLocalizedHarness();
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/ui/main.js'), 'utf8'), h.context);
    const stats = { lossesByFaction: { hussites: 2, crusaders: 9 }, fledByFaction: { hussites: 1, crusaders: 3 },
        aliveByFaction: { hussites: 8, crusaders: 5 } };
    const before = JSON.stringify(stats);
    const initialArmy = { initialPlayerUnits: 8, initialEnemyUnits: 9 };
    const counts = plain(h.context.getBattleResultCounts(stats, initialArmy));
    assert.deepEqual(counts, { player: { lost: 3, total: 11 }, enemy: { lost: 12, total: 17 } });
    assert.ok(counts.enemy.lost / counts.enemy.total < 1);
    assert.equal(JSON.stringify(stats), before);
    assert.deepEqual(plain(h.context.getBattleResultCounts(undefined, undefined)),
        { player: { lost: 0, total: 0 }, enemy: { lost: 0, total: 0 } });
    assert.deepEqual(plain(h.context.getBattleResultCounts({ enemiesKilled: 2, unitsLost: 1 }, {
        units: [{ faction: 'hussites', health: 50 }, { faction: 'crusaders', health: 10 }, { faction: 'crusaders', health: 0 }]
    })), { player: { lost: 1, total: 2 }, enemy: { lost: 2, total: 3 } });
});

async function menuHarness(language = 'cs', prepare = () => {}) {
    const h = await createLocalizedHarness(language);
    h.context.CustomEvent = class extends Event {
        constructor(type, options) { super(type); this.detail = options?.detail; }
    };
    h.context.window = Object.assign(new EventTarget(), { innerWidth: 1280 });
    h.context.Music = {
        isPlaying: false, setVolume() {},
        stop() { this.isPlaying = false; },
        toggle() { this.isPlaying = !this.isPlaying; return this.isPlaying; }
    };
    await prepare(h);
    let initialize;
    const listen = h.document.addEventListener.bind(h.document);
    h.document.addEventListener = (type, handler, options) => {
        if (type === 'DOMContentLoaded') initialize = handler;
        else listen(type, handler, options);
    };
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/ui/main.js'), 'utf8'), h.context);
    await initialize();
    return h;
}

test('titulní menu zachovává všechny akce, pořadí pokračování a dekorativní ilustraci', () => {
    const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
    const menu = html.slice(html.indexOf('<div id="main-menu"'), html.indexOf('<div id="game-container"'));
    for (const id of ['btn-resume-auto', 'btn-first-battle', 'btn-new-campaign', 'btn-quick-battle',
        'btn-continue', 'btn-chronicle', 'btn-encyclopedia', 'btn-settings', 'btn-about', 'btn-menu-music', 'btn-language-toggle']) {
        assert.equal([...menu.matchAll(new RegExp(`id="${id}"`, 'g'))].length, 1, id);
    }
    assert.ok(menu.indexOf('id="btn-resume-auto"') < menu.indexOf('id="btn-first-battle"'));
    assert.match(menu, /<h1 id="menu-title"/);
    assert.match(menu, /<nav[^>]*aria-labelledby="menu-play-title"/);
    assert.match(menu, /<img[^>]*menu-woodcut\.svg[^>]*alt=""[^>]*aria-hidden="true"/);
});

test('nový hráč nedostane neexistující pokračování ani ruční save', async () => {
    const h = await menuHarness(), el = id => h.document.getElementById(id);
    assert.equal(el('btn-resume-auto').classList.contains('hidden'), true);
    assert.equal(el('main-menu').classList.contains('has-autosave'), false);
    assert.equal(el('btn-continue').disabled, true);
    assert.equal(h.storage.has(h.SaveGameSystem.AUTO_KEY), false);
});

for (const language of ['cs', 'en']) {
    test(`${language}: pokračování má prioritu jen s platným rozehraným checkpointem`, async () => {
        const h = await menuHarness(language, h => {
            const game = h.newGame('zivohost_1419');
            game.turnNumber = 3;
            assert.equal(game.saveGame({ automatic: true }), true);
            assert.equal(game.saveGame(), true);
            game.destroy();
        });
        const el = id => h.document.getElementById(id);
        const raw = h.storage.get(h.SaveGameSystem.AUTO_KEY);
        assert.equal(el('main-menu').classList.contains('has-autosave'), true);
        assert.equal(el('btn-resume-auto').classList.contains('hidden'), false);
        assert.match(el('autosave-summary').textContent, /Živoho|Zivoho/);
        assert.match(el('autosave-summary').textContent, /3/);
        assert.equal(el('btn-continue').disabled, false);
        assert.equal(h.storage.get(h.SaveGameSystem.AUTO_KEY), raw);
        for (const invalid of ['{', JSON.stringify({ ...JSON.parse(raw), gameState: 'victory' })]) {
            h.storage.set(h.SaveGameSystem.AUTO_KEY, invalid);
            h.document.dispatchEvent(new Event('languageChanged'));
            assert.equal(el('main-menu').classList.contains('has-autosave'), false);
            assert.equal(el('btn-resume-auto').classList.contains('hidden'), true);
            assert.equal(el('btn-continue').disabled, false, 'ruční save zůstává nezávislý');
            assert.equal(h.storage.get(h.SaveGameSystem.AUTO_KEY), invalid, 'menu nesmí přepisovat checkpoint');
        }
        for (const key of ['titleFirst', 'titleSecond', 'edition', 'colophon', 'playTitle', 'libraryTitle', 'noManualSave']) {
            assert.ok(h.i18n.hasTranslation(`menu.${key}`), key);
            assert.ok(h.i18n.t(`menu.${key}`).trim());
        }
    });
}

test('hudba v menu má lokalizovaný text a pravdivý přístupný stav i po změně jazyka', async () => {
    const h = await menuHarness(), button = h.document.getElementById('btn-menu-music');
    assert.equal(button.getAttribute('aria-pressed'), 'false');
    button.dispatchEvent(new Event('click'));
    assert.equal(button.getAttribute('aria-pressed'), 'true');
    assert.equal(button.classList.contains('playing'), true);
    await h.i18n.setLanguage('en');
    assert.equal(button.textContent, h.i18n.t('menu.musicPlaying'));
    assert.equal(h.document.getElementById('current-lang-flag').textContent, 'EN');
    button.dispatchEvent(new Event('click'));
    assert.equal(button.getAttribute('aria-pressed'), 'false');
    assert.equal(button.classList.contains('playing'), false);
    assert.equal(button.textContent, h.i18n.t('menu.music'));
});

test('ovládání panelů po startu i resize drží rozbalený a sbalený stav odděleně', async () => {
    const h = await createLocalizedHarness();
    const browserWindow = new EventTarget(); browserWindow.innerWidth = 753;
    h.context.window = browserWindow;
    h.context.Music = { setVolume() {}, stop() {} };
    let initialize;
    const listen = h.document.addEventListener.bind(h.document);
    h.document.addEventListener = (type, handler, options) => {
        if (type === 'DOMContentLoaded') initialize = handler;
        else listen(type, handler, options);
    };
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/ui/main.js'), 'utf8'), h.context);
    await initialize();
    const pairs = [['unit-panel', 'toggle-left'], ['info-panel', 'toggle-right']];
    for (const width of [390, 753, 1100]) {
        browserWindow.innerWidth = width; browserWindow.dispatchEvent(new Event('resize'));
        for (const [id, toggle] of pairs) {
            const panel = h.document.getElementById(id), button = h.document.getElementById(toggle);
            assert.equal(panel.classList.contains('collapsed'), true);
            button.dispatchEvent(new Event('click'));
            assert.equal(panel.classList.contains('expanded'), true);
            assert.equal(panel.classList.contains('collapsed'), false);
            browserWindow.dispatchEvent(new Event('resize'));
            assert.equal(panel.classList.contains('expanded'), true);
            assert.equal(panel.classList.contains('collapsed'), false);
            button.dispatchEvent(new Event('click'));
            assert.equal(panel.classList.contains('expanded'), false);
            assert.equal(panel.classList.contains('collapsed'), true);
        }
    }
    browserWindow.innerWidth = 1280; browserWindow.dispatchEvent(new Event('resize'));
    for (const [id, toggle] of pairs) {
        const panel = h.document.getElementById(id), button = h.document.getElementById(toggle);
        assert.equal(panel.classList.contains('expanded'), false);
        assert.equal(panel.classList.contains('collapsed'), false);
        button.dispatchEvent(new Event('click'));
        assert.equal(panel.classList.contains('collapsed'), true);
        button.dispatchEvent(new Event('click'));
        assert.equal(panel.classList.contains('collapsed'), false);
    }
});

(async () => {
    let failures = 0;
    for (const { name, run } of tests) {
        try { await run(); console.log(`✓ ${name}`); }
        catch (error) { failures++; console.error(`✗ ${name}\n${error.stack}`); }
    }
    console.log(`\n${tests.length - failures}/${tests.length} first-experience testů.`);
    if (failures) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
