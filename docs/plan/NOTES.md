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

## getobj's obj_ok_func filter changes how many keys it eats

`getobj(word, obj_ok_func, ctrlflags)` takes a predicate naming which carried
objects are valid for THIS command. C builds its prompt from that set and, on a
letter that fails it, prints a refusal and **loops for another key**.

**Correction — reading src/invent.c:2056-2072 in full changes this.** The
re-prompt loop fires ONLY when the typed letter matches no inventory object at
all (`!otmp`), or the count is bad. A letter that matches an object always
breaks out of the loop, and `obj_ok(otmp) == GETOBJ_EXCLUDE` then returns NULL
**without reading another key**. So the predicate does NOT change key
consumption; it only changes whether the command proceeds.

What that means for the `doapply` attempt that cost a screen on seed0077: the
cause was almost certainly the RETURN VALUE, not the key count. That port
returned ECMD_TIME for every non-direction apply, so it burned a turn wherever
C's `use_*()` returns ECMD_OK — a failed or no-op apply. Turn accounting, the
same bug class as the unhandled `.` command, not misalignment.

So the rule is narrower than first written: wiring a getobj command is safe for
key alignment, and the open question is only the RETURN VALUE.

**That question is genuinely unresolved — do not assume either answer.** Both
choices are wrong by exactly one turn in opposite directions, and the turn
counter feeds monster movement allotment, hunger and the exercise checks:

- `ECMD_TIME` matches C whenever the action SUCCEEDS, which is the common case
  for a session that deliberately reads or wields something.
- `ECMD_OK` matches C when the action fails or is a no-op, and avoids inventing
  a turn for an effect we never actually performed.

Tried both on the seven wired commands (read, wield, quaff, drop, wear, put on,
remove): **measured identical** — no per-session screen changes, no divergence
point moves, only post-divergence RNG noise. So the public corpus cannot decide
it. Left as ECMD_TIME, which is what shipped.

**RESOLVED by reading src/read.c doread() to its end: `ECMD_TIME` is right.**
The function returns ECMD_TIME after `seffects(scroll)`, and every ECMD_OK exit
is narrow — over encumbrance, reading a shirt while blind, a shirt covered by
armor. A normal scroll read takes a turn, so the shipped value is correct and
the proposed change to ECMD_OK would have been wrong.

Expect the same shape for the other six (wield, quaff, drop, wear, put on,
remove): the C function does its work and returns ECMD_TIME, with ECMD_OK
reserved for refusals that happen BEFORE anything occurs. Verify per command
rather than assuming, but ECMD_TIME is the right default.

The lesson that generalises: three rounds of reasoning about this produced two
different answers and one wrong NOTES entry, and thirty seconds of reading the
function's last line settled it. When a question is "what does C do here",
read C — do not reason from what would be sensible.

## Instrument the quantity that must differ, don't hypothesise about causes

`a` (apply) resisted four hypothesis-driven attempts — each plausible, each
reverted, each wrong (obj_ok_func changing key counts, the ECMD_TIME/ECMD_OK
choice, inventory letters differing, the hero having no inventory). One
measurement settled it in a single iteration.

The method: identify the ONE quantity that must differ for the symptom to
exist, print it per keystroke under both conditions, and diff the traces.

    # in the capture hook, per key
    process.stdout.write('M' + keyIdx + '=' + (game.moves||0) + ' ')

    without the change:  ... M19=2 M20=2 M21=2 ...
    with the change:     ... M19=2 M20=3 M21=3 ...

That names the exact keystroke, and from there it is a short read of the C to
find what it does with that key. (Answer here: the rogue's item `e` is a
LOCK_PICK, `apply_ok` returns GETOBJ_SUGGEST for TOOL_CLASS, and pick_lock
reaches get_adjacent_loc — so C eats the next key as a DIRECTION where we ran
it as a move.)

**Why screens could not answer it:** seed0077's rc does not set `time`, so the
status line has no `T:` field and the turn counter is invisible on every frame
except the one `^X` enlightenment screen. A screen diff said "step 27 breaks",
which is true and useless — the turn was spent seven keystrokes earlier.

Generalise: screendiff finds WHERE output differs; per-keystroke state tracing
finds WHERE STATE diverges. Use the second whenever the symptom is a count, a
position, or anything the recorded screens do not display.

## Wiring `a` (apply) costs seed0077 a screen — twice, cause unknown

Two independent attempts, both reverted:

1. `doapply` -> `getobj`, returning ECMD_TIME for every non-direction apply.
2. `doapply` -> `getobj`, returning ECMD_TIME only for lamps (whose handler
   `use_lamp()` is void, so doapply's `int res = ECMD_TIME` genuinely survives)
   and ECMD_OK for everything else, consuming no keys beyond the object letter.

Both cost seed0077-rogue-chargen exactly one screen (17 -> 16). The second
attempt consumes strictly fewer keys and fewer turns than the first, so the
cause is NOT simply "we invented a turn" and NOT the ECMD_TIME/ECMD_OK choice.

**Third attempt localised it exactly.** Wiring a minimal `doapply` (getobj,
then ECMD_OK — no turn, no extra keys) breaks exactly ONE step, 27, and the
diff there is a single cell:

    r8 c26   C 'You entered the dungeon 2 turns ago.'
             ours 'You entered the dungeon 3 turns ago.'

So the port spends **one extra turn** somewhere between the apply and step 27,
even though doapply itself returns ECMD_OK. The keys around it are
`...j a e j i...`: `a` then `e` as the object letter, then `j`, then `i`.

The invlet hypothesis is DEAD — the rogue's letters are a-f, so `e` matches an
object and getobj cannot be looping. Something else in that key run costs a
turn C does not spend.

**Do NOT bisect by "which step first differs".** seed0077's rc does not set
`time`, so the status line carries no `T:` field and the turn counter is
INVISIBLE on every screen except step 27, whose key is `^X` (the attributes /
enlightenment display, which prints "You entered the dungeon N turns ago").
Steps 0-26 matching therefore proves nothing about when the extra turn was
spent — it may have been spent much earlier and simply never shown.

**Traced. The two `game.moves` sequences part at keystroke 20:**

    without apply:  ... M17=2 M18=2 M19=2 M20=2 M21=2 ...   (C agrees: 2)
    with apply:     ... M17=2 M18=2 M19=2 M20=3 M21=3 ...

The keys there are `a` `e` `j` `i`, and the rogue carries letters **a-f only**.

- WITHOUT apply: `a` is an unknown command (no turn); `e` runs doeat, whose
  getobj reads `j` — no match, so it loops through `i` and then ESC, a
  quitchar, returning null. doeat returns ECMD_OK. **Zero turns**, and C
  agrees.
- WITH apply: `a` runs doapply, whose getobj reads `e` — a match, returns
  immediately. Then `j` is left to run as a MOVEMENT command. **One turn.**

So C, like our no-apply path, spends nothing across that run. Since C's doapply
certainly consumes `e` too, the difference must be what C does with `j`
afterwards — it is not treating it as a move. Read `getobj`'s behaviour when
`apply_ok` REJECTS the matched object: C prints "silly thing" and returns NULL
(src/invent.c:2071), but check whether it consumes further input first, and
check what `apply_ok` returns for the rogue's item `e`.

That is the whole remaining question, and it is now a two-function read rather
than a hunt.

Until then `a` stays unwired. It is 232 keystrokes across the corpus and worth
having, but not at the price of a screen on a session that currently matches.

## screendiff rows are SCREEN rows, and the map starts at screen row 1

`tools/screendiff.mjs` prints raw terminal rows. The tty layout is: row 0 is the
message line, rows 1..21 are map rows 0..20, rows 22-23 are the status lines.

So a difference reported at **screen row R is map row R - 1**. Reading a
reported `r 11 c31` as map <31,11> lands you on a wall one row below the actual
square and makes a probe come back empty, which looks like "the object is not
there" when it is.

Columns are 1:1 — screen column C is map column C.

Second trap, learned the same way: **a probe fired from inside a game function
runs at whatever step that function first executes, not at the step screendiff
showed you.** Gate it on the step number, or dump every step and pick the row
you want, or the two measurements are of different moments and any conclusion
drawn by comparing them is meaningless.

## Use screendiff on a step where the RNG still matches

The RNG log only sees draws. A whole category of bug — wrong text, wrong
formatting, a mis-consumed keystroke — never touches the PRNG and is invisible
to `diverge.mjs` no matter how long you stare at it.

The move: find the step where the first RNG divergence lands
(`diverge.mjs` prints `divergent call occurs at seg N, step M`), then run
`node tools/screendiff.mjs <seed> <M-1>` — the last step where the streams still
agree. Everything that differs on that screen is a non-drawing bug, already
present before the RNG went wrong.

One run of this on seed4500 step 40 surfaced three at once:

- `OPTIONS=playmode:debug` turns on wizard mode, and `set_playmode()`
  (src/options.c:10134) then **overwrites plname with "wizard"** — so a session
  setting both `name:` and `playmode:debug` shows "Wizard", not the configured
  name. Wrong on every frame of every debug session.
- The status line capitalises the name's first letter (src/botl.c:989) while
  `plname` itself keeps what was typed.
- Strength above 18 renders as `18/xx` (`get_strength_str`, src/botl.c:20).
  `STR18(x)` is `18 + x`, so a stored 19 IS `18/01` — the value was right and
  only the rendering was wrong.

Worth +27 screens in one commit, after a long stretch where RNG-chasing had
stopped producing any screen gain at all.

The same screen also showed the hero in the wrong place with a turn counter of
29 against C's 11, which led to '#' being unhandled: a session issuing
`#jump\n` had its own letters read as commands (`j` and `u` moved the hero).
Consumption alignment is not visible in the RNG log either.

## The second-biggest bug class: the port does the work and drops the result

Distinct from wrong constants, and invisible to every RNG check. The function
has the right name, the right signature, draws exactly what C draws — and then
throws away the part that had no draw in it. Four found so far:

| Symptom | Cause |
|---|---|
| Spellbook level test never fired | `objects[otyp].oc_level` read `undefined`. `oc_level` is a `#define` onto `oc_oc2`; our generated table had only the underlying names, and `undefined > 1` is quietly false. |
| Every monster targeted `<0,0>` | `set_apparxy()` absent. Its ordinary path assigns `mux,muy` and returns **without drawing**, so its absence cost zero RNG. |
| No object ever on any floor | `mkobj_at()`/`mksobj_at()` called `mkobj()` and returned it without `place_object()`. The draws were perfect; only the placement was dropped. |
| `dochug`'s whole move condition | `distfleeck()`'s `nearby`/`scared` outputs were computed and discarded by the caller. |

Why it survives review: a JS port reading a field nobody writes gets `undefined`,
and `undefined > 1`, `undefined & FLAG`, `if (undefined)` are all silently false.
In C every one of these is a compile error.

**How to find them.** Do not read the C for the lines containing `rn2`. Read the
whole function body and ask what it *writes* — a field, a list, a global — then
grep our port for a reader of that thing. `place_object`, `mux`, `oc_level` and
`aexe` were each written by nobody and read by somebody.

The corollary, seen three times in one session: **fixes arrive in pairs.** A
missing draw costs nothing until something else exposes it. `init_uhunger` was
invisible until the exercise system existed to read `uhunger`; `distfleeck`'s
stub was invisible until `set_apparxy` gave it real coordinates. Expect a fix to
reveal the next bug rather than to raise the score on its own.

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

It has now bitten a third and fourth time, found only because `find_ac()` printed
`AC:NaN`:

- `role_data.js` emitted `mnum: "PM_ROGUE"`, `ldrnum: "PM_MASTER_OF_THIEVES"`,
  `petnum: "NON_PM"`, `spelstat: "A_INT"` — twelve fields across `roles[]` and
  `races[]`, every one of them an index into `mons[]`. `mons[urole.mnum]` was
  `undefined` for every role in the game and nothing said so.
- `objects_data.js` emitted **arithmetic**, not identifiers: `oc_oc1: "10 - 10"`
  (that is `a_ac`, the armour class), `oc_cost: "50 + 30"`, `oc_dir: "1|2"`,
  `oc_tough: "(7 >= 8)"`. 84 armour values, 74 costs. `clang -E` reduces macro
  names to numbers but does not fold the arithmetic, and the generator only
  matched *single* literals.

So the check has to be wider than "no bare identifiers". **A generated numeric
field must never be a string, whatever the string looks like.**

```js
// no identifiers AND no unevaluated expressions
objects.filter(o => Object.values(o).some(v => typeof v === 'string'
    && (/^-?[A-Z][A-Z0-9_]*$/.test(v) || /^[-+*/|&^()~<>=!\d\s]+$/.test(v))))
```

`gen-roledata.mjs` now runs `collectEnums()`; `gen-objects.mjs`'s `value()` now
evaluates any leaf that is pure arithmetic or a pure comparison (a boolean
result becomes 1/0, matching C).

**The failure mode is what makes this class dangerous.** A string where a number
belongs does not throw. `"IRON" === IRON` is false, `mons["PM_ROGUE"]` is
`undefined`, `10 - "10 - 10"` is `NaN` — and `NaN` propagates through the status
line as the literal text `AC:NaN`, which is how this one was finally caught,
three subsystems downstream of the generator that produced it.

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

## Making a window frame score: five things the diff taught us

seed8000 step 15 (the `\\` discoveries window) is the first frame produced by
the tty window layer. Getting it to match all 1920 cells needed these, and the
same five will apply to the inventory and attributes windows:

1. **`display_nhwindow(win, TRUE)` BLOCKS inside the window.** `wintty.c`'s
   `dmore()` waits for a key while the window is on screen, so the frame the
   recorder captures at that `nhgetch()` is the window itself. Returning to the
   move loop instead lets its `flush_screen()` redraw the map over the window
   before the next capture — the first attempt did exactly that and rendered a
   perfect map where a window belonged.

2. **An `NHW_TEXT` window puts its prompt on the LAST LINE OF THE SCREEN.**
   `process_text_window()` ends with
   `tty_curs(BASE_WINDOW, cw->offx + 1, (cw->type == NHW_TEXT) ? ttyDisplay->rows - 1 : n)`.
   A six-line discoveries window still has its `--More--` on row 23. A menu puts
   it directly under the content.

3. **Single-page windows say `--More--`, not `(end)`.** `dmore()` uses
   `cw->morestr ? cw->morestr : defmorestr`, and a window that does not page
   leaves `morestr` null.

4. **NetHack's attribute numbers are not the terminal's bit flags.**
   `include/wintype.h` has `ATR_INVERSE = 7`; the frozen `js/terminal.js` uses
   inverse = bit 1. `term_start_attr()` translates. Passing the number through
   unchanged renders normal text and costs you every heading cell.

5. **`unknow_object()` is why a starting scroll is discovered.** Its last line is
   `obj->known = objects[otyp].oc_uses_known ? 0 : 1` — object types that do NOT
   use the flag get it set TRUE. `ini_inv_use_obj()` then gates discovery on
   `OBJ_DESCR(...) && obj->known`, so a scroll of magic mapping is learned and a
   food ration (no randomised appearance) is not. `mksobj()` was skipping
   `unknow_object()` entirely.

A bonus check falls out of this: the shuffled appearance in the frame
("ANDOVA BEGARIN", "murky") comes straight from `o_init`'s shuffle of
`oc_descr_idx`, so a correct label is independent confirmation that the o_init
port is right.

### Watch the key budget when adding a window

A window consumes its own dismissing key. If you remove ESC or space from
`cmd.js`'s `KNOWN_UNPORTED` while adding one, the standalone presses that are
NOT dismissing a window fall through to the "Unknown command" branch, which C
never prints — that turned one new passing frame into three broken ones before
it was spotted.

## `sp_lev.c` is not all Lua — check before blaming the interpreter

`tools/diverge.mjs` names the C function that made the next call, and for a long
stretch the top blocker was `fill_special_room(sp_lev.c:2763)` in 12 sessions.
It is tempting to read "sp_lev.c" as "the Lua level loader" and file it under
M9a. **It is plain C**, and so are most of that file's line numbers that show up
in the histogram. `sp_lev.c` hosts both the Lua opcode handlers (`lspo_*`) and
ordinary special-room machinery; only the `lspo_` ones need the interpreter.

All 12 were the vault case — `mkgold(rn1(abs(depth) * 100, 51), x, y)` per
square — and they cleared with two changes, neither of them Lua:

1. `fill_special_room()` had no port at all, so `makelevel()` added the vault
   room, set `needfill`, and never filled it.
2. `makelevel()` has **two** `fill_special_room()` call sites: one right after
   the vault (src/mklev.c:1330) and one walking every room at the end
   (src/mklev.c:1415). Wiring only the first left every `do_mkroom()` room
   unfilled.

**Before attributing a blocker to Lua, open the C at that line.** The genuine
interpreter blockers are the ones tagged `lspo_*` or `nh.rn2 src=<file>.lua`.

## Lua's math.random is shimmed away — and counting Lua STATES is most of the job

Two findings that together change how to approach M9a.

**1. `math.random` never reaches Lua's own PRNG.** `dat/nhlib.lua:5` replaces it
outright:

```lua
math.random = function(...)
   local arg = {...};
   if (#arg == 1) then return 1 + nh.rn2(arg[1]);
   elseif (#arg == 2) then return nh.random(arg[1], arg[2] + 1 - arg[1]); end
end
```

nhlib.lua is the first thing every Lua state loads, so by the time any script
calls `math.random` the shim is already installed and the draw goes through
NetHack's core RNG — and therefore **into the RNG log**. The recordings confirm
it: `rn2(3)=2 @ random src=nhlib.lua:8 parent=shuffle(nhlib.lua:19)`, and line 8
is the `nh.rn2` line of the shim.

This resolves the old worry that xoshiro256** draws would be invisible. They are
not used. `js/lua/lmathlib.js` is still ported and verified (see
`tools/verify-lmathlib.mjs`) because a script could in principle call
`math.random` before the shim, but it is not on the critical path.

**2. Each Lua state costs exactly `rn2(3)`, `rn2(2)`.** `nhlib.lua` runs
`shuffle(align)` at file scope, so *creating* a state draws even if no script
does anything. Counting states correctly is worth real sessions on its own:

| State | Created by |
|---|---|
| core | `newgame()` → `l_nhcore_init()` |
| level | `mklev()` → `nhl_init()` |
| themerooms | inside `makelevel()` |
| **pager** | `com_pager("legacy")` from `src/allmain.c:831` — **only when the `legacy` option is on** |

`legacy` is `opt_out` with `initval On`, so most sessions have the fourth state
and a session whose rc says `!legacy` does not. That single missing pair was the
first divergence in three sessions. The correlation across the corpus is exact.

So before building interpreter machinery for a divergence tagged `nhlib.lua`,
check whether it is simply a state you are not creating.

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

## The tty window layer has two renderers, and a window's type does not pick one

`win/tty/wintty.c:1944`:

```c
if (cw->data || !cw->maxrow)
    process_text_window(window, cw);
else
    process_menu_window(window, cw);
```

A window built with `add_menu()` has `mlist` and no `data`; one built with
`putstr()` has `data`. **The `NHW_MENU` / `NHW_TEXT` type decides the geometry,
the fill method decides the drawing.** The legacy blurb is the case that proves
it: `dat/quest.lua` says `output = "menu"` for that entry, so `deliver_by_window`
creates an `NHW_MENU` — and then fills it with `putstr`. It insets like a menu
(`offx` from `maxcol`, footer under the content) and draws like a text window
(leading space, `--More--` rather than `(end) `).

Three width and prompt rules that are easy to conflate:

| | `tty_putstr` path | `tty_add_menu` path |
|---|---|---|
| width | `strlen + 1` | `strlen + 2` (in `tty_end_menu`) |
| `maxrow` | `nitems` | `nitems + 1` |
| `morestr` | never set → `--More--` | `(end) ` or `(N of M)` |

## `#define H2344_BROKEN` is unconditional

`win/tty/wintty.c:13`. Every `#ifdef H2344_BROKEN` in that file is live and every
`#else` is dead. It changes three things that matter:

- `offx = min(min(82, cols/2), cols - maxcol - 1)` — a menu is capped at half
  the screen width, not pushed as far right as it fits. The chargen menus have a
  longest line of 32; the dead branch puts them at column 47, the live one at 40.
- There is **no `offx == 10` collapse test**. Only `maxrow >= rows` collapses a
  window to full screen.
- `NHW_TEXT` gets `offx = 0` directly, and `process_text_window` calls `cl_end()`
  on *every* row rather than only inset ones.

Reading the `#else` branch because it looks like the portable one costs a day.

## The BASE_WINDOW cursor is real state, and menus move it

`tty_curs(BASE_WINDOW, x, y)` sets `wins[BASE_WINDOW]->cury`, and the next
`tty_putstr(BASE_WINDOW, ...)` writes *there*. Two places do this without
looking like they touch the base window at all:

- `dmore()` — `tty_curs(BASE_WINDOW, curx + offset, cury)` before writing the
  prompt.
- `docorner()` — one `tty_curs(BASE_WINDOW, xmin, y)` per row it blanks, so it
  leaves the cursor on the LAST row of the dismissed window.

That is the whole explanation for where the second "Who are you?" appears when a
player answers `a` ("choose another name") on the confirmation menu: the
confirmation menu had 8 items, `docorner` walked rows 0..9, and the prompt lands
on row 10. Nothing in `tty_askname` mentions a row number.

## Options change the status line, and seed8000 hides it

`js/display.js` hardcoded `Xp:%d/%d` and `T:%d`. Those are `flags.showexp` and
`flags.time`, both **off** by default — seed8000's rc happens to set
`showexp,time`, so the only session whose frames were passing was the one that
made the bug invisible. Every other session's status line was wrong by two
fields. When a field looks unconditional, check `optlist.js` before believing it.

## Module-scoped state leaks between sessions — the judge uses ONE process

The C runs each session as a separate process, so every file-scope global starts
zeroed. Our judge loads `js/jsmain.js` once and calls `runSegment` 44 times, so
anything at module scope survives into the next game.

This was invisible until `reset_role_filtering()` landed and a session that
pressed `~` left `gr.rfilter` set for whatever ran next. The symptom is the
tell: **`tools/diverge.mjs --all` and `node tools/diverge.mjs <session>`
disagreed** — seed0007 reported `div@0` in the sweep and `div@2831` on its own,
because the sweep shares a process and the single run does not. If those two
ever disagree again, look for module state before looking at the port.

`js/jsmain.js start()` now calls `reset_windows()`, `init_rect_globals()` and
`reset_role_globals()`. All three existed already and none of them had a caller.
**When you add module-scope state, add it to that list in the same commit.**

## A stub with the right name is worse than a missing function

`js/mklev.js` carried

```js
function make_engr_at(x, y, text, pristine, epoch, engr_type) { /* stub */ }
function wipe_engr_at(x, y, cnt, perm) { /* stub */ }
```

`makeniche()` called neither, and `wipeout_text()` — fully ported, correct, and
verified — had no caller at all. Two sessions diverged on it. Nothing in the
port read as broken: the names were right, the signatures were right, and the
real work sat in `js/engrave.js` waiting.

`grep -n "stub"` across `js/` before picking a target. A function that returns
nothing is not the same as a function that is absent, because `note_unported()`
never fires for it and `game.unported` stays clean.

Same commit, same file, another instance of the constant class: `mklev.js` had a
local `const DUST = 3` under a "Supply chest items" comment, while
`include/engrave.h` defines `DUST` as **1**. Two unrelated meanings, one name,
one file. Importing the engraving type from `const.js` is the fix; the lesson is
that a bare `const NAME = n` in a ported file is a smell even when it is not
currently wrong.

## The frozen terminal distinguishes gray from "no colour"; the C does not

`win/tty/termcap.c` sets `hilites[CLR_GRAY] = hilites[NO_COLOR] = nilstring` in
three independent branches (ANSI :1010, AMIGA :1201, TOS :1210). A gray glyph
therefore carries **no escape at all** and is byte-identical to an uncoloured
one. `js/terminal.js` (frozen) maps CLR_GRAY(7) to SGR 37 and NO_COLOR(8) to
SGR 39, so passing a raw CLR_GRAY through produces output the C never emits.

This is easy to miss because it can only ever show up as a colour-only cell
mismatch — the character matches, so a glyph-level check passes, and nothing
about it touches the RNG. Gray is the most common colour in the game (goblins,
all iron and mineral objects, rock), so the fix is worth more than one cell
suggests. `js/tty/termcap.js` now holds the collapse as `term_start_color()`.

**Generalisation:** any C behaviour implemented by a *table of strings* rather
than by code (hilites[], the symbol sets) can encode "do nothing" as an entry,
and a port that reimplements the lookup as arithmetic will miss it.

## Clearing a message means erasing the row, not just the buffer

Our `more()` cleared `game._pending_message` but left the text already painted
in the grid, so the next thing to draw landed on top of it — seed0360's tutorial
prompt read `Hello wizard, welcom Do you want a tutorial?`.

The C reaches the erase by a route that looks like a bug and is not:

    /* win/tty/wintty.c tty_display_nhwindow(), NHW_MESSAGE */
    more();
    ttyDisplay->toplin = TOPLINE_NEED_MORE;   /* more resets this */
    tty_clear_nhwindow(window);

`tty_clear_nhwindow` only does its `home(); cl_end();` when `toplin !=
TOPLINE_EMPTY`, and `more()` has just set it to EMPTY. Forcing it back is the
whole point of the assignment. Reading `more()` alone tells you the line is
cleared; only the caller actually erases it.

## The step-0 `--More--` claim was wrong: it is 3 sessions, not 32

Measured across all 44 public sessions: 3 have `--More--` on the first frame
(seed4500, seed5002, seed5006), 26 open on the role's intro text window
(`It is written in the Book of ...`), 9 open on a blank top line, and the rest
on a plain welcome message. The intro-text screens already match. Do not plan
work around the old "32/44" figure.

`more()`'s line break is `if (cw->curx >= CO - 8) topl_putsym('\n')`, i.e. the
suffix moves to row 1 only when the message ends at column 72 or beyond. That
is a property of the message length, not of whether a `--More--` happens.

## The advisory RNG count moves without the divergence point moving

seed0002 and seed4500 both lost RNG "positions match overall" (4279 -> 4268,
2939 -> 2936) from a change that improved screens by 10. Both divergence points
were unchanged, at calls 2320 and 2869. The lost matches were all *after* the
divergence, where agreement is coincidence. `git stash` + rerun `diverge.mjs` on
the affected sessions before treating an RNG drop as a regression.

## defsym.h is not the last word on a symbol: dat/symbols overrides it

`include/defsym.h` gives each map symbol an ASCII character, and it is tempting
to treat that as the answer. It is not. `dat/symbols` has a `start: DECgraphics`
section that overrides many of them, and these sessions run under DECgraphics.

Two that bit us, both worth 40+ screens each:

    S_vodoor: \xe1   # meta-a, checkerboard      (defsym.h says '-')
    S_hodoor: \xe1   # meta-a, checkerboard      (defsym.h says '|')

Both open-door orientations are the *same* DEC glyph, so `loc.horizontal` never
affects an open door on screen even though defsym.h implies it must. Likewise
`S_ndoor` and `S_room` are both `\xfe` (centred dot).

**Before hardcoding any map character, grep `dat/symbols` between `start:
DECgraphics` and the next `start:` for its `S_*` name.** If it appears there,
that entry wins.

## Engravings replace the background glyph

`src/display.c:422` picks the engraving glyph INSTEAD of the terrain when
`spot_shows_engravings(x,y)` (CORR, ICE or ROOM per include/engrave.h:50) and no
trap covers the square. S_engroom is '`' and S_engrcorr '#', both
CLR_BRIGHT_BLUE. We had been generating engravings and painting floor over them.

This is a good example of the general shape: the *state* was correct and the RNG
agreed; only the draw was missing. seed0105 matched 2479 of 2499 RNG calls while
scoring 0 of 30 screens, on one cell of its very first frame. A session with
high RNG agreement and zero screens is almost always a drawing bug, not a
gameplay one -- check `screendiff <session> 0` first.

## Local score and generalization are different axes; the score is the liar

Porting `merged` (src/invent.c:814) moved the local score by **exactly zero** --
351 screens and 113,910 RNG before and after -- while removing the single
largest generalization gap in the port: `tools/generalize.mjs` had it reached by
**58% of random games**, and after the port it does not appear on that list at
all.

`generalize.mjs` runs 40 games on seeds none of which come from `sessions/`.
That is the only instrument here that measures the held-out half, which is half
the final score. Run it before choosing a target and again after finishing one.

Corollary worth internalising: **a change that does nothing to score.sh can be
the most valuable change available**, and the reverse is the failure mode rule 1
exists to prevent. Do not rank work by local score delta.

## Some large functions contain no draws at all — measure before budgeting

`m_dowear` is 40 lines and `m_dowear_type` is 204, and neither contains a single
`rn2`/`rnd`/`rn1`. A 204-line port that cannot move the RNG number is still
worth doing (it sets `owornmask`/`misc_worn_check`, which nothing else sets, and
`which_armor` reads), but knowing that in advance changes how you budget it and
what you expect to see afterwards.

Cheap check before starting any port:

    awk '/^funcname\(/,/^}/' nethack-c/upstream/src/file.c | grep -cE '\brn2\(|\brnd\(|\brn1\('

Zero means the function is a *state* fix. Its effect shows up in screens or in
some later function's behaviour, never in `diverge.mjs` directly.

## dat/nhlib.lua replaces math.random; the nhlua.c warning is about the built-in

`src/nhlua.c:2946` carries a warning that looks alarming for a byte-exact port:

    /* XXX Note that math.random uses Lua's built-in xoshiro256**
     * algorithm regardless of what the rest of the game uses. */

Read alone, that says every `math.random` in `dat/*.lua` draws from a PRNG we do
not model, and therefore that `shuffle()`, `percent()` and `d()` cost no ISAAC64
calls. **That conclusion is wrong.** `dat/nhlib.lua:5` overrides the function
before any level-generation Lua runs:

    math.random = function(...)
       if (#arg == 1) then return 1 + nh.rn2(arg[1]);
       elseif (#arg == 2) then return nh.random(arg[1], arg[2] + 1 - arg[1]);

So `math.random(i)` is `1 + rn2(i)`, `math.random(0, 99)` is `nh.random(0, 100)`
i.e. one `rn2(100)`, and every `shuffle`/`percent`/`d` in the themeroom Lua IS
on the game stream. The nhlua.c comment describes the built-in that nhlib.lua
then replaces.

**General shape:** a `dat/*.lua` file can redefine a standard library function,
so a C-side comment about that function's behaviour may be describing something
the game never actually calls. Check `dat/nhlib.lua` before trusting one.

## A missing import is invisible until its branch runs

A JS module loads fine with a call to a name it never imported. The
ReferenceError fires only when that line executes, so a missing import on a
rarely-taken branch passes `node --check`, passes module load, passes every
public session that does not take the branch, and then throws on a held-out
game.

`tools/undefined-refs.mjs` reports, per file, the names used in call position
or as a namespace base (`MATERIALS.WOOD`) that the module never binds. First
run found seven real ones:

  - `pline` in js/eat.js, on the choke path, so any death by choking threw
  - `obj_resists` and `obj_extract_self` in js/sp_lev.js, both inside
    bury_an_obj, so burying anything threw
  - `MATERIALS` in js/sp_lev.js is_organic, same path
  - `rnd` in js/sp_lev.js and js/mon.js
  - `perceives` in js/dog.js, which was never ported at all

Two of the 40 generalize seeds were dying on that buried-object path; all 40
run clean now. None of the 44 public sessions ever reached any of it, so the
local score did not move by a point.

Run it after landing anything, and treat it as complementary to generalize.mjs:
generalize finds the crash, this finds the cause without needing a seed that
reaches it. It is a lexical scan, so it over-reports. Known false positives:
object-literal getters in js/game_display.js, `async (` in js/jsmain.js and
js/plselect.js, private `#` methods in js/lua/lmathlib.js, and `_statusLine1`
in js/display.js (defined at :329, still reported -- decomment mangles
something earlier in that file, so the tool is partly blind there).

## The scoreboard's per-session view is the diagnostic, TOTAL is not

`node tools/scoreboard.mjs | tail -3` hides regressions. A change can add 20
screens in one session and quietly break the only PASSING session, and the
total still goes up. Read the `sessions passed N/44` line every time, not just
the screen count: seed8000 went from 23/23 to 21/23 and the total still rose,
so the pass count was the only visible signal.

## A duplicated definition with a DIFFERENT body is invisible to every metric

`tools/dup-defs.mjs` reports names defined in more than one module and whether
the definitions agree. Both copies compile, both look right, and whichever one
the caller imported wins, so nothing in the score ever points at it.

First runs found, all real:

  - MMOVE_DIED and MMOVE_MOVED were SWAPPED in js/monmove.js against
    include/hack.h:1322, and js/dog.js had a THIRD copy with MMOVE_MOVED set
    to C's DIED value and no MMOVE_DIED at all -- dog_move's death return was
    an unbound name that would have thrown the first time a pet died
  - W_QUIVER was 0x0800 in js/u_init.js and js/objnam.js where
    include/prop.h:111 says 0x0200; the two agreed with each other so the
    display still worked
  - curse() in js/mklev.js set cursed and nothing else, missing C's
    COIN_CLASS early return and the blessed clear
  - carried() in js/eat.js tested membership of game.invent where
    include/obj.h:332 tests obj->where == OBJ_INVENT
  - Is_rogue_level in js/mkobj.js tested a level flag nothing sets, against
    js/const.js's real Lcheck
  - depth() and dist2() each existed twice, in the right file and a wrong one

Run it after touching anything shared. Most of what it reports is textual
(a multi-declarator `const A = 0, B = 1;` versus separate lines), so read the
bodies rather than the count. The `--all` flag lists the identical duplicates
too, which are still architecture drift: a header macro belongs in the JS
mirror of that header (js/obj.js, js/monst.js, js/mondata.js), not copied into
every file that needs it.

## Never infer a constant's value from its name; grep the #define

Three bugs in one session, all the same shape: a constant written from what the
name suggested rather than from the header.

  - OBJ_CONTAINED as 3; include/obj.h:77 says 2
  - LOW_PM as 1; include/permonst.h:15 says NON_PM + 1, and NON_PM is -1, so 0
  - UNKNOWN_SPELL as 0; include/spell.h:9 says -1

The last one was the expensive one. spelleffects_check takes the spell INDEX,
so UNKNOWN_SPELL = 0 made index 0 -- the first known spell -- look unknown, and
every cast was rejected on the function's opening line. The whole spell chain
was ported and correct and did nothing, and it took an instrumented run to
find that getspell was returning idx 0 perfectly while spelleffects_check was
never reached.

Sentinels are the dangerous ones. A name like NO_SPELL, NON_PM, UNKNOWN_SPELL
or P_NONE reads like zero and is often -1, and the wrong value does not throw:
it silently makes a valid index look invalid. `grep -rn "define <NAME>"
nethack-c/upstream/include/` costs two seconds.

tools/undefined-refs.mjs will not catch these. A wrong value is bound.

## A key read without a painted prompt is silent and corpus-wide

getobj and getdir both read their key with a bare nhgetch, so their prompts
never appeared. C reads BOTH through yn_function, which paints first:

    getobj  src/invent.c:1919  yn_function(qbuf, NULL, '\0', FALSE)
    getdir  src/cmd.c          yn_function(s ? s : "In what direction?", ...)

Routing the existing read through tty_yn_function adds the paint without
changing which key is consumed, so it is safe: the RNG cannot move, only the
screen. Both were worth several screens each because every command that asks
for an object or a direction shows them.

Sweep for more with

    grep -rn "await nhgetch()" js/*.js js/tty/*.js | grep -v tty_yn_function

and then check each against its C caller. NOT every one is a bug, and the
sweep was run to completion once:

  - js/cmd.js:618, :641  window dismissals. C uses xwaitforspace, not
                         yn_function, so a bare read is CORRECT here.
  - js/options.js:219    select_menu(win, PICK_ONE). A menu selection, not a
                         prompt. Correct as-is.
  - js/getpos.js:71      NOT the same fix. C's getpos (src/getpos.c:771) shows
                         its goal message CONDITIONALLY inside the loop, via a
                         show_goal_msg flag, rather than painting once before
                         the read. Porting it needs that flag's logic.

So getobj and getdir were the only two instances of the simple form, and both
are now fixed.

The related trap: a prompt can also be missing because its whole COMMAND is
unported. "Where do you want to travel to?" is a plain pline in dotravel
(src/cmd.c:5333) before getpos is called, and dotravel is not ported at all,
so no amount of work on getpos would produce it.

## Identify a glyph by its POSITION first, never by a colour that matches

Two sessions went into "seed0030 is missing a statue" on the strength of one
coincidence: the mismatched cell was an `f` in colour 15, and
`objects[STATUE].oc_color` is also 15. Statues take the monster's symbol and
the statue object's colour, so a white `f` is exactly what a kitten statue
looks like. The inference was clean and completely wrong.

What it cost: `fill_statuary` traced, `mk_trap_statue` found unported and then
fully ported (a real C function, so the port was kept), and neither changed a
single cell, because instrumentation showed both are entered ZERO times for
that seed. There was never a statue.

The check that would have killed it in one command, before any of that:

    @ row 5 col 19
    f row 5 col 20

The glyph is one square from the hero. It is the starting pet. Dumping the
recorded screen and printing the position of the mismatched glyph relative to
`@` costs one `node -e` and needs no knowledge of the subsystem at all.

The general rule: a colour or a symbol matching your hypothesis is consistent
with it, never evidence for it. The NetHack glyph space is small, symbols are
reused across objects and monsters by design, and colour collisions are
everywhere. Position, adjacency to the hero, and whether the thing MOVES
between steps are all cheap and all far more discriminating. Ask "where is it
and does it move" before "what could render like that".

The same shape shows up whenever a stack trace names one function: the tag on
a divergent RNG call names the C function containing the divergent line, and
the JS stack names OUR caller, and neither is the bug's location. In this same
thread our extra `rn2(4)` traced to `dochug` at the `is_wanderer` arm, and the
arm was correct term-for-term against the C; C simply short-circuited earlier
on `!nearby` because its pet was twelve columns from the hero and ours was
adjacent. Fixing the line the trace pointed at would have been fitting a
symptom.

## An unmodelled value may still be usable: check what the C does WITH it

ubirthday, the game's start time, is not derivable from this repo. The
recorder builds it with mktime() from NETHACK_FIXED_DATETIME in the recording
machine's local timezone, and takes tm_isdst from the moment the recording
was actually made. Determining it by fitting to the public sessions would be
overfitting, and it would silently break on any held-out session recorded
elsewhere.

That looks like a hard blocker, and for one consumer it is. But it blocked two
functions with different needs, and reading what each one DOES with the value
separated them:

  nameshk uses `ubirthday / 257` to pick a shopkeeper name. Genuinely
  TZ-dependent. BUT the modulo before its loop means every non-tools shop
  takes the first arm and draws nothing, so only the displayed NAME is
  affected, not the RNG stream. Ported, with the name recorded as unported.

  antholemon uses `ubirthday % 3` and nothing else. Every timezone offset is a
  whole or half hour, hence a multiple of 1800, and 1800 is divisible by 3. So
  the offset CANNOT change the result. Ported outright, computing the value
  from game.fixed_datetime so it stays correct for any recording timezone.

The general move: before recording something as blocked on an unmodelled
input, look at the arithmetic applied to it. A modulus that divides the
uncertainty, a comparison whose threshold the uncertainty never crosses, or a
value used only for display can all make the unknown irrelevant. The question
is not "do we know this value" but "can the answer change if we are wrong
about it".

The inverse is worth stating too, because it decides whether a port is safe:
if the unmodelled value gates whether a branch RUNS, it changes draw counts
and cannot be finessed. That is why antholemon mattered at all -- while it was
absent, the ANTHOLE arm always fell through to BARRACKS and spent an rn2(4)
the C does not.

## Default-On options: read them defensively, not with plain truthiness

include/optlist.h has 41 boolean options whose default column is On, and
js/jsmain.js sets only three of them on game.flags. That looks like 38 latent
bugs. It is not, and the sweep is worth not repeating.

Swept every default-On flag for "read somewhere in js/ but never set in
jsmain.js". Four came up: flags.acoustics, flags.autoopen, flags.bones,
flags.tutorial. Every one of them is read DEFENSIVELY, so an unset value
already behaves as On and matches the C:

    js/cmd.js     return game.flags?.autoopen !== false;
    js/mklev.js   if (flags.bones === false) return false;

That is the pattern to copy. Comparing against `false` rather than testing
truthiness means an option we have never initialised takes the C's default,
while an rc file that explicitly turns it off is still honoured.

The one real bug of this class came from breaking that pattern. is_safemon
was written as

    game.flags?.safe_dog && mon.mpeaceful && ...

so an unset safe_dog made is_safemon always FALSE, and every step onto a pet
fell through to the combat path instead of swapping places. optlist.h:634
shows safepet defaults On. Writing `game.flags?.safe_dog !== false` would have
been correct without needing the default set at all.

So: when porting a condition that reads an option, check its default column in
include/optlist.h, and if it is On, write the test so that undefined means on.
Setting the default in jsmain.js is the belt-and-braces fix but it is easy to
forget for the next option; the defensive read cannot be forgotten because it
is at the point of use.

## A small RNG delta downstream of a divergence is noise, not a defect

The shop-stocking port moved the advisory RNG figure by -36, and I treated
that as a bug to hunt. Five suspects were eliminated across several passes,
each comparison correct and each leaving the number unchanged. The number was
never a signal.

The mimic code the delta was attributed to runs at about call 9000 in the two
sessions that reach it, and both of those sessions diverge at about call 2900.
Everything measured there is post-divergence positional re-alignment. The
scoreboard prints the caveat on every run -- "rng is advisory only and counts
positional matches, so it can overstate progress after an early divergence" --
and it applies to small NEGATIVE deltas exactly as much as to progress.

Before chasing any residual, run tools/diverge.mjs on the sessions involved
and compare the divergence call number against where the suspect code runs. If
the code runs downstream, the delta tells you nothing about it.

THIS QUALIFIES THE LOOP RULE IN CLAUDE.md, AND THE TWO OTHERWISE CONFLICT.
The loop says "RNG must not regress. Screens must not regress. If either
drops, fix or revert before moving on." Taken literally that rejects any
faithful port whose code runs after the first divergence, because the delta
there is arbitrary re-alignment. It happened: linedup's boulder walk was
ported, cost 1 screen and 17 RNG, was reverted for it, and then had to be
restored once the check showed it first runs at call 3574 in a session that
diverges at 2869.

The rule with the qualifier:

    BELOW the first divergence  a delta is signal. Fix or revert.
    ABOVE it                    a delta is noise. Judge the port on whether
                                it matches the C, and say so in the commit.

The check is one instrumented print of where the new code first runs, against
the divergence index diverge.mjs already prints. It costs a minute and it is
the difference between keeping a correct port and discarding it.

I wrote the entry above and then walked into the same trap two threads later,
which is why this qualifier is spelled out rather than left implied.

What survives the retraction is worth noting too: set_mimic_sym genuinely was
an unported stub that every shop mimic reached, and porting it was right. The
work was correct even though the metric that motivated it was not measuring
what I believed. Good work can come from a bad signal -- that is not a reason
to trust the signal.

## The module graph is load-bearing: adding an import can regress the corpus

Porting in_your_sanctuary took four reverts, none of them caused by the port.
All four were the module graph.

Measured, each independently:

    monmove.js imports hack.js                     cycle, throws at load
    move the function to priest.js (its C HOME)    492 -> 238 screens
    jsmain.js imports hack.js only                 no change
    jsmain.js imports monmove.js only              no change
    jsmain.js imports BOTH                         492 -> 266 screens

The second one is the important one. Moving a function to the file matching
its C source is normally the RIGHT thing here, and it cost 254 screens. A
bisect settled it: stubbing the moved function to `return false`, so it
behaved exactly like the code it replaced, STILL regressed. The logic was
never involved; the restructuring was.

The likely mechanism is a cycle that does not throw. monmove.js re-exporting
from priest.js makes it import a module whose own imports lead back to
monmove.js, and ES modules resolve that by leaving a binding undefined at CALL
time rather than failing at load. The symptom is silent wrong behaviour, not
an error.

WHAT WORKS: publish the function on the shared game object from the module
that owns it, and read it through game.* from the module that needs it.

    js/hack.js:     game.in_rooms = in_rooms;
    js/monmove.js:  game.in_rooms?.(x, y, t) ?? ''

That touches no import edge, so the graph is byte-identical and the corpus is
unchanged. It is uglier than an import and it is the only thing measured to
work.

Note the asymmetry, because it is not obvious: monmove.js IMPORTING priest.js
is fine and does not regress. It was the RE-EXPORT that broke things. So the
rule is not "never add imports" -- it is "measure the corpus after any change
to the module graph, including one that only moves code between files".

LATER CORRECTION, and it matters because I drew the wrong conclusion twice.
After these failures I adopted "no new import edge into monmove.js under any
circumstances" and duplicated seven helpers locally to obey it. Testing the
edges ONE AT A TIME afterwards showed that rule was far too broad:

    monmove.js -> dog.js     safe
    monmove.js -> mkobj.js   safe
    monmove.js -> obj.js     safe
    monmove.js -> mon.js     safe (already a working cycle)
    monmove.js -> hack.js    FAILS
    monmove.js -> priest.js  FAILS (re-export only)

Four of those duplicates were reclaimed once each edge was tested, taking
dup-defs 155 -> 151. One of the failures I had recorded, "importing
Is_container from obj.js costs 129 screens", turned out to be a malformed
import anchor rather than a cycle at all.

THE GENERALISABLE MISTAKE: one failing edge tells you THAT edge is bad, not
that the class is bad. Generalising from a single measurement produced a rule
that cost real architectural debt and a false entry in this file. Test each
edge; it is about one command each.

## A no-op change that "fixes" nothing will not tell you it did nothing

I changed mon_resistancebits and resists_poison from reading mon.data.mresists
to game.mons[mon.mnum].mresists, and committed it as fixing a silent total
failure of every resists_* predicate. THAT CLAIM WAS FALSE.

js/makemon.js:1345 sets `data: ptr` on every monster it creates. Verified at
runtime on seed4500: all 15 monsters have .data, and for all 15
`mtmp.data === game.mons[mtmp.mnum]`. The two expressions are the same object.
The original code was correct and the change is a no-op.

WHAT MISLED ME, and it is worth guarding against: the score did not move, and
I read that as "this path is not exercised by the public sessions" rather than
as "this change does nothing". Both explanations predict an unchanged score,
and I picked the one that flattered the change. A no-op and a correct-but-
dormant fix are indistinguishable by score alone.

THE CHECK THAT SEPARATES THEM: before claiming a fix, demonstrate the OLD code
was wrong. Here that was one runtime print comparing the two expressions, and
it takes a minute. If you cannot show the old value differed from the new one,
you have not fixed anything.

The related trap is real though, and this is why the idiom looked suspicious:
`mon->data` is how the C reaches a permonst, and porting it literally works
ONLY because makemon happens to set a parallel .data field. Nothing enforces
that. A monster built by any other path would have mnum but no .data, and
every .data read would silently answer undefined. There are 35 such reads in
js/. Prefer game.mons[mnum] in NEW code for that reason -- but do not call
converting the existing ones a bug fix.

## A big regression may be a swallowed exception, not wrong behaviour

domove_swap_with_pet was ported three times. The first two cost 247 and 224
screens and were treated as logic faults: two bisects, four eliminations
(do_attack, is_safemon, the vision predicates, the positional preconditions),
and several confident STATUS entries about "which arm the swap takes".

It was throwing. The function sat at module scope and referenced a bare `u`,
which is a LOCAL inside domove and invisible from there, so every step onto a
pet raised "u is not defined". Wrapping the call in a try/catch and printing
the message found it on the first run. With every coordinate routed through
game.u the same code is worth +2 screens.

THE MISTAKE: "which arm does it take" presupposes the function ran. I never
checked that. A thrown exception inside a move handler can be caught upstream
and turned into a silently failed move, which looks exactly like bad logic
from the scoreboard.

THE CHECK, and it costs one run: wrap the new call in

    try { ... } catch (e) { process.stderr.write(`THREW ${e.message}\n`); }

before doing anything cleverer. Do it whenever a change costs more than a
handful of screens, because that magnitude usually means a whole code path
stopped working rather than one branch answering differently.

The negative result is worth having too. The same check on do_attack's call
site showed it does NOT throw, so its 30-screen cost is real behaviour, and
that is what established the attack check cannot land before the melee code
exists. Same one-line probe, opposite conclusion, both actionable.

Related trap in the same family: a bare `u` is idiomatic in the C, where it is
a global. Every ported function that lives at module scope must use game.u,
and one that happens to be nested inside domove will compile and work, which
is how this survived being written twice.

SWEPT, and the tree is clean. The check is

    grep -rn "[^.a-zA-Z_]u\.u[a-z]" js/*.js | grep -v "game\.u\|const u = "

Every hit is inside a function that opens with `const u = game.u`, so the
binding resolves. Worth re-running after adding any function that touches hero
coordinates, because the failure is silent: it throws only on the path that
uses it, which may be rare enough to look like a behavioural difference.

## undefined-refs.mjs cannot see unbound CONSTANTS. Execute the arm instead.

weapon_hit_bonus and skill_based_spellbook_id both switched on P_SKILLED,
P_MASTER and P_GRAND_MASTER without importing them. Either would have thrown a
ReferenceError the moment the hero reached Skilled in any weapon, or for a
Wizard in any spell school.

NOTHING IN THE TOOLCHAIN SAW IT:
  undefined-refs.mjs  scans CALL TARGETS; these are constants in a switch
  scoreboard          no public session reaches Skilled, so the path never ran
  generalize          same
  dup-defs            not a duplicate

It would have surfaced on a held-out session, as a crash, in code that reviews
as correct.

WHAT FOUND IT: forcing the input and running the function.

    const save = sk[t].skill;
    for (const [lvl, name, expected] of TABLE) {
        sk[t].skill = lvl;
        console.log(name, expected, weapon_hit_bonus(wep));
    }
    sk[t].skill = save;

The first forced level threw. The same loop then verified the whole table
against the C once the imports were fixed: restricted and unskilled -4, basic
0, skilled 2, expert 3.

USE THIS FOR EVERY ZERO-DRAW FUNCTION whose arms the sessions do not naturally
exercise. find_roll_to_hit's monster-state bonuses were verified the same way,
by setting mstun, mflee, msleeping and mcanmove on a live monster and
measuring the delta (+2, +2, +2, +4).

A BROAD STATIC SWEEP WAS TRIED AND ABANDONED. Grepping for every
SCREAMING_CASE identifier used but not bound per module produces far too many
false positives: destructured imports, namespace members like
OCLASSES.WEAPON_CLASS, and names appearing only in comments.

A NARROW ONE WORKS, and the tree is currently clean by it. Match only the
shape the bug actually had -- a bare constant used as a CASE LABEL:

    /case\s+([A-Z][A-Z0-9_]{2,})\s*:/

against a bound-name set that must recognise all four binding forms, or it
reports noise:
    import { A, B }             named imports
    const { A, B } = X          destructuring
    const A = 1, B = 2          comma-separated declaration lists
    function A / class A

Missing the third form alone produced four false positives in dungeon.js,
makemon.js, plselect.js and role.js. With all four handled the sweep reports
no unbound case-label constants anywhere in js/.

Executing the arm remains the stronger check, because it also catches a bound
constant with the WRONG VALUE, which no static pass can see. The sweep is the
cheap first pass; forcing the input is the one that proves the number.
## undefined-refs.mjs works; the failure was skipping it

RETRACTED CLAIM. An earlier version of this entry said the tool has a blind
spot for value references and stayed silent on `STRAT_WAITMASK` in
`setmangry` (js/mon.js). That is false and was never measured -- the tool was
run only AFTER the import was added, and the clean report was assumed for the
before state rather than observed.

Measured directly: delete the `STRAT_WAITMASK` import and
`node tools/undefined-refs.mjs` reports 19 instead of 18 and names
`STRAT_WAITMASK  (first use js/mon.js:0)`. The ALL_CAPS-used-bare pass at
tools/undefined-refs.mjs:132 exists precisely for this and does its job.
Aliased imports are handled too (line 76 keeps the local name after `as`).

**The actual lesson is about sequence, not tooling.** `setmangry` was ported,
then verified by forced input, and the cheap whole-tree check was skipped in
between. Forced input found the crash, so nothing was shipped broken, but the
30-second check would have found it first. Run `undefined-refs.mjs` right
after adding a function and before any deeper verification.

Standing caveat, unchanged: a clean report still cannot tell
correct-but-dormant from crashes-on-first-use for anything the report has no
opinion on, so forced input remains necessary for functions ported ahead of
their call sites. It is the second check, not the only one.

Currently 18 reported refs are false positives (property shorthand `cols`,
`grid`, `cursorRow` in js/game_display.js; keywords `async`,
`requestAnimationFrame`; and `ATR_UNDERLINE` in js/tty/wintty.js, which is
genuinely exported from js/terminal.js:28). Do not spend a session on them.

## The divergence point and the screen count can move in OPPOSITE directions

Measured on the combat gate (wiring domove_attackmon_at into domove), with
the melee chain at 44 functions and the wakeup chain fully live:

                        unwired    wired
  do_attack first-div   4 sessions   0        <- eliminated
  dog_move              7            8
  obj_resists           4            5
  screens               493          470      <- costs 23
  rng                   140,680      137,707  <- costs 2,973

Wiring is CORRECT by the divergence measure: four sessions stop failing at
do_attack and get further into the game before failing elsewhere. STATUS
records that the divergence point is the real measure, not the advisory RNG
count -- and by that measure this is a clear improvement.

It still costs 23 scored screens, because getting further into the game
reaches MORE unported code, and that code renders wrong frames. The
sessions advance and the score drops.

Do not resolve this by picking whichever number looks better. Both are real:
the chain is right, and the cost is downstream of it. The change stays out
until the downstream code (dog_move, obj_resists) exists, at which point the
same wiring should pay. Re-measure both numbers together whenever either of
those lands -- a wiring that costs 23 today may pay 100 tomorrow with no
change to the wiring itself.

Also measured: bringing the whole wakeup chain live (wake_msg, seemimic,
finish_meating, growl, setmangry, hot_pursuit all calling real functions
instead of recording) changed the wiring cost by EXACTLY ZERO -- still 23
screens and 2,973 rng. The cost is not about consequences of a blow. Do not
assume a chain going live moves a number; measure it.

## RNG match and screen match are close to INDEPENDENT; check both before choosing a target

Measured on the three sessions whose first RNG divergence is dog_move:

  session    RNG matched        screens matched
  seed0007   2948/16373  (18%)   19/302   (6%)
  seed0017   2793/3465   (81%)    0/67    (0%)
  seed0077   3209/3242   (99%)   18/33   (55%)

seed0017 reproduces 81% of the RNG stream and matches NOT ONE SCREEN. seed0077
reproduces 99% of the RNG and still misses 45% of screens. Screens are what is
scored; RNG is a proxy that can be almost right while the output is entirely
wrong.

For seed0007 specifically the screen divergence is around step 19 and the RNG
divergence at call 2832 is around step 48 -- THE SCREENS BREAK 29 STEPS BEFORE
THE RNG DOES. Several ticks went into the dog_move RNG divergence on the
assumption it was what cost this session its screens. It is not.

Before spending a session on a divergence, run the session and compare the two
numbers:

    node frozen/ps_test_runner.mjs sessions/<name>.session.json

A session with high RNG and low screens has a DISPLAY or message bug, not an
RNG bug, and tools/diverge.mjs will still happily name an RNG function for it.
diverge.mjs answers "where does the RNG first differ", which is not the same
question as "why does this session score badly".
