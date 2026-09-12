#!/usr/bin/env node
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { createHarness } = require('./helpers/game-harness');
const { createLocalizedHarness } = require('./helpers/localized-harness');
const { TestBattleView } = require('./helpers/test-battle-view');
const tests = [];
const test = (name, run) => tests.push({ name, run });

const domainFiles = ['js/core/game.js', 'js/systems/CombatSystem.js', 'js/systems/ScenarioEventSystem.js'];

test('Game, souboj a scénářové události neobsahují DOM ani animační smyčku', () => {
    for (const file of domainFiles) {
        const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
        assert.doesNotMatch(source, /\b(document|window|requestAnimationFrame|cancelAnimationFrame)\b/, file);
    }
});

test('headless adaptér implementuje celý prezentační kontrakt herních pravidel', () => {
    const { BattleView } = createHarness();
    for (const file of domainFiles) {
        const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
        for (const [, name] of source.matchAll(/\bthis\.(?:game\.)?view\.(\w+)\(/g)) {
            assert.equal(typeof TestBattleView.prototype[name], 'function', `headless: ${name}`);
            assert.equal(typeof BattleView.prototype[name], 'function', `browser: ${name}`);
        }
    }
});

test('výběr, pohyb, souboj a načtení fungují bez globálního document/window', async () => {
    const h = createHarness();
    delete h.context.document;
    delete h.context.window;
    const game = h.newGame();
    const attacker = game.unitFactory.createUnit('CEPNICI', 5, 5);
    const defender = game.unitFactory.createUnit('HALAPARTNICI', 7, 5);
    game.units = [attacker, defender];
    game.fogOfWar = true;
    game.selectUnit(attacker);
    const moving = game.moveUnit(attacker, 6, 5);
    await h.advance(1); await moving;
    assert.equal(attacker.col, 6);
    assert.ok(game.visibleHexes.size > 0, 'viditelnost se přepočítá i bez vykreslování');
    const fighting = game.combatSystem.performAttack(attacker, defender);
    await h.advance(600); await fighting;
    assert.ok(defender.health < defender.maxHealth);
    assert.equal(game.saveGame(), true);
    const restored = h.SaveGameSystem.load(h.document.getElementById('game-canvas'), game);
    assert.ok(restored.view instanceof TestBattleView);
    assert.equal(restored.units[1].health, defender.health);
    assert.equal(game.view.destroyed, true);
});

test('vykreslení panelů, mapy a tooltipu nemění herní stav', () => {
    const h = createHarness({ browserView: true }), game = h.newGame();
    const unit = game.units[0];
    game.selectUnit(unit);
    const snapshot = () => JSON.stringify({
        units: game.units.map(unit => unit.serialize()), turn: game.turnNumber,
        faction: game.currentFaction, log: game.log, stats: game.stats,
        morale: game.armyMorale, visible: [...game.visibleHexes], explored: [...game.exploredHexes]
    });
    const before = snapshot();
    Object.freeze(game.armyMorale);
    game.fogOfWarSystem.updateVisibility = () => { throw new Error('Render nesmí přepočítávat pravidla'); };
    game.view.updateUI();
    game.view.updateUnitPanel(unit);
    game.view.render();
    game.view.tooltip.showTooltip({ col: unit.col, row: unit.row }, 100, 100);
    assert.equal(snapshot(), before);
    game.destroy();
});

test('klik z Canvasu volá hexový příkaz a zaniklá bitva již vstup nedostane', () => {
    const h = createHarness({ browserView: true }), game = h.newGame();
    const pixel = game.hexGrid.hexToPixel(5, 5), received = [];
    game.handleHexClick = hex => received.push(hex);
    const click = new Event('click');
    Object.assign(click, { clientX: pixel.x, clientY: pixel.y });
    const canvas = h.document.getElementById('game-canvas');
    canvas.dispatchEvent(click);
    assert.equal(received.length, 1);
    assert.equal(received[0].col, 5); assert.equal(received[0].row, 5);
    game.destroy();
    canvas.dispatchEvent(click);
    assert.equal(received.length, 1);
    assert.equal(game.view.eventAbortController.signal.aborted, true);
    assert.equal(game.view.minimap.eventAbortController.signal.aborted, true);
});

test('log má jediného vlastníka a zobrazení nevkládá duplicitní záznamy', () => {
    const h = createHarness({ browserView: true }), game = h.newGame();
    game.clearLog(); game.addLog('Jedna událost', 'turn');
    assert.equal(game.log.length, 1);
    assert.equal(h.document.getElementById('game-log').children.length, 1);
    game.view.clearLog();
    assert.equal(game.log.length, 1, 'samotný pohled nemaže herní záznam');
    game.destroy();
});

test('po zrušení skutečného UI zmizí notifikace a poškození', async () => {
    const h = createHarness({ browserView: true }), game = h.newGame();
    game.showEventNotification('Událost', 'Text');
    game.view.showDamageNumber(5, 5, 10);
    assert.equal(h.document.body.children.length, 2);
    game.destroy(); await h.flush();
    assert.equal(h.document.body.children.length, 0);
    assert.equal(h.timers.size, 0);
});

test('chorál a návrat k fázi mají stejné texty po oddělení panelů', () => {
    const h = createHarness({ browserView: true }), game = h.newGame('zivohost_1419');
    const phase = game.currentPhase;
    assert.equal(h.document.getElementById('phase-name').textContent, phase.name);
    game.activateChoral();
    assert.match(h.document.getElementById('phase-name').textContent, /choralActive/);
    game.choralTurnsRemaining = 1; game.updateChoral();
    assert.equal(h.document.getElementById('phase-name').textContent, phase.name);
    assert.equal(h.document.getElementById('phase-description').textContent, phase.description);
    game.destroy();
});

for (const language of ['cs', 'en']) {
    test(`${language}: encyklopedie používá stejné znaky jako mapa a přeloženou velitelskou hodnost`, async () => {
        const h = await createLocalizedHarness(language);
        vm.runInContext(fs.readFileSync(path.join(__dirname, '../js/ui/main.js'), 'utf8'), h.context);
        const { WoodcutRenderer, UnitTypes, populateHelpUnits } = vm.runInContext('({ WoodcutRenderer, UnitTypes, populateHelpUnits })', h.context);
        const before = JSON.stringify(UnitTypes);
        populateHelpUnits(null);
        const cards = h.document.getElementById('help-units-list').children.filter(el => el.className?.startsWith('help-unit-card'));
        assert.equal(cards.length, Object.keys(UnitTypes).length);
        for (const type of ['VOZOVA_HRADBA', 'CEPNICI', 'BOMBARDA', 'JAN_ZIZKA', 'ZIKMUND']) {
            const localized = vm.runInContext(`getLocalizedUnit('${type}', UnitTypes.${type})`, h.context);
            const card = cards.find(el => el.children[0].children[1].children[0].textContent === localized.name);
            assert.ok(card, type);
            assert.equal(card.children[0].children[0].innerHTML, WoodcutRenderer.icon({ ...localized, type }));
            if (WoodcutRenderer.isCommander(localized)) {
                assert.match(card.className, /commander-unit/);
                assert.equal(card.children[0].children[1].children[1].textContent, h.i18n.t('tooltip.commander'));
                assert.doesNotMatch(card.innerHTML, />commander</);
            }
        }
        assert.equal(JSON.stringify(UnitTypes), before);
        const game = h.newGame('sudomere_1420'), panels = new h.BattlePanels(game);
        panels.updateArmyOverview();
        const commander = game.units.find(u => u.isCommander() && u.faction === 'hussites');
        const row = h.document.getElementById('hussite-units').children.find(el => el.innerHTML.includes(commander.name));
        assert.ok(row.classList.contains('commander-unit'));
        assert.ok(row.innerHTML.includes(h.i18n.t('tooltip.commander')));
        // The same commander template can fight for either side (e.g. Lipany).
        // Presentation must use deployment faction, not overwrite the template.
        const allies = new h.Unit('DIVIS_BOREK', 0, 0, 91);
        const opponents = new h.Unit('DIVIS_BOREK', 1, 0, 92);
        opponents.faction = 'crusaders';
        h.document.getElementById('help-units-list').replaceChildren();
        populateHelpUnits({ units: [allies, opponents] });
        const deployed = h.document.getElementById('help-units-list').children.filter(el => el.className?.startsWith('help-unit-card'));
        assert.equal(deployed.length, 2);
        assert.match(deployed[0].children[0].children[0].className, /hussites/);
        assert.match(deployed[1].children[0].children[0].className, /crusaders/);
        assert.notEqual(deployed[0].children[0].children[0].innerHTML, deployed[1].children[0].children[0].innerHTML);
        assert.equal(JSON.stringify(UnitTypes), before);
        game.destroy();
    });
}

(async () => {
    let failures = 0;
    for (const { name, run } of tests) {
        let timeout;
        try {
            await Promise.race([run(), new Promise((_, reject) => {
                timeout = setTimeout(() => reject(new Error('Test did not settle')), 2000);
            })]);
            console.log(`✓ ${name}`);
        } catch (error) { failures++; console.error(`✗ ${name}\n${error.stack}`); }
        finally { clearTimeout(timeout); }
    }
    console.log(`\n${tests.length - failures}/${tests.length} presentation testů.`);
    if (failures) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
