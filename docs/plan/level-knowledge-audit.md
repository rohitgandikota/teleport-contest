# Level names and remembered map knowledge

Named teleport requests exposed a stub that always returned zero. Following
the C resolver then exposed missing saved-level flags, stale annotations,
uncapped map features, missing mapping knowledge and incomplete restore input.
The new five-fixture corpus contains 103 native scenarios. All 30,553 screens
and cursors and 445,313 gameplay RNG calls match. These cases have no animation
frames. This pass does not complete level teleporting, overview or persistence.

## Source and behavior

The complete C bodies for lev_by_name, find_branch, find_level,
find_mapseen_by_str, query_annotation, donamelevel, init_mapseen,
update_lastseentyp, count_feat_lastseentyp and recalc_mapseen were read.
The overview traversal, selection, interest, formatting and annotation helpers
were also read, along with level_tele, savelev, savelev_core, dosave0,
save_currentstate, restgamestate, dorecover, welcome, role_init, set_playmode,
enter_explore_mode and the Unix restore call site. Mapping and attendance
dependencies were checked against their full C bodies. No C or frozen file
changed. Reading a parent body does not establish a complete port of it.

The resolver checks custom names before stripping articles or a terminal
" level" suffix. Duplicate annotations follow the sorted C mapseen chain.
It recognizes special-level aliases and branch connections, allows the main
dungeon and Gehennom pairing, and enforces the saved-level restrictions on
non-wizard requests. Branch names require both endpoints to have been saved.
Floating endpoints are checked before converting an unvisited ledger number.

The initial assumption that VISITED meant only a departed level was wrong.
C sets it inside savelev while writing. This build enables INSURANCE and
defaults checkpoint to On. Startup and level arrival therefore save the
current level. Disabling checkpoint leaves a new current level unvisited
until departure or manual save. Changing the option alone does not save.
The port now stores those facts explicitly in visited_ledgers, independently
of the maps parked in saved_levels. Manual save serializes the set.

Level annotation edits update mapseen immediately. Recalculation uses remembered
terrain, including the hero's current square when it can be felt, and caps
each feature count at three. It tracks mixed altar alignments, unknown Astral
altars, room attendance, subrooms, retained discoveries and resettable flags.
Missing shopkeepers are guarded before testing whether they are in their shop.
Magical mapping updates lastseentyp even without drawing the square and records
discovered rooms. Automatic overview labels, co-aligned deity names, combined
temple-and-altar wording and Quest display depths follow the C formatting.

Restore now repeats the saved level annotation. C's role initialization runs
again and consumes its RNG calls, but the saved quest genders overwrite the
new values afterward. Debug and explore saves remain available until the
keep-save prompt. Normal saves are removed during recovery. Startup debug
mode overrides saved explore mode. Restoring a normal game into explore mode
defers the confirmation until the normal save has been removed.

## Native observations

| Recipe | Cases | Screens/cursors | RNG calls |
|---|---:|---:|---:|
| level-names | 32 | 7,633 | 213,307 |
| level-annotations | 7 | 1,942 | 18,797 |
| level-visits | 24 | 10,588 | 132,076 |
| map-knowledge | 30 | 9,178 | 68,237 |
| level-name-save | 10 | 1,212 | 12,896 |

Assertions identify the final request and its immediate response, after setup
travel. An earlier "materialize" message is not evidence that a later request
succeeded. Quest names resolve, but these native cases then report a mysterious
force preventing descent. They do not establish arrival at the requested Quest
destination. The internal Mines-end name is minend; the earlier mineend input
was discarded. Case variants of rogue have distinct recipe labels.

The checkpoint pairs enter explore mode before reading cursed teleportation
scrolls with teleport control. The option menu search includes a leading space
to distinguish checkpoint from idlecheckpoint. Default current-level cases
are named as checkpoint controls, not as unsaved-level rejection controls.

The first grave wishes targeted sites where C could not always place a grave.
One, two and four attempted sites produced zero, one and two graves. Those
cases retain labels describing attempts. The positive cap control first makes
a fountain, replaces it with floor, and places a grave at each of four sites.
C then reports "Many graves." Sighted and blind mapping both report the
observed fountains and sink. Altar controls include matching, mixed and
unaligned pairs.

The original two-segment save probe restores with startup debug mode. It tests
that override, not the non-wizard visit restriction. A separate sequence keeps
the save, changes Base camp to Temporary camp without saving, restores the
original Base camp into explore mode, deletes the save and starts a fresh game.
That explore restore tests the saved-current-level restriction. Two additional
normal-save pairs accept and decline deferred explore mode. Save replays use
shared storage across segments.

Every permanent recipe was recorded through tools/gen-sessions/record.mjs and
repeated exactly with the instrumented C binary. Independent recording integrity
and branch assertions pass. Constructed states earn no C execution credit.

## State checks and deliberate regressions

The state gate checks 103 native replays, 39 inventory entries, 180 feature
counts, five restores and 65 named-destination decisions at their actual input
boundaries. It also checks hero HP, observed depth, annotations and recursive
object ownership. There are 88 constructed groups for lookup priority and
guards, annotation edits, saved genders, persistence, remembered terrain,
feature caps, altar knowledge, mapping, mimics, rooms, flags and bones knowledge.

The first version checked only final state and missed a deliberately disabled
checkpoint. The accepted/rejected destination observations now detect that
gap. The chosen native restore seeds happened to preserve the same quest
gender even when the saved value was discarded. Constructed controls for
both saved genders close that state-check gap. These corrections are evidence
about test sensitivity, not additional C branch coverage.

All twelve deliberate regressions fail the state gate. Native output checks
give the following results. Positional RNG misses can be large after a single
earlier divergence changes level generation.

| Deliberate regression | Screen misses | Cursor misses | Positional RNG misses |
|---|---:|---:|---:|
| Omit the Delphi alias | 220 | 200 | 195,205 |
| Ignore custom names | 545 | 497 | 120,716 |
| Require only one visited branch endpoint | 170 | 150 | 97,663 |
| Skip checkpoint visit flags | 60 | 60 | 0 |
| Omit immediate annotation synchronization | 666 | 607 | 128,994 |
| Leave feature counts uncapped | 0 | 0 | 0 |
| Count actual instead of remembered terrain | 93 | 70 | 0 |
| Omit magical mapping memory | 2 | 0 | 0 |
| Omit magical mapping room discovery | 0 | 0 | 0 |
| Omit the missing-shopkeeper guard | 0 | 0 | 0 |
| Discard saved quest genders | 0 | 0 | 0 |
| Delete a save the player kept | 126 | 117 | 8,278 |

Four mutants survive all five new native fixtures. The source-derived state
checks detect them; stronger native follow-ups remain open where the state
can affect later visible behavior. The missing-shopkeeper mutant throws in
the constructed empty-shop case. No native mutant fails through an exception.
The exact fourteen prior runtime modules from b6c8181b fail all five fixtures,
with 3,452 screen, 3,150 cursor and 338,017 positional RNG misses.

## Measured coverage and open work

The exact C union adds 120 direct outcomes and one entered function record,
tunesuffix. It reaches 57,076/108,268 outcomes and 4,404/5,491 entered records.
The census excludes Lua, macro-internal conditions and inactive configurations.
It includes startup and shutdown. It is not a percentage of the game ported.

| C function | Observed direct outcomes |
|---|---:|
| lev_by_name | 34/36 |
| find_branch | 16/18 |
| find_mapseen_by_str | 6/6 |
| count_feat_lastseentyp | 37/44 |
| recalc_mapseen | 58/96 |
| query_annotation | 13/24 |
| show_map_spot | 15/20 |
| magic_map_background | 15/20 |
| print_mapseen | 89/148 |
| level_tele | 60/130 |
| restgamestate | 25/44 |
| dorecover | 10/24 |

The exact remaining line, column and outcome records are in remaining.json.
No new unreachable claims are made. Larger level_tele paths still include
menu-prefix behavior, repeated invalid input, Nowhere, single-level branches,
buried punishment, above-dungeon travel and Quest or invocation bounds.
Overview selection, disclosure, endgame ordering, full bones descriptions and
some interest filters remain partial. The full annotation query is not yet
ported. Restore still needs broader option, timer, equipment, engraving,
shop-damage and welcome-message lifecycle review. Regeneration checkpoint
behavior remains open. The cloned bones knowledge here does not establish
complete bones persistence.

The final full sweep passes 583/583 fixtures, 44 public and 539 supplemental,
matching all 742,406 screens/cursors and 13,426,403 RNG calls. The 21 older
public animation misses remain. Fuzz retains its known fixed-date screen
difference, with 101/102 fixtures passing and all 491,759 RNG calls matching.
Eighty fresh games across 13 roles and the source audit, zero findings in
268 modules, pass. Sixteen related state gates, 49 hang cases and 14 tool tests
pass. The initial recipe tags used an unknown generic special-level category;
the corrected official recordings preserve every input and recorded boundary.
The corrected assertion ledger passes 3,619/3,619 cases, with 99 categories
covered and seven partial.
No new judge score is claimed.

Local evidence is in .cache/named-level, including mutation-results.json,
totals.json, verification-exits.json, ledger-final.log and remaining.json.
The full faithful C/Lua port remains the active goal.
