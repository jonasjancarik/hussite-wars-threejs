#!/usr/bin/env node
const assert = require('node:assert/strict');
const { createHarness } = require('./helpers/game-harness');
const { createLocalizedHarness } = require('./helpers/localized-harness');
const tests = [];
const test = (name, run) => tests.push({ name, run });
const key = hex => `${hex.col},${hex.row}`;

function fixture(cols = 7, rows = 5) {
    const h = createHarness(), game = h.newGame();
    game.hexGrid = new h.HexGrid(h.document.getElementById('game-canvas'), cols, rows, 40);
    game.currentScenario = { aiDoctrine: { advance: 'assault' } };
    game.currentFaction = 'crusaders';
    const rider = game.unitFactory.createUnit('TEZKY_RYTIR', 0, 0);
    const target = game.unitFactory.createUnit('CEPNICI', cols - 1, rows - 1);
    game.units = [rider, target];
    return { h, game, rider, target };
}

for (const language of ['cs', 'en']) {
    test(`${language}: útočný postup má zapnutý jen Vítkov`, async () => {
        const h = await createLocalizedHarness(language);
        const enabled = Object.keys(h.Scenarios).filter(id =>
            h.AI.getDoctrine({ currentScenario: h.ScenarioManager.getScenario(id) }).advance === 'assault');
        assert.deepEqual(enabled, ['vitkov_1420']);
        assert.equal(h.AI.getDoctrine({}).advance, 'tactical');
    });
}

test('rytíř na Vítkově překoná terénní optimum pod svahem', async () => {
    const h = createHarness(), game = h.newGame('vitkov_1420');
    game.currentScenario.aiDoctrine.advance = 'tactical';
    game.fastForwardAI = true;
    game.endTurn(); await h.advance(60000);
    const rider = game.units.find(u => u.type === 'TEZKY_RYTIR');
    assert.equal(key(rider), '3,1');
    rider.resetTurn();
    const enemies = game.getEnemyUnits(rider.faction);
    const oldMove = h.AI.findBestMove(game, rider, enemies);
    game.currentScenario.aiDoctrine.advance = 'assault';
    const move = h.AI.findBestMove(game, rider, enemies);
    const distances = h.AI.getAssaultDistances(game, rider, enemies);
    assert.ok(game.canMoveTo(rider, move.col, move.row));
    assert.ok(distances.get(key(move)) < distances.get(key(rider)));
    assert.ok(distances.get(key(move)) < distances.get(key(oldMove)));
    assert.equal(game.hexGrid.getTerrain(move.col, move.row), 'slope');
    game.destroy();
});

test('zpětné hledání platí cenu cílového hexu, nikoli výchozího', () => {
    const { h, game, rider, target } = fixture(5, 1);
    game.hexGrid.setTerrain(2, 0, 'slope');
    game.hexGrid.setTerrain(3, 0, 'mud');
    const distances = h.AI.getAssaultDistances(game, rider, [target]);
    assert.equal(distances.get('3,0'), 0);
    assert.equal(distances.get('2,0'), 3);
    assert.equal(distances.get('1,0'), 5);
    assert.equal(distances.get('0,0'), 6);
    game.destroy();
});

test('pomalý útočník využije garantovaný krok do těžkého terénu', () => {
    const { h, game, rider, target } = fixture(5, 1);
    rider.movement = 1;
    for (let col = 1; col < 4; col++) game.hexGrid.setTerrain(col, 0, 'swamp');
    assert.equal(h.AI.getAssaultDistances(game, rider, [target]).get('0,0'), 3);
    const move = h.AI.findBestMove(game, rider, [target]);
    assert.equal(key(move), '1,0');
    assert.ok(game.canMoveTo(rider, move.col, move.row));
    game.destroy();
});

test('obchvat překážky může zvětšit vzdušnou vzdálenost bez cyklení', () => {
    const { h, game, rider, target } = fixture();
    Object.assign(rider, { col: 2, row: 3, movement: 1 });
    Object.assign(target, { col: 4, row: 3 });
    for (let row = 1; row < 5; row++) game.hexGrid.setTerrain(3, row, 'water');
    const initialDistance = game.hexGrid.getDistance(rider.col, rider.row, target.col, target.row);
    let greatestDistance = initialDistance;
    const seen = new Set([key(rider)]);
    for (let step = 0; step < 15; step++) {
        if (game.hexGrid.getDistance(rider.col, rider.row, target.col, target.row) === 1) break;
        const before = h.AI.getAssaultDistances(game, rider, [target]);
        const move = h.AI.findBestMove(game, rider, [target]);
        assert.ok(move, 'existující cesta musí pokračovat');
        assert.ok(game.canMoveTo(rider, move.col, move.row));
        assert.equal(seen.has(key(move)), false, 'nesmí se vrátit na už navštívený hex');
        assert.ok(before.get(key(move)) < before.get(key(rider)));
        greatestDistance = Math.max(greatestDistance, game.hexGrid.getDistance(move.col, move.row, target.col, target.row));
        seen.add(key(move));
        Object.assign(rider, move);
    }
    assert.equal(game.hexGrid.getDistance(rider.col, rider.row, target.col, target.row), 1);
    assert.ok(greatestDistance > initialDistance, 'nutná zacházka nejde přímo k nepříteli');
    game.destroy();
});

test('úplná vodní bariéra vede k čekání, ne k náhodnému přešlapování', () => {
    const { h, game, rider, target } = fixture();
    Object.assign(rider, { col: 2, row: 3, movement: 1 });
    Object.assign(target, { col: 4, row: 3 });
    for (let row = 0; row < 5; row++) game.hexGrid.setTerrain(3, row, 'water');
    assert.equal(h.AI.findBestMove(game, rider, [target]), null);
    assert.equal(h.AI.decideAction(game, rider).type, 'defend');
    game.destroy();
});

test('nedosažitelný nejbližší cíl nezablokuje postup k jinému protivníkovi', () => {
    const { h, game, rider, target } = fixture();
    Object.assign(rider, { col: 2, row: 3, movement: 1 });
    Object.assign(target, { col: 4, row: 3 });
    for (let row = 0; row < 5; row++) game.hexGrid.setTerrain(3, row, 'water');
    const reachable = game.unitFactory.createUnit('CEPNICI', 0, 0);
    game.units.push(reachable);
    const move = h.AI.findBestMove(game, rider, [target, reachable]);
    const distances = h.AI.getAssaultDistances(game, rider, [reachable]);
    assert.ok(distances.get(key(move)) < distances.get(key(rider)));
    assert.ok(game.canMoveTo(rider, move.col, move.row));
    game.destroy();
});

test('plán neprojde nepřítelem ani neskončí na spojenci', () => {
    const { h, game, rider, target } = fixture(5, 1);
    const blocker = game.unitFactory.createUnit('TEZKOODENCI', 1, 0);
    game.units.push(blocker);
    let move = h.AI.findBestMove(game, rider, [target]);
    assert.ok(move && key(move) !== key(blocker));
    assert.ok(game.canMoveTo(rider, move.col, move.row));
    blocker.faction = 'hussites';
    assert.equal(h.AI.getAssaultDistances(game, rider, [target]).has(key(rider)), false);
    blocker.faction = 'crusaders'; blocker.col = 3;
    assert.equal(h.AI.findBestMove(game, rider, [target]), null, 'jediná pozice pro útok je obsazená spojencem');
    game.destroy();
});

test('mrtvý protivník není překážka ani cíl pochodu', () => {
    const { h, game, rider, target } = fixture(5, 1);
    const fallen = game.unitFactory.createUnit('CEPNICI', 2, 0);
    fallen.health = 0; game.units.push(fallen);
    assert.ok(h.AI.getAssaultDistances(game, rider, [target, fallen]).has(key(rider)));
    target.health = 0;
    assert.equal(h.AI.findBestMove(game, rider, [target, fallen]), null);
    game.destroy();
});

test('zamrzlá řeka a obsazený most mají stále skutečná pohybová pravidla', () => {
    const { h, game, rider, target } = fixture(5, 1);
    game.hexGrid.setTerrain(1, 0, 'water');
    assert.equal(h.AI.findBestMove(game, rider, [target]), null);
    game.currentScenario.specialMechanics = { frozenRiver: { effect: 'heavy_units_drown' } };
    let move = h.AI.findBestMove(game, rider, [target]);
    assert.ok(move && game.canMoveTo(rider, move.col, move.row));
    game.currentScenario.specialMechanics.bridgeBottleneck = { position: [1, 0] };
    game.bridgeUsedThisTurn = true;
    assert.equal(h.AI.findBestMove(game, rider, [target]), null);
    game.bridgeUsedThisTurn = false;
    move = h.AI.findBestMove(game, rider, [target]);
    assert.ok(move && game.canMoveTo(rider, move.col, move.row));
    game.destroy();
});

test('palba ani špatný terén nezastaví jedinou průchozí cestu', () => {
    const { h, game, rider } = fixture(7, 1);
    const target = game.unitFactory.createUnit('POLNI_OPEVNENI', 6, 0);
    target.range = 6;
    game.units = [rider, target];
    rider.movement = 1;
    for (let col = 1; col < 6; col++) game.hexGrid.setTerrain(col, 0, 'forest');
    const move = h.AI.findBestMove(game, rider, [target]);
    assert.equal(key(move), '1,0');
    assert.ok(h.AI.getUnitTerrainBonus(rider, 'forest') < -30);
    assert.ok(h.AI.getRangedThreat(game, move, [target]) > 0);
    game.destroy();
});

test('hledání cesty nemění stav ani nespotřebuje náhodu a při remíze volí bezpečnější hex', () => {
    const { h, game, rider, target } = fixture();
    const moves = game.getValidMoves(rider);
    const distances = h.AI.getAssaultDistances(game, rider, [target]);
    const minimum = Math.min(...moves.map(move => distances.get(key(move)) ?? Infinity));
    const tied = moves.filter(move => distances.get(key(move)) === minimum);
    assert.ok(tied.length >= 2);
    const preferred = tied.at(-1);
    // Stejně daleké cesty: palebný vějíř odlišíme bez změny průchodnosti.
    h.AI.getRangedThreat = (g, move) => key(move) === key(preferred) ? 0 : 1;
    const snapshot = () => JSON.stringify({ units: game.units.map(u => u.serialize()), hexes: [...game.hexGrid.hexes], log: game.log, scenario: game.currentScenario });
    const before = snapshot();
    h.context.Math.random = () => { throw new Error('Plánování nesmí házet kostkou'); };
    const first = h.AI.findBestMove(game, rider, [target]);
    assert.equal(key(first), key(preferred));
    assert.equal(key(h.AI.findBestMove(game, rider, [target])), key(first));
    assert.equal(snapshot(), before);
    game.destroy();
});

test('útočný postup neovlivní střelce, velitele, zlomené jednotky ani skriptované postoje', () => {
    const { h, game, rider, target } = fixture(12, 8);
    h.AI.findAssaultMove = () => { throw new Error('Útočný postup nemá přebít tuto roli'); };
    for (const type of ['KUSNICI', 'HEINRICH_ISENBURG']) {
        const unit = game.unitFactory.createUnit(type, 0, 0);
        game.units = [unit, target];
        assert.ok(h.AI.decideAction(game, unit));
    }
    game.units = [rider, target];
    rider.morale = 5;
    assert.ok(h.AI.decideAction(game, rider));
    rider.morale = 75; rider.isRouting = true;
    assert.ok(h.AI.decideAction(game, rider));
    rider.isRouting = false;
    for (const mode of ['hold', 'defensive', 'retreat', 'lure']) {
        game.aiStance = { mode, target: { col: 0, row: 7 } };
        assert.ok(h.AI.decideAction(game, rider));
    }
    game.destroy();
});

async function playVitkov(seed = null, prepare = () => {}) {
    const h = createHarness();
    let game = h.newGame('vitkov_1420');
    if (seed !== null) {
        let state = seed;
        h.context.Math.random = () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
    }
    game = await prepare(h, game) || game;
    game.fastForwardAI = true;
    const hits = [];
    const resolve = game.combatSystem.resolveAttack.bind(game.combatSystem);
    game.combatSystem.resolveAttack = async function(attacker, defender, options = {}) {
        if (attacker.faction === 'crusaders' && this.canAttack(attacker, defender, options)) {
            hits.push({ turn: game.turnNumber, type: attacker.type, ranged: attacker.isRanged() });
        }
        return resolve(attacker, defender, options);
    };
    const execute = h.AI.executeAction;
    h.AI.executeAction = async function(g, unit, action) {
        if (action.type === 'move') assert.ok(g.canMoveTo(unit, action.col, action.row), 'každý plán musí být legální');
        return execute.call(this, g, unit, action);
    };
    for (let i = 0; i < 10 && game.gameState === 'playing'; i++) {
        game.endTurn(); await h.advance(60000);
        if (game.gameState === 'playing') assert.equal(game.currentFaction, 'hussites');
    }
    assert.equal(game.gameState, 'victory');
    game.destroy();
    return hits;
}

test('celý Vítkov: těžká jízda skutečně útočí před příchodem posil, kušníci dál střílejí', async () => {
    for (const seed of [null, 1, 2, 3, 4, 5]) {
        const hits = await playVitkov(seed);
        assert.ok(hits.some(hit => !hit.ranged && hit.turn <= 3), `seed ${seed}: včasný útok zblízka`);
        assert.ok(hits.some(hit => hit.type === 'TEZKY_RYTIR'), `seed ${seed}: útočí i těžký rytíř`);
        assert.ok(hits.some(hit => hit.type === 'TEZKOODENCI'));
        assert.ok(hits.some(hit => hit.type === 'KUSNICI'));
    }
});

test('starý checkpoint Vítkova převezme nový postup bez změny savu nebo jednotek', async () => {
    const hits = await playVitkov(null, async (h, game) => {
        game.currentScenario.aiDoctrine.advance = 'tactical';
        game.fastForwardAI = true;
        game.endTurn(); await h.advance(60000);
        assert.equal(game.saveGame(), true);
        const raw = h.storage.get(h.SaveGameSystem.STORAGE_KEY);
        const before = JSON.stringify(game.units.map(u => u.serialize()));
        const restored = h.SaveGameSystem.load(h.document.getElementById('game-canvas'), game);
        assert.equal(restored.currentScenario.aiDoctrine.advance, 'assault');
        assert.equal(restored.currentScenario.mapRevision, 2);
        assert.equal(restored.turnNumber, 2);
        assert.equal(JSON.stringify(restored.units.map(u => u.serialize())), before);
        assert.equal(h.storage.get(h.SaveGameSystem.STORAGE_KEY), raw);
        return restored;
    });
    assert.ok(hits.some(hit => !hit.ranged && hit.turn <= 4));
});

test('ostatních 17 scénářů útočný plánovač vůbec nevolá', async () => {
    const ids = Object.keys(createHarness().Scenarios).filter(id => id !== 'vitkov_1420');
    assert.equal(ids.length, 17);
    for (const id of ids) {
        const h = createHarness(), game = h.newGame(id);
        h.AI.findAssaultMove = () => { throw new Error(`${id}: nevyžádaná změna chování`); };
        game.fastForwardAI = true;
        for (let i = 0; i < 3 && game.gameState === 'playing'; i++) {
            game.endTurn(); await h.advance(60000);
        }
        game.destroy();
    }
});

(async () => {
    let failures = 0;
    for (const { name, run } of tests) {
        try { await run(); console.log(`✓ ${name}`); }
        catch (error) { failures++; console.error(`✗ ${name}\n${error.stack}`); }
    }
    console.log(`\n${tests.length - failures}/${tests.length} testů útočného postupu AI.`);
    if (failures) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
