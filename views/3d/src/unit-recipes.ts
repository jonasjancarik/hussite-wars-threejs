import type { UnitSnapshot } from "./types.ts";

export interface FigureRecipe {
  model: string;
  offsets: Array<[number, number]>;
  scale: number;
  /** Horizontal radius required by this figure in the formation's shared hit cylinder. */
  pickRadius?: number;
  rotateOffsetsWithFacing?: boolean;
  /**
   * The model's +X is its direction of travel but it fights from its +Z flank,
   * so at rest and when firing it turns that long side toward the threat.
   */
  broadside?: boolean;
}

/** Extra yaw that turns a broadside model's +Z flank to where +X would face. */
export const BROADSIDE_YAW = Math.PI / 2;

const FIVE_FIGURE_OFFSETS: Array<[number, number]> = [
  [-1.02, 0.5], [0, -0.66], [1.02, 0.5], [-0.52, -0.1], [0.52, -0.1],
];
const CAVALRY_OFFSETS: Array<[number, number]> = [[-0.70, -0.20], [0.70, 0.20]];

function formation(model: string, scale = 1.15, pickRadius = 2.15): FigureRecipe[] {
  return [{ model, offsets: FIVE_FIGURE_OFFSETS, scale, pickRadius }];
}

function cavalry(model: string): FigureRecipe[] {
  return [{ model, offsets: CAVALRY_OFFSETS, scale: 0.98 }];
}

function artillery(model: string): FigureRecipe[] {
  return [
    { model, offsets: [[0, 0]], scale: 1 },
    { model: "artillery_gunner", offsets: [[-0.5, -1.2], [-0.5, 1.2]], scale: 1.05, rotateOffsetsWithFacing: true },
  ];
}

const CIVILIAN_RECIPES: FigureRecipe[] = [
  { model: "civilian_adult", offsets: [[-1.02, 0.5], [0.52, -0.1]], scale: 1.12 },
  { model: "civilian_woman", offsets: [[0, -0.66], [1.02, 0.5]], scale: 1.12 },
  { model: "civilian_child", offsets: [[-0.52, -0.1]], scale: 1.12 },
];

const CLERIC_COMMANDERS = new Set(["PROKOP_HOLY", "JAN_ZELIVSKY", "VACLAV_KORANDA"]);
const CAPTAIN_COMMANDERS = new Set(["JAN_ZIZKA", "ZATECKY_HEJTMAN", "JAN_HVEZDA"]);
const NOBLE_COMMANDERS = new Set([
  "FRIDRICH_MISNENSKY", "BOHUSLAV_SVAMBERK", "ZIKMUND", "FILIPPO_SCOLARI", "HEINRICH_ISENBURG",
  "ERKINGER_SEINSHEIM", "FRIDRICH_SASKY", "BOSO_VITZTHUM", "PETR_STERNBERK", "VILEM_SVIHOVSKY",
  "BRENEK_SVIHOVSKY", "HYNEK_NEKMIRE", "HYNEK_KRUSINA", "JINDRICH_PLUMOV", "DIVIS_BOREK",
  "CENEK_VARTENBERK", "ARNOST_FLASKA", "JINDRICH_BERKA", "HYNEK_PODEBRADY", "VIKTORIN_BOCEK", "JAN_ROHAC",
]);

/** Every game roster type has a deliberate presentation. Unknown types fail loudly in development. */
export function unitRecipe(unit: UnitSnapshot): FigureRecipe[] {
  switch (unit.type) {
    case "CEPNICI": case "CEPNICI_PRASKY": return formation("infantry_flail", 1.15, 2.25);
    case "SUDLICNICI": return formation("infantry_polearm");
    case "PAVEZNICI": case "PAVEZNICI_KRIZACI": return formation("infantry_pavise");
    case "KOPINICI_HUSITI": case "KOPINICI": return formation("infantry_spear");
    case "KUSINICI_HUSITI": case "KUSNICI": case "KUSNICI_JANOV": case "KUSINICI_PRASKY": return formation("infantry_crossbow");
    case "RUCNICARI": return formation("infantry_handgun");
    case "HALAPARTNICI": return formation("infantry_halberd");
    case "ZOLDNERI": return formation("infantry_shield");
    case "LUCISTNICI": return formation("infantry_archer");
    case "POUTNICI": return CIVILIAN_RECIPES;
    case "HOUFNICE": case "HOUFNICE_PRASKY": return artillery("artillery_houfnice");
    case "TARASNICE": case "POLNI_DELO": return artillery("artillery_tarasnice");
    case "BOMBARDA": return artillery("artillery_bombard");
    case "POLNI_OPEVNENI": return [{ model: "field_blockhouse", offsets: [[0, 0]], scale: 1, pickRadius: 2.35 }];
    case "VOZOVA_HRADBA": case "VOZOVA_HRADBA_PRASKY": return [{ model: "war_wagon", offsets: [[0, 0]], scale: 1.05, pickRadius: 3.4, broadside: true }];
    case "JIZDA_HUSITI": case "LEHKA_JIZDA": case "JIZDA_PRASKY":
      return unit.dismounted ? formation("infantry_spear") : cavalry("cavalry_light");
    case "ZVED": case "ZVED_KRIZACI":
      return unit.dismounted ? formation("infantry_shield") : cavalry("cavalry_scout");
    case "SLECHTICKA_JIZDA_HUSITI": case "TEZKY_RYTIR": case "TEZKOODENCI":
      return unit.dismounted ? formation("infantry_dismounted") : cavalry("cavalry_heavy");
    default:
      if (CLERIC_COMMANDERS.has(unit.type)) return [{ model: "commander_cleric", offsets: [[0, 0]], scale: 1.24 }];
      if (CAPTAIN_COMMANDERS.has(unit.type)) return [{ model: "commander_captain", offsets: [[0, 0]], scale: 1.28 }];
      if (NOBLE_COMMANDERS.has(unit.type)) return [{ model: "commander_noble", offsets: [[0, 0]], scale: 1.28 }];
      throw new Error(`No 3D unit recipe for ${unit.type}`);
  }
}

export function recipeSignature(unit: UnitSnapshot): string {
  return `${unit.faction}:${unit.dismounted ? "foot" : "mounted"}:${unitRecipe(unit).map(recipe => recipe.model).join(",")}`;
}
