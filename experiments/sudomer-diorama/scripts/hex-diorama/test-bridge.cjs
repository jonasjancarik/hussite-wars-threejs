const assert = require('node:assert/strict');
const path = require('node:path');
const { createHarness } = require('./harness.cjs');
const root = path.resolve(__dirname, '../../web/hex-diorama/vendor/husitske-valky');

function send(h, fields) {
    const current = h.context.SudomerHexBridge.current();
    return JSON.parse(h.context.SudomerHexBridge.sendCommand(JSON.stringify({ protocolVersion: 1, generation: current.generation, revision: current.revision, ...fields })));
}

(async () => {
    const h = createHarness({ root, adapter: true });
    const game = h.newGame();
    const unit = game.units.find(item => item.faction === 'hussites');
    assert.equal(send(h, { action: 'select', unitId: unit.id }).ok, true);
    assert.equal(game.selectedUnit.id, unit.id);
    assert.equal(send(h, { action: 'inspect', col: unit.col, row: unit.row }).ok, true);
    assert.equal(game.view.snapshot().inspection.unit.id, unit.id);
    assert.equal(send(h, { action: 'select', unitId: 99999 }).reason, 'invalid-unit');
    assert.equal(JSON.parse(h.context.SudomerHexBridge.sendCommand('{')).reason, 'protocol');
    const staleRevision = JSON.parse(h.context.SudomerHexBridge.sendCommand(JSON.stringify({ protocolVersion: 1, generation: 1, revision: 0, action: 'pause' })));
    assert.equal(staleRevision.reason, 'stale-revision');
    const generation = h.context.SudomerHexBridge.current().generation;
    game.currentFaction = 'crusaders'; game.view.publish();
    assert.equal(send(h, { action: 'end-turn' }).reason, 'ai-turn');
    game.currentFaction = 'hussites'; game.actions.busy = true; game.view.publish();
    assert.equal(send(h, { action: 'end-turn' }).reason, 'busy');
    game.actions.busy = false;
    game.fogOfWar = true; game.visibleHexes.clear(); game.view.publish();
    assert.equal(game.view.snapshot().units.some(item => item.faction === 'crusaders'), false, 'hidden enemies leaked');
    const hiddenEnemy = game.units.find(item => item.faction === 'crusaders');
    assert.equal(send(h, { action: 'inspect', col: hiddenEnemy.col, row: hiddenEnemy.row }).reason, 'hidden');
    game.view.effect('move', hiddenEnemy.col, hiddenEnemy.row);
    assert.equal(game.view.snapshot().events.length, 0, 'hidden cosmetic event leaked');
    game.fogOfWar = false; game.view.publish();
    game.view.effect('move', 9, 5); game.view.effect('move', 9, 5);
    const ids = game.view.snapshot().events.map(event => event.id);
    assert.equal(new Set(ids).size, ids.length, 'cosmetic event IDs repeated');
    const second = h.newGame();
    h.context.SudomerHexBridge.bind(second, second.view, generation + 1); second.view.publish();
    const old = JSON.parse(h.context.SudomerHexBridge.sendCommand(JSON.stringify({ protocolVersion: 1, generation, revision: 1, action: 'pause' })));
    assert.equal(old.reason, 'stale-generation');
    assert.equal(h.context.SudomerHexBridge.takeSnapshot().length > 0, true);
    assert.equal(h.context.SudomerHexBridge.takeSnapshot(), '', 'unchanged snapshots must be cheap');
    let settled = false;
    const wait = second.actions.wait(1000).then(value => { settled = value; });
    second.setPaused(true); await h.advance(2000); assert.equal(settled, false, 'paused waits advanced');
    second.setPaused(false); await h.advance(1000); await wait; assert.equal(settled, true, 'resumed wait did not finish');
    const cancelled = second.actions.wait(5000); second.destroy(); await h.advance(5000); assert.equal(await cancelled, false, 'destroy did not cancel waits');
    const aiOld = h.newGame(); aiOld.currentFaction = 'crusaders'; const scheduled = aiOld.scheduleAI(); aiOld.destroy();
    const aiReplacement = h.newGame(); h.context.SudomerHexBridge.bind(aiReplacement, aiReplacement.view, generation + 2); aiReplacement.view.publish();
    await h.advance(10000); await scheduled;
    assert.equal(aiOld.gameState, 'destroyed'); assert.equal(aiReplacement.turnNumber, 1, 'old AI changed the replacement game');
    let previous = second;
    for (let index = 0; index < 10; index++) {
        previous.destroy(); const next = h.newGame(); h.context.SudomerHexBridge.bind(next, next.view, generation + 2 + index); next.view.publish(); previous = next;
    }
    assert.equal(h.context.SudomerHexBridge.current().generation, generation + 11, 'ten restart generations did not advance');
    console.log('bridge validation: valid, invalid, stale, busy, AI turn, hidden units, event IDs and reset generation pass');
})().catch(error => { console.error(error); process.exitCode = 1; });
