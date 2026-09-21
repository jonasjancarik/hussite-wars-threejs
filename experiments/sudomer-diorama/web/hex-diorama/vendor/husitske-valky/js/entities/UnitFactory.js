class UnitFactory {
    constructor() {
        this.nextId = 1;
    }

    createUnit(type, col, row) {
        const unit = new Unit(type, col, row, this.nextId++);
        return unit;
    }

    // Vytvoření počáteční sestavy pro husity (mapa 16x10)
    // Rozmanitější sestava podle armada.md
    createHussiteArmy() {
        return [
            // Bojové vozy - vozová hradba (hlavní obranná linie)
            this.createUnit('VOZOVA_HRADBA', 2, 3),
            this.createUnit('VOZOVA_HRADBA', 2, 4),
            this.createUnit('VOZOVA_HRADBA', 2, 5),
            this.createUnit('VOZOVA_HRADBA', 2, 6),

            // Cepníci - útočná pěchota
            this.createUnit('CEPNICI', 3, 3),
            this.createUnit('CEPNICI', 3, 5),

            // Sudličníci - podpora
            this.createUnit('SUDLICNICI', 3, 4),
            this.createUnit('SUDLICNICI', 3, 6),

            // Kopiníci - protijezdcová obrana
            this.createUnit('KOPINICI_HUSITI', 4, 2),
            this.createUnit('KOPINICI_HUSITI', 4, 7),

            // Pavézníci - ochrana střelců
            this.createUnit('PAVEZNICI', 1, 4),
            this.createUnit('PAVEZNICI', 1, 5),

            // Kušiníci - střelci
            this.createUnit('KUSINICI_HUSITI', 0, 3),
            this.createUnit('KUSINICI_HUSITI', 0, 6),

            // Ručničáři - palné zbraně (děs)
            this.createUnit('RUCNICARI', 1, 3),
            this.createUnit('RUCNICARI', 1, 6),

            // Houfnice - těžké dělostřelectvo
            this.createUnit('HOUFNICE', 0, 4),
            this.createUnit('HOUFNICE', 0, 5),

            // Tarasnice - mobilní děla
            this.createUnit('TARASNICE', 1, 2),
            this.createUnit('TARASNICE', 1, 7),

            // Lehká jízda - křídla
            this.createUnit('JIZDA_HUSITI', 0, 1),
            this.createUnit('JIZDA_HUSITI', 0, 8),
        ];
    }

    // Vytvoření počáteční sestavy pro křižáky (mapa 16x10)
    // Tradiční feudální armáda s dominantní jízdou
    createCrusaderArmy() {
        return [
            // Těžcí rytíři - elitní úderná síla
            this.createUnit('TEZKY_RYTIR', 14, 3),
            this.createUnit('TEZKY_RYTIR', 14, 4),
            this.createUnit('TEZKY_RYTIR', 14, 5),
            this.createUnit('TEZKY_RYTIR', 14, 6),

            // Těžkooděnci - podpůrná jízda
            this.createUnit('TEZKOODENCI', 13, 2),
            this.createUnit('TEZKOODENCI', 13, 7),

            // Lehká jízda - průzkum a obchvaty
            this.createUnit('LEHKA_JIZDA', 15, 1),
            this.createUnit('LEHKA_JIZDA', 15, 8),

            // Kopiníci - protijezdcová obrana
            this.createUnit('KOPINICI', 12, 3),
            this.createUnit('KOPINICI', 12, 6),

            // Halapartníci - útočná pěchota
            this.createUnit('HALAPARTNICI', 12, 4),
            this.createUnit('HALAPARTNICI', 12, 5),

            // Pavézníci - ochrana střelců
            this.createUnit('PAVEZNICI_KRIZACI', 13, 4),
            this.createUnit('PAVEZNICI_KRIZACI', 13, 5),

            // Janovští kušiníci - elitní střelci
            this.createUnit('KUSNICI_JANOV', 15, 3),
            this.createUnit('KUSNICI_JANOV', 15, 6),

            // Kušiníci
            this.createUnit('KUSNICI', 15, 4),
            this.createUnit('KUSNICI', 15, 5),

            // Lučištníci - rychlostřelba
            this.createUnit('LUCISTNICI', 14, 2),
            this.createUnit('LUCISTNICI', 14, 7),

            // Polní děla
            this.createUnit('POLNI_DELO', 15, 2),
            this.createUnit('POLNI_DELO', 15, 7),

            // Žoldnéři - veteráni
            this.createUnit('ZOLDNERI', 13, 3),
            this.createUnit('ZOLDNERI', 13, 6),
        ];
    }
}
