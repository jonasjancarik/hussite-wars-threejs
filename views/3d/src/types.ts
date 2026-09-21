export interface HexCoord { col: number; row: number }

/** Display facts supplied by the shared 2D renderer; never a second rules engine. */
export interface UnitMarkerPresentation {
  glyphPath: string;
  commander: boolean;
  factionColor: string;
  healthColor: string;
  healthRatio: number;
  moraleText: string;
  moraleColor: string;
  badges: Array<{ id: string; text: string; label: string; color: string }>;
  actionAvailable: boolean;
  actionText: string;
}

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
  special?: string | null;
  presentation?: UnitMarkerPresentation;
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
  seed?: number;
  cols?: number;
  rows?: number;
  round: number;
  faction: "hussites" | "crusaders";
  state: string;
  busy: boolean;
  paused: boolean;
  aiRunning: boolean;
  fogOfWar?: boolean;
  tiles: Array<HexCoord & { terrain: string }>;
  units: UnitSnapshot[];
  selectedUnitId: number | null;
  inspection?: (HexCoord & { terrain: string; unit: UnitSnapshot | null }) | null;
  legalMoves: HexCoord[];
  legalAttacks: Array<HexCoord & { unitId: number }>;
  marchTargets: HexCoord[];
  objectiveHexes?: HexCoord[];
  objectiveKind?: string;
  visibleHexes: string[];
  exploredHexes: string[];
  actions?: Record<string, boolean>;
  objective?: string;
  result?: unknown;
  events: CosmeticEvent[];
  pausedAt?: number;
}

export interface TerrainSurface {
  readonly group: import("three").Group;
  readonly interactiveMeshes: import("three").Object3D[];
  heightAt(x: number, z: number): number;
  renderedHeightAt?(x: number, z: number): number;
}

export interface BattleTerrain extends TerrainSurface {
  readonly layout: import("./hex-coordinates.ts").HexLayout;
  readonly bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  readonly terrainTypes: readonly string[];
  updateVisibility(snapshot: BattleSnapshot): void;
  dispose(): void;
}

export interface BattleScenery {
  readonly group: import("three").Group;
  build(): Promise<void>;
  updateVisibility(snapshot: BattleSnapshot): void;
  dispose(): void;
}

export interface IntegratedRendererOptions {
  snapshot: BattleSnapshot;
  assetBase?: string;
  artManifestBase?: string;
  onHex?(coord: HexCoord): void;
  onHover?(coord: (HexCoord & { clientX: number; clientY: number }) | null): void;
  onContext?(): void;
  onZoom?(percentage: number): void;
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

export interface ScenarioArtManifest extends LandscapeData {
  renderer: "authored-sudomer-v1";
  sourceTerrainHash: string;
  preset?: string;
}

declare global {
  interface Window {
    HussiteBattle3D?: {
      create(canvas: HTMLCanvasElement, options: IntegratedRendererOptions): Promise<{
        applySnapshot(snapshot: BattleSnapshot): void;
        setActive(active: boolean): void;
        resize(): void;
        frameScene(): void;
        setGridVisible(visible: boolean): void;
        setBannerAvoidance(enabled: boolean): void;
        focusHex(col: number, row: number): void;
        zoomBy(factor: number): void;
        diagnostics(): Record<string, unknown>;
        resetDiagnostics(): void;
        dispose(): void;
      }>;
    };
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
      resetDiagnostics(): void;
    };
  }
}
