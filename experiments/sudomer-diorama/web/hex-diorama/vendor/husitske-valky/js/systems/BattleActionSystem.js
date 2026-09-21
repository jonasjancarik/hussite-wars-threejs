// Jedna rozpracovaná herní akce; časovače patří konkrétní bitvě.
// Změny stavu probíhají před animací. Promise zahrnuje i reakce na akci.
class BattleActionSystem {
    constructor(game) {
        this.game = game;
        this.busy = false;
        this.destroyed = false;
        this.paused = false;
        this.waits = new Set();
    }

    async run(action) {
        if (this.destroyed || this.paused || this.busy || this.game.gameState !== 'playing') return false;
        this.busy = true;
        this.game.updateEndTurnButton();
        let completed = false;
        try {
            const result = await action();
            completed = true;
            return result;
        } finally {
            this.busy = false;
            if (!this.destroyed) {
                this.game.updateEndTurnButton();
                // Až po celé akci včetně reakcí; nikdy nepřepsat ruční save.
                if (completed) this.game.saveGame({ automatic: true });
            }
        }
    }

    // false znamená, že bitva mezitím skončila nebo byla nahrazena.
    wait(ms = 0) {
        if (this.destroyed) return Promise.resolve(false);
        return new Promise(resolve => {
            const pending = { remaining: Math.max(0, ms), timer: null, started: 0, resolve };
            this.waits.add(pending);
            if (!this.paused) this.startWait(pending);
        });
    }

    startWait(pending) {
        pending.started = Date.now();
        pending.timer = setTimeout(() => {
            this.waits.delete(pending);
            pending.resolve(!this.destroyed);
        }, pending.remaining);
    }

    setPaused(paused) {
        if (this.destroyed || this.paused === paused) return;
        this.paused = paused;
        for (const pending of this.waits) {
            if (paused) {
                clearTimeout(pending.timer);
                pending.remaining = Math.max(0, pending.remaining - (Date.now() - pending.started));
            } else {
                this.startWait(pending);
            }
        }
        this.game.updateEndTurnButton();
    }

    destroy() {
        this.destroyed = true;
        for (const pending of this.waits) {
            clearTimeout(pending.timer);
            pending.resolve(false);
        }
        this.waits.clear();
    }
}
