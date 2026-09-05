# Monster statues and life saving

Ten new C cases match 2,290 screens and cursors, 28,857 RNG entries and seven
animation frames. Exact modules from the preceding checkpoint, 66fa5d8c,
fail all three fixtures: 2,045 screens, 2,278 cursors and 13,779 RNG entries
match. The baseline is loaded into the scoring worker through NODE_OPTIONS;
neither runtime files nor oracle output are edited for this comparison.

## Source review

The full monstone body in mon.c:3287-3374 now checks vampire reversion and life
saving before creating remains. Inventory extraction clears worn slots and
weapon references, applies carried-object transformations, sends boulders and
invocation tools through floor effects, and stops lights before putting other
objects into the statue. Naming and invisible-glyph cleanup use shared helpers.

The review covers mon.c:2808-2887 (minimum HP, mlifesaver and
lifesaved_monster), worn.c:1040-1056/1377-1424 (armor loss and inventory
extraction), mthrowu.c:1154-1171 (item consumption), and dog.c:1292-1365
(revived pets). Runtime consumers await extraction and disposal. Life saving
removes the worn amulet, restores movement and health, applies pet revival
rules, and still fails for a genocided species. Removing an unworn amulet or
wearing one on a nonliving creature does not grant life saving.

The full mon_adjust_speed, update_mon_extrinsics, m_dowear and m_dowear_type
bodies were reviewed. They exposed omitted speed adjustments, armor light,
and invisible monsters avoiding mummy wrappings. Gold armor now starts and
stops light while its worn flag is available. Silent creation remains
synchronous. Autocursing uses shared curse, which also clears a prior blessing.
The equipment state gate now expects its numeric C flag, 1, instead of the old
local assignment's JavaScript true value.

The full begin_burn, end_burn, cleanup_burn, stop_timer and obj_stop_timers
bodies were read in timeout.c. Timer removal now runs burn cleanup, restores
unused fuel, removes the light and refreshes carried inventory. Burning supports
artifact light and nested or buried locations. Valid construction completes
synchronously; diagnostic messages can suspend it.

A container probe exposed a separate source error in monmove.c:794-800's
translation. Selecting a miscellaneous or defensive item does not necessarily
consume a turn. A zero return must allow the monster to continue acting. The
full mloot_container body was read to trace this back to its caller.

## C cases and state checks

| Recipe | Cases | C-observed behavior |
|---|---:|---|
| monster-statue-containers | 4 | Throttled rummaging still allows movement; amulets and lamps remain nested, while boots and armor are selected out before stoning |
| monster-lifesaving-petrification | 2 | Goblin and gnome lord wear amulets, survive stoning, consume the amulets and lose tameness |
| monster-stone-equipment | 4 | Gold armor shines and becomes a statue's contents; armor protects a worn amulet or gold light during collision; speed boots change later movement |

Recipe assertions check the actual C messages, selection draws and final status
cells. The first hostile-soldier amulet probes never equipped the amulet:
movemon_single defers hostile equipment changes while the perceived hero is
nearby. Taming after pickup reaches equipment selection. Several other ignored
probes failed to pick up the item, remained overloaded, or wore body armor that
prevented collision petrification. They earn no claimed intent coverage.

tools/monster-statue-state-gate.mjs replays all ten cases and checks final
ownership, saved traits, life-saving consumption, tameness, speed and light.
Source controls add low maximum HP, invisibility, genocide, nonliving and unworn
amulets, named unique statues, nested crysknife reversion, boulder floor effects,
gold light removal, direct timer cancellation, stack consumption, and abused
pet revival. These controls earn no native C coverage credit.

C deliberately skips extrinsic removal for an already dead inventory owner.
The saved statue's resistance bits retain that behavior even though the nearby
C comment suggests attributes should be cleaned up. The test preserves the
executed C condition rather than interpreting the comment as a new rule.

The retain-knife mutation omits only obj_no_longer_held from inventory
extraction. Every new replay still passes all metrics, but the state gate
detects a crysknife (43) where C requires a worm tooth (42). This is a concrete
case where visible replay success misses incorrect persistent state.

## Measurement limits and continuation

All three native recordings are exact. They add 49 direct outcomes to the
measured union, now 54,050/108,268, with 4,315/5,491 entered function records.
monstone reaches 20/28 outcomes, lifesaved_monster 8/14, wary_dog 18/44,
extract_from_minvent 13/16, m_dowear_type 108/138, update_mon_extrinsics 64/96,
begin_burn 45/52, end_burn 10/12 and cleanup_burn 3/4. No new function record
was entered by these cases. Compiled execution does not certify every state
transition, build configuration or Lua behavior.

Verification logs, baseline and mutation loaders, rejected probes and totals
are under .cache/monster-statue. The current gate results are recorded in
STATUS.md. All 511 fixtures pass, 44 public and 467 supplemental. Supplemental
matches 166,907 screens/cursors, 7,865,757 RNG and 21,333 animations. Public
remains 11,405 screens/cursors, 792,838 RNG and 1,462/1,483 animations. Fuzz
remains 101/102 with the known fixed-date screen miss. All 47 hang checks,
80 role controls, 16 tool tests, source audit and eleven state gates pass.
The assertion ledger is 1,847/1,847, with 99 covered and seven partial
categories.

Full mondead, mon_break_armor and surrounding modules remain
incomplete. Continue with gulpmu's remaining setup, polymorph, resistance,
damage and release branches. Current corpus success does not complete the goal.
