# Quantum containers and teleport attacks

The new corpus contains 63 native C cases in four recipes. It matches all
14,935 screens and cursors, 212,305 RNG calls and 22 animation frames.
It reaches 72 previously uncovered C branch outcomes and four previously
unentered function records. A mutation that leaves a corpse's rot timer
running passes the complete creation recording but fails the new state gate.
Screen and RNG parity alone cannot establish faithful persistent state.

## Source review and changes

The complete recorder C bodies were read before porting: m_initinv in
makemon.c:588..840, status_enlightenment in insight.c:940..1267,
enlightenment in insight.c:383..464, peffect_hallucination in
potion.c:695..713, and mhitm_ad_tlpt in uhitm.c:2859..2962. The existing
mhitm_mgc_atk_negated helper was compared with its full C body. Window
restoration was checked against tty_destroy_nhwindow, tty_dismiss_nhwindow
and erase_menu_or_text in wintty.c.

makemon now creates the quantum mechanic's box and housecat corpse on the
C one-in-twenty roll, removes the corpse's rot timer, sets the box's
unobserved flag and weight, and assigns monster ownership. The observation
and concealed-pick helpers were ported in the previous checkpoint. This
pass supplies their first native C execution evidence.

A hallucination potion can open enlightenment. Its nudist status now uses
C's distinct sentence. The potion no longer redraws the map after the
window has already restored it. An instrumented C display-RNG recording
shows three normal draws after dismissal; the extra JS redraw inserted six
more first, through vision_recalc and see_monsters. Core RNG was unchanged.
Removing that redraw fixes 128 screens and two cursors in the expanded
observation probes. Correcting the nudist sentence fixes two more screens.
Diagnostic recordings with display RNG remain outside the scored corpus.

A delayed box observation exposed an unrelated-looking missing damage type:
a quantum mechanic's teleport attack was falling through to plain physical
damage. The shared mhitm_ad_tlpt function now implements all three C combat
directions and is connected to the hero, monster-to-hero and monster combat
dispatchers. It preserves cancellation order, visibility messages,
teleport restrictions, strategy clearing and the C nonfatal damage limit,
including the separate polymorphed HP pool and half physical damage.

Six runtime modules changed. No C-recorder or frozen module changed.

## Native evidence

| Recipe | Cases | Screens/cursors | RNG calls |
|---|---:|---:|---:|
| quantum-mechanic-creation | 11 | 1,507 | 34,166 |
| quantum-cat-observation | 27 | 7,209 | 89,767 |
| concealed-shop-picks | 5 | 941 | 25,456 |
| quantum-teleport-attacks | 20 | 5,278 | 62,916 |

The creation search used 120 seeds. Nine created boxes, and two no-box
controls join those nine in the permanent recipe. The observation matrix
uses the nine box seeds sighted, blind and hallucinating. It reaches
12 live and 15 dead observations, including blind contact feedback.
The shop cases remove one pick, two picks or a dagger, with audible and
deaf variants. Two picks produce one warning in a turn.

The attack recipe exercises intrinsic teleport-control feedback and its
absence, magic negation, the Orb of Fate's half damage, a cancelled
attacker, quantum-mechanic hero forms attacking giants and lichens, and
monster combat under conflict. Wizard mode still offers destination
selection in the no-intrinsic-control cases, so those cases do not verify
random uncontrolled hero teleportation. The two delayed observations use
a 350-turn rest request, but play interrupts it: JS replay reaches moves
3 to 85 and 3 to 60 before observation. These are delayed interactions,
not verified 350-turn waits. A 351-turn variant duplicates their recorded
behavior and is not promoted.

The instrumented C repeats are exact for all four fixtures. Assertion and
recording integrity checks pass separately. The branch ledger is
2,331/2,331, with 99 covered and seven partial broad categories. Those
labels describe declared cases, not the entirety of NetHack.

The cumulative C union reaches 55,375/108,268 direct branch outcomes and
4,366/5,491 entered function records. It adds observe_quantum_cat,
pick_pick, u_teleport_mon and mhitm_ad_tlpt. The reviewed functions still
have explicit gaps: m_initinv139/144, observe_quantum_cat11/20,
pick_pick5/8, u_teleport_mon3/20 and mhitm_ad_tlpt30/62. No new unreachable
claims are made. Exact missing line and outcome entries are saved in
.cache/quantum-containers/remaining.json. C source coverage excludes Lua,
inactive build configurations and macro-internal decisions.

## State checks and causal controls

The quantum-container gate replays all 43 container cases. It checks every
live object's unique owner and owner pointers, unopened corpse type and
absence of timers, box weights, live cat names and peace, dead corpse age
and restarted timer, observation experience and score, and pick transfer
and one reaction turn. The teleport-attack gate replays all 20 attack
cases, checks C-visible final HP, monster relocation and nonfatal damage,
cancellation and worn protection, and adds 19 constructed boundary groups.
These include the one-HP safety increment, polymorphed HP, half damage,
zero damage, cancelled attackers, lethal monster attacks, forbidden
teleports and magical negation. Constructed controls earn no C coverage.

The no-rot-stop mutation passes all 1,507 native creation screens/cursors
and 34,166 RNG calls. The state gate rejects its first box with one timer
instead of zero. The no-HP-protection mutation passes the 20 ordinary
native attack replays but fails the three-HP constructed boundary, dealing
four damage where C limits it to two. The exact d444a94f runtime loaded
across all six changed modules fails three of four fixtures, missing
1,772 screens, 194 cursors and 171,200 positional RNG entries. Concealed
picks already worked at that checkpoint. Positional RNG differences can
propagate after an earlier mismatch; they are not independent defects.
Scorer loader controls use NODE_OPTIONS so worker processes inherit them.

The first version of the new state gate treated empty monster inventory
as an array and used mname instead of the existing mgivenname field.
Those assertions were corrected; neither required a runtime change.
The polymorphed HP checks use the canonical Upolyd(game.u) signature.

## Verification and remaining work

The complete regression passes 542/542 fixtures, 44 public and 498
supplemental, matching 336,089 screens/cursors and 9,982,087 RNG calls.
Supplemental animation frames all match; public keeps 21 earlier misses.
Results are in .cache/quantum-containers/regression-final.log. Both new state gates,
twelve related gates, 48 hang checks, 80 fresh role controls, fourteen tool
tests and the source audit pass. Fuzz remains 101/102 with the known
fixed-date screen mismatch and all 491,759 RNG calls matching.

The next container pass should port tipcontainer_checks and complete
tipping into another container, including hornoplenty's destination
argument and the shop and floor-effect paths. Several other enlightenment
callers still invoke docrt after dismissal and need independent C review.
Native low-HP teleport boundaries, random hero teleportation, restricted
levels, invisible targets and steed branches remain open. Full floor
pickup, query_objlist/query_category, recursive death disclosure and the
broader deleted-object lifecycle are also still open.
