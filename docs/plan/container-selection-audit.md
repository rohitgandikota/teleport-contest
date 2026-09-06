# Container selection and carrying

The new corpus has 114 C cases across four recipes. It matches 44,588
screens and cursors and 275,696 RNG calls. The complete suite passes
538 fixtures, 44 public and 494 supplemental. Native coverage gains
244 direct outcomes and five entered function records. These results
measure tested behavior, not complete gameplay fidelity.

## Source review and implementation

Complete relevant bodies were read in the recorder's C source before
porting. pickup.c now supplies simple_look, query_classes, traditional_loot,
menu_loot, use_container, in_container, out_container, carry_count,
delta_cwt, lift_object, pickup_prinv and their reviewed helpers.
query_classes preserves entered class order, duplicate classes, blessing
filters, menu requests and filter state across look and inventory retries.
The traditional and menu paths share the C callbacks and counted-stack
restoration. use_container handles contents, help, both transfer orders,
stashing, cancellation and the container pointer after an explosion.
current_container belongs to the game, and apply passes the mutable pointer
so a destroyed container cannot receive later artifact feedback.

The transfer callbacks preserve equipment guards, welded weapons, cursed
loadstones, invocation items, attached leashes, oversized objects, burning
items, ice-box age and timers, billing, magical explosions, partial carrying
capacity and pickup feedback. The carried-container weight calculation
accounts for bag blessing and curse, rounded gold weight and the weight
removed from the container. ice troll revival follows stored monster traits.
The native gold boundary removes 208,449 from 240,000 carried in a blessed
bag. The remainder stays inside. This is the C result, including its
particular arithmetic order.

invent.c's tally_BUCX now sets priest blessing knowledge before counting,
and follows goldX for coin classification. merge_choice accounts for a
floor shop item's future billing state. obj_here checks object identity on
the floor. mkobj.c's splitobj inserts the child after the parent in every
represented live owner chain, copies object extras, clears the revival ID
and Lua reference count, and preserves timer and light splitting. The
existing deleted-object lifecycle remains outside this pass.

end.c's container_contents now provides the loot contents view, including
all six sortloot/sortpack combinations. It also implements recursive,
identified and quantum-placeholder branches; those have constructed
controls but no new native disclosure coverage. The existing death
workflow is not yet connected to this function. observe_quantum_cat and
shk.c's pick_pick were ported from their complete C bodies. Quantum live,
dead and observation-without-creation cases have constructed controls.
Neither function has native reachability in the current union, so neither
is claimed as verified by a C gameplay recording.

Nine runtime modules changed. No C-recorder or frozen file changed.
The new functions retain their C names and modules. Existing query_objlist
and query_category still need full review; most pile menus continue to use
the older sortloot_items helper.

## Independent evidence

| Recipe | Cases | Screens/cursors | RNG calls |
|---|---:|---:|---:|
| container-selection | 56 | 18,135 | 129,795 |
| container-transfers | 35 | 12,198 | 87,691 |
| container-capacity | 17 | 11,711 | 44,176 |
| container-contents-order | 6 | 2,544 | 14,034 |

All four instrumented C re-recordings are exact. Branch assertions and
recording integrity pass separately. Contents-order assertions pin the
actual native rows. The assertion ledger is 2,268/2,268, with 99 covered
and seven partial scenario categories. The C union reaches 55,303/108,268
direct outcomes and 4,362/5,491 entered function records. Newly entered
records are query_classes, simple_look, explain_container_prompt,
traditional_loot and weldmsg. No new unreachable claims were made.

The native state gate replays all 114 inputs and checks unique object
ownership, owner pointers, quantities, cleared container and bypass state,
released equipment, snuffed lights, corpse timers, explosions and gold.
Twenty-five constructed control groups check additional owner chains,
split metadata, priest side effects, selection return values, duplicate
classes, attached leashes, ice troll traits, bag weight, shop payments,
quantum observation, recursive identification and menu cancellation.
Constructed controls earn no native coverage credit.

A loader mutation disables unsplitobj. It fails both capacity and transfer
fixtures on 11 screens and six cursors while preserving every RNG call.
The native state gate rejects the refused traditional transfer: C restores
the two stacks [30, 210], while the mutation leaves [30, 90, 120]. This
catches a structural error despite conserving the total quantity.

The exact previous f8f0f7cf runtime, loaded across all nine changed modules,
fails all four fixtures on 8,446 screens, 1,441 cursors and 231,038 positional
RNG entries. Positional differences propagate after an earlier mismatch;
they are not counts of distinct bugs. The first control commands supplied
a loader only to the scorer's parent, so their apparent passes were invalid.
The final commands use NODE_OPTIONS to load the control in each worker.

## Regressions and probe corrections

Linking monster splits exposed money2u's old extraction shortcut. A paid
split remained in the shopkeeper's inventory while also entering the hero's
inventory. The complete C money2u now extracts the split before adding it,
and handles a full inventory. The shop credit fixture and repeated-payment
state control verify the repair.

The larger bags exposed two status timing errors. tty_yn_function called
bot unconditionally even after its normal dirty-status flush. That showed
the new capacity before C did. Removing that extra call restores C timing.
Conversely, hold_another_object must flush status when new gold has already
set botl or botlx. Its capacity deferral now respects those flags. A
container_contents comparison also checked C's single-character sortloot
value against the port's full option string. Reading the first character
restores the two missing sorted screens.

Initial ring input omitted the left-hand selection, so it did not wear the
ring. A counted cancellation-wand wish produced one wand and never reached
a counted transfer. Neither case was promoted. The menu split probes first
selected the 30-stack rather than the 210-stack; corrected inputs select
120 from the latter and reach each confirmation answer. Heavy transfer
probes acknowledge the preceding More prompt before answering. Two duplicate
120-dagger cases that never reached confirmation were excluded. The
360,000-coin case exercises a partial-capacity warning and default refusal;
it does not claim a positive confirmation. A stale category metadata label
was corrected through the recorder before the final ledger check.

The final suite matches 321,154 screens/cursors and 9,769,782 RNG calls.
Supplemental matches 309,749 screens/cursors, 8,976,944 RNG and all 21,679
animations. Public retains its 21 prior animation misses. Fuzz remains
101/102, with the known fixed-date screen miss and all 491,759 RNG matching.
The 48 hang checks, 80 role controls, 16 tool tests, source audit and twelve
related state gates pass. Source audit reports zero findings in 268 modules;
this is not a fidelity certificate.

The exact remaining outcomes are in .cache/container-selection/remaining.json.
query_classes reaches 61/72, use_container 131/154, traditional_loot 10/10,
menu_loot 62/86, in_container 65/90, out_container 17/24 and carry_count 40/56.
Next work must reach the remaining native paths, complete query_objlist and
query_category, and continue floor pickup, multiple-container looting,
disclosure, object lifecycle and the rest of the C/Lua port.
