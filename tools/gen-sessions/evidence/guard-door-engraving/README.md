# Vault doorway engraving regression

The guard now removes the engraving beyond a doorway in both C carving arms.
The five fixed keyboard cases cover both branches and three unchanged controls.
The gate checks the original C recording and input metadata before loading the
game, then observes current state and all five output streams afresh.

Run from the repository root:

```sh
node --max-old-space-size=512 tools/guard-door-engraving-input-gate.mjs
```

An optional argument writes a new compact JSON report. The default writes no
files. Every invocation runs all five cases. The original control body remains
in `source-controls-original.mjs`; its 23/25 baseline and 25/25 candidate reports
are retained. Negative screen, cursor, random-call, per-step random and animation
hashes must remain unchanged.

The raw was generated once from the pinned C implementation. Native checks cover
911 styled boundaries/cursors, 31,087 random calls and zero animation frames.
They compare decoded terminal state and ordered random calls. They do not prove
literal ANSI serialization or completion of the whole port.
