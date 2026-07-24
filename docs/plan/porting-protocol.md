# The porting protocol

The repeatable recipe for turning one C function into one JS function. Follow it
every time. It exists so that two agents working a week apart produce code that
looks like it came from one hand.

---

## Before you start

You should already know, from the milestone file, the exact C file and function
name in scope. If you do not, you are about to read too much. Go back.

## Step 1 — Locate, do not browse

```bash
grep -n "^dosearch" nethack-c/upstream/src/detect.c
```

Then `Read` with `offset` and `limit` covering just that function plus a few
lines either side. Never read the whole file. `src/options.c` is 10,225 lines;
`src/trap.c` is 7,211.

For a symbol whose home file you do not know:

```bash
grep -rn "\bdosearch\b" nethack-c/upstream/src/ nethack-c/upstream/include/ | head -20
```

For a struct or constant, grep `include/`, not `src/`.

## Step 2 — Read the declaration too

`include/extern.h` has the prototype; `include/*.h` has the types. Knowing
whether a parameter is `boolean`, `schar`, or `unsigned` matters: NetHack relies
on integer wrapping and signed char ranges in places, and JS numbers do not wrap
on their own. Where the C depends on a narrow type overflowing, reproduce it
explicitly (`| 0`, `& 0xff`, `<< 24 >> 24`) and comment why.

## Step 3 — Port it as written

- Same function name, same parameter names, same order.
- Same control flow. Do not collapse an `if/else` chain into a lookup table, do
  not hoist a repeated subexpression, do not convert a `for` into a `map`.
- **Preserve expression structure exactly.** Argument order, `&&`/`||`
  short-circuit structure, and the position of every `rn2()` call inside a larger
  expression all determine RNG consumption order. This is the most common cause
  of a divergence that no one can find later.
- Port the bugs. If the C has an off-by-one, so do we.
- Comments: keep the C's own comments where they explain intent. Do not add
  commentary explaining JS.

Provenance header on every function:

```js
// src/detect.c:1893 dosearch0()
function dosearch0(aflag) {
```

## Step 4 — Globals

The C uses global structs (`gm.`, `u.`, `gl.`). Use the module-scoped state
already established in `js/gstate.js`. Do not add parameters to a signature to
avoid a global — that changes call sites the C never changes, and every one of
those is a Phase 2 diff line.

## Step 5 — Verify against the recorder, not against your reading

A port is not done because it looks right. It is done when the RNG stream and the
screens agree with C.

Fast single-session check:

```bash
node frozen/ps_test_runner.mjs sessions/seed8000-tourist-starter.session.json
```

Full public sweep:

```bash
bash frozen/score.sh
```

**Neither RNG nor screen count may regress.** If either drops, fix it or revert
before doing anything else. A regression buried under three commits costs hours.

## Step 6 — When the RNG diverges

This is the core debugging loop, and it is much better than it looks.

The recorded sessions carry an `@ caller(file:line)` annotation on every C-side
PRNG call. The scorer strips it before comparing, but it is still in the JSON.
So when our call number 392 disagrees with C's call number 392, the session file
tells us **exactly which C source line** made C's call.

```bash
# What did C call at index 391, and from where?
node -e "
const j=require('./sessions/seed0007-rogue-snake-swamp.session.json');
let i=0;
for (const seg of j.segments) for (const st of seg.steps||[])
  for (const r of st.rng||[]) { if (i>=385 && i<=400) console.log(i, r); i++; }
"
```

Read the divergence backwards: the last *matching* call tells you the last
function we got right; the first mismatching call names the C function we have
not ported, or the expression whose evaluation order we changed. Port that
function. Re-run. Repeat.

Do not guess. Do not "try adjusting an rn2 argument until it lines up" — that is
overfitting with extra steps, and it will break on the held-out set.

## Step 7 — When the screen diverges but the RNG matches

The game state is right and the drawing is wrong. That is a windowport or display
bug, and it is usually one of:

- a `--More--` we emitted or failed to emit (shifts every later frame),
- a cursor left in the wrong place,
- a status line field formatted differently,
- a colour or attribute on a glyph,
- a map cell drawn from the wrong glyph table.

Use `tools/session-viewer/` to see the recorded frame next to ours.
`frozen/screen-decode.mjs` is the same decoder the scorer uses; the comparator
forgives SGR and charset encoding differences but not pixels.

## Step 8 — Retire fastforward entries

If the function you just ported is one whose RNG calls `js/fastforward.js` was
faking, delete those entries in the same commit. Never add an entry.

## Step 9 — Commit

One logical unit per commit. Message names the C file and what was ported:

```
Port dosearch/dosearch0 from src/detect.c
```

No AI attribution, no trailers. Then update the milestone checklist and, if the
milestone is finished, the status board in `README.md`.

---

## Checklist before you call an item done

- [ ] Function names match the C verbatim
- [ ] Provenance comments present
- [ ] Expression and short-circuit structure unchanged from the C
- [ ] No new abstraction without a C counterpart
- [ ] No hardcoded seed, session name, screen, or RNG value
- [ ] No stub or placeholder left behind
- [ ] `frozen/score.sh` shows no RNG or screen regression
- [ ] Any `fastforward.js` entries this port replaces are deleted
- [ ] Milestone checklist ticked
