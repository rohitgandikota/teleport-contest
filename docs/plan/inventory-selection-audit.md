# Traditional inventory selection

Eighty-nine C cases now match 27,315 screens and cursors and 220,405 RNG
calls. They cover identification, dropping and takeoff through C's shared
selection chain. The C coverage union gains 118 direct outcomes and one
entered function record, ckunpaid. It reaches 55,059/108,268 outcomes and
4,357/5,491 entered records. Those counts measure execution, not complete
gameplay fidelity.

## Source review and changes

The complete ggetobj and askchain bodies in invent.c:2202..2537 were read
before implementation. ggetobj gathers eligible classes, bless/curse and
unpaid filters, handles inventory display and menu handoff, and retains
the requested class order. askchain applies each class in that order,
prompts for individual objects, splits counted stacks when allowed,
recombines refused splits, enforces attempt limits and clears bypass bits.
It revalidates each object against the changing chain before using it.
Its query naming uses safe_qbuf and the two C xprname callbacks.

identify_pack now invokes ggetobj for Traditional mode. A category cancel
returns zero, so identify_pack repeats that prompt while identifications
remain. An item-level quit returns minus one and ends identification.
Menu requests return minus two or minus three. The remaining count is
passed to menu_identify. These behaviors are preserved, including the
seemingly surprising category-cancel retry.

do.c's doddrop and complete menu_drop control flow now support all four
menu styles, category handoff, automatic selections, single just-picked
stacks and revalidation after inventory mutation. do_wear.c's doddoremarm
and menu_remarm share ggetobj and query_objlist. The separate
ggetobj_takeoff implementation and its private menu/filter helpers are
removed. Its old global letter sort could override the requested class
order; the new native reversed-class case detects that difference.

count_buc lives in invent and is shared with pickup's category menus.
Priests learn blessing state before the optional object filter runs;
coins remain unknown at the object level and follow goldX for category
counts. allow_category uses the role's numeric monster ID, set_bknown,
the paranoid auto-selection flag and C's intersection of filter types.
Category state now belongs to the game. collect_obj_classes counts all
objects while filtering only the offered class symbols. count_unpaid,
count_justpicked, wearing_armor and is_worn retain the C predicates.

The complete sortloot, sortloot_cmp, loot_xname and invletter_value bodies
were read and ported to support the shared selection chain. inuse_classify
uses the C output record and rating order. The comparator handles class,
inventory letter, name, blessing, grease, erosion, proofing, enchantment
and stable ties. Name sorting temporarily suppresses the same object
prefixes and wizard formatting as C, then restores them. askchain uses
SORTLOOT_INVLET; several other comparator modes currently have only
constructed tests through this new implementation. Existing pile and
container menus still use the older sortloot_items helper.

The complete worn.c bypass helpers clear nested object chains, living
monster inventories, migrating inventories, floating ball and chain, and
the polymorphed long-worm marker. moveloop_core performs C's bypass cleanup
before elapsed-time processing. noarmor includes the embedded dragon
scales message. container_gone recognizes the two container callbacks;
traditional container callers and their explosion paths remain next.

## Independent evidence

| Recipe | Cases | Screens/cursors | RNG calls |
|---|---:|---:|---:|
| traditional-identification | 29 | 9,107 | 69,812 |
| traditional-drop | 42 | 13,027 | 108,364 |
| traditional-takeoff | 18 | 5,181 | 42,229 |

All three instrumented C re-recordings are exact. Integrity and branch
assertions also pass separately. The assertion ledger is 2,154/2,154,
with 99 covered and seven partial scenario categories. The union covers
106/126 direct ggetobj outcomes, 100/124 askchain outcomes, 20/20 count_buc
outcomes and 10/10 nxt_unbypassed_loot outcomes. The missing outcomes are
listed in .cache/inventory-selection/remaining.json. None were declared
unreachable in this pass.

The state gate replays all 89 C inputs and checks 33 observed C
identifications, object quantities, unpaid remainders, removed equipment
and cleared bypass state. Thirty-five constructed control groups cover
category-return values, maximum attempts, negative callback results,
deleted and newly added objects, refused splits, welded and cursed stacks,
filter intersections, priest side effects, coin categories, letter and
name ordering, overflow letters and bypass cleanup across object owners.
Constructed controls earn no native coverage or reachability credit.

The exact 54ad0802 runtime was loaded across all seven changed modules.
It fails all three new fixtures, missing 2,023 screens, 1,416 cursors and
140,606 positional RNG entries. Takeoff alone misses two screens and two
cursors with all RNG matching. A separate loader mutation disables the
advance to the next selected class. It fails both drop and takeoff
fixtures on eight screens, four cursors and 87,918 positional RNG entries.
The native state check independently rejects three remaining daggers
where the C action dropped them. Positional RNG differences can propagate
after one omitted action; these are not counts of distinct logic bugs.

## Probe corrections and regression checks

Four initial identification probes ended inside the category retry prompt.
Their replacements acknowledge the intervening message and complete the
next selection. The first loadstone input needed its wish message
acknowledged. Applying Traditional mode to an existing shop setup changed
pickup before the action under test. The corrected shop cases perform the
original setup and change menustyle through the live option menu. Only
the corrected cases were promoted. The first assertion for the rejected
identification retry used the wrong dagger enchantment; it was corrected
to the recorded C value, minus four, before promotion.

The first broad sweep passed 508/531 fixtures. The new menu_drop read an
unset menu_style as a mode other than Full, whereas old callers supplied
their own fallback. C initializes flags.menu_style to MENU_FULL in
options.c:7258. jsmain now stores that default before reading explicit
options to the live flags. The next sweep passes all 531 existing fixtures with all 249,251
screens/cursors and 9,273,681 RNG calls matching. The prior 21 public
animation misses remain.

The 47 hang checks, 80 role controls, 16 tool tests, new state gate and
twelve related state gates pass. Source audit reports zero findings in
268 modules. Fuzz remains 101/102 with the known fixed-date screen miss;
all 491,759 RNG calls match. No C-recorder or frozen files changed.
The final expanded sweep passes all 534 fixtures, 44 public plus 490
supplemental, matching 276,566 screens/cursors and 9,494,086 RNG calls.
It retains the same 21 public animation misses. All job exits were checked,
including the negative state gate's expected failure.

The rest of query_category and query_objlist remains under review. Native
coverage still lacks container prefixes, container destruction and some
split-restoration branches. Sorting integration, traditional container
selection and the remaining spell, inventory, monster and Lua paths
continue under the full-port goal.
