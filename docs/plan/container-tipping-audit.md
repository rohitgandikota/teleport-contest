# Container tipping and generated chest weight

The four new recipes contain 72 native C cases. They match 18,114 screens
and cursors and 226,162 RNG calls. They add 73 previously uncovered C branch
outcomes. A persistent-state check also exposed a missing supply-chest
weight update that the complete screen and RNG corpus did not detect.

## Source review and changes

The complete recorder C bodies were read before porting: tipcontainer in
pickup.c:3688..3846, tipcontainer_gettarget:3871..3950,
tipcontainer_checks:3954..4057, hornoplenty in mkobj.c:2847..2935 and
fill_ordinary_room in mklev.c:939..1173. The complete bagotricks body in
makemon.c:2554..2610 was reviewed against the existing helper. The original
source and diagnostic recordings remain unchanged.

The three shared tipping functions now follow C's source and destination
checks, free-hand selection, unknown bag-of-tricks activation, lock and
trap handling, quantum observation, repeated charges, shop usage and item
billing, cursed losses, icebox timer restoration, altar and falling effects,
terse object messages and final weights and encumbrance. Deselecting the
floor entry still chooses the floor; Escape cancels. A bag explosion stops
the transfer after destroying the triggering object and destination. The
unprocessed objects remain in the source. Price suppression is restored
before leaving the loop.

hornoplenty moved from apply to its canonical mkobj module. Application and
tipping now share C's creation, charge, potion substitution and oil fixup,
beatitude, billing and price suppression. Tipping can insert into a carried
container, hit the floor from a height, or use the ordinary altar and floor
paths. dotip now routes horns through the shared tipping path; its broader
entry logic is not yet fully ported.

The state gate found a supply chest at (46,5) in cursed-retain-42 with JS
stored weight 600 while its contents added 70. A separate native recording
with wizweight reports 670 aum when examining the chest. C explicitly
updates supply_chest->owt after filling it; JS omitted that final line.
That update is now ported. The diagnostic is in
.cache/container-tipping/weight-c.session.json and is not a scored fixture:
JS does not yet implement wizweight display. Four runtime modules changed:
apply, mkobj, pickup and mklev. No frozen module changed.

## Native evidence

| Recipe | Cases | Screens/cursors | RNG calls |
|---|---:|---:|---:|
| container-tipping-transfers | 26 | 7,371 | 85,200 |
| container-tipping-guards | 16 | 3,742 | 36,891 |
| quantum-container-tipping | 18 | 4,588 | 61,065 |
| horn-container-tipping | 12 | 2,413 | 43,006 |

Transfers include sack and holding-bag destinations, resumed icebox corpses,
charged and empty cancellation wands, nested magic bags, levitation, altars,
pools, lava, sold shop contents and cursed retention and loss. Guards cover
empty, locked and trapped sources and destinations, free hands, handless
forms, destination activation and cancellation. Quantum cases vary live and
dead observations, blindness, hallucination and destination. Horn cases
cover floor, sack, levitation, empty charges and unpaid goods. The floor
bag-of-tricks case consumes two charges and quotes a 133-unit usage fee.
The unpaid horn quotes 67, with one bill entry after floor tipping and four
after adding three created items to a carried sack.

All four instrumented C repeats are exact. Recipe assertions and recording
integrity pass separately. The declared branch ledger reaches 2,403/2,403,
with 99 covered and seven partial broad categories. Those categories do not
measure the fraction of the full game that is faithfully ported.

The cumulative C union reaches 55,448/108,268 direct branch outcomes and
4,367/5,491 entered function records. lava_damage is newly entered. Current
native coverage is tipcontainer70/76, tipcontainer_gettarget28/32,
tipcontainer_checks51/56, hornoplenty29/38 and bagotricks22/32.
choose_tip_container_menu and tiphat still have no native calls. Exact
missing line and outcome entries are in
.cache/container-tipping/remaining.json. No new unreachable claims are made.
These counts exclude Lua, inactive configurations and macro-internal
choices.

Several initial probes did not reach the behavior named in their labels.
Two wished iceboxes were too heavy to carry; the corrected cases wish
empty boxes and explicitly insert a corpse. Three trapped boxes were also
locked, so the lock prevented the trap. The permanent cases unlock them.
A floor horn cannot be selected by the Is_container floor filter and was
excluded. Cursed seeds 41..44 retained their contents during tipping; seeds
45 and 50 were selected using loss rolls after the actual #tip command.
Earlier cursed-opening losses do not establish tipping loss coverage.

The first shop-horn setup used an armor shop and an invalid traditional
pickup response. Corrected unpaid cases use the established general/tool
shop setup and observed menu selections. The original recording is kept as
extended segment 33: before tipping, C says there are several objects and
uses traditional pickup, while JS opens the full object menu. This is an
open pickup failure, not evidence against the now-corrected tipping cases.

## State checks and controls

The new gate replays all 72 cases. It checks unique live ownership and owner
pointers, recursive container weights, no setup deaths, balanced price
suppression and native RNG totals. Targeted assertions check stopped and
restarted corpse timers, quantum state and live cat names, the exact C
supply-chest weight, cursed survivors, remaining explosion contents,
destination destruction, charge preservation on rejected targets and shop
fees and bills. Eight constructed controls cover allowempty, locks, live
and dead quantum outcomes and one-item horn insertion. Constructed
controls do not earn native C coverage.

Removing the supply-chest update fails the state gate at 600 versus 670.
The complete pre-fix regression still matched all 354,203 screens/cursors
and 10,208,249 RNG calls. Removing the explosion stop fails the native
transfer fixture on nine screens and three cursors, with all 85,200 RNG
calls matching. The state gate rejects the same mutation because the
remaining apple was incorrectly removed from the source.

The exact a429a01d runtime loaded across all four changed modules fails
all four fixtures, missing 454 screens, 106 cursors and 147,493 positional
RNG entries. Positional RNG mismatches can propagate after one divergence;
they are not independent defects. Scorer loader controls use NODE_OPTIONS
so the worker processes inherit the substitutions.

## Verification and remaining work

The final post-weight regression passes all 546 fixtures, 44 public and 502
supplemental. All 354,203
screens/cursors and 10,208,249 RNG calls matched. The 21 earlier public
animation misses remain. Final results are in
.cache/container-tipping/regression-post-weight.log.

The new state gate, twelve related state gates, 48 hang checks, 80 fresh
role controls, fourteen tool tests and the source audit pass. Fuzz remains
101/102 with the known fixed-date screen mismatch and all 491,759 RNG calls
matching. Exit records are in .cache/container-tipping/verification-exits.json.

The next pass should complete pickup and query_objlist, starting with the
recorded traditional pickup failure and count-prefixed commands. Full dotip,
multiple floor-container selection, able_to_loot guards, tiphat, remaining
horn outcomes, query_category, recursive death disclosure and deleted
object lifecycle remain open. Source review also found existing mkbox_cnts
gaps in child weight updates and icebox corpse timers; these need native
probes before claiming that broader creation path complete.
