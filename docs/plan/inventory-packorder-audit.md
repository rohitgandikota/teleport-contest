# Inventory pack order audit

The custom inventory order now follows the pinned C parser and is shared by
inventory, discoveries, class discovery and type-renaming menus. This review
covers `options.c`'s `def_inv_order`, `optfn_packorder`, `change_inv_order`,
`string_for_opt` and the relevant interactive option dispatch and error output.
It does not complete the configuration-file error lifecycle.

C keeps the final occurrence of a repeated class, reports every invalid or
disallowed class, and still applies valid entries. Omitted classes retain their
previous relative order. Gold goes first unless explicitly placed. Venom is
excluded from pack order but appended for full and class discoveries. The
options page displays the stored order rather than the user's input prefix.

The first implementation mishandled empty input after a custom order with gold
last: it moved gold to the front. A C recording reproduced that one-screen
failure. Empty input now leaves the previous order intact. Leading spaces in a
value are invalid classes, while trailing option whitespace is removed. Empty,
whitespace-only and Escape inputs have separate controls.

## Independent recordings and state checks

| Recipe | Cases | Exact screens/cursors | Exact RNG entries |
|---|---:|---:|---:|
| `inventory-packorder` | 8 | 224 | 24,670 |
| `inventory-packorder-live` | 16 | 647 | 49,328 |
| Total | 24 | 871 | 73,998 |

The configuration cases cover default and custom prefixes, a full reverse
order, and explicit gold positions. Live cases cover valid, duplicate,
disallowed and unknown symbols, successive changes, multiple errors, omitted
class order, clearing and cancellation. Inventory, type-renaming and discovery
screens exercise consumers. The final advanced options page supplies C's
complete stored order.

`tools/inventory-packorder-state-gate.mjs` decodes that C options row with the
frozen screen decoder and compares it to the live JS class array for every
case. It also checks uniqueness, venom exclusion and initial parser errors.
Expected full orders are not calculated using the implementation under test.
Three gold-position cases explicitly obtain gold so that placement is visible.

Test construction caught two ineffective assertions before promotion.
Searching for an advanced option from the simple menu did not change it.
Searching in the advanced menu selected it without navigating to its page.
The final recordings use the advanced menu and explicitly expose the stored
value on its page. Raw fixture strings contain compression and escaped quotes;
state expectations use decoded cells, while recipe assertions use raw tokens.

## Native coverage and regression

Both permanent recipes reproduced exactly in the native coverage recorder at
`.cache/c-coverage/packorder-20260905`. They add 42 direct branch outcomes and
four entered function records: `change_inv_order`, `config_erradd`,
`config_error_add` and `vconfig_error_add`. `change_inv_order` reaches 16/16
direct outcomes; `optfn_packorder` reaches 9/12. Entering the error functions
does not imply their complete behavior has been ported.

The verified union is 52,952/108,268 direct outcomes and 4,291/5,491 entered
function records. The separate scenario assertion ledger is 1,456/1,456, with
99 categories covered and seven partial.

The stable runtime passes all 44 public and 429 supplemental fixtures. Public
screens/cursors are 11,405/11,405 and RNG is 792,838/792,838. Supplemental
screens/cursors are 124,701/124,701, RNG is 6,292,842/6,292,842 and animations
are 3,248/3,248. Public animations remain 1,462/1,483. Fuzz remains 101/102 with
the known fixed-datetime artifact: 14,261/14,262 screens, 14,262/14,262 cursors,
491,759/491,759 RNG and 75/76 animations.

All 46 hang checks, 80 role-smoke controls, 16 tool tests, source audit and
pack-order, object-type and inventory-adjustment state gates pass. Role-smoke
seeds are reused controls, not a fresh generalization estimate. Frozen files
are unchanged. Logs are in `.cache/discoveries/`.

## Remaining source paths

Initial rc errors are collected but not presented by the startup lifecycle.
Full option length limits, config-file attribution and error summaries still
need their own C recordings. Discovery sort selection, full-view sorting and
unique-item/artifact sections remain incomplete and are the next source pass.
These limits and the native uncovered outcomes prevent a full-port claim.
