#!/usr/bin/env node
const assert = require('node:assert/strict');
const vm = require('node:vm');
const { createHarness } = require('./helpers/game-harness');

const h = createHarness();
const WoodcutRenderer = vm.runInContext('WoodcutRenderer', h.context);
const tests = [];
const test = (name, run) => tests.push({ name, run });
const marker = unit => WoodcutRenderer.unitPresentation(unit);
const badgeIds = unit => marker(unit).badges.map(badge => badge.id);

test('unit presentation distinguishes glyphs, commanders, and faction colours', () => {
    const flail = new h.Unit('CEPNICI', 0, 0, 1);
    const wagon = new h.Unit('VOZOVA_HRADBA', 1, 0, 2);
    const commander = new h.Unit('JAN_ZIZKA', 2, 0, 3);
    assert.notEqual(marker(flail).glyphPath, marker(wagon).glyphPath);
    assert.equal(marker(commander).commander, true);
    assert.equal(marker(flail).commander, false);
    assert.equal(marker(flail).factionColor, WoodcutRenderer.palette.red);
    flail.faction = 'crusaders';
    assert.equal(marker(flail).factionColor, WoodcutRenderer.palette.blue);
});

test('health fraction is safe and uses ivory, gold, then salmon thresholds', () => {
    const unit = new h.Unit('CEPNICI', 0, 0, 1);
    assert.equal(marker(unit).healthColor, WoodcutRenderer.palette.light);
    unit.health = unit.maxHealth * .6;
    assert.equal(marker(unit).healthColor, WoodcutRenderer.palette.gold);
    unit.health = unit.maxHealth * .3;
    assert.equal(marker(unit).healthColor, '#e99c7d');
    unit.health = 50; unit.maxHealth = 0;
    assert.equal(marker(unit).healthRatio, 0);
    unit.health = Infinity; unit.maxHealth = 100;
    assert.equal(marker(unit).healthRatio, 0);
});

test('routing and terror are separate urgent badges while defending remains distinct', () => {
    const unit = new h.Unit('CEPNICI', 0, 0, 1);
    unit.isRouting = true; unit.isTerrified = true; unit.isDefending = true;
    const presentation = marker(unit);
    assert.equal(presentation.actionAvailable, false);
    assert.deepEqual(Array.from(badgeIds(unit).slice(0, 3)), ['routing', 'terrified', 'defending']);
    assert.notEqual(presentation.badges[0].text, presentation.badges[1].text);
    assert.equal(presentation.badges[2].text, '⛨');
});

test('rapid fire remains available after one shot and reports the remaining shot', () => {
    const unit = new h.Unit('LUCISTNICI', 0, 0, 1);
    unit.special = 'rapidFire'; unit.attackCount = 1; unit.hasAttacked = true;
    const presentation = marker(unit);
    assert.equal(presentation.actionAvailable, true);
    assert.equal(presentation.badges.find(badge => badge.id === 'rapid-fire')?.text, '1');
    unit.attackCount = 2;
    assert.equal(marker(unit).actionAvailable, true, 'the unit can still move until it does so');
    unit.hasMoved = true;
    assert.equal(marker(unit).actionAvailable, false);
});

test('artillery that moved is spent unless its own rules say otherwise', () => {
    const artillery = new h.Unit('HOUFNICE', 0, 0, 1);
    artillery.hasMoved = true;
    assert.equal(marker(artillery).actionAvailable, false);
    const mobile = new h.Unit('HOUFNICE', 0, 0, 2);
    mobile.special = 'mobile'; mobile.hasMoved = true;
    assert.equal(marker(mobile).actionAvailable, true);
});

test('readiness respects the live selection gate and a defended archer has no shot badge', () => {
    const unit = new h.Unit('LUCISTNICI', 0, 0, 1);
    unit.attackCount = 1; unit.hasAttacked = true;
    assert.equal(marker(unit).actionAvailable, unit.canAct());
    unit.hasMoved = true;
    assert.equal(marker(unit).actionAvailable, unit.canAct());
    unit.defend();
    assert.equal(marker(unit).actionAvailable, false);
    assert.ok(!badgeIds(unit).includes('rapid-fire'));
});

test('wagon formation marks closed, marching, and open without claiming a chain', () => {
    const wagon = new h.Unit('VOZOVA_HRADBA', 0, 0, 1);
    assert.ok(badgeIds(wagon).includes('wagon-closed'));
    wagon.marching = true;
    assert.ok(badgeIds(wagon).includes('wagon-marching'));
    wagon.formationClosed = false; wagon.marching = false;
    assert.ok(badgeIds(wagon).includes('wagon-open'));
});

test('plain snapshot units stay JSON-safe and use localized status labels when available', () => {
    h.context.i18n = {
        hasTranslation: key => ['moraleStatus.good', 'unitMarkers.actionAvailable'].includes(key),
        t: key => ({ 'moraleStatus.good': 'Good', 'unitMarkers.actionAvailable': 'Ready' })[key]
    };
    const plain = { type: 'KOPINICI', faction: 'hussites', unitClass: 'infantry', health: 50, maxHealth: 100,
        morale: 70, maxMorale: 100, hasMoved: false, hasAttacked: false };
    const presentation = marker(plain);
    assert.equal(presentation.moraleText, 'Good');
    assert.equal(presentation.moraleLabel, 'Morale');
    assert.equal(presentation.actionText, 'Ready');
    assert.doesNotThrow(() => JSON.stringify(presentation));
});

test('plain snapshot morale follows the Unit absolute 80/60/40/20 thresholds', () => {
    const lowMaximum = { type: 'KOPINICI', faction: 'hussites', unitClass: 'infantry', health: 20, maxHealth: 20,
        morale: 25, maxMorale: 30, hasMoved: false, hasAttacked: false };
    const presentation = marker(lowMaximum);
    assert.equal(presentation.moraleText, 'low');
    assert.equal(presentation.moraleColor, '#bd5a18');
});

test('low morale warns independently from health without adding a second bar', () => {
    const healthyButWavering = new h.Unit('CEPNICI', 0, 0, 1);
    healthyButWavering.health = healthyButWavering.maxHealth;
    healthyButWavering.morale = 35;
    const damagedButSteady = new h.Unit('CEPNICI', 0, 0, 2);
    damagedButSteady.health = Math.ceil(damagedButSteady.maxHealth * .2);
    damagedButSteady.morale = 70;
    const warning = marker(healthyButWavering).badges.find(badge => badge.id === 'low-morale');
    assert.deepEqual({ text: warning?.text, color: warning?.color }, { text: '↓', color: '#bd5a18' });
    assert.ok(String(warning?.label).includes(healthyButWavering.getMoraleStatus()));
    assert.ok(!badgeIds(damagedButSteady).includes('low-morale'));
    assert.equal(marker(healthyButWavering).healthRatio, 1);
    assert.equal(marker(damagedButSteady).healthColor, '#e99c7d');
});

test('charge badge reports an activated charge bonus rather than the unit ability', () => {
    const unit = new h.Unit('JIZDA_HUSITI', 0, 0, 1);
    unit.special = 'charge';
    assert.ok(!badgeIds(unit).includes('charge'));
    unit.chargeBonus = true;
    assert.ok(badgeIds(unit).includes('charge'));
});

test('3D adapter sends presentation only for units visible through fog', () => {
    const friendly = new h.Unit('CEPNICI', 0, 0, 1);
    const visibleEnemy = new h.Unit('KUSNICI', 1, 0, 2);
    visibleEnemy.faction = 'crusaders'; visibleEnemy.isTerrified = true;
    const hiddenEnemy = new h.Unit('TEZKY_RYTIR', 2, 0, 3);
    hiddenEnemy.faction = 'crusaders'; hiddenEnemy.special = 'elite';
    const game = {
        units: [friendly, visibleEnemy, hiddenEnemy], selectedUnit: null, fogOfWar: true,
        fogOfWarSystem: { isEnemyVisible: unit => unit.id === visibleEnemy.id },
        hexGrid: { attackableHexes: [], highlightedHexes: [], escapeZoneHexes: [], escapeZoneKind: null,
            cols: 3, rows: 1, hexes: new Map() },
        currentScenario: { id: 'marker-test' }, turnNumber: 1, currentFaction: 'hussites',
        gameState: 'playing', actions: { busy: false }, isPaused: false, aiRunning: false,
        visibleHexes: new Set(), exploredHexes: new Set()
    };
    h.context.__markerGame = game;
    const snapshot = vm.runInContext('ThreeBattleMapView.prototype.snapshot.call({ game: __markerGame, revision: 0, effects: [] })', h.context);
    assert.deepEqual(Array.from(snapshot.units, unit => unit.id), [friendly.id, visibleEnemy.id]);
    assert.equal(snapshot.units[1].special, visibleEnemy.special);
    assert.ok(snapshot.units[1].presentation.badges.some(badge => badge.id === 'terrified'));
    assert.doesNotThrow(() => JSON.stringify(snapshot));
});

test('3D adapter reports only confirmed, non-escaped losses for disappearance effects', () => {
    const friendlyDead = new h.Unit('CEPNICI', 0, 0, 1);
    const visibleEnemyDead = new h.Unit('KUSNICI', 1, 0, 2);
    const hiddenEnemyDead = new h.Unit('TEZKY_RYTIR', 2, 0, 3);
    const escapedDead = new h.Unit('KOPINICI', 0, 1, 4);
    for (const unit of [friendlyDead, visibleEnemyDead, hiddenEnemyDead, escapedDead]) {
        unit.health = 0; unit._deathHandled = true;
    }
    const unconfirmedRemoval = new h.Unit('CEPNICI', 0, 0, 5);
    unconfirmedRemoval.health = 0; unconfirmedRemoval.isRouting = true;
    visibleEnemyDead.faction = 'crusaders'; hiddenEnemyDead.faction = 'crusaders'; escapedDead.escaped = true;
    const game = {
        units: [friendlyDead, visibleEnemyDead, hiddenEnemyDead, escapedDead, unconfirmedRemoval], selectedUnit: null, fogOfWar: true,
        fogOfWarSystem: { isEnemyVisible: unit => unit.id === visibleEnemyDead.id },
        hexGrid: { attackableHexes: [], highlightedHexes: [], escapeZoneHexes: [], escapeZoneKind: null,
            cols: 3, rows: 2, hexes: new Map() },
        currentScenario: { id: 'marker-test' }, turnNumber: 1, currentFaction: 'hussites',
        gameState: 'playing', actions: { busy: false }, isPaused: false, aiRunning: false,
        visibleHexes: new Set(), exploredHexes: new Set()
    };
    h.context.__markerGame = game;
    const snapshot = vm.runInContext('ThreeBattleMapView.prototype.snapshot.call({ game: __markerGame, revision: 0, effects: [] })', h.context);
    assert.deepEqual(Array.from(snapshot.eliminatedUnitIds), [friendlyDead.id, visibleEnemyDead.id]);
});

let failures = 0;
for (const { name, run } of tests) {
    try { run(); console.log(`✓ ${name}`); }
    catch (error) { failures += 1; console.error(`✗ ${name}\n${error.stack}`); }
}
console.log(`\n${tests.length - failures}/${tests.length} unit marker tests.`);
if (failures) process.exit(1);
