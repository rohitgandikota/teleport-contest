# Discovery sorting and identification audit

Discovery display now follows the pinned C decisions for sort selection,
class menus, unique items and artifacts. The independent recordings also
exposed missing identification state, permanent blindness initialization,
novel naming and the Amulet's initial wish message. Those dependencies are
included in this pass. This is a bounded source review, not a full-game claim.

## Source review and behavior

The review covers the full bodies of `dodiscovered`, `doclassdisco`,
`choose_disco_sort`, `discovered_cmp`, `sortloot_descr`, `disco_fmt_uniq`,
`disco_output_sorted`, `oclass_to_name` and `get_sortdisco` in `o_init.c`.
The discovery commands own their C-equivalent windows. Sort order persists
across full discovery, class discovery and the options menu. Traditional and
combination class prompts accept unavailable classes hidden after an Escape
byte; a partial menu skips class selection when only one class is available.

`invent.c`'s `loot_classify` is shared with pickup's existing sorter. It uses
C's class order, armor remapping, weapon skills, container/instrument groups,
food groups, gem material and knowledge rank. Sorting a dummy known spellbook
has an unusual persistent effect in C: sighted classification observes it
after writing the first encountered marker. The next display loses the star.
A blind control retains the star, and neither case creates an inventory item.

Artifact discovery and dump output use `artifact.c`'s stored discovery order,
role-adjusted alignment and creation flags. `wiz_identify` now supports its
default control-I binding and C's temporary revelation menu. Selecting items,
classes or the all-items entry permanently identifies them. Cancelling leaves
their actual knowledge unchanged. `not_fully_identified` resides in objnam.js
and includes statue/container knowledge, artifact discovery and erosion
knowledge. Identification calls the existing container and egg helpers.

The naming review separates temporary override-ID locals from real object
flags. Sighted naming can find an artifact; blind revelation cannot. Unknown
novels display as books and known novels as novels. Gray stones use the
compiled MINERAL material. The per-game object description table receives
C's generic fruit name, distinct from the preferred fruit list; this also
removes a reproduced extra random draw when wishing for slime mold.

Permanent blindness now initializes its intrinsic source, and clearing a
temporary blindness timeout preserves that source. The Amulet's first wish
uses C's urgent message path. An ordinary message could be suppressed after
Escape, shifting subsequent commands into the wish prompt.

## Independent recordings and state checks

| Recipe | Cases | Exact screens/cursors | Exact RNG entries |
|---|---:|---:|---:|
| `discovery-sort-order` | 19 | 141 | 58,577 |
| `discovery-sorting-details` | 31 | 1,257 | 93,008 |
| `discovery-identification` | 22 | 677 | 65,322 |
| Total | 72 | 2,075 | 216,907 |

Cases cover all four sort orders and menu styles, letter/numeric configuration,
negation with a value, cancellation, default selection, positive class choices,
empty views, custom pack order, named types, artifact/relic sections, selected
identification, blind revelation, novels and the real/fake Amulet distinction.
The real Amulet tests explicitly decline its extra wish and verify that it
appears in the unique section only after identification.

The state gate replays all 72 C scenarios. Expected sort modes and discovery
markers are read from decoded C screens. Additional checks cover persistent
knowledge, artifact discovery, type names, dummy ownership, menu style and
the one-time Amulet wish. Constructed controls cover erosion knowledge,
statues, tin lock knowledge, artifact counting, invalid armor categories and
temporary blindness removal. Constructed controls earn no native coverage.

An isolated Node loader replaces only the permanent blindness source
assignment with zero. The mutated implementation still passes all 677 screens
and 65,322 RNG entries in the identification fixture. The state gate rejects
it at the missing FROMOUTSIDE bit. The unmodified implementation passes both
checks. This demonstrates a stored-state defect that output parity alone
does not detect. The loader and logs are in `.cache/discoveries/`.

## Native coverage and regression

All three recordings reproduce exactly with native instrumentation in
`.cache/c-coverage/discovery-sorting-20260905`. They add 226 direct branch
outcomes and seven entered function records. The tuple-preserving union is
53,178/108,268 direct outcomes and 4,298/5,491 entered records.

| C function | Reached direct outcomes |
|---|---:|
| `dodiscovered` | 61/66 |
| `doclassdisco` | 114/124 |
| `choose_disco_sort` | 11/12 |
| `sortloot_descr` | 5/6 |
| `disco_output_sorted` | 5/6 |
| `loot_classify` | 96/114 |
| `disp_artifact_discoveries` | 8/10 |
| `not_fully_identified` | 16/30 |

The separate scenario assertion ledger is 1,528/1,528, with 99 categories
covered and seven partial. It is not a measure of complete C branch coverage.

The stable runtime passes all 44 public and 432 supplemental fixtures. Public
screens/cursors are 11,405/11,405 and RNG is 792,838/792,838. Supplemental
screens/cursors are 126,776/126,776, RNG is 6,509,749/6,509,749 and animations
are 3,248/3,248. Public animations remain 1,462/1,483. Fuzz remains 101/102
with the known fixed-datetime artifact: 14,261/14,262 screens, 14,262 cursors,
491,759 RNG and 75/76 animations. All 47 hang checks, 80 reused role-smoke
controls, 16 tool tests, source audit and discovery, pack-order, object-type
and inventory-adjustment state gates pass. Frozen files are unchanged.

## Remaining source paths

Uncovered native outcomes remain visible in the table above. General inventory
sorting and in-use filtering still need source review beyond the identification
path. Alphabetical comparison has ASCII recordings; C byte semantics for
non-ASCII input are not verified. Artifact dump flag combinations are not
exhaustively exercised. Initial configuration errors are collected but are
not presented by the startup lifecycle. Bare negated sortdiscoveries takes
that error path, so the valid negation control supplies a value.

Menu-style consumers outside class discovery remain incomplete. In particular,
`optfn_pickup_types` skips the traditional text prompt and compares menu style
to strings rather than C's numeric values. That is the next source pass.
`make_blinded` still needs its non-transition messages and full blindness-toggle
effects. The permanent source fix does not complete that function.
