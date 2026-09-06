# Looting entry, automatic unlocking and container traps

The previous looting entry skipped multiple-container menus, confused
looting, several floor guards and saddle dispatch. A bag of tricks did not
bite. The entry now follows C's selection, continuation and abort rules,
including gold transfers into throne coffers or a monster's inventory.

## Source review and changes

Full C bodies read before porting: pickup.c container_at2024..2038,
able_to_loot2041..2069, mon_beside2072..2085, do_loot_cont2088..2162,
doloot2166..2174, doloot_core2178..2346, reverse_loot2350..2426 and
loot_mon2431..2483; lock.c u_have_forceable_weapon660..671 and
pick_lock358..656; options.c optfn_autounlock1066..1170,
handler_autounlock5624..5674 and doset_simple8707..8734;
trap.c could_untrap5258..5287, disarm_box5794..5817,
untrap_box5821..5844 and untrap5848..6096;
artifact.c is_magic_key2775..2785 and has_magic_key2790..2803.
The command table's options and optionsfull entries at cmd.c1780..1784,
the damage macro at hack.h1236 and active MON_AT macros at rm.h515..516
were also checked. No C or frozen code changed.

Seven runtime modules changed: pickup, lock, options, jsmain, trap,
artifact and cmd. do_loot_cont now carries a container reference so
unlocking can report a destroyed box. Force requests queue doforce only
for one container and a suitable weapon. Bag bites preserve C's damage,
half-damage rounding, identification and abort behavior. Floor checks,
blind cockatrice contact, multiple selections, next-container defaults,
directional ceilings and saddle questions follow C's command entry.

reverse_loot preserves each RNG expression and its order. It can display
old inventory, split and drop gold, prefer the original throne chest,
choose the nearest ordinary chest, or give gold to an exchequer. Transfers
clear the appropriate worn state and update ownership, container weight,
contents knowledge and locking. Return values preserve C's elapsed-turn rule.

Configured autounlock values previously remained strings. The parser now
produces C's bitmask, initializes APPLY_KEY, supports its separators and
aliases, and rejects incompatible or invalid values without replacing the
prior mask. A live menu handles combinations, no selection and cancellation.
The simple options menu suppresses its confirmation as C does. The named
options and optionsfull commands now call the same handlers as O.

The full could_untrap, untrap_box and disarm_box helpers are ported.
pick_lock now handles C's dummy object for a missing tool and checks a
container trap before applying a key. Its automatic container call inlines
untrap's confusion and magic-key prefix before calling untrap_box. The
rest of untrap, including floor and door dispatch, is still incomplete.
The remaining pick_lock and autokey branches are not claimed complete.

Magic-key tests found an error in the new helper: generated artifact types
are names, while nxtobj expects a numeric object type. Converting through
ONAMES fixes the search when another object precedes the key. The list
helper itself was correct. Paired native cases now verify both orderings.

## Native and state evidence

| Recipe | Cases | Screens/cursors | RNG calls |
|---|---:|---:|---:|
| looting-entry | 59 | 13,044 | 136,181 |
| confused-looting | 15 | 4,410 | 44,940 |
| container-autounlock | 40 | 10,609 | 99,779 |
| autounlock-options | 18 | 3,231 | 40,644 |
| magic-key-looting | 12 | 3,420 | 28,936 |

All 34,714 screens/cursors, 350,480 RNG calls and 22 animations match.
All five instrumented C re-recordings are exact. The state gate checks
144 native replays against 55 inventory observations, 144 HP values and
10 gold balances. Recursive ownership checks cover carried objects,
floor objects, monster inventory and nested containers.

Another 52 constructed groups check damage rounding, force guards, floor
access, adjacency, whole and partial gold transfers, quiver state, preferred
and nearest coffers, locking, contents knowledge, weight, trap discovery,
disarming, magic-key roles and beatitude, parser boundaries and live menus.
These controls earn no native coverage credit. The initial forced-disarm
check incorrectly expected no RNG at all; C's later exercise call can draw.
The corrected check verifies that forcing skips the disarm chance roll.

The key probes distinguish Rogue and Wizard rules with blessed, uncursed
and cursed keys. Each ordering has a paired native case. C skips the two
trap chance calls for qualifying keys, and makes them for other keys.
This directly verifies the forced behavior instead of inferring it from
successful disarming.

## Probe corrections and remaining work

The first saddle directions missed the actual pony, which was northeast.
Corrected cases cover yes, no, quit and Escape with verbose output on and
off. A grave wish on stairs did not create a grave; a corrected case moves
onto floor first. Aquatic forms without hands hit the earlier refusal;
a water troll reaches the pool guard. Lava destroyed the test containers,
so those probes earn no native lava-guard claim. One blocked move left its
container elsewhere; that case is named as an empty-direction control.

The initial extended generator duplicated the compound menustyle option.
The invalid setup and its recording remain in extended-duplicate-options,
with no passing credit. Corrected full-style cases remove the previous
setting. Three confused trap setups sometimes take reverse-loot or fail
to detect a trap; their names describe the setup, not an assumed disarm.
Native messages and exact frames are pinned in the permanent assertions.

Checking #options exposed missing named-command dispatch, although O was
already connected. Its three native cases now pass after adding both
command-table entries. Startup configuration-error display, full untrap,
remaining pick_lock/autokey branches, tip entry guards and unreviewed C/Lua
remain open. The complete-port goal continues beyond this pass.

## Measured coverage and negative controls

The C union adds 268 direct outcomes and six entered function records,
reaching 56,206/108,268 outcomes and 4,385/5,491 entered records. The new
records are accept_menu_prefix, cant_reach_floor, handler_autounlock,
reverse_loot, untrap_box and disarm_box. The ledger reaches 2,901/2,901,
with 99 categories covered and seven partial. These are execution and
assertion counts, not proof of complete fidelity.

doloot_core reaches 72/84 direct outcomes, do_loot_cont26/32,
reverse_loot33/40, able_to_loot16/24, loot_mon16/22,
optfn_autounlock51/56, handler_autounlock18/20, could_untrap11/20,
untrap_box15/24, disarm_box6/8 and has_magic_key7/8. pick_lock remains
90/180 and is_magic_key5/10. Exact missing outcomes are preserved in
.cache/looting-entry/remaining.json. No new unreachable claims were made.

| Deliberate regression | Screen misses | Cursor misses | RNG misses |
|---|---:|---:|---:|
| Remove confused reverse looting | 813 | 68 | 64,166 |
| Remove bag bite damage and draw | 178 | 0 | 117,809 |
| Bypass floor access guards | 7 | 3 | 0 |
| Skip coffer weight update | 0 | 0 | 0 |
| Use the artifact type name in list traversal | 31 | 1 | 23,516 |
| Force configured actions back to APPLY_KEY | 1,007 | 444 | 102,480 |
| Exact prior cc43b3fa across seven modules | 2,594 | 896 | 269,976 |

All six mutations fail the state gate. Skipping the coffer weight update
survives every native screen and RNG comparison but fails the constructed
weight check. The paired native key-order cases catch the type-name bug.
The prior runtime fails all five fixtures. RNG misses are positional, so
one extra or missing call can shift later comparisons. Loaders use
NODE_OPTIONS so the scorer's workers inherit each mutation.

## Regression verification

The final sweep passes all 563 fixtures, comprising 44 public and 519
supplemental fixtures. All 476,790 screens/cursors and 11,484,057 RNG calls
match. Supplemental output also matches all 21,726 animation frames. The
21 previously known public animation differences remain.

Twelve related state gates, 49 hang cases, 80 fresh role cases and 14 tool
tests pass. The source audit reports zero findings across 268 modules.
The separate fuzz corpus remains 101/102, with its known fixed-date screen
difference and all 491,759 RNG calls matching. Verification exits and exact
totals are preserved in .cache/looting-entry. Every known job has completed.
