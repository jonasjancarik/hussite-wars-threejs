#!/usr/bin/env node
const assert = require('node:assert/strict');
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

let failures = 0;
for (const { name, run } of tests) {
    try { run(); console.log(`✓ ${name}`); }
    catch (error) { failures++; console.error(`✗ ${name}\n${error.stack}`); }
}
console.log(`\n${tests.length - failures}/${tests.length} save testů.`);
if (failures) process.exitCode = 1;
