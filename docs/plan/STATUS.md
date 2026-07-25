# STATUS — read this first

Live handoff state. **Whoever works on this repo updates this file before they
stop, compact, or hand off.** It is the answer to "what was the last agent doing,
what did they leave half-finished, and what do I do next?"

The milestone files say what the work *is*. This file says where the work
*currently stands*.

Last updated: **2026-07-25** · **screens 85 → 135**, corpus RNG **11.1% → 13.8%**

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
| **Current milestone** | **Breadth** — every chargen frame up to the legacy blurb now matches |
| **Also open** | **`--More--`** (1108 frames, 40 sessions), **dogmove.c** (7), `mkobj.c:289` (5) |
| **Blocked on** | nothing |
| **Score** | **135/11,405 screens**, 0/44 sessions passing, corpus RNG **109,593/792,838 (13.8%)** |

### The single biggest screen opportunity: `--More--` (1108 frames, 40 sessions)

Measured, not estimated: **1108 of the 11,405 public frames carry `--More--` on
their top line, across 40 of the 44 sessions.** That is 9.7% of the public score
sitting behind one piece of `win/tty/topl.c`, and there is no reason the
held-out half is different.

Our port does not render it at all. `js/display.js` `pline()` is

```js
export async function pline(msg) { game._pending_message = msg; }
```

and `_buildScreenOutput()` writes that string to row 0 and stops. Nothing models
`ttyDisplay->toplin`, so the suffix never appears and the cursor never parks
past it.

This is now visible as the last thing between us and whole frames. seed0077
step 12 is **25 cells** from matching, and **8 of those 25 are exactly the
`--More--` at columns 69-76**; the rest is a handful of map cells. Several
sessions will be in the same position.

**What it needs.** `more()` in topl.c appends the suffix and blocks; `pline()`
sets `toplin = TOPLINE_NEED_MORE`; `display_nhwindow(WIN_MESSAGE, TRUE)` is what
triggers it. The state already half-exists in `js/game_display.js`
(`putstr_message` sets `TOPLINE_NEED_MORE`) but nothing reads it, and the render
path in `js/display.js` is a separate code path that ignores it. Unifying those
two is the job.

**Do not bolt the string on unconditionally.** C shows it only when the top line
is unacknowledged AND the game is about to block for input; guessing will cost
frames elsewhere. Model `toplin` and let it decide.

### The leaderboard, and what it says about our real problem

`node tools/leaderboard.mjs` reads `/leaderboard/data.json` directly — the page
itself renders from JS, so fetching its HTML only ever shows "Loading…".

Standings at 2026-07-25T01:15Z, sorted by **held-out**, which is the half that
actually decides the contest:

```
  #  HELD-OUT   scr%   rng%  pass   PUBLIC   scr%  pass   fork
  1   10424  92.5%  95.3% 43/44    11405 100.0% 44/44   serteal
  2    4326  38.4%  18.8%  4/44    11366  99.7% 33/44   richie3366
  3    2877  25.5%  14.7%  1/44    11405 100.0% 44/44   xeophon
  4    2524  22.4%  15.4%  2/44    11405 100.0% 44/44   Hoimar
  5    2463  21.9%  13.4%  2/44     4842  42.5%  9/44   lockwo
  6    1201  10.7%  16.3%  2/44     2073  18.2% 15/44   chanting-monks
  7     265   2.4%  11.1%  0/44    11405 100.0% 44/44   daoa0601
  8     253   2.2%   9.1%  1/44      259   2.3%  0/44   vtjeng
  9      61   0.5%   2.4%  0/44    11405 100.0% 44/44   kevinjosethomas
 10      52   0.5%   6.0%  0/44      169   1.5%  1/44   aganders3
 11      43   0.4%   8.9%  0/44      133   1.2%  0/44   us
```

**Read the fourth column, not the seventh.** Four entrants sit at a perfect
11405/11405 public with 44/44 sessions passing and then score 265, 61, 2524,
2877 on the held-out set. That is the overfitting signature the contest warns
about, and it is worth remembering every time our own public number moves: a
public point that does not bring a held-out point with it was not real.

serteal leads on merit — 92.5% held-out — but by Emscripten-transpiling the C
rather than porting it. Phase 2 divides parity by `git diff` size, so that
approach is a bet on Phase 1 only.

**Our own number to watch is the ratio: held-out / public = 0.32.**
vtjeng is at 0.98, lockwo 0.51, chanting-monks 0.58, richie3366 0.38. Ours is
low because 111 of our 134 public screens are character-selection frames, which
only exist in sessions whose rc does not pin the hero. That is not overfitting —
the chargen port is faithful — but it does mean our screen count is concentrated
in one feature rather than spread across the game.

**The strategic consequence.** Held-out RNG (8.9%) is *lower* than public
(12.2%), so held-out sessions diverge earlier. Nothing about that is fixable by
polishing frames; it is fixed by getting further into each session's PRNG
stream. Level generation and the first turn of the move loop are what every
session in both halves runs, which makes `m_move` the highest-value target for
the held-out half as well as the public one.

### peace_minded and u.ualign.record — verified facts, fix not yet landing

Four sessions block at `peace_minded(makemon.c:2306)`. The draw is

```c
return (boolean) (!!rn2(16 + (u.ualign.record < -15 ? -15 : u.ualign.record))
                  && !!rn2(2 + abs(mal)));
```

so the bound reads `u.ualign.record` directly. seed0002 (a Healer) has C drawing
`rn2(26)` against our `rn2(16)` — C's record is **10**, ours is **0**.

Verified:
- `roles[].initrecord` is 10 for Archeologist, Barbarian, Healer, Knight, Monk,
  Rogue, Ranger, Samurai and 0 for Caveman, Priest, Tourist, Valkyrie, Wizard.
  Healer being 10 matches C's rn2(26) exactly.
- C sets it in **`newhp()`, src/attrib.c:1091**, inside the `u.ulevel == 0`
  branch under `if (svm.moves == 0)` — not in u_init. `js/allmain.js` hardcodes
  `record: 0` instead.

Porting that assignment faithfully — into `newhp()` where C has it, with
`g.u.ualign` pre-created so the write lands — scores **132 screens / 108385
RNG** against the current 134 / 109589, and **seed0002 does not move at all**
(still call 2206). So the assignment is not reaching the value peace_minded
reads, or something downstream of a non-zero record regresses more than it
gains. Reverted.

**Instrumented, and the answer is neither.** A probe on the final line of
`peace_minded()` records ZERO calls across the whole of seed0002 — our port
never reaches the function. `js/makemon.js`'s peace_minded is itself a faithful
port of the C, final draws included; it simply is not called where C calls it.
So the `rn2(16)` we emit at call 2206 comes from somewhere else entirely, and
the `peace_minded` tag in the diverge output is C's label for that position,
not ours.

Two things fell out of that probe that need explaining before anything here is
touched again:

- **`game.urole.name.m` reads "Rambler" after the run.** Rambler is a Tourist
  RANK TITLE, not a role name; no entry in `roles[]` is called that. Something
  is assigning a rank record over `game.urole`. `js/botl.js` `rank_of()` /
  `xlev_to_rank()` are the obvious suspects. If `urole` is clobbered mid-game
  then every role-derived draw after that point is wrong, which would matter far
  beyond peace_minded.
- **seed0002 pins nothing** (`OPTIONS=symset:DECgraphics`), so its Healer comes
  from interactive chargen. Confirm our chargen actually selects Healer before
  blaming anything downstream.

Do NOT re-attempt the newhp/initrecord change until those two are settled. It
measured 132 screens / 108385 RNG against 134 / 109589 and moved seed0002 not at
all, which is exactly what you would expect if peace_minded never runs.

### A faithful fix that made the score go DOWN — land it with its partner

`mkobj()` (js/mkobj.js:119) is missing C's SPBOOK_no_NOVEL branch:

```c
if (oclass == SPBOOK_no_NOVEL) {
    i = rnd_class(svb.bases[SPBOOK_CLASS], SPE_BLANK_PAPER);
    oclass = SPBOOK_CLASS;      /* for the sanity check below */
} else {
    prob = rnd(go.oclass_prob_totals[oclass]);
    ...
}
```

SPBOOK_no_NOVEL (11) is a PSEUDO-class, not a real oclass. Its range stops at
SPE_BLANK_PAPER and so excludes SPE_NOVEL, summing to **999** where the full
SPBOOK_CLASS total is **1000**. `js/mklev.js`'s supply-chest bonus items pass it
directly, three times in a ten-entry table.

**Adding that branch is a faithful port and it moves the score DOWN:**
screens 134 → 133, positional RNG 107412 → 106766. It also does exactly what it
should: `rnd_class(objnam.c:5413)` leaves the blocker histogram entirely and
seed0014's first divergence rises from **1758 to 2915**.

The cost lands elsewhere: sessions blocking at `mkobj(mkobj.c:289)` go from 5 to
13. That line is `prob = rnd(go.oclass_prob_totals[oclass])`, so a second bug in
the per-class totals (or in which class the icp walk selects) was previously
being cancelled out by the missing branch. Two wrongs were making a right.

**RESOLVED and landed.** The partner bug was the constant itself:
`include/objclass.h:152` defines `SPBOOK_no_NOVEL` as `(0 - (int) SPBOOK_CLASS)`
= **-10**, a NEGATED class, and `js/mklev.js` had it hardcoded as **11**, which
in this build is `WAND_CLASS`. So the branch was firing on wands. With both
fixed together: RNG 13.5% -> 13.8%, screens held at 134, and sessions stuck at
mkobj.c:289 went from 13 back to 5. Kept for the record because the shape
recurs — a faithful fix can look like a regression when a second bug was
cancelling it out:

- `game.oclass_prob_totals[SPBOOK_CLASS]` is **1000** at runtime and
  `bases[10..12] = [366, 410, 438]`, both verified correct.
- The public spellbook range 366..407 sums to 999, also correct.
- So the data is right; look at the icp walk in `mkobj()` and at the totals for
  whichever class `rnd(100)` actually selects. In seed0002 at call 1115,
  `rnd(100)=95` walks mkobjprobs to index 8 = WAND_CLASS, and C then draws
  `rnd(1000)`. Check our WAND_CLASS total against that.

### The exact next action — READ THIS FIRST

**The whole themed-room path is now ported except the fill CONTENTS.**
`lspo_map` places and stamps the shaped rooms, `lspo_region` turns them into
rooms, and `themeroom_fill`'s reservoir sample is exact. `lspo_map` and
`themeroom_fill`'s sample have both left the blocker histogram.

Two bugs found on the way, both worth remembering:

- **`gi.in_mk_themerooms` was read in four places and written in none.** Every
  themeroom-specific branch in the level generator was dead. Its visible effect
  is in `check_room`: after the `rn2(3)` that decides whether to give up, a
  themeroom returns FALSE immediately rather than shrinking its bounds and
  retrying. Retrying let `create_room` succeed where C failed, and the extra
  `split_rects` left our free-rectangle list larger than C's. Worth **+0.6%** of
  the corpus on its own.
- **`des.region` defaults `joined` to TRUE**, and `filler_region` omits the key.
  Hardcoding it false stopped `makecorridors` joining those rooms. **+0.2%**.

**Next: the fill contents.** Two are reachable in the public corpus, identified
by replaying the sample against C's own logged results:

- **"Ghost of an Adventurer"** (seed0015, themerms.lua:222) —
  `selection.room():rndcoord(0)`, `des.monster{id="ghost", asleep, waiting}`,
  then six independent `percent()` gates each placing an object by `id` or by
  `class` with `buc = "not-blessed"`.
- **"Buried zombies"** (seed0013 ×2, themerms.lua:151) — `(rm.width *
  rm.height) / 2` iterations of `shuffle(zombifiable)` then a buried corpse with
  a stopped rot timer. The zombifiable list GROWS with level difficulty (4
  entries below depth 4, 6 below 7, 8 above), and `shuffle` draws one rn2 per
  element, so the difficulty changes the draw count.

Both need `des.object` (by id, by class, with `buc` and `buried`) and
`des.monster`, which is the `mkobj`/`makemon` bridge the special-level loader
needs anyway. `selection.room():rndcoord()` is `selection_rndcoord`
(selvar.c:302) over the room's cells — one `rn2(npoints)`.

### The closest session to a full pass: seed0102 at 99.2%

`seed0102-ranger-name-cancel` matches **4451 of its 4485 PRNG calls**. The 34
that remain are all one subsystem — the pet.

```
4448  rn2(5)     distfleeck(monmove.c:538)     <- last match
4449  rn2(100)   obj_resists(zap.c:1469)       <- the pet weighing an item
4450  rn2(8)     dog_goal(dogmove.c:554)
4451  rn2(4)     dog_goal(dogmove.c:575)
4452  rn2(1)     dog_move(dogmove.c:1255)
4453  rnd(5)     score_targ(dogmove.c:830)
```

Our port runs `movemon` but has no `dog_move`, so the turn ends where C's pet
starts thinking. `dog_goal(dogmove.c:575)` is separately the blocker in three
more sessions, and `obj_resists` heads the histogram with five — the same
subsystem showing up under three different names.

**The prerequisite is `m_move`, not `dog_move`.** `js/monmove.js` is 34 lines:
`distfleeck()` is real (its `rn2(5)` is correct and matches), and `dochug()`
does nothing else but `note_unported('m_move')`. So no monster moves at all.

The dispatch to port, at src/monmove.c:1773, is one line inside `m_move`:

```c
if (mtmp->wormno) goto not_special;
if (mtmp->mtame) {                       /* my dog gets special treatment */
    return postmov(mtmp, ptr, omx, omy, dog_move(mtmp, after),
                   seenflgs, can_tunnel, can_unlock, can_open);
}
```

so `dog_move` cannot be reached without `m_move`'s prologue (`mfndpos`, the
`can_open`/`can_unlock` flags) and `postmov`. Budget `m_move` + `postmov` +
`dogmove.c` together — roughly 3,000 lines of C — rather than treating the pet
as a separable piece. It is the largest single gap left in the port, and it is
what stands between the corpus and its first passing session.

### Stub sweep — one more found, not yet fixed

`grep -rn "stub" js/` after the `make_engr_at` fix turns up one more that hides
a real draw:

**FIXED this session.** `make_grave()` is ported, and mkgrave's `dobell`
initialiser now draws before the room-type test. Left here for the pattern:

**`make_grave()`** used to be `loc.typ = GRAVE` and nothing else. The
C (src/engrave.c:1687) is:

```c
if ((levl[x][y].typ != ROOM && levl[x][y].typ != GRAVE) || t_at(x, y))
    return;                       /* our stub places one anyway */
if (!set_levltyp(x, y, GRAVE)) return;
del_engr_at(x, y);
if (!str)
    str = get_rnd_text(EPITAPHFILE, buf, rn2, MD_PAD_RUMORS);   /* A DRAW */
make_engr_at(x, y, str, NULL, 0L, HEADSTONE);
```

Our only caller passes `null` for `str` unless `dobell`, so the `get_rnd_text`
draw is live. Everything needed is already there — `get_rnd_text` in
`js/rumors.js`, the epitaph file in `js/dat_files.js`, and `make_engr_at` as of
this session. **Check first whether any public session reaches it**; it was left
alone rather than added unverified.

Remaining stubs that draw nothing and can wait: `dealloc_obj`,
`add_to_container`, `set_corpsenm`, `sobj_at` (returns false — makemon.js:716
notes the rejection it disables), `in_rooms` (returns [] — mklev.js:1163 uses it
for a shop-door test).

### Leads found but not acted on — start here if the fill contents stall

**`playmode:debug` and the wizard extended commands — 3 sessions.**
seed0360, seed0383 and seed0399 all diverge in the same place and for the same
reason, and it is not a level-generation bug at all. Their rc carries
`playmode:debug`, and their first keys are `#levelchange`. Immediately after
`moveloop_preamble` the C log shows a repeating triple —

```
rnd(8)  newhp(attrib.c:1101)     <- role hpadv.inrnd
rnd(2)  newhp(attrib.c:1103)     <- race hpadv.inrnd
rn2(8)  newpw(exper.c:64)        <- note :64, the LEVEL-GAIN branch,
                                    not the :52 one u_init uses
```

repeated 14 times: `pluslvl()` running once per gained level.

**`newhp()` and `newpw()` are already ported and already correct**, including
these branches — `attrib.c:1101`/`:1103` are the `u.ulevel < urole.xlev` LOW
branch (`hpadv.lornd`), not the initial-HP branch a few lines above, and
`exper.c:64` is `newpw`'s matching level-gain branch. Do not rewrite them.

What is actually missing is three things, none of them arithmetic:

1. **`playmode:debug`.** The rc option is parsed into `rc.opts` and never
   consumed, so `wizard` is never set and the WIZMODECMD commands stay hidden.
2. **Extended commands.** `js/cmd.js` has no `#` handling at all — no
   `doextcmd()`, no `getlin()`. That is the real cost here, and it is shared
   with every other `#` session in the corpus, so it pays for itself well beyond
   these three.
3. **`pluslvl(incr)`** (src/exper.c:310) and `wiz_level_change()`
   (src/wizcmds.c:446), which is `getlin("To what experience level do you want
   to be set?")` then `while (u.ulevel < newlevel) pluslvl(FALSE)`.

`newhp` does live in **attrib.c** in 5.0 rather than exper.c, and ours is in
`js/exper.js` — an architecture-rule mismatch to fix when something else touches
that file, not a correctness bug.

**seed0009 is at 89.9% of its PRNG stream**, the highest in the corpus, and
diverges at call 3337 of 3713 in `getbones(bones.c:645)` followed by
`splev_initlev` and `mktrap` — C is generating a second level where our port
carries on in the move loop. Worth a look purely because it is the closest any
session has come to a full pass.

**`somey(mkroom.c:674)` — 3 sessions** (seed0104, seed0108, seed5002), all
around call 1500, inside level generation.

### What the window layer now provides

`js/tty/wintty.js` has both real C code paths: `tty_start_menu`/`tty_add_menu`/
`tty_end_menu` building an item list rendered by `process_menu_window`, and
`tty_putstr` filling `cw.data` rendered by `render_page` (`process_text_window`).
`tty_display_nhwindow` picks between them exactly as the C does — `if (cw->data
|| !cw->maxrow)` takes the text renderer — so a window's *type* and its
*renderer* are independent, which the legacy blurb depends on.

Rules verified against recordings rather than inferred:

- `display_nhwindow(win, TRUE)` blocks inside the window; the captured frame is
  the window.
- **`wintty.c:13` does `#define H2344_BROKEN` unconditionally.** The branch that
  looks conditional is the only one that ever compiles: `offx = min(min(82,
  cols/2), cols - maxcol - 1)`, so a menu is capped at *half the screen width*
  rather than pushed as far right as it fits, and there is **no `offx == 10`
  collapse test**. The chargen menus are where it shows: longest line 32 puts
  them at column 40, not 47. `process_text_window` also does `cl_end()` on every
  row under this define, not just inset ones.
- **Two different width rules.** `tty_putstr` uses `strlen + 1`; `tty_end_menu`
  uses `strlen + 2` per `add_menu` entry. One column decides whether the legacy
  window sits at 23 or 22.
- **`morestr` is only ever set by `tty_end_menu`.** A window filled with
  `putstr` shows `--More--` whatever its type. `(end) ` (trailing space) comes
  from `end_menu`; `(N of M)` from paging.
- Menu text and prompt both render at `offx + 1`; an `NHW_TEXT` prompt at `offx`.
- An inset menu OVERLAYS the map; only a collapsed one clears the screen.
  Dismissing one calls `docorner`, which blanks columns `offx..79`; during role
  selection `program_state.in_role_selection` forces a full clear instead.
- **`tty_curs(BASE_WINDOW, ...)` inside `docorner` and `dmore` moves the base
  window's cursor**, and that is where the next `tty_putstr(BASE_WINDOW)` writes.
  A second "Who are you?" after `a` on the confirmation menu lands on the row
  below the dismissed menu because of this and nothing else.
- Menu titles wear `iflags.menu_headings` (ATR_INVERSE) because
  `init_sound_disp_gamewindows()` runs *before* `player_selection()`.
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
| `lspo_map(sp_lev.c:6154)` | 7 | **Lua** |
| `obj_resists(zap.c:1469)` | 3 | |
| `mkobj(mkobj.c:289)` | 3 | |
| `wipeout_text`, `somey`, `rnd_class`, `next_ident`, | 2 each | |
| `newhp`, `makelevel`, `hole_destination`, `getbones` | 2 each | |
| everything else | 1 each | |

`fill_special_room`, the `nhlib` shuffle and `rnd_rect` are all gone from this
table. `lspo_map` is the only Lua item left.

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
