import type { BattleSnapshot, CosmeticEvent } from "./types.ts";

export interface SnapshotConsumer {
  applySnapshot(snapshot: BattleSnapshot, newEvents: CosmeticEvent[]): void | Promise<void>;
}

export interface AcceptedSnapshot { snapshot: BattleSnapshot; newEvents: CosmeticEvent[] }

export class SnapshotAccumulator {
  private generation = -1;
  private revision = -1;
  private seenEvents = new Set<string>();

  public accept(snapshot: BattleSnapshot): AcceptedSnapshot | null {
    if (snapshot.protocolVersion !== 1) return null;
    if (snapshot.generation < this.generation) return null;
    if (snapshot.generation === this.generation && snapshot.revision <= this.revision) return null;
    if (snapshot.generation !== this.generation) {
      this.generation = snapshot.generation;
      this.revision = -1;
      this.seenEvents.clear();
    }
    this.revision = snapshot.revision;
    const newEvents = snapshot.events.filter(event => {
      const key = `${snapshot.generation}:${event.id}`;
      if (this.seenEvents.has(key)) return false;
      this.seenEvents.add(key);
      return true;
    });
    if (this.seenEvents.size > 512) this.seenEvents = new Set([...this.seenEvents].slice(-256));
    return { snapshot, newEvents };
  }
}

export class SnapshotClient {
  private latest: BattleSnapshot | null = null;
  private consumer: SnapshotConsumer | null = null;
  private readonly accumulator = new SnapshotAccumulator();

  public constructor() {
    addEventListener("sudomer-snapshot", this.onSnapshot as EventListener);
    const queued = window.SudomerHexBridge?.takeSnapshot();
    if (queued) this.accept(JSON.parse(queued) as BattleSnapshot);
  }

  public connect(consumer: SnapshotConsumer): void {
    this.consumer = consumer;
    if (this.latest) void consumer.applySnapshot(this.latest, []);
  }

  public dispose(): void {
    removeEventListener("sudomer-snapshot", this.onSnapshot as EventListener);
    this.consumer = null;
  }

  public current(): BattleSnapshot | null { return this.latest; }

  private readonly onSnapshot = (event: CustomEvent<BattleSnapshot>): void => { this.accept(event.detail); };

  private accept(snapshot: BattleSnapshot): void {
    const accepted = this.accumulator.accept(snapshot);
    if (!accepted) return;
    this.latest = accepted.snapshot;
    void this.consumer?.applySnapshot(accepted.snapshot, accepted.newEvents);
  }
}
