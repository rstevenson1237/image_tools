---
name: settlement-map
description: Make settlement maps for tabletop RPGs with artgen — a hamlet, village, town, city or castle laid out from plain shapes as a referee's reference, generated from a seed or drawn by hand, and each building's floor plan close up. Roads (highway, street, lane, alley, path, track), water (river, stream, canal, moat, pond, lake, sea) with bridges, walls (curtain, stone, palisade, fence, hedge, drystone, ruined) with towers, gatehouses, gates and drawbridges, buildings (house, inn, smithy, temple, keep, tower, …) with roofs, fields, gardens, woods and squares, trees, and furniture and fixtures in the rooms (beds, tables, hearths, forges, altars, stairs, wells, carts…). Colour or black and white, with a grid; fits a terrain map. Renders SVG and PNG. Use when the user wants a village, town, city, castle, keep, fort, manor, farmstead or market map, a building's interior or floor plan, or wants to change, key or export one.
---

# Settlement maps

A settlement is one file, `art/settlements/<id>/settlement.json`: settings, **roads**, **water**, **walls** (with
towers and gates), **buildings** (each with its **floors**: rooms, doors, windows and furniture), **areas** (fields,
gardens, woods, squares), **trees**, **props** (site fixtures) and an **overlay** of labels and symbols. Every render is
rebuilt from it into `art/settlements/<id>/out/` (gitignored). The user may also open the same file in the image tools
web app (**Settlement Map**), draw on it and save it back: always re-read it (`{{ARTGEN}} settlement show <id>`) before
changing it. CLI: `{{ARTGEN}} settlement …`; the `artgen` MCP server has the same operations as `settlement_*` tools
(images come back inline).

Two views of one file:
- **site**: the whole settlement, buildings blocked out as roofs (or as outlines, or cut away to their ground floor);
- **plan**: one building's floor close up, with walls, doors, windows, stairs and furniture at true size.

Site coordinates are **cells**, x right and y down: 5 ft for a hamlet, village or castle, 10 ft for a town or city
(`settlement show` says). A building's floors use **plan cells** of 5 ft measured from the footprint's top-left corner
before the building is turned by its `angle`. Anywhere a point is asked for you can also give a cell name (`C4`).

## 1. Ask, then create
Ask only what changes the map: what kind (hamlet, village, town, city, castle) and roughly how big; walled or not
(palisade or stone); what water (a river, a lake, a coast, a moat); a castle in it; whether every building needs a floor
plan now or only the ones the party will enter; colour or black and white. If there is a terrain map of the region,
put the settlement on it. Then one of:
```
{{ARTGEN}} settlement new <id> --kind village --title "Brookby" [--seed n]           # generated (roads, buildings, fields, trees)
{{ARTGEN}} settlement new <id> --kind town --wall stone --water river --interiors    # every building with its floors laid out too
{{ARTGEN}} settlement new <id> --kind castle --water moat                              # curtain wall, gatehouse, keep, hall, chapel, outer bailey
{{ARTGEN}} settlement new <id> --kind village --map vale --at 12,20                   # on terrain map "vale", its top-left at map units 12,20
{{ARTGEN}} settlement new <id> --empty --size 60x40                                   # a blank sheet, to draw by hand
{{ARTGEN}} settlement render <id>                                                     # SVG + PNG; open the PNG and look at it
```
Over a terrain map the map's rivers, lakes and sea become the settlement's water, its forest becomes woods, and roads
keep to gentle slopes; the map is drawn under the sheet.

## 2. Shape the layout
Big changes with the generator, then fix things one by one. Render and look after each round.
```
{{ARTGEN}} settlement gen <id> --seed 7                                    # another layout, same settings
{{ARTGEN}} settlement gen <id> --buildings 40 --density 0.8 --streets radial --wall palisade --water lake --trees 0.6 --fields 0.3 --market on --castle off
{{ARTGEN}} settlement building <id> add inn --at 20,14 --size 8x6 --label "The Drowned Rat" --angle 15
{{ARTGEN}} settlement building <id> add temple --at 30,8 --size 8x12 --shape T --roof hip
{{ARTGEN}} settlement building <id> add tower --at 4,4 --size 5x5 --shape circle            # roof: cone; a keep: --roof battlement
{{ARTGEN}} settlement building <id> move b3 --at 22,18 | set b3 --kind shop --stories 2 | rm b3
{{ARTGEN}} settlement road <id> add street --points 0,20,30,18,60,22 --curve smooth --label "Mill Road"
{{ARTGEN}} settlement water <id> add river --points 40,0,38,30,44,60 --width 6             # lines: river stream canal moat; areas: pond lake sea
{{ARTGEN}} settlement wall <id> add stone --points 5,5,55,5,55,45,5,45 --closed --towers round --tower-every 12
{{ARTGEN}} settlement wall <id> gate 0 --at 5,25 --kind gatehouse --drawbridge              # gatehouse | gate | postern | opening
{{ARTGEN}} settlement area <id> add field --points 60,30,78,30,78,44,60,44 --label Barley      # field garden orchard wood scrub marsh graveyard market square yard paddock rubble
{{ARTGEN}} settlement tree <id> scatter tree --area 0,0,20,0,20,12,0,12 --count 25 | tree <id> add boulder --at 12,30
{{ARTGEN}} settlement prop <id> add well --at 28,22 | prop <id> add cart --at 24,20 --angle 90
{{ARTGEN}} settlement road|water|wall|area|tree|prop <id> rm <index>                        # indices from settlement show
```
Generating again replaces everything the generator wrote (origin `gen`) and keeps what was added by hand: if the user
wants "the same village but …", edit — don't regenerate. Bridges are drawn on their own where a road crosses water.
Wall kinds: `curtain` (a castle's thick, crenellated wall), `stone` (a town wall), `palisade`, `fence`, `hedge`,
`drystone` (a field wall), `ruined`.

## 3. Floor plans
```
{{ARTGEN}} settlement interior <id> b3 [--stories 2] [--seed n]      # lay its floors out: rooms by what the building is, doors, windows, stairs, furniture
{{ARTGEN}} settlement render <id> --building b3 [--floor 1]           # the plan of one floor (0 ground, 1 up, -1 cellar)
{{ARTGEN}} settlement room <id> b3 add rect --at 0,0 --size 6x4 --label Kitchen [--level 0]
{{ARTGEN}} settlement connect <id> b3 f0r1 f0r2 [--kind door|secret|locked|portcullis|arch|open]
{{ARTGEN}} settlement door <id> b3 --at 3,8 | window <id> b3 --at 0,2 [--width 1]   # in the outer wall
{{ARTGEN}} settlement fixture <id> b3 add bed --at 1,1.5 [--angle 90] [--size 1x2] [--level 1] | fixture <id> b3 rm 4
{{ARTGEN}} settlement fixtures                                       # every furniture and fixture kind, with its true size
```
Fixtures are placed by their centre and drawn at the kind's true size unless `--size` says otherwise. Stairs climb
toward their angle; put `stairs-up` on one floor and `stairs-down` at the same spot on the next (`spiral-stairs` in a
tower). `settlement check` warns when stairs meet nothing.

## 4. Grid, labels and look
```
{{ARTGEN}} settlement grid <id> 10 [--sub on] | grid <id> none
{{ARTGEN}} settlement style <id> --title "Brookby" --legend on --compass on --ground dirt [--furniture auto]
{{ARTGEN}} settlement label <id> "Old Bridge" --at 40,24 --kind note | label <id> "MARKET" --at 30,20 --kind area
{{ARTGEN}} settlement symbol <id> skull --at 12,8          # {{ARTGEN}} settlement symbols lists the kinds
```
Buildings are numbered in file order on a badge (`building set b3 --number off` hides one, `--number 12` sets it).

## 5. Render and hand over
```
{{ARTGEN}} settlement render <id> [--theme color|bw|both] [--buildings roofs|outline|interior] [--ppu 24] [--fit 280x200mm] [--crop x,y,w,h] [--layers grid=off,numbers=off]
{{ARTGEN}} settlement render <id> --plans                  # the site and every floor of every building
{{ARTGEN}} settlement facts <id>                           # buildings, walls, roads, water and areas as numbers (a key for the adventure text)
```
`--buildings interior` shows every building cut away to its ground floor on the site (good for a castle bailey);
`roofs` blocks them out (good for a town). Give the user the file paths and show the PNG.

## Check, then look
`{{ARTGEN}} settlement check <id>` after every round: errors must be fixed; each warning (buildings on each other, in
water or across a road, a gate far from its wall, furniture outside its building or on other furniture, stairs that
meet nothing) is most likely a mistake.

## Readability rules (check every render)
- **Read at a glance.** Clear streets, buildings squared to them, open space round the important places.
- **Number what matters** (the inn, the temple, the smith, the keep); a long list of houses can go unnumbered.
- **Few props and symbols** on the site; furniture belongs in the floor plans.
- Don't hand-edit the SVG: change `settlement.json` (or use the commands) and re-render.
