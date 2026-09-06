# Category selection and menu symbols

Selecting only A in a drop-category menu used to drop every object. C
rejects that selection unless paranoid auto-selection is enabled. The
shared category query now preserves that rule, confirmation and retry
behavior, class counts, worn filters, pickup history, and menu hints.

## Source review and changes

The full C functions were read before porting: pickup.c query_category
1226..1508 and count_categories1511..1535; cmd.c paranoid_ynq5588..5652;
options.c optfn_menu_objsyms2225..2287, handler_menu_objsyms5795..5838,
set_menuobjsyms_flags7446..7452 and objsymvals273..280; invent.c
is_worn2156..2161, display_pickinv3057..3420, this_type_only3793..3824,
dotypeinv3827..4041 and let_to_name4800..4840; wizcmds.c
wiz_identify50..68. C string_for_opt6665..6681 and its parseoptions
call site were also checked for empty values and whitespace. No C or
frozen code changed.

query_category now confirms A only for PICK_ANY with ParanoidAutoAll.
Declining removes A from a mixed selection. A lone declined A becomes
All types when that flag is allowed, otherwise it cancels. Quit and
Escape cancel. Without confirmation, a lone A reports no relevant items.
Counts attached to retained selections survive the transformation.
The menu is destroyed after the confirmation or feedback message.

The two hint counters belong to the game and reset with it. With
cmdassist disabled, only the first applicable hint appears. Venom is
appended to the displayed class order, but C deliberately excludes it
from count_categories. The single-category shortcut then returns the
first eligible object in list order. Worn category counts exclude saddle,
ball and chain bits; the subsequent is_worn filter includes saddles.
The quiver is a weapon slot. The category-limit diagnostic is awaited.

menu_objsyms now handles all six modes, numeric values, negation, bare
options, the legacy alias, abbreviation rules, and live menu selection.
Its numeric value and the two derived flags are initialized together.
The existing tty renderer consumes the selected mode. Inventory headings
now receive the want_reply flag and the venom section. Wizard identification
uses display-only headings, while inventory browsing uses selectable ones.

The menu arm of dotypeinv now calls the shared query_objlist. That preserves
class headings even with sortpack disabled and applies C's coin BUC rule
through this_type_only. The older inline filters and obsolete private
inventory-builder parameters were removed. Traditional category prompts
and unpaid inventory display are still incomplete. Six runtime modules
changed: pickup, options, jsmain, invent, cmd and pager.

## Native evidence

| Recipe | Cases | Screens/cursors | RNG calls |
|---|---:|---:|---:|
| category-autoselect | 23 | 5,554 | 52,909 |
| category-filters | 46 | 11,984 | 124,206 |
| menu-object-symbols | 48 | 11,474 | 110,304 |

All 29,012 screens/cursors and 287,419 RNG calls match. The three
instrumented C re-recordings are exact. Integrity and branch assertions
pass separately. The ledger reaches 2,666/2,666, with 99 scenario categories
covered and seven partial.

The measured C union adds 122 direct outcomes and the first entered
handler_menu_objsyms record, reaching 55,824/108,268 outcomes and
4,376/5,491 entered records. count_categories reaches 12/12;
query_category 133/154; this_type_only 33/34; optfn_menu_objsyms 27/30;
handler_menu_objsyms 11/12; set_menuobjsyms_flags 4/4. Exact missing outcomes
remain in .cache/category-selection/remaining.json. No new unreachable
claims were made. These measurements record execution, not complete fidelity.

The first B selections targeted wished objects whose BUC was unknown.
Those two cases are named unavailable-BUC controls. Identified replacements
exercise all four BUC filters. A potion intersection initially selected the
food row because adding an apple moved the accelerators; it was corrected
and re-recorded. The wielded non-weapon is a potion, not food. Duplicate
heading probes were excluded. The legacy alias's uppercase form really
selects headers in C because its boolean-value arm uses a case-sensitive
comparison. Native output verifies that behavior.

The state gate checks all 117 native replays against 503 item observations
from C's final inventory pages. It checks quantities, ownership, unpaid
state, identified BUC, worn slots, pickup history and cleared query context.
Another 46 constructed groups cover empty lists, mask differences,
confirmation flags and return values, retained counts, unusual ordering,
all symbol bit combinations, parser boundaries and coin filters. The
category-overflow diagnostic uses an invalid constructed pack order and
earns no claim of reachability from a legal configuration.

## Negative controls

| Deliberate regression | Screen misses | Cursor misses | RNG misses |
|---|---:|---:|---:|
| Disable A confirmation | 152 | 127 | 140,335 |
| Ignore worn mask in class counts | 1 | 1 | 0 |
| Force default symbol mode | 54 | 0 | 0 |
| Remove coin BUC classification | 2 | 2 | 0 |
| Exact prior 9ba75b04 runtime | 234 | 149 | 151,838 |

All four mutations fail the state gate. The prior runtime fails all three
fixtures. RNG misses above are positional comparisons, so one extra call
can shift later matches. Loader controls use NODE_OPTIONS so the frozen
scorer's workers inherit them.

## Regression checks and remaining work

The final corpus sweep passes 556/556 fixtures: 44 public and 512 supplemental.
All 419,297 screens/cursors and 10,857,574 RNG calls match. Supplemental
matches 407,892 screens/cursors, 10,064,736 RNG calls and 21,704 animations.
Public retains 21 earlier animation misses. The final sweep follows the
added awaited diagnostic; regression-final.log and totals.json hold results.
Twelve related state gates, 47 hang fixtures, 80 fresh-role games, 14 tool
tests, the strict ledger and the source audit pass. Source audit reports
zero scope/import findings across 268 non-frozen modules. Fuzz remains 101/102,
with the known fixed-date screen mismatch and all 491,759 RNG calls matching.

Invalid numeric configuration correctly records a parser error but the
startup error screen remains missing. The retained extra probe differs
at 233 screens and cursors, starting before gameplay; its error text
contains the recorder's temporary path. It is excluded from passing
fixtures and native coverage credit. Parsing itself has a constructed
check which also verifies that an invalid value preserves the prior mode.

Full dotypeinv, dounpaid, live menu_tab_sep initialization, broader
inventory lifecycle, looting entry paths and unreviewed C/Lua remain open.
The next 64 native probes target all four inventory menu styles and unpaid
inventory. Before the next port they fail 51 screens and 41 cursors, with all
171,668 RNG calls matching. They live in .cache/inventory-types. The full-port
goal continues.
