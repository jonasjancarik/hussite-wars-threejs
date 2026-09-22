#!/usr/bin/env node
const assert = require('node:assert/strict');
const { createHarness } = require('./helpers/game-harness');
const BattleReviewSystem = require('../js/systems/BattleReviewSystem.js');
const tests = [];
const test = (name, run) => tests.push({ name, run });

test('zaznamena takticke pohyby, boj a konec hracova tahu', () => {
    const h = createHarness(), game = h.newGame('zivohost_1419');
    const player = game.getUnitsOfFaction('hussites')[0];
    const enemy = game.getUnitsOfFaction('crusaders')[0];
    player.unitClass = 'cavalry';
    game.hexGrid.setTerrain(player.col + 1, player.row, 'mud');
    h.BattleReviewSystem.recordMove(game, player,
        { col: player.col, row: player.row }, { col: player.col + 1, row: player.row });
    h.BattleReviewSystem.recordAttack(game, enemy, player,
        { damage: 22, counterDamage: 4, killed: false, attackerKilled: false },
        { defenderTerrain: 'mud', defenderWasDefending: true, linkedWagons: 0 });
    h.BattleReviewSystem.recordTurnEnd(game, 'hussites', game.getUnitsOfFaction('hussites'));
    assert.equal(game.battleReview.events.length, 3);
    assert.equal(game.battleReview.events[0].heavyTerrain, true);
    assert.equal(game.battleReview.events[1].damage, 22);
    assert.equal(game.battleReview.events[2].type, 'turn_end');
    game.destroy();
});

test('mistni rozbor vychazi jen ze strukturovanych udalosti a vysledku', () => {
    const h = createHarness(), game = h.newGame('zivohost_1419');
    const player = game.getUnitsOfFaction('hussites')[0];
    for (let i = 0; i < 2; i++) {
        h.BattleReviewSystem.append(game, {
            type: 'move', faction: 'hussites', unit: h.BattleReviewSystem.unitSummary(player),
            from: { col: 0, row: 0, terrain: 'plains' },
            to: { col: 1, row: 0, terrain: 'mud' },
            heavyTerrain: true, threatBefore: 0, threatAfter: 1
        });
    }
    const report = h.BattleReviewSystem.buildReport(game, false, {
        turns: 4,
        aliveByFaction: { hussites: 2, crusaders: 5 },
        lossesByFaction: { hussites: 4, crusaders: 1 },
        fledByFaction: { hussites: 0, crusaders: 0 },
        secondaryObjectives: [{ achieved: false, description: 'Protect pilgrims' }]
    });
    const codes = Array.from(report.findings, item => item.code);
    assert.ok(codes.includes('heavyLosses'));
    assert.ok(codes.includes('cavalryHeavyTerrain'));
    assert.ok(codes.includes('enteredRangedThreat'));
    assert.ok(codes.includes('missedObjectives'));
    assert.equal(report.metrics.playerLost, 4);
    game.destroy();
});

test('zaznam rozboru prezije save a vadna udalost se odmitne', () => {
    const h = createHarness(), game = h.newGame('zivohost_1419');
    h.BattleReviewSystem.append(game, {
        type: 'turn_end', faction: 'hussites', autoDefended: 2, coverFirePrepared: 1
    });
    assert.equal(game.saveGame(), true);
    const restored = h.SaveGameSystem.load(h.document.getElementById('game-canvas'), game);
    assert.equal(restored.battleReview.events.length, 1);
    assert.equal(restored.battleReview.events[0].autoDefended, 2);
    const raw = JSON.parse(h.storage.get(h.SaveGameSystem.STORAGE_KEY));
    raw.battleReview.events[0].autoDefended = -1;
    assert.throws(() => h.SaveGameSystem.prepare(raw), /saveIncompatible/);
    restored.destroy();
});

test('Responses API dostane schema, overena fakta a volitelny compatibility key', async () => {
    let request;
    const result = await BattleReviewSystem.requestAIReview(
        { version: 1, battle: { name: 'Test' }, metrics: {}, findings: [], notableEvents: [] },
        'en',
        { endpoint: 'http://127.0.0.1:3400/v1/responses', model: 'gpt-5.6', apiKey: 'compat-key', timeoutMs: 1000 },
        async (url, options) => {
            request = { url, options, body: JSON.parse(options.body) };
            return {
                ok: true,
                json: async () => ({ output_text: JSON.stringify({
                    headline: 'Hold the line', summary: 'A concise review.',
                    strengths: ['Good formation.'], improvements: ['Watch the flank.'], nextFocus: 'Protect the wagons.'
                }) })
            };
        }
    );
    assert.equal(request.url, 'http://127.0.0.1:3400/v1/responses');
    assert.equal(request.options.headers.Authorization, 'Bearer compat-key');
    assert.equal(request.body.text.format.type, 'json_schema');
    assert.match(request.body.instructions, /Use only facts/);
    assert.equal(result.nextFocus, 'Protect the wagons.');
});

test('opusteni vysledku muze zrusit bezici pozadavek poradce', async () => {
    const external = new AbortController();
    const pending = BattleReviewSystem.requestAIReview(
        { version: 1, battle: {}, metrics: {}, findings: [], notableEvents: [] }, 'en',
        { endpoint: '/v1/responses', model: 'gpt-5.6', apiKey: '', timeoutMs: 1000 },
        async (_url, options) => new Promise((_resolve, reject) => {
            options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        }),
        external.signal
    );
    external.abort();
    await assert.rejects(pending, /aborted/);
});

(async () => {
    let failures = 0;
    for (const { name, run } of tests) {
        try { await run(); console.log(`✓ ${name}`); }
        catch (error) { failures++; console.error(`✗ ${name}\n${error.stack}`); }
    }
    console.log(`\n${tests.length - failures}/${tests.length} testu rozboru bitvy.`);
    if (failures) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
