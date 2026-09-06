# Bones, remains, and persistent level state

The September 6 pass adds 91 native game segments in sixteen permanent recipes.
All 19,423 screens and cursors, 395,506 gameplay RNG calls and 80 animations
match. It fixes saved remains and several state transitions exposed by loading
them in a later game. Complete save, restore and death behavior remain open.

## Source review and changes

The complete bones.c file and the relevant complete C function bodies in
save.c, restore.c, end.c, topten.c, mkobj.c, dungeon.c, mklev.c, mon.c,
mondata.c, mkroom.c, shk.c, priest.c, timeout.c, light.c, region.c, engrave.c,
options.c, objnam.c, pickup.c, mthrowu.c and weapon.c were read. The corresponding
startup and travel call sites were checked. Reading a parent function does
not mean all its behavior was ported in this pass. C and frozen files are
unchanged. JSON represents native file encoding; gameplay state and output
are the parity targets.

Bones now retain the cemetery name, role, race, gender, alignment, death
reason, timestamp, discovery coordinates and prior cemetery chain. Ghosts
and undead retain the deceased hero's level, HP and identity. Undead inherit
permanent intrinsic resistances. Petrification leaves a named statue with
the hero's inventory. Slime and other arising branches use their native
creation, inventory, clothing and message order. Unique monster cleanup,
Oracle room repair, leash and punishment cleanup, trap knowledge and the
level eligibility guards follow the reviewed C paths.

Object reset clears knowledge and ordinary names, removes unique invocation
items, handles tins and eggs, and records fruit names needed by the next game.
The restore path checks duplicate artifacts, sanitizes names and repairs food
billing flags. Fruit lookup preserves C's case, prefix and singularization
order. Loaded fruit IDs are remapped to the new game's list without replacing
the new hero's preferred fruit. Option parsing preserves the distinct user
buffer path, name limits, conflicts with food names and replacement before use.
Ghostly bows and boomerangs receive the handedness message once, on pickup.

Restored monsters and objects get fresh IDs in C order. Inventory ownership,
monster weapons, room residents, shop and priest level bindings, timer owners,
light owners and region monster references are rebuilt. Room serialization
avoids resident cycles and preserves shared subroom identity. Local timers and
lights are separated from global state when traveling, then restored and
relinked. Ghostly object ages and timer deadlines shift to the new game clock.

Engravings now use the level's actual engraving chain. Save, restore, forgetting
and sanitation preserve its text, memory, time and order. C save_engravings
rewinds text pointers to their allocation start and leaves them rewound, even
on checkpoints. A native probe exposed the missing leading space after that
operation. A longer native replay then exposed an omitted poisoned missile
call and missing welded monster-weapon feedback. Both are ported at their
original call sites. Their larger parent functions remain partial.

## Native controls

| Permanent recipe | Native segments |
|---|---:|
| bones-cemetery | 2 |
| bones-retain-delete | 3 |
| bones-statue | 2 |
| bones-statue-open | 2 |
| bones-object-reset | 2 |
| bones-statue-lamp | 2 |
| bones-slime | 2 |
| bones-undead | 10 |
| bones-level-eligibility | 16 |
| bones-special-restore | 8 |
| bones-burning-restore | 2 |
| bones-long-replay | 2 |
| bones-engraving-restore | 2 |
| bones-fruit-remapping | 10 |
| bones-weapon-adjustment | 12 |
| fruit-name-initialization | 14 |

The official recorder, input assertions and integrity checks pass for all
sixteen recipes. Each repeats exactly with the instrumented C binary.
Multi-game cases share storage in their original order. Save, Get and Unlink
answers are asserted at their actual native prompts. Earlier candidates
that accidentally declined Get were corrected before promotion. Recorder
processes must run sequentially because they share lock and bones files.

Special-level reloads cover Oracle, Minetown, Juiblex and the Valley. Eligibility
cases cover allowed and disallowed ordinary, special and branch levels. The
Sokoban-junction case is the main-dungeon junction, not a Sokoban level. The
wraith attack causes level drain followed by a ghost; it does not establish
wraith arising. Vampires can immediately take an alternate form, so the state
check observes their original cham identity. The long replay requests 500
waits but combat and death-decline prompts interrupt them. Its C profile enters
rot_corpse and burn_object, with no hatch_egg entry. Egg hatching is not claimed
for this new corpus.

## State checks and deliberate faults

tools/bones-state-gate.mjs passes 91 native replays, 29 written bones, 30 load
boundaries, 25 inventory observations and five floor-fruit observations. It
checks native RNG, final HP, persisted files and deletion choices, cemetery
metadata, death monsters, rooms, destination bounds, shop and priest bindings,
ghostly flags, unique object ownership, monster weapons and timer/light owners.
The floor-fruit check uses the native pickup menu after a real bones load.

There are 89 constructed C-derived groups. They cover byte sanitation,
eligibility guards and RNG order, nested object reset, artifacts, permanent
resistance bits, fruit lookup and limits, one-time handedness, room identity,
icebox ages, timer clocks and ordering, lights, engraving prefixes and memory,
region expiry and monster IDs, and death-reason formatting. Constructed states
earn no native C execution credit.

All sixteen deliberate faults are detected. Fifteen fail state assertions;
omitted welded feedback is caught by native screens. Six faults survive all
sixteen native fixture comparisons but fail state: wrong candle age, retaining
temporary resistance, duplicated subrooms, doubled timer counts, retaining old
remembered engravings and recursively marking contained objects ghostly.
All mutant native runs complete without runtime errors. State failures are
assertions. The final native floor-fruit assertion was added after an omitted
remapping call survived the earlier state gate; the positive gate and that
mutant were rerun and verify the new assertion.

Restoring all 23 previously existing modified runtime modules from c06850cc
fails all sixteen new fixtures. It matches 9,575/19,423 screens,
12,656/19,423 cursors, 196,050/395,506 positional RNG calls and 17/80 animations.
Seven fixtures fail with an undefined locations error. This baseline includes
runtime failures and must not be described as a clean output-only comparison.

## Measured coverage and remaining work

The exact native C union adds 244 direct outcomes and eight entered functions,
reaching 57,364/108,268 outcomes and 4,412/5,491 entered records. New entries
are fix_ghostly_obj, goodfruit, fixuporacle, give_u_to_m_resistances, ghostfruit,
fracture_rock, break_statue and ordin. The new corpus alone observes 22,268
outcomes and enters 2,620 records. The census excludes Lua, macro-internal
conditions and inactive build configurations. It does not measure the fraction
of gameplay implemented or establish interactions between covered branches.

| C function | Union direct outcomes |
|---|---:|
| can_make_bones | 16/22 |
| no_bones_level | 15/18 |
| savebones | 34/48 |
| getbones | 22/40 |
| resetobjs | 41/74 |
| fixuporacle | 2/16 |
| fix_ghostly_obj | 12/14 |
| goodfruit | 2/2 |
| give_u_to_m_resistances | 3/4 |
| fruit_from_name | 32/46 |
| fruitadd | 55/68 |
| ghostfruit | 3/6 |
| getlev | 86/120 |
| restobjchn | 25/32 |
| restmonchn | 32/38 |
| save_timers | 6/8 |
| restore_timers | 6/6 |
| relink_timers | 9/14 |
| rest_regions | 27/32 |
| formatkiller | 17/28 |
| m_throw | 78/134 |
| mon_wield_item | 41/64 |

Native follow-ups remain for Save/Get decline, existing-file replacement,
multiple cemetery deaths, displaced Oracle repair, egg expiry and additional
timer combinations. The preserved eligibility-multiturn candidate has an
Invocation visibility discrepancy and was not promoted. No new unreachable
claims are made.

Source gaps remain in bill objects and shop damage, worm tails, exclusions,
stasis clocks, ghostly branch stair and portal rebinding, and parts of normal
restore ordering. Floor OMONST/OMID repair is later than C's getlev phase.
resetobjs still uses obfree for in-use objects instead of dealloc_obj. The
shared place_object and add_to_container helpers still omit held-state
transitions; this pass ports explicit C sites in bones and statue breaking.
Full Unicode input parity beyond byte-valued strings is unverified. Other
death, missile, weapon, option and monster-name parent paths remain partial.

## Regression evidence

The final existing suite passes 587/587 fixtures. The sixteen new fixtures
also pass at the same functional runtime. Together these cover all 44 public
and 559 supplemental fixtures, matching 779,326 screens and cursors and
14,517,798 RNG calls. Animations match 29,999/30,020, retaining the 21 existing
public misses. These totals combine the two completed runs, not a separately
repeated 603-fixture invocation.

Eighteen related state gates, 60 hang checks, 80 fresh games across thirteen
roles and fourteen tool tests pass. The source audit finds zero issues in 269
non-frozen modules. The branch ledger passes 3,767/3,767 declared cases, with
99 covered and seven partial categories. The fuzz corpus remains 101/102:
491,759 RNG calls and 14,262 cursors match, with 14,261/14,262 screens and
75/76 animations. Its known fixed-date difference is unchanged.

Local evidence is in .cache/bones-overview: official-score.log,
regression-second.log, state-fruit-final.log, mutation-results.json,
related-exits.json, coverage-union-summary.json and remaining.json. Exact C
repeats are in .cache/c-coverage/bones-20260906. The complete faithful port
remains the active goal.
