# Vendored Husitské války rules

Source: `husitske-valky` repository, copied from the verified local clone at vendoring time.

Revision: `dbdf61907212476cda816ff2036a9a8d41bf3572`

License: MIT; see `LICENSE`.

The copied files are the browser runtime closure used by the Sudoměř scenario plus Czech/English locale data and the headless view contract. Application bootstrapping, analytics, campaign UI, music, menu code and the original page are intentionally excluded.

`js/core/GameStorage.js` has one compatibility patch: keys are always prefixed with `sudomerHex:` so this prototype cannot read or overwrite the original game’s saves. The rules, scenario data and AI are otherwise unchanged. `MANIFEST.sha256` records every vendored file.
