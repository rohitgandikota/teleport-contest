# Minetown classification and overview names

Creating a shop or temple region overwrote the level's maze flag in JS.
C preserves it. In Bustling Town, the joined and walled cave initializer
clears that flag. Setting it again changes the padding around the map before
a horizontal flip, shifting the generated level by one column. Removing the
extra assignment fixes the preserved seed-40 reproduction and applies to
every typed region.

The next mismatch was the overview's lighting-store name. C's shop table
carries short annotation names separately from the full shop descriptions.
JS omitted those fields. The existing overview renderer already uses the
annotation when present; copying the twelve C fields fixes all shop types.
General stores retain their full name because their annotation is null.

## Source review and scope

Read complete C bodies for lspo_region, lspo_map, lspo_level_init, mkmap,
get_level_extends, flip_level, flip_level_rnd and shop_string, plus the
complete shtypes table and Bustling Town Lua script. The original Lua and
translated map strings have identical rows. C create_des_coder initializes
the maze flag to zero. Of the seven Minetown scripts, only minetn-5 keeps
mazelevel enabled; minetn-1 and minetn-6 clear it through joined, walled mines
initialization and become cavernous. The other four keep the initial flags.

Only sp_lev.js and shknam.js change at runtime. No C or frozen files change.
The region builder and map-flip parents remain partial. Their missing
behaviors are listed below, independently of this checkpoint's passing tests.

## Native evidence

minetown-map-flags contains 25 games with seeds 31 through 55. The native
makemaz and flip_level_rnd annotations establish all seven variants and all
four orientations. This is not every one of the 28 possible combinations.
Each game maps the town and opens its overview. Permanent recipe assertions
check the actual variant and flip draws, decoded stair locations, the Minetown
heading, and its feature description. Official assertions and recording
integrity pass, and the instrumented C repeat matches exactly.

Before either fix, JS matches 4,368/4,425 screens, 4,424 cursors, and all
136,348 RNG calls. Removing the maze assignment leaves just one screen and
cursor mismatch, the lighting-shop annotation. Both fixes match all 4,425
screens/cursors and 136,348 RNG calls. There are no animation frames here.
The separate eight-game seed-40 bones reproduction now also matches all
1,988 screens/cursors and 63,739 RNG calls.

## State and fault checks

The state gate checks 25 native replays, both level flags, and 50 stair
positions obtained from decoded C maps. Terminal column x corresponds to
map x+1, and terminal row y to map y-1. It also checks that native RNG and
runtime diagnostic logs remain correct.

Constructed controls preserve both input classification flags across lighting,
ordinary rectangular, shop, temple, irregular and arrival-room forms. An
asymmetric boundary checks C's extra non-maze padding and mirrored terrain.
Additional controls render every C shop annotation, the general-store fallback,
and the untended-shop label. The renderer controls use a remote mapseen entry
because show_overview refreshes the current level from actual terrain.
Constructed states earn no C execution coverage credit.

The final gate passes all 25 native replays and 39 constructed groups.
All six deliberate faults fail state assertions. Four survive the native
fixture: forcing non-maze status, clearing the cavern flag, and omitting the
armor or vegetarian-shop annotations. Forcing maze status misses 56 screens;
omitting the lighting annotation misses one screen and cursor. The exact
prior sp_lev.js and shknam.js from f168e862 miss 57 screens and one cursor,
with all RNG calls matching and no runtime errors.

During gate construction, incorrect terminal-coordinate and map-cell identity
assumptions were corrected, and shop controls were moved to remote mapseen
entries. The positive gate and all six mutant state gates were then rerun.
The saved final failures identify the intended classification or shop label.

The full regression passes 606/606 fixtures, 44 public and 562 supplemental,
matching all 786,130 screens/cursors and 14,728,376 RNG calls. Animations remain
29,999/30,020, with the same 21 existing public misses. Bones, bones-links,
overview and level-knowledge state gates, 45 hang checks and 80 fresh games
across thirteen roles pass. The source audit has zero findings in 269 modules.
The assertion ledger passes 3,802/3,802 cases, with 99 covered and seven partial
categories. Fuzz retains its known fixed-date difference: 101/102 fixtures,
all 491,759 RNG calls and 14,262 cursors, 14,261 screens and 75/76 animations.

## Measured coverage and remaining work

The exact C profile adds 17 direct outcomes and no entered functions to the
union, reaching 57,389/108,268 and 4,412/5,491. Selected totals are lspo_region
23/36, lspo_map 98/132, lspo_level_init 4/4, mkmap 13/14, get_level_extends
47/52, flip_level 119/188, flip_level_rnd 6/6, shop_string 4/6 and print_mapseen
113/148. These counts measure execution, not complete implementation.

Open source paths include themed-region room creation, the room-count limit,
the no-contents coder stack, and broader selection handling. get_level_extends
still omits C's horizontal clamps before scanning vertical bounds. flip_level
has additional punishment, guard, drawbridge, trap, timer, exclusion, region,
and display behavior. Native coverage of every shop annotation and every
variant-orientation pair is still incomplete. No new unreachable claim is made.

Local evidence is in .cache/minetown-map: maps-before.log, maps-after.log,
maps-final.log, original-reproduction-after.log, state-final.log,
mutation-results.json, verification-exits.json, regression.log,
coverage-union-summary.json and remaining.json. Exact profiles are in
.cache/c-coverage/minetown-map-20260906. The full faithful port remains active.
