# Master Key trap warnings

The port restores `count_surround_traps()` and `mkot_trap_warn()` from
`src/artifact.c:2708–2770`, called before ambient sounds each world turn.
It counts locations containing an unshown trap, a trapped door or a trapped
container. A bare hand must wield the artifact. Changed counts produce the
same heat description and punctuation as C. The process counter starts at
zero and is excluded from saved game state.

The three original C recordings contain 12 cases. Native parity improves
from 6/12 to 12/12, including full styles, cursors, random calls and their
input boundaries. The ordinary gates pass 318 checks with 24 observation and
deferred-input comparisons. Six complete negative cases and 30 output hashes
remain unchanged. Run from the repository root:

```sh
node tools/master-key-floor-trap-warning-gate.mjs
node tools/master-key-container-door-reset-gate.mjs
node tools/master-key-container-heat-gate.mjs
```

Each gate checks all three exact C recordings, metadata, keys and primary
predicates before importing gameplay. The source observations and assertion
bodies are preserved. `glove-removal-correction.json` explains the only two
changed predictions: C checks for traps before glove removal finishes. The
original 316/318 result and the earlier failed trap setups remain recorded.

`parent-verification.json` records the fresh installed reports, retained
artifact/save checks, 47 timeout checks and the full 959-recording regression.
All 1,250 regression files were fixed before that run. This is coverage of
these recordings, not proof of complete gameplay. Displayed-trap exclusion,
map edges, actual save/recovery of this counter and the next turn after glove
removal remain outside the ordinary cases here.
