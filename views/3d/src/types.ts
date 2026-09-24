export interface HexCoord { col: number; row: number }

/** Display facts supplied by the shared 2D renderer; never a second rules engine. */
export interface UnitMarkerPresentation {
  glyphPath: string;
  commander: boolean;
  factionColor: string;
  healthColor: string;
  healthRatio: number;
  moraleLabel: string;
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
  /** A breach this turn: the wagon loses its line bonus, so it holds no chain. */
  breached?: boolean;
  /** A scenario event explicitly forced this cavalry unit to fight on foot. */
  dismounted?: boolean;
  special?: string | null;
  commanderAbilities?: { auraRange?: number } | null;
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

export interface MapFeature {
  kind: string;
  hexes: HexCoord[];
}

export interface BattleSnapshot {
  /** Eased visual movement for a single visible unit; rules still own its target tile. */
  movement?: {
    unitId: number;
    from: HexCoord;
    to: HexCoord;
    /** Smoothstep progress in [0, 1], shared with the 2D token animation. */
    progress: number;
  };
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
  /** Features named by the 2D map's labels, e.g. a fortification over its hexes. */
  features?: MapFeature[];
  units: UnitSnapshot[];
  selectedUnitId: number | null;
  inspection?: (HexCoord & { terrain: string; unit: UnitSnapshot | null }) | null;
  legalMoves: HexCoord[];
  legalAttacks: Array<HexCoord & { unitId: number }>;
  /** Geometric attack reach for the selected unit, including empty tiles. */
  attackRangeHexes?: HexCoord[];
  marchTargets: HexCoord[];
  objectiveHexes?: HexCoord[];
  objectiveKind?: string;
  visibleHexes: string[];
  exploredHexes: string[];
  actions?: Record<string, boolean>;
  objective?: string;
  result?: unknown;
  events: CosmeticEvent[];
  /** Visible, confirmed losses only; omission means a normal banner removal. */
  eliminatedUnitIds?: number[];
  pausedAt?: number;
  /** Confirmed, explored ice breaks from the game; absent in older snapshots/saves. */
  brokenIceHexes?: string[];
}

export interface TerrainSurface {
  readonly group: import("three").Group;
  readonly interactiveMeshes: import("three").Object3D[];
  heightAt(x: number, z: number): number;
  renderedHeightAt?(x: number, z: number): number;
  /** Anisotropic filtering of the ground textures, when the terrain has any. */
  setAnisotropy?(level: number): void;
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
  /** Auto quality moved to another tier. */
  onQualityTier?(tier: "high" | "medium" | "low"): void;
  /** Localized UI text for renderer-owned notes, e.g. "applyingGraphics". */
  localize?(key: string): string;
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
        applyMovement(movement: BattleSnapshot["movement"]): void;
        setActive(active: boolean): void;
        resize(): void;
        frameScene(): void;
        setGridVisible(visible: boolean): void;
        setBannerAvoidance(enabled: boolean): void;
        setBannerDetails(visible: boolean): void;
        setWeatherEnabled(enabled: boolean): void;
        setQuality(level: "auto" | "high" | "medium" | "low"): void;
        setFrameRateTarget(fps: 30 | 60): void;
        qualityTier(): "high" | "medium" | "low";
        setFocusSettings(enabled: boolean, closeupStrength: number, quality: "compact" | "bokeh"): void;
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
