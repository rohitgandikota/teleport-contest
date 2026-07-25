# STATUS — read this first

Live handoff state. **Whoever works on this repo updates this file before they
stop, compact, or hand off.** It is the answer to "what was the last agent doing,
what did they leave half-finished, and what do I do next?"

The milestone files say what the work *is*. This file says where the work
*currently stands*.

Last updated: **2026-07-25** · **1 of 44 sessions passes end to end** (`seed8000`), screens **163 → 194**, corpus RNG **14.4%**

Live dashboard (score, blockers, milestone state):
<https://claude.ai/code/artifact/9556cfe3-2442-42f7-a1d3-605e58f4e81b> — republish
it from the same file path after a scoring run to refresh.

---

## One-paragraph catch-up

**`seed8000-tourist-starter` now reproduces the C PRNG stream exactly — all 3130
calls — with all 23 screens matching. It is the first session to pass end to
end.** Getting there was four missing draws found by walking its divergence
forward one at a time, and the method generalises: once a session's screens all
match, the RNG log becomes a precise worklist, because every mismatch names the
C function and source line that produced it. The four were the clairvoyance
counter in `moveloop_core` (`rn1(31,15)`, maintained even when no clairvoyance
happens), the whole attribute exercise system (`exerchk` → `exerper` →
`exercise`, one `rn2(19)` every tenth move), `set_apparxy` (whose ordinary path
draws nothing, which is why its absence was invisible), and `init_uhunger`.

The corpus score is still **163 of 11,405 screens** because most sessions need
content subsystems the port does not have, not because generation is wrong.

---

## Right now

| | |
|---|---|
| **Current milestone** | **First full session** — `seed8000` matches C call for call; generalise the method |
| **Also open** | **object placement during level gen** (see below), **`--More--`** (1108 frames, 40 sessions), `mkobj.c:289` (5) |
| **Blocked on** | nothing |
| **Score** | **163/11,405 screens**, **1/44 sessions passing**, corpus RNG **113,896/792,838 (14.4%)** · held-out **10.6%** |

### The method that produced the first pass — use it next

Pick the session closest to a full RNG match, not the one with the most screens.
`node tools/scoreboard.mjs` prints `rng matched/total` per session; the smallest
gap is the best target. Then `node tools/diverge.mjs <seed>` names the C function
and line of the first mismatch, and the fix is to go read that line. seed8000
went 2497 → 2999 → 3047 → 3086 → complete in four such steps.

Two cautions learned doing it:

- **The divergence point is the measure, not `positions match overall`.** A
  faithful change can lower the match count while leaving the divergence exactly
  where it was, because the count includes coincidental post-divergence matches.
  Twice this session a "regression" was nothing of the kind — check
  `diverge.mjs`'s call number before reverting anything.
- **A draw that is missing costs nothing until something else exposes it.**
  `set_apparxy`'s common path draws nothing, so its absence was free; it only
  showed up once `distfleeck` was real. Expect fixes to arrive in pairs.

### Next: `--More--` is reachable at seed5002 step 0, and it is 1108 frames

`node tools/screendiff.mjs seed5002 0` shows exactly 8 differing cells: C has
`--More--` at row 1 col 0 with the cursor there, ours has nothing. This is the
**two-line variant** — the welcome message is 73 characters, past the `CO - 8`
wrap threshold, so C puts the suffix on its own line rather than appending it.

`more()` in `js/display.js:417` is already ported and handles both the suffix
and the wrap. **Nothing calls it on this path.** There are exactly two places
C can call it, and they are different mechanisms — do not conflate them:

1. **`win/tty/topl.c:262` `update_topl()`** — when a NEW message arrives while
   `toplin == TOPLINE_NEED_MORE`, C either APPENDS it to the pending line with
   two spaces, or calls `more()`. The test is
   `n0 + strlen(toplines) + 3 < CO - 8` where `n0` is the new message's length.
   So two short messages share a line silently and only a long pair blocks.
   This is why gating on `pline` is wrong: most plines append, they do not
   block.
2. **`win/tty/wintty.c:1874` `tty_display_nhwindow(WIN_MESSAGE, TRUE)`** —
   blocks if `toplin == TOPLINE_NEED_MORE`, then sets it back to NEED_MORE and
   clears the window.

**For seed5002 step 0 it is mechanism 2, and the caller is the windowport, not
src/.** `welcome()` (src/allmain.c) is a SINGLE pline — the double space in
"NetHack!  You are" is in its format string, so do not mistake it for
update_topl's two-space append. That one 73-character message leaves
`toplin == TOPLINE_NEED_MORE`, and `--More--` lands on row 1 because 73 + 8
exceeds the 80-column terminal.

What blocks on it: **`tty_display_nhwindow()` flushes the message window before
drawing any other window** — see win/tty/wintty.c:1890 and :1922, where the
NHW_MAP and NHW_MENU/NHW_TEXT arms each call
`tty_display_nhwindow(WIN_MESSAGE, TRUE)` first. So the startup map draw is
what triggers it. Grepping `display_nhwindow(WIN_MESSAGE, TRUE)` in src/ finds
nothing on the startup path and is a dead end; the call is in win/tty/.

Our port defers drawing to `_buildScreenOutput()` and has no equivalent of that
flush-before-draw ordering, which is why nothing calls `more()` here.

**Tried and reverted:** adding
`if (game._toplin === TOPLINE_NEED_MORE) await more();` at the top of
`moveloop()` in js/allmain.js, before `docrt()`. It changes nothing —
seed5002 step 0 still differs by the same 8 cells and the score is unmoved, so
`more()` is not being reached. Either `_toplin` is not NEED_MORE by then
(something clears it between `welcome()` and `moveloop()` — check the legacy
window and `cls()`), or the block belongs at a different point in the startup.
Establish which BEFORE writing the call: a placement that looks right and never
fires is worse than none.

**Why it was dead:** `moveloop()` in js/allmain.js is never called. js/jsmain.js
runs `newgame()` -> `maybe_do_tutorial()` -> `moveloop_core()` in a loop and
bypasses `moveloop()` deliberately (there is a comment at jsmain.js:161 saying
so). A trace at the top of `moveloop()` produces no output on seed5002.

**Second placement, also reverted:** the same two lines at the top of
`moveloop_core()`'s "Vision + display" block — the function that DOES run — cost
**21 screens and seed8000's pass** (194 -> 173, 1/44 -> 0/44). So that one fires
and is wrong.

Both failures together say the trigger is narrower than "before any map draw".
`moveloop_core` runs every turn, so blocking there emits `--More--` on turns C
does not, and `more()` also consumes a key, which is what breaks seed8000.

**The map arm is ruled out.** win/tty/wintty.c:1885 only flushes the message
window when `blocking` is TRUE, and every `display_nhwindow(WIN_MAP, TRUE)` in
src/ is in detect.c (magic mapping, detection spells). None is on the startup
path, so that is NOT where seed5002's step-0 `--More--` comes from.

**CONFIRMED — and the news is good.** For seed5002, `segments[0].steps.length`
is **124** while `segments[0].moves.length` is **123**, and `steps[0].key` is
`null`. So step 0 is the frame captured BEFORE any key is consumed, and C is
sitting inside `more()` when it is taken; `steps[1].key` is `" "`, which is the
keystroke that dismisses the prompt.

That means **keystroke alignment is already correct and is not at risk.** C
spends that space dismissing `--More--`; our port spends it as the no-op that
`KNOWN_UNPORTED` makes of `' '`. One key either way. The bug is display-only:
at the first `nhgetch()` the top line should already carry the `--More--`
suffix.

So the third attempt should NOT add a blocking call in the move loop — that is
what cost 21 screens, because it fired on turns with no pending message. What
is needed is for the suffix to be PRESENT on the deferred screen whenever
`_toplin === TOPLINE_NEED_MORE` at the moment a frame is captured, with the
key consumption left exactly as it is. Look at `_buildScreenOutput()` and the
`_preNhgetchHook` capture path in js/jsmain.js, not at moveloop_core.

Verify with `node tools/screendiff.mjs seed5002 0` — 8 cells, row 1 col 0.

**Third placement, also reverted (-21 screens, seed8000's pass):** splitting
`more()` into `draw_more_suffix()` plus the blocking read, then drawing the
suffix in `rhack()` whenever `_toplin === TOPLINE_NEED_MORE` before the command
read. Same regression as placement 2, which is the tell: **our `_toplin` is
NEED_MORE far more often than C's.**

**The actual missing piece, found while reverting:** src/allmain.c:756 calls
`display_nhwindow(WIN_MESSAGE, FALSE)` — the NON-blocking variant — and
win/tty/wintty.c:1879 shows that arm does `ttyDisplay->toplin = TOPLINE_EMPTY`.
So C CLEARS the flag on a normal cycle and only leaves it set in the specific
spots that then block. Our port sets `_toplin = TOPLINE_NEED_MORE` in `pline()`
and **never clears it**, so after the first message of the game it is
permanently set and any suffix keyed off it draws on every frame.

That clear is now ported (js/allmain.js, before the startup `docrt()`), and it
is score-neutral on its own.

**Still unresolved — where the startup `--More--` actually comes from.**
Eliminated so far, each by reading the C rather than guessing:

- the `NHW_MAP` arm (wintty.c:1885) — it only flushes when `blocking` is TRUE,
  and every `display_nhwindow(WIN_MAP, TRUE)` in src/ is in detect.c;
- the `NHW_TEXT`/`NHW_MENU` arm (wintty.c:1922) — seed5002's rc sets
  `!legacy`, so no text window is shown at startup;
- a second message joining the first via `update_topl`'s two-space append —
  `welcome()` is a single pline and the double space is in its format string.

What is known for certain: seed5002 has **124 steps for 123 keystrokes** with
`steps[0].key === null`, so C is inside a blocking read at step 0 with the
suffix already painted, and one key clears it either way — alignment is safe.
Next thing to try: instrument the C recorder itself, or diff seed5002's step 0
against a session whose rc does NOT produce a startup `--More--`, to find what
differs. Do not add another speculative `more()` call; three have been tried and
all three cost 21 screens and seed8000's pass.

Two cautions, both learned the hard way:

- A previous attempt gated `--More--` on `pline` and **lost 3 screens**. The
  bug class is that `update_topl` sets `NEED_MORE` on *every* pline, so gating
  on the message rather than on the blocking call emits it constantly.
- `more()` also **consumes a key**. Getting the display right but the
  consumption wrong puts the whole session out of step, which is worse than
  not drawing it at all.

Because it is 1108 frames across 40 sessions, this is the single largest screen
item left. Verify against `screendiff` at step 0 of seed5002 before and after.

### Next: getpos(), the position picker — it decides keystroke alignment

`seed4500-knight-coverage` is the largest session (1814 screens) and its input
begins `j #jump\n j.jjl. jjh.hhhh...`. `#jump` reaches `jump()`, which calls
`getpos(&cc, TRUE, "the desired position")` at **src/apply.c:2063**. So the
` j.jjl. jjh.` run is **cursor movement and a pick inside getpos**, not
commands. Without it those letters execute as moves and every later keystroke
runs against the wrong command — the hero ends up in the wrong room with 29
turns elapsed against C's 11.

`doextcmd` now reads the command NAME off the input (`js/cmd.js`), so `#jump\n`
itself is consumed correctly. What remains is getpos's own key loop:
`src/cmd.c` around the `NHKF_GETPOS_*` table (3168+) — movement keys move the
cursor, `.`/`,`/`;`/`:` pick, `@` self, ESC aborts.

This is worth more than its one session: any command that targets a location
goes through getpos, so the same gap silently mis-aligns every session that
uses one.

### The command sweep — currently the most productive line

`/tmp/cnt.mjs` (recreate it: count how often each C command key appears across
`sessions/*.session.json`, minus the ones rhack already handles) ranks the
unhandled commands by how often the corpus actually issues them. Working that
list produced, in order: `.` wait (+179 RNG, +1 screen), `doeat` (+132, +1),
`g`/`m` prefixes (+1 screen), `dochat` (+8), plus `getobj` for seven commands,
`F`, `dothrow` and `walk_path` — all correct-but-neutral locally and real for
held-out sessions.

**The unhandled commands split into two kinds, and the second is easy to miss:**

- **Input consumers** (`f`, `c`, `e`, `t`, and the getobj seven). They read
  extra keys. Skipping them misaligns the keystream and every later key runs
  against the wrong command.
- **Prefixes** (`F`, `g`, `m`). They read NO extra key, so counts stay correct
  and nothing looks wrong — but they change what the NEXT command does. `F`
  makes a move attack instead of stepping; `g` makes it run several squares.
  Both displace the hero silently.

**Still unhandled, with why each is not simply more of the same:**

| key | n | blocker |
|---|---|---|
| `a` | 232 | needs each `use_*()`'s own return value; a first attempt that assumed ECMD_TIME cost a screen on seed0077 |
| `r` `d` `w` | 437 | wired via getobj; the EFFECTS are unported |
| `?` | 113 | opens a menu that reads its own keys — count is menu-dependent |
| `p` | 109 | shops |
| `>` | 81 | `next_level()` -> `goto_level()`. Note the common case already matches: off stairs, C returns ECMD_OK having read nothing, exactly as an unhandled key does |

**The remaining big wins are effects, not input plumbing:** the run loop
(`lookaround`, 162 lines, zero draws — portable but unverifiable in a short
session), `throwit`'s trajectory, combat (`mattacku`), and `goto_level`.

### The technique that is currently producing: screendiff before the divergence

RNG-chasing stopped yielding screens for several stretches. What works now is
comparing screens at a step where the streams still agree — see the NOTES.md
entry. One run found three non-drawing bugs worth +27 screens. Recipe:

```
node tools/diverge.mjs <seed>          # prints "divergent call occurs at seg N, step M"
node tools/screendiff.mjs <seed> <M-1> # everything differing here draws nothing
```

### Object POSITIONS differ, not counts — narrowed this iteration

`seed0102` (30 calls from a pass) fails the same way as `seed0105`: C's pet
finds ONE object in its 5-square box and moves on to dog_goal's rn2(4) at
dogmove.c:575, while ours finds three or more and keeps drawing obj_resists.

Measured, not guessed: our level carries **25 objects with no duplicates**
(checked by keying on `ox,oy:otyp`), and the RNG matches all the way through
level generation, so the same objects are being CREATED. They are landing in
different PLACES.

`somexyspace` was verified identical earlier, and `mkobj_at`/`mksobj_at` now
place correctly. **`mineralize()` has now been compared line by line against
src/mklev.c and matches**, including the `y += 2` / `y += 1` skips that decide
which squares get tested, and its draws match the recording anyway.

So object placement is probably NOT the cause. The likelier explanation is the
one already open below: the PET is standing somewhere C's is not, so its
5-square box covers different squares and finds a different number of objects.
That is the same silent positional drift that `seed4500` shows at RNG call
2869, where `mfndpos` returns 5 for us and 7 for C.

**Treat pet/monster drift as ONE bug with three symptoms** (seed0102,
seed0105, seed4500), not three separate object-placement puzzles. It draws
nothing, so it needs position instrumentation.

**Screendiff at the last agreeing step localised it — run this first:**

```
node tools/screendiff.mjs seed0102 21
```

Three cells differ, and they name two distinct bugs:

1. ~~**The HERO is one square off.**~~ **FIXED** — `'f'` is `dofire`, which
   reaches `getdir()`; C spends a key on the direction and stays put, while we
   ran that key as a movement command. seed0102 step 21 is now down to ONE
   differing cell and its cursor matches C exactly. (Original text below for
   the record.)

   **The HERO is one square off.** C has `@` at <27,8>, standing on the
   upstairs so the `<` is hidden; we have `@` at <28,8> with the `<` still
   showing at 27,8. Cursor differs the same way (C [27,8] vs ours [28,8]).
   This is hero movement, not monster movement — one extra or one missing step
   over 21 keys. Suspects: a blocked move that we charge and C does not, or a
   key consumed differently. Note seed0102's session is "ranger-name-cancel",
   so it exercises the name prompt and ESC handling.
2. **The one remaining cell: screen <31,11> = MAP <31,10>.** C draws a fountain
   `{`, we draw a scroll `?`. Ruled out so far: `mkfount()` matches C,
   `find_okay_roompos()` matches C, and level-generation RNG agrees call for
   call — so the fountain should be in the same square.

   **Measured, step-gated to step 21:** map <31,10> has `typ = 25` (ROOM), no
   objects, and a stale `remembered_glyph` of `~`. So it is NOT a display-layer
   problem and not an object on top of terrain — **our level simply does not
   have the fountain C has.**

   That is the sharp contradiction to chase: `mkfount()` matches C,
   `find_okay_roompos()` matches C, and every retry inside it calls
   `somexyspace()` which DRAWS — so a different retry count would diverge the
   RNG, and the RNG agrees call for call through all of level generation.
   Same draws, different square.

   **Chain now fully re-verified against the C this session:** `mkfount`,
   `find_okay_roompos`, `somexyspace`, `occupied` all match. `somexy` did NOT —
   it was missing the `croom->irregular` branch, now ported — but seed0102's
   rooms appear regular, so that is not this bug.

   **Hard measurement:** `level.flags.nfountains === 0` on our seed0102 level,
   and `game.unported` contains no theme/fill entry. So we create NO fountain
   anywhere, while C has one at <31,10>.

   **Instrumented, and mkfount is a dead end.** The level has six rooms and the
   `rn2(10)` fountain rolls are 3, 7, 5, 1, 3, 7 — never zero, so `mkfount` is
   never called. Since the RNG matches call for call, **C never calls it
   either.** The fountain at <31,10> does not come from `mkfount`.

   Also eliminated: the `garden` themeroom, which is the one themeroom that
   places fountains (`des.feature("fountain")`, dat/themerms.lua:125). Our
   `game.unported` has no `themeroom ...` entry for this level, meaning
   `themerooms_generate` picked `default` — so no themed room ran.

   ### `--More--` SOLVED (diagnosis): we are missing the startup MESSAGES

Measured across all 44 sessions: **32 have `--More--` on step 0, 12 do not** —
and the 12 without are exactly the ones where our early screens already match
(seed8000, seed0077, seed0002, seed0004, ...). So this is worth ~32 screens at
step 0 alone, before the 1108 later frames.

What actually differs is the MESSAGE, not a missing `more()` call:

- `seed8000` step 0 row 0: `Aloha Contestant, welcome to NetHack!  You are a
  neutral female human Tourist.` — no `--More--`.
- `seed0102` step 0 row 0: `\u001b[23CIt is written in the Book of Mars:` —
  the **legacy blurb**, which we never print at all.
- `seed5002` step 0: the welcome line WITH `--More--`, and its rc sets
  `playmode:debug`; wizard mode prints an extra startup message.

`update_topl` (win/tty/topl.c:262) only calls `more()` when a SECOND message
arrives while the first is unacknowledged and the two do not fit on one line.
**We print exactly one startup message, so that branch can never fire.** That is
why all three attempts to add a `more()` call failed and cost 21 screens each:
the call site was never the problem.

**The fix is to print the messages C prints**, in C's order, and let
`update_topl` produce `--More--` on its own:
1. the legacy blurb (`src/allmain.c`, the `flags.legacy` branch — grep
   `"It is written in the Book of"`),
2. whatever wizard mode adds when `playmode:debug` is set,
3. then `welcome()`.

Do NOT add another `more()` call. Port the missing plines and the existing
machinery should light up by itself.

**Glyph identity confirmed:** `{` is `PCHAR(37, '{', S_fountain, ...)` in
   include/defsym.h and NO object or monster class uses it, so C really does
   have a fountain there.

   **Every place C can create a fountain** (`grep 'set_levltyp.*FOUNTAIN\|typ =
   FOUNTAIN'`), with what is known about each:
   - `src/mklev.c:2293` — `mkfount()`. **Ruled out**, see above.
   - `src/mkroom.c:995` — inside `cmap_to_type()`, a pure symbol-to-type
     mapper. Not a creation site; it is called BY the des/special-room code.
   - `src/do.c:420` — converts a sink to a fountain, driven by a command.
     seed0102's keys are `  n#name\r ESC f l i ESC + ESC \ ESC ^X SPACE ESC s
     s :` — nothing there does this.
   - `src/fountain.c:586` and `src/objnam.c:3591` — not yet examined.

   Since `cmap_to_type` is what the des-file feature code maps through, the
   most likely remaining source is a special room or des feature our port does
   not build. Look at what ELSE differs on that level besides this one cell
   before spending more iterations on a single square — one cell out of 1920 is
   a poor return, and seed0102 is one session.

Fix the hero offset first — it is upstream of everything the pet does, and a
hero one square away changes what every monster targets.

### Still open from before

Object CONTENT during level generation: on `seed0105` the pet's search box
holds a scroll (APPORT) where C's holds something classifying below MANFOOD.
Ruled out as causes: `mkobj` class/type selection (C's `probtype` guard is now
ported and never fires), `should_see`, the hero-track system, `m_search_items`
and its three gates — all ported and correct. Not yet audited: `mksobj`'s
per-class initialisation.

`seed4500` also still diverges at RNG call 2869 in `m_move`'s mtrack draw,
where `mfndpos` returns 5 for us and 7 for C — a monster standing somewhere C's
is not. Positional drift like this draws nothing, so it needs position
instrumentation rather than the RNG log.

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
