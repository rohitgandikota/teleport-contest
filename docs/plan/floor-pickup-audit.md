# Floor pickup, swallowed objects and reach guards

Five recipes add 123 native C cases. They match 32,212 screens and cursors
and 292,355 RNG calls. They add 232 previously uncovered direct C branch
outcomes. The pass ports traditional and menu pickup, swallowed ownership
and digestion, and the associated reach, transformation and flight paths.

## Source review and changes

Complete recorder C functions were read before porting: pickup.c pickup,
query_classes, query_objlist, reset_justpicked and loot_mon; invent.c
let_to_name and look_here; do.c drop, dropz and engulfer_digests_food;
hack.c pickup_checks and dopickup; steed.c rider_cant_reach; mon.c newcham
and set_mon_data; worn.c mon_adjust_speed; trap.c minstapetrify, float_up and
check_in_air; vision.c vision_recalc; do_wear.c Boots_on and Ring_on; and
artifact.c finesse_ahriman. The Flying macro in youprop.h and place_object
in mkobj.c were also read. Reading a complete function does not establish
that its complete body is ported or tested.

pickup now follows C's traditional class and per-object prompts, count
limits, menu fallback, cancellation, autopickup and body restrictions.
query_objlist uses C's sort flags, headings, group selectors, quantity
selection, cockatrice handling, swallowed worn-item rejection and fake
hero entry. Defaults now include sortpack and sortloot. reset_justpicked
accepts the object list and runs at C's successful-attempt boundaries.

Swallowed drops transfer objects to the engulfer or immediately digest the
appropriate corpses, globs and meat objects. Digestion applies polymorph,
sliming, petrification, growth or healing before deleting the food. The
swallowed look_here branch displays contents and performs corpse-touch
checks. pickup_checks implements empty engulfer messages and routes actual
contents through loot_mon, which also implements saddle removal. The
broader doloot entry does not yet call that saddle path.

The newcham change ports the hero-release branch and calls set_mon_data
for movement scaling. Solid transformations can break out with one monster
HP; slime expulsion follows its distinct message and health path. Silent
monster creation remains synchronous. Other parts of newcham remain
partial, including immunities, form restrictions, naming, hiding and some
equipment effects. minstapetrify now uses the shared speed and stone-form
helpers. Swallowing suppresses normal and x-ray vision.

Flying now respects blocked property bits. Ring and boot levitation use
the shared float_up routine and C's FROMOUTSIDE guard. check_in_air checks
the hero's actual properties. High drops follow C's hitfloor path and the
Heart of Ahriman levitation ordering. finesse_ahriman probes the same
property bits while leaving live properties unchanged. Sink-ring drops,
container impact, ball landing and blind levitation mapping remain open.

Pickup and drop checks now use the hero's actual ball and chain slots.
Some older scroll code copied these slots into root fields, but the shared
punish function does not. A constructed swallowed-punishment control
checks both ownership and the absence of internal-error diagnostics.

Twelve runtime modules changed. No C source or frozen module changed.

## Native evidence

| Recipe | Cases | Screens/cursors | RNG calls |
|---|---:|---:|---:|
| floor-pickup-traditional | 25 | 6,891 | 60,661 |
| floor-pickup-menus | 35 | 11,490 | 81,492 |
| floor-pickup-safety | 6 | 1,902 | 14,755 |
| engulfer-object-transfers | 21 | 4,400 | 52,775 |
| pickup-reach-guards | 36 | 7,529 | 82,672 |

Traditional and menu cases vary class, beatitude, unpaid status, count,
selection order, repetition, cancellation and sort options. Safety cases
distinguish bare-handed blind cockatrice contact from counted safe items,
gloves and stone resistance. Engulfer cases distinguish digestive worms
from vortices, inventory ownership, count selection, regurgitation and
individual food effects. Reach cases exercise terrain, seen and unseen
pits, levitation, underwater forms, empty squares and mounted pickup.

All five instrumented C repeats are exact. Recipe assertions and recording
integrity pass separately. The cumulative C union reaches
55,680/108,268 direct outcomes and 4,373/5,491 entered records. Newly entered
records are finesse_ahriman, engulfer_digests_food, display_minventory,
loot_mon, n_or_more and rider_cant_reach. Digestion has 30/30 direct
outcomes, pickup121/156, query_objlist96/112, query_classes62/72,
pickup_checks34/36, look_here122/160 and newcham66/114. loot_mon has only
5/22 native outcomes; saddle controls below are constructed. finesse has
one native call but 0/6 measured outcomes. Exact missing line and outcome
entries are in .cache/floor-pickup/remaining.json. No new unreachable
claims are made. These counts exclude Lua, inactive configurations and
macro-internal choices.

Probe validation mattered. Initial recordings omitted a More response or
repeated the same menu configuration. Repeat-command cases required an
immediate repeat key. Blind safe-touch cases required actual menu
selection. A wished nurse corpse was too heavy to carry and was digested
during the wish's automatic drop, which the permanent case name records.
Terrain probes initially tried to replace stairs, and a mount probe used
the wrong adjacent square. Corrected cases verify their intended setup.

Human and cave-spider lava setup deaths were excluded from pickup coverage.
The human case retains a one-screen HP status mismatch before the burning
More prompt, with matching RNG. It remains in guards-fixed segment 21 for
the next pass. Intentional blind cockatrice and regurgitation deaths remain
in the corpus and have explicit mortality assertions.

## State checks and negative controls

The state gate replays all 123 cases, checking unique ownership, owner
pointers, quantities, selected counts, pickup markers, mortality, monster
inventory, transformations, growth, healing and release. Twenty-six
constructed groups check menu return codes and counts, fake hero and worn
objects, headings, reachable and blocked terrain, saddle removal, nurse
healing, movement scaling, swallowed vision, blocked flying, artifact
levitation and punishment. Constructed controls earn no native coverage.

Removing engulfer ownership transfer fails 108 screens, 14 cursors and
41,462 positional RNG entries in its native fixture. Skipping movement
scaling fails 44 screens, one cursor and 26,146 positional RNG entries.
Both also fail the state gate. Restoring the root ball field fails the
internal-error assertion: mpickobj rejects the attached ball. The first
version of that control checked ownership alone and survived because
mpickobj has its own defensive guard. That survivor led to the stronger
diagnostic check; it is not credited as a successful ownership mutation.

The exact 03561841 runtime across the twelve changed modules fails all
five recipes, missing 1,046 screens, 297 cursors and 182,958 positional RNG
entries. Those propagated mismatches are not independent defects. Scorer
controls use NODE_OPTIONS so workers inherit the loader.

An older monster-polymorph state test expected an equipment bypass flag
to survive a completed command. It failed on both 03561841 and the new
runtime. C allmain.c:195 clears bypasses before the next input, which JS
already implements. The assertion now checks the cleared state. This is
a test correction, not a runtime fix.

## Verification and next work

The final regression passes 551/551 fixtures, 44 public and 507
supplemental, matching 386,415 screens/cursors and 10,500,604 RNG calls.
The 21 earlier public animation misses remain. Results are in
.cache/floor-pickup/regression-post-ball.log and totals.json.

The new state gate, twelve related state gates, 49 hang checks, 80 fresh
role controls, fourteen tool tests and the source audit pass. The branch
ledger reaches 2,526/2,526, with 99 covered and seven partial broad
categories. Fuzz remains 101/102 with the known fixed-date screen mismatch
and all 491,759 RNG calls matching. Every job has completed and its exit
was collected; verification-exits.json records the checks.

The next source investigation is the retained lava
death status mismatch. Full looting and tipping entry paths, query_category,
remaining drop and newcham branches, menu symbol options, nested creation
weights and icebox timers, death disclosure and unreviewed C/Lua behavior
remain open. This checkpoint does not establish full gameplay fidelity or
a newer published held-out score.
