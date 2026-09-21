// FogOfWarSystem - Správa mlhy války a viditelnosti
class FogOfWarSystem {
    constructor(game) {
        this.game = game;
    }

    // Kontrola zda je zvěd skrytý (v lese nebo kopcích)
    isScoutHidden(scout) {
        if (scout.type !== 'ZVED' && scout.type !== 'ZVED_KRIZACI') return false;

        const terrain = this.game.hexGrid.getTerrain(scout.col, scout.row);
        return terrain === 'forest' || terrain === 'hills';
    }

    // Upravená viditelnost nepřítele - respektuje Skrytý pohyb zvěda
    getEnemyVisibilityDistance(observer, target) {
        let visibilityDist = this.getUnitSightRange(observer);

        // Pokud je cíl skrytý zvěd, nepřítel ho vidí jen na 2 hexy
        if (this.isScoutHidden(target) && target.faction !== observer.faction) {
            visibilityDist = Math.min(visibilityDist, 2);
        }

        return visibilityDist;
    }

    // Výpočet viditelnosti pro hráčovu frakci
    updateVisibility() {
        if (!this.game.fogOfWar) return;

        this.game.visibleHexes.clear();
        const playerFaction = 'hussites';

        for (const unit of this.game.units) {
            if (unit.faction !== playerFaction || unit.health <= 0) continue;

            const sightRange = this.getUnitSightRange(unit);

            // Přidej všechny hexy v dosahu viditelnosti.
            // Grid používá offsetové souřadnice (odd-q) - iterujeme proto celý
            // čtverec a filtrujeme přes getDistance. Axiální kosočtverec by na
            // offsetových souřadnicích nechával trvale zamlžené hexy.
            for (let dc = -sightRange; dc <= sightRange; dc++) {
                for (let dr = -sightRange; dr <= sightRange; dr++) {
                    const col = unit.col + dc;
                    const row = unit.row + dr;

                    if (col < 0 || col >= this.game.hexGrid.cols || row < 0 || row >= this.game.hexGrid.rows) continue;

                    const distance = this.game.hexGrid.getDistance(unit.col, unit.row, col, row);
                    if (distance <= sightRange) {
                        if (this.hasLineOfSight(unit.col, unit.row, col, row)) {
                            const key = `${col},${row}`;
                            this.game.visibleHexes.add(key);
                            this.game.exploredHexes.add(key);
                        }
                    }
                }
            }
        }
    }

    // Dosah viditelnosti podle typu jednotky
    getUnitSightRange(unit) {
        let baseVision = 4;

        const template = UnitTypes[unit.type];
        if (template && template.vision) {
            baseVision = template.vision;
        }
        else if (unit.type === 'ZVED' || unit.type === 'ZVED_KRIZACI' || unit.special === 'scout') {
            baseVision = 6;
        }
        else if (unit.unitClass === 'ranged') {
            baseVision = 4;
        }
        else if (unit.unitClass === 'artillery') {
            baseVision = 3;
        }
        else if (unit.unitClass === 'cavalry') {
            baseVision = 4;
        }
        else if (unit.unitClass === 'heavyCavalry') {
            baseVision = 3;
        }
        else if (unit.isWagon && unit.isWagon()) {
            baseVision = 3;
        }
        else if (unit.unitClass === 'commander') {
            baseVision = 4;
        }
        else if (unit.unitClass === 'infantry') {
            baseVision = 3;
        }

        // Terénní modifikátory
        const terrain = this.game.hexGrid.getTerrain(unit.col, unit.row);

        if (terrain === 'hills') {
            baseVision += 1;
        }
        if (terrain === 'forest') {
            baseVision -= 1;
        }

        return Math.max(1, baseVision);
    }

    // Kontrola přímé viditelnosti (line of sight)
    hasLineOfSight(fromCol, fromRow, toCol, toRow) {
        const distance = this.game.hexGrid.getDistance(fromCol, fromRow, toCol, toRow);
        if (distance <= 1) return true;

        // Terén cílového hexu
        const targetTerrain = this.game.hexGrid.getTerrain(toCol, toRow);
        const targetInForest = targetTerrain === 'forest';

        const sourceTerrain = this.game.hexGrid.getTerrain(fromCol, fromRow);
        const sourceInForest = sourceTerrain === 'forest';

        if (targetInForest && !sourceInForest && distance > 2) {
            return false;
        }

        if (distance <= 2) return true;

        // Kontrola prostředních hexů
        const steps = distance;
        for (let i = 1; i < steps; i++) {
            const t = i / steps;
            const midCol = Math.round(fromCol + (toCol - fromCol) * t);
            const midRow = Math.round(fromRow + (toRow - fromRow) * t);

            if (midCol === toCol && midRow === toRow) continue;
            if (midCol === fromCol && midRow === fromRow) continue;

            if (midCol >= 0 && midCol < this.game.hexGrid.cols &&
                midRow >= 0 && midRow < this.game.hexGrid.rows) {
                const terrain = this.game.hexGrid.getTerrain(midCol, midRow);
                if ((terrain === 'forest' || terrain === 'hills') && distance > 3) {
                    return false;
                }
            }
        }
        return true;
    }

    // Kontrola zda je hex viditelný
    isHexVisible(col, row) {
        if (!this.game.fogOfWar) return true;
        return this.game.visibleHexes.has(`${col},${row}`);
    }

    // Kontrola zda byl hex někdy prozkoumán
    isHexExplored(col, row) {
        if (!this.game.fogOfWar) return true;
        return this.game.exploredHexes.has(`${col},${row}`);
    }

    // Kontrola zda je nepřátelská jednotka viditelná
    isEnemyVisible(unit) {
        if (!this.game.fogOfWar) return true;
        if (unit.faction === 'hussites') return true;

        // Kontrola hiddenMovement
        const template = UnitTypes[unit.type];
        if (template && template.abilities && template.abilities.hiddenMovement) {
            const terrain = this.game.hexGrid.getTerrain(unit.col, unit.row);
            if (terrain === 'forest' || terrain === 'hills') {
                // Zjisti, zda ho vidí nějaký husitský zvěd s revealHidden
                const canBeRevealed = this.game.units.some(u => {
                    if (u.faction !== 'hussites' || u.health <= 0) return false;
                    const uTemplate = UnitTypes[u.type];
                    if (uTemplate && uTemplate.abilities && uTemplate.abilities.revealHidden) {
                        const dist = this.game.hexGrid.getDistance(u.col, u.row, unit.col, unit.row);
                        const sightRange = this.getUnitSightRange(u);
                        return dist <= sightRange;
                    }
                    return false;
                });

                if (!canBeRevealed) {
                    // Ostatní jednotky ho vidí jen na 2 hexy
                    const isCloseEnough = this.game.units.some(u => {
                        if (u.faction !== 'hussites' || u.health <= 0) return false;
                        const dist = this.game.hexGrid.getDistance(u.col, u.row, unit.col, unit.row);
                        return dist <= 2;
                    });

                    if (!isCloseEnough) {
                        return false;
                    }
                }
            }
        }

        // Standardní kontrola viditelnosti
        return this.isHexVisible(unit.col, unit.row);
    }
}
