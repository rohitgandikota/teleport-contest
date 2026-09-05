# Automatic-pickup options audit

The class filter now follows C's configured values and all four menu styles.
Traditional and combination styles use a text prompt; full and partial styles
use the existing class picker. Both use the configured inventory class order.
Wizard menus append the venom class. The source review covers
`optfn_pickup_types`, `handler_pickup_types` and the object-class path through
`choose_classes_menu`.

Empty text and Escape restore the previous filter. One or more spaces clear
it. Lowercase m enters the menu. A leading a or A means all classes, even
when the remaining text is not the word all. Duplicate and invalid characters
produce C's error while retaining the valid classes in order. C advances its
input pointer before reporting that error, so the message quotes an empty
parameter. This behavior is preserved.

The live prompt and startup values share class validation in options.js.
The existing runtime stores class symbols rather than C's numeric class bytes;
the state gate compares their meanings through C's displayed value. An
intermediate implementation accidentally enabled autopickup when the menu
returned its single-space all-classes value. The paired toggle check caught
that error, and the final code preserves the independent autopickup setting.

## Independent recordings and state checks

| Recipe | Cases | Exact screens/cursors | Exact RNG entries |
|---|---:|---:|---:|
| `autopickup-options` | 30 | 942 | 91,831 |
| `autopickup-type-filter` | 6 | 291 | 18,300 |
| Total | 36 | 1,233 | 110,131 |

The option cases cover all menu styles, text/menu cancellation, default
selection, clearing, all classes, individual toggles, preselection, invalid
values, whitespace, custom class order, wizard venom and normal-mode absence
of venom. The period menu command selects all rows, so the isolated venom
control explicitly selects its letter instead. Both behaviors have controls.

The gameplay cases wish for a potion and a banana, drop both, then walk away
and back. They verify all classes, potions only, food only, a leading-A value,
live clearing and live cancellation. The independent dropped-object override
is disabled in these class-filter controls. Final C inventory screens verify
which objects were collected.

`tools/autopickup-options-state-gate.mjs` reads C's final filter and autopickup
toggle from the recorded options page. It compares those to the stored flags
for every option case. Gameplay checks compare real inventory ownership with
the final C inventory rows and verify that excluded objects remain on the
floor. Parser controls cover partial invalid values, leading spaces, an
internal tab and a missing parameter. Those controls are source checks and
do not earn native gameplay coverage.

## Native coverage and regression

Both native recordings reproduce exactly in
`.cache/c-coverage/autopickup-options-20260905`. They add 34 direct outcomes,
taking the union to 53,212/108,268 outcomes and 4,298/5,491 entered function
records. `optfn_pickup_types` reaches 52/60 direct outcomes. The separate
scenario assertion ledger is 1,564/1,564, with 99 categories covered and
seven partial.

All 44 public and 434 supplemental fixtures pass on the stable runtime.
Public screens/cursors are 11,405/11,405 and RNG is 792,838/792,838.
Supplemental screens/cursors are 128,009/128,009, RNG is
6,619,880/6,619,880 and animations are 3,248/3,248. Public animations remain
1,462/1,483. Fuzz remains 101/102 with the known fixed-datetime artifact:
14,261/14,262 screens, 14,262 cursors, 491,759 RNG and 75/76 animations.
All 46 hang checks, 80 reused role-smoke controls, 16 tool tests, source audit,
and the new and four related state gates pass. Frozen files are unchanged.
Logs are in `.cache/autopickup/`.

## Remaining source paths

This pass does not complete the automatic-pickup predicate. It still ignores
shop cost, object origin and exceptions. Separate dropped/thrown probes now
reproduce those origin failures and are the next pass. Thrown-object pickup
also depends on C's inventory handling of the readied weapon.

Initial error presentation, option duplicate detection and configuration-file
attribution remain open. Two attempted legacy pickup aliases were rejected by
the pinned C options table and were not promoted as gameplay tests. Error
screens include a temporary configuration path, so they need a separate
lifecycle test design. Monster-class choices in choose_classes_menu and the
exception editor/regex backend are outside this completed object-class review.
