#!/usr/bin/env node
const assert = require('node:assert/strict');
const { createHarness } = require('./helpers/game-harness');
const { createLocalizedHarness } = require('./helpers/localized-harness');
const tests = [];
const test = (name, run) => tests.push({ name, run });

function duel(attackerType = 'CEPNICI', defenderType = 'HALAPARTNICI', faction = 'hussites') {
    const h = createHarness(), game = h.newGame();
    const attacker = game.unitFactory.createUnit(attackerType, 5, 5);
    const defender = game.unitFactory.createUnit(defenderType, 6, 5);
    attacker.faction = faction; defender.faction = faction === 'hussites' ? 'crusaders' : 'hussites';
    game.units = [attacker, defender]; game.currentFaction = faction;
    game.hexGrid.setTerrain(5, 5, 'plains'); game.hexGrid.setTerrain(6, 5, 'plains');
    return { h, game, attacker, defender };
}

// Izolovaný vzorec bez bonusů šablony; integrační testy níže používají skutečné šablony.
function plainDuel() {
    const f = duel();
    for (const unit of [f.attacker, f.defender]) {
        Object.assign(unit, { maxHealth: 100, health: 100, attack: 100, defense: 0, special: null });
        unit.getTerrainAttackBonus = () => 0;
        unit.getTerrainDefenseBonus = () => 0;
        unit.getWeaknessBonus = () => 0;
    }
    return f;
}

test('křivka síly: plné HP 100 %, polovina 70 %, desetina 46 %, mrtví 0 %', () => {
    const { game, attacker } = plainDuel();
    for (const [health, expected] of [[100, 1], [50, 0.7], [10, 0.46], [1, 0.406], [0, 0], [-5, 0], [150, 1]]) {
        assert.ok(Math.abs(attacker.getAttackStrength(health) - expected) < 1e-12);
    }
    assert.equal(attacker.health, 100, 'hypotetické HP nesmí měnit oddíl');
    game.destroy();
});

test('síla oslabí útok včetně bonusů, ale ne obranu ani uloženou základní statistiku', () => {
    const { game, attacker, defender } = plainDuel();
    attacker.health = 50; defender.defense = 20;
    const context = { attackerCommanderBonus: 10, attackerFormationAttack: 5 };
    assert.equal(attacker.computeDamage(defender, 'plains', 'plains', false, context, 1), 71);
    assert.equal(attacker.attack, 100); assert.equal(defender.defense, 20);
    defender.health = 10;
    assert.equal(attacker.computeDamage(defender, 'plains', 'plains', false, context, 1), 71);
    game.destroy();
});

test('dosavadní minima zásahu zůstanou živým jednotkám, mrtvá jednotka neudeří', () => {
    const { game, attacker, defender } = plainDuel();
    attacker.health = 1; attacker.attack = 1; defender.defense = 100;
    assert.equal(attacker.computeDamage(defender, 'plains', 'plains', false, null, 1), 5);
    attacker.defense = 100; defender.attack = 1;
    assert.equal(attacker.computeCounterDamage(defender, 'plains', null, 1, 1), 3);
    assert.equal(attacker.computeCounterDamage(defender, 'plains', null, 1, 0), 0);
    attacker.health = 0;
    assert.equal(attacker.computeDamage(defender, 'plains', 'plains', false, null, 1), 0);
    game.destroy();
});

for (const faction of ['hussites', 'crusaders']) {
    test(`${faction}: skutečný útok slábne s HP a drží se náhledu pro pěchotu, jízdu, střelce i vozy`, async () => {
        for (const type of ['CEPNICI', 'TEZKY_RYTIR', 'RUCNICARI', 'VOZOVA_HRADBA']) {
            let previous = -Infinity;
            let weakest;
            for (const ratio of [0.1, 0.5, 1]) {
                const { h, game, attacker, defender } = duel(type, 'HALAPARTNICI', faction);
                attacker.health = attacker.maxHealth * ratio;
                attacker.hasMoved = type === 'TEZKY_RYTIR';
                const preview = game.combatSystem.calculateDamagePreview(attacker, defender);
                const before = defender.health;
                const action = game.combatSystem.performAttack(attacker, defender);
                await h.advance(1000); await action;
                const damage = before - defender.health;
                assert.ok(damage >= preview.min && damage <= preview.max, type);
                assert.ok(damage >= previous, `${type}: více zdraví nesmí zhoršit úder`);
                if (ratio === 0.1) weakest = damage;
                if (ratio === 1) assert.ok(damage > weakest, `${type}: plný oddíl udeří silněji než zdecimovaný`);
                previous = damage;
                game.destroy();
            }
        }
    });
}

test('protiútok použije zbývající zdraví po prvním zásahu', () => {
    const { h, game, attacker, defender } = plainDuel();
    attacker.attack = 40;
    h.context.Math.random = () => 0.5;
    const result = attacker.attackTarget(defender, 'plains');
    assert.equal(result.damage, 40);
    assert.equal(defender.health, 60);
    assert.equal(result.counterDamage, 19, '100 × 25 % × (40 % + 60 % × 60 %)');
    game.destroy();
});

test('náhled protiútoku pokryje všechny kombinace hodů, zranění i možnou smrt obránce', () => {
    for (const targetHealth of [20, 39, 45, 60, 100]) {
        for (const attackRoll of [0, 0.25, 0.5, 0.75, 1]) for (const counterRoll of [0, 0.25, 0.5, 0.75, 1]) {
            const { h, game, attacker, defender } = plainDuel();
            attacker.attack = 40; defender.health = targetHealth;
            const before = JSON.stringify([attacker.serialize(), defender.serialize()]);
            const preview = attacker.previewAttackOutcome(defender, 'plains', 'plains', false, null);
            assert.equal(JSON.stringify([attacker.serialize(), defender.serialize()]), before);
            const rolls = [attackRoll, counterRoll];
            h.context.Math.random = () => rolls.shift() ?? 0.5;
            const result = attacker.attackTarget(defender, 'plains');
            assert.ok(result.damage >= preview.min && result.damage <= preview.max);
            if (preview.counter) {
                assert.ok(result.counterDamage >= preview.counter.min && result.counterDamage <= preview.counter.max,
                    JSON.stringify({ targetHealth, attackRoll, counterRoll, preview, result }));
            } else {
                assert.equal(result.counterDamage, 0);
            }
            game.destroy();
        }
    }
});

test('možné zabití obránce nesmí hlásit jistou smrt útočníka', () => {
    const { game, attacker, defender } = plainDuel();
    attacker.health = 20; defender.health = 55; defender.attack = 200;
    const preview = attacker.previewAttackOutcome(defender, 'plains', 'plains', false, null);
    assert.equal(preview.killsPossible, true); assert.equal(preview.killsCertain, false);
    assert.equal(preview.counter.min, 0);
    assert.equal(preview.counter.killsAttackerCertain, false);
    assert.equal(preview.counter.killsAttackerPossible, true);
    game.destroy();
});

test('jisté zabití zabrání protiútoku i u silného obránce', () => {
    const { h, game, attacker, defender } = plainDuel();
    defender.health = 5; defender.attack = 200;
    const preview = attacker.previewAttackOutcome(defender, 'plains', 'plains', false, null);
    assert.equal(preview.killsCertain, true); assert.equal(preview.counter, null);
    h.context.Math.random = () => 0;
    assert.equal(attacker.attackTarget(defender, 'plains').counterDamage, 0);
    game.destroy();
});

test('plošná střelba oslabí hlavní zásah i zásah sousedů právě jednou', () => {
    const damage = [];
    for (const ratio of [1, 0.5]) {
        const { game, attacker, defender } = duel('HOUFNICE', 'TEZKY_RYTIR');
        attacker.health = attacker.maxHealth * ratio;
        const neighbor = game.unitFactory.createUnit('TEZKY_RYTIR', 6, 6);
        game.units.push(neighbor);
        const context = game.combatSystem.buildGameContext(attacker, defender);
        const result = attacker.attackTarget(defender, 'plains', 'plains', false, context);
        assert.equal(result.areaDamage.length, 1);
        assert.equal(result.areaDamage[0].damage, Math.round(result.damage * 0.5));
        damage.push(result.damage);
        game.destroy();
    }
    assert.ok(damage[1] < damage[0]);
});

test('reakční střelba používá stejnou křivku jako běžný útok', async () => {
    const { h, game, attacker, defender } = duel('RUCNICARI', 'TEZKY_RYTIR');
    attacker.health = attacker.maxHealth / 2; game.currentFaction = defender.faction;
    const preview = game.combatSystem.calculateDamagePreview(attacker, defender);
    const before = defender.health;
    const action = game.actions.run(() => game.combatSystem.resolveAttack(attacker, defender, { reaction: true }));
    await h.advance(1000); await action;
    assert.ok(before - defender.health >= preview.min && before - defender.health <= preview.max);
    assert.equal(attacker.attackCount, 1);
    game.destroy();
});

test('léčení a save/load obnoví sílu bez násobení základního útoku a bez nového formátu savu', () => {
    const { h, game, attacker, defender } = duel();
    const baseAttack = attacker.attack;
    attacker.health = attacker.maxHealth / 2;
    const expected = JSON.stringify(game.combatSystem.calculateDamagePreview(attacker, defender));
    assert.equal(game.saveGame(), true);
    const restored = h.SaveGameSystem.load(h.document.getElementById('game-canvas'), game);
    const loaded = restored.units.find(u => u.id === attacker.id);
    assert.equal(loaded.getAttackStrength(), 0.7);
    assert.equal(JSON.stringify(restored.combatSystem.calculateDamagePreview(loaded, restored.units.find(u => u.id === defender.id))), expected);
    loaded.health = loaded.maxHealth;
    assert.equal(loaded.getAttackStrength(), 1); assert.equal(loaded.attack, baseAttack);
    restored.destroy();
});

test('AI při plánování nárazu zohledňuje oslabení stejné jednotky', () => {
    const { h, game, attacker, defender } = duel('TEZKY_RYTIR', 'KUSNICI', 'crusaders');
    game.currentScenario = { aiDoctrine: { charge: 'cautious' } };
    game.getValidMoves = () => [{ col: 5, row: 5 }];
    defender.health = 50; defender.defense = 10;
    assert.ok(h.AI.findChargeOpportunity(game, attacker, [defender]));
    attacker.health = 1;
    assert.equal(h.AI.findChargeOpportunity(game, attacker, [defender]), null);
    game.destroy();
});

for (const language of ['cs', 'en']) {
    test(`${language}: panel, hover i dotykový detail ukazují sílu z aktuálních HP`, async () => {
        const h = await createLocalizedHarness(language, { browserView: true }), game = h.newGame();
        const unit = game.units[0]; unit.health = unit.maxHealth / 2;
        const text = h.i18n.t('tooltip.attackStrength', { value: 70 });
        assert.ok(text.includes('70%')); assert.ok(!text.includes('tooltip.'));
        game.view.updateUnitPanel(unit);
        assert.ok(h.document.getElementById('unit-info').innerHTML.includes(text));
        assert.ok(game.view.tooltip.contentForHex(unit).includes(text));
        unit.hasMoved = true; unit.hasAttacked = true; unit.attackCount = 2;
        game.view.orders.tap(unit);
        assert.ok(h.document.getElementById('order-content').innerHTML.includes(text));
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
        }
        catch (error) { failures++; console.error(`✗ ${name}\n${error.stack}`); }
        finally { clearTimeout(timeout); }
    }
    console.log(`\n${tests.length - failures}/${tests.length} combat strength testů.`);
    if (failures) process.exitCode = 1;
})().catch(error => { console.error(error); process.exitCode = 1; });
