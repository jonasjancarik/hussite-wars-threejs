/**
 * A small "Applying…" status shown over the map while a graphics change
 * compiles new shaders. The first frame after such a change blocks the main
 * thread, so the note is painted before it and its spinner is a compositor
 * (transform) animation that keeps turning during the stall.
 */
const STYLE = `
.three-applying-note { position:absolute; left:50%; bottom:18px; z-index:4; transform:translateX(-50%);
  display:flex; align-items:center; gap:8px; padding:6px 12px; pointer-events:none;
  background:rgba(242,232,211,.94); border:1px solid var(--field-ink, #20150d); color:var(--field-ink, #20150d);
  font:0.85rem/1.2 Georgia, serif; box-shadow:0 2px 8px rgba(0,0,0,.18); }
.three-applying-note[hidden] { display:none; }
.three-applying-note span[aria-hidden] { width:12px; height:12px; border-radius:50%;
  border:2px solid currentColor; border-right-color:transparent; animation:three-applying-spin .8s linear infinite; }
@keyframes three-applying-spin { to { transform:rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .three-applying-note span[aria-hidden] { animation:none; } }
`;

export class ApplyingNote {
  private readonly element: HTMLDivElement | null = null;
  private readonly label: HTMLSpanElement | null = null;
  private readonly style: HTMLStyleElement | null = null;

  public constructor(canvas: HTMLCanvasElement, private readonly text: () => string) {
    const parent = canvas.parentElement;
    if (!parent) return;
    const doc = canvas.ownerDocument;
    this.element = doc.createElement("div");
    this.element.className = "three-applying-note";
    this.element.setAttribute("role", "status");
    this.element.hidden = true;
    this.style = doc.createElement("style");
    this.style.textContent = STYLE;
    const spinner = doc.createElement("span");
    spinner.setAttribute("aria-hidden", "true");
    this.label = doc.createElement("span");
    this.element.append(spinner, this.label);
    parent.append(this.style, this.element);
  }

  public show(): void {
    if (!this.element || !this.label) return;
    this.label.textContent = this.text();
    this.element.hidden = false;
  }

  public hide(): void { if (this.element) this.element.hidden = true; }

  public dispose(): void { this.element?.remove(); this.style?.remove(); }
}
