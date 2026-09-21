const assert = require('node:assert/strict');
const { execFileSync } = require('node:child_process');
const path = require('node:path');
const { createHarness } = require('./harness.cjs');

const referenceRoot = process.env.HUSSITE_WARS_REFERENCE || path.resolve(__dirname, '../../../..');
const vendorRoot = path.resolve(__dirname, '../../web/hex-diorama/vendor/husitske-valky');
const expectedSha = 'dbdf61907212476cda816ff2036a9a8d41bf3572';
assert.equal(execFileSync('git', ['diff', expectedSha, '--', 'js'], { cwd: referenceRoot, encoding: 'utf8' }).trim(), '', 'upstream rules differ from the pinned reference');

function logical(game) {
    return JSON.parse(JSON.stringify({
        turn: game.turnNumber, faction: game.currentFaction, state: game.gameState,
        terrain: [...game.hexGrid.hexes.values()].map(({ col, row, terrain }) => [col, row, terrain]),
        units: game.units.map(unit => ({ id: unit.id, type: unit.type, faction: unit.faction, col: unit.col, row: unit.row, health: unit.health, maxHealth: unit.maxHealth, morale: unit.morale, maxMorale: unit.maxMorale, attack: unit.attack, defense: unit.defense, movement: unit.movement, moved: unit.hasMoved, attacked: unit.hasAttacked, attackCount: unit.attackCount, defending: unit.isDefending, routing: unit.isRouting, escaped: Boolean(unit.escaped), closed: unit.formationClosed, marching: unit.marching })).sort((a, b) => a.id - b.id),
        selected: game.selectedUnit?.id ?? null, choralUsed: game.choralUsed,
        routing: [...game.routingUnits].sort(), regenerated: [...game.regeneratedUnits].sort(),
        armyMorale: game.armyMorale, wavering: game.wavering, lastMove: game.lastMove?.unit?.id ?? null,
        events: [...game.processedEvents].sort(), result: game.view.result || null
    }));
}

async function run() {
    const baseline = createHarness({ root: referenceRoot });
    const adapted = createHarness({ root: vendorRoot, adapter: true });
    const left = baseline.newGame(), right = adapted.newGame();
    assert.deepEqual(logical(right), logical(left), 'initial adapter state differs');
    assert.equal(left.units.filter(unit => unit.faction === 'hussites').length, 13);
    assert.equal(left.units.filter(unit => unit.faction === 'crusaders').length, 15);
    const terrainCounts = Object.groupBy([...left.hexGrid.hexes.values()], tile => tile.terrain);
    assert.equal(terrainCounts.water.length, 40); assert.equal(terrainCounts.mud.length, 40); assert.equal(terrainCounts.dam.length, 2);

    const wagonLeft = left.units.find(unit => unit.type === 'VOZOVA_HRADBA');
    const wagonRight = right.units.find(unit => unit.id === wagonLeft.id);
    assert.equal(wagonLeft.formationClosed, false, 'scenario wagon must start open');
    assert.equal(left.toggleWagonFormation(wagonLeft), right.toggleWagonFormation(wagonRight));
    assert.deepEqual(logical(right), logical(left), 'wagon formation differs');

    const movableLeft = left.units.find(unit => unit.faction === 'hussites' && !unit.isWagon() && left.getValidMoves(unit).length);
    const movableRight = right.units.find(unit => unit.id === movableLeft.id);
    left.selectUnit(movableLeft); right.selectUnit(movableRight);
    const leftMoves = JSON.parse(JSON.stringify(left.getValidMoves(movableLeft))).sort((a, b) => a.col - b.col || a.row - b.row);
    const rightMoves = JSON.parse(JSON.stringify(right.getValidMoves(movableRight))).sort((a, b) => a.col - b.col || a.row - b.row);
    assert.deepEqual(rightMoves, leftMoves, 'legal move set differs');
    const target = leftMoves[0];
    await Promise.all([left.moveUnit(movableLeft, target.col, target.row), right.moveUnit(movableRight, target.col, target.row)]);
    assert.deepEqual(logical(right), logical(left), 'move resolution differs');
    assert.equal(left.getTerrainMoveCost('mud', movableLeft), movableLeft.isCavalry() ? 3 : 2);

    assert.equal(left.endTurn(), right.endTurn());
    await Promise.all([baseline.advance(120000), adapted.advance(120000)]);
    assert.deepEqual(logical(right), logical(left), 'AI turn differs');
    assert.equal(right.currentFaction, 'hussites', 'AI turn did not complete');

    // Synthetic close combat uses the same setup on both independent engines.
    const combatLeft = left.units.find(unit => unit.type === 'CEPNICI' && unit.health > 0);
    const combatRight = right.units.find(unit => unit.id === combatLeft.id);
    const defenderLeft = left.units.find(unit => unit.type === 'HALAPARTNICI' && unit.health > 0);
    const defenderRight = right.units.find(unit => unit.id === defenderLeft.id);
    for (const [attacker, defender] of [[combatLeft, defenderLeft], [combatRight, defenderRight]]) {
        attacker.col = 15; attacker.row = 10; attacker.resetTurn();
        defender.col = 16; defender.row = 10; defender.resetTurn();
    }
    const attacks = [left.combatSystem.performAttack(combatLeft, defenderLeft), right.combatSystem.performAttack(combatRight, defenderRight)];
    await Promise.all([baseline.advance(2000), adapted.advance(2000)]); await Promise.all(attacks);
    assert.deepEqual(logical(right), logical(left), 'attack/counterattack differs');
    assert.equal(adapted.randomCalls(), baseline.randomCalls(), 'combat consumed a different RNG sequence');

    assert.equal(left.activateChoral(), right.activateChoral());
    assert.deepEqual(logical(right), logical(left), 'choral effect differs');
    assert.equal(adapted.randomCalls(), baseline.randomCalls(), 'choral consumed a different RNG sequence');

    const wagonBase = createHarness({ root: referenceRoot });
    const wagonAdapted = createHarness({ root: vendorRoot, adapter: true });
    const wagonLeftGame = wagonBase.newGame(), wagonRightGame = wagonAdapted.newGame();
    const marchWagonLeft = wagonLeftGame.units.find(item => item.type === 'VOZOVA_HRADBA');
    const marchWagonRight = wagonRightGame.units.find(item => item.id === marchWagonLeft.id);
    assert.equal(wagonLeftGame.toggleWagonFormationLine(marchWagonLeft), wagonRightGame.toggleWagonFormationLine(marchWagonRight));
    for (const game of [wagonLeftGame, wagonRightGame]) game.units.filter(item => item.type === 'VOZOVA_HRADBA').forEach(item => item.resetTurn());
    assert.equal(wagonLeftGame.toggleWagonMarch(marchWagonLeft), wagonRightGame.toggleWagonMarch(marchWagonRight));
    const marchLeft = JSON.parse(JSON.stringify(wagonLeftGame.getWagonMarchTargets(marchWagonLeft)));
    const marchRight = JSON.parse(JSON.stringify(wagonRightGame.getWagonMarchTargets(marchWagonRight)));
    assert.deepEqual(marchRight, marchLeft, 'wagon march targets differ');
    if (marchLeft.length) {
        const direction = wagonLeftGame.hexGrid.directionTo(marchWagonLeft.col, marchWagonLeft.row, marchLeft[0].col, marchLeft[0].row);
        assert.equal(wagonLeftGame.marchWagonLine(marchWagonLeft, direction), wagonRightGame.marchWagonLine(marchWagonRight, direction));
    }
    assert.deepEqual(logical(wagonRightGame), logical(wagonLeftGame), 'wagon line/march differs');

    const undoBase = createHarness({ root: referenceRoot });
    const undoAdapted = createHarness({ root: vendorRoot, adapter: true });
    const undoLeft = undoBase.newGame(), undoRight = undoAdapted.newGame();
    const undoUnitLeft = undoLeft.units.find(item => item.faction === 'hussites' && !item.isWagon() && undoLeft.getValidMoves(item).length);
    const undoUnitRight = undoRight.units.find(item => item.id === undoUnitLeft.id);
    const undoTarget = undoLeft.getValidMoves(undoUnitLeft)[0];
    await Promise.all([undoLeft.moveUnit(undoUnitLeft, undoTarget.col, undoTarget.row), undoRight.moveUnit(undoUnitRight, undoTarget.col, undoTarget.row)]);
    assert.equal(undoLeft.undoLastMove(), undoRight.undoLastMove());
    assert.deepEqual(logical(undoRight), logical(undoLeft), 'undo differs');

    const moraleBase = createHarness({ root: referenceRoot });
    const moraleAdapted = createHarness({ root: vendorRoot, adapter: true });
    const moraleLeft = moraleBase.newGame(), moraleRight = moraleAdapted.newGame();
    const routingLeft = moraleLeft.units.find(item => item.faction === 'crusaders' && !item.isCommander());
    const routingRight = moraleRight.units.find(item => item.id === routingLeft.id);
    for (const [game, unit] of [[moraleLeft, routingLeft], [moraleRight, routingRight]]) { unit.morale = 0; unit.isRouting = true; game.routingUnits.add(unit.id); }
    moraleLeft.moraleSystem.processRoutingUnits(); moraleRight.moraleSystem.processRoutingUnits();
    const healingLeft = moraleLeft.units.find(item => item.type === 'VOZOVA_HRADBA');
    const healingRight = moraleRight.units.find(item => item.id === healingLeft.id);
    healingLeft.health -= 15; healingRight.health -= 15;
    moraleLeft.regenerateHealth(); moraleRight.regenerateHealth();
    assert.deepEqual(logical(moraleRight), logical(moraleLeft), 'routing/regeneration differs');
    assert.equal(moraleAdapted.randomCalls(), moraleBase.randomCalls(), 'morale consumed a different RNG sequence');

    const commanderBase = createHarness({ root: referenceRoot });
    const commanderAdapted = createHarness({ root: vendorRoot, adapter: true });
    const commanderLeft = commanderBase.newGame(), commanderRight = commanderAdapted.newGame();
    for (const game of [commanderLeft, commanderRight]) { game.turnNumber = 13; game.units.filter(item => item.faction === 'crusaders' && !item.isCommander()).forEach(item => { item.health = 0; }); }
    commanderLeft.victoryConditionsSystem.checkScenarioVictoryConditions(); commanderRight.victoryConditionsSystem.checkScenarioVictoryConditions();
    assert.deepEqual(logical(commanderRight), logical(commanderLeft), 'commander-only result differs');
    assert.notEqual(commanderLeft.gameState, 'playing', 'commander-only alternative did not resolve');

    const survivalBase = createHarness({ root: referenceRoot });
    const survivalAdapted = createHarness({ root: vendorRoot, adapter: true });
    const survivalLeft = survivalBase.newGame(), survivalRight = survivalAdapted.newGame();
    survivalLeft.turnNumber = 13; survivalRight.turnNumber = 13;
    survivalLeft.victoryConditionsSystem.checkScenarioVictoryConditions(); survivalRight.victoryConditionsSystem.checkScenarioVictoryConditions();
    assert.deepEqual(logical(survivalRight), logical(survivalLeft), 'survival victory differs');
    assert.equal(survivalLeft.view.result?.isVictory, true, 'survival victory variant did not win');

    const attritionBase = createHarness({ root: referenceRoot });
    const attritionAdapted = createHarness({ root: vendorRoot, adapter: true });
    const attritionLeft = attritionBase.newGame(), attritionRight = attritionAdapted.newGame();
    for (const game of [attritionLeft, attritionRight]) { game.turnNumber = 13; game.units.filter(item => item.faction === 'hussites').slice(0, 7).forEach(item => { item.health = 0; }); }
    attritionLeft.victoryConditionsSystem.checkScenarioVictoryConditions(); attritionRight.victoryConditionsSystem.checkScenarioVictoryConditions();
    assert.deepEqual(logical(attritionRight), logical(attritionLeft), 'attrition defeat differs');
    assert.equal(attritionLeft.view.result?.isVictory, false, 'attrition defeat variant did not lose');

    const defeatBase = createHarness({ root: referenceRoot });
    const defeatAdapted = createHarness({ root: vendorRoot, adapter: true });
    const defeatLeft = defeatBase.newGame(), defeatRight = defeatAdapted.newGame();
    for (const game of [defeatLeft, defeatRight]) game.units.filter(item => item.faction === 'hussites').forEach(item => { item.health = 0; });
    defeatLeft.victoryConditionsSystem.checkVictory(); defeatRight.victoryConditionsSystem.checkVictory();
    assert.deepEqual(logical(defeatRight), logical(defeatLeft), 'defeat result differs');

    const blockedBase = createHarness({ root: referenceRoot });
    const blockedAdapted = createHarness({ root: vendorRoot, adapter: true });
    const blockedLeft = blockedBase.newGame(), blockedRight = blockedAdapted.newGame();
    for (const game of [blockedLeft, blockedRight]) {
        for (let col = 0; col < game.hexGrid.cols; col++) for (let row = 0; row < game.hexGrid.rows; row++) {
            if (!game.hexGrid.isImpassable(col, row) && !game.getUnitAt(col, row)) game.units.push(game.unitFactory.createUnit('CEPNICI', col, row));
        }
    }
    const blocked = { type: 'TEZKY_RYTIR', position: [0, 4], count: 3 };
    assert.equal(blockedLeft.spawnReinforcements(blocked, 'crusaders'), 0);
    assert.equal(blockedRight.spawnReinforcements(blocked, 'crusaders'), 0);
    assert.deepEqual(logical(blockedRight), logical(blockedLeft), 'blocked reinforcement handling differs');

    let sawTurnSix = false;
    while (left.gameState === 'playing' && left.turnNumber <= 13) {
        assert.equal(left.endTurn(), right.endTurn());
        await Promise.all([baseline.advance(120000), adapted.advance(120000)]);
        assert.deepEqual(logical(right), logical(left), `full playthrough differs at round ${left.turnNumber}`);
        if (left.turnNumber >= 6) sawTurnSix ||= left.units.length >= 31;
    }
    assert.notEqual(left.gameState, 'playing', 'complete AI playthrough did not reach a result');
    assert.equal(sawTurnSix, true, 'turn-six reinforcements were not observed');
    const eventLeft = baseline.newGame(), eventRight = adapted.newGame();
    eventLeft.turnNumber = 10; eventRight.turnNumber = 10;
    eventLeft.updatePhase(); eventRight.updatePhase(); eventLeft.checkPhaseEvents(); eventRight.checkPhaseEvents();
    assert.deepEqual(logical(eventRight), logical(eventLeft), 'turn-ten scenario event differs');
    assert.equal(eventLeft.processedEvents.size > 0, true, 'turn-ten scenario event was not processed');

    const snapshot = right.view.snapshot();
    assert.equal(snapshot.tiles.length, 240); assert.equal(snapshot.scenario, 'sudomere_1420');
    console.log('reference parity: setup, movement/undo, wagon line/march, combat/counterattack, commander and choral effects, routing/regeneration, blocked and turn-six reinforcements, fog event, survival, attrition, commander-only and total-defeat variants, plus terminal AI result all match with equal RNG consumption');
}

run().catch(error => { console.error(error); process.exitCode = 1; });
