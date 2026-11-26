# Corpse naming

This change follows `corpse_xname` in the pinned C source at
`16ff59115315917b93185d026aeefea06db9b0f4`. It restores plural article handling,
glob names, recorded cleric gender, and adjective spacing in the original order.
The complete owner and caller review is in `SOURCE-REVIEW.md`.

The four fixed keyboard cases cover blind plural contact, sighted plural
contact, a blind held stack, and blind singular contact. The original C
recording contains 733 boundaries and 23,926 random calls. The published
baseline matches three cases; the candidate matches all four, including every
decoded styled cell. The three negative reports remain unchanged.

Run the passing owner and gameplay checks from the repository root:

```sh
node tools/corpse-xname-owner-gate.mjs
node tools/corpse-xname-input-gate.mjs
```

The owner check contains 40 constructed cases on objects produced by real
keyboard wishes. The gameplay check runs all four original input sequences,
observes current state, and checks unchanged output under deferred input.
Metadata preflight validates the fixed C recording before either gate runs.

`node tools/corpse-xname-diagnostic-gate.mjs` runs all 46 original assertions.
It still exits 1 with three unchanged `killer_xname` field-restoration failures:
plural, singular, and random cleric. All 46 name values match. Those failures
remain open and are not counted as passing owner checks. Ordinary reach of the
glob branch and arbitrary buffer limits are also outside this checkpoint.

`parent-verification.json` records the final composition and regression checks.
