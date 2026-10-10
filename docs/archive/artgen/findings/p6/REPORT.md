# P6 benchmarks (bench/p6)

Price basis (same as artlab): $4/M input (review images), $20/M output (code). Code tokens are estimates (3.5 chars/token); "edit" counts lines new vs the previous version. Review tokens are (w·h)/750 per review sheet.

| Asset | Pass | Version | Score | Δ | Gate | Hygiene | Colours | Code tok | Edit tok | Review tok | Note |
|---|---|---|---|---|---|---|---|---|---|---|---|
| brick-wall | r1 | base.v1 | 6 |  | pass | 9.5 | 5 | 109 | 109 | 1641 | reads instantly as a brick wall in the corridor shot (Wolfenstein-like running bond), tiles cleanly; uniformly bright orange for a crypt, every brick the same wear, no grime |
| brick-wall | r2 | base.v2 | 6.5 | +0.5 | pass | 10 | 5 | 308 | 299 | 1594 | a crypt wall now: the damp lower courses darken in an uneven tide line, bricks catch light on their top edges; the soot near the top barely shows |
| brick-wall | r3 | base.v3 | 6.5 | +0 | pass | 10 | 5 | 446 | 243 | 783 | soot smudges darken the upper courses, damp tide line below, chipped corners; a lived-in crypt wall; the top rows are a little heavy |
| brick-wall | f | finish.v1 (on base.v3) | 6.5 | +0 | pass | 10 | 5 | 109 | 109 | 783 | v3 with orphans and 1 px bands cleaned; same read |
| car | r1 | base.v1 | 6 |  | pass | 10 | 2 | 470 | 470 | 644 | reads as a little car turning at all 8 angles; cabin glass clear; wheels too small to read, no lamps, body one flat red mass |
| car | r2 | base.v2 | 6.5 | +0.5 | pass | 10 | 2 | 555 | 259 | 460 | wheels show at every angle, bumpers and stripe give the long axis; the cabin top is the same red as the body so the roof doesn't separate |
| car | r3 | base.v3 | 7 | +0.5 | pass | 10 | 2 | 647 | 167 | 597 | body / glass / dark roof read as three layers and the sill line holds the silhouette at every angle; reads as a car at 1x in all 8 turns |
| car | f | finish.v1 (on base.v3) | 7 | +0 | pass | 10 | 2 | 113 | 113 | 597 | unchanged in the turn strip: per-slice finishing has little to do on a stack (rotation resamples the pixels) |
| cloak-walker | r1 | base.v1 | 4.5 |  | pass | 9.3 | 13 | 1441 | 1441 | 337 | the stop frames do show the cape swinging on after the body halts, but the cape hangs from the front of the chest behind the torso so only a small red flap shows at the hips, it barely trails while walking (drag too low for the gravity), the stride is tiny and the torso is a slab |
| cloak-walker | r2 | base.v2 | 6 | +1.5 | pass | 9.5 | 13 | 1580 | 510 | 459 | the idea reads now: walking, the cape streams back and ripples; in stop the body halts, the cape swings down and forward past the legs and settles over eight frames; the cape is a heavy blob that touches the left frame edge, no hem, the hood and cape are one flat red mass |
| cloak-walker | r3 | base.v3 | 6.5 | +0.5 | pass | 9.4 | 13 | 1826 | 546 | 565 | a hooded wanderer whose red cape streams and ripples behind the stride; in stop the body plants while the cape drops, swings forward past the legs and settles — the secondary motion reads at 1x; the face under the hood is a blank grey |
| cloak-walker | f | finish.v1 (on base.v3) | 6.5 | +0 | pass | 9.3 | 14 | 232 | 232 | 565 | v3 with a dark eye pixel under the hood and a lit cape rim; same read as v3 |
| explosion | r1 | base.v1 | 4.5 |  | pass | 8 | 5 | 133 | 133 | 190 | flash then a hot cloud on frame 1 reads; after that the fireballs scatter into a vertical column of unrelated bits with no sense of a ball expanding and cooling; frame 0 is a flat pale disc |
| explosion | r2 | base.v2 | 6 | +1.5 | pass | 8 | 5 | 396 | 386 | 330 | reads as one fireball now: swells from a hot core, cools from the rim and rolls into a dark smoke cloud; frame 0 is still a plain disc and the ball only reaches ~14 px, the debris streaks barely show |
| explosion | r3 | base.v3 | 7 | +1 | pass | 9.3 | 2 | 446 | 409 | 469 | a classic pixel explosion: star flash, a hot fireball that swells into a ring and cools from the rim, headed debris arcing out, a dark cloud rising off the top; frame 2 is one big pale mass |
| explosion | f | finish.v1 (on base.v3) | 7 | +0 | pass | 9.3 | 2 | 223 | 223 | 469 | same read as v3: the glints sharpen the flash frames, orphans gone from the cloud; the frame-2 rim barely shows (its lightest step is the fill), so the pale mass stays |
| fire-loop | r1 | base.v1 | 5.5 |  | pass | 8.8 | 6 | 141 | 141 | 325 | reads as fire and loops cleanly with nested bands (dark tips, hot core); the body is a squat bulb with only one tongue, too little licking motion and the hot core is too big |
| fire-loop | r2 | base.v2 | 5 | -0.5 | pass | 9.6 | 5 | 386 | 377 | 592 | worse than v1: the three tongues fuse into a dark clumpy mass, too little hot colour (heat 3.4), and the flame is short — particle tips thin out below the blob threshold so the tongues never lick upward |
| fire-loop | r3 | base.v3 | 6.5 | +1.5 | pass | 9.6 | 6 | 288 | 279 | 1720 | reads as a campfire flame now: tongues lick up and pinch off, nested bands (hot core low, dark rim and tips), seamless loop, embers; the core column is a little stripy and the base is flat |
| fire-loop | f | finish.v1 (on base.v3) | 6.5 | +0 | pass | 9 | 6 | 285 | 285 | 860 | cleaner core column, rounded base corners; the read is v3's: a licking campfire flame, seamless |
| forest | r1 | base.v1 | 4 |  | pass | 9.4 | 2 | 666 | 666 | 522 | layers scroll and wrap, but the far hills are a bright flat blob that fights the foreground, near trunks with disc foliage read as mushrooms, ferns cover half the scene |
| forest | r2 | base.v2 | 5.5 | +1.5 | pass | 9.6 | 3 | 860 | 723 | 466 | now a forest with depth: dark far ridges, tiered pine line, canopy band; trunks are shaded top-to-bottom (wrong cyl axis) with diagonal stripes that read as tape |
| forest | r3 | base.v3 | 6.5 | +1 | pass | 9.6 | 3 | 962 | 314 | 671 | reads as a night forest in three depths and scrolls cleanly with no seams; trunks round with bark; pines separate; canopy a bit uniform |
| forest | f | finish.v1 (on base.v3) | 6.5 | +0 | pass | 9.5 | 4 | 149 | 149 | 671 | lit ridge edge and canopy tops help the far silhouette a little; no change in the read |
| grass-autotile | r1 | base.v1 | 5.5 |  | pass | 9.5 | 9 | 336 | 336 | 1935 | the 47 tiles resolve into a continuous island with lit edges and a cast shadow; in this muted palette grass and dirt are close in tone, and the dirt's pebble clusters repeat per tile |
| grass-autotile | r2 | base.v2 | 6.5 | +1 | pass | 7.8 | 6 | 218 | 209 | 272 | grass on a lighter stone path: edges and islands read clearly, lit rims; dark bare patches inside the grass repeat per tile |
| grass-autotile | r3 | base.v3 | 7 | +0.5 | pass | 7.8 | 6 | 178 | 128 | 315 | grass without the repeating bare patches; islands, lit rims and shadows on the stone path all hold at 1x |
| grass-autotile | f | finish.v1 (on base.v3) | 7 | +0 | pass | 8.1 | 6 | 123 | 123 | 315 | orphan clean-up only; unchanged read |
| house | r1 | base.v1 | 4 |  | FAIL | 10 | 7 | 486 | 486 | 200 | a box with a flat grey lid: the gable along x shows one slope as a single tone, front wall all mid with posts lost, house fills the frame; the window is the only read |
| house | r2 | base.v2 | 3 | -1 | FAIL | 10 | 9 | 802 | 793 | 372 | wrong orientation for this camera: with the 45° oblique the ridge along y projects as a vertical stripe and the overhang hides the gable; roof fills the frame. Back to v1's ridge along x (R12) |
| house | r3 | base.v3 | 6 | +3 | pass | 10 | 8 | 855 | 752 | 545 | reads as a cottage: slate roof in rows, chimney, timber wall with two lit windows and a door; door blends into the wall, windows are flat squares |
| house | f | finish.v1 (on base.v3) | 6.5 | +0.5 | pass | 10 | 9 | 233 | 233 | 545 | mullions make the windows read, the dark doorway separates from the wall; roof rows and chimney hold at 1x |
| imp | r1 | base.v1 | 5.5 |  | pass | 9.3 | 11 | 796 | 796 | 655 | turns cleanly through 8 facings from one model and reads as a horned red creature with wings in the corridor, but it is built like a man in a suit: long straight legs, boxy torso, small head with no neck or hunch, wings dark lumps; not an imp yet |
| imp | r2 | base.v2 | 6 | +0.5 | pass | 8.9 | 13 | 1064 | 790 | 849 | imp proportions now: squat crooked legs, pot belly, big low head with horns and ears, long clawed arms, ribbed wings; from the front the face is a blank red mask and the wings block the shoulders |
| imp | r3 | base.v3 | 6.5 | +0.5 | pass | 8.7 | 13 | 1242 | 390 | 912 | an imp from every side: from the front a grinning mouth with fangs under a brow and horns, wings framing the head; hunched pot-bellied body, long arms, tail and barb in profile; eyes still faint |
| imp | f | finish.v1 (on base.v3) | 6.5 | +0 | pass | 8.6 | 13 | 160 | 160 | 912 | v3 with pale eye points on the front facings and lit horn edges; same read, the face now looks back at you |
| iso-set | r1 | base.v1 | 5 |  | pass | 8 | 7 | 369 | 369 | 741 | floor, wall block and half wall share the ground line and outline; the cobble floor is noise at 32 px, faces flat |
| iso-set | r2 | base.v2 | 5.5 | +0.5 | pass | 9.2 | 4 | 277 | 213 | 445 | flagstone floor better than v1's noise; wall faces are a muddle of dark slabs, a big light slab sits in the middle of every floor diamond |
| iso-set | r3 | base.v3 | 6 | +0.5 | pass | 8 | 4 | 271 | 154 | 643 | cobble wall faces read as coursed stone; floor flags too small: the diamond is fine-grained noise |
| iso-set | u1 | base.v4 | 6.5 | +0.5 | pass | 8.7 | 4 | 259 | 143 | - | a few calm flagstones per diamond: the floor reads as a stone floor at 1x and staggers cleanly; walls keep the coursed cobble faces |
| iso-set | f | finish.v1 (on base.v3) | 6 | -0.5 | pass | 8 | 4 | 120 | 120 | 1286 | lit lip barely shows on the 3-step stone ramp; the floor diamond is still noise |
| iso-set | f2 | finish.v2 (on base.v4) | 6.5 | +0 | pass | 8.7 | 4 | 120 | 120 | 643 | the lip pass on v4: same read as v4, block tops a touch crisper |
| isohero-toon | r1 | base.v1 | 6 |  | pass | 10 | 11 | 619 | 619 | 498 | already above T4's best (5): hooded rogue reads front and back, smooth toon bands, no stair-step speckle on the hood; face blank, a few band specks on the cloak shell, boots read as a block |
| isohero-toon | r2 | base.v2 | 5.5 | -0.5 | pass | 10 | 10 | 777 | 348 | 928 | boots split well and the cloak bands merged, but the hood-rim slab recoloured the lower face green: the face shrank to a mask (regression) |
| isohero-toon | r3 | base.v3 | 6.5 | +1 | pass | 10 | 12 | 847 | 268 | 1359 | face back inside the hood with a hair fringe; front reads as the rogue at 1x, back and sides are the cloak; still no eyes |
| isohero-toon | f | finish.v1 (on base.v3) | 7 | +0.5 | pass | 10 | 13 | 121 | 121 | 1359 | eyes at the projected anchors give the face a read; hood rim lifts the silhouette; 1.5–2 points over artlab's T4 rogue (5) with the same voxel modelling |
| isospider-toon | r1 | base.v1 | 6 |  | pass | 8 | 6 | 484 | 484 | 372 | a spider at every facing (T4 best was 4.5 'a speckled blob'): high knees, spread feet, glossy abdomen with hourglass; legs over-inked where they cross, eyes a red bar |
| isospider-toon | r2 | base.v2 | 6.5 | +0.5 | pass | 8 | 8 | 608 | 289 | 678 | legs now separate with light sides, no dark mesh; abdomen and hourglass strong from the back; eyes/fangs only a dot or two at the front |
| isospider-toon | r3 | base.v3 | 6.5 | +0 | pass | 8 | 9 | 788 | 293 | 983 | dark tips barely show under the outline; same read as v2 |
| isospider-toon | f | finish.v1 (on base.v3) | 6.5 | +0 | pass | 8 | 10 | 145 | 145 | 983 | eyes and a glint make the front read as a face; the rim light lifts the legs but also adds busy light pixels — net even |
| knight-attack | r1 | base.v1 | 5 |  | pass | 9.4 | 12 | 1436 | 1436 | 233 | the IK rig works: a clear anticipation → raise → swing → lunge-contact → recover arc with planted feet, and the trail follows the tip; but the blade and trail leave the frame at the top, the figure is spindly (thin limbs, small cuirass), the red plume reads as a mouth, nothing says 'knight' beyond the helm |
| knight-attack | r2 | base.v2 | 6 | +1 | pass | 8.8 | 12 | 1666 | 843 | 822 | reads as a knight now: helm with crest, cuirass and tabard, kite shield on the back arm; anticipation → raise → swing → held lunge contact → recover is clear and the trail sweeps inside the frame; legs are deeply crouched in every frame, the helm merges with the pauldron, the trail is one flat grey |
| knight-attack | r3 | base.v3 | 6.5 | +0.5 | pass | 9.3 | 12 | 1748 | 549 | 1178 | a readable knight's overhead slash at 1x: upright guard, clear anticipation, raise, swing, a lunging contact held 220 ms and a recovery; the trail stays in frame with a pale leading edge; silhouettes distinct per frame; still a little stiff in the torso |
| knight-attack | f | finish.v1 (on base.v3) | 6.5 | +0 | pass | 9.2 | 12 | 176 | 176 | 589 | v3 with a lit helm and pauldron edge and the blade tip flashing on swing and contact; same read, a little crisper |
| metal-wall | r1 | base.v1 | 5.5 |  | pass | 10 | 5 | 88 | 88 | 1641 | riveted plates read but it is a flat grid of 16 px grey squares, the rust is scattered orange specks, too small and busy for a 64 px wall |
| metal-wall | r2 | base.v2 | 6 | +0.5 | pass | 10 | 4 | 300 | 290 | 1594 | four big riveted plates with lit rivets and brushed streaks read as an iron bulkhead in the corridor; rust is down to one speck, plates are flat grey with no seam shading |
| metal-wall | r3 | base.v3 | 6.5 | +0.5 | pass | 10 | 5 | 549 | 318 | 1566 | iron bulkhead plates with grime gathering at each plate's foot and rust weeping from the rivets — reads as a dungeon/industrial wall in the corridor; plates still flat in the middle |
| metal-wall | f | finish.v1 (on base.v3) | 6.5 | +0 | pass | 10 | 5 | 109 | 109 | 783 | v3 with orphans and 1 px bands cleaned; same read |
| pistol | r1 | base.v1 | 4 |  | pass | 10 | 10 | 616 | 616 | 1200 | the template as it ships: a thin peg of a slide over a lumpy hand, a quarter of the frame; in the corridor shot it is a small post; the flash and recoil read but there is no gun to read them on |
| pistol | r2 | base.v2 | 5.5 | +1.5 | pass | 10 | 14 | 995 | 938 | 1130 | a pistol from behind in a gloved hand now, slide in perspective, recoil kick reads; the flash is a flat orange disc with no rays and frame 1 shows nothing of it; slide top too pale and plain |
| pistol | r3 | base.v3 | 6.5 | +1 | pass | 10 | 14 | 1325 | 491 | 3320 | a first-person pistol that reads in the corridor shot: a six-point star flash with a hot core on frame 0, a smaller flash and sparks on frame 1 while the slide kicks up, settle; serrations and port barely read at 1x |
| pistol | f | finish.v1 (on base.v3) | 6.5 | +0 | pass | 10 | 14 | 148 | 148 | 1660 | v3 with a lit slide edge and a front-sight glint; same read |
| plank | r1 | base.v1 | 6 |  | pass | 9.6 | 3 | 311 | 311 | 3309 | staggered planks with grain and seams read at 1x; seamless; grain highlights are blobby 'smiles' and every plank in a row has the same tone |
| plank | r2 | base.v2 | 6.5 | +0.5 | pass | 9.4 | 3 | 135 | 126 | 2147 | two planks per row with their own tones break the row repeat; softer grain reads as grain; short planks lean toward bricks |
| plank | r3 | base.v3 | 6 | -0.5 | pass | 9.5 | 3 | 135 | 126 | 2294 | wider rows made the planks read as bricks (regression from v2) |
| plank | f | finish.v1 (on base.v2) | 6.5 | +0 | pass | 9.4 | 3 | 123 | 123 | 2294 | on v2 (best); orphan clean-up only |
| skeleton | r1 | base.v1 | 4.5 |  | pass | 10 | 8 | 1018 | 1018 | 2176 | re-recorded after the raster renderer's shadow became a blob under the lower body (engine change during P6a); the read is unchanged: mummy/robot, bones too thick |
| skeleton | r2 | base.v2 | 6 | +1.5 | pass | 9.6 | 8 | 907 | 824 | 860 | reads as a skeleton now: skull with dark sockets, thin limbs with air, walk legible in all 8 facings; ribcage still reads as a vest from the front, embers invisible, sword thin and grey on the floor |
| skeleton | r3 | base.v3 | 6.5 | +0.5 | pass | 9.6 | 11 | 1152 | 616 | 931 | front facing reads as ribs over a dark cavity now; blade reads; skull and sockets clear in s/sw/se; the ember eyes still don't show (1 px sub-voxel), skull top could catch more light |
| skeleton | f | finish.v1 (on base.v3) | 7 | +0.5 | pass | 9.2 | 12 | 187 | 187 | 931 | ember eyes at the projected anchors make the s/sw/se facings read as a skeleton at 1x; lit skull rim; consistent model through 8 facings and the walk |
| sparks | r1 | base.v1 | 4.5 |  | pass | 8.2 | 2 | 116 | 116 | 322 | too few and too small: frame 0 is a dot, mid frames scatter short dashes; no fan shape from the strike point and no arc under gravity readable at 1x |
| sparks | r2 | base.v2 | 5.5 | +1 | pass | 8.1 | 2 | 274 | 265 | 587 | a fan from the strike point reads on frames 2-3 and the arc under gravity shows; the streaks are 1 px and few by the end, the flash is a small blob |
| sparks | r3 | base.v3 | 5.5 | +0 | pass | 8 | 2 | 287 | 250 | 852 | barely changed from v2: the heads shrink below a pixel by frame 2 and the spray only spans ~16 px, so after the flash it is a scatter of short dashes |
| sparks | u1 | base.v4 | 6 | +0.5 | pass | 9.4 | 2 | 306 | 236 | 5112 | a real spray now: a fan of streaks drawing their arcs as they rise and fall to the sides, cooling from pale to deep red; still compact (uses ~2/3 of the frame) and the tips don't stand out from the tails |
| sparks | u2 | base.v5 | 6.5 | +0.5 | pass | 9.4 | 2 | 352 | 255 | 1704 | reads as a sword-strike spark shower at 1x now: the plus flash, then hot pale streaks fanning out both ways and arcing down, cooling only at the end; still compact for a 32 px frame |
| sparks | f | finish.v1 (on base.v3) | 5.5 | -1 | pass | 8 | 2 | 114 | 114 | 852 | the flash reads a touch hotter; the spray itself is v3's thin, short scatter — the base needs to change, not the pixels |
| sparks | f2 | finish.v2 (on base.v4) | 6 | -0.5 | pass | 9.4 | 2 | 302 | 302 | 852 | the lit tips add a little sparkle but the read is v4's: frames 2-3 are a clump of crossing streaks near the strike point |
| sparks | f3 | finish.v3 (on base.v5) | 6.5 | +0 | pass | 9.4 | 2 | 302 | 302 | 852 | v5 with lit streak tips and the flash glint: each spark leads with its hottest pixel; same read as v5 |
| spider-walk | r1 | base.v1 | 5.5 |  | pass | 9.1 | 6 | 804 | 804 | 190 | reads as a spider from above and the legs step (planted feet slide back, lifted ones swing forward), but the front feet clip the top edge, the legs are pale thick sticks that outshine the body, no eyes, the gait is hard to follow because every leg is the same tone |
| spider-walk | r2 | base.v2 | 6 | +0.5 | pass | 8.9 | 7 | 1003 | 378 | 330 | darker, thinner legs and ember eyes make it a spider rather than a beetle; the lighter lifted legs show the alternating gait; front feet still touch the top edge, the abdomen marking is a smear, no fangs |
| spider-walk | r3 | base.v3 | 6.5 | +0.5 | pass | 8.6 | 7 | 1169 | 312 | 469 | a cave spider from above at 1x: fangs, ember eyes, hourglass on the abdomen, eight thin legs stepping in an alternating gait (lifted legs lighter), feet inside the frame; the lit ridge is faint and the abdomen nearly touches the bottom edge |
| spider-walk | f | finish.v1 (on base.v3) | 6.5 | +0 | pass | 8.7 | 7 | 130 | 130 | 469 | v3 with brighter eyes and an abdomen glint; same read |
| stone | r1 | base.v1 | 6 |  | pass | 8.6 | 3 | 311 | 311 | 3555 | flagstone slabs with continuous 1px cracks and per-slab tone, lit from the height field; seamless; the lightest slabs land on the same spots per tile — a faint lattice at 3x3 |
| stone | r2 | base.v2 | 6.5 | +0.5 | pass | 8.9 | 3 | 132 | 122 | 2306 | smaller slabs with more relief: rocky ground with lit slab edges, no single light slab marks the period; busy but even |
| stone | r3 | base.v3 | 6.5 | +0 | pass | 9 | 3 | 137 | 128 | 1707 | calmer: several slabs per tile, lit edges, cracks continuous; reads as stone ground at 1x and in 3x3 with no landmark |
| stone | f | finish.v1 (on base.v3) | 6.5 | +0 | pass | 9 | 3 | 123 | 123 | 1707 | orphan clean-up only; unchanged read |
| wood-wall | r1 | base.v1 | 5.5 |  | pass | 9.2 | 3 | 164 | 164 | 1641 | vertical planks with dark joints read; the grain is noisy speckle, plank joints chop the boards into short pieces, nothing holds the boards together |
| wood-wall | r2 | base.v2 | 6 | +0.5 | pass | 9 | 6 | 282 | 238 | 1594 | the iron strap makes it a wall; boards wider and grain calmer; butt joints still break some boards and the grain is still a little speckled |
| wood-wall | r3 | base.v3 | 6.5 | +0.5 | pass | 8.9 | 6 | 463 | 368 | 783 | a plank wall framed by two riveted iron straps, calmer grain; still a few butt joints |
| wood-wall | f | finish.v1 (on base.v3) | 6.5 | +0 | pass | 8.9 | 6 | 109 | 109 | 783 | v3 with orphans and 1 px bands cleaned; same read |

## Per asset

| Asset | Target | r1 | Best revision | Finish | From revisions | From finish | Output tok | Review tok | Est. cost | Target met |
|---|---|---|---|---|---|---|---|---|---|---|
| brick-wall | 6.5 | 6 | 6.5 (base.v3) | 6.5 | +0.5 | +0 | 760 | 4801 | $0.034 | yes |
| car | 6.5 | 6 | 7 (base.v3) | 7 | +1 | +0 | 1009 | 2298 | $0.029 | yes |
| cloak-walker | 6.5 | 4.5 | 6.5 (base.v3) | 6.5 | +2 | +0 | 2729 | 1926 | $0.062 | yes |
| explosion | 6.5 | 4.5 | 7 (base.v3) | 7 | +2.5 | +0 | 1151 | 1458 | $0.029 | yes |
| fire-loop | 6.5 | 5.5 | 6.5 (base.v3) | 6.5 | +1 | +0 | 1082 | 3497 | $0.036 | yes |
| forest | 6.5 | 4 | 6.5 (base.v3) | 6.5 | +2.5 | +0 | 1852 | 2330 | $0.046 | yes |
| grass-autotile | 6.5 | 5.5 | 7 (base.v3) | 7 | +1.5 | +0 | 796 | 2837 | $0.027 | yes |
| house | 6.5 | 4 | 6 (base.v3) | 6.5 | +2 | +0.5 | 2264 | 1662 | $0.052 | yes |
| imp | 6.5 | 5.5 | 6.5 (base.v3) | 6.5 | +1 | +0 | 2136 | 3328 | $0.056 | yes |
| iso-set | 6.5 | 5 | 6.5 (base.v4) | 6.5 | +1.5 | +0 | 1119 | 3758 | $0.037 | yes |
| isohero-toon | 6 | 6 | 6.5 (base.v3) | 7 | +0.5 | +0.5 | 1356 | 4144 | $0.044 | yes |
| isospider-toon | 6 | 6 | 6.5 (base.v3) | 6.5 | +0.5 | +0 | 1211 | 3016 | $0.036 | yes |
| knight-attack | 6.5 | 5 | 6.5 (base.v3) | 6.5 | +1.5 | +0 | 3004 | 2822 | $0.071 | yes |
| metal-wall | 6.5 | 5.5 | 6.5 (base.v3) | 6.5 | +1 | +0 | 805 | 5584 | $0.038 | yes |
| pistol | 6.5 | 4 | 6.5 (base.v3) | 6.5 | +2.5 | +0 | 2193 | 7310 | $0.073 | yes |
| plank | 6.5 | 6 | 6.5 (base.v2) | 6.5 | +0.5 | +0 | 686 | 10044 | $0.054 | yes |
| skeleton | 6.5 | 4.5 | 6.5 (base.v3) | 7 | +2 | +0.5 | 2645 | 4898 | $0.072 | yes |
| sparks | 6.5 | 4.5 | 6.5 (base.v5) | 6.5 | +2 | +0 | 1840 | 11133 | $0.081 | yes |
| spider-walk | 6.5 | 5.5 | 6.5 (base.v3) | 6.5 | +1 | +0 | 1624 | 1458 | $0.038 | yes |
| stone | 6.5 | 6 | 6.5 (base.v3) | 6.5 | +0.5 | +0 | 684 | 9275 | $0.051 | yes |
| wood-wall | 6.5 | 5.5 | 6.5 (base.v3) | 6.5 | +1 | +0 | 879 | 4801 | $0.037 | yes |

Totals: 31825 output tok, 92380 review tok, est. $1.006. Average gain from revisions 1.36, from the finishing pass 0.07. 21/21 assets at or above target.
