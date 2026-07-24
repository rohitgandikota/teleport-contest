# STATUS — read this first

Live handoff state. **Whoever works on this repo updates this file before they
stop, compact, or hand off.** It is the answer to "what was the last agent doing,
what did they leave half-finished, and what do I do next?"

The milestone files say what the work *is*. This file says where the work
*currently stands*.

Last updated: **2026-07-24** · **character selection is ported**; no session dies at call 0 any more

Live dashboard (score, blockers, milestone state):
<https://claude.ai/code/artifact/9556cfe3-2442-42f7-a1d3-605e58f4e81b> — republish
it from the same file path after a scoring run to refresh.

---

## One-paragraph catch-up

The C recorder reproduces all 44 public sessions byte-for-byte, so the oracle is
trustworthy, and four tools localise divergences. Level generation is now real
rather than replayed: `seed8000` reproduces **3103 of its 3130** PRNG calls and
**19 of its 23** frames, and the remaining divergence is in the monster move
loop, past level generation entirely. Getting there meant porting `makemon`, the
trap and corpse pipelines, `mksobj_init`'s food branch, `random_engraving` with a
real reader for `dat/rumors`, and `mineralize` — and, more than anything, finding
that hand-written constant blocks were wrong in bulk (see
[NOTES.md](NOTES.md)). The score is still **19 of 11,405 screens** because
frames need content subsystems the port does not have yet, not because the
generation is wrong. Two things stand between here and the first complete
session: wiring the finished tty window layer, and computing the hero's starting
inventory instead of replaying it.

---

## Right now

| | |
|---|---|
| **Current milestone** | **Breadth** — seed8000's frames are done; the leverage is now in the other 43 |
| **Also open** | chargen menus (6), `obj_resists` (3), `mkobj` (3) |
| **Blocked on** | nothing |
| **Score** | **23/11,405 screens**, 0/44 sessions passing, corpus RNG **87,779/792,838 (11.1%)** |

### The exact next action — READ THIS FIRST

Character selection is ported (`js/plselect.js`) and the seven sessions that
used to die at call 0 now reach 1465, 2206, 463, 462, 4, 1 and 1. Three of them
stop almost immediately, so **the next move is to chase those three down**:

| Session | Divergence | Note |
|---|---:|---|
| `seed0012-monk-vault-escort` | 0 | still at call 0 — its moves are `"Dodeco\rn[l\"m/hmy…"`, and `[`, `\"` and `/` are menu keys this port does not handle |
| `seed0014` | 1 | one call in |
| `seed0006` | 1 | shows TWO `rn2(1)` at `pick_align`; we emit one. Its moves include `a` at the confirmation, which is "choose another name" and re-runs `askname()` then loops back to the confirmation menu — a second `plsel_startmenu()` |
| `seed0007` | 4 | four calls in |

These are all the same shape: a menu key or confirmation branch that
`js/plselect.js` does not implement yet. `seed0006` is the most legible —
work out why the rename path draws a second `rn2(1)`.

**After that, the chargen FRAMES.** Those sessions capture a screen at every
keystroke, and the selection menus are all still blank. `js/tty/wintty.js` now
has everything needed to draw them (menus, selector letters, headings,
`(end)`/`--More--`), so this is content, not machinery — and it is worth a lot
of frames, because a session like `seed0014` has 59,178 calls behind it.

### What the window layer now provides

`js/tty/wintty.js` with a real consumer, and these rules verified against
recordings rather than inferred:

- `display_nhwindow(win, TRUE)` blocks inside the window; the captured frame is
  the window.
- `NHW_TEXT` puts its prompt on the last screen line; a menu puts it under its
  content. Single page: `--More--` for text, `(end) ` (trailing space) for a
  menu. Paging: `(N of M)`.
- Menu text and prompt both render at `offx + 1`.
- An inset menu OVERLAYS the map; only a collapsed one clears the screen.
- Every row gets `cl_end()`.
- NetHack's `ATR_INVERSE` is 7; the terminal's inverse bit is 1.

### The startup sequence is now fully ported

`js/fastforward.js` is down to 63 lines. Nothing between the first PRNG call and
the first keystroke is replayed any more except `moveloop_preamble`'s two calls:

```
o_init -> role_init -> nhlib align shuffle -> init_dungeons -> newhp/newpw
  -> mklev (rooms, corridors, traps, objects, monsters, engravings, mineralize)
  -> u_on_upstairs -> makedog -> u_init_role/ini_inv -> init_attr/vary_init_attr
```

seed8000 reproduces **3103 of its 3130** calls; what remains is the monster move
loop, and `fastforward_step` still replays 127 calls of it.

### Blocker histogram (44 sessions, current)

| Blocker | Sessions | Notes |
|---|---:|---|
| `fill_special_room(sp_lev.c:2763)` | 12 | **Lua** |
| `lspo_map(sp_lev.c:6154)` | 6 | **Lua** |
| `shuffle()` in `dat/nhlib.lua` | 6 | **Lua** |
| `pick_role` / `pick_align` | 6 | chargen menus, needs M3 wiring |
| `somey`, `makelevel`, `choose_trapnote` | 2 each | |
| everything else | 1 each | |

**24 of 44 are Lua-blocked.** Every non-Lua item left is worth 2 sessions or
fewer.

### Fake-RNG stubs: two of three cleared, one remains

`makemon` and `random_engraving` are now real. Still outstanding in
`js/mklev.js`, in the IRONBARS niche branch:

```
rn2(398); // mkclass(S_HUMAN)
```

It invents a draw and so guarantees divergence wherever reached. Porting
`src/makemon.c mkclass_aligned()` clears it and also unblocks seed0103 and
seed0700.

**How to judge progress.** Screens move in steps, not smoothly, because a frame
scores only when every cell *and* the cursor match. Between steps, use the
`tools/diverge.mjs` first-divergence index. `tools/scoreboard.mjs`'s positional
RNG count is advisory and can fall while the port improves — see
[NOTES.md](NOTES.md), "Two RNG metrics, and when they disagree".

M9a can be worked in parallel by a second agent — it touches `js/lua/**` and
nothing M2 touches. Its first deliverable is `js/lua/lmathlib.js`; the spec and a
verified reference vector are in
[09-lua-and-special-levels.md](09-lua-and-special-levels.md) under "Decision D1".

---

## Completed

**M7 (partial) — `makemon()` and the monster pipeline.** `js/makemon.js` now
ports `makemon`, `newmonhp`, `peace_minded`, `propagate`, `adj_lev`, `golemhp`,
`mbirth_limit`, `mongets`, `m_initinv`'s generic tail, plus `goodpos` and
`place_monster`. The full level-generation monster sequence
(`rndmonst` → `next_ident` → `newmonhp` → gender → `peace_minded` →
`m_initinv` → saddle) reproduces call for call. `rndmonst_adj` no longer blocks
any session; it was the blocker in 7.

**M4 (partial) — traps and corpses.** `mktrap_victim` and `mkcorpstat` ported
faithfully; `mksobj` gained the `src/mkobj.c:1200-1227` corpse block,
`set_corpsenm`, `start_corpse_timeout`, `undead_to_corpse` and
`special_corpse`. `init_dungeons()` now resolves the special-level table and
the hardwired dungeon numbers (`mines_dnum` and friends) as C does.

### Forks taken from the original plan — things a later agent must not redo

1. **Four hardcoded-constant blocks were wrong and are now imports.** Objects,
   traps, `G_` flags and `MM_` flags. Details and the full table are in
   [NOTES.md](NOTES.md), "Hardcoded constants are the single biggest bug class".
   Treat any remaining literal constant in `js/` as suspect.
2. **Both generated tables were emitting enum identifiers as strings.**
   `gen-objects.mjs` and `gen-monst.mjs` now resolve them; `gen-monst.mjs`
   additionally scrapes `#define` families the preprocessor eats. If you write a
   new generator, do the same and assert no field is a string.
3. **`u.ulevel` was 0 during `mklev()`; C has it at 1.** `u_init_misc()` sets it
   before `mklev()` (src/allmain.c:794 vs :807), and `rndmonst_adj`'s
   `monmax_difficulty` is `(depth + u.ulevel) / 2`, so level generation was
   selecting from half the eligible monster set. Fixed in `js/allmain.js`; do
   not move it back.
4. **`mkobj_erosions()` belongs at the end of `mksobj_init()`, not in
   `mksobj()`.** Calling it from `mksobj` makes objects created with
   `init = false` draw when C does not.
5. **M3 remains built-but-unwired.** `js/tty/wintty.js` is verified correct in
   isolation and still has no consumer. It is waiting on content subsystems, not
   on itself.
6. **Screens dipped 19 → 0 mid-way through the trap fix and came back at 19.**
   That is expected when a correct fix moves object placement while the fill is
   still diverging. See NOTES.md, "Screens can regress while the port gets more
   correct", before reverting anything on a screen dip.

### Still pending, in priority order

| Item | Sessions | Blocked on |
|---|---:|---|
| **M9a Lua core** | 12 | nothing — largest single lever, not started |
| `mksobj_init` gaps (mkobj.c:915/927/971) | 5 | nothing — next action above |
| `mkclass_aligned` + the `mkclass` stub | 2 | nothing |
| `mkbox_cnts` container contents | 2 | nothing |
| `random_engraving` stub | 1 | engraving table from `src/engrave.c` |
| M2.6 chargen menus | 5 | M3 wiring |
| `m_initweap` (412 lines) | 1 | nothing; needed for armed monsters |
| `m_initinv` mlet switch arms | — | `curse()`, `rnd_class()`, containers |
| `sobj_at` (used by `goodpos`'s boulder test) | — | object-position tracking |
| Corpse/egg/tin: `can_be_hatched`, `set_tin_variety` | — | nothing |
| Leaderboard confirmation (M1 item 1.6) | — | unverified |

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
