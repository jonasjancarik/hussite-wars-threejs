export interface HexCoord { col: number; row: number }

export interface UnitSnapshot extends HexCoord {
  id: number;
  type: string;
  name: string;
  faction: "hussites" | "crusaders";
  unitClass: string;
  health: number;
  maxHealth: number;
  morale: number;
  maxMorale: number;
  hasMoved: boolean;
  hasAttacked: boolean;
  isDefending: boolean;
  isRouting: boolean;
  formationClosed: boolean;
  marching: boolean;
}

export interface CosmeticEvent extends HexCoord {
  id: string;
  type: "attack" | "explosion" | "move" | "damage" | "heal";
  unitId?: number;
  fromCol?: number;
  fromRow?: number;
  damage?: number;
}

export interface BattleSnapshot {
  protocolVersion: number;
  generation: number;
  revision: number;
  scenario: string | null;
  round: number;
  faction: "hussites" | "crusaders";
  state: string;
  busy: boolean;
  paused: boolean;
  aiRunning: boolean;
  tiles: Array<HexCoord & { terrain: "plains" | "water" | "mud" | "dam" }>;
  units: UnitSnapshot[];
  selectedUnitId: number | null;
  inspection: (HexCoord & { terrain: string; unit: UnitSnapshot | null }) | null;
  legalMoves: HexCoord[];
  legalAttacks: Array<HexCoord & { unitId: number }>;
  marchTargets: HexCoord[];
  visibleHexes: string[];
  exploredHexes: string[];
  actions: Record<string, boolean>;
  objective: string;
  result: unknown;
  events: CosmeticEvent[];
  pausedAt?: number;
}

export interface LandscapePolygon {
  id: string;
  points: Array<[number, number]>;
}

export interface LandscapePlacement {
  id: string;
  kind: string;
  position: [number, number];
  rotation?: number;
  scale?: number;
}

export interface LandscapeData {
  version: number;
  scenario: string;
  scenarioRevision: string;
  artSeed: number;
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  pond: LandscapePolygon;
  mudBasin: LandscapePolygon;
  causeway: { points: Array<[number, number]>; width: number };
  fields: Array<LandscapePolygon & { tone: "gold" | "stubble" | "earth"; rotation: number }>;
  woodlandMasses: Array<LandscapePolygon & { density: number }>;
  clearings: LandscapePolygon[];
  landmarks: LandscapePlacement[];
}

declare global {
  interface Window {
    SudomerHexBridge?: {
      sendCommand(raw: string): string;
      current(): { generation: number; revision: number };
      takeSnapshot(): string;
    };
    SudomerHexRenderer?: {
      frameScene(): void;
      setGridVisible(visible: boolean): void;
      setEffectsEnabled(enabled: boolean): void;
      diagnostics(): Record<string, unknown>;
    };
  }
}
