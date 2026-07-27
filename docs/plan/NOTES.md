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

## getobj's re-prompt loop can eat an entire session

Found while wiring drink_ok as getobj's object filter. Wiring a CORRECT filter
cost 212 screens and 45,893 RNG calls, which is far too much for a change that
only shortens a letter list.

Cause: js/invent.js getobj() ends in

    for (;;) {
        const ilet = await tty_yn_function(qbuf, null, '\0');
        ...
        const otmp = (game.invent || []).find(o => o.invlet === ilet);
        if (otmp) return otmp;
        /* C re-prompts on an unrecognised letter, which costs another key. */
    }

C does re-prompt, so the loop is faithful in shape. But when the offered set is
empty and the recorded keystroke names an item we do not have, the letter never
matches, the loop never exits, and it CONSUMES EVERY REMAINING KEY IN THE
SESSION. Instrumented: getobj_letters runs 154 times across seed2200 normally
and exactly ONCE with the filter wired -- the first call swallowed the rest of
the input.

The deeper problem it exposed, AND AN OPEN CONTRADICTION -- do not act on the
first reading of this without re-measuring:

At the traced first 'q' our game.invent held ONE object, oclass=2 otyp=79,
which is the quarterstaff, the FIRST entry of the Wizard table. But with the
filter absent the same session's prompt offers fourteen letters, and fourteen
is exactly right.

The table itself is CORRECT. js/uinit_data.js TROBJ.Wizard has nine entries
matching src/u_init.c:167 item for item: quarterstaff, cloak of magic
resistance, 1 wand, 2 rings, 3 POTIONS (trclass 8), 3 scrolls, force bolt,
1 more spellbook, magic marker. That sums to 14 objects with 3 potions, which
is C's [abcdefghijklmn] and [fgh] exactly. So the data is not the bug and
ini_inv is called.

Which leaves two possibilities, untested:
  - ini_inv creates only the first entry and the UNDEF_TYP entries (which need
    a random object of that class) silently fail, and the fourteen letters
    seen in the unfiltered run come from a later state than the traced call;
  - or the two runs reach getobj at different points and the traced call is
    genuinely earlier than step 4.

Resolve by printing game.invent.length at every getobj call in BOTH runs
before changing anything. The wrong lesson to draw here is "the starting
inventory table is wrong" -- it is verified correct.

Two consequences worth acting on separately:
  - Do not treat "wiring a correct predicate made the score worse" as evidence
    the predicate is wrong. Here the predicate was right and it uncovered two
    other faults.
  - An unbounded input-consuming loop should be suspected whenever an RNG
    delta is far larger than the change could plausibly explain. 45,893 calls
    for a letter-list change was the tell.

## js/optlist.js contains BOTH arms of every #ifdef: 25 duplicated option names

Found while checking whether iflags.menu_overlay is on. include/optlist.h has

    #ifdef TTY_GRAPHICS
        NHOPTB(menu_overlay, ..., set_in_game,  On,  ...)
    #else
        NHOPTB(menu_overlay, ..., set_in_config, Off, ...)
    #endif

and tools/gen-optlist.mjs emitted BOTH. js/optlist.js has 255 entries of which
25 NAMES APPEAR TWICE: windowtype, playmode, name, role, race, gender,
altkeyhandling, altmeta, BIOS, checkpoint, menu_overlay and others.

findOption() returns the FIRST match, so which arm wins is decided by
declaration order in the generated file rather than by the build
configuration.

SCOPE, MEASURED -- an earlier version of this entry said "for any of the other
24 the wrong arm may be first", which overstated it. Of the 25 duplicated
names, only THREE have arms whose initval differs at all; the other 22
duplicate harmlessly.

  checkpoint    On / Off, guarded by #ifdef INSURANCE.
                config.h:435 DOES define INSURANCE, so the On arm applies and
                it is emitted first. Correct.
  menu_overlay  On / Off, guarded by #ifdef TTY_GRAPHICS.
                A tty build defines it, so the On arm applies and is emitted
                first. Correct.
  sounds        On / Off, guarded by #ifdef SND_LIB_INTEGRATED.
                sndprocs.h:200 defines that ONLY when one of SND_LIB_MINIAUDIO,
                SND_LIB_FMOD, SND_LIB_SOUND_ESCCODES, SND_LIB_VISSOUND,
                SND_LIB_WINDSOUND or SND_LIB_MACSOUND is set. A default build
                sets none, so the #else arm applies and `sounds` should default
                to Off. WE EMIT THE On ARM FIRST, so our default is WRONG.

sounds controls sound effects and produces no screen output, so this is a
faithfulness defect rather than a scoring one -- but it is the one case where
the emission order picked the wrong arm, which is what makes the generator bug
real rather than theoretical.

The fix belongs in tools/gen-optlist.mjs: resolve the build flags at
generation time and emit one entry per option. Regenerate rather than
hand-editing js/optlist.js.

## level.objects insertion order: mkobj_at pushes where place_object unshifts

Found while tracing why dog_goal never sees a gold pile that C's pet goes for.

js/mkobj.js:1013 place_object() does `unshift`, and the comment above it is
explicit about why: "dog_goal()'s search walks it calling dogfood() on each,
and dogfood() draws, so the order is part of the PRNG contract."

js/makemon.js mkobj_at() inlines the placement and uses `push`. So an object
created through mkobj_at lands at the END of level.objects instead of the
front, and every consumer that walks the list in order sees a different
sequence than C.

C's mkobj_at (src/mkobj.c) is just

    otmp = mkobj(let, artif);
    place_object(otmp, x, y);
    return otmp;

so calling place_object is unambiguously the faithful form.

MEASURED: making that change costs 69 SCREENS and 9,053 rng (510 -> 441).
Reverted under the loop rule. That is a surprising result and worth
understanding rather than retrying blindly -- if C prepends and we start
prepending, matching should improve. Two readings:

  - place_object's unshift may itself be wrong for some other call path, and
    the push in mkobj_at was accidentally compensating for it. Check what
    else calls place_object and whether C's chain really is newest-first for
    those.
  - or the flat single list is too lossy a model. C has a PER-SQUARE chain
    (svl.level.objects[x][y] linked by ->nexthere). A flat list can reproduce
    per-square order only if every insertion preserves it globally, which
    prepend does not once two squares interleave.

RESOLVED WHICH READING HOLDS, and it is the FIRST one. The flat-list model is
sound: js/invent.js:186 and js/dog.js:1229 both record the reasoning, that
place_object() prepending to one flat list yields the same RELATIVE order per
square that C's ->nexthere chain does, so filtering by square recovers C's
order. That is correct -- two objects on the same square keep their relative
positions under a global prepend.

So mkobj_at's push IS a real bug and delegating to place_object IS the
faithful fix. It costing 69 screens therefore means OTHER insertions are also
mis-ordered and the push was accidentally compensating for them.

AUDITED, AND THE "COMPENSATING ERRORS ELSEWHERE" GUESS IS WRONG. There are
exactly TWO insertion sites in the whole tree:

    js/mkobj.js:1016   place_object()   unshift   correct
    js/makemon.js:797  mkobj_at()       push      wrong

and no others. So nothing else is mis-ordered.

WHAT IS ACTUALLY THERE IS A DUPLICATE DEFINITION -- the fourth of this
session:

    js/mkobj.js:998    export function mkobj_at()   calls place_object   CORRECT
    js/makemon.js:794  function mkobj_at()          inlines push         WRONG

js/mklev.js:28 imports the exported one, so its three call sites (1899, 2410,
2414) are fine. js/makemon.js:1419 uses its own private copy, in the
S_SPIDER/S_SNAKE arm of makemon(). That arm is the ONLY consumer of the buggy
version.

So the blast radius is spiders and snakes creating their web/egg objects, and
correcting just that one arm cost 69 screens. Since no other insertion is
wrong, the regression is NOT compensation -- it means the corrected order is
genuinely further from C for those sessions, which points at the CALL ORDER or
TIMING of that arm rather than the insertion primitive.

CHECKED THE ARM: IT IS FAITHFUL. src/makemon.c:1307 and js/makemon.js:1415
match exactly -- same in_mklev guard, same `x && y` test, same mkobj_at call,
same hideunder. And place_object differs from makemon.js's inlined version
ONLY in unshift vs push; there is no other behaviour in it.

So insertion ORDER is the single difference, and correcting it to match C
costs 69 screens. Every other explanation is now eliminated: the arm is
right, the primitive is right, there are no other insertion sites, and the
flat-list model is sound.

THAT MEANS A CONSUMER READS THE ORDER WRONG. The push order accidentally
satisfies it; the correct prepend order does not. The consumers that care are

    js/dog.js dog_goal's object loop   -- walks level.objects calling
                                          dogfood(), which DRAWS
    js/invent.js sobj_at              -- filters the flat list by square

CHECKED BOTH CONSUMERS, AND THIS HYPOTHESIS IS WRONG TOO. js/invent.js:193
sobj_at returns on the FIRST match; js/dog.js:1261 uses .find(), also first
match. Neither reverses, sorts, nor takes the last. First-match on a
prepend-ordered list is exactly right for C's chain head.

WHERE THAT LEAVES IT, stated plainly so nobody re-walks this:

  the S_SPIDER/S_SNAKE arm       matches src/makemon.c:1307 exactly
  place_object                   unshift, correct, no other behaviour
  insertion sites                exactly two, one correct one push
  the flat-list model            sound (prepend preserves per-square order)
  both consumers                 first-match, correct
  C's place_object               prepends to BOTH the per-square chain and
                                 the global fobj, so newest-first either way

Every component checks out, and making the one wrong insertion correct still
costs 69 screens and 9,053 rng. THAT REGRESSION IS UNEXPLAINED.

Do not spend another session assuming one of the above is subtly wrong -- they
have each been checked against the C directly. The likelier remaining shape is
that some OTHER divergence downstream is order-sensitive and currently
cancels against the push order. That is not findable by auditing this code
path; it needs the 69 lost screens identified session by session. Run the
change, diff the per-session scoreboard against the current one, and look at
which sessions lose and what they have in common.

## Before porting anything, grep for the BARE NAME -- five duplicates came from not doing it

Every one of these was written fresh and then discovered to already exist:

    dog_move, dog_hunger    js/dog.js -- re-ported into a new js/dogmove.js
    mkobj_at                js/mkobj.js exports it; js/makemon.js had a private
                            copy that PUSHED where place_object UNSHIFTS
    carried, OBJ_INVENT     js/obj.js:57,64
    done_eating             js/eat.js:261, already with C's ordering comment
    tty_clear_nhwindow_message   js/display.js, duplicated into wintty.js

THE FAILING CHECK IN THREE OF THEM WAS THE GREP PATTERN. `grep "function X"`
does not match `export const X = (a) => ...`, and a lot of this port's small
functions are const arrows. `ls js/<file>.js` is worse still -- dog_move lives
in js/dog.js, not js/dogmove.js, so the file being absent proved nothing.

USE:  grep -rn "\bNAME\b" js/ | head
NOT:  grep -rn "function NAME" js/
NOT:  ls js/<expected-file>.js

The cost is not just wasted work. Two of these shipped briefly as a SECOND
definition with different behaviour -- makemon's mkobj_at pushed to
level.objects where place_object prepends, and the wintty clear fired on a
different path than display.js's. A duplicate that merely wastes time is the
good case.

tools/dup-defs.mjs finds these AFTER the fact and is worth running, but it
only reports names defined in more than one FILE. A private copy shadowing an
imported one inside the same file does not show up.

## The rng match count is downstream-contaminated; only the divergence POINT is clean

This is recorded elsewhere in STATUS and I still spent three ticks ignoring it,
so here is the concrete case.

Wiring dodrop to the 'd' command appeared to cost 2 rng matches, so I did not
wire it. Porting welded and canletgo appeared to narrow the cost from 10 to 2,
which looked like convergence. A per-session diff then showed +27 gained and
-29 lost across eleven sessions, which looked like two competing bugs.

ALL OF IT WAS NOISE. Comparing the FIRST DIVERGENCE CALL for every one of the
43 diverging sessions, with and without the wiring, gave an IDENTICAL result
for all 43. Not one moved. Every one of those +/- numbers was accumulated
after the stream had already parted, where the count means nothing.

WHY THE AGGREGATE MISLEADS: once a session diverges at call N, everything
after N is two different games. Their draw counts drift apart for reasons
unrelated to the change under test, and the drift is large -- nine calls in
one session here, from a change that provably altered nothing.

THE CHECK, and it is one loop:

    for f in sessions/*.session.json; do
        echo -n "$(basename $f) "
        node tools/diverge.mjs "$f" 2>/dev/null | grep -m1 MISMATCH | awk '{print $1}'
    done > before.txt
    # apply change
    # ...same loop into after.txt
    diff before.txt after.txt

An empty diff means the change is behaviourally inert on the public corpus.
That is not a reason to reject a FAITHFUL change -- C wires dodrop, so we
wire dodrop -- it just means the rng figure cannot be used to judge it.

Use the rng count as a DETECTOR (something moved, look closer) and never as a
VERDICT.


## Sizing greps produce FALSE POSITIVES, and that direction is the dangerous one

Sizing the mattackm chain, `grep -rln "\bnoises\b" js/*.js` reported
`js/quest_data.js`, so noises looked ported. It is not. The hit was quest text:

    "text": "You stand before the entrance to %i.  Strange\nscratching
             noises come from within the building. ..."

A bare-name grep matches inside string literals, comments and generated data
tables. That is the OPPOSITE of the duplicate-port bug and it is worse:

  - the DUPLICATE bug (`grep "function X"` missing `export const X =`) made me
    port something twice. Wasteful, caught by dup-defs.mjs, harmless to the
    score.
  - the FALSE-POSITIVE bug makes me SKIP something, believing it is ported.
    Nothing catches that. The call site throws at runtime, or worse, the name
    resolves to an unrelated import and the function silently does the wrong
    thing.

So the standing "grep the bare name" rule needs its other half. Grep the bare
name to find duplicates, but confirm a POSITIVE by looking at the line: it must
be a definition (`function X`, `const X =`, `export ... X`), not a mention. The
one-liner that does both:

    grep -rn "^\(export \)\?\(async \)\?\(function\|const\|let\) X\b" js/

and exclude `*_data.js`, which is generated and restates names it does not
define.

Two hits in this chain were real and worth knowing: s_suffix is in
js/hacklib.js where it belongs, and mon_hates_silver is in js/dog.js, which is
architectural drift (it is src/mondata.c:517) but a genuine definition. Do not
re-port either.

A THIRD time, and this one cost the most. Wiring movemon_singlemon's hider
and eel arms measured -42 screens and -5217 RNG, and I recorded the arms as
unported on the strength of that number. It was wrong. The arms are fine. A
guard reading

    if not re.search(r"\bM_AP_FURNITURE\b", s): add_the_import()

found the name -- in the code I had just written -- and skipped the import, so
M_AP_FURNITURE was unbound, seed0361 and seed0367 threw, and 24+18 screens
vanished. With the import present the same arms cost nothing.

TWO RULES FROM THIS, both cheap:

1. A SESSION THAT DROPS TO EXACTLY 0 SCREENS IS A CRASH, NOT A DIVERGENCE.
   A behavioural difference degrades a score; it does not zero it. Check
   `"error"` in the runner's JSON before theorising about behaviour. I spent
   a full round inventing hypotheses about mundetected being set too liberally
   when one grep for the error string would have ended it. The per-session
   diff already showed 24 -> 0 and 18 -> 0, and that shape was the tell.

2. NEVER GUARD AN IMPORT INSERTION BY SEARCHING THE FILE FOR THE NAME. The
   code being inserted contains the name. Audit instead: list every identifier
   the new code uses, test each against an actual `^import {...}` line, add
   exactly what is missing. On this edit the guard found nothing to do and the
   audit found four (M_AP_FURNITURE, M_AP_OBJECT, ROOM, is_pit).

The deeper point is about the recorded gap itself. `game.unported` entries are
supposed to be honest statements that a path is not ported. This one was a
lie produced by a measurement artifact, and it would have sat there telling
future readers a working subsystem was missing. Verify a regression is real
BEFORE recording a gap on the strength of it.

`game.unported` DRIFTS IN BOTH DIRECTIONS, and both were seen the same day:

  - recording work that IS done. freeinv_core's LOADSTONE arm recorded
    'curse_loadstone' while curse() had been sitting in js/mkobj.js the whole
    time. Nothing rechecks a gap once written.
  - recording work that was NEVER THERE. The same function's COIN_CLASS arm
    recorded 'freeinv_core:money2mon'. In 5.0 that arm is two statements,
    `disp.botl = TRUE; return;`, and money2mon appears nowhere in invent.c.
    Almost certainly a 3.4/3.6 memory written into a 5.0 port -- exactly the
    failure CLAUDE.md rule 3a warns about, surviving as a comment instead of
    as code.

So a gap entry is a claim about the C, and it decays like any other. When
touching a function, re-read the C arm the record refers to before trusting
it. Both of these cost nothing to fix once looked at, and both had been
quietly wrong for a while.

It bit a second time within the hour, from the other direction. A script that
was supposed to add a `pronoun_gender` import to js/do_name.js guarded itself
with "skip if pronoun_gender already appears above the function". It did
appear -- in the DOC COMMENT I had just written, which says "the
pronoun_gender() call passes PRONOUN_HALLU". The guard read its own
documentation as evidence the import existed, skipped silently, and the file
still loaded clean because the reference was inside a function body that
nothing had called yet.

That is the whole failure mode in one line: a name in a comment is not a
binding, and `import`-ing is not the same as mentioning. Both times the fix is
the same -- match a DEFINITION or an IMPORT, never a bare occurrence -- and
both times the thing that actually caught it was executing the function, not
loading the module.


## A partially wired loop can be WORSE than the honest gap it replaces

Wiring lookaround() into moveloop's run branch measured -7 screens and was
reverted. The port was faithful line for line; what was missing was a
terminator, and that turns a bounded error into an unbounded one.

The recorded gap took ONE step where C takes several. Wrong, but wrong by a
known small amount, and the same amount every time. The wired loop had no way
to stop -- lookaround does not halt a rush in an open room, and C relies on
domove_core's own nomul(0) calls for that -- so the hero ran until something
incidental stopped him. Distance error unbounded instead of one square.

The measurement said so plainly, and it is worth reading the shape of it:

    RNG   +40   the loop really does produce more correct draws
    screens -7  and still puts the hero on the wrong square

That combination is the signature of this failure. More correct draws with
fewer correct screens means the mechanism is right and the STOPPING CONDITION
is wrong, because RNG accumulates per action while the screen only cares where
things ended up.

The general rule: before wiring a loop, find every exit C has, not just the
one the loop is named after. lookaround is the INTERESTING exit and it is the
one the docs and the function name point at; the ordinary exit is a dozen
scattered nomul(0) calls inside the thing being looped. Grep for the
terminator, not the body. `grep -c "nomul(0)" src/hack.c` against the port's
count would have predicted this in one command and before any code was
written.

Corollary for `game.unported`: a recorded gap is a real engineering position,
not a placeholder to clear as fast as possible. Replacing one with a partial
port is only progress if the partial port's error is SMALLER, and that has to
be measured rather than assumed.

## note_unported() must never stand in for a BOOLEAN

The worst of the fifteen false records was not a missing call. mpickstuff had:

    if (otmp.otyp === CORPSE && mdat.mlet !== S_NYMPH
        && !note_unported_mon('mpickstuff:touch_petrifies')
        && otmp.corpsenm !== PM_LIZARD
        && !note_unported_mon('mpickstuff:acidic'))
        continue;

note_unported returns false, so `!note_unported(...)` is always TRUE, and the
chain read as "this corpse never petrifies and is never acidic". Monsters
picked up cockatrice corpses. Both predicates had been ported in js/dog.js the
whole time.

A recorded gap is honest when it REPLACES an action. It is a lie when it
substitutes for a VALUE, because it silently commits to one branch. The same
applies to the `if (note_unported(...)) return;` shape -- fine, since it always
takes the same path and says so -- versus using the return value as data.

Related, from the same sweep: mpickstuff called obj_extract_self() to take an
object off the floor and then RECORDED where mpickobj() belonged, so the object
left the floor and entered nobody's inventory. It vanished. Recording where a
call belongs is only honest if the surrounding operation is skipped too; a
record dropped into the middle of a half-finished sequence is a bug.

## Prepending an import block is not safe in a large file

Twice in one session the fix `s = "import {...}\n" + s` produced
"Identifier X has already been declared" and took the whole suite to 0/0,
because the file already imported that name on another line (mon.js had
touch_petrifies; uhitm.js had a local wepbefore). Merge into the EXISTING
import line for that module instead, and remember that a duplicate `const` in
the target function is just as fatal as a duplicate import.

Both times the 0/0 signature identified it in one grep. That rule -- a session
at exactly 0 screens is a crash, not a divergence -- has now paid for itself
three times in a day.

## js/do.js cannot be imported from a NEW module (mklev_fn temporal dead zone)

Porting ship_object() into a new js/dokick.js and calling it from dropx()
failed with `Cannot access 'mklev_fn' before initialization` and took the suite
from 510 to 0. That is do.js's OWN module-scope variable, which means do.js was
being re-entered while still initialising.

do.js does module-init-time wiring:

    do_wire_mklev(mklev);   // js/cmd.js does this at import time

so anything that pulls do.js back in before that line runs sees a dead zone
rather than a clean circular-import error. Three attempts to route around it
all failed:

  - dokick.js -> do.js for stairway_at. Moved stairway_at to a new js/stairs.js
    (its real src/stairs.c home). Still cycled.
  - dokick.js -> mon.js for t_at. Moved t_at to js/trap.js (its real
    src/trap.c home). Still cycled -- and the move alone broke do.js even with
    the dokick import removed, so the chain runs through mondata/display, not
    through the obvious edge.
  - removing the dokick import from do.js while keeping the moves. Still broke.

Reverted the whole batch. WHAT TO DO INSTEAD when this comes up again: do not
try to find a clean import path into do.js -- use the wiring pattern do.js
already established for exactly this reason (do_wire_mklev / sp_lev_wire_mon /
mklev_wire_mon in js/cmd.js:31-33). cmd.js imports everything and does the
wiring after all modules have initialised. A new module that do.js must call
should be wired the same way, from cmd.js, not imported directly.

The architectural moves themselves were correct (stairway_at belongs in
stairs.js, t_at in trap.js) and are worth redoing as a SEPARATE change,
measured on their own, once the wiring question is settled.

RESOLVED, and with a correction to the above. The fix is the wiring pattern
do.js already uses: js/cmd.js imports both sides and calls a `*_wire()` setter
after every module has initialised, exactly as it does for do_wire_mklev,
sp_lev_wire_mon and mklev_wire_mon. js/dokick.js now takes stairway_at and
t_at that way and ship_object is wired into dropx with no regression. When a
port keeps three near-identical wiring helpers around, that repetition is
telling you something structural about the module rather than being cruft.

THE CORRECTION: `node -e "import('./js/do.js')"` FAILS ON A CLEAN TREE. It has
always failed. do.js is not standalone-importable by design -- it is loaded
through cmd.js, which does the wiring -- so that command is NOT a health check
and a failure from it means nothing. I used it as one and briefly concluded a
reverted change was still broken. Use `node tools/scoreboard.mjs` instead;
that is the entry point the runner actually uses, and it was reading a correct
510 the whole time.

## Forced execution proves nothing if you build the fixture from your own reading

Six functions of the mattackm chain were written reading `mattk.aatyp` and
`mattk.adtyp` as object fields. js/monst_data.js stores each attack as a
4-ELEMENT ARRAY -- `[2,0,1,2]` is [aatyp, adtyp, damn, damd] -- so every one
of those reads was `undefined`. The whole chain would have done nothing on
first contact with a real monster.

Every one of those functions had been "verified by forced execution". The
tests passed because they did this:

    const bite = { aatyp: ATTKS.AT_BITE, adtyp: ATTKS.AD_PHYS, damn:1, damd:4 };

a fixture built from the same misreading as the code. The test and the code
agreed with each other and neither agreed with the game. Draw counts, damage
numbers and return values were all "correct" and all meaningless.

THE RULE: a forced-execution test must take its inputs from the REAL data
structures -- mons[], objects[], game.level -- not from an object literal
written while looking at the C. The moment a test needs a hand-built stand-in
for something the game already has, that is the thing to be suspicious of.

    t('getmattk from REAL table', () => getmattk(mk(PMNAMES.PM_JACKAL), ...))

caught it on the first run.

This does not retire forced execution -- it caught the missing
pronoun_gender import, the STRAT_WAITMASK arms and the two-draws-before-
early-return behaviour of mhitm_knockback, none of which a module load would
have shown. It narrows the claim: forced execution proves the code RUNS, and
proves its behaviour only to the extent the inputs are real.

Named constants were added (MATTK_AATYP/ADTYP/DAMN/DAMD in js/const.js) so
the next misread is a visible error rather than a silent undefined. Prefer
that to raw indices anywhere the C uses a struct field.

## A "regression" with a NEW zero-screen session is a crash you just exposed

Wiring corpse_chance into mondied first measured -28 screens with the
zero-screen count rising 5 -> 6. Reverting on that number would have thrown
away a correct change AND left a latent bug in place.

The crashed session reported `CORPSTAT_NONE is not defined`, and the name is
referenced at js/mklev.js:324 with no import -- it had been a latent
ReferenceError for some time, firing only on levels that reach that line.
Making corpse_chance real changed which levels reach it. Importing the name
turned -28 into +6, a new session high of 511.

SO: when a change measures badly AND the zero-screen count rises, the crash is
usually NOT in the code you just wrote. Read the error before attributing the
delta to your own behaviour change. Twice today the crash was in code that had
been quietly broken all along and only became reachable.

Checking whether the port has live crashes is cheap and worth doing after any
sizeable change:

    for s in $(node tools/scoreboard.mjs | grep -E "screens *0/" | awk '{print $2}'); do
        node frozen/ps_test_runner.mjs --worker-session=sessions/$s.session.json |
            grep -oE '"error":"[^"]*"|"error":null'
    done

All five current zero-screen sessions report error:null -- they diverge too
early to match a screen, which is a different thing from crashing.

## Record where the WORK is, not where the BRANCH is

Six gap records were found firing on paths where C does nothing at all. All
six were written by me, in code I had just ported, and every one inflated its
reach to "every time this function runs":

    freeinv_core:uhave_artifacts   27%  C's arms are five specific artifacts;
                                        an ordinary object matches none
    dropz:flooreffects             27%  returns FALSE on dry floor with no trap
    drop:levitation_and_message    27%  needs !can_reach_floor or a ring on a sink
    done_eating:fpostfx            39%  only seven foods have an arm
    passivemm:always / :alive      41%  the switches have arms for 2 and 5
                                        damage types; AD_PHYS hits default
    can_touch_safely:touch_artifact 66% the callee was already ported

Combined with the fifteen stale entries the audit found, TWENTY of the ledger's
records were wrong, and the top of unported-hits read 100/66/43/39 percent with
three of four fictional.

THE RULE: put the record INSIDE the arm that would do the work, never at the
dispatch point above it. A switch with 39 cases and 3 implemented does not
have one 39-case gap; it has 36 gaps, most of which no session reaches.

THE TEST: after adding a record, ask "what fraction of calls does C do nothing
on?" If the answer is "most", the record is in the wrong place. Cheap check --
port the function, then look at whether the entry appears in unported-hits at
all. Four of the six above vanished from the list completely, meaning no
public session ever reaches them.

WHY IT MATTERS beyond tidiness: unported-hits ranks by reach and is the thing
used to choose what to port next. A record at a dispatch point does not just
overstate one number, it outranks genuinely reachable work and sends the next
session at the wrong target. mattackm was deferred three times on exactly that
kind of inflated reading.

## I duplicated mkcorpstat, and could not consolidate it (mklev.js cycle)

Porting make_corpse I added mkcorpstat to js/mkobj.js. One already existed,
private, in js/mklev.js. I found it only afterwards, in dup-defs -- because I
had grepped

    ^export function mkcorpstat

which cannot see `function mkcorpstat`. That is the exact mistake this file
already warns about under "grep the bare name", made again.

WORSE, THE TWO DIFFER. mklev.js's takes pm as a MONSTER INDEX and starts the
rot timer for special corpses; mine takes a permonst pointer as C does and
does not. Both are reachable.

CONSOLIDATION FAILED. Deleting mine and importing mklev.js's into js/mon.js
threw `Cannot access 'mklev_mon' before initialization` and took all 44
sessions to zero. mklev.js does module-init-time wiring (mklev_wire_mon)
exactly as js/do.js does, so it has the same property: A NEW IMPORTER OF
mklev.js CAN RE-ENTER IT DURING ITS OWN INITIALISATION.

So js/do.js is not special. Treat BOTH do.js and mklev.js as wire-only
modules: js/cmd.js imports them and calls their `*_wire()` setters after
everything has initialised. Anything else that needs one of their functions
should be wired the same way, not imported.

Left as-is: two mkcorpstat implementations, the mklev one used by level
generation and the mkobj one used by make_corpse.

SECOND ATTEMPT ALSO FAILED, and it rules out the obvious fix. I tried the
cmd.js wiring pattern that worked for js/dokick.js -- a `let fn = null` plus a
`mon_wire_mkcorpstat()` setter in js/mon.js, wired from cmd.js. Result:
`Cannot access 'mkcorpstat_fn' before initialization`, all 44 sessions to
zero.

So js/mon.js is ALSO re-entered during its own initialisation, which means
the wire-setter trick does not work when the module holding the setter is
itself in a cycle. dokick.js worked because it is a NEW leaf module that
nothing imports back.

THE RULE THAT ACTUALLY HOLDS: the wire pattern fixes a NEW module that needs
something from an old one. It does not fix two OLD modules that already
import each other. For those, the function has to move to a module outside
the cycle, or the duplicate stays.

Three modules are now known to be re-entrant during init: js/do.js,
js/mklev.js, js/mon.js. Assume any long-established module is until shown
otherwise, and prefer adding a new leaf module over threading a call into an
old one.

## game.uwep is never written, and "fixing" that HANGS seed0361

js/u_init.js:558 is the only place a wielded weapon is stored, and it writes
`game.u.uwep`. But eleven places READ `game.uwep`, which is therefore always
undefined. The most alarming is js/uhitm.js:780:

    unarmed: !game.uwep && !game.uarm && !game.uarms,

so the hero reads as bare-handed in every melee calculation. do.js's three
"are you wielding this?" checks never fire either.

I pointed all eleven at game.u.uwep. Twelve replacements, three files. Result:
seed0361 stopped terminating -- it ran past the 120s worker timeout and
vanished from the scoreboard entirely (total steps fell 11405 -> 11039, which
is exactly seed0361's 366). Reverted.

SO SOMETHING LOOPS ON uwep BEING FALSY. Almost certainly a wield/unwield or
weapon-selection loop whose exit condition is "no weapon", satisfied only by
the undefined read. That is a second bug sitting behind the first, and fixing
the storage without finding it produces a hang rather than a wrong answer.

BISECTED. Two of the three files are fine and are now committed:
  js/uhitm.js  the unarmed flag        -- no hang, committed
  js/do.js     drop's wielding checks  -- no hang, committed
  js/wield.js  THE HANG IS HERE, all three reads still on game.uwep

Narrowed further: js/wield.js:133 is welded()'s own test,

    if (obj && obj === game.uwep && will_weld(obj))

and game.uwep being undefined is what makes welded() ALWAYS RETURN 0. Point
it at game.u.uwep and welded goes live, which makes canletgo() (js/do.js:397)
refuse to release a cursed wielded weapon -- correct C behaviour -- and
something upstream retries forever instead of giving up.

SO THE REMAINING BUG IS A MISSING GIVE-UP, not the storage. Find the caller
that loops while canletgo() keeps saying no; C's equivalent stops after the
message. Fix that, then wield.js's three reads can be pointed at
game.u.uwep like the other two files.

Note also uarm, uarms, uarmf, uquiver and uswapwep have the same split
(game.X vs game.u.X). uarmf and uarm are only ever read as game.X and never
written at all, so they are undefined too. The whole worn-equipment storage
needs unifying, and that is the same structural work setworn needs -- do them
together, not piecemeal.

## A pline() that forces --More-- HANGS the runner when the key queue is empty

Final bisect of the uwep work. The hang was not welded() going live and not
canletgo -- canletgo has exactly one caller (js/do.js:312) and it returns
immediately. It was MY OWN dowield code:

    if (wep === game.u.uwep) {
        await You('are already wielding that!');
        return ECMD_FAIL;
    }

With game.uwep (undefined) that branch never fired. With the real
game.u.uwep it fires when a session re-wields the same weapon, and the
message forces a --More-- because a message is already on the top line.
--More-- BLOCKS for a keystroke, and at that point the session's recorded
keys are exhausted, so it blocks forever. seed0361 ran past every timeout
I gave it.

MECHANISM, traced to the line. js/input.js:20 nhgetch() throws on an empty
queue -- but only if nothing else claims the key first:

    if (_inputQueue.length > 0) return _inputQueue.shift();
    const display = game?.nhDisplay;
    if (display?.readKey) return await display.readKey(...);   <-- BLOCKS HERE
    throw new Error('Input queue empty ...');

frozen/playability_runner.mjs:108 sets game.nhDisplay to a js/terminal.js
terminal, and that class HAS readKey (terminal.js:279). So the throw is
unreachable under the runner and an exhausted queue waits forever.

AND THAT MAKES A HANG A DIVERGENCE SIGNAL, NOT MERELY AN ANNOYANCE. A
session's key list is exactly what C consumed. If our port is still asking
for a key after the list is exhausted, WE ASKED FOR A KEY C DID NOT ASK FOR.
In the wield case that is precisely what happened: C printed 'You are already
wielding that!' with no --More--, so it consumed no key there, and we forced
one. The top line must have been clear in C at that moment and stale in ours.

So the wield hang is not a reason to leave uwep broken -- it is evidence of a
SECOND bug, in top-line state, that the uwep fix merely exposed. Fixing the
top line is the prerequisite, and it is in js/display.js (pline/more), not in
the frozen terminal.

CHECKED THE OBVIOUS CAUSE AND IT IS NOT IT. js/invent.js never clears the
message window and src/invent.c has exactly one clear_nhwindow(WIN_MESSAGE),
at :3930 -- but that is inside dotypeinv() (the 'I' command), not getobj().
So C does NOT clear the prompt after reading the object letter either, and
'our getobj leaves its prompt behind' is a WRONG explanation. js/cmd.js:548
already clears once per command, matching C.

WHAT THE ARITHMETIC SAYS, and this is the next thing to check. update_topl's
joining branch needs

    n0 + toplines.length + 3 < CO - 8      i.e. < 72

The wield prompt 'What do you want to wield? [- ab or ?*]' is about 40 and
'You are already wielding that!' is 30, so 40 + 30 + 3 = 73, just over the
72 threshold, and the join is declined by ONE COLUMN. That is close enough
that a small error in the prompt text -- an extra space, the wrong inventory
letters, a missing 'or ?*' -- flips join into --More-- and produces exactly
the observed hang. MEASURED, and it lands EXACTLY on the boundary. js/invent.js:154 builds

    'What do you want to wield?'          26
    ' [' + lets + ' or ?*]'  with lets='- ab'   13
                                          --
                                          39

and 'You are already wielding that!' is 30, so 39 + 30 + 3 = 72 against a
test of < 72. The join is declined by ONE column, precisely as suspected.

BUT THAT IS NOT THE BUG, AND THE MEASUREMENT IS WHAT SHOWED IT. Both the
join branch and the more() call are gated on _toplin === TOPLINE_NEED_MORE,
and js/tty/topl.c:141 tty_yn_function sets _toplin = TOPLINE_SPECIAL_PROMPT
before returning. With SPECIAL_PROMPT the joining branch is skipped AND the
more() is skipped, so the arithmetic never runs and NOTHING SHOULD BLOCK.

TRACED EVERY WRITE TO _toplin, AND THE --More-- THEORY IS DEAD. The only
write that produces NEED_MORE on this path is redotoplin (js/tty/topl.js:120),
and it runs at the END of update_topl, after both the join branch and the
more() call have already been skipped. display.js:611 looks like a candidate
but forces NEED_MORE only to make the erase happen and lands on EMPTY two
lines later. So walking the wield message through update_topl with _toplin at
SPECIAL_PROMPT:

    join branch      requires NEED_MORE   -> skipped
    await more()     requires NEED_MORE   -> skipped
    else if (cury)   cury is 0            -> skipped
    redotoplin                            -> sets NEED_MORE, no blocking

NOTHING BLOCKS. A single message cannot hang, so the --More-- explanation was
wrong even though the arithmetic sat one column from supporting it.

LEADING HYPOTHESIS, NOT YET VERIFIED: js/invent.js:158 getobj wraps its prompt
in for (;;) and re-prompts on an answer it does not accept. If the real uwep
makes our getobj reject a letter C accepted, it re-prompts, eats the next key,
rejects again, and walks the queue to exhaustion -- then readKey blocks. That
fits every symptom (unbounded, key-consuming, only with the real uwep) and it
is in code we own. VERIFIED, AND WRONG -- the third theory in a row to die. Instrumented
getobj's for(;;) with a counter printing every 25 iterations and ran
seed0361 with the uwep fix applied. NO loop output at all, and the session
COMPLETED. getobj does not spin.

AND THE BISECT IS NOW INCONSISTENT, which matters more than the dead theory:

    wield.js:177 + :183 together   HUNG      (original observation)
    wield.js:177 alone             COMPLETED
    wield.js:183 alone             HUNG      (70s, no output)

But :183 is 'if (welded(game.u.uwep))', and welded() itself still tests
'obj === game.uwep' against the undefined global, so the && short-circuits
and the branch is NOT taken -- behaviour should be IDENTICAL to before the
edit. An edit that changes no behaviour cannot change whether the run hangs.

RESOLVED, AND IT WAS (c). THERE IS NO `timeout` ON THIS MACHINE.

    $ command -v timeout gtimeout
    NEITHER PRESENT
    $ timeout 70 node frozen/ps_test_runner.mjs ... ; echo $?
    127

Every `timeout N node ...` this session died instantly with 127 having run
NOTHING, produced no output, and my greps then found nothing -- which I read
as 'hung' or 'the loop never fired'. macOS ships no timeout; it is GNU
coreutils, and gtimeout is not installed either.

WHAT THIS INVALIDATES (all three were mine, all three were wrong for the
same reason):
  'getobj does not spin'    the instrumented run NEVER EXECUTED
  'wield.js:177 completed'  never executed
  'wield.js:183 hung'       never executed

WHAT SURVIVES, because these had no timeout prefix:
  uhitm unarmed fix alone   ran, 3052 rng / 24 screens, no hang
  do.js drop fixes          ran, 3052, no hang
  wield.js all three reads  hung for real -- the Bash TOOL's own 180s
                            timeout fired, which is a different mechanism
                            and does work

REDONE WITH A WORKING METHOD, and the answer flips back. Using the Bash
tool's own timeout (harness-enforced, not a shell binary):

    wield.js:177 alone   HANGS   (150s, no completion, run really executed)

So 'if (wep === game.u.uwep)' -- the 'You are already wielding that!' branch
-- IS a culprit, which is what the very first hypothesis said before three
non-runs muddied it. The branch fires, prints, returns ECMD_FAIL.

That leaves the mechanism still open, but now on solid ground: a message plus
ECMD_FAIL hangs, and the update_topl trace says a single message cannot block
on --More--. The remaining suspect is therefore ECMD_FAIL itself -- what the
command loop does when a command consumes no time. If js/cmd.js re-reads
without having consumed the key, or moveloop spins waiting for context.move,
that would exhaust the queue exactly the way observed. CHECKED THE ECMD_FAIL PATH. It is faithful: js/cmd.js:582 sets
context.move = (dowield() === ECMD_TIME ? 1 : 0), so a failed command
records no time, which is what C does.

THE USEFUL RESULT IS AN INVARIANT, not a bug. js/allmain.js:591 is

    for (;;) { await moveloop_core(); if (gameover) break; }

and moveloop_core ends at :569 with exactly one `await rhack(0)`, which
reads exactly one key. SO ONE moveloop_core ITERATION CONSUMES EXACTLY ONE
KEY, and the count of iterations is the count of keys.

That turns 'it hangs' into a number. A session supplies exactly the keys C
consumed, so hanging means our iteration count EXCEEDS C's. The question is
no longer 'what blocks' but 'which command took two iterations where C took
one'. Instrument by counting moveloop_core entries and comparing against the
session's key count -- the difference localises the extra read directly,
without any bisecting.

DID IT, AND THE INVARIANT ABOVE IS WRONG. Counted for real:

    seed0361 supplies                365 keys (segment.moves, 366 steps)
    baseline moveloop_core reaches   200+ iterations, completes normally
    WITH the wield fix               STALLS AT 50, never climbs again
    node CPU while stalled           0.0%

TWO CORRECTIONS FALL OUT.

1. 'One moveloop_core iteration consumes exactly one key' IS FALSE. rhack
   reads one key, but commands read MORE keys inside themselves -- getobj,
   yn prompts, menus, --More-- all call nhgetch independently. So iterations
   and keys are not the same quantity and the count cannot be compared to 365
   the way I wrote above.

2. It is NOT an unbounded loop. 0.0% CPU means the process is BLOCKED ON
   I/O, not spinning. Stalling at iteration 50 while 365 keys existed means
   roughly 50 commands drained the whole queue -- about seven keys per
   command, far more than C reads.

SO SOMETHING READS KEYS IN A LOOP INSIDE ONE COMMAND, which is the getobj
respin theory. That theory was recorded as disproved, but its disproof was
one of the runs killed by the missing `timeout` binary and NEVER EXECUTED.
It is live again and is now the best-supported explanation, not the worst.

RE-RAN IT PROPERLY, AND getobj IS CLEARED. With a run that actually
executed, the counter printed NOTHING -- getobj does not respin. The theory
is dead for real this time, not by a phantom run.

THEN INSTRUMENTED nhgetch ITSELF, which found something structural:

    QUEUE EMPTY after 1 reads
    KEY 25 left=0 ... KEY 175 left=0     then blocks, process still alive

js/input.js's _inputQueue IS NEVER POPULATED. Every key in a runner session
comes from display.readKey() -- the js/terminal.js path -- and _inputQueue
stays empty from the very first read. So the 'exhausted key queue' framing in
the entries above is wrong twice over: there is no queue to exhaust, and the
throw at js/input.js:35 is unreachable for that reason too, not only because
readKey is checked first.

WHERE IT ACTUALLY STOPS: with the wield fix applied, key reads climb normally
to roughly 180 and then stop, with the process alive and idle. seed0361
supplies 365 keys, so we block around HALF WAY through the session, not at
the end. That kills the last surviving piece of the original story -- this was
never about running off the end of the input.

BASELINE MEASURED: 350 key reads, exits cleanly, 3052 rng. With the wield
fix: blocks at ~180. SO THE FIX CONSUMES FEWER KEYS, NOT MORE. Every
'something reads too many keys' theory in this section is now excluded by
measurement rather than argument.

WHAT THAT LEAVES, and it is a much better place to be. At key ~180 the port
asks the terminal for a key and does not get one. The runner supplies keys
against the recorded step sequence, so a request that goes unanswered means
WE ASKED AT A MOMENT THE RECORDING DOES NOT HAVE A KEY FOR -- an ordinary
divergence, roughly halfway through the session, that happens to manifest as
a block instead of a wrong cell.

TRIED THE NORMAL TOOL AND IT CANNOT HELP HERE. Applied the wield fix and ran
tools/diverge.mjs against seed0361: it produced ZERO BYTES of output in 105
seconds and had to be killed. diverge replays the session to completion before
it can compare anything, so a session that blocks takes diverge down with it.
The tool is useless for exactly the failure mode that most needs it.

ADDED THE BOUND, AND IT IS NOT YET PROVEN TO FIRE. tools/diverge.mjs now
takes --max-seconds N: it races the replay against a timer, and on timeout
reads the gstate singleton (the same object the port mutates during the run)
to report the last move and the rng-call count, then process.exit(3). The
exit is deliberate -- the blocked readKey keeps a pending promise alive, so
returning normally leaves node running and the bound looks like it never
fired.

BUT TWO TEST RUNS AT --max-seconds 40 AND 45 BOTH RAN PAST 150s WITH NO
OUTPUT, so the bound did not visibly work. Syntax checks clean and maxMs,
deadline and the Promise.race are all in scope (:138, :140, :164). The
likeliest explanation is that diverge never reaches runOurPort at all:
loadCanonical(segments) runs FIRST at :301, and if that is what is slow on
this session then no timeout inside runOurPort can help. Note the pre-change
run also produced zero bytes in 105s, which fits 'slow before the replay'
just as well as it fits 'hangs in the replay'.

TIMED IT, AND THE loadCanonical THEORY IS WRONG TOO. On the clean tree
diverge runs the WHOLE session in 0.33 s and prints a normal report, so
nothing before the replay is slow. It also gives a real answer, which is
worth more than this whole investigation:

    RNG diverges at call 2983
      C rn2(100)=56   ours rn2(8)=0   @ obj_resists(zap.c:1469)
      seg 1, step 41 (key "c")
    Next C function to port: dosearch0 (src/detect.c:2079)

THE BOUND STILL DOES NOT FIRE, and I do not know why. Fixed one real defect
along the way -- diverge has TWO argv parsers and the flag has to be in the
one inside main() -- but with it correctly parsed a --max-seconds 30 run
still went past 120 s. Promise.race with a setTimeout should win against a
promise that never settles, so the working assumption 'the port blocks on
I/O and timers still fire' must be false somewhere. Possibly the port blocks
in a way that starves the timer, despite the 0 % CPU reading.

LEAVE THE FLAG IN BUT DO NOT TRUST IT. It is documented as unproven at its
definition. Anyone picking this up should first check whether a bare
setTimeout even fires inside a diverge run with the wield fix applied; that
is a five-line test and it decides whether the approach is salvageable or
the bound has to be a separate watchdog process.

AND NOTE THE COST: the hang investigation has now consumed many iterations
and produced no fix, while diverge on the clean tree hands over the next
target in a third of a second. dosearch0 is that target. GO PORT IT and
leave the wield hang for a session with a working watchdog. 'Diverged at or before step N' is
enormously more useful than nothing, and every future hang gets diagnosed in
one run instead of the six theories this one cost. tools/diverge.mjs is ours,
not frozen, so this is a legitimate change.

UNTIL THEN the wield fix stays out of the tree. It is a correct fix -- uwep is
genuinely never written -- but it exposes a defect around key ~180 that no
current tool can localise, and shipping a change that hangs a session to buy
a correctness point that scores nothing is a bad trade. Six theories died here because I treated a block as a
special kind of failure needing special tooling. It is not: it is a
divergence that shows up at the input layer.

SUPERSEDED: get the BASELINE key count for comparison. If baseline also reads ~180
and simply exits cleanly, the fix is not consuming extra keys at all and the
block is the terminal declining to supply the next one. If baseline reads
many more, the fix is stalling mid-session. That single number decides which
half of the system to look at, and it is one instrumented run away.

HOW TO TIME-BOX A RUN HERE. Use the Bash tool's own `timeout` parameter,
which is enforced by the harness, not by a shell binary. If a shell-level
limit is genuinely needed, background the job and poll, or use
`perl -e 'alarm shift; exec @ARGV' 70 node ...`. NEVER write bare `timeout`.

AND THE GENERAL LESSON, which is worth more than the wield bug: a shell
idiom that cannot report failure will manufacture whatever result you are
looking for. `timeout ... | grep ... | head -1` reports success no matter
what happens upstream, because head exits 0. Three consecutive 'measured'
findings came out of a command that never ran the program. When a bisect
starts contradicting itself, SUSPECT THE HARNESS BEFORE THE CODE.

The superseded reasoning is kept below because the contradiction it
describes is what exposed the harness fault.

SO ONE OF THESE WAS TRUE AND THE ANSWER WAS (c):
  a) the hang is nondeterministic, in which case every bisect result above
     including the original is untrustworthy
  b) the instrumented run that 'completed' was completing for a different
     reason (the counter edit perturbed something)
  c) my timeout plumbing is misreporting -- 'timeout 70 ... | grep | head'
     masks the exit status, so 'no output' was read as 'hung' when it may
     have been a grep miss

DO NOT PORT ANYTHING ON TOP OF THIS UNTIL (c) IS RULED OUT. Re-run each case
writing the runner's raw exit code to a file, no pipes. The cheap explanation
is that three 'findings' rest on a shell idiom that cannot report failure.

THIS IS A GENERAL HAZARD, not a wield bug. Any newly-ported message on a
path a session reaches near the end of its input can hang the runner rather
than merely diverge. The symptom is distinctive and worth recognising: the
session does not fail, it never returns, and the scoreboard's TOTAL step
count DROPS (11405 -> 11039) because the session is missing entirely rather
than scoring zero.

    a crashed session  -> screens 0, total unchanged
    a hung session     -> session absent, TOTAL SHRINKS

Check the total, not just the screens.

The uwep storage fix is still right and two thirds of it is committed
(js/uhitm.js, js/do.js). js/wield.js's three reads stay on game.uwep until
the --More-- behaviour at end-of-input is understood -- that is a frozen-file
question (js/terminal.js) and not something to work around in wield.js.

## Why this fork was absent from the leaderboard: no category declared

Nothing had broken. Diagnosis, all verified against live data rather than
guessed:

  fork is public, not archived, parent davidbau/teleport-contest   OK
  HEAD == origin/main, module imports clean, score unchanged       OK
  frozen files untouched                                           OK
  playability_runner.mjs: playable true, 0.795 ms/move (< 1.0)     OK
  fork IS discoverable, page 1 of the parent's fork list           OK

The board's own data is fetchable, which is worth knowing for later:

    https://mazesofmenace.ai/leaderboard/data.json          teams + full history
    https://mazesofmenace.ai/leaderboard/grandfathered.json name -> category

Diffing the two sources settled it: 16 forks exist, 15 teams are listed, and
the ONLY fork missing was ours. Teams scoring 0 points are listed, so the bar
is not score.

THE CAUSE: .teleport/repo-metadata.json did not exist. README:72 makes
`bash frozen/set-category.sh <agentic|transpiled|other>` step ONE of the
workflow and it was skipped when the fork was set up. Every listed team
carries a `category` field, and grandfathered.json exists to backfill exactly
this field for six teams, which is consistent with it being required.

Fixed by declaring `agentic` (README:64 -- LLM-driven workflow). The judge
cron runs every two hours, so confirm the row appears rather than assuming.

GENERAL POINT: local score is not the submission. The port ran clean and
scored 512 the whole time it was invisible to the contest. Check the fork's
presence on the board, not just score.sh.

## Two different `worn` exist, and dup-defs is right to flag it

js/worn.js now has `worn`, the mask-to-slot TABLE from src/worn.c:18, which
setworn() and recalc_telepat_range() are both built around.

js/do_wear.js already had `worn`, a FUNCTION taking a mask and returning the
inventory object wearing it:

    export function worn(mask) {
        return (game.invent || []).find(o => (o.owornmask & mask) !== 0) || ...

They are unrelated. No runtime collision today, because ES imports are
explicit and nothing imports both, but the names are one careless import
apart from a confusing bug.

CHECKED, AND C HAS NO worn() FUNCTION AT ALL. Neither src/*.c nor
include/extern.h declares one. So js/do_wear.js's worn(mask) is an INVENTED
helper, which the architecture rule specifically forbids -- "do not invent
abstractions, helpers, or 'cleaner' designs that have no C counterpart" --
and phase 2 divides parity by diff size, so invented structure costs twice.

WHAT C DOES INSTEAD: it reads the slot globals directly (uarm, uamul,
ublindf) and tests owornmask inline where a mask check is wanted, e.g.
src/do_wear.c:81. Now that js/worn.js has the worn[] table, the faithful
replacement for worn(mask) is a lookup through that table into game.u --
which is what C's globals ARE.

DO NOT rip it out casually: it has callers in js/do_wear.js (3) and
js/spell.js (2+), and js/spell.js uses it to rebuild the whole armour set
in one line. Converting them means touching real logic, so it is its own
task, worth doing before phase 2 rather than after. The name clash with the
table is the visible symptom; the invented helper is the actual defect.

## undefined-refs.mjs: one real hit in 19, and the other 18 are noise

It found a genuine latent crash -- doclose calling feel_newsym, which is not
ported anywhere, so closing a door threw. No public session reaches that
line, so the scoreboard stayed green while the defect waited for a held-out
game. THAT is what the tool is for, and it is worth running after any port.

But do not chase the whole list. The reported total is dominated by three
systematic false positives, all verified:

    function declarations   _statusLine1 IS defined at js/display.js:365;
                            the tool flags the declaration as "first use"
    import aliases          ATR_UNDERLINE is imported `as TERM_UNDERLINE`
                            at js/tty/wintty.js:21
    class getters           js/game_display.js's cols/rows/grid/spans and
                            friends are all `get x() { ... }` members --
                            that is 12 of the 18 on its own

Also noise: `async` (keyword misparse, js/jsmain.js:171 and
js/plselect.js:558) and `requestAnimationFrame` (browser global).

SO THE USEFUL READING IS: ignore js/game_display.js entirely, ignore `async`
and browser globals, then look at what is left. A name that is neither
declared in its file nor imported into it is the real thing, and
feel_newsym was the only one of those. Fixing the tool's parser would be
nice but is not worth a session; knowing its three blind spots is enough.

## A DUPLICATE import declaration zeroes the whole board (NOT a cycle)

RETRACTED HEADING, kept for searchability: this was first written up as
"js/wield.js must not import from js/invent.js". THAT DIAGNOSIS WAS WRONG
and acting on it would have blocked legitimate imports forever.

Adding `import { prinv } from './invent.js'` to js/wield.js took the
scoreboard from 512 screens to ZERO, with all 44 sessions failing and the
step total collapsing to 0/0. Reverting the one import restored it exactly.

THE ACTUAL CAUSE: prinv was ALREADY imported at js/wield.js:16. Adding a
second `import { prinv } from './invent.js'` is a DUPLICATE BINDING, which
is a SyntaxError -- the module never parses, so every session that touches
it dies. Nothing to do with cycles.

Calling prinv through the EXISTING import works perfectly: 512 screens, five
zero-screen sessions, no change. ready_weapon:prinv is now wired.

WHY IT LOOKED LIKE A CYCLE, and this is the part worth remembering: a
SyntaxError in one widely-imported module produces exactly the same
scoreboard signature as a load-order problem -- every session fails and the
step TOTAL collapses to 0/0. The blast radius says nothing about the cause.

PRACTICAL RULES
  - CHECK WHETHER A SYMBOL IS ALREADY IMPORTED before adding an import.
    js/wield.js has three separate import lines from js/invent.js (:5, :16,
    :22), so grepping only the first one is misleading.
  - a change that zeroes ALL sessions and drops the step TOTAL to 0/0 is a
    module that failed to PARSE OR LOAD. Revert, then read the error --
    `node -e "import('./js/wield.js')"` reports it immediately and names the
    duplicate identifier.
  - the earlier droppables_fn TDZ in js/obj.js IS real and unrelated; do not
    merge the two in your head as I did.

## js/attrib.js CANNOT import js/youprop.js — a real cycle, unlike the prinv one

Converting attrib.js's uprops reads to the youprop accessors zeroed the
board (0/0, all 44 sessions). This time the load error names a genuine
cycle, not a duplicate binding:

    Cannot access 'droppables_fn' before initialization

Same TDZ recorded earlier for importing js/obj.js in a bare harness, but
here it fires in the REAL APP: js/youprop.js imports js/mondata.js
(is_flyer), and somewhere along that path the graph reaches back to
attrib.js while it is still initialising.

TWO DIFFERENT FAILURES WITH THE SAME SCOREBOARD SIGNATURE, and the only way
to tell them apart is the load error:

    duplicate import binding  -> SyntaxError naming the identifier
                                 (js/wield.js + prinv, earlier)
    genuine import cycle      -> "Cannot access X before initialization"
                                 (js/attrib.js + youprop.js, this one)

Reverting is right in both cases; the DIAGNOSIS differs entirely, and I got
it backwards the first time by guessing.

CONSEQUENCE FOR THE uprops WORK: the reader conversion is NOT uniformly
safe. It worked in js/sounds.js, js/mon.js, js/eat.js and js/allmain.js and
fails in js/attrib.js. Convert one file at a time and RUN THE FULL
SCOREBOARD after each -- a module load check passes for the duplicate-import
case and the per-file cost is the only reliable signal. Files that cannot
take the import need the cycle broken first, probably by giving js/youprop.js
no imports beyond js/gstate.js.

## The youprop import cycle traces to a BACKWARDS import of is_rider

Chain, from the attrib.js failure above:

    js/attrib.js -> js/youprop.js -> js/mondata.js -> js/makemon.js -> ...

The bad link is the last one. js/mondata.js:1 is

    import { is_rider } from './makemon.js';

but is_rider is a MACRO IN include/mondata.h:161, so it belongs in
js/mondata.js itself. A header-mirror importing from a .c-mirror is
backwards, and it is what drags the whole monster-creation graph into
anything that merely wants a youprop accessor.

THE FIX: move is_rider from js/makemon.js into js/mondata.js, where the C
puts it, and update its ~20 consumers. That is the architecture rule applied
literally, it removes js/mondata.js's only outward import that is not a
header or gstate, and it should let js/attrib.js take the youprop import.

DO THIS BEFORE CONTINUING THE uprops READER CONVERSION -- every remaining
file may hit the same wall, and fixing it once is cheaper than routing
around it 40 times.

## Attempted the is_rider move and REVERTED it — what the next attempt needs

Tried the fix recorded above (move is_rider from js/makemon.js to
js/mondata.js). It zeroed the board and I could not finish it in the context
I had, so it is reverted; 512 screens restored exactly. The plan is still
right, but it is bigger than it looks.

WHAT WENT WRONG, so the next attempt does not repeat it:

  1. js/makemon.js USES is_rider itself (at :484), so moving the definition
     out means makemon must import it back from mondata. Easy to miss when
     you are thinking of makemon as the source.

  2. THE CONSUMERS ARE NOT ALL ON ONE LINE. js/dog.js:57-58 is

         import {
             makemon, MM_EDOG, ..., is_rider, mpickobj } from './makemon.js';

     A grep for `is_rider.*makemon` finds this one, but any file whose
     import splits `is_rider` and `from './makemon.js'` across DIFFERENT
     lines is invisible to that grep -- and at least one such file exists,
     because after fixing every match I could find the loader still said
     "does not provide an export named 'is_rider'".

  3. So find consumers by REMOVING THE EXPORT AND READING THE LOADER, one
     error at a time, rather than by grepping. The loader names the importing
     module precisely and cannot miss one.

The payoff is unchanged and still worth it: js/mondata.js is a HEADER mirror
and must not import from a .c mirror. Fixing it should unblock js/attrib.js
taking the youprop import, and with it the remaining ~40 uprops reads.

## dup-defs sample: `accessible` lives in the wrong file

166 names are reported as defined differently in more than one file. Sampled
one to see whether the report is signal or noise, and it is signal:

    js/const.js    export function accessible(x, y) { ... ACCESSIBLE(...) }
    js/monmove.js  function accessible(x, y) { ... ACCESSIBLE(levtyp) && ... }

C has ONE, at src/monmove.c:2188, so js/monmove.js is its correct home and
the js/const.js copy is the interloper -- const.js mirrors include/*.h and
should not hold a .c function at all.

NOT FIXED, deliberately. js/mon.js:11 imports the const.js version, so the
change is: export monmove's, repoint mon.js, delete const's. That is an
import-graph edit, and import-graph edits zeroed the whole board three
separate times today (duplicate binding in wield.js, a real cycle in
attrib.js, the is_rider move). It wants a context with room to run the full
scoreboard after each step, not the tail of one.

CHARACTERISED THE WHOLE REPORT, so nobody has to guess how bad it is.
Of the 165 differing names, comparing the two bodies with `export` stripped:

    48   IDENTICAL once export is ignored -- a local re-declaration of a
         const.js constant with the same value (A_CHAOTIC = -1 in both).
         Untidy and against the architecture rule, but behaviourally inert.
    117  GENUINELY DIFFERENT BODIES. These are the real ones, and
         `accessible` was one of them.

So roughly two thirds of the report is signal. Fix the 117 first; the 48
are a tidy-up that can ride along with whatever file they are in.

WORTH KNOWING FOR THE OTHER 165: the two bodies here are not
interchangeable. const.js's reads `game?.level?.at?.(x, y)` and returns
early on a missing location; monmove.js's reads `.typ` and also tests
closed_door, which is what the C does. So whichever one a caller imported
changed behaviour, silently. Do not assume same-name duplicates are
harmless because the score is unchanged -- check which is faithful first.

## findgold: two copies, and NEITHER matches C

Found during the dup-defs pass and left in place, because fixing it needs a
caller audit rather than a delete.

    C, src/steal.c:45   RETURNS THE OBJECT (or null):
                          while (chain && chain->otyp != GOLD_PIECE)
                              chain = chain->nobj;
                          return chain;

    js/makemon.js       returns a BOOLEAN: minvent.some(o => o.oclass ===
                        OCLASSES.COIN_CLASS)
    js/monmove.js       loops and returns the object, closer to C

TWO DIVERGENCES, not one:
  1. makemon's returns a boolean where C returns an object. Any caller that
     wants the gold itself gets `true`.
  2. BOTH test the wrong thing. C compares otyp against GOLD_PIECE; ours
     compare oclass against COIN_CLASS. Gold is the only COIN_CLASS object
     in 5.0 so they agree today, but that is a coincidence of the object
     table, not the same test.

ALSO THE WRONG HOME: findgold is src/steal.c, so neither js/makemon.js nor
js/monmove.js should own it.

TRIED THAT FIX AND REVERTED IT. js/steal.js already exists, so findgold went
there in C's shape (returns the object, tests otyp === GOLD_PIECE) and both
callers were repointed. The caller audit was fine -- makemon's site is
`!findgold(...)`, which reads correctly against an object return.

WHAT BROKE: importing js/steal.js into js/makemon.js and js/monmove.js
completes a cycle, and the board went to 0/0 with

    Cannot access 'droppables_fn' before initialization

the same TDZ as the js/attrib.js case. Reverted; 512 restored exactly.

SO THIS NEEDS THE CYCLE BROKEN FIRST, like js/attrib.js did. That one was
fixed by moving is_rider to its header home, which removed
mondata -> makemon. Find the equivalent bad edge into js/steal.js before
retrying. The findgold consolidation itself is correct and worth doing --
it is the import that fails, not the code.

## The droppables_fn TDZ: the cycle is mkobj -> makemon, and it is all wrong-home

droppables_fn has blocked three separate changes today (js/attrib.js taking
a youprop import, the findgold consolidation, and importing js/obj.js in a
bare harness). It is not a mysterious fault -- js/steal.js:9 declares it as a
late-bound hook precisely BECAUSE a cycle already exists there:

    let droppables_fn = null;
    export function steal_wire_droppables(fn) { droppables_fn = fn; }
    ... js/dog.js:1528  steal_wire_droppables(droppables);

The loop that detonates is:

    js/makemon.js -> js/steal.js -> js/mkobj.js -> js/makemon.js

and the LAST edge is the fixable one. js/mkobj.js:32 imports four names from
js/makemon.js, and ALL FOUR are in the wrong file:

    is_male          include/mondata.h:112   -> belongs in js/mondata.js
    is_female        include/mondata.h:113   -> belongs in js/mondata.js
    level_difficulty src/dungeon.c:2027      -> belongs in js/dungeon.js
    rndmonnum        src/mkobj.c:388         -> belongs in js/mkobj.js ITSELF

That last one is the striking part: mkobj.js is importing its OWN C file's
function from another module. Moving these four to their C homes removes the
mkobj -> makemon edge outright and should break the cycle, exactly as moving
is_rider to js/mondata.js unblocked js/attrib.js earlier today.

SCOPED THE FIRST PIECE, so the next session knows what it is walking into.
is_male and is_female alone touch FOUR files:

    js/makemon.js  defines both (:79, :80) -- to be removed
    js/mondata.js  their C home -- to receive them
    js/mkobj.js    imports them from makemon (:32) -- repoint
    js/sp_lev.js   imports them from makemon (:51) -- repoint
    js/role.js     has its OWN copies (:356, :357) -- delete, import instead

So five files for two macros, and role.js's copies mean dup-defs will still
report the names after the move unless they go too. That is the same
every-site trap helpless and is_animal sprang.

MOVING THESE TWO DOES NOT BREAK THE CYCLE on its own -- the mkobj -> makemon
edge survives as long as ANY of the four names is still imported from there.
All four have to land before the cycle opens.

DO THIS EARLY IN A SESSION, not at the end of one. It touches four names
across at least five files and every consumer of each, and the failure mode
is a 0/0 board. But it is the same shape of fix that already worked once, and
it unblocks the findgold consolidation plus whatever else is currently
routing around the knot.

## Comparing against an UNPORTED function pointer is silently always-true

C compares function pointers all over the occupation and equipment code:

    if (ga.afternmv == Shirt_on)          donning()
    if (ga.afternmv == stealarm)          thiefdead()
    cancelled_don = (ga.afternmv == Cloak_on || ...)   cancel_don()

In C an undefined comparand is a compile error. In JS it is not:

    game.afternmv === Shirt_on     // Shirt_on undefined
    game.afternmv === undefined    // ... which is TRUE when nothing is armed

So porting one of these functions before its comparands exist does not
produce a dead branch -- it produces a branch that fires CONSTANTLY, in the
permissive direction, with no error anywhere. donning() would have reported
"currently being put on" for every object in six of seven slots.

FOUR SITES HIT THIS SO FAR: donning, doffing, cancel_don, thiefdead.

THE RULE: before porting any function that compares against a function
pointer, check that every comparand exists. If one does not, either port it
first or RECORD that arm -- never leave the comparison in. A recorded arm is
visibly incomplete; an undefined comparison looks finished and is wrong.

This is the same family as two other always-true traps found this session:
uprops[PROP] becoming a truthy object once it is a struct, and
`(Invis && ...)` where Invis was shadowed from a boolean into an imported
function. JS turns several kinds of C-obvious mistakes into silent truth.

## The dup-defs pass: 31 cleared, 141 left, and what it actually found

Worked the report down from 172 to 141 differing names. It is not cosmetic
work -- two of the removals were real defects:

    helpless    js/dog.js carried a THIRD term, (mfrozen | 0) > 0, that
                include/monst.h:251 does not have. It made frozen-but-mobile
                monsters read as helpless, changing combat branches, and
                js/dog.js:1346 calls it in the pet-movement path. Live wrong
                answer, not dormant code.
    accessible  js/const.js and js/monmove.js had DIFFERENT bodies -- the
                const.js one returned early on a missing location and never
                tested closed_door. Whichever a caller imported changed
                behaviour silently.

WHERE THE DRIFT LIVES: js/dog.js gave up TWELVE local copies, more than
every other file combined. It is the largest hand-ported file and predates
most of the header mirrors, so its author had nowhere canonical to put
them. Expect the same shape in any similarly old file.

THREE TRAPS THIS PASS SPRANG REPEATEDLY, all now costed:

  1. THE THIRD COPY. Five names -- helpless, is_animal, humanoid,
     DEADMONSTER, passes_walls -- still reported after the first fix because
     a third file had one. Re-run dup-defs after every removal; the count is
     the only honest signal.
  2. FORMATTING. Copies use aligned spacing (`const is_animal   =`), so a
     regex written against the canonical form silently misses them. Read the
     actual line before editing.
  3. MULTI-LINE IMPORTS. js/mklev.js imported likes_gems from makemon across
     a line break, invisible to `grep 'likes_gems.*makemon'`. Removing the
     export broke the board until it was found. Match on the name, then read
     the import block.

WHERE THE PASS STANDS: 172 -> 121 differing names.

WHAT IS LEFT AND HOW TO ATTACK IT:

  ~30 inert constant re-declarations whose file ALREADY imports from
      const.js. These batch safely -- delete the local const, append the
      name to the existing import. Several can go in one commit.

  DONE -- and the thing that unblocked them is worth keeping:

  IMPORTING js/const.js IS SAFE BY CONSTRUCTION. It imports only
  js/version.js, js/monst_data.js and js/gstate.js -- data and state
  modules with no logic -- so a const.js edge cannot cycle back into
  anything. That is not true of any other module here: adding an edge to
  invent, worn, display, steal or mondata has zeroed the board five times
  today.

  So "this file has no const.js import" is never a reason to leave a
  constant duplicated. Check the TARGET module's own imports before
  deciding an edge is risky; for const.js the answer is always no.

  ~90 with genuinely different bodies. These need reading one at a time --
      that is where helpless and accessible came from.

THREE IMPORT-BLOCK FORMS BROKE BATCH EDITS, each invisible to the fix for
the last one:
    aligned spacing      `const is_animal   =`  defeats a canonical regex
    multi-line imports   name and path on different lines, so
                         `grep 'name.*path'` finds nothing
    trailing comma       inserting before the closing brace yields `,\n, X`
                         and the file stops parsing
A batch script must handle all three or verify each file with node --check
before running the board.

## The dungeon predicates duplicated in const.js differ by SIGNATURE

Several dungeon.c predicates exist in both js/const.js and js/dungeon.js,
and the two forms are not interchangeable:

    js/const.js    In_sokoban(uz)  { return (uz ?? game?.u?.uz)?.dnum === ... }
    js/dungeon.js  In_sokoban(lev) { return lev.dnum === ... }

The const.js versions DEFAULT to the hero's level when called with no
argument; the dungeon.js versions require one and throw on undefined. Same
name, different contract.

So these cannot be deduplicated by deleting one -- every caller has to be
checked for which form it relies on. A caller written against the
defaulting version and repointed at the strict one throws; the reverse
silently answers about the hero's level instead of the level asked about,
which is worse.

Is_botlevel has the same split. Expect the rest of the In_*/Is_* family to
as well.

TO FIX: pick the C signature (an explicit d_level argument, as in
src/dungeon.c), port that into js/dungeon.js, then convert callers one at a
time, giving each the argument it needs. Do not start by deleting.

## C's "null pointer means empty" does not survive translation to an array

Found via Has_contents, and it will recur wherever a C linked list became a
JS array.

    C     #define Has_contents(o) ((o)->cobj != 0)
    ours  js/const.js  obj?.cobj != null        WRONG
          js/obj.js    !!(o.cobj && o.cobj.length)   right

C's cobj is a list HEAD: null means the list is empty. Our cobj is an ARRAY
that js/mkobj.js:872 initialises to [] on container creation. An empty array
is not null, so the direct translation of the C test reports every empty box
as full.

THE GENERAL FORM: any C test of the shape `ptr != 0` on a list head becomes
a LENGTH check, not a null check, once the list is an array. The same
applies to minvent, invent, cobj and level.objects, all of which are arrays
here and all of which C tests as pointers.

WHERE TO LOOK: a `!= null`, `!== null` or truthiness test on one of those
fields is suspect. It is silently wrong rather than broken -- the empty case
answers backwards and nothing throws.