# Inventory type queries and unpaid display

Traditional I previously opened a category menu instead of C's prompt.
Unpaid selections did not show carried or contained prices. The entry point
now follows C for all four menu styles and uses the complete unpaid-display
path, including hidden container contents and floor or buried debt summaries.

## Source review and changes

The full C functions were read before porting: invent.c dotypeinv3827..4041,
dounpaid3654..3790, find_unpaid3010..3041, xprname2895..2954,
this_type_only3793..3824 and count_unpaid3526..3540; mkobj.c
unknwn_contnr_contents684..697; objnam.c distant_name347..409.
The existing get_obj_location implementation and the data-window closing
pattern used by doinvbill were checked before use. No C or frozen file changed.

The canonical dotypeinv now lives in invent.js. Traditional and combination
styles collect visible categories and hidden choices after Escape. Full
and partial styles use query_category. Uppercase U or X can select unpaid
or used-up bills when their BUC category is absent. Empty and unavailable
categories get C's messages. The shared object query preserves counts,
class ordering, titles and item actions. Query globals are cleared afterward.
The old cmd.js implementation and orphan pickup.js wrapper were removed.

find_unpaid walks the recursive object chains with a last-found cursor.
A completed cursor can restart, while a foreign cursor returns no result.
unknwn_contnr_contents returns the outermost unknown parent. dounpaid uses
a message line for one visible item and a data window for multiple items,
hidden contents or carried items combined with debt elsewhere. Costs use
C's no-contents flag, so parent and child charges are counted separately.
The multi-item path follows C's top-container cknown check even when an
inner container remains unknown. Naming restores price suppression.

distant_name now resolves object ownership before checking visibility and
range. Carried coordinates can be stale. At game over, naming temporarily
clears o_id and then restores it. The existing distant-name counter still
brackets names that must not identify unseen objects. Five runtime modules
changed: invent, cmd, pickup, mkobj and objnam.

## Native and state evidence

| Recipe | Cases | Screens/cursors | RNG calls |
|---|---:|---:|---:|
| inventory-type-queries | 82 | 21,429 | 228,214 |
| unpaid-inventory-display | 9 | 1,350 | 47,789 |

All 22,779 screens/cursors and 276,003 RNG calls match. Both instrumented C
re-recordings are exact. Recording integrity and branch assertions pass
separately. The ledger reaches 2,757/2,757, with 99 categories covered and
seven partial. The state gate compares every native query with its prefix
and verifies unchanged quantities, ownership, bills and elapsed turns.
Nineteen displayed prices are checked against native output and JS bills.

Another 29 constructed groups check cursor traversal, outermost unknown
parents, hidden and nested charges, class grouping, floor and buried debt,
uppercase fallback, visibility, geometric distance, xray range, artifact
visibility, carried and monster ownership, game-over identity and nested
naming counters. These checks earn no native coverage credit. The initial
constructed run compared an absent suppress_price field directly with zero;
the corrected check treats the absent false value as zero, as the runtime does.

The C union adds 114 direct outcomes and three first-entered records:
dounpaid, find_unpaid and unknwn_contnr_contents. It reaches 55,938/108,268
outcomes and 4,379/5,491 entered records. dotypeinv reaches112/128,
dounpaid34/54, find_unpaid9/10, unknwn_contnr_contents3/4, distant_name7/10,
xprname30/38 and this_type_only33/34. Exact remaining outcomes are retained
in .cache/inventory-types/remaining.json. Execution is not proof of complete
fidelity, and no new unreachable claims were made.

## Negative controls

| Deliberate regression | Screen misses | Cursor misses | RNG misses |
|---|---:|---:|---:|
| Force category menus for every style | 78 | 64 | 0 |
| Remove unpaid display | 14 | 4 | 0 |
| Use stale object coordinates | 0 | 0 | 0 |
| Remove game-over identity guard | 0 | 0 | 0 |
| Exact prior 33dbd65a across five modules | 92 | 68 | 0 |

All four mutations fail the state gate. The location and identity mutations
survive these native fixtures, which is why the constructed checks remain
necessary. The prior runtime fails both fixtures. Loader controls use
NODE_OPTIONS so scorer workers inherit the mutations.

## Probe corrections and remaining work

Shop probes 0 and 2 initially set traditional style before container setup,
so their keys did not create the intended contents. They are excluded from
promotion. Corrected probes switch styles live after the setup. An early
extra set appended a second menustyle option and triggered C startup errors.
That failure is retained as extra-duplicate-options and receives no passing
or coverage credit. Startup error display remains a separate known port gap.

Native coverage still lacks several hidden-container, floor/buried, empty-bill
and item-action paths. Constructed controls cover some of these semantics;
they do not establish legal gameplay reachability. Wider inventory lifecycle,
looting entry paths, configuration errors, disclosure and unreviewed C/Lua
remain open. The next pass targets full doloot_core and reverse_loot.

## Regression checks

The final corpus passes558/558 fixtures, 44 public and514 supplemental.
All442,076 screens/cursors and11,133,577 RNG calls match. Supplemental
matches430,671 screens/cursors,10,340,739 RNG calls and21,704 animations.
Public retains21 earlier animation misses. Twelve related state gates,
46 hang fixtures,80 fresh-role games,14 tool tests and the strict ledger
pass. The source audit reports0 findings across268 non-frozen modules.
Fuzz remains101/102 with the known fixed-date screen mismatch and all491,759
RNG calls matching. All pass jobs finished and their exits were collected.
Results are in .cache/inventory-types/regression-final.log, totals.json
and verification-exits.json.
