# Shared monster creation and carrier messages

Verified on 2026-09-05. The full-port goal remains active.

The visible carrier scenario first matched all 35,571 RNG entries but missed
five screens and two cursors. C announced a random jackal before a carried
figurine transformed. JS skipped that shared creation message and displayed
the figurine message too early.

`makemon` now owns C's arrival and occupation tail at makemon.c:1472-1506.
It redraws the new monster, names visible or sensed monsters and disguises,
sets message coordinates, applies repeated-message suppression, and checks
whether a new threat interrupts the hero's activity. Runtime callers wait for
that work. Group members finish before the parent's inventory and arrival.
Level construction keeps its synchronous return; player-monster and roamer
construction preserve that behavior with conditional continuations.

The old arrival copies in apply, read, sit, were and wizard are removed.
Shared mimic naming exposed two earlier pager errors: the wrong remembered
glyph field and the wrong fields in `object_from_map`'s result. The full
`mhidden_description` C body was reviewed to fix those accesses. An invisible
nymph also exposed theft's use of `Monnam` instead of the name C caches with
`Some_Monnam`. The cache is refreshed if equipment removal reveals the thief.

Three permanent recipes add 12 independently recorded C cases:

| Recipe | Cases | C behavior checked |
|---|---:|---|
| creation-carriers | 4 | Visible and invisible carriers, lit, dark and occluded release spots, random arrival before figurine message |
| creation-groups | 4 | Independent monsters, grid-bug and jackal groups, child/parent ordering and repeated arrival suppression |
| creation-occupation | 4 | Named kitten, bat, unseen stalker and disguised mimic created during counted searching |

All 2,352 screens/cursors, 208,608 RNG entries and 7,033 animations match.
`tools/creation-state-gate.mjs` checks all 12 replays: independent C timer
deadlines, original and monster-inventory ownership, disposal, names, group
disposition and the occupation state at the creation boundary. Separate source
controls check synchronous level construction, the occupation check despite
`MM_NOMSG`, and an unseen threat that does not interrupt. Those controls do
not earn native C coverage.

The isolated loader `.cache/creation/skip-occupation.mjs` omits only the
shared `dochugw` call. With the loader inherited by the scoring worker, the
occupation fixture falls to 543/566 screens and 21,313/81,481 RNG entries.
The direct state gate also rejects the retained occupation. A command-line
loader applied only to the parent scoring process was a rejected control;
the runner starts another Node process without forwarding those flags.
Use `NODE_OPTIONS` for inherited mutations. The previous bag-weight and
detection mutations were rechecked this way and still pass their visible
replays while their state checks catch the retained values.

Final verification passes all 44 public and 456 supplemental fixtures.
Supplemental totals are 156,523 exact screens/cursors, 7,717,269 RNG and
21,320 animations. Public remains 11,405 screens/cursors, 792,838 RNG and
1,462/1,483 animations. Fuzz remains 101/102, with the known fixed-date screen
mismatch: 14,261/14,262 screens, all 14,262 cursors and 491,759 RNG, and
75/76 animations. The 47-session hang gate, 80 role controls, 16 tool tests,
source audit, new state gate and three related state gates pass. The assertion
ledger is 1,790/1,790. Logs are under `.cache/creation/`.

All three native recordings are exact in
`.cache/c-coverage/creation-20260905`. They add 15 direct outcomes and no new
entered function records. The measured union is 53,785/108,268 outcomes and
4,310/5,491 entered records. `fig_transform` reaches 38/56 outcomes,
`makemon` 244/276, `m_initgrp` 11/14, `dochugw` 24/26,
`mhidden_description` 23/70 and `steal` 78/216. These counts measure C
execution, not whole-game completion or proof of all JS state.

The remaining work is explicit. `steal` still lacks delayed armor theft and
several selection, punishment, billing and petrification paths; its full C
body has been read, but this pass fixes only the cached name. The existing
`mk_mplayer` and `mk_roamer` occupied-square relocation markers remain.
`makemon` still lacks the no-inventory disposal arm, among other previously
unported paths. `mhidden_description`'s region-length bound remains outside
this fix. Special-level callbacks still use synchronous creation, and runtime
Lua execution needs its own port; do not classify all `maketrap` use as level
generation, since wizard wishes can create statue traps during play.

The invisible-carrier setup required a new C deadline. Its second attachment
is 6,384 + 200 turns after acquisition, with deadline 6,587. A long wait was
interrupted at turn 144, so the final recipe resumes the remaining wait and
verifies the carrier at turn 6,586. Diagnostic `#timeout` pointer frames remain
only in ignored probes. Permanent recipes contain no pointer output.
