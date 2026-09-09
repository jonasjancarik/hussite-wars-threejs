// Dotykový přesun je přímý. Útok má náhled a potvrzení, které znovu ověří pravidla.
class BattleOrders {
    constructor(view) {
        this.view = view;
        this.game = view.game;
        this.pending = null;
        this.inspectedHex = null;
        this.panel = document.getElementById('battle-order');
        this.marker = document.getElementById('order-marker');
        const signal = view.eventAbortController.signal;
        document.getElementById('order-confirm').addEventListener('click', () => this.confirm(), { signal });
        document.getElementById('order-cancel').addEventListener('click', () => this.cancel(), { signal });
        document.getElementById('btn-next-unit').addEventListener('click', () => {
            if (this.isCompact()) BattlePanels.closeCompactPanels();
            this.cancel(); this.game.selectNextUnit();
        }, { signal });
        document.getElementById('btn-clear-selection').addEventListener('click', () => {
            if (this.isCompact()) BattlePanels.closeCompactPanels();
            this.cancel(); this.game.deselectUnit();
        }, { signal });
    }

    isCompact() { return document.getElementById('game-container').classList.contains('compact-battle'); }

    intent(hex) {
        const unit = this.game.selectedUnit;
        if (!unit || !this.game.canStartAction(unit) || this.game.currentFaction !== 'hussites') return null;
        const target = this.game.getUnitAt(hex.col, hex.row);
        if (target && target.faction !== unit.faction && this.game.fogOfWarSystem.isEnemyVisible(target) &&
            this.game.combatSystem.canAttack(unit, target)) return { kind: 'attack', targetId: target.id };
        if (!target) {
            // Pochod je jeden existující rozkaz celé linii, ne běžný pohyb vozu.
            if (unit.isWagon() && unit.marching && unit.formationClosed && !unit.hasMoved) {
                const direction = this.game.hexGrid.directionTo(unit.col, unit.row, hex.col, hex.row);
                if (direction !== -1 && this.game.getWagonMarchTargets(unit).some(t => t.col === hex.col && t.row === hex.row)) return { kind: 'march' };
                return null;
            }
            if (this.game.canMoveTo(unit, hex.col, hex.row)) return { kind: 'move' };
        }
        return null;
    }

    tap(hex) {
        if (!hex || !this.game.canStartAction() || this.game.currentFaction !== 'hussites') return;
        if (this.isCompact()) BattlePanels.closeCompactPanels();
        this.cancel();
        const unit = this.game.getUnitAt(hex.col, hex.row);
        if (unit?.faction === 'hussites' && unit.canAct()) {
            this.game.handleHexClick(hex);
            return;
        }
        const intent = this.intent(hex);
        if (intent?.kind === 'move' || intent?.kind === 'march') {
            // Stejná pravidla, animace, undo a autosave jako při běžném kliknutí.
            // Gesta a kompatibilní click už filtruje BattleMapInput.
            this.game.handleHexClick(hex);
            return;
        }
        const html = this.view.tooltip.contentForHex(hex);
        if (!html && !intent) return;
        if (intent) this.pending = { ...intent, hex: { ...hex }, unit: this.game.selectedUnit,
            turn: this.game.turnNumber, fromCol: this.game.selectedUnit.col, fromRow: this.game.selectedUnit.row };
        this.inspectedHex = { ...hex };
        document.getElementById('order-title').textContent = i18n.t(`touch.${intent?.kind || 'inspect'}`);
        document.getElementById('order-hint').textContent = i18n.t(intent ? 'touch.confirmHint' : 'touch.inspectHint');
        const outcome = document.getElementById('order-outcome');
        outcome.textContent = '';
        if (intent?.kind === 'attack') {
            const preview = this.game.combatSystem.calculateDamagePreview(this.game.selectedUnit, unit);
            if (preview) {
                const range = damage => damage.min === damage.max ? `${damage.min}` : `${damage.min}–${damage.max}`;
                outcome.textContent = `${unit.name}: ${i18n.t('touch.damage', { damage: range(preview) })}`;
                if (preview.counter) outcome.textContent += ` · ${i18n.t('tooltip.counterattack', { damage: range(preview.counter) })}`;
                if (preview.counter?.killsAttackerPossible) outcome.textContent += ` · ${i18n.t('tooltip.deathRisk')}`;
            }
        }
        document.getElementById('order-content').innerHTML = html;
        if (!html) document.getElementById('order-content').textContent = i18n.t('touch.unexplored');
        document.getElementById('order-details').open = !intent;
        const confirm = document.getElementById('order-confirm');
        confirm.textContent = intent ? i18n.t(`touch.${intent.kind}`) : '';
        confirm.classList.toggle('hidden', !intent);
        confirm.disabled = !intent;
        this.panel.classList.remove('hidden');
        this.positionMarker();
    }

    confirm() {
        const pending = this.pending;
        const valid = pending && pending.unit === this.game.selectedUnit && pending.turn === this.game.turnNumber &&
            pending.fromCol === pending.unit.col && pending.fromRow === pending.unit.row;
        const current = valid ? this.intent(pending.hex) : null;
        const allowed = current && current.kind === pending.kind && current.targetId === pending.targetId;
        this.cancel(); // odstranit ještě před zahájením asynchronní akce / druhým klepnutím
        if (allowed) this.game.handleHexClick(pending.hex);
    }

    refresh() {
        if (this.inspectedHex && (!this.game.canStartAction() || this.game.currentFaction !== 'hussites' ||
            (this.pending && (this.game.selectedUnit !== this.pending.unit || this.game.turnNumber !== this.pending.turn)))) this.cancel();
        const selected = this.game.selectedUnit;
        if (!selected && this.isCompact() && document.getElementById('unit-panel').classList.contains('expanded')) {
            BattlePanels.closeCompactPanels();
        }
        const label = document.getElementById('compact-unit-name');
        label.textContent = selected ? selected.name : i18n.t('touch.noUnit');
        document.getElementById('btn-clear-selection').disabled = !selected || !this.game.canStartAction();
        document.getElementById('btn-next-unit').disabled = !this.game.canStartAction() || this.game.currentFaction !== 'hussites';
        document.getElementById('btn-unit-sheet').disabled = !selected;
    }

    positionMarker() {
        if (!this.inspectedHex) return;
        const pos = this.game.hexGrid.hexToPixel(this.inspectedHex.col, this.inspectedHex.row);
        const scale = this.view.mapInput?.scale || 1;
        this.marker.style.left = `${pos.x * scale}px`;
        this.marker.style.top = `${pos.y * scale}px`;
        this.marker.style.width = `${this.game.hexGrid.hexSize * 1.6 * scale}px`;
        this.marker.style.height = `${this.game.hexGrid.hexSize * 1.6 * scale}px`;
        this.marker.classList.remove('hidden');
    }

    cancel() {
        this.pending = null;
        this.inspectedHex = null;
        this.panel.classList.add('hidden');
        this.marker.classList.add('hidden');
    }
}
