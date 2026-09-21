# /// script
# requires-python = ">=3.11"
# dependencies = [
#   "numpy>=2.1,<3",
#   "pillow>=11,<12",
# ]
# ///
"""Fetch a reproducible DMR 5G crop around the Sudoměř battlefield memorial.

This proves that the Bevy terrain path can consume official modern elevation. It
does not claim that present-day relief or land use is a 1420 reconstruction.
"""

from __future__ import annotations

import json
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np
from PIL import Image


SERVICE = "https://ags.cuzk.gov.cz/arcgis2/rest/services/dmr5g/ImageServer/exportImage"
OUTPUT_DIR = Path(__file__).resolve().parents[2] / "assets" / "terrain"
BBOX_WGS84 = (14.0520, 49.2335, 14.0760, 49.2515)
GRID_SIZE = (385, 385)


def download(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "battle-game-poc/0.1"})
    with urllib.request.urlopen(request, timeout=90) as response:
        return response.read()


def main() -> None:
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    parameters = {
        "bbox": ",".join(str(value) for value in BBOX_WGS84),
        "bboxSR": "4326",
        "imageSR": "5514",
        "size": f"{GRID_SIZE[0]},{GRID_SIZE[1]}",
        "format": "tiff",
        "pixelType": "F32",
        "interpolation": "RSP_BilinearInterpolation",
        "f": "json",
    }
    request_url = f"{SERVICE}?{urllib.parse.urlencode(parameters)}"
    response = json.loads(download(request_url))
    if "error" in response:
        raise RuntimeError(json.dumps(response["error"], indent=2))

    tiff_bytes = download(response["href"])
    tiff_path = OUTPUT_DIR / "sudomer_dmr5g.tif"
    tiff_path.write_bytes(tiff_bytes)

    with Image.open(tiff_path) as image:
        elevation = np.asarray(image, dtype=np.float32)
    if elevation.shape != (GRID_SIZE[1], GRID_SIZE[0]):
        raise RuntimeError(f"unexpected raster shape: {elevation.shape}")
    if not np.isfinite(elevation).all():
        raise RuntimeError("raster contains missing or non-finite elevation")

    minimum = float(elevation.min())
    maximum = float(elevation.max())
    normalized = elevation - minimum
    (OUTPUT_DIR / "sudomer_dmr5g.f32le").write_bytes(normalized.astype("<f4").tobytes())

    span = max(maximum - minimum, 0.001)
    preview = np.clip((elevation - minimum) / span * 255.0, 0.0, 255.0).astype(np.uint8)
    Image.fromarray(preview, mode="L").save(OUTPUT_DIR / "sudomer_dmr5g_preview.png")

    metadata = {
        "fixture": "Sudomer modern elevation proof",
        "purpose": "rendering pipeline proof, not a 1420 historical reconstruction",
        "source": "CUZK DMR 5G ImageServer",
        "source_url": "https://ags.cuzk.gov.cz/arcgis2/rest/services/dmr5g/ImageServer",
        "license": "CC BY 4.0 shown by the CUZK Atom portal; attribution required",
        "memorial_reference_wgs84": [14.0640014, 49.2420697],
        "bbox_wgs84": list(BBOX_WGS84),
        "output_extent": response.get("extent"),
        "grid_width": GRID_SIZE[0],
        "grid_height": GRID_SIZE[1],
        "height_datum": "Balt after adjustment (Bpv), per service description",
        "source_spatial_reference": "S-JTSK / Krovak East North (EPSG:5514)",
        "minimum_height_m_bpv": minimum,
        "maximum_height_m_bpv": maximum,
        "stored_heights": "little-endian float32 metres above crop minimum, row-major",
        "vertical_exaggeration": 1.35,
        "request_url": request_url,
    }
    (OUTPUT_DIR / "sudomer_dmr5g.json").write_text(
        json.dumps(metadata, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    print(json.dumps(metadata, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()
