// CombatSystem - Správa bojové logiky
class CombatSystem {
    constructor(game) {
        this.game = game;
    }

    // Získání validních cílů pro útok
    getValidAttackTargets(unit) {
        const targets = [];

        for (const enemy of this.game.units) {
            if (this.canAttack(unit, enemy)) {
                targets.push({ col: enemy.col, row: enemy.row });
            }
        }

        return targets;
    }

    // Kontrola, zda může jednotka s reach útočit přes spojeneckou jednotku
    canReachThrough(attacker, target) {
        // Najdeme sousedy útočníka
        const attackerNeighbors = this.game.hexGrid.getNeighbors(attacker.col, attacker.row);
        // Najdeme sousedy cíle
        const targetNeighbors = this.game.hexGrid.getNeighbors(target.col, target.row);

        // Hledáme společného souseda, kde je spojenecká jednotka
        for (const an of attackerNeighbors) {
            for (const tn of targetNeighbors) {
                if (an.col === tn.col && an.row === tn.row) {
                    // Našli jsme společný hex - je tam spojenecká jednotka?
                    const unitBetween = this.game.getUnitAt(an.col, an.row);
                    if (unitBetween && unitBetween.faction === attacker.faction) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    // Kontrola, zda může útočník zaútočit na obránce
    canAttack(attacker, defender, { reaction = false } = {}) {
        if (this.game.gameState !== 'playing' || !attacker || !defender) return false;
        if (attacker.health <= 0 || defender.health <= 0) return false;
        if (!this.game.units.includes(attacker) || !this.game.units.includes(defender)) return false;
        if (!attacker.canAttack()) return false;
        if (defender.faction === attacker.faction) return false;
        if (reaction) {
            if (defender.faction !== this.game.currentFaction || attacker.range < 2 || attacker.hasMoved) return false;
        } else if (attacker.faction !== this.game.currentFaction) {
            return false;
        }
        const playerFaction = this.game.currentScenario?.playerFaction || 'hussites';
        if (attacker.faction === playerFaction && !this.game.fogOfWarSystem.isEnemyVisible(defender)) return false;

        const distance = this.game.hexGrid.getDistance(attacker.col, attacker.row, defender.col, defender.row);

        // Normální dosah
        if (distance <= attacker.range) {
            return true;
        }

        // Schopnost reach
        if (attacker.special === 'reach' && distance === 2 && attacker.range === 1) {
            return this.canReachThrough(attacker, defender);
        }

        return false;
    }

    // Provedení útoku
    // Sestaví gameContext (bonusy velitelů, formací, chorálu, mechanik scénáře,
    // okna protiútoku) - jen čtení stavu, žádná mutace. Sdílené mezi reálným
    // útokem (performAttack) a náhledem šancí (calculateDamagePreview), aby se
    // předpověď a skutečnost počítaly ze stejných vstupů.
    buildGameContext(attacker, defender) {
        const attackerBonuses = this.game.getCommanderBonuses(attacker);
        const defenderBonuses = this.game.getCommanderBonuses(defender);
        const attackerFearPenalty = this.game.getEnemyCommanderFearPenalty(attacker);
        const defenderFearPenalty = this.game.getEnemyCommanderFearPenalty(defender);
        const defenderSurrounded = this.getSurroundedPenalty(defender);

        // Bonusy z chorálu (pouze pro husity)
        const choralMods = attacker.faction === 'hussites' ? this.getChoralModifiers() : null;
        const defenderChoralMods = defender.faction === 'hussites' ? this.getChoralModifiers() : null;

        // Bonusy z formace vozové hradby
        const attackerFormation = this.getWagonFormationBonuses(attacker);
        const defenderFormation = this.getWagonFormationBonuses(defender);

        // Speciální mechaniky scénáře
        const scenarioMechanics = this.getActiveScenarioMechanics(attacker, defender);

        return {
            getNeighbors: (col, row) => this.game.hexGrid.getNeighbors(col, row),
            getUnitAt: (col, row) => this.game.getUnitAt(col, row),
            // Velitelské bonusy
            attackerCommanderBonus: attackerBonuses ? attackerBonuses.attack : 0,
            defenderCommanderBonus: defenderBonuses ? defenderBonuses.defense : 0,
            attackerFearPenalty: attackerFearPenalty || 0,
            defenderFearPenalty: defenderFearPenalty || 0,
            // Obklíčení obránce
            defenderSurroundedPenalty: defenderSurrounded ? defenderSurrounded.defensePenalty : 0,
            // Chorál - +50% útok, -20% obrana pro husity
            choralAttackBonus: choralMods ? choralMods.attackBonus : 0,
            choralDefensePenalty: defenderChoralMods ? defenderChoralMods.defensePenalty : 0,
            // Formace vozové hradby
            attackerFormationAttack: attackerFormation.attack,
            attackerFormationDefense: attackerFormation.defense,
            defenderFormationDefense: defenderFormation.defense,
            // Speciální mechaniky scénáře
            nightPenalty: scenarioMechanics.nightPenalty || 0,
            terrainTrapPenalty: scenarioMechanics.terrainTrapPenalty || 0,
            lastStandBonus: scenarioMechanics.lastStandBonus || 0,
            // Okno protiútoku - bonus proti kolísající armádě
            defenderWavering: this.game.wavering && this.game.wavering[defender.faction] || false,
            // WP1: výpad z hradby - +10 % útok, pokud útočník stojí vedle ROZPOJENÉHO
            // vozu A cíl je v kolísající armádě (aplikuje se jen uvnitř okna protiútoku)
            attackerSallyBonus: (this.game.wavering && this.game.wavering[defender.faction] &&
                this.isNextToOpenWagon(attacker)) ? 0.10 : 0
        };
    }

    performAttack(attacker, defender) {
        return this.game.actions.run(() => this.resolveAttack(attacker, defender));
    }

    // Interní část téže akce: pohyb může vyvolat více po sobě jdoucích reakcí.
    // Volající drží actions.busy až do dokončení všech animací.
    async resolveAttack(attacker, defender, options = {}) {
        if (!this.canAttack(attacker, defender, options)) return false;
        const defenderTerrain = this.game.hexGrid.getTerrain(defender.col, defender.row);
        const attackerTerrain = this.game.hexGrid.getTerrain(attacker.col, attacker.row);
        const hasMovedThisTurn = attacker.hasMoved;

        // Zrušit možnost undo - útok je nevratná akce
        this.game.lastMove = null;

        // Animace útoku
        this.game.view.showAttackAnimation(attacker.col, attacker.row, defender.col, defender.row);

        // Zvuk útoku podle dosahu
        if (attacker.range > 1) {
            Sound.playRangedAttack();
        } else {
            Sound.playMeleeAttack();
        }

        // gameContext se staví ve sdílené metodě (stejné bonusy dostane i náhled šancí)
        const gameContext = this.buildGameContext(attacker, defender);

        // Spotřeba útoku, damage i statistiky jsou jedna synchronní změna.
        // Časovače už nikdy nerozhodují, zda jednotka zemřela.
        const result = attacker.attackTarget(defender, defenderTerrain, attackerTerrain, hasMovedThisTurn, gameContext);
        this.trackDamage(attacker, defender, result.damage);
        for (const areaDmg of result.areaDamage || []) {
            this.trackDamage(attacker, areaDmg.unit, areaDmg.damage);
            this.game.addLog(i18n.t(areaDmg.killed ? 'gameLog.areaKill' : 'gameLog.areaHit', {
                attacker: attacker.name, target: areaDmg.unit.name, nearby: defender.name,
                damage: areaDmg.damage, health: areaDmg.unit.health
            }), 'combat');
            if (areaDmg.killed) {
                this.trackUnitDeath(areaDmg.unit, attacker);
                this.game.handleUnitDeath(areaDmg.unit, attacker);
            }
        }
        if (result.killed) {
            this.game.addLog(i18n.t('gameLog.destroyed', { attacker: attacker.name, defender: defender.name, damage: result.damage }), 'combat');
            this.trackUnitDeath(defender, attacker);
            this.game.handleUnitDeath(defender, attacker);
        } else {
            this.game.addLog(i18n.t('gameLog.attacked', { attacker: attacker.name, defender: defender.name, damage: result.damage, health: defender.health }), 'combat');
            const damagePercent = result.damage / defender.maxHealth;
            if (!this.game.isTutorial && damagePercent > 0.3) {
                const moraleResult = defender.reduceMorale(Math.round(damagePercent * 20), 'Těžké zranění');
                if (moraleResult.startedRouting) this.game.addLog(i18n.t('gameLog.moraleBreak', { unit: defender.name }), 'morale');
            }
        }
        if (result.counterDamage > 0) {
            this.trackDamage(defender, attacker, result.counterDamage);
            if (result.attackerKilled) {
                this.trackUnitDeath(attacker, defender);
                this.game.handleUnitDeath(attacker, defender);
            }
            this.game.addLog(i18n.t(result.attackerKilled ? 'gameLog.counterKill' : 'gameLog.counterAttack', {
                defender: defender.name, attacker: attacker.name, damage: result.counterDamage, health: attacker.health
            }), 'combat');
        }
        this.game.updateArmyOverview();
        this.game.updateWaveringState();

        if (!await this.game.actions.wait(300)) return false;
        Sound.playHit();
        this.game.view.showExplosionAnimation(defender.col, defender.row);
        this.showDamageNumber(defender.col, defender.row, result.damage);
        for (const areaDmg of result.areaDamage || []) {
            this.game.view.showExplosionAnimation(areaDmg.unit.col, areaDmg.unit.row);
        }
        if (result.killed) Sound.playDeath();

        if (result.counterDamage > 0) {
            this.game.view.showAttackAnimation(defender.col, defender.row, attacker.col, attacker.row);
            Sound.playMeleeAttack();
            if (!await this.game.actions.wait(200)) return false;
            this.game.view.showExplosionAnimation(attacker.col, attacker.row);
            this.showDamageNumber(attacker.col, attacker.row, result.counterDamage);
            Sound.playHit();
            if (result.attackerKilled) Sound.playDeath();
        }
        if (this.game.isTutorial) {
            this.game.tutorialSystem.triggerTutorialEvent('attack_performed', { attacker, defender, result });
        }
        this.game.deselectUnit();
        this.game.victoryConditionsSystem.checkVictory();
        return true;
    }

    // Obrana vybrané jednotky
    defendSelectedUnit() {
        if (!this.game.selectedUnit || !this.game.canStartAction(this.game.selectedUnit)) return false;

        // Zrušit možnost undo - obrana je nevratná akce
        if (this.game.lastMove && this.game.lastMove.unit === this.game.selectedUnit) {
            this.game.lastMove = null;
        }

        Sound.playDefend();

        this.game.selectedUnit.defend();
        this.game.addLog(i18n.t('gameLog.defensiveStance', { unit: this.game.selectedUnit.name }), 'move');

        // Tutoriál trigger
        if (this.game.isTutorial) {
            this.game.tutorialSystem.triggerTutorialEvent('defend_performed', { unit: this.game.selectedUnit });
        }

        this.game.deselectUnit();
        this.game.render();
    }

    // Náhled šancí před útokem pro tooltip. Deleguje na čistý výpočet z Unit
    // (stejný vzorec jako reálný útok), takže se náhled a skutečnost nikdy
    // nerozejdou. Vrací { min, max, killsCertain, killsPossible, counter } nebo null.
    calculateDamagePreview(attacker, defender) {
        if (!attacker || !defender) return null;
        if (attacker.faction === defender.faction) return null;

        const defenderTerrain = this.game.hexGrid.getTerrain(defender.col, defender.row);
        const attackerTerrain = this.game.hexGrid.getTerrain(attacker.col, attacker.row);
        const gameContext = this.buildGameContext(attacker, defender);

        return attacker.previewAttackOutcome(
            defender, defenderTerrain, attackerTerrain, attacker.hasMoved, gameContext
        );
    }

    // Zobrazení floating damage čísla
    showDamageNumber(col, row, damage, isHeal = false) {
        this.game.view.showDamageNumber(col, row, damage, isHeal);
    }

    // Pomocné metody - získání bonusů a penalizací

    getSurroundedPenalty(unit) {
        const surroundInfo = this.game.checkSurrounded(unit);
        if (!surroundInfo.surrounded) return null;

        return {
            defensePenalty: surroundInfo.level * 10,
            moralePenalty: surroundInfo.level * 5,
            level: surroundInfo.level
        };
    }

    getActiveScenarioMechanics(attacker, defender) {
        const result = { nightPenalty: 0, terrainTrapPenalty: 0, lastStandBonus: 0 };
        if (!this.game.currentScenario || !this.game.currentScenario.specialMechanics) return result;

        const mechanics = this.game.currentScenario.specialMechanics;
        const playerFaction = this.game.currentScenario.playerFaction || 'hussites';
        const enemyFaction = playerFaction === 'hussites' ? 'crusaders' : 'hussites';

        // nightBreakout
        if (mechanics.nightBreakout && this.game.turnNumber >= 3) {
            if (attacker.faction === enemyFaction) {
                result.nightPenalty = 0.2;
            }
        }

        // terrainTrap
        if (mechanics.terrainTrap) {
            const attackerTerrain = this.game.hexGrid.getTerrain(attacker.col, attacker.row);
            if (attacker.isCavalry() && attackerTerrain === 'slope') {
                result.terrainTrapPenalty = 0.3;
            }
        }

        // lastStand
        if (mechanics.lastStand && defender.faction === playerFaction) {
            const defenderTerrain = this.game.hexGrid.getTerrain(defender.col, defender.row);
            if (defenderTerrain === 'hills' || defenderTerrain === 'town' || defenderTerrain === 'trenches') {
                result.lastStandBonus = 0.2;

                const unitType = UnitTypes[defender.type];
                if (unitType && unitType.commanderAbilities && unitType.commanderAbilities.lastStandBonus) {
                    result.lastStandBonus += unitType.commanderAbilities.lastStandBonus / 100;
                }
            }
        }

        return result;
    }

    getChoralModifiers() {
        if (!this.game.choralActive) return null;

        return {
            attackBonus: 0.5,
            defensePenalty: 0.2
        };
    }

    getWagonFormationBonuses(unit) {
        const bonuses = {
            attack: 0,
            defense: 0,
            description: []
        };

        // Bonus za linii vozů
        if (unit.isWagon && unit.isWagon()) {
            const lineInfo = this.game.isInWagonLine(unit);
            if (lineInfo && !unit.breachedTurns) {
                bonuses.defense += lineInfo.defenseBonus;
                bonuses.description.push(`Linie vozů (+${lineInfo.defenseBonus}% obrana)`);
            }
            if (unit.breachedTurns) {
                bonuses.description.push('Průlom! (bez formačního bonusu)');
            }
        }

        // Bonus pro střelce za vozem
        const shooterBonus = this.game.isShooterBehindWagon(unit);
        if (shooterBonus) {
            bonuses.attack += shooterBonus.attackBonus;
            bonuses.defense += shooterBonus.defenseBonus;
            bonuses.description.push(`Střílna (+${shooterBonus.attackBonus} útok, +${shooterBonus.defenseBonus}% obrana)`);
        }

        // WP1: kryt za sepnutou hradbou - NE-vozová jednotka vedle spřáteleného
        // ZAVŘENÉHO vozu dostane obranný bonus ("kryjeme se za vozy").
        // P4: pochodující hradba dává poloviční kryt (váha 0.5).
        const coverWeight = (unit.isWagon && !unit.isWagon()) ? this.isBehindClosedWagon(unit) : 0;
        if (coverWeight > 0) {
            const cover = Math.round(5 * coverWeight);
            bonuses.defense += cover;
            bonuses.description.push(`Kryt za hradbou (+${cover}% obrana)`);
        }

        return bonuses;
    }

    // WP1: kryt za spřáteleným SEPNUTÝM vozem. P4: vrací VÁHU krytu - 1.0 za pevnou
    // zaklíněnou hradbu, 0.5 za pochodující (poloviční kryt), 0 když žádný vůz.
    isBehindClosedWagon(unit) {
        let weight = 0;
        for (const n of this.game.hexGrid.getNeighbors(unit.col, unit.row)) {
            const u = this.game.getUnitAt(n.col, n.row);
            if (u && u.health > 0 && u.faction === unit.faction && u.isWagon() && u.formationClosed) {
                weight = Math.max(weight, u.marching ? 0.5 : 1);
                if (weight === 1) break;
            }
        }
        return weight;
    }

    // WP1: stojí jednotka vedle spřáteleného ROZPOJENÉHO vozu? (výpad z hradby)
    isNextToOpenWagon(unit) {
        if (!unit || unit.isWagon()) return false; // výpad dělá pěchota/jízda, ne vůz sám
        for (const n of this.game.hexGrid.getNeighbors(unit.col, unit.row)) {
            const u = this.game.getUnitAt(n.col, n.row);
            if (u && u.health > 0 && u.faction === unit.faction && u.isWagon() && !u.formationClosed) {
                return true;
            }
        }
        return false;
    }

    // Sledování poškození a úmrtí pro statistiky
    trackDamage(attacker, defender, damage) {
        const playerFaction = this.game.currentScenario?.playerFaction || 'hussites';

        if (attacker.faction === playerFaction) {
            this.game.stats.totalDamage += damage;
            if (!this.game.stats.unitDamage[attacker.id]) {
                this.game.stats.unitDamage[attacker.id] = 0;
            }
            this.game.stats.unitDamage[attacker.id] += damage;
        }

        if (defender.faction === playerFaction) {
            this.game.stats.damageTaken += damage;
        }
    }

    // Sjednoceno (task_cce80430): jediná implementace žije na Game (kde jsou i
    // statistiky a recordLoss). Tato metoda jen deleguje, aby se počítadla -
    // včetně recordLoss pro kroniku - počítala právě jednou bez ohledu na cestu.
    trackUnitDeath(deadUnit, killer) {
        this.game.trackUnitDeath(deadUnit, killer);
    }
}
