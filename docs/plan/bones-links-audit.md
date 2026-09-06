# Reconnecting bones to the new dungeon

A Mines level loaded from another game retained its original exit destination.
In the first C case, the old game entered the Mines from dungeon level 2 and
the new game entered from level 3. C returned to level 3; JS generated level 2.
Repairing the destination restores the native RNG stream and subsequent map.

## Source and implementation

The complete getlev, getbones, rest_stairs, save_stairs, reset_oattached_mids
and Is_branchlev C bodies were read. This change ports the ghostly branch
repair block inside getlev. It runs after region restoration and before timer
and light relinking. Temporary fruit records are released before the repair.

At a branch's first level, either endpoint can identify the current level.
For BR_STAIR, BR_NO_END1 and BR_NO_END2, C skips stairs whose destination stays
in the current dungeon and rewrites the first staircase leading out. For a
portal branch, it rewrites the portal destination and panics if the required
portal is absent. A level with no current branch discards dangling portals.
A matching branch outside its first level enters neither repair arm.

The separate missing-stair repair between Medusa and the Castle tests getlev's
lev argument. getbones calls getlev with lev=0, so that arm does not run at
this call site. The broader getlev implementation remains partial. No C or
frozen file was edited; bones.js is the only changed runtime module.

## Native and state evidence

bones-branch-stairs contains four death/load pairs: 31 to 32, 33 to 31,
32 to 33, and 31 to 31. The three cross-seed cases change the parent depth
in both directions; the last is an unchanged-destination control. Native
wizard menus establish each game's branch depths. Each save, load and unlink
answer is checked at the actual native prompt. Wizard mapping reveals the
exit before teleporting to it and climbing. The final native overview and
status identify the returned level.

bones-quest-eligibility contains two more game segments. Quest home rejects
bones on death, and the following game has no Get prompt. This is an
eligibility control. It does not exercise native portal repair.

The two official recipes pass input assertions and recording integrity checks.
Both instrumented C re-recordings are exact. All 2,379 screens/cursors and
74,230 RNG calls match; these cases contain no animation frames.

tools/bones-links-state-gate.mjs checks all ten native replays, four restored
exit destinations and four actual return levels. Twelve constructed C-derived
groups check both branch endpoints, all staircase branch types, skipping local
stairs, preserving later stairs, unchanged branch records, portal repair,
missing cross-branch stairs, the first-level guard and dangling portal removal.
One group checks the explicit missing-portal panic and is a diagnostic state,
not a playable native case. Constructed groups earn no C coverage credit.

All seven deliberate faults fail state assertions. Four survive both native
fixtures: repairing past the entry level, omitting portal repair, retaining a
dangling portal, and deleting a portal at a matching branch outside its entry.
Omitted stair repair, reversed endpoints and rewriting a local staircase also
fail native output. All native mutant runs complete without runtime errors.
The portal-retention assertion was strengthened to report an assertion failure
before dereferencing a wrongly deleted trap; the positive gate and that mutant
were rerun.

The exact prior bones.js from 9cdc2fbd fails the stair fixture and passes the
Quest eligibility fixture. Across both it matches 2,276/2,379 screens,
2,306/2,379 cursors and 22,729/74,230 positional RNG calls, with no runtime
errors. The baseline misses 103 screens, 73 cursors and 51,501 RNG positions.

## Coverage, regression and remaining work

The C union adds eight direct outcomes and no new entered functions, reaching
57,372/108,268 outcomes and 4,412/5,491 entered records. getlev itself remains
at 86/120 outcomes. Its branch repair was already covered in earlier C runs;
the new cross-game inputs expose an incorrect destination that those tests
did not observe. Line and branch coverage alone cannot establish correct
state across different dungeon layouts.

The complete regression run passes 605/605 fixtures: 44 public and 561
supplemental, with all 781,705 screens/cursors and 14,592,028 RNG calls matching.
Animations match 29,999/30,020, retaining 21 existing public misses. Bones,
overview and level-knowledge state gates, 46 hang checks, and 80 fresh games
across thirteen roles pass. The source audit has zero findings in 269 modules.
The ledger passes 3,777/3,777 cases, with 99 covered and seven partial categories.
Fuzz remains 101/102 with its known fixed-date screen difference: all 491,759
RNG calls and 14,262 cursors match, along with 14,261 screens and 75/76 animations.

An earlier candidate used seed 40 before loading any bones. Its Minetown map
differs by 27 screens despite matching RNG. That independent generation gap is
preserved in .cache/bones-links/mines-including-seed40.input.json and the
corresponding session file. It is not promoted as a passing fixture and is the
next source investigation. The first attempt to locate unseen stairs also
failed in native C; mapping corrected the input before final recording.

Native portal repair and additional restore ordering remain unverified.
Object deallocation, bills and shop damage, worm tails, exclusions, stasis
clocks, bone-file identity and normal restore paths remain open. The prior
[bones audit](bones-audit.md) retains their details. Local evidence is in
.cache/bones-links, including regression.log, state-final.log,
mutation-results.json, verification-exits.json, coverage-union-summary.json
and remaining.json. Exact C profiles are in
.cache/c-coverage/bones-links-20260906. The complete faithful port continues.
