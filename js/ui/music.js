// Jediný přehrávač pro menu i jednorázový chorál. Aranžmá a licence: audio/README.md.

const Music = {
    audio: null,
    isPlaying: false,
    volume: 0.5,
    enabled: true,
    _wanted: false,
    _request: 0,

    // Inicializace audio elementu
    init() {
        if (!this.audio) {
            this.audio = new Audio('audio/ktoz-jsu-bozi-bojovnici-u-ohne.mp3');
            this.audio.preload = 'none';
            this.audio.volume = this.volume;
            this.audio.addEventListener('play', () => this._setPlaying(this._wanted && !this.audio.paused));
            for (const event of ['pause', 'ended', 'error']) {
                this.audio.addEventListener(event, () => {
                    // Události se doručují později: staré pause nesmí zrušit nové play.
                    if (event === 'pause' && !this.audio.paused) return;
                    if (event === 'ended' && !this.audio.ended) return;
                    this._wanted = false;
                    this._setPlaying(false);
                });
            }
        }
        return this.audio;
    },

    _setPlaying(playing) {
        this.isPlaying = playing;
        // Také zamítnuté play() musí opravit optimistický stav tlačítka v menu.
        window.dispatchEvent(new Event('musicstatechange'));
    },

    _play(loop, restart = false) {
        if (!this.enabled) return false;
        const audio = this.init();
        if (restart) audio.currentTime = 0;
        audio.loop = loop;
        this._wanted = true;
        const request = ++this._request;
        const failed = error => {
            if (request !== this._request) return;
            this._wanted = false;
            this._setPlaying(false);
            console.warn('Audio playback failed:', error);
        };
        try {
            const pending = audio.play();
            if (pending !== undefined) pending.catch(failed);
        } catch (error) {
            failed(error);
            return false;
        }
        return true;
    },

    playMelody(loop = false) {
        return this._play(loop);
    },

    // Zastavení přehrávání
    stop() {
        ++this._request;
        this._wanted = false;
        if (this.audio) {
            this.audio.pause();
            this.audio.currentTime = 0;
        }
        this._setPlaying(false);
    },

    // Nastavení hlasitosti (0-1)
    setVolume(volume) {
        if (!Number.isFinite(volume)) return;
        // Nastavení se načítá ještě před vytvořením audio elementu.
        this.volume = Math.max(0, Math.min(1, volume));
        if (this.audio) this.audio.volume = this.volume;
    },

    setEnabled(enabled) {
        this.enabled = Boolean(enabled);
        if (!this.enabled) this.stop();
        else this._setPlaying(this.isPlaying);
    },

    // Jednorázová hudba pro ruční i scénářovou aktivaci chorálu.
    playChoral() {
        if (this._wanted || (this.audio && !this.audio.paused)) return false;
        // Chorál začíná od začátku, ne uprostřed pozastavené hudby z menu.
        return this._play(false, true);
    },

    // Zapnutí/vypnutí hudby
    toggle() {
        if (this._wanted || (this.audio && !this.audio.paused)) {
            ++this._request;
            this._wanted = false;
            this.audio.pause();
            this._setPlaying(false);
            return false;
        }
        return this._play(true);
    }
};

// Export pro globální použití
window.Music = Music;
