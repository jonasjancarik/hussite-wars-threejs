#!/usr/bin/env node
const assert = require('node:assert/strict');
const { createHarness } = require('./helpers/game-harness');

function prepare(turn, massacreTriggered = false) {
    const h = createHarness(), game = h.newGame('vysehrad_1420');
    const hussite = game.units.find(unit => unit.faction === 'hussites');
    const trapped = game.units.find(unit =>
        unit.type === 'TEZKOODENCI' && unit.col === 9 && unit.row === 21
    );
    const outside = game.units.find(unit =>
        unit.type === 'TEZKOODENCI' && unit.col === 14 && unit.row === 22
    );
    const commander = game.units.find(unit => unit.type === 'ZIKMUND');

    game.units = [hussite, trapped, outside, commander];
    game.initialEnemyUnits = 3;
    game.currentFaction = 'crusaders';
    game.turnNumber = turn;
    for (const unit of [trapped, outside]) {
        unit.morale = 0;
        unit.isRouting = true;
    }
    if (massacreTriggered) game.processedEvents.add('massacre_event');

    return { game, trapped, outside, commander };
}

const early = prepare(7);
early.game.moraleSystem.processRoutingUnits();
assert.ok(early.trapped.health > 0, 'ani oddíl v budoucí pasti nesmí v 7. kole zmizet');
assert.ok(early.outside.health > 0, 'vojsko mimo past musí ustupovat běžným způsobem');
early.game.destroy();

const beforeEvent = prepare(10);
beforeEvent.game.moraleSystem.processRoutingUnits();
assert.ok(beforeEvent.trapped.health > 0, 'bez vyhlášení masakru se pravidlo neaktivuje');
beforeEvent.game.destroy();

const late = prepare(10, true);
late.game.moraleSystem.processRoutingUnits();
assert.equal(late.trapped.health, 0, 'po události je prchající oddíl v úvozu dopaden');
assert.ok(late.outside.health > 0, 'oddíl mimo podolskou past není hromadně odstraněn');
assert.ok(late.commander.health > 0);
late.game.destroy();

console.log('✓ Vyšehrad nesmaže prchající vojsko v 7. kole a masakr omezí na podolskou past');
