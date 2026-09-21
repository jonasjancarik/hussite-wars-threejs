# Sudoměř historical-map reference

`sudomer_imperial_imprint_1837_crop.png` is a 2,048 × 1,768 px visual crop of
the georeferenced *Císařské otisky stabilního katastru* (Imperial Imprints of
the Stable Cadastre). It covers the requested WGS 84 rectangle
`14.052,49.2335,14.076,49.2515`, centred near `14.0640014,49.2420697`.

The crop was fetched on 2026-09-20 from the public South Bohemian regional
WMTS/MapServer. The service publishes the scanned ÚAZK/ČÚZK cadastral rasters
in S-JTSK (EPSG:5514). The WGS 84 bounds transform to approximately
`-782387.760,-1133367.820,-780375.389,-1131632.447` in that CRS. It is a
reference image only; check the source terms before redistributing it.

## Sources

- Archival sheet record: [Sudomierz (Sudoměř), c7530-1-003 — Imperial Imprint
  of the Stable Cadastre, depicted 1837](https://www.oldmapsonline.org/en/catalog/eab31c55-3155-4c48-a731-ad69e8b04498).
- Official map-service page: [Císařské otisky stabilního katastru — WMTS](https://geoportal.kraj-jihocesky.gov.cz/portal/mapy/ostatni/Cisarske-otisky-WMTS).
  It identifies the public raster service, its ÚAZK source, EPSG:5514, and the
  service URL.
- Reproducible service endpoint: [MapServer metadata](https://gis.kraj-jihocesky.cz/arcgis/rest/services/podkladove/cisarske_otisky/MapServer?f=pjson),
  [crop request](https://gis.kraj-jihocesky.cz/arcgis/rest/services/podkladove/cisarske_otisky/MapServer/export?bbox=-782387.760%2C-1133367.820%2C-780375.389%2C-1131632.447&bboxSR=5514&imageSR=5514&size=2048%2C1768&format=png32&transparent=false&f=image).
- Catalogue context: [ČÚZK Imperial Imprints of the Stable Cadastre, Bohemia](https://geoportal.gov.cz/php/micka/record/basic/CZ-CUZK-COC-R).
  It describes the scanned 1:2,880 archive series and its 1826–1843 extent.

## Visual findings in this crop

- **The decisive water corridor is unambiguous in 1837.** Markovec fills the
  north/centre of the crop; Škaredý fills the south-east. Their closest shores
  are joined by a narrow east–west embankment/causeway, with a small
  constricted land passage at its west end. This is the strongest landform to
  retain when blocking out a Sudoměř encounter.
- **Water and wet ground frame the passage.** Potočný appears north-west of
  Markovec, while additional water continues at the north-east and south-east
  edges. Green riparian/meadow parcels follow the pond margins, so the scene
  should not treat the corridor as dry fields up to both waterlines.
- **The broader ground is agricultural, not an unbroken forest.** Beige
  long-strip arable parcels dominate the north and east. Larger vegetated
  parcels and a clearly tree-symbolled, dark woodland block occur to the
  south-west; they provide a useful visual mass beyond the open-field approach.
- **There is little settlement inside this exact rectangle.** A small group of
  mapped structures sits by the western pinch/road, while the rest of the crop
  is parcelled land, water, dikes, and tracks. Do not invent a dense village on
  the embankment from this source.

## What this does and does not establish for 1420

This is an **1837** cadastral depiction, 417 years after the Battle of
Sudoměř (1420). It is strong evidence for the later mapped arrangement of
pond banks, fields, roads, and land cover, but it cannot establish the exact
1420 width of a road, tree cover, field boundaries, buildings, or water level.

Historical interpretation is separate: the commonly cited battle location is
between Markovec and Škaredý, and a local landscape study notes that both ponds
must predate the 1420 battle. That supports retaining the pond-and-corridor
topology, but it does **not** license copying the blue 1837 water surface as a
1420 reconstruction. In particular, accounts describing Škaredý as drained or
muddy at the battle need a dedicated contemporary/historical source before
being represented in-game.

- [Hana Petková, *Proměny krajiny v okolí Sudoměře* (2026), p. 34](https://theses.cz/id/3gp1vf/BP-Hana_Petkov_.pdf) compares the 1837 map with the modern landscape and discusses the pre-1420 existence of Markovec and Škaredý.
