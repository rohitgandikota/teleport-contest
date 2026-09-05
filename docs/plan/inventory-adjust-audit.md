# Inventory organization source audit

Verified 2026-09-05 against the pinned recorder C tree. This is an incremental
review under the active full-port goal. The functions below are not a claim
that the rest of `invent.c` has been reviewed or that all their paths are tested.

| C function | Source review and current implementation | Outcomes in the first 50 C scenarios |
|---|---|---:|
| `invent.c:4981 doorganize` | Empty/gold-only refusal, floating letters, gold sanity filter, count-enabled getobj | 12/14 |
| `invent.c:5068 doorganize_core` | Split detection, slot suggestions, retries, rollback, collection, name rules, merge/swap/bump, reinsertion | 115/132 |
| `invent.c:5008 adjust_split` | Item-action count parsing, two-item shortcut, cancellation and bounds | 18/22 |
| `invent.c:3467 display_used_invlets` | Class ordering, source-slot exclusion, object glyphs, selection, empty selection and cancellation | 22/24 |
| `invent.c:4855 reassign` | Gold first, consecutive lower/upper-case letters, overflow and rolling-letter counter | 12/16 |
| `invent.c:814 merged` | Reviewed full body; equipment and light cleanup fixed, other lifecycle gaps remain below | 29/50 |
| `light.c:808 obj_merge_light_sources` | Extinguish the removed source and recompute surviving candle radius synchronously | 4/8 |

The core routine previously tested only 51/132 outcomes; the split command,
used-letter menu and floating-letter assignment had never entered the measured
baseline. Its first 13 new scenarios improved from 423/490 to 490/490 screens,
427/490 to 490/490 cursors, and 14,287/36,811 to 36,811/36,811 RNG entries.

The permanent fixtures contain 35 command/count/menu/capacity cases, eight
named-stack cases, and seven equipment/light cases. All 3,642 screens and
cursors and 144,726 RNG entries match. Every recipe asserts final inventory
cells as well as the branch's message. This prevents a setup message from
being mistaken for evidence that the final quantities or names are correct.

Three shared omissions became visible while extending the cases. Item-action
naming ignored the queued category key. Floating inventory printed the chosen
letter before `obj_to_let` reassigned it. Unsorted inventory always emitted
class headings and omitted C's conditional object symbols. The fixes use the
corresponding C command, inventory, options, and tty paths.

Equipment merging also needed C's precedence: primary weapon, alternate
weapon, then quiver. The surviving object now owns the selected equipment slot,
and conflicting slots are cleared. `inventory-adjust-state-gate.mjs` checks
the actual object references, not just an object's printed worn suffix.

A lit-candle case already passed every screen and RNG entry while JS retained
an orphan light source and a surviving radius of three. C's merge removes the
old light and gives ten candles radius four. The state gate checks one light,
one burn timer, their ownership, and that radius. Both cleanup routines are
synchronous now, since they only change state and C requires the light cleanup
to finish before timer cleanup. A clean isolated runtime passes; removing the
light-merger call in that copy fails the new assertion. The fault-injection log
is `.cache/inventory-adjust/mutation-control.log`.

The exact C profiles add 217 outcomes and five function records to the prior
baseline-plus-corpse union: `cmdq_add_int`, `splittable`, `reassign`,
`adjust_split`, and `display_used_invlets`. The total is 52,680/108,268 outcomes
and 4,280/5,491 function records. The union was computed from full LLVM branch
tuples, checking each function's branch order and structural fields. Do not
deduplicate missing outcomes by line/column: multiple compiled branches can
share a source coordinate. The full profile is
`.cache/c-coverage/inventory-adjust-20260905/`; the union calculation and
summary are in `.cache/inventory-adjust/coverage-union.mjs` and
`coverage-union-summary.json`.

## Follow-up inventory and naming controls

Eight further cases exercise these previously untested decisions:

- A used-letter menu with multiple objects of one class, so an existing heading
  is reused (`invent.c:3490`).
- Floating letters with all 52 slots occupied, including upper-case letters and
  the counter clamp (`4874`, `4881`, `5109`).
- Reject `@` and `-` as destination letters (`5172`).
- Collect an unnamed incompatible stack, testing a failed merger (`5205`).
- Move or split an unnamed stack into a named destination (`5214`, `5238`).

Their first run passed seven of eight. Clearing a stack's name with spaces
failed because `do_oname` treated the normalized empty name as cancellation.
It now uses C's `name_from_player`: raw empty or escape input cancels; spaces
clear the name; other input is normalized and capped at 62 characters. The
shared `ONAME` accessors now use the port's actual flat name field, so the item
menu correctly offers rename/un-name. Six additional C naming controls cover
cancel, escape, spaces, whitespace folding, truncation, and a named corpse.

`object-name-state-gate.mjs` verifies the full stored names, including the
62-character name whose inventory row only displays 59 characters. It also
checks that `killer_xname` suppresses a player name and restores every field.
That check also found an article omission that the C fixture did not expose:
the helper used C's `!strstri` even though the JS search returns -1 for no match. It now uses
the correct negative-index check and formats `a cockatrice corpse`.

The two new fixtures match 2,139 screens/cursors and 36,663 RNG entries. Their
exact profiles add 46 direct outcomes to the union, now 52,726/108,268 with
4,280/5,491 function records. The union reaches `doorganize_core` 122/132,
`display_used_invlets` 23/24, `reassign` 15/16, and `name_from_player` 6/6.
The remaining outcomes still require source and reachability review.

## Next decisions to exercise

Some cold outcomes are guards rather than normal gameplay. An empty inventory
cannot reach the used-letter menu through `doorganize`; getobj and the item
menu rule out several invalid `adjust_split` arguments. Ordinary gold is
excluded from adjustment unless the inventory is already malformed. Overflow
slot and artifact-split cases need a source-backed reachability argument before
adding a scenario. Do not fabricate an impossible state for coverage credit.

Several nearby implementation gaps remain verified by source inspection:
`merged()` does not yet call `obfree(obj, otmp)`; its existing naming step copies
the name instead of going through `oname`; and `mergable()` still marks
`same_price` unported and refuses unpaid merges. Compare the discarded-object,
identity, bill, timer and transient-reference behavior against C before closing
that review. Six new unpaid merge/cancel/drop/pickup/payment C probes already
fail at 474/502 screens and 21,694/32,204 RNG entries. Custom pack order and
menu-symbol options still need their own controls, as do artifact naming and
the rest of the naming worker's branches.

Full C/JS state checkpoints and a general mutation system remain future work.
The new source-derived state assertions and single isolated fault injection
are narrower tools. Keep fresh evaluation batches separate from these now
debugged regression fixtures, and retain first-run results before fixing them.

Reproduce the focused checks with:

```bash
node tools/gen-sessions/record.mjs inventory-adjust-source-gaps inventory-adjust-named-stacks inventory-adjust-equipment
node frozen/ps_test_runner.mjs tools/gen-sessions/generated/inventory-adjust-source-gaps.session.json tools/gen-sessions/generated/inventory-adjust-named-stacks.session.json tools/gen-sessions/generated/inventory-adjust-equipment.session.json
node tools/inventory-adjust-state-gate.mjs
```
