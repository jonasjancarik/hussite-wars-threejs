"""Stage shared 3D assets at the paths used by the legacy Bevy scenes.

The native Bevy prototypes still resolve their asset root to this experiment's
``assets`` directory. The production copies live under ``assets/3d`` at the
repository root, so legacy build scripts call this helper before packaging.
The staged files are generated compatibility copies and are ignored by Git.
"""

from __future__ import annotations

import json
import shutil
import argparse
from pathlib import Path


SCRIPT = Path(__file__).resolve()
EXPERIMENT_ROOT = SCRIPT.parents[1]
REPOSITORY_ROOT = SCRIPT.parents[3]
SHARED_ROOT = REPOSITORY_ROOT / "assets" / "3d"


def copy_file(source: Path, destination: Path) -> None:
    if not source.is_file():
        raise FileNotFoundError(f"shared asset is missing: {source}")
    destination.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(source, destination)


def stage_models(legacy_root: Path) -> int:
    paths = json.loads((SHARED_ROOT / "model-paths.json").read_text())
    count = 0
    for legacy_name, shared_path in paths.items():
        source = SHARED_ROOT / shared_path
        destination = legacy_root / "models" / f"{legacy_name}.glb"
        copy_file(source, destination)
        count += 1
    return count


def stage_textures(legacy_root: Path) -> int:
    source_root = SHARED_ROOT / "textures"
    destination_root = legacy_root / "textures"
    count = 0
    for source in sorted(source_root.rglob("*")):
        if not source.is_file() or source.name == "README.md":
            continue
        copy_file(source, destination_root / source.relative_to(source_root))
        count += 1
    return count


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--destination",
        type=Path,
        default=EXPERIMENT_ROOT / "assets",
        help="asset root to populate (default: experiments/sudomer-diorama/assets)",
    )
    destination = parser.parse_args().destination
    models = stage_models(destination)
    textures = stage_textures(destination)
    print(f"Staged {models} shared models and {textures} shared textures for legacy Bevy builds")


if __name__ == "__main__":
    main()
