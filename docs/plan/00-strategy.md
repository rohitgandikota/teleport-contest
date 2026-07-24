# M0 — Strategy and architecture decisions

Read once. This explains why the plan is shaped the way it is. Everything here is
drawn from `/README.md`, `docs/API.md`, and `docs/PHASES.md`, plus measurements
of this repo taken 2026-07-24.

---

## 1. What is actually scored

One point per **step** where our rendered 24x80 grid matches C's exactly:
character, foreground colour, attribute bits, and DEC-graphics flag per cell.

| Pool | Sessions | Steps |
|---|---|---|
| Public (`sessions/`) | 44 | 11,284 |
| Held out (judge only) | 44 | 10,538 |
| **Total** | 88 | **21,822** |

Things that follow from this, and that are easy to get wrong:

- **PRNG parity earns zero points directly.** It is published as an advisory
  percentage. It matters only because a divergent RNG stream desynchronises game
  state and every subsequent screen fails. Treat RNG as a *diagnostic*, not a
  goal. A 100% RNG match with a blank screen scores nothing.
- **Most of the work is the terminal, not the game.** The README says so
  explicitly and the file sizes agree: the message line, menus, prompts, cursor
  choreography, and status lines are where the bytes come from. A perfect
  simulation of dungeon logic that draws the map one column off scores zero.
- **Partial credit is per step and independent.** Diverging at step 50 of 400
  still banks 50. So breadth across sessions beats depth in one.
- **Screens are captured at input boundaries** — every time C's `tty_nhgetch()`
  blocks. Frame 0 is the state before any key is consumed. Getting the *number*
  and *placement* of boundaries right is itself part of the problem: an extra or
  missing `--More--` shifts every subsequent frame and forfeits the rest of the
  session.

### The qualification ambiguity — plan around it

`README.md` says the top 10 qualify for Phase 2 "by score". `docs/PHASES.md`
says "by total **session-pass count**". `docs/API.md` calls whole-session passes
the "strict-perfect tiebreaker". These do not agree.

**Hedge:** prioritise finishing the short sessions end to end, not just
accumulating partial credit on the long ones. Eight public sessions are 23-40
steps; those are cheap whole-session passes and they are qualification insurance
under either reading. The long sessions (1,814 and 1,953 steps) are where raw
screen points live, but they are worthless for a pass-count metric until they are
complete.

### Session size distribution (public, measured)

Shortest 8: `seed8000-tourist-starter` (23), `seed0102-ranger-name-cancel` (25),
`seed1800-tourist-eat-throw` (26), `seed0101-ranger-quiver-throw-travel-engrave`
(27), `seed0501-priest-cast-read-turn` (28), `seed0105-valk-chat-lamp-ration`
(30), `seed0077-rogue-chargen` (33), `seed0016-healer-newmoon-eat-zap` (36).

Longest 4: `seed0030-ten-diverse-deaths` (1,953 steps across 10 segments),
`seed4500-knight-coverage` (1,814), `seed0360-wizard-world-tour` (833),
`seed0014-dequa-fountain-explore` (714).

Two thirds of all public steps sit in the ten longest sessions. Do not start
there.

---

## 2. Why the port mirrors the C one to one

Phase 2 score = parity against a "NetHack 5.1" target, **divided by** the diff
between our Phase 1 freeze tag and our 5.1 submission:

```
git diff phase1/<tag> HEAD -- 'js/**' \
  ':(exclude)js/isaac64.js' ':(exclude)js/terminal.js' --numstat
```

Note `js/storage.js` is *not* in the exclude list even though it is frozen. Do
not touch it either way.

The 5.1 target will be described as a change to the **C**. If our JS is a
one-to-one image of the C, then a C diff of N lines maps to a JS diff of roughly
N lines, and we can retarget mechanically. If our JS is a clever re-architecture,
every C hunk requires a translation step and the diff multiplies.

This is the single highest-leverage decision in the whole project, and it is also
the decision that makes Phase 1 easier: a one-to-one port is the only form of
port whose RNG call order is verifiable by construction.

**Concretely:**

- `js/<name>.js` ↔ `src/<name>.c`, `js/tty/<name>.js` ↔ `win/tty/<name>.c`.
- C function names kept verbatim. `dosearch` stays `dosearch`.
- Function order within a file follows the C.
- Provenance comment on every function: `// src/mklev.c:412 makeniches()`.
- No helper, wrapper, or abstraction that has no C counterpart.

The cost is JS that does not look like idiomatic JS. Accept it. Idiomatic JS is
worth zero points and costs Phase 2 points.

---

## 3. Argument evaluation order

C leaves argument evaluation order undefined. gcc goes right to left, clang goes
left to right, and JS goes left to right. The recorder is pinned to clang for
exactly this reason. So `d(rn2(5), rn2(3))` ports directly and consumes RNG in
the same order.

**But:** any place we restructure an expression — hoisting a subexpression into a
temporary, reordering a `&&` chain, converting a nested call into two statements
— can silently reorder RNG consumption. Port expressions *as written*, including
short-circuit structure. This is the number one source of RNG divergence and it
is invisible in code review.

## 4. Three PRNG contexts

Core gameplay, Lua (special levels), and display (hallucination) are independent
streams. Patches 003-005 in `nethack-c/patches/` instrument all three. The port
must reproduce all three in the right order. `seed0383-wizard-hallucinate` and
`seed0399-wizard-hallu-actions` (219 and 532 steps) exercise the display stream
specifically; the quest tours exercise the Lua stream.

## 5. What the sessions tell us to build

Session names are a coverage spec. Reading the list: chargen for every role
(`rogue-chargen`, `ranger-name-cancel`), movement and exploration, search, kick,
travel, engrave, quiver and throw, eat, quaff, zap, read, cast, pray at altars,
chat, apply lamp, wear, shops, vaults, escorts, fountains, riding a pony,
two-weapon and enhance, extended commands and the wishlist, polymorph, water
demons, hallucination, quest tours for multiple roles, Friday the 13th and moon
phase, save then restore, and ten diverse deaths.

That is close to a complete tour of the game. There is no small subset that wins.
The plan is therefore ordered by *dependency*, not by session count.

---

## 6. Open decisions (resolve when the milestone reaches them)

**D1 — Lua.** NetHack ships 131 `.lua` files in `dat/` driving special levels and
quests, executed through `src/nhlua.c` against a real Lua VM, with its own PRNG
context. Two options:

1. Hand-port each `.lua` file's effect into JS. Faster to a first quest screen,
   but 131 files of translated data that all have to be re-diffed if 5.1 touches
   any of them.
2. Write a small Lua interpreter in JS and ship `dat/*.lua` as embedded string
   modules. Much more work up front, but a 5.1 change to a level script becomes a
   data change with a near-zero `js/**` diff.

Option 2 is almost certainly correct given the Phase 2 formula. Decide in M9, not
before. Note a constraint: the judge sandbox allows filesystem *reads* of our
fork's tree only, and `nethack-c/upstream/` is a git submodule that may not be
checked out in the judge's environment — so the Lua sources must be embedded into
`js/` as generated modules, not read from disk at runtime.

**D2 — data tables.** `src/objects.c`, `src/monst.c`, `include/artilist.h`,
`src/role.c` are large static tables. These should be generated into `js/` by a
dev script under `tools/` (which does not count toward the Phase 2 diff) rather
than hand-typed, and regenerated from 5.1 rather than hand-edited. Set this up in
M2 when the first table is needed.

**D3 — chargen RNG order.** Unknown until measured. M2 resolves it against the
recorder.

---

## 7. Anti-goals

- No hardcoded seeds, session names, screens, or RNG sequences. Ever.
- No "make this one session pass" special cases.
- No performance work until `frozen/play.sh` says we are below the playability
  threshold. Correctness first; the sandbox allows 900 s per session.
- No refactor of ported code into a nicer shape. The shape is the C's shape.
