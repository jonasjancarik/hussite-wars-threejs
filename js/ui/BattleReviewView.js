// After-battle advisor UI. All model text is inserted with textContent.
const BattleReviewView = {
    currentRequest: 0,
    activeAbort: null,

    cancel() {
        this.currentRequest++;
        this.activeAbort?.abort();
        this.activeAbort = null;
    },

    text(key, params = {}) {
        return i18n.t(`battleReview.${key}`, params);
    },

    appendList(container, items, className = '') {
        const list = document.createElement('ul');
        if (className) list.className = className;
        for (const item of items) {
            const row = document.createElement('li');
            row.textContent = item;
            list.appendChild(row);
        }
        container.appendChild(list);
    },

    renderAIResult(container, result) {
        container.replaceChildren();
        const heading = document.createElement('h4');
        heading.textContent = result.headline;
        const summary = document.createElement('p');
        summary.textContent = result.summary;
        container.append(heading, summary);
        if (result.strengths.length) {
            const label = document.createElement('strong');
            label.textContent = this.text('strengths');
            container.appendChild(label);
            this.appendList(container, result.strengths);
        }
        if (result.improvements.length) {
            const label = document.createElement('strong');
            label.textContent = this.text('improvements');
            container.appendChild(label);
            this.appendList(container, result.improvements);
        }
        const focus = document.createElement('p');
        focus.className = 'battle-review-next-focus';
        focus.textContent = `${this.text('nextFocus')} ${result.nextFocus}`;
        container.appendChild(focus);
    },

    mount(game, isVictory, stats) {
        this.cancel();
        const section = document.getElementById('gameover-advisor');
        const findingsEl = document.getElementById('battle-review-findings');
        const button = document.getElementById('btn-ai-battle-review');
        const status = document.getElementById('battle-review-status');
        const output = document.getElementById('battle-review-ai-output');
        if (!section || !findingsEl || !button || !status || !output ||
            typeof BattleReviewSystem === 'undefined') return;

        const report = BattleReviewSystem.buildReport(game, isVictory, stats);
        findingsEl.replaceChildren();
        for (const finding of report.findings) {
            const row = document.createElement('li');
            row.className = `battle-review-${finding.tone}`;
            row.textContent = this.text(`findings.${finding.code}`, finding.values);
            findingsEl.appendChild(row);
        }
        output.replaceChildren();
        output.classList.add('hidden');
        status.textContent = '';

        const config = BattleReviewSystem.getRuntimeConfig();
        button.classList.toggle('hidden', !config);
        button.disabled = false;
        button.textContent = this.text('askAdvisor');
        if (!config) {
            status.textContent = this.text('offlineNote');
        }

        button.onclick = async () => {
            this.activeAbort?.abort();
            const controller = new AbortController();
            this.activeAbort = controller;
            const requestId = ++this.currentRequest;
            button.disabled = true;
            status.textContent = this.text('thinking');
            try {
                const language = typeof i18n.getCurrentLanguage === 'function' ? i18n.getCurrentLanguage() : 'en';
                const result = await BattleReviewSystem.requestAIReview(report, language, config, globalThis.fetch, controller.signal);
                if (requestId !== this.currentRequest) return;
                this.renderAIResult(output, result);
                output.classList.remove('hidden');
                status.textContent = this.text('generatedNote');
                button.textContent = this.text('askAgain');
            } catch (error) {
                if (requestId !== this.currentRequest) return;
                console.error('Battle advisor request failed:', error);
                status.textContent = this.text('error');
            } finally {
                if (requestId === this.currentRequest) {
                    this.activeAbort = null;
                    button.disabled = false;
                }
            }
        };
        section.classList.remove('hidden');
    }
};

if (typeof module !== 'undefined' && module.exports) module.exports = BattleReviewView;
