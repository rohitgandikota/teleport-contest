# Status suppression and fatal damage

C botl.c:259 suppresses status drawing when human HP is exactly -1. The
port omitted this condition and instead tried to preserve HP through
death messages by inspecting their text and counting More prompts. The
missing C condition fixes the retained lava mismatch and allows those
workarounds to be removed from lava_effects, losehp and mdamageu.

## Source review and changes

The complete recorder C bodies were read: botl.c bot253..272 and
timebot275..294; display.c suppress_map_output715..718 and its preceding
macro, plus flush_screen2208..2271; pline.c vpline153..287 and
urgent_pline315..324; hack.c end_running4130..4158, showdamage4247..4253
and losehp4256..4295; mhitu.c mdamageu1902..1927; trap.c
lava_effects6794..6989; and end.c done1021..1128. The C source is unchanged.

bot now applies the human-HP, monster-data, status_updates and output
suppression guards, and clears its dirty flags at C's boundary. A disabled
bot retains those flags. timebot checks the status and output guards but
has no HP sentinel test. flush_screen suppresses output before toggling
delayed flushing during level creation, saving, restoration or hangup.
The port reads status_updates through the existing live boolean option
accessor. These are shared conditions, independent of message content.

losehp now calls end_running before subtraction and the shared showdamage
immediately afterward. The latter moved to its canonical hack module and
is also used by mdamageu. Damage messages report the new HP before later
maximum-HP clamps. Negative monster damage reports C's internal error and
is clamped to zero. Negative losehp remains allowed, including increasing
maximum HP. Four runtime modules changed: display, hack, mhitu and trap.
No frozen module changed.

The retained lava case matched 168/169 screens before the change and all
169 afterward, with all 2,272 RNG calls and cursors unchanged. Under the
burning More prompt, C preserves the earlier 126 HP. done calls bot while
human HP is -1, then assigns zero and marks status dirty. The following
question flush exposes zero at the later C boundary.

## Native evidence

| Recipe | Cases | Screens/cursors | RNG calls |
|---|---:|---:|---:|
| fatal-hp-status | 12 | 2,198 | 29,560 |
| damage-feedback | 11 | 1,672 | 39,991 |

All 3,870 screens/cursors and 69,551 RNG calls match. Recipe assertions and
recording integrity pass separately. Paired self-zaps
exercise HP at -2, -1, 0, 1 and 2 with damage messages on and off. Further
cases cover lava, disabled status, nonfatal damage, polymorph HP, reversion
from kobold and orc forms, and repeated monster attacks. Recipe assertions
pin the exact C status cells beneath damage and death messages.

The first probes attempted to zap in bat, dragon and water-elemental
forms. Those forms cannot use the wand, so they were excluded from damage
coverage. Kobold and orc replacements reach actual damage and reversion.
Duplicate lava cases with showdamage enabled added no distinct behavior
and were excluded. Extra seeds were used to find the exact zero and
positive-one boundaries, then reduced to the focused paired cases.

Damage messages add More prompts. In the copied monster sequence, the
ordinary variant answers four Die questions and accepts the last death.
With showdamage, the same keys answer three questions and the hero remains
alive. The state gate derives the death count from answered C prompts
rather than assuming that the original sequence's later keys still reach
the same question.

Both instrumented C repeats are exact. The cumulative union adds 22 direct
outcomes and two entered records, back_on_ground and rescued_from_terrain,
reaching 55,702/108,268 outcomes and 4,375/5,491 records. Measured coverage
is bot8/10, timebot5/8, flush_screen23/26, showdamage3/4, losehp14/20,
mdamageu7/10 and lava_effects28/86. The remaining source decisions are in
.cache/status-suppression/remaining.json. Constructed controls do not earn
native coverage; no new unreachable claims are made. Lua, inactive builds
and macro-internal decisions remain outside these direct counts.

## State checks and deliberate regressions

The state gate replays all 23 cases and checks HP, mortality, polymorph
reversion and internal errors. Twenty-five constructed groups distinguish
HP -1 from other values, human HP from polymorph HP, disabled bot from
other guards, pending dirty flags, suppressed flush ordering, time-only
updates, running cancellation, healing, damage messages and HP clamps.

Removing the sentinel guard fails 13 native screens with every RNG call
and cursor matching. Removing showdamage fails 102 screens, 95 cursors
and 5,949 positional RNG entries. Both mutations fail the state gate.
Removing end_running still passes all 23 native replays and both frozen
fixtures, but fails the constructed running/travel-state assertion.
The exact b3a6c51b runtime across all four changed modules fails both
fixtures, missing 782 screens, 95 cursors and 5,949 positional RNG entries.
Propagated mismatches are not independent defects. Scorer loader controls
use NODE_OPTIONS so worker processes inherit the substitutions.

## Verification and remaining work

The final integrated run passes 553/553 fixtures, 44 public and 509
supplemental, matching 390,285 screens/cursors and 10,570,155 RNG calls.
The 21 earlier public animation misses remain; supplemental animations
all match. The new state gate, twelve related state gates, 46 hang checks,
80 fresh role controls, fourteen tool tests and the source audit pass.
The branch ledger reaches 2,549/2,549, with 99 covered and seven partial
broad categories. Fuzz remains 101/102 with the known fixed-date screen
mismatch and all 491,759 RNG calls matching. Every job finished and its
exit was collected. Results are in .cache/status-suppression/totals.json
and verification-exits.json; the initial invalid coverage tag was corrected
before the final ledger check.

The broader status windowport, output suppression callers, remaining
death paths and passive-cold HP deferral remain open. end_running's
terrain-status and travel-map handling also remains partial. The next
source pass is query_category and the looting entry paths. This checkpoint
does not establish complete gameplay fidelity or a newer held-out score.
