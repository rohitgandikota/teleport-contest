# Untrapping, rescue and effective flight

The untrapping command previously returned without doing the work. It now
follows C's floor, container and door selection, success probabilities, failed
attempts and monster rescue. Automatic trap checks and artifact invocation
use the same entry. The source review also found missing state changes in
web capture, flight status, terrain transitions and trap descriptions.

## Source review

Full C bodies were read before their corresponding changes. In trap.c these
are dountrap, could_untrap, untrap_prob, cnv_trap_obj, into_vs_onto,
move_into_trap, try_disarm, reward_untrap, disarm_holdingtrap,
disarm_landmine, unsqueak_ok, disarm_squeaky_board, disarm_shooting_trap,
try_lift, help_monster_out, disarm_box, untrap_box, untrap, closeholdingtrap,
b_trapped, trapeffect_web and float_up. Existing cnv_trap_obj, into_vs_onto,
box helpers and trap-state helpers were reused.

The full pick_lock, doinvoke, arti_invoke, arti_invoke_cost, invoke_untrap,
bot_via_windowport, spoteffects, switch_terrain, u_locomotion and
look_at_monster bodies were also read. The changes to these larger functions
cover the relevant calls and missing branches. Remaining lock occupations,
artifact powers, status conditions, spoteffects guards and look descriptions
are explicitly incomplete. Reading a function is not a claim that its entire
port is finished. The underlying punishment helpers were reused; ball.c is
not claimed fully reviewed. No C or frozen code changed.

## Behavior and state

Floor disarming preserves the order of chance modifiers, role bonuses and
RNG calls. Failure can injure a captive, spread a web, trigger an underfoot
trap or move the hero into an adjacent trap. The last path propagates
FAILEDUNTRAP through spoteffects and handles punishment. Successful disarming
converts trap material, consumes oil or grease, or frees a captive while
leaving its holding trap intact. Pit rescue handles skepticism, sleep,
petrifying contact, weight, gratitude, alignment and filling the pit.

Container selection respects seen traps, reach, multiple boxes, known trap
state and cancellation. A floor trap can take precedence over a box. Door
checks distinguish detection, disarming, false alarms and explosions.
Automatic checks use the same behavior. Cancelling artifact untrapping
refunds its cooldown.

Web capture now calls set_utrap so blocked flight and levitation stay in
sync. Status and movement wording use effective properties. Moving out of
rock calls switch_terrain to restore them. Trap descriptions include visible
captives' holding traps and set trap knowledge. Door explosions halve HP
damage when appropriate, while stun keeps the full damage roll and preserves
non-timeout flags.

C's float_up compares the hero trap type with WEB instead of TT_WEB. The
native confirmed-web case therefore says the hero's leg remains stuck.
The port preserves that comparison and message. This is compatibility with
the supplied original, including its quirks.

## Probe validity

A passing replay can still test the wrong scenario. The initial box inputs
had a space that cancelled a trap question. Corrected cases answer the actual
native question. Some wished traps failed because a blocked move left the
hero on stairs. Those setups are excluded from permanent tests.

A hurtled monster flies over a pit. Putting a wall beyond the pit makes it
land in the pit and allows a real rescue. Small monsters evade bear traps,
so they are negative controls; pony, large dog and troll cases exercise
captives. Cases in which a hobgoblin died on capture are named accordingly.
A guarded move onto a known trap needs an explicit yes before testing
levitation while caught.

The Orb of Fate must be carried when the explosion occurs. Wishing for it
after equipping fumbling gloves dropped it. Corrected Valkyrie cases use the
valid female configuration and acquire the Orb first. Four matched pairs
then distinguish ordinary and halved damage.

The command is #wizidentify. Two initial oil/grease probes used #identify,
which is an unknown command. They are replaced by native cases that select
an item in the actual identification menu. The identified oil then appears
as a suggested untrapping tool. Lit oil exercises the separate bad-tool
branch. Merely revealing the wizard inventory is not identification.

A remembered trap glyph does not prove a trap still exists. An initial state
assertion made that mistake on a falling-rock case. The native state gate
instead checks mutations at C-observed action messages, final HP and
inventory quantities, and answered death prompts. Constructed states test
trap ownership, removal, knowledge and probabilities directly.

## Evidence and remaining work

| Recipe | Cases | Screens/cursors | RNG calls |
|---|---:|---:|---:|
| untrapping-floor | 90 | 23,760 | 220,930 |
| untrapping-containers | 40 | 12,633 | 93,067 |
| untrapping-doors | 51 | 16,993 | 132,611 |
| untrapping-tools | 19 | 5,758 | 47,613 |
| untrapping-rescue | 71 | 30,760 | 169,072 |
| untrapping-flight | 13 | 4,294 | 34,061 |

The six final fixtures contain 284 scenarios, 94,198 screens/cursors,
697,354 RNG calls and 2,770 animations. Each final fixture has an exact
instrumented C re-recording; the corrected tools fixture was repeated after
its additions. Independent recording-integrity and branch assertions pass.
The assertion ledger reaches 3,185/3,185, with 99 categories covered and
seven partial. A category count is not a completeness claim.

The state gate checks 284 native replays, 174 inventory observations, 284 HP
values, nine trapped-hero observations, 40 captive observations, two death
attempts and two charge counts. Recursive ownership checks cover inventory,
floor objects, monster inventory and nested containers. Another 73
constructed groups check chance modifiers, reach, conversions, tool use,
rescue, rewards, contact, knowledge, entry returns and property blocking.
Constructed states earn no C reachability or coverage credit.

The C union adds 413 direct outcomes and 13 entered function records over
32307679, reaching 56,619/108,268 outcomes and 4,398/5,491 entered records.
Newly entered records include invoke_untrap, all previously unentered floor
disarm helpers, help_monster_out, try_lift and reward_untrap. The union
includes every credited instrumented recording, including exploratory
executions whose intended setup failed. Those executions prove only the
paths they actually took. They do not establish the intended scenario.

Direct C coverage reaches dountrap4/4, untrap147/158, untrap_prob19/30,
try_disarm43/68, move_into_trap5/10, disarm_holdingtrap19/24,
disarm_landmine2/2, disarm_shooting_trap2/2 and disarm_squeaky_board16/16.
help_monster_out reaches18/30, try_lift9/16 and reward_untrap13/20.
These counts exclude macro-expansion conditions and inactive configurations.
Exact locations remain in remaining.json.

All eight deliberate regressions fail the state gate. Native comparison
results for the final six fixtures are:

| Deliberate regression | Screen misses | Cursor misses | Positional RNG misses |
|---|---:|---:|---:|
| Skip command entry | 8,618 | 4,041 | 662,086 |
| Omit blindness penalty | 61 | 59 | 17,938 |
| Omit grease consumption | 1 | 0 | 0 |
| Keep rescued monster trapped | 434 | 118 | 151,189 |
| Omit invocation refund | 4 | 4 | 33,912 |
| Ignore blocked levitation in status | 244 | 0 | 0 |
| Ignore half physical damage | 240 | 0 | 0 |
| Omit trap knowledge update | 0 | 0 | 0 |

Omitting trap discovery still passes all native comparisons. Its constructed
control detects the missing tseen mutation. Grease consumption initially
also passed: none of the new native attempts succeeded. A corrected,
identified success now detects the missing charge in both native output and
persistent state. The exact six runtime modules from 32307679 fail all six
fixtures, with 8,186 screen, 2,744 cursor and 645,490 positional RNG misses.

Thirteen related state gates, 50 hang cases, 80 fresh games across 13 roles,
14 tool tests and the source audit pass. The final tool additions separately
pass their hang check. Source audit reports zero findings across 268 modules.
Fuzz remains 101/102 with the known fixed-date screen difference, and all
491,759 RNG calls match. verification-exits.json and complete-exits.json
preserve the completed command results. The final full sweep passes569/569:
44 public and525 supplemental fixtures. All570,988 screens/cursors and
12,181,411 RNG calls match. Supplemental output matches559,583 screens/cursors,
11,388,573 RNG and24,496 animations. Public retains21 older animation
mismatches. regression-complete.log and totals.json preserve the final results.

The measured source gaps remain in `.cache/untrap/remaining.json`, including
mounted and tight-space refusals, mimics, shop door damage, several role and
weapon combinations, monster inventory weight and rare rescue rewards.
No new unreachable claims have been made. The overall C/Lua port remains
incomplete, and the ongoing goal continues beyond this pass.
