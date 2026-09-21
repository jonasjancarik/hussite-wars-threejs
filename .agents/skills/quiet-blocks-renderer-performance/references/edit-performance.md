# Edit performance

Read when changing building edits, automatic growth, scene caches, or integrating
related performance changes. Paths below are relative to the repository root.
For capture commands, timing interpretation, and recorded comparisons, use the
[performance guide](../../../../docs/web-performance.md).

## Start with the current reuse paths

A local edit can affect both semantic planning and later renderer submissions.
Choose the layer responsible for the measured cost before adding another cache.

| Work | Existing implementation to inspect |
| --- | --- |
| Connected building resolution and world-section invalidation | `web/src/world/resolved-world-plan-cache.ts` |
| Prop placement identity, ownership, reusable geometry and instance slots | `web/src/world/three-resolved-props.ts` |
| Façade descriptor reconciliation and partial instance uploads | `web/src/world/three-facade-details.ts` |
| Stable forest-member identity and activation | `web/src/world/vegetation-reconciliation.ts`, `web/src/world/environment.ts` |
| Per-step growth inputs, exact nearest queries and indexed validation | `web/src/world/town-growth.ts` |

A plan-wide signature can skip a complete no-op but still replace the whole
presentation when one object changes. Diff stable semantic IDs and their
renderer-relevant facts within that presentation. Retained objects should keep
their parent attachment, buffers, geometry, and materials. A stable root alone
does not prove resource reuse.

For instance pools, cover removal and slot reuse, capacity exhaustion, ownership
transfer, and final disposal. Preserve borrowed pack/template resources. When
several edits occur before the next render, combine pending attribute update
ranges; a later reconciliation must not erase writes that have not reached the
renderer. Unchanged instances should not dirty their attributes.

## Separate cached identity from first renderer use

A newly created tree may be eligible for caching but still require its first
upload and shadow submission. Do not let a reusable-object flag bypass staging
for new or reactivated objects. Keep unchanged visible vegetation attached and
stage only the required activation work, weighted by descendant render cost.

Shape identity can remain stable when an object moves: generated forest members
use their grove/member role, with position, rotation, and scale updated on the
existing assembly. If changing identity or seed rules changes the deterministic
assembly mix, compare the visual result and object counts and disclose the
change; equal density alone does not establish visual parity.

Include first shadow use in a staged object's cost. Otherwise a later building
edit can trigger several trees' delayed shadow setup in one submission. Use the
existing refresh request and completed-render scheduling; a reveal flag without
an actual shadow refresh is insufficient on tiers that render those shadows.

Cancellation must reconcile from the actual attached, visible, and pending
state, not assume the previous plan finished. Test cancellation between reveal
stages and verify that only the newest plan becomes fully visible.

Hidden objects still consume resources. The current vegetation cache retains
inactive assemblies until renderer disposal; do not describe that as eviction.
Repeatedly toggling the same block tests warm reuse, while planting at new
locations or changing variants tests retention growth. Choose the workload that
matches the cache change, and define a retention or retirement policy before
adding another cache. Do not turn a short lifetime pass into a claim about
arbitrary long sessions.

## Keep semantic optimisation exact

The resolved world plan remains authoritative. Compare incremental results with
a fresh full resolution, including stable IDs, ordering, content hashes and
rendered transforms. Use the union of old and new connected components so
removals, splits, merges and distant roof or entrance anchors remain correct.
A local click does not imply a local semantic consequence.

World-section reuse must account for real dependencies, including town-size
thresholds that introduce props, routes and reserved cells. Update those
invalidation rules whenever a placement rule changes. Fall back to full
resolution when edit metadata or dependency coverage is uncertain; mutable
`Town` object identity is not a revision key.

Growth search has a different cost model from rendering a fixed list of edits.
Prepare shared inputs once per planner step, preserve each distance metric and
tie-break order, and use coordinate indexes for preservation checks. Prefer
step-local caches where possible. Reusing the canonical input snapshot does not
permit skipping authoritative town validation or changing the search space.

Useful regression tests compare incremental and fresh presentations across
seeded edit sequences, and check unchanged object/attribute identities. Add
resolver-call or operation-count checks for scaling; avoid tight wall-clock
assertions as the only regression guard on a loaded machine. A failed timing
check deserves investigation, not an automatic threshold increase or dismissal.

## Verify interacting changes together

When integration is authorised, preserve each subsystem's cleanup and
invalidation during conflict resolution. A shared `dispose` method may need
both the world-plan cache cleanup and the new presenter's disposal; choosing
one side of the conflict can silently discard the other optimisation.

Verify the resulting revision and rerun the affected interaction and lifecycle
checks on the combined source. Isolated branch results do not add up to a
combined speedup. Record the comparison base explicitly if it already contains
some optimisations. Keep full-suite and integration captures for changes whose
combined scope warrants them; ordinary small edits still use proportional checks.

Triage review findings against that actual base. Distinguish newly introduced
problems, integration mistakes, and existing limitations, and record the
reason for accepting or rejecting each material finding. Existing issues must
not be presented as fixed merely because the integration tests passed.

The [September 2026 integration evidence](../../../../docs/performance-evidence/integration-2026-09-19.json)
illustrates the reporting standard: WebGPU improvement, a completed but slower
WebGL2 result, and a separate limitation for long-session vegetation retention.
Use its method and distinctions; remeasure rather than inheriting its timings.
