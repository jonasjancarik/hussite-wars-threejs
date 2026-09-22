#!/usr/bin/env node
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { createHarness } = require('./helpers/game-harness');
const tests = [];
const test = (name, run) => tests.push({ name, run });

function fixture() {
    const h = createHarness(), game = h.newGame('zivohost_1419');
    h.context.console = { ...console, error() {} }; // očekávané chyby zápisu
    assert.equal(game.saveGame(), true);
    return { h, game, key: h.SaveGameSystem.STORAGE_KEY, previous: h.storage.get(h.SaveGameSystem.STORAGE_KEY) };
}

test('platný snapshot nahradí save a validace nezmění herní stav ani ID', () => {
    const { h, game, key, previous } = fixture();
    const ids = game.unitFactory.nextId, units = game.units;
    game.turnNumber = 2;
    assert.equal(game.saveGame(), true);
    assert.notEqual(h.storage.get(key), previous);
    assert.equal(h.SaveGameSystem.read().data.turnNumber, 2);
    assert.equal(game.unitFactory.nextId, ids); assert.equal(game.units, units);
});

test('překryv živých jednotek nepřepíše poslední funkční save', () => {
    const { h, game, key, previous } = fixture();
    game.units[1].col = game.units[0].col; game.units[1].row = game.units[0].row;
    const successLogs = game.log.filter(line => line.message.includes('gameSaved')).length;
    assert.equal(game.saveGame(), false);
    assert.equal(h.storage.get(key), previous);
    assert.equal(game.log.filter(line => line.message.includes('gameSaved')).length, successLogs);
    assert.ok(game.log.at(-1).message.includes('saveError'));
    assert.doesNotThrow(() => h.SaveGameSystem.load(h.document.getElementById('game-canvas'), game));
});

test('neplatný první snapshot nevytvoří save', () => {
    const h = createHarness(), game = h.newGame();
    h.context.console = { ...console, error() {} };
    game.units[0].health = NaN;
    assert.equal(game.saveGame(), false);
    assert.equal(h.storage.has(h.SaveGameSystem.STORAGE_KEY), false);
});

test('chyba serializace zachová předchozí save a vrátí false', () => {
    const { h, game, key, previous } = fixture();
    game.stats.circular = game.stats;
    assert.equal(game.saveGame(), false);
    assert.equal(h.storage.get(key), previous);
    assert.ok(game.log.at(-1).message.includes('saveError'));
});

test('i chyba sestavení snapshotu je zachycena před zápisem', () => {
    const { h, game, key, previous } = fixture();
    game.processedEvents = null;
    assert.equal(game.saveGame(), false);
    assert.equal(h.storage.get(key), previous);
});

test('odmítnutý zápis úložiště zachová starý save a nehlásí úspěch', () => {
    const { h, game, key, previous } = fixture();
    h.context.localStorage.setItem = () => { throw new Error('QuotaExceededError'); };
    game.turnNumber = 2;
    assert.equal(game.saveGame(), false);
    assert.equal(h.storage.get(key), previous);
    assert.ok(game.log.at(-1).message.includes('saveError'));
    assert.equal(h.SaveGameSystem.read().data.turnNumber, 1);
});

test('zápis ověří skutečný JSON po serializaci, ne pouze vstupní objekt', () => {
    const { h, key, previous } = fixture();
    const data = JSON.parse(previous);
    data.units[0].toJSON = () => ({ ...data.units[1] }); // vytvoří duplicitní ID i pozici
    assert.throws(() => h.SaveGameSystem.write(data), /saveIncompatible/);
    assert.equal(h.storage.get(key), previous);
});

test('starý save bez sesednutí zůstane na koni, nový stav se uloží a znovu načte', () => {
    const { h, game, key } = fixture();
    const oldUnit = game.units[0].serialize();
    delete oldUnit.dismounted;
    assert.equal(h.Unit.deserialize(oldUnit).dismounted, false);

    game.units[0].dismounted = true;
    assert.equal(game.saveGame(), true);
    const data = JSON.parse(h.storage.get(key));
    assert.equal(data.units[0].dismounted, true);
    assert.equal(h.SaveGameSystem.read().units[0].dismounted, true);

    data.units[0].dismounted = 'yes';
    assert.throws(() => h.SaveGameSystem.prepare(data), /saveIncompatible/);
});

test('led se zaznamená jen při prolomení a nová hra smaže kosmetické stopy', () => {
    const { h, game } = fixture();
    game.currentScenario.specialMechanics = { frozenRiver: { effect: 'heavy_units_drown' } };
    const crossing = game.unitFactory.createUnit('TEZKY_RYTIR', 1, 1);
    game.hexGrid.setTerrain(1, 1, 'water');
    h.context.Math.random = () => 0.99;
    assert.equal(game.checkFrozenRiver(crossing), false);
    assert.equal(game.brokenIceHexes.size, 0);

    const drowning = game.unitFactory.createUnit('TEZKY_RYTIR', 2, 1);
    game.hexGrid.setTerrain(2, 1, 'water');
    game.units.push(drowning);
    let brokenBeforeRender = null;
    game.render = () => { brokenBeforeRender = [...game.brokenIceHexes]; };
    h.context.Math.random = () => 0;
    assert.equal(game.checkFrozenRiver(drowning), true);
    assert.deepEqual(brokenBeforeRender, ['2,1']);

    game.fogOfWar = true;
    game.visibleHexes.clear();
    const hiddenEnemy = game.unitFactory.createUnit('TEZKY_RYTIR', 3, 1);
    hiddenEnemy.faction = 'crusaders';
    game.hexGrid.setTerrain(3, 1, 'water');
    game.units.push(hiddenEnemy);
    assert.equal(game.checkFrozenRiver(hiddenEnemy), true);
    assert.deepEqual(brokenBeforeRender, ['2,1'], 'neviditelné prolomení nepřítele se neuloží');

    game.initGameWithScenario(h.ScenarioManager.getScenario('zivohost_1419'));
    assert.equal(game.brokenIceHexes.size, 0);
    game.brokenIceHexes.add('1,1');
    game.initGame();
    assert.equal(game.brokenIceHexes.size, 0);
});

test('rozbité hexy se uloží, načtou, starý save dostane prázdný stav a vadné souřadnice se odmítnou', () => {
    const { h, game, key } = fixture();
    game.brokenIceHexes.add('1,1');
    game.brokenIceHexes.add('2,1');
    assert.equal(game.saveGame(), true);
    assert.deepEqual(JSON.parse(h.storage.get(key)).brokenIceHexes, ['1,1', '2,1']);
    let restored = h.SaveGameSystem.load(h.document.getElementById('game-canvas'), game);
    assert.deepEqual([...restored.brokenIceHexes], ['1,1', '2,1']);

    const oldSave = JSON.parse(h.storage.get(key));
    delete oldSave.brokenIceHexes;
    h.storage.set(key, JSON.stringify(oldSave));
    restored = h.SaveGameSystem.load(h.document.getElementById('game-canvas'), restored);
    assert.deepEqual([...restored.brokenIceHexes], []);

    const valid = JSON.parse(h.storage.get(key));
    const width = h.ScenarioManager.getScenario(valid.scenarioId).mapSize.width;
    for (const brokenIceHexes of [['1,1', '1,1'], ['-1,0'], ['1.5,1'], ['bad'], [`${width},0`]]) {
        assert.throws(() => h.SaveGameSystem.prepare({ ...valid, brokenIceHexes }), /saveIncompatible/);
    }
});

test('snapshot zachová svědkem zaznamenané díry v prozkoumaném hexu i po uložení', () => {
    const { h, game, key } = fixture();
    game.fogOfWar = true;
    game.brokenIceHexes = new Set(['1,1', '2,1']);
    game.visibleHexes = new Set(['1,1']);
    game.exploredHexes = new Set(['1,1', '2,1']);
    assert.deepEqual(vmSnapshot(h, game), ['1,1', '2,1']);

    game.visibleHexes.clear();
    assert.deepEqual(vmSnapshot(h, game), ['1,1', '2,1']);
    assert.equal(game.saveGame(), true);
    const restored = h.SaveGameSystem.load(h.document.getElementById('game-canvas'), game);
    assert.deepEqual(vmSnapshot(h, restored), ['1,1', '2,1']);
    assert.deepEqual(JSON.parse(h.storage.get(key)).brokenIceHexes, ['1,1', '2,1']);
});

function vmSnapshot(h, game) {
    h.context.__snapshotGame = game;
    const snapshot = vm.runInContext('ThreeBattleMapView.prototype.snapshot.call({ game: __snapshotGame, revision: 0, effects: [] })', h.context);
    return Array.from(snapshot.brokenIceHexes);
}

test('3D rebuilds scenery when a saved scenario or art seed changes on the same tiles', () => {
    const h = createHarness({ browserView: true });
    const signature = vm.runInContext('ThreeBattleMapView.prototype.getTerrainSignature', h.context);
    const snapshot = { scenario: 'nemecky_brod_1422', seed: 1, tiles: [{ col: 0, row: 0, terrain: 'water' }] };
    assert.notEqual(signature(snapshot), signature({ ...snapshot, scenario: 'zivohost_1419' }));
    assert.notEqual(signature(snapshot), signature({ ...snapshot, seed: 2 }));
    assert.equal(signature(snapshot), signature({ ...snapshot, round: 4 }));
});

let failures = 0;
for (const { name, run } of tests) {
    try { run(); console.log(`✓ ${name}`); }
    catch (error) { failures++; console.error(`✗ ${name}\n${error.stack}`); }
}
console.log(`\n${tests.length - failures}/${tests.length} save testů.`);
if (failures) process.exitCode = 1;
