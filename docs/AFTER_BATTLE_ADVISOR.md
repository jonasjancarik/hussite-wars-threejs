# After-battle advisor

Read when changing the battle event record, post-battle findings, or the optional model endpoint.

## What the game does locally

`BattleReviewSystem` records a compact list of moves, attacks, reaction shots and
player turn endings. It stores at most 180 events and saves them with the battle.
The game derives the visible findings itself, including losses, moves into new
firing arcs, cavalry in difficult terrain, attacks on prepared positions, covering
fire and missed bonus objectives. This local review works without a server.

The recorder does not attempt to find an optimal move or replay every possible
alternative. Its wording must describe observed actions rather than claiming that
one unplayed line would certainly have won.

## Optional OpenAI-compatible review

The detailed review is requested only after the player presses its button. Set a
runtime configuration before `js/ui/main.js` runs:

```html
<script>
window.BATTLE_REVIEW_CONFIG = {
    endpoint: "/api/battle-advisor/v1/responses",
    model: "gpt-5.6"
};
</script>
```

The endpoint must accept the OpenAI Responses API request shape. The request uses
strict JSON-schema output and contains a compact structured report, not the save,
browser storage, credentials or arbitrary page content.

The recommended deployment is a same-origin backend route that adds its own
OpenAI-compatible service key. A compatibility key may be supplied as `apiKey` in
the runtime object for a trusted local installation, but browser JavaScript cannot
keep that value secret. Never put an upstream Codex access token, a refresh token,
or the broker's internal key in this configuration.

For Codex Broker, configure a dedicated OpenAI compatibility binding for the game.
The broker's Codex credential remains inside the broker container; the browser
uses only the compatibility route and its separately scoped client key.

## Failure behavior

If configuration is absent, the local findings remain visible and the model button
is hidden. Network, authentication, malformed-output and timeout failures leave the
local report in place and show one non-destructive error. Model output is rendered
as text, never as HTML.
