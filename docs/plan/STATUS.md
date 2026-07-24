# STATUS — read this first

Live handoff state. **Whoever works on this repo updates this file before they
stop, compact, or hand off.** It is the answer to "what was the last agent doing,
what did they leave half-finished, and what do I do next?"

The milestone files say what the work *is*. This file says where the work
*currently stands*.

Last updated: **2026-07-24** · window layer built; `newpw` unblocked 17 sessions

---

## One-paragraph catch-up

The port has barely started; almost everything so far is infrastructure,
planning, and measurement. The C recorder now reproduces all 44 public sessions
byte-for-byte, so we have a trustworthy oracle; four tools exist to localise
divergences; and the baseline is **0 of 11,405 screens**. Three measurements
changed the plan: Lua runs during ordinary level generation (M9a became a
prerequisite of M4), `math.random` uses a second unlogged PRNG that must be
reproduced separately (solved and verified), and the skeleton's `d(n,x)` was
logging in a format C never produces (fixed). Four M2 items are done — the RNG
wrappers, the calendar, rc parsing, and the role tables — and a fourth
measurement moved `o_init` to the front of M2, because it is the first RNG
consumer in every single session.

---

## Right now

| | |
|---|---|
| **Current milestone** | **M3 tty windowport** — nothing writes to the terminal, so no screen can score |
| **Also open** | M9a — Lua core. Scoping done, D1 decided, no code written yet |
| **Blocked on** | nothing |
| **Score** | **19/11,405 screens**, 0/44 sessions passing |

### The exact next action

**Use `node tools/diverge.mjs --all` to pick the target every time.** It prints
one line per session with the C function at the first divergence; the histogram
of those functions is the work list, ordered by how many sessions each unblocks.
That is how `newpw` was found — it was blocking 17 of 44 sessions from a single
15-line function.

Current histogram (44 sessions):

```
8  makelevel(mklev.c:1402)
7  fill_special_room(sp_lev.c:2763)
6  lspo_map(sp_lev.c:6154)
6  pick_role / pick_align / pick_gend  (chargen menus, 5 sessions)
4  mkobj(mkobj.c:280)
2  mkclass_aligned(makemon.c:1934)
2  makelevel(mklev.c:1287)
```

So the next targets are `makelevel` (mklev.c:1402) and the `sp_lev.c` pair —
which means **M9a, the Lua core, is now on the critical path for real**:
`fill_special_room` and `lspo_map` are both Lua-driven, and together they block
13 sessions.

`js/tty/wintty.js` is built and verified but not yet wired to a consumer. Its
consumers (discoveries, attributes, inventory) each need their own content
subsystem, so they are lower value per hour than the level-generation work
above.

**Do not expect the score to move during M2.** Nothing scores until M2, M9a, M3,
M4, and M5 are all real, because frame 0 of every session needs chargen, a
generated level, vision, and a windowport to draw it. Judge progress by the
`tools/diverge.mjs` first-divergence index moving later, not by screens.

M9a can be worked in parallel by a second agent — it touches `js/lua/**` and
nothing M2 touches. Its first deliverable is `js/lua/lmathlib.js`; the spec and a
verified reference vector are in
[09-lua-and-special-levels.md](09-lua-and-special-levels.md) under "Decision D1".

---

## Completed

**M0 — strategy and plan.** All milestone files written. Architecture decision:
`js/<name>.js` mirrors `src/<name>.c` one to one, C function names verbatim.

**M1 — verification loop.** Done, all items except the leaderboard confirmation
below.

- Recorder builds and reproduces **44/44** sessions byte-for-byte, after three
  fixes (missing `sysconf`, macOS/debug-mode sysconf contents, leaked lock file
  between segments). All three are written up in [NOTES.md](NOTES.md).
- `tools/diverge.mjs` — names the next C function to port from any failing
  session.
- `tools/screendiff.mjs` — cell-level frame diff.
- `tools/scoreboard.mjs` — scores, records history, flags regressions.
- `tools/coverage-map.mjs` — generates [coverage-map.md](coverage-map.md).
- Baseline recorded in [score-history.tsv](score-history.tsv).

**D1 — Lua approach.** Resolved: build a small Lua interpreter in JS rather than
hand-porting 131 scripts. Scoping measured, rationale recorded in
[09-lua-and-special-levels.md](09-lua-and-special-levels.md).

**M2.4 — RNG wrappers.** `js/rng.js` audited against `src/rnd.c`. Fixed a real
bug in `d(n,x)`, added the missing `rnl(x)`, added `sgn()` to `js/hacklib.js`,
verified seeding and the full log format against the recordings. First code
change to `js/` in the project.

**M2.3 — calendar.** `js/calendar.js` ports all of `src/calendar.c`, driven
from `input.datetime` via `game.fixed_datetime`. Verified against four session
filenames that assert calendar properties (two Friday-the-13th, one full moon,
one new moon) — all four reproduce. Audited `js/` for host-clock reads: none.

**Role tables now carry numeric masks.** `tools/gen-roledata.mjs` switched to
the C preprocessor (same approach as `gen-objects.mjs`), so `allow`, race,
gender and alignment masks arrive as numbers (Archeologist `allow` = 12398 =
0x306e) instead of macro-name text. `ok_role`/`ok_race`/`ok_gend`/`ok_align` can
now test bits directly, which is what the M2.5 pickers need.

**`newpw` — one function, 17 sessions.** `js/exper.js` ports `newhp` and
`newpw` from `src/exper.c`. At level 0 `newhp` draws nothing, because every role
and race in 5.0 has `hpadv.inrnd == 0`; `newpw` draws `rnd(enadv.inrnd)` for
role and race. This was the single largest blocker in the corpus — 17 of 44
sessions diverged there — and clearing it moved seed0360 from call 255 to call
1218, straight through room, corridor and niche generation. Short-corpus RNG
41.8% → **49.0%**.

**tty window layer.** `js/tty/wintty.js` ports the menu and text window layout
from `win/tty/wintty.c`, verified by feeding the recordings' own frame content
through it: the attributes window reproduces with **zero** differing cells and
the cursor exactly at `[9,23]`, the inventory menu geometry and cursor exactly
at `[38,20]`.

**Search, look, and message lifetime.** `js/detect.js` (`dosearch`/`dosearch0`)
and `js/invent.js` (`look_here`/`dolook`) ported; `s` and `:` wired into
`js/cmd.js` with correct `ECMD_TIME`/`ECMD_OK` turn semantics, which fixed the
turn counter. Message lifetime corrected: a message must survive until the frame
that displays it has been captured, so it is cleared after `nhgetch` rather than
after the command. seed8000 **15 → 18/23**.

**First screens scored.** `js/terminal.js` was stale and had no `serialize()`,
so every captured frame was an empty string and local screen score could never
be non-zero. Synced the three frozen files into `js/` — which is what the judge
does on every run — and seed8000 went from 0 to **15/23 screens** with no other
change. Written up in [NOTES.md](NOTES.md).

**`role_init` + the monster table.** `tools/gen-monst.mjs` generates
`js/monst_data.js` (384 monsters, 389 `PM_` constants) via the C preprocessor,
verified against the four 5.0-new species. `js/role.js` gains `role_init`,
`randrole` and `reset_mons`. It draws in three places: quest leader gender,
quest nemesis gender (both only when the monster has no fixed gender), and the
pantheon loop, which spins `randrole()` when the role has no lawful god —
**Priest has `lgod = 0`, so Priest games always enter it.**
Took startup-prefix reproduction from 27/44 to **39/44**, and debug-mode from
3/13 to **13/13**.

**M4.0 — `dungeon.c` initialisation.** `js/dungeon.js` ports `level_range`,
`init_level`, `possible_places`, `pick_level`, `place_level` (recursive with
backtracking), `init_dungeon_levels`, `init_dungeon_branches`, `find_branch`,
`parent_dnum`, `parent_dlevel`, `correct_branch_type`, `insert_branch`,
`add_branch`, `init_dungeon_set_entry`, `init_dungeon_set_depth`,
`init_castle_tune`, `add_level` and the `init_dungeons` driver.
**27 of 44 sessions reproduce the full o_init + nhcore + dungeon prefix**
(7,836 calls). 100 more replayed calls deleted from `js/fastforward.js`.

Two seed-specific stubs in `js/allmain.js` were removed as part of this: a
hardcoded `g.dungeons` and a hardcoded `g.branches` that would have silently
overwritten what `init_dungeons()` builds.

**Dungeon topology data.** `tools/gen-dungeon.mjs` → `js/dungeon_data.js`,
9 dungeons / 7 branches / 37 named levels, parsed from `dat/dungeon.lua` without
the Lua interpreter. The generator refuses to run if that file ever gains real
Lua code.

**M2.8 — `role.c` pickers.** `js/role.js` ports `ok_role`/`ok_race`/`ok_gend`/
`ok_align` and the four `pick_*` functions. Verified against `seed0002`, whose
first four calls match exactly and whose picked role is Healer, matching the
session name. **40/44 sessions now reproduce their whole startup prefix.** The
dead `js/roles.js` stub is deleted.

**M2.7 — `o_init`, the first RNG consumer.** `tools/gen-objects.mjs` generates
`js/objects_data.js` by running the C preprocessor over `src/objects.c` and
parsing the expansion — 482 object entries, 493 object-index constants, the
object-class enum. `js/o_init.js` ports `init_objects`, `shuffle`, `shuffle_all`,
`obj_shuffle_range`, `randomize_gem_colors`, `setgemprobs`, `init_oclass_probs`.
**All 199 o_init calls reproduce exactly on 37 of 44 sessions** (7,363 calls
total). 199 replayed entries deleted from `js/fastforward.js` — the first real
reduction of it.

**M2.2 — options and rc parsing.** `js/optlist.js` is now generated from
`include/optlist.h` by `tools/gen-optlist.mjs` (255 options, count verified
against the header). `js/options.js` rewritten table-driven from
`src/options.c:489`, including right-to-left list processing and stacking
negation. All 44 public rc blobs parse with zero errors. `js/jsmain.js` updated
for the new result shape. **`minmatch` abbreviation matching is not implemented**
— see open threads.

---

## Forks taken from the original plan

Places where the plan as written turned out to be wrong, and what was done about
it. Both came from measurement, not opinion.

### Fork 1 — M9 split, and M9a moved before M4

**Original plan:** Lua was M9, scheduled after the move loop, on the assumption
that it only builds *special* levels.

**What the measurement said:** `src/sp_lev.c` executes in **44 of 44** public
sessions (97,479 PRNG calls), and every session makes Lua-context calls tagged
`@ nh.rn2()` — a floor of 210 even in the 25-step sessions. NetHack 5.0 runs
ordinary level generation through the Lua machinery, largely via themed rooms.

**What changed:** M9 split into M9a (Lua core, now a hard prerequisite of M4,
inside the M2-M5 block) and M9b (named special levels and quests, original
position). The dependency graph in [README.md](README.md) is updated.

### Fork 2 — a second, unlogged PRNG has to be ported

**Not in the original plan at all.** `math.random` in Lua does not use NetHack's
RNG; it uses Lua's own xoshiro256\*\*, and those draws never appear in the RNG
log (`src/nhlua.c:2946`). It is used 84 times in `dat/`, including in
`nhlib.lua` and `themerms.lua`, both of which run on ordinary levels.

**Why it matters:** a port can hit 100% RNG parity and still generate the wrong
level, with nothing in any log explaining why.

**Status: solved, not yet written into `js/`.** The algorithm is specified in
`lib/lua-5.4.8/src/lmathlib.c`, a BigInt prototype was verified against the real
interpreter and matches exactly, and the spec plus a reference vector are
recorded in [09-lua-and-special-levels.md](09-lua-and-special-levels.md). The
first M9a deliverable is to land it as `js/lua/lmathlib.js`.

---

## Open threads and known gaps

Small things deliberately left, so nobody wonders whether they were missed.

- **`runSegment` was not passing `datetime` through** — fixed this pass. It
  destructured only `{seed, nethackrc, storage}`, so `game.fixed_datetime` was
  undefined and `js/calendar.js` would have thrown the moment anything asked for
  the moon phase or Friday-the-13th check.
- **Leaderboard confirmation (M1 item 1.6).** The CI workflow is confirmed to run
  on push. Not yet confirmed that our fork appears at
  [mazesofmenace.ai](https://mazesofmenace.ai/leaderboard/) after a cron cycle.
  Someone should just look, two hours after any push.
- **CI overlays only two of three frozen files.** `.github/workflows/score.yml`
  copies `isaac64.js` and `terminal.js` but not `storage.js`. A local edit to
  `js/storage.js` would pass CI and fail the judge. Do not edit it. Noted in
  [NOTES.md](NOTES.md).
- **`js/game_display.js` (122 lines) has no C counterpart.** Decide in M5 whether
  to fold it into the file matching its C origin or delete it.
- **Existing skeleton files have unknown provenance.** `js/mklev.js` (1,888
  lines), `js/vision.js` (543), `js/display.js` (301), `js/rect.js` (165) all
  predate us. M4.1 and M5.1 exist to audit them against the C before building on
  them. Do not assume they are faithful.
- **Lua sources are not in the git submodule.** `lib/lua-5.4.8/` is downloaded by
  `build-recorder.sh` at build time and lives under the gitignored
  `nethack-c/recorder/`. Anything we need from it (the `lmathlib.c` spec, the
  `lua` binary for verification) requires having run the build.
- **The judge sandbox may not have the submodule checked out.** So `dat/*.lua`
  must be embedded into `js/` as generated modules, never read from disk at
  runtime. Affects M9a's design.
- **Option abbreviation is not implemented.** `src/options.c` matches options on
  a minimum unambiguous prefix computed by `determine_ambiguities()`, so
  `OPTIONS=col` legally sets `color`. No public session abbreviates, but a
  held-out one may. This is a concrete generalization gap, not a cosmetic one.
- **Options are parsed but mostly not acted on.** `js/options.js` stores all 255
  into `rc.opts`; only `name`, `pettype`, and `tutorial` are consumed so far.
  Wire each one up in the milestone that owns its behaviour, not before.
- **`SYMBOLS=` and `BIND=` are captured but not applied.** Two public sessions
  use them (`SYMBOLS=S_pool:~,S_fountain:{` and `BIND=v:inventory`). They land in
  `rc.symbols` / `rc.bindings`; M3 (symbols) and M6.2 (bindings) apply them.
- **Possible double-consume around `l_nhcore_init`.** `js/allmain.js` calls
  `l_nhcore_init()` (a real port of `nhlib.lua`'s `shuffle(align)`, drawing
  `rn2(3)`/`rn2(2)`) *after* `fastforward_pre_mklev()`, which also replays
  `rn2(3); rn2(2)` for the same thing. The stream still matches C at indices
  199-208, so whatever is happening is not a simple duplicate — but our port
  emits 3,270 calls against C's 3,130 for seed8000, so ~140 calls are surplus
  somewhere. Pre-existing, not introduced by the recent work. Worth tracking
  down when `fastforward.js` shrinks further and the picture is simpler.
- **Display RNG context is not implemented** (M2.4 left it deliberately). Not
  scored, but worth 751 steps of hallucination screens. Deferred to M10.6 with
  the two gotchas recorded: the context is never seeded, and `js/isaac64.js` has
  no zero-state constructor.
- **`js/hacklib.js` `isok()` looks wrong** — it calls an oddly named
  `await_const()` that returns hardcoded `{COLNO: 80, ROWNO: 21}` instead of
  importing from `js/const.js`. Pre-existing, not touched. Fix it when M6 needs
  `isok` for real, against `src/hacklib.c`.

---

## How to update this file

At the end of a working session, revise: the "Right now" table, "The exact next
action", anything finished into "Completed", and any new fork or open thread. Do
not let it drift — a stale STATUS.md is worse than none, because the next agent
will trust it.
