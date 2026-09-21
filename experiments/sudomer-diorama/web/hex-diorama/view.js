(function () {
    'use strict';

    const key = (col, row) => `${col},${row}`;
    class DioramaBattleView {
        constructor(game) {
            this.game = game;
            this.notifications = [];
            this.effects = [];
            this.result = null;
            this.destroyed = false;
            this.pendingMoves = new Set();
            this.inspected = null;
            this.effectCounter = 0;
        }
        destroy() { this.destroyed = true; this.pendingMoves.clear(); }
        render() { this.publish('render'); }
        updateUI() { this.publish('ui'); }
        updateEndTurnButton() { this.publish('ui'); }
        updateArmyOverview() { this.publish('ui'); }
        renderMoraleBar() { this.publish('ui'); }
        updateUnitPanel() { this.publish('ui'); }
        updateChoralButton() { this.publish('ui'); }
        showAIThinking() { this.publish('ai'); }
        startAnimationLoop() {}
        stopAnimationLoop() {}
        centerOnPlayerForces() {}
        centerOnUnit(unit) { this.focusUnitId = unit?.id ?? null; this.publish('camera'); }
        clearLog() { this.publish('log'); }
        addLog() { this.publish('log'); }
        showGameOver(isVictory, message, stats) { this.result = { isVictory, message, stats }; this.publish('result'); }
        factionLabel(faction) { return faction === 'hussites' ? 'Husité' : 'Katolické vojsko'; }
        configureScenario(scenario) { this.scenario = scenario; }
        showPhase() { this.publish('phase'); }
        showPhaseBanner() { this.publish('phase'); }
        updatePhaseDescription() { this.publish('phase'); }
        showSelection() { this.publish('selection'); }
        clearSelection() { this.publish('selection'); }
        showMoveRange() { this.publish('selection'); }
        clearEventNotifications() { this.notifications = []; this.publish('event'); }
        showEventNotification(title, text) { this.notifications.push({ title, text }); this.publish('event'); }
        showAttackAnimation(attackerCol, attackerRow, defenderCol, defenderRow) { this.effect('attack', defenderCol, defenderRow, { attackerCol, attackerRow }); }
        showExplosionAnimation(col, row) { this.effect('explosion', col, row); }
        animateMove(unit, fromCol, fromRow, col, row) {
            this.effect('move', col, row, { unitId: unit.id, fromCol, fromRow });
            return Promise.resolve(!this.destroyed);
        }
        onPauseChange() { this.publish('pause'); }
        inspect(col, row) { this.inspected = { col, row }; this.publish('inspection'); }
        showDamageNumber(col, row, damage, isHeal) { this.effect(isHeal ? 'heal' : 'damage', col, row, { damage }); }
        effect(type, col, row, extra = {}) {
            this.effects.push({ id: `${this.game.turnNumber}:${this.effectCounter++}:${type}:${col},${row}`, type, col, row, ...extra });
            if (this.effects.length > 48) this.effects.shift();
            this.publish('effect');
        }
        legalAttacks(unit) {
            if (!unit) return [];
            return this.game.units.filter(target => target.health > 0 && target.faction !== unit.faction && this.game.combatSystem.canAttack(unit, target)).map(target => ({ unitId: target.id, col: target.col, row: target.row }));
        }
        actions(unit) {
            const playerTurn = this.game.currentFaction === 'hussites' && this.game.gameState === 'playing' && !this.game.isPaused && !this.game.actions.busy;
            return {
                endTurn: playerTurn,
                pause: !this.game.isPaused,
                resume: this.game.isPaused,
                undo: playerTurn && this.game.canUndo(),
                choral: playerTurn && !this.game.choralUsed,
                defend: Boolean(playerTurn && unit?.canAct()),
                wagonFormation: Boolean(playerTurn && unit?.isWagon() && !unit.hasMoved),
                wagonLine: Boolean(playerTurn && unit?.isWagon() && !unit.hasMoved),
                wagonMarch: Boolean(playerTurn && unit?.isWagon() && unit.formationClosed),
                fastForward: this.game.currentFaction === 'crusaders' && !this.game.fastForwardAI
            };
        }
        snapshot() {
            const selected = this.game.selectedUnit;
            const visible = this.game.fogOfWar ? this.game.visibleHexes : new Set([...this.game.hexGrid.hexes.keys()]);
            const units = this.game.units.filter(unit => unit.health > 0 && (unit.faction === 'hussites' || !this.game.fogOfWar || visible.has(key(unit.col, unit.row)))).map(unit => ({
                id: unit.id, type: unit.type, name: unit.name, faction: unit.faction, unitClass: unit.unitClass,
                col: unit.col, row: unit.row, health: unit.health, maxHealth: unit.maxHealth,
                morale: unit.morale, maxMorale: unit.maxMorale, hasMoved: unit.hasMoved, hasAttacked: unit.hasAttacked,
                isDefending: unit.isDefending, isRouting: unit.isRouting, formationClosed: unit.formationClosed, marching: unit.marching
            }));
            const inspectedTile = this.inspected ? this.game.hexGrid.hexes.get(key(this.inspected.col, this.inspected.row)) : null;
            const inspectedUnit = this.inspected ? units.find(unit => unit.col === this.inspected.col && unit.row === this.inspected.row) : null;
            const inspectedSourceUnit = inspectedUnit ? this.game.units.find(unit => unit.id === inspectedUnit.id) : null;
            const damagePreview = selected && inspectedSourceUnit && inspectedSourceUnit.faction !== selected.faction
                ? this.game.combatSystem.calculateDamagePreview(selected, inspectedSourceUnit)
                : null;
            return {
                scenario: this.game.currentScenario?.id || null,
                round: this.game.turnNumber,
                faction: this.game.currentFaction,
                state: this.game.gameState,
                busy: this.game.actions.busy,
                paused: this.game.isPaused,
                aiRunning: this.game.aiRunning,
                tiles: [...this.game.hexGrid.hexes.values()].map(tile => ({ col: tile.col, row: tile.row, terrain: tile.terrain })),
                units,
                selectedUnitId: selected?.id ?? null,
                inspection: inspectedTile ? { col: inspectedTile.col, row: inspectedTile.row, terrain: inspectedTile.terrain, unit: inspectedUnit || null, damagePreview } : null,
                legalMoves: selected ? this.game.getValidMoves(selected) : [],
                legalAttacks: this.legalAttacks(selected),
                marchTargets: selected?.isWagon() ? this.game.getWagonMarchTargets(selected) : [],
                visibleHexes: [...visible], exploredHexes: [...this.game.exploredHexes],
                actions: this.actions(selected), objective: this.game.currentScenario?.victoryConditions?.primary?.description || '',
                result: this.result,
                events: this.effects.filter(event => !this.game.fogOfWar || visible.has(key(event.col, event.row))),
                notifications: [...this.notifications],
                processedEvents: [...this.game.processedEvents], choralActive: this.game.choralActive,
                armyMorale: this.game.armyMorale, log: this.game.log.slice(-12)
            };
        }
        publish() {
            if (this.destroyed || !globalThis.SudomerHexBridge) return;
            globalThis.SudomerHexBridge.publish(this.snapshot());
        }
    }
    globalThis.DioramaBattleView = DioramaBattleView;
})();
