# Monster naming source audit

The 27 C scenarios in `monster-name-editing` and `monster-name-guards` cover
editable names, cancellation, clearing, long names, named-cockatrice
petrification, hero/empty-square selection, fixed unique names, ghosts,
ordinary Angels, roaming clerics, shopkeepers, deafness and hallucination.
They match 2,434/2,434 screens and cursors and 76,316/76,316 core RNG entries.
These reuse established C setups; they are regression controls, not a fresh
estimate of unseen-game accuracy.

The command review read the complete pinned C bodies of `do_mgivenname`,
`alreadynamed`, `new_mgivenname`, `free_mgivenname`, `christen_monst`,
`distant_monnam`, `x_monnam`, `priestname`, and `mon_aligntyp`.
The port follows their decisions, including the original special cases.
Remaining native coverage is explicit:

| C function | Entered direct outcomes in the current union |
|---|---:|
| `do_mgivenname` | 36/50 |
| `alreadynamed` | 20/26 |
| `new_mgivenname` | 4/4 |
| `christen_monst` | 7/10 |
| `x_monnam` | 95/124 |
| `distant_monnam` | 2/8 |
| `priestname` | 42/64 |
| `mon_aligntyp` | 10/10 |

Whole-body review and entered outcomes do not prove whole-function equivalence.
The recorded command cases do not yet cover every visibility/sensing rule,
steed selection, swallowed-monster selection, bone-name refusal, or the
invisible-name matching rule. Native scenarios for priest hallucination,
monster disguises, distant Astral deity suppression, named player-monster
adjectives and leash inventory refresh remain open. Non-ASCII name handling
also needs independent review of the C input-byte contract.

`monster-name-state-gate.mjs` checks all 27 final monster names, cancellation
versus deallocation, 62-character storage, the species-only petrification
killer record, minion owner IDs, extension identity, alignment and renegade
flags. Additional source-state controls cover given-name suppression, ghost
possessives, player-monster rank adjectives, monster disguises, unusual
shopkeepers, game-over naming, and exact versus distant priest naming. The
exact-name control checks that every monster field and hero property is
restored after temporary invisibility and hallucination suppression. These
constructed controls do not earn new native gameplay coverage.

Three shared display issues emerged. `getlin` must replace the no-history
description left by `getpos`. `show_topl` must wrap through `addtopl` at the
terminal's reserved last column. Closing the naming menu must use the window
port's existing restoration; an extra `docrt` changes hallucinated map glyphs.
The long-name and hallucination scenarios expose these errors directly.

The ordinary Angel setup also found an omitted `makemon` decision before
equipment creation: some Angels, and ordinary clerics without caller-provided
extensions, become roaming minions. Its omission shifted the equipment RNG
while all naming screens still matched. The port now allocates `newemin`,
records the owner ID, and applies C's alignment and renegade choices in order.
`mon_aligntyp` now lives in its C home, `priest.js`; callers use that shared
definition. Other minion lifecycle work, including clone extensions, remains
separate and incomplete.

Exact native re-recordings of both fixtures add 87 direct C outcomes and two
entered function records (`do_mgivenname`, `alreadynamed`). The union is
52,835/108,268 outcomes and 4,284/5,491 entered function records. Profiles and
logs are in `.cache/c-coverage/monster-naming-20260905` and `.cache/naming`.
The scenario assertion ledger is 1,394/1,394, a separate measure.

Next: type naming from inventory, floor objects and discoveries. The complete
`namefloorobj` and `rename_disco` bodies have been read, as have the `docallcmd`
dispatch, `docall`, and `docall_xname` bodies. Those commands still have explicit
unported markers. `docall_xname` omits attribute removal, and `docall` omits the
sink-fluid prompt and inventory refresh. Cover these with C traces and
persistent discovery/name checks before declaring them ported.
