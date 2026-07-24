# Working notes

Things discovered while doing the work that are not obvious from reading the
contest docs, and that would cost the next agent time to rediscover.

**Add to this file whenever you learn something non-obvious.** Edit the existing
entry if one covers the same ground rather than appending a duplicate. Keep each
entry short: what is true, how it was found, what to do about it.

Newest first within each section.

---

## Scoring: what the runner actually does

Read from `frozen/ps_test_runner.mjs`, which is the same runner the judge uses.

**Cursor position is part of the screen score, not a tiebreaker.**
`docs/API.md` says cursors are "scored as a tiebreaker only". That is stale. The
runner counts a screen as matched only when the cell grid **and** the cursor both
agree (`ps_test_runner.mjs:371-377`), and `/README.md` agrees: "character + color
+ attribute + cursor position". A perfectly rendered screen with the cursor one
column off scores zero for that step. Port the cursor choreography, do not defer
it.

The runner does report `cellsOnly` and `cursors` sub-counts separately in its
JSON, and prints them on the FAIL line when they disagree — useful for triage.

**`runSegment` is called with one argument.** `docs/API.md` documents
`runSegment(input, prevGame = null)`, but the runner calls `runSegment(input)`
with no second argument (`ps_test_runner.mjs:337`). Do not rely on `prevGame`
carrying anything between segments. All cross-segment state must round-trip
through `input.storage`. This matters for every multi-segment session.

**RNG "matched" is a positional count, not a prefix length.** The runner counts
every index where our call equals C's (`ps_test_runner.mjs:357-359`). After a
divergence, later calls can coincidentally realign, so a high RNG percentage can
hide an early break. `tools/diverge.mjs` prints both the positional count and the
index of the first divergence — trust the first-divergence index.

**Per-session local timeout is 45 s**, from `SESSION_REPLAY_TIMEOUT_MS`
(`ps_test_runner.mjs:461`). The judge allows 900 s. So a session can pass the
judge's clock and still time out locally. Raise the env var rather than
optimising prematurely.

**The scorer writes `.cache/session-results.json`** with the full JSON bundle
after every run, so tooling can read the last score without re-running.

**The fork's CI overlays only two of the three frozen files.**
`.github/workflows/score.yml` copies `frozen/isaac64.js` and
`frozen/terminal.js` over `js/`, but not `frozen/storage.js`, even though
`docs/API.md` lists all three as frozen and overlaid by the judge. So a local
edit to `js/storage.js` would pass CI and fail the judge. Do not edit it.

## The recorder

**`make install` does not install `sysconf`, and without it the recorder exits
before the first frame.**
The binary is built with `SYSCF` enabled (`include/config.h:232-234` defines
`SYSCF` and `SYSCF_FILE "sysconf"`), so `cfgfiles.c:2052` opens `sysconf`
relative to HACKDIR and calls `exit(EXIT_FAILURE)` if it is missing.
`SYSCONFINSTALL` is commented out in `sys/unix/Makefile.top:110-119` and no
minimal hints file defines it, so nothing ever creates the file.

The failure is silent in the worst way: `scripts/record-session.mjs` reports
`[ok] wrote …` and produces a session with the right number of segments and
**zero steps**. `scripts/verify-rerecord.mjs` then reports `FAIL: seg 0 steps len
N vs 0` for all 44 sessions, which reads like a recorder determinism problem
rather than a missing file.

Fixed permanently in `nethack-c/build-recorder.sh` (step 6). If you rebuild by
hand, the install dir needs a `sysconf`.

**The stock `sysconf` template breaks on macOS.** It sets
`GDBPATH=/usr/bin/gdb` and `GREPPATH=/bin/grep`; NetHack refuses to start when
those name files that do not exist, and prints `2 errors in sysconf.` as its
first screen. Strip `GDBPATH`, `GREPPATH`, `PANICTRACE_GDB`, and
`PANICTRACE_LIBC` — they only affect crash handling. The build script does this.

**Debug-mode sessions need `WIZARDS=*` in sysconf.** 13 of the 44 public
sessions set `playmode:debug` in their nethackrc. NetHack honours that only for a
user listed in the sysconf `WIZARDS` line; the stock template says
`WIZARDS=root games`, so an ordinary user is **silently demoted to normal play**.
There is no warning — you get a complete, valid, entirely different game, with
different attributes and a different level. The tell is the status line: a
debug-mode game shows the player name as `wizard` regardless of the rc `name:`,
so canonical `Wizard the Digger` re-recording as `Magellan the Digger` means the
demotion happened. The build script now writes `WIZARDS=*`.

**Debug mode forces the player name to `wizard`,** which means every debug-mode
segment shares one lock file (`<uid>wizard.0`) no matter what the characters are
named. Combined with the next entry, this is what broke the one remaining
multi-segment session.

**Abandoned in-progress games leak a lock into the next segment.** When a
segment's `moves` run out mid-death-sequence, the driver SIGTERMs the recorder
before NetHack unlinks its lock file, and the next segment opens on `There is
already a game in progress under your name. Destroy old game? [yn]` instead of
the recorded first frame — one step, then nothing.
`scripts/record-session.mjs` deliberately does not wipe state between segments
(a save/restore pair needs the save file), so this needed a narrower fix:
`clearAbandonedGame()` removes lock and per-level files (`*.<n>`) between
segments **only when `save/` is empty**, preserving bones, the scoreboard, and
genuine save/restore pairs. Hit by `seed5002-wizard-coverage-pair`.

**With all of the above, the recorder is bit-exact on the whole corpus:
`node scripts/verify-rerecord.mjs` reports 44/44 pass.** No normalisation is
needed for most sessions; `verify-rerecord.mjs` elides only the build-date
banner and the rc home path.

Recording is fast: a 23-step session re-records in well under a second, and all
44 sessions re-record in a couple of minutes.

## Session file format

`sessions/*.session.json`, version 5:

```
{ version, source, recorded_with, segments: [ { seed, datetime, nethackrc, moves, steps } ] }
```

Each step is `{ key, rng, screen, cursor }`, plus `depth` after the first and
`animation_frames` where animation fired. `key` is `null` on step 0 (the frame
before any input). `cursor` is `[col, row, visible]`.

RNG entries carry the caller annotation the scorer strips:

```
rn2(2)=0 @ randomize_gem_colors(o_init.c:89)
```

That annotation is the single most useful debugging asset in the repo — it names
the exact C source line that made each call. `tools/diverge.mjs` uses it to name
the next function to port.

Screens use `\n` line separators, `\x1b[NC` cursor-forward runs, SGR colour
escapes, and `\x0e`/`\x0f` to enter and leave DEC line-drawing mode.

The corpus is 51 MB across 44 files. Never read one whole; query with `node -e`.

## Lua is on the critical path, not a late-game concern

Measured with `tools/coverage-map.mjs` over the 44 public sessions.

- `src/sp_lev.c` executes in **44/44** sessions, 97,479 PRNG calls. Its hottest
  functions are `create_room` (32,170), `get_location` (26,830), and
  `dig_corridor` (23,570) — those are *ordinary* level generation, not special
  levels.
- **Every** session makes Lua-context PRNG calls, tagged `@ nh.rn2()` by recorder
  patch 004. The floor is 210 calls, in the shortest 25-step sessions. Total
  23,671 calls, 3.0% of the corpus.
- Exactly **one** Lua binding draws randomness: `nh.rn2`. Nothing else. So the
  randomness surface of the Lua layer is tiny — it is the script *execution
  order* that has to be reproduced, not a wide API.
- `lspo_*` opcodes appear (`lspo_replace_terrain` 4,597, `lspo_map` 368,
  `lspo_gold` 29). Those are called *from* Lua scripts, confirming scripts really
  are running on ordinary levels.
- `flip_level_rnd` appears (128 calls), so the 5.0 mirrored-level feature fires
  in the public corpus.

Conclusion: level 1 of every game runs Lua, almost certainly via themed rooms
(`themerms.lua`, `nhcore.lua`, `nhlib.lua`). M9 was split into M9a (Lua core,
prerequisite of M4) and M9b (named special levels and quests) as a result.

## js/terminal.js was stale, and it made every local screen score zero

**The single most expensive trap found so far. Check this first if screens are
inexplicably zero.**

`js/terminal.js` in the fork was 632 lines and had **no `serialize()` method**.
`frozen/terminal.js` is 713 lines and has one. The judge and
`.github/workflows/score.yml` both overlay the frozen copies over `js/` before
scoring, but **`frozen/score.sh` does not** — so local runs used the stale file.

`js/jsmain.js`'s capture hook reads:

```js
nhGame._screens.push(term?.serialize ? term.serialize() : '');
```

With no `serialize`, that silently pushes an empty string for every frame. So
local screen score was **structurally incapable of being non-zero**, no matter
how correct the port was. Frame 0 looked "blank" in every diagnostic, which
reads as a rendering bug and sent this project looking in the wrong place for a
while.

Fixed by syncing all three frozen files into `js/`, which is exactly what the
judge does:

```bash
cp frozen/isaac64.js frozen/terminal.js frozen/storage.js js/   # keep in sync
```

Immediately took seed8000 from 0 to **15/23 screens** with no other change.

**Keep them in sync.** Re-run that copy after any pull from upstream, and never
edit the `js/` copies — they are overwritten on every scoring run. A quick check:

```bash
for f in isaac64 terminal storage; do diff -q frozen/$f.js js/$f.js; done
```

## The fill phase does not affect the frames we currently match

Measured directly: disabling the room-fill phase entirely (no
`fastforward_fill_mineralize`, no real fill) leaves seed8000 at **19 screens**,
exactly as with the replay. RNG parity drops (45.9% -> 38.0%) but not one frame
changes.

That means the fill phase can be ported incrementally without risking the
screens we have — **provided the guard is the screen count, not RNG parity.**

It also corrects an earlier diagnosis. Wiring the real fill loop was blamed for
taking seed8000 from 19 screens to 0. It was not: that pass changed two things
at once, and the culprit was replacing `js/mklev.js`'s object-creation stubs
with `js/mkobj.js` (whose `mksobj` skips `mksobj_init`, and which `mklev` also
calls during the *structural* phase). The fill loop on its own is neutral on
screens. Isolate one change at a time before attributing a regression.

## Two RNG metrics, and when they disagree

`tools/scoreboard.mjs` reports **positional matches** — how many indices happen
to agree. `tools/diverge.mjs` reports the **first divergence index** — how far
the stream is actually correct. They can move in opposite directions, and when
they do, the first-divergence index is the one telling the truth.

This happened when the room-fill loop was wired up. Replacing replayed
`fastforward` values with the real `fill_ordinary_room` loop:

```
positional matches   49.0% -> 45.9%    (looks like a regression)
mean first divergence  ~700 -> 908     (actually deeper)
makelevel(mklev.c:1402) blocker   8 sessions -> 0
```

The replayed values were seed8000's, replayed into every session; past the
divergence they realigned by coincidence often enough to inflate the positional
count. The real code stops sooner but everything it emits is correct.

**Rule of thumb:** a positional-match drop is only acceptable when the mean
first-divergence index rises and a named blocker disappears from the
`diverge --all` histogram. Check both before concluding either way. If the
positional count drops and divergence does *not* get deeper, it is a real
regression — fix or revert.

### Screens can regress while the port gets more correct

The same trap applies one level up. Fixing the trap constants moved seed8000's
divergence 1451 -> 1522 and simultaneously dropped its screens 19 -> 0: the
level fill was wrong *before and after*, and the fix changed which square an
object landed on, so a `?` appeared where C had blank floor.

That is not a reason to revert a fix that is demonstrably right against the C.
It means the divergence has to be pushed past the point that decides visible
placement. Two more fixes (the Oracle supply-chest branch condition, and the
dungeon globals it depends on) took it to 1535 and screens came back to 19.

**Do not revert a verified-correct change because screens dipped. Do not commit
while they are still down either — carry on to the next divergence and re-check.
Only revert when the change cannot be justified against the C source.**

## Hardcoded constants are the single biggest bug class in this port

**Rule: never write a numeric game constant in `js/`. Import it.** Four separate
hand-written constant blocks have now been found, and in every one the majority
of entries were wrong. Each looked plausible, compiled fine, and failed
silently. Before adding any constant, check whether the generated tables
(`js/objects_data.js`, `js/monst_data.js`, `js/role_data.js`,
`js/dungeon_data.js`) or `js/const.js` already carry it; if not, extend the
generator rather than typing the number.

The four found so far:

| Where | Wrong | Effect |
|---|---|---|
| `mklev.js` object constants | 21 of 23, plus 7 of 8 classes | see below |
| `mkobj.js` `P_BOW` / `P_SHURIKEN` | both | were 26 and 31, real values 20 and 24, so `is_multigen()` was false for every dart and arrow and the `rn1(6,6)` stack-size draw never happened |
| `mklev.js` trap constants | 18 of 25, `BEAR_TRAP` absent | `SQKY_BOARD` was 5, which is really `BEAR_TRAP`, so every bear trap looked like a squeaky board and skipped `mktrap_victim()` — about 25 missing draws per trap |
| `makemon.js` `G_GENOD`/`G_EXTINCT` | both | wrong G_ family, see next section |
| `mklev.js` `MM_NOGRP` passed as `2` | — | real value `0x2000`; `2` is `MM_NOWAIT`, so the group-spawn branch fired for every `G_SGROUP`/`G_LGROUP` species |

`mktrap_victim()` alone had `ARROW = 349` (real 18), `DART = 353` (real 24),
`PM_ELF = 18` (real 264 — and 18 is `ARROW`), `PM_ARCHEOLOGIST = 305` (real
331).

### Two disjoint `G_` families that overlap numerically

`include/monflag.h` defines `G_` twice. The `mons[].geno` family is
`G_UNIQ 0x1000 … G_SGROUP 0x0080, G_LGROUP 0x0040, G_NOCORPSE 0x0010,
G_FREQ 0x0007`. The `mvitals[].mvflags` family is `G_KNOWN 0x04,
G_GENOD 0x02, G_EXTINCT 0x01`. `js/makemon.js` had copied `G_GENOD` and
`G_EXTINCT` from the wrong family as `0x0100`/`0x0080` — and `0x0080` is a
live flag (`G_SGROUP`) in the other namespace, so the mistake reads as real
data rather than as nonsense. Nothing had set `mvflags` yet, so the test was
dead; the moment `propagate()` landed it would have kept every unique monster
eligible forever and changed `rndmonst_adj()`'s draw count for the rest of the
game. Both families are now scraped into `MFLAGS`.

### The original case

`js/mklev.js` carried its object and object-class constants as hardcoded
literals. **21 of 23 object constants and 7 of 8 class constants were wrong.**

```
BOULDER       was 465  -> 475   (465 is "worthless piece of orange glass", GEM_CLASS)
GOLD_PIECE    was 466  -> 438
STATUE        was 472  -> 476
FOOD_RATION   was 143  -> 293
WEAPON_CLASS  was 1    -> 2     (1 is ILLOBJ_CLASS)
TOOL_CLASS    was 12   -> 6
GEM_CLASS     was 14   -> 13
```

Nothing noticed for a long time because object creation was stubbed: a wrong
otyp still produced *an* object and the stub drew a fixed pattern regardless.
The moment a real `mksobj_init` went in, `mksobj_at(BOULDER, ...)` selected a
GEM_CLASS object and drew `rn2(6)` where C draws nothing — which is exactly the
single extra draw that defeated three consecutive wiring attempts.

They are now derived from `js/objects_data.js` (`ONAMES` / `OCLASSES`), which is
generated from the C. **Never hardcode an otyp or an oclass**; import it.

## Generated tables must resolve enum identifiers to numbers

`tools/gen-*.mjs` expand the C with `clang -E`, but the preprocessor leaves
*enum* identifiers alone (it only eats `#define`s). If the generator writes them
through as strings, every comparison against them in ported code is silently
false forever — no error, no warning, just a branch that never runs.

This has now bitten twice:

- `objects_data.js` emitted `oc_material: "IRON"`, `oc_subtyp: "ARM_SUIT"`, so
  `mkobj_erosions()` never fired.
- `monst_data.js` emitted `mlet: "S_COCKATRICE"`, `msound: "MS_HISS"`,
  `pmidx: "PM_COCKATRICE"`, so `makemon()`'s whole `mlet` switch was dead and
  `peace_minded()`'s `msound === MS_LEADER` tests could never be true.
  `js/role.js` was *assigning* those strings too (`pm.msound = 'MS_LEADER'`).

Both generators now carry `collectEnums()`, which flattens every `enum` in the
preprocessed text and resolves leaves at any depth. `gen-monst.mjs` also has
`defines()`, which scrapes object-like `#define`s straight from the headers for
the flag families the preprocessor removes: `MFLAGS` (`M1_`/`M2_`/`M3_`/`G_`
from `monflag.h`), `MMFLAGS` (`MM_` from `hack.h`), `ATTKS` (`AT_`/`AD_` from
`monattk.h`), `STRAT` (`monst.h`) and `LIMITS` (`MAXMONNO`).

Resolution must also handle **negated** identifiers. `oc_skill` (`oc_subtyp`)
stores thrown-weapon skills as `-P_DART`, and a resolver that only matched bare
identifiers left that as the string `"-P_DART"` — so no skill comparison could
ever be true, and the defect looked exactly like the two above.

**If you add a generator, resolve its enums (including negated ones), and
verify with a check that no field came out as a string.** A one-line assertion
is enough:

```js
objects.filter(o => Object.values(o).some(v => typeof v === 'string'
    && /^-?[A-Z][A-Z0-9_]*$/.test(v)))   // must be empty
```

## trquan() is called twice per weapon or tool entry

`ini_inv()` (src/u_init.c) draws the quantity once in its own loop and
`ini_inv_adjust_obj()` draws it *again* for `WEAPON_CLASS` and `TOOL_CLASS`
before returning "stop". Porting only the first call loses one draw per weapon
entry and shifts everything after it.

The other easy miss in the same area: `ini_inv(Money)` runs after
`u_init_race()` when `u.umoney0` is non-zero, contributing an `rn2(1)` from
`trquan` plus a `next_ident`. Those two look like the head of the attribute
block that follows and are easy to attribute to the wrong function.

## Reached-but-unported paths are recorded, not approximated

Ports that cannot yet reach a C branch call `note_unported(what)`, which adds a
label to `game.unported` (a `Set`). Nothing invents a draw to stand in for
missing code — an invented draw desynchronises the whole rest of the session,
whereas a missing one at least stops cleanly at a known point.

After a run, `game.unported` names exactly which C code the session wanted.
seed8000 currently reaches none of them, so its remaining divergence is a
correctness bug in ported code rather than a gap.

## The RNG log format, precisely

From `nethack-c/patches/003-rng-log-core.patch` and verified against the
recordings. Getting this wrong desynchronises the whole log, so it is worth
knowing exactly.

- **Six entry types are logged**, each by its own wrapper: `rn2` (749,484 in the
  public corpus), `rnd` (38,037), `d` (3,393), `rne` (1,062), `rnz` (707),
  `rnl` (155).
- **`rn1` is a macro**, `#define rn1(x, y) (rn2(x) + (y))`
  (`include/hack.h:1535`). It logs as its inner `rn2` and never as `rn1(...)`.
  There are zero `rn1` entries in the corpus, despite `docs/API.md` listing the
  format.
- **`d(n,x)` draws through `RND()` directly**, not through `rnd()`
  (`src/rnd.c:186`). So it logs exactly one entry and no inner ones:
  `d(11,8)=49 @ newmonhp(makemon.c:1042)` with nothing before it. A port that
  implements `d` as a loop over `rnd()` emits n bogus entries and desynchronises
  everything downstream. The skeleton did exactly this; fixed in M2.4.
- **`rnl(x)` also draws through `RND()` directly**, then makes a *real* `rn2`
  call for the Luck adjustment — but only when Luck is non-zero. So `rnl` usually
  logs one entry, and sometimes an `rn2` immediately before it.
- **Wrapper functions log after their inner calls.** The macros in the patch do
  not fire inside `rnd.c`, so inner calls inherit the outer caller's annotation
  and appear first. Observed for `rnz(350)`: `rn2(1000)`, `rn2(4)`, `rn2(4)`,
  `rne(4)=2`, `rn2(2)=1`, then `rnz(350)=1065` — all annotated
  `@ pleased(pray.c:1356)`.
- **Seeding** is 8 little-endian bytes of the seed (`src/rnd.c:43-58`).

## The display RNG context is not scored

`rn2_on_display_rng` (`src/rnd.c:70`) draws from `rnglist[DISP]`, a second
ISAAC64 context. Recorder patch 005 logs those calls with a `~d` prefix
(`~drn2(N) = M`), and only when a separate env var is set.

**There are zero `~d` entries in the public corpus**, and the scorer's
`isRngCall` predicate (`/^(?:rn2|rnd|rn1|rnl|rne|rnz|d)\(/`) would filter them
out anyway. So display draws never affect the RNG score.

They do affect *screens*, because hallucination picks glyphs through this stream
— `seed0383-wizard-hallucinate` and `seed0399-wizard-hallu-actions` are 751 steps
between them. Two things to know when M10.6 gets there:

- `rnglist[DISP]` has `init: FALSE` and is **never seeded**. It is a
  zero-initialised `isaac64_ctx` that is drawn from directly, so the display
  sequence is the same in every game regardless of seed.
- `js/isaac64.js` (frozen) exports no way to construct a zero-state context —
  `isaac64_init` takes seed bytes. Building the display context will need a
  zero-state equivalent assembled by hand.

## o_init.c is the first RNG consumer in every session

Measured across all 44 public sessions. **Every session's very first PRNG call
is `rn2(2) @ randomize_gem_colors(o_init.c:89)`.** Nothing in the stream precedes
it, so nothing downstream can align until `o_init` is right.

Exact call sites and volumes across the corpus:

```
10725  shuffle(o_init.c:129)          the bulk — description shuffling
   55  randomize_gem_colors:89/92/95  rn2(2), rn2(2), rn2(4), once per segment
   55  init_objects:234               objects[WAN_NOTHING].oc_dir = rn2(2) ? ...
```

(55 rather than 44 because the corpus has 56 segments, not 44.)

**`options.c` and `cfgfiles.c` never appear in any RNG log.** Option parsing
consumes zero randomness for these rc files, so the parser has no ordering
constraint against the stream. `role.c` does appear, in 21/44 sessions but only
42 calls total — random role/race selection when the rc does not pin them.

**The dependency this creates:** `shuffle()` walks `objects[]` and its draw count
depends on `oc_name_known` and the class ranges, so porting `o_init` requires the
object data table first. That table is `include/objects.h` — 1,659 lines, 361+
macro entries, the same generatable shape as `optlist.h`. Generate it, do not
transcribe it.

## nhlib.lua overrides math.random — the Lua PRNG may never be used

**This corrects the earlier xoshiro256\*\* finding. Read both.**

`dat/nhlib.lua:5` replaces `math.random` outright:

```lua
math.random = function(...)
   local arg = {...};
   if (#arg == 1) then
      return 1 + nh.rn2(arg[1]);
   elseif (#arg == 2) then
      return nh.random(arg[1], arg[2] + 1 - arg[1]);
   ...
```

So once `nhlib.lua` has loaded, every `math.random` in every script routes to
**NetHack's core RNG**, not Lua's. That is why all 23,671 Lua-context calls in
the corpus are `nh.*`, and why the annotation on the first one reads
`@ random src=nhlib.lua:8` — line 8 is literally `return 1 + nh.rn2(arg[1])`.

**What this means for M9a:** the Lua layer's randomness is just `rn2`, which we
already have. No xoshiro256\*\* implementation is needed for anything the
public corpus exercises.

**What is still unresolved.** Recorder patch 001 goes out of its way to seed
Lua's `math.randomseed` from `NETHACK_SEED`, which would be pointless if the
shim always won. Two possibilities: the patch is simply defensive, or some Lua
state is created *without* `nhlib.lua` loaded, where `math.random` would still
be xoshiro. A draw from real xoshiro produces **no log entry at all** (it never
passes through `nh_rn2`), so its absence from the corpus is not proof.

Do not assume either way. The symptom to watch for is a level layout diverging
while the RNG log matches perfectly — that is what an unlogged xoshiro draw
looks like. The verified JS implementation and its reference vector are recorded
in [09-lua-and-special-levels.md](09-lua-and-special-levels.md) so it can be
dropped in if that symptom ever appears.

## Only two Lua scripts draw randomness

Refining the earlier Lua measurement. Across the corpus, 23,671 calls carry an
`@ nh.*` annotation, but only 1,512 also carry the richer
`src=<file>.lua:<line> parent=<fn>(<file>.lua:<line>)` form — and those name
just **two** files:

```
1402  nhlib.lua
 110  themerms.lua
```

So for *RNG parity* the Lua surface is two scripts, not 131. Other scripts still
have to execute to build levels correctly, but they do not draw. That materially
shrinks M9a's critical path.

The `src=`/`parent=` annotation gives the exact `.lua` file and line for each
draw, which is the Lua-side equivalent of the C caller annotation — use it the
same way `tools/diverge.mjs` uses the C one.

## Measured port priority

Top C files by how many sessions execute them, from `coverage-map.md`. All of
these appear in 44/44 sessions:

```
makemon.c 233,702 calls   mklev.c 131,517   sp_lev.c 97,479   mkobj.c 42,397
mon.c      26,200         mkmap.c  20,601   rect.c   17,966   allmain.c 12,743
mkroom.c   12,304         o_init.c 10,945   dungeon.c 6,186   eat.c      5,448
```

Hottest individual functions: `rndmonst_adj` (makemon.c, 204,394),
`mineralize` (mklev.c, 100,206), `distfleeck` (monmove.c, 33,817),
`create_room` (sp_lev.c, 32,170), `m_move` (monmove.c, 28,208).

**Caveat that matters:** this only sees code that draws random numbers. The tty
windowport, `botl.c`, and `objnam.c` are invisible here despite producing a large
share of the actual screen output. Do not read this as "port these and nothing
else".

## Baseline measurements

Taken 2026-07-24 against the untouched skeleton.

- `seed8000-tourist-starter`: C makes 3130 RNG calls, we make 3270. First
  divergence at call **3103**, in `m_move` (`src/monmove.c:1963`) — we draw
  `rn2(12)` where C draws `rn2(20)`. 3126 positions match by coincidence after
  it, which is exactly the overstatement described above.
- First screen miss is step **0**, the very first frame. The skeleton renders it
  **completely blank** — 227 of 1920 cells differ and every one is "C has a
  glyph, we have a space". The cursor, however, is already correct at `[36,7,1]`.
  So `fastforward.js` fakes RNG well enough to place a cursor and nothing else.
  This confirms the README: fake RNG credit produces no screens.
- Whole-corpus baseline: **0/11,405 screens**, 25,429/792,838 RNG positions
  (3.2%), 0/44 sessions passing. The 3.2% RNG figure is almost entirely
  coincidental alignment, not real progress.
- Public corpus: 44 sessions, 56 segments, 11,405 steps by our count (the README
  quotes 11,284 scored steps; the difference is steps with no recorded screen).
  792,838 annotated PRNG calls in total.
