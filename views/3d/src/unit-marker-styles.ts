// Kept with the renderer so the campaign and standalone viewer load the same UI.
export const unitMarkerStyles = `
.three-unit-markers { position:absolute; inset:0; z-index:2; overflow:hidden; pointer-events:none; }
.three-unit-markers[hidden], .three-unit-marker[hidden] { display:none !important; }
.three-unit-marker { position:absolute; top:0; left:0; box-sizing:border-box; width:64px; height:58px;
  margin:0; padding:0; border:0; border-radius:0; min-width:0; min-height:0;
  background:none; box-shadow:none; color:#f2e8d3; text-transform:none; letter-spacing:normal;
  pointer-events:none; font:12px/1.25 Georgia,serif; text-align:center; }
.three-unit-marker:focus-visible { outline:2px solid #f2e8d3; outline-offset:2px; }
.three-unit-marker .marker-flag { display:block; position:relative; width:36px; height:35px;
  margin:0 auto; background:var(--faction); border:1.5px solid #f2e8d3; box-sizing:border-box;
  box-shadow:0 1px 3px #0009; }
.three-unit-marker[data-faction=crusaders] .marker-flag { border-radius:0 0 10px 10px; }
.three-unit-marker[data-commander=true] .marker-flag { height:39px; border-bottom:4px double #f2e8d3; }
.three-unit-marker[data-selected=true] .marker-flag { outline:2px solid #d9bb78; outline-offset:2px; }
.three-unit-marker .marker-icon { width:100%; height:100%; padding:2px; box-sizing:border-box; }
.three-unit-marker .marker-health { display:block; position:relative; margin:3px auto 0;
  width:38px; height:6px; box-sizing:content-box; border:1px solid #28302b; background:#746e5d; }
.three-unit-marker .marker-health-fill { display:block; height:100%; background:var(--health); }
.three-unit-marker .marker-health::after { content:''; position:absolute; inset:0;
  background:repeating-linear-gradient(to right, transparent 0, transparent calc(25% - 1px), #28302b 25%); }
.three-unit-marker .marker-action { display:block; height:9px; font:10px/10px Arial,sans-serif;
  text-shadow:0 1px 2px #000; }
.three-unit-marker .marker-badges { position:absolute; top:0; left:calc(50% + 22px);
  display:flex; flex-direction:column; gap:2px; }
.three-unit-marker .marker-badge { display:block; min-width:15px; height:15px; box-sizing:border-box;
  padding:0 2px; border:1px solid #f2e8d3; font:bold 11px/13px Arial,sans-serif; box-shadow:0 1px 2px #0008; }
.three-unit-marker .marker-leader { position:absolute; left:50%; top:100%; width:1px;
  background:#f2e8d388; transform-origin:top; pointer-events:none; }
@media (prefers-reduced-motion:no-preference) {
  .three-unit-marker .marker-health-fill { transition:width 160ms ease-out; }
}
`;
