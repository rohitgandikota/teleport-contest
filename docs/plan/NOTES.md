# Working notes

Things discovered while doing the work that are not obvious from reading the
contest docs, and that would cost the next agent time to rediscover.

**Add to this file whenever you learn something non-obvious.** Edit the existing
entry if one covers the same ground rather than appending a duplicate. Keep each
entry short: what is true, how it was found, what to do about it.

Newest first within each section.

---

## Untrapping and rescue oracles

A pit does not stop a hurtled monster while it is airborne. Put a wall beyond
it to make the monster land there. Small monsters evade bear traps; pony,
large dog and troll setups reach actual capture. Check the native monster
state and rescue message before calling a scenario a rescue.

Spaces answer ynq prompts using their default, often cancellation. A known
trap's movement warning also needs explicit yes before testing a trapped
hero. The wizard identification command is #wizidentify, with a real menu
selection to make identification permanent. #identify is unknown. Inspect
the native prompt and next key, not just a probe's intended input string.

C float_up compares utraptype with WEB, not TT_WEB. Preserve its resulting
leg-stuck message for a web. Capture uses set_utrap so blocked Lev/Fly stays
consistent; terrain transitions must call switch_terrain to restore flight.
Explosion HP damage is halved separately from the raw damage used for stun.

Remembered trap glyphs are not live trap-state oracles. Use native action
messages at exact input boundaries, and constructed states for hidden
knowledge and ownership. Omitting the pager tseen update passes the new
native corpus but fails its state gate. Charge deduction needs either a
constructed success or an identified, successful native grease repair.

## Looting, automatic unlocking and magic keys

C autounlock is a bitmask, not the configuration string. Its parser accepts
abbreviations and either spaces or plus signs, but not mixed separators.
Uppercase NONE works; uppercase action initials fail in C's switch. The
live menu distinguishes no selected rows from Escape. #options and
#optionsfull must share O's handlers, including the m-prefix behavior.

A locked-container message can add More before the key, force or trap
question. Pin the native question and its next key before calling a case
an accepted attempt. Wished graves cannot replace stairs; move onto floor.
The saddle probes' pony is northeast, not east. A no-hands aquatic form
cannot demonstrate the later pool guard.

The generated artifact_otyps table holds names. Convert through ONAMES
before passing a type to nxtobj. Checking a magic key first in inventory
hides a bad traversal type. Test a preceding ordinary object and multiple
keys. C skips both trap chance calls for qualifying keys, which verifies
forcing independently of whether the disarm happens to succeed.

Reverse looting must update coffer weight and clear cknown after gold
transfer. A missing weight update passes this native corpus but fails the
state gate. Full and split gold transfers also need separate quiver and
ownership checks. Forced disarming skips its chance roll; the later
exercise call can still draw RNG.

## Inventory types and unpaid display

Traditional and combination I use a single-character prompt. Full and
partial use query_category. The response list contains hidden choices
after Escape so missing types can produce a specific message. Uppercase
U or X fall back to unpaid or used-up displays only when their BUC class
is absent. Querying spends no turn and must preserve bills and ownership.

C dounpaid uses a recursive find_unpaid cursor. A single visible item uses
a message line; multiple items or hidden contents use a data window and a
total. Unknown outer containers hide their individual contents. The full
multi-item path checks the top container's cknown flag, even if an inner
container remains unknown. Price suppression must be restored after naming.

distant_name resolves ownership with get_obj_location before testing sight
and distance. Carried coordinates can be stale. It temporarily clears o_id
at game over and restores it after naming. The inventory native fixtures
do not catch removing either guard; constructed controls do.

Switch menustyle live after shop-container setup. Setting it earlier changes
which keys the looting prompts consume. Do not append duplicate compound
menustyle options: C shows startup errors, a separately retained port gap.

## Category selection, venom and menu symbols

C counts categories only in inv_order, then appends venom to the menu.
The single-category shortcut returns the first eligible object in list
order, which can be venom even though venom did not contribute to the
count. count_categories excludes saddle bits; is_worn includes them.
Ball and chain bits are excluded by both. Test these predicates separately.

A alone is rejected unless ParanoidAutoAll enables confirmation. Declining
replaces a lone A with All types only when the caller permits that flag.
Mixed selections retain their other categories and counts. The two hint
counters reset per game; cmdassist controls repetition after the first hint.

Wishes do not generally reveal BUC. Use wizard identification before
claiming a B/U/C filtering probe. Adding a new class changes accelerators.
Assert the actual C menu and final inventory, not just the requested keys.

menu_objsyms has six modes. Its obsolete bare alias is case-sensitive in
the C value handler: lowercase use_menu_glyphs selects entries, uppercase
selects headers. The alternate one-or-the-other spelling accepts a suffix.
The native recipes preserve these quirks. Invalid numeric values expose
an unported startup error screen; keep that failure separate from parser
checks and passing gameplay recordings.

## Fatal HP and status timing

C botl.c:259 skips the whole status draw when human HP is exactly -1,
including while polymorphed. It still clears the dirty flags. done() calls
bot before forcing HP to zero. The next message flush can therefore show
the previous HP beneath a death More prompt. Other negative values draw
zero normally. Test -2, -1, 0 and positive HP separately.

This guard replaces the lava, losehp and mdamageu workarounds that inspected
message text or counted More prompts. The fatal-hp-status recipe pins C's
status cells and damage messages at the exact boundaries. showdamage must
run immediately after subtraction, before maximum-HP clamps. Turning it on
adds More prompts and can change which later key reaches a Die question;
count answered native questions before asserting mortality.

## Container transfer probes

A wished stack can merge into one of several existing stacks. Eight wishes
of 30 +0 daggers produce stacks of 210 and 30 in this setup. Read the actual
C menu before selecting a count: 120b reaches the large stack, while 120a
only takes the 30-stack and never asks about encumbrance. A preceding More
can consume the planned yes/no answer. Pin the Continue prompt and inspect
the resulting contents before claiming a confirmation branch.

splitobj inserts its child into every owner chain before returning. Porting
monster linkage exposed money2u leaving the paid child in minvent while
adding it to invent. Always use obj_extract_self, including after a split.
Total gold alone misses duplicate ownership; check the object identities.

The status before yn_function follows dirty flags. An unconditional bot
refresh exposes capacity too early during container removal. Newly held gold
sets botl, so suppressing every capacity repaint is also wrong. Preserve the
C flush timing and test both large item stacks and large gold stacks.

sortloot is stored as a full option string in this port. Native contents
sorting checks its first character. Test loot/full with !sortpack; the
pack grouping can hide a missing loot-sort flag. Traditional P filtering
can match every wished object, since these wishes retain pickup_prev.

## Traditional inventory selection probes

identify_pack repeats ggetobj when category selection returns zero. Escape
at that category prompt therefore retries; q at an item prompt returns minus
one and ends identification. A declined full pass prints That was all and
can require a More acknowledgement before the next category choice. Verify
that a new recording finishes the intended interaction before promoting it.

Changing an old shop recipe's menustyle also changes its earlier pickup
prompts. Keep the proven setup and switch through the live option menu:
`mO:menustyle\r\rt` selects Traditional. Then acknowledge the change message
before sending the target command. The three unpaid-drop cases use this.

C initializes menu_style to MENU_FULL in options.c:7258. Store that default
at startup rather than relying on each caller to supply it. The shared
selection port exposed this missing initialization in 23 existing fixtures.

askchain preserves the entered class order. Its mx limit counts callback
attempts, including zero results. A rejected counted split is recombined.
Object iteration rechecks the live chain, because an earlier action can
destroy a later selected object. The native reversed-class cases and the
mutation gate distinguish these behaviors from a simple filtered-array loop.

## Spell and repeat probes

Traditional getspell calls yn_function with addcmdq true and docast stores
the selected letter again. A repeated directional cast can therefore consume
an invalid direction. This is native behavior; preserve it. Padding with
spaces or escape clears the repeat queue, so real repeat tests must send
Ctrl-A immediately after the cast finishes.

Wizard intrinsic letters h/i are hallucination/blindness. Require the actual
native status message before claiming a blind-reading test. Tiny bee forms
can be overloaded even by a scroll, which makes doread reject before can_chant.
The wumpus case reaches silent blind reading without that carrying-capacity
interference.

The existing RNG probe runs in rn2, not rnd. Observe the energy write after
spell_backfire to inspect both timers before a turn decrements them. Ordinary
spelleffects runs the check; forced #wizcast bypasses it and cannot prove the
casting preconditions.

Use M_AP_TYPE when comparing a mimic's appearance kind. Its raw m_ap_type can
also include M_AP_F_DKNOWN. The wizard-create state gate's coin-disguise
assertion was stale on both sides of the casting checkpoint; C's existing
recording still shows the coin pile.

## Resistance and equipment probes

Wizard intrinsic menus restart their letters on every page. Acid and stone
resistance are c/d on page two, reached with >. Using w/x on the first page
silently selected nothing. Require the native timeout message. Gold scales
shine "brightly"; gold mail shines "brilliantly".

Taking off the only armor item auto-selects it. Glove danger confirmation
uses T, "yes", Enter, without an inventory letter. Destroy-armor scrolls
apply one to four erosion hits; wish thoroughly eroded armor to guarantee
destruction. Erosion calls Armor_off even when destroying the suit; preserve
that C death-reason wording. Polymorph loss reaches Armor_gone instead.

A corpse's user name is stripped by killer_xname. An oversized object name
cannot test the final kbuf truncation. The state control checks stripping;
no native boundary-coverage claim is made for the 255-character bound.

## Scoring: what the runner actually does

**Loader mutations must reach the scoring worker.** `ps_test_runner.mjs`
spawns a fresh Node process without forwarding command-line `--loader` or
`--import` flags. Set the loader in `NODE_OPTIONS`, which the worker inherits,
or run the worker directly. A creation-occupation mutation appeared to pass
all 566 screens when only the parent loaded it; the inherited mutation fails
the replay. A direct state-gate invocation already runs in the loaded process.
Keep mutation logs separate from unchanged-runtime verification.

**Closing a menu can preserve hallucinated glyphs.** `docallcmd` must rely
on the tty window's dismissal path. An extra `docrt` redraws every visible
monster and object with new hallucinations even when gameplay RNG is exact.
The monster-name refusal fixture under hallucination catches this. Long
monster names also require `getlin` to replace `getpos`'s physical no-history
description, and `show_topl` to wrap through `addtopl` at column 79. The
monster-name state gate checks trailing newline and backspace clearing too.

**A status redraw is not always harmless.** C only calls `bot` from
`flush_screen` when `disp.botl` or `disp.botlx` is set, then clears the
flags. Removing a corpse or restoring pre-polymorph attributes can change
live values before a message is acknowledged. Repainting on every `pline`
exposes those values too soon. Keep the flags on `game.disp`, including
encumbrance; set them at the same C sites. `timebot` must change only the
time field, not the other saved status fields. The revival and
`status-dirty-state-gate` tests catch these distinctions. A long dragon meal
also catches an unconditional bot call in moveloop_core. Removing it requires
the missing C flags in more_experienced, spelleffects_check and docorner;
otherwise XP/power stays stale and dismissed menus leave clipped status rows.

**C's portable integer bound is 32767.** `rndexp` halves a range at or
above `LARGEST_INT` before drawing and scales the result back up. Replacing
that macro with the native signed-int maximum changes both the RNG log and
the actual experience total. The polymorphed level-gain recording reaches
this at level 13; the original wrong bound happened to draw the same raw
number, hiding the changed experience total from a status line without XP.

**A boolean return does not replace a C output pointer.** `cant_revive`
must write the substituted monster type as well as return true.
`openfallingtrap` must write the caller's `.v` noticed flag, not a separate
`.value` property, so opening-wand identification and exercise can run.
The new revival source-state matrix and trap-identification gate pin both
outputs independently of screen comparisons.

**September 3 regression audit: run the whole supplemental corpus.** A clean
44/44 public score and a 94/102 RNG-only fuzz census hid four supplemental
runtime errors after the large source ports. The live judge also exposed
`altar_wrath` calling an undefined `Luck`. The lexical undefined-reference
checker missed that name because a different function in pray.js declares a
local `Luck`. It is not a scope checker. Actual crash reproducers recovered
1,996 existing supplemental screens; the new altar oracle adds another 399.
The dashboard now retains the failing-session list and judge error text.

**Keep the initialized pet record authoritative.** Pet AI and save/revival
paths store state on `mon.edog`. `MM_EDOG` can also allocate an empty
`mon.mextra.edog`. The C `EDOG` accessor must read the initialized top-level
record first, or newer ports such as `eat_brains` either throw or add
nutrition to an uninitialized, disconnected record. The brain-drain state
gate checks accessor identity as well as the two pets' C-derived nutrition.

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

**The rng comparison strips the call site** (`normalizeRng` drops everything
from `@` on), so "rn2(5)=0" matches "rn2(5)=0" even when C drew it in
distfleeck for monster A and we drew it in distfleeck for monster B. Two
interchangeable-looking draws (distfleeck's rn2(5), mcalcmove's rn2(12)) can
therefore keep a stream "matched" for thousands of calls while per-monster
behavior has already forked. seed0360's goblin looked correct for ~3000 draws
while C's goblin had been silently armed by dogmove.c:1157's return attack
(pet HITS a monster -> rn2(4) gate -> mattackm(defender, pet), whose AT_WEAP
arm wields without costing the defender's own action). When a fight scene
diverges, check WHOSE turn each aligned draw belongs to before trusting the
prefix: instrument rn2 with a stack capture and compare against C's recorded
labels position by position.

**Steps are not moves.** A session can spend its first 100+ keys on zero-time
commands (menus, farlook, help); no monster acts and no per-turn draws fire
until the first real action. The first `mcalcmove` batch (one rn2(12) per
monster) in the recorded rng marks the first real turn. When probing "at
step N", print `game.moves` too, and remember that probe output gathered
AFTER the divergence reflects a forked simulation, not the matched prefix.

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

**We can mint our own ground-truth sessions — pipeline in `tools/gen-sessions/`.**
`tools/gen-sessions/record.mjs` turns a recipe (seed, datetime, nethackrc, key
string) into a `.session.json` via the recorder; `render.mjs` shows any step's
screen as plain text for composing key plans. Verified 2026-08-23: seed0077
re-recorded from only its recipe fields is byte-identical to the canonical file
(3,242 rng entries, all screens/cursors, no normalization), and all 11 generated
starter sessions are byte-identical across repeated recordings. The starter
batch (seeds 6001-6501) covers wishes, kicks, fountain quaff/dip, wear/remove,
striking-at-door, Elbereth engraving, martial arts, angry-god prayer, and a
save/restore pair — see `tools/gen-sessions/README.md` for the coverage table
and the authoring gotchas (--More-- eats non-space keys; a debug-mode twin of a
normal seed generates a DIFFERENT map, so scout by extending the real keyplan).
Generated files live in `tools/gen-sessions/generated/`, never in `sessions/`.

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

The fatal-timer probe batch also showed why padding input with repeated `y`
is unsafe for intent: it accepted death and then `Save bones?`. Later cases
loaded bones despite using the same seed and rc. The initial RNG count changed
from 2,194 to 260 in those specific probes. Corrected commands consume the tin
and decline death. Check actual prompts and fresh-game startup before treating
each segment as an independent scenario; do not change the recorder's intended
bones persistence to conceal a faulty recipe.

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

## Display RNG affects screens, but has no direct RNG score

`rn2_on_display_rng` draws from a second ISAAC64 context. Ordinary fixtures
omit these calls and the scorer filters out their `~d` prefix. Their order
still determines hallucinated glyphs and names on scored screens.

The pinned C initializes both contexts in options.c:7161-7162 through
`init_random`. The recorder's `sys_random_seed` hook in unixmain.c:816 returns
`NETHACK_SEED`, making both reproducible. Earlier notes here incorrectly claimed
the display context was never seeded. The current JS seeds it on first use.

Set `NETHACK_RNGLOG_DISP=1` when making a separate diagnostic C recording to
include `~drn2` entries. Keep that diagnostic separate from permanent oracles.
The object-type floor-hallucination probe revealed a missing display draw even
though its entire core trace matched: `docrt_flags` calls `see_monsters`, which
calls `newsym` on the unmounted hero and maps the object underneath it. Drawing
only the hero glyph skipped that map call. An isolated instrumented C build
with `map_object` stack traces confirmed the call; the source fix restored
screen parity. See `.cache/naming/c-map-trace.log` and the type-naming audit.

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

The fatal-timer pass found another instance in maybe_cannibal's `ate_brains`.
Domestic meat in one game suppressed a human-meat penalty at the same move in
the next game. Single-case replay passed; the combined recipe failed. The
guard now lives on `game`, so resetGame supplies a fresh zero value just as a
new C process does. The nine-case first-bite fixture preserves that regression.

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

The 2026-09-05 statue pass provides a concrete example. Missing speed-boot
updates in `update_mon_extrinsics` first changed the RNG stream in a later
monster move, even though equipment selection itself has no draws. Gold armor
also needs its worn mask intact when deciding whether to stop its light.
Shared `curse` clears a former blessing; assigning only the cursed flag is not
equivalent. See [monster-statue-audit.md](monster-statue-audit.md).

An amulet pickup is not evidence that life saving was tested. In
`movemon_single`, hostile monsters defer equipment changes while they think
the hero is within three squares. The successful C probes tame the carrier
after pickup, verify the wear message, and only then cause petrification.
Body armor separately prevents petrification from hurtling into a cockatrice.

The engulfing pass supplies another state-only counterexample. Removing the
three gulpmu calls to ugolemeffects still passes all 4,579 new visible screens,
55,683 RNG entries and 22 animations, but a source-state control catches lost
iron-golem healing (HP 10 instead of 19). An occupation control also exposed
cmd.reset_remarm writing an unused context.takeoff while the active record was
context_takeoff. Use the shared C counterpart before introducing another copy
of global state. See [engulfing-audit.md](engulfing-audit.md).

Cloud creation and invisible polymorphs can expose errors far from combat:
make_gas_cloud owns the steam message, nearby makemon must call set_apparxy,
warnreveal follows automatic search, and deleting a light requests vision
recalculation. A matching attack's RNG does not verify those later effects.

The gas-cloud pass adds a second state-only counterexample: changing
gulpum's blindness cap from 127 to 126 passes all 11,548 new visible screens,
130,031 RNG entries and 118 animations, but fails the blindness state control.
Native branch coverage also rejects an intended energy-drain claim: the
energy-vortex replay reaches shock but never calls xdrainenergym. Validate
species constants before constructing controls; an undefined makemon species
requests random creation instead of rejecting a misspelling.

An old fog-human replay exposed a missing relocation update. Native #timeout
snapshots showed the new cloud expiring in C while JS kept extending it. This
did not prove the fog was missing from C's map. A separate diagnostic build
showed both clouds initially included it; expulsion later removed membership
through rloc_to_core's update_monster_region call, which the port omitted.
Verify the state transition that could explain an absence before inferring
the state was never present. The ordinary recorder was unchanged.

Urgent tty output sets WIN_NOSTOP for one update_topl call and clears it
afterward. Keeping it set until a later screen changed ESC suppression in
unrelated messages. Feeling a floor likewise can overwrite a cloud glyph
without deleting its region. See [gas-cloud-audit.md](gas-cloud-audit.md).

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

THE CORRECTION: `node -e "import('./js/do.js')"` used to FAIL ON A CLEAN TREE,
because do.js's wire holders were `let` and any entry that re-entered do.js
mid-init hit their dead zone. Since the bare-`var` conversion (see the next
entry, "Wire holders must be bare `var`"), every module in the repo is
standalone-importable, and a failure from such an import is a REAL regression
again. For scoring health checks still prefer `node tools/scoreboard.mjs`,
the entry point the runner actually uses.

## Wire holders must be bare `var` — browser module order is a RACE

The leaderboard's "browser load FAILED: Cannot access 'add_room_fn' before
initialization" was NOT fixed by hoisting declarations to the top of
sp_lev.js (the first attempt, which even "verified in a browser"). The truth:

  - index.html boots via Promise.all of FIVE parallel dynamic imports. Which
    import's traversal reaches the shared subgraph first decides the module
    evaluation order. That is a fetch-timing race: it varies run to run, and
    a clean load in YOUR browser proves nothing about the judge's load.
  - sp_lev.js and mklev.js sit in an import cycle (through other modules),
    so on the unlucky order mklev.js's body runs while sp_lev.js's body has
    not run at all. Then EVERY `let` in sp_lev.js is in its temporal dead
    zone regardless of position in the file, and mklev.js's top-level
    `sp_lev_wire(...)` call throws on the assignment.
  - Therefore: every holder assigned by a `*_wire*()` setter that is CALLED
    FROM A MODULE'S TOP LEVEL must be a bare `var` (no initializer). `var`
    exists from instantiation, so assignment is legal in every order; no
    initializer means the holder's own body evaluating later cannot clobber
    a value the wire already installed. Runtime-called wires (worm_wire,
    mon_wire_cham) and microtask-timed ones (sp_lev_wire_priest via dynamic
    import .then) are exempt — all sync evaluation is done by then.
  - Deterministic reproducer, no browser needed: import the cycle member
    that should evaluate LAST as the ENTRY. `node -e "import('./js/sp_lev.js')"`
    forces mklev.js's body to run first and threw `mon_fns` TDZ on the old
    tree. After touching imports or wires, run standalone imports of BOTH
    cycle sides; both must load.

Converted in this pass: add_room_fn/add_door_fn/somexy_fn/mktrap_fn/mon_fns/
okdoor_fn/create_subroom_fn/mklev_fns/walkfrom_fn (sp_lev.js), _topologize
(mkroom.js), stairway_at_fn/t_at_fn (dokick.js), mklev_mon (mklev.js),
mkmaze_mklev_fns (mkmaze.js), mklev_fn/ship_object_fn (do.js). Any NEW wire
must follow the same rule, and the reproducer above is the gate.

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

WHERE THE PASS STANDS: 172 -> 101 differing names.

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

## dup-defs pass: SEVEN real defects found, all invisible to the score

Updating the tally, because "deduplication" undersells what this found. Of
the 71 names cleared, seven were genuine behaviour differences:

    helpless        js/dog.js carried an extra (mfrozen > 0) term the C
                    macro lacks, in the live pet-movement path
    accessible      const.js's returned early on a missing location and
                    never tested closed_door
    is_armed        monmove's scanned mattk inline, dropping attacktype's
                    NATTK bound and null-entry skip -- throws where the
                    real one returns false
    blessorcurse    sp_lev's set the cursed/blessed FLAG where mkobj's
                    calls curse()/bless(), which do more. Same draws, so
                    the rng agreed and the object state did not.
    Has_contents    const.js's tested cobj != null, but cobj is initialised
                    to [], so every EMPTY container read as full
    In_endgame      makemon's compared the dungeon NAME to a string instead
                    of dnum to astral_level.dnum -- and it gates a draw at
                    js/makemon.js:486
    Is_stronghold   const.js's returned an && chain rather than a boolean

NONE of these moved the scoreboard. Five are dormant, two sit on paths no
public session takes. They would surface in held-out games, one at a time,
looking like bugs in whatever called them.

THE POINT FOR THE NEXT PASS: a duplicate is not a tidiness problem. Read
both bodies against the C before deleting either -- the wrong one is right
about half the time, and picking by which file looks more canonical would
have kept the broken version in three of these seven.

## align_gname: two versions, and which is right depends on role_init

Left unresolved deliberately -- it is the first dup-defs entry this pass
that could not be settled by reading the C alone.

    C, src/pray.c:2530   switch on alignment, returning gu.urole.lgod /
                         ngod / cgod, i.e. the HERO'S ROLE's gods
    js/questpgr.js       same shape, reads game.urole -- matches C
    js/insight.js        reads game.roles?.[game.pantheon] ?? game.urole,
                         indexing the role table BY PANTHEON first

C does not consult a pantheon here. But src/role.c's role_init() picks a
pantheon and can copy that pantheon's gods INTO gu.urole -- so insight's
version may be compensating for our role_init not doing that copy, in which
case deleting it would break god names.

TO SETTLE IT: check whether js/role.js's role_init writes lgod/ngod/cgod
into game.urole from the chosen pantheon. If it does, questpgr's version is
correct and insight's is redundant. If it does not, insight's is working
around a gap in role_init and the right fix is in role_init, not here.

RESOLVED, AND IT WAS NEITHER COPY. src/role.c:2079 copies the pantheon's
lgod/ngod/cgod into gu.urole, but ONLY when the role has none of its own --
Priest is the only such role. Our role_init picked a pantheon and never did
the copy.

So questpgr's version (reads game.urole, matches C) was right for every
role EXCEPT Priest, and insight's (indexes roles[pantheon] unconditionally)
was right ONLY for Priest. Both wrong, in complementary ways, because three
lines upstream were missing.

Ported those three lines into js/role.js, after which questpgr's is correct
for everything and insight's copy was removed as obsolete.

THE GENERAL LESSON, and it is the most useful thing this pass produced:
A DUPLICATE CAN BE A SYMPTOM OF A MISSING PORT, NOT A TIDINESS PROBLEM.
When two copies disagree and neither matches the C, do not pick one -- ask
why someone needed the second. Here the answer was a gap in role_init, and
deleting either copy first would have shipped a bug.

## can_saddle: makemon's copy tests ONE of C's seven conditions

A real defect, left in place because fixing it needs groundwork. C,
src/steed.c:26:

    strchr(steeds, ptr->mlet) && ptr->msize >= MZ_MEDIUM
    && (!humanoid(ptr) || ptr->mlet == S_CENTAUR) && !amorphous(ptr)
    && !noncorporeal(ptr) && !is_whirly(ptr) && !unsolid(ptr)

    js/steed.js    all seven -- matches C
    js/makemon.js  return mtmp.data.msize >= 2;   ONE of them

So makemon's answers true for a great many monsters C refuses to saddle.

WHY IT IS DORMANT: js/makemon.js:1525 is

    if (!rn2(100) && is_domestic(ptr) && can_saddle(mtmp))
        note_unported('put_saddle_on_mon');

The rn2(100) is evaluated FIRST, so the draw happens either way and the
stream is unaffected. The body only records. It becomes real the moment
put_saddle_on_mon is ported -- saddles would then appear on monsters C
leaves bare, and each saddle is an object, which moves every later draw.

WHY NOT JUST IMPORT steed.js's: js/steed.js imports js/mkobj.js, which
imports js/makemon.js, so makemon -> steed closes a cycle -- the same one
that blocked the findgold consolidation.

TO FIX, in order: MZ_MEDIUM is not in js/const.js (add it from
include/monst.h); the `steeds` list is a local const in js/steed.js and
should move to a shared home; amorphous, noncorporeal, is_whirly and
unsolid are all in js/mondata.js, which makemon already imports. Then
makemon's copy can be written to match C without any new edge.
## `in_rooms` in mklev.js is a stub, and un-stubbing it regresses

`js/mklev.js:431` defines `function in_rooms(x, y, rtype) { return []; }`. The
real one is `js/hack.js` (`src/hack.c:3498`). The only consumer is
`js/mklev.js:1487`, `const shdoor = in_rooms(x, y, 0).length > 0;` inside
`dosdoor`, so with the stub a shop door is never recognised during level
creation.

Repointing mklev at the real `in_rooms` is a one-line import and it **loses**
394 screens, 64k positional RNG and a whole session. Do not "fix" this by
deleting the stub -- that was tried and reverted.

The stub is therefore masking a bug somewhere else, not being lazy. In the C,
`dosdoor` runs during level generation and calls the real `in_rooms`, so the
faithful answer is not `[]`. The regression means `game.level.rooms` is not in
the state the C's `svr.rooms` is in at that moment: most likely the rooms exist
but are not yet typed/numbered the way `dosdoor` expects, so the real lookup
answers `true` where the C answers `false`. The fix is upstream, in when and how
`game.level.rooms` gets filled during `makelevel`, and only after that does
un-stubbing become correct.

Generalises: **an un-stubbing that regresses is a finding, not a failure.** It
localises the real defect to the data the stub was hiding. Record which stub and
what it cost, then leave the stub in place with a comment, because a stub that
is documented as wrong is honest, while a "fix" that drops 394 screens is not.

## `enexto()` is ported; wiring it into `create_monster` crashes on a null `pm`

`enexto()` (`src/teleport.c:196`) is now in `js/teleport.js`. It is a two-line
wrapper over the already-ported `enexto_core`, GP_CHECKSCARY first then
NO_MM_FLAGS, and the `||` short-circuits so a successful first pass never draws
the second. `goodpos` is threaded in as a parameter, matching what
`enexto_core` already does, because `js/makemon.js` owns `goodpos` and
importing it into teleport.js closes a cycle.

It is deliberately NOT yet wired into `create_monster` (`js/sp_lev.js:1179`,
`src/sp_lev.c:1977`). Wiring it does close the `create_monster:enexto` gap --
`generalize` stops reporting it -- but one of the 40 unseen games then dies with
`Cannot read properties of null (reading 'mlet')`.

Cause: `create_monster` leaves `pm` null for a random-monster spec, and C calls
`enexto(&cc, x, y, pm)` with that null. `enexto_core` builds a fake monster
whose `data` is that null, and `goodpos` then reads `mdat->mlet` **with no
guard at all** (`src/teleport.c`, the `else if (mdat->mlet == S_EEL ...)` arm).
So the C as written would dereference NULL too.

That contradiction is the open question, and it must be answered by reading,
not guessing. Either `create_monster` cannot actually reach the call with a null
`pm` (some earlier arm returns first), or `set_mon_data()` substitutes a real
permonst for NULL. Read `set_mon_data` and the `pm` assignment path in
`create_monster` before wiring. Do not paper over it with a null check in
`goodpos` -- the C has no such check, so inventing one is a divergence.

Wiring it needs three edits, all reverted here and easy to redo: add
`enexto: () => false` to the `mon_fns` table at `js/sp_lev.js:33`, bind
`enexto: (cc, xx, yy, mdat) => enexto(cc, xx, yy, mdat, goodpos)` in the
`sp_lev_wire_mon` call at `js/cmd.js:37` (which already imports `goodpos`), and
replace the `note_unported` at `js/sp_lev.js:1179` with
`if (mon_fns.m_at(x, y) && mon_fns.enexto(cc, x, y, pm)) x = cc.x, y = cc.y;`.

Generalises: **`generalize` catches crashes the scoreboard cannot.** This change
was exactly neutral on all 44 public sessions -- no screen or RNG delta at all --
while breaking a game on an unseen seed. A neutral scoreboard is not evidence
that a change is safe; run `tools/generalize.mjs` and read its thrown-error
counts, not just its unported list.

### Resolved: the null `pm` crash is a symptom, not an enexto bug

Answered by reading, per the open question above. Two facts settle it.

`include/extern.h:1860` declares
`extern void set_mon_data(struct monst *, struct permonst *) NONNULLARG12;`
-- **both** arguments are declared non-null. And `create_monster`
(`src/sp_lev.c:1925`) assigns `pm = (struct permonst *) 0` in four separate arms
(unknown id, extinct unique, `mkclass` failure, and the In_mines your_race
case). So reaching `enexto(&cc, x, y, pm)` with a null `pm` feeds a
declared-non-null parameter, and `goodpos` then dereferences `mdat->mlet` with
no guard. The C has no defined behaviour here at all.

Therefore the branch is unreachable in the real game, and neither answer I was
weighing was right: `set_mon_data` does not substitute anything, and there is no
guard to port. The reachability comes from the `&&` -- `enexto` runs only when
`MON_AT(x, y)` is already true. So a null `pm` AND an occupied target must
co-occur, and in the C they evidently never do.

Our port reaches it in 1 of 40 unseen games. That means something upstream
diverges: most likely `m_at` reports a monster where the C reports none, or the
`get_location_coord` spot differs, or a `pm`-nulling arm fires that should not
(the extinct-unique and `mkclass` arms both depend on state we may not track).
**Do not add a null guard.** The C has none, so a guard would hide the real
divergence and diverge from the C in the same motion.

Next step is to identify which of the 40 seeds crashes, then check at that call
whether `pm` should be null and whether the square is genuinely occupied.

This is the third time in this stretch that a gap turned out to mark an upstream
defect rather than missing work -- `in_rooms`, `align_gname`, now this. The
shape is worth naming: **when filling a recorded gap makes things worse, the gap
was load-bearing.** It was holding back a wrong value produced elsewhere. Chase
what feeds it before completing it.

## Behavioural tests of objnam helpers need `init_objects` first

Importing `js/objects_data.js` and reading `OBJ_NAME(ocl)` / `OBJ_DESCR(ocl)`
straight out of a bare `node -e` gives `"strange object"` and `0` for every
object, because `oc_name_idx` and `oc_descr_idx` are assigned at game start by
`init_objects` (which also shuffles the randomised appearances). They are not
in the generated table.

So a bare-import test of anything that reads an object's name or description
answers as if nothing is identified and nothing has a description. That is not
the function being wrong. `boots_simple_name(LOW_BOOTS)` returning `"boots"` in
such a test looks like a bug -- the C data at `include/objects.h:700` is
`BOOTS("low boots", "walking shoes", ...)`, so a real game answers `"shoes"` --
but it is the harness, not the port.

Either call `init_objects` in the test, or test only the arms that do not depend
on discovery state. When a bare-import test disagrees with the C data table,
suspect this before suspecting the port.

Related: `OBJ_DESCR` returns the literal `0` from the table for an object with
no description, matching C's NULL. `strstri(0, sub)` does not throw in our port
-- `(0).length` is undefined, `undefined - n` is NaN, `NaN < 0` is false, and
`i <= NaN` never runs, so it returns -1. The C would dereference NULL and crash.
The divergence is benign, and deliberately not "fixed": every real caller passes
a real description, and porting a crash buys nothing.

## `is_crackable` / `is_rustprone` / `is_weptool` are duplicated ON PURPOSE

`js/mkobj.js` keeps its own copies of several `include/objclass.h` predicates
with an extra parameter: `is_crackable(o, objs)`, `is_rustprone(o, objs)`,
`is_weptool(o, objs)`. `js/obj.js` has the same predicates in the normal
one-argument form reading `game.objects`.

`dup-defs` flags these, and they look like tidy-up bait. They are not. Two
reasons, both load-bearing:

1. **Different tables.** `js/mkobj.js:660` passes the raw generated `objects`
   table, not `game.objects`. `game.objects` is the live copy that runtime
   mutates (`oc_name_known` and friends). They agree on `oc_material` because
   material never changes, which is why nothing has broken, but the two names
   do not denote the same object and collapsing them assumes they do.
2. **A real cycle.** `js/mkobj.js:35` records that `js/invent.js` imports
   `erosion_matters()` from mkobj, so that edge already closes a loop. The
   parameter injection is how this file avoids adding more.

Verified while porting `is_crackable` into `js/obj.js` for `hard_helmet`:
mkobj's copy is CORRECT, carrying both the GLASS material test and the
`oclass == ARMOR_CLASS` test the C requires. So this is the rarer case where
both copies are right and the duplication is the design.

Leave them. If a future pass wants to collapse them, the prerequisite is
proving `objects` and `game.objects` are interchangeable at every mkobj call
site, not just at the one that happens to be in front of you.

## `setworn()` is ported but NEVER CALLED, so the whole worn-gear chain is dead

Found while porting `fingers_or_gloves`, which reads `uarmg`. The chain that is
supposed to make worn gear real has a broken first link.

`js/u_init.js:535` does `obj.owornmask = slot;` for starting armor. The C
(`src/u_init.c:1262-1281`) calls `setworn(obj, W_ARMS)` and friends instead.
Those are not the same thing. `setworn()` does THREE things:

1. sets `obj->owornmask`  -- the only one we do
2. sets `*(wp->w_obj) = obj`, i.e. `uarm = obj`, `uarmg = obj`, ...
3. ORs in the extrinsic property bits for what the item confers

So `game.u.uarm` / `uarmg` / `uarmc` and the rest are **never assigned**, and no
starting item ever confers its extrinsic. `grep -rn "setworn(" js/` outside
`js/worn.js` itself returns nothing: the function is ported and unreachable.

Downstream, `set_wear()` (`js/do_wear.js:137`, called from `js/allmain.js:306`
every new game) tests each slot and calls the matching `<X>_on()`. Every test
reads an unset field, so it is a silent no-op and no `_on` callback has ever
fired. That is why fixing `set_wear`'s field names (below) moved nothing.

**Separately fixed here:** `set_wear` was reading bare `game.uarm` / `game.uarmg`
etc, 22 of them, where `js/worn.js:423` writes `game.u[wp.w_obj]`. Those reads
could never have worked even once the chain is connected. There are ~15 more
bare `game.uXXX` reads elsewhere in `js/`; `js/do_wear.js:275-282` shows the
correct `game.u.uarmg` form, so the file is internally inconsistent. Same defect
class as the `game.uwep` entry above.

**Next step, and it is a big one:** make `js/u_init.js` call `setworn()`. That
turns on extrinsics at game start for every role, which will move RNG. Measure
it on its own commit, not folded into anything else. Note `js/u_init.js:44-45`
also redefines W_ARM..W_ARMU locally; the values match `js/const.js:2224-2230`,
so it is a harmless duplicate, but import them rather than keeping a second copy.

## The artilist terminator is the STRING "0", so C loop conditions do not port

`js/artilist_records.js` is generated from `include/artilist.h` and keeps the
C's sentinel row at index 35, but the generator emits its fields as the string
`"0"`, not numeric zero.

The C iterates artifacts as `for (a = artilist + 1; a->otyp; a++)`. Transcribed
literally that becomes `while (artilist[i].typ)`, and `"0"` is TRUTHY in JS, so
the loop runs one row past the end and reads a row whose `nam` is the string
`"0"`. It does not throw; it just silently considers a junk artifact named "0".

Ported `artifact_name()` uses `artilist[i].typ !== "0"` plus a length bound.
Any future artilist walk must do the same. The clean fix would be to make
`tools/gen-artifacts.mjs` emit a real 0 (or drop the sentinel row and rely on
array length), but changing the generated shape means re-checking every existing
reader, so it is recorded here rather than done in passing.

Generalises: **C sentinel-terminated arrays are a porting hazard in JS.** Any
`for (p = table; p->field; p++)` needs its terminator checked in the generated
data before the condition is transcribed. Truthiness differs: 0 is falsy, "0"
is not, and neither is an empty object.

## async contagion from pline() hits a sync callback boundary at getobj

`js/pline.js`'s message helpers are async. Everything that can emit a message
inherits that, so `canwearobj()` is async, and so is `accessory_or_armor_on()`.
That is fine while the chain is all our own code.

It stops being fine at `equip_ok()` (`src/do_wear.c:3404`). `equip_ok` calls
`canwearobj(obj, &dummymask, FALSE)` and is itself the shared body of the four
getobj callbacks `wear_ok` / `takeoff_ok` / `puton_ok` / `remove_ok`. In our
port `js/invent.js:131 getobj_letters()` is SYNCHRONOUS and calls
`obj_ok(null)` directly, comparing the result against the `GETOBJ_*` constants.

An async `equip_ok` returns a Promise there. A Promise is truthy and equals none
of the constants, so every letter-filtering decision silently takes the wrong
branch. Nothing throws. This is precisely the class of bug that looks fine in
review and diverges at runtime.

**Do not port `equip_ok` until this is resolved.** Two honest options:

1. Make `getobj_letters` (and its callers) async and await the callback. This is
   the structurally correct fix and matches what the C does semantically, but it
   touches working code on the `getobj` path, so it needs its own measured
   commit.
2. Give `canwearobj` a sync core with the messages hoisted to the caller. This
   diverges from the C's shape and would cost architecture points in Phase 2.

Option 1 is the right one. Note the C has no such problem because `pline()` is
an ordinary function there; the asynchrony is an artifact of our terminal layer,
which means it is OUR constraint to absorb, not a property of NetHack.

Generalises: **when a leaf helper becomes async in this port, walk its callers up
to the nearest boundary that is called from sync code.** The compiler will not
tell you; `node --check` passes and the module loads clean.

## `FIRST_OBJECT` is 18, not 1, and `discover_object` had it wrong

`js/o_init.js discover_object()` guarded with `if (oindx < 1) /* FIRST_OBJECT */`.
The C (`src/o_init.c:460`) is `if (oindx < FIRST_OBJECT) /* don't discover
generic objects */`, and `FIRST_OBJECT` is `LAST_GENERIC + 1` = **18**
(`include/objects.h:108`), not 1.

So the JS skipped only STRANGE_OBJECT and happily "discovered" all 17 generic
objects, which the C deliberately excludes. `include/display.h:184` states the
intent outright: random_object "won't return STRANGE_OBJECT or the generic
objects".

The value lives in `ONAMES.FIRST_OBJECT` (generated `js/objects_data.js`), NOT
in `js/const.js` -- importing it from const.js fails at load with "does not
provide an export named 'FIRST_OBJECT'". Worth knowing before reaching for it.

Fixing it moved nothing on the board, which is expected: discovering a generic
object is mostly invisible until something prints its name.

Also found while there: `discover_object` is missing the C's third condition,
`|| (Role_if(PM_SAMURAI) && Japanese_item_name(oindx, NULL))`. That arm only
ADDS discoveries, so its absence is a silent under-discovery for Samurai only.
Recorded as `discover_object:Japanese_item_name`.

Generalises: **a comment naming a C constant is not evidence the value matches.**
`/* FIRST_OBJECT */` next to a literal `1` reads as documentation and was
actually a wrong-value bug. Check the constant's real value whenever a literal
is annotated with its name.

## `note_unported` markers double as placeholders for functions ported elsewhere

Three times in one session a marker turned out to be standing in for a function
that had just been ported into a different file, with nothing linking the two:

- `js/cmd.js` had `note_unported_cmd('equip_ok:canwearobj')` while
  `canwearobj` was landed in `js/do_wear.js`. cmd.js also had its own private
  copy of `equip_ok` and all four getobj callbacks.
- `js/do_wear.js set_wear()` had `note_unported_do_wear('set_wear:Blindf_on')`
  while `Blindf_on` was being written 1200 lines below it in the same file.
- The same `set_wear` had `set_wear:Ring_on:right` / `:left` while `Ring_on`
  landed in that same file.

Nothing errors. The marker keeps answering, the real function sits unused, and
`generalize`'s reached-but-unported list still shows the gap, so it reads as
"not done yet" when it is done.

**Habit: after porting a function, `grep -rn "<name>" js/ | grep note_unported`
before moving on.** It costs one command. All three of these were found by
accident -- looking for something else -- which means others are probably still
sitting there.

A cheap tooling improvement would be for `tools/unported-hits.mjs` to flag any
marker whose text contains the name of an exported function; not done yet.

## Import injection needs to dedupe, every time

Appending a binding to an existing `import { ... } from './x.js'` line without
checking whether it is already present produces
`SyntaxError: Identifier 'X' has already been declared`. This bit three times
(`W_AMUL`, then `LEVITATION`/`W_RING`/`FROMOUTSIDE`). It is caught instantly by
`node --check`, so it costs a round-trip, not correctness -- but the fix is to
dedupe the binding list on every injection, including across separate import
statements from different modules.

### CORRECTION: the uwep "hang" is a 100x SLOWDOWN, not an infinite loop

Re-investigated the entry above. Its diagnosis ("something loops forever",
"the remaining bug is a missing give-up") is **wrong**, and the wrong model is
why the lead went cold.

Measured, single session, `js/wield.js`'s three reads pointed at `game.u.uwep`:

    WITHOUT the fix   0.4 s
    WITH the fix     45.0 s

It TERMINATES. There is no infinite loop and no missing give-up to find. It is
a ~100x slowdown, and seed0361 only "hangs" because `frozen/score.sh` runs
sessions in PARALLEL and 45 s of CPU under that load exceeds the 120 s worker
timeout. Run alone it finishes every time -- I ran it three times in a row.

That also explains the confusing symptom in the original entry: total steps
falling 11405 -> 11039 is not a crash, it is seed0361 being dropped for
timing out. Re-measured today and it reproduces exactly: 11039 steps,
488 screens (-24), and the session vanishes from the board.

**What this changes for whoever picks it up:** stop looking for a loop with a
missing exit. Look for something QUADRATIC that only runs once `welded()` starts
returning 1. `welded()` itself is not the hot path -- instrumenting it with a
20000-call trip wire never fired. The cost is downstream of welded going live,
most likely in a caller that now takes a path it never took before and rescans
inventory or the level per item.

Profiling notes for the next attempt:
- `frozen/ps_test_runner.mjs` swallows the child's stderr, so `console.error`
  from inside the game never appears. Use `--worker-session=<path>` to run one
  session in-process instead.
- `js/` files are ES modules, so `require('node:fs')` inside them silently
  throws; a try/catch around it will hide your instrumentation entirely.
- `node --cpu-prof --cpu-prof-dir=... frozen/ps_test_runner.mjs
  --worker-session=...` is the right shape but did not finish inside 10
  minutes under profiling overhead; budget for that or sample instead.

The fix itself is READY and correct -- it is three `game.uwep` -> `game.u.uwep`
replacements. Do not land it until the slowdown is understood, because it costs
a whole session on the board.

## THE JUDGE TIMED US OUT (900s) — and neither local gate could see it

Mon 27 Jul 2026 20:50 UTC the leaderboard showed:

    Latest scoring run failed
    The judge could not score this fork: timeout (900s)
    FAIL: seed0209-tourist-mail-daemon   (held-out)
    FAIL: seed0300-barb-mixed-bumps      (held-out)
    FAIL: seed0341-archeologist-gnome-fullmoon (held-out)
    FAIL: seed0360-wizard-world-tour     (public)
    FAIL: se...
    Scores shown are from the last successful run (Sun 26 Jul 16:24 UTC).

Those four COMPLETED with metrics, so the run died on a session shortly after
seed0360 -- alphabetically seed0361, the session with the known --More-- hang.

**The judge scores 88 sessions (44 public + 44 held-out) under ONE 900s budget.
A single blocked session eats the whole thing and the fork goes unscored.** The
displayed points freeze at the last good run, so the cost is every improvement
since then, not one session.

WHY BOTH LOCAL GATES ARE BLIND TO IT, and this is the important part:
  - `frozen/score.sh` runs only the 44 PUBLIC sessions.
  - Under `frozen/ps_test_runner.mjs`, `js/input.js:20 nhgetch()` THROWS
    "Input queue empty" when the queue drains.
  - Under the judge's `frozen/playability_runner.mjs:108`, `game.nhDisplay` is a
    `js/terminal.js` which HAS `readKey()`, so nhgetch falls through to
    `await display.readKey(...)` and BLOCKS instead of throwing.
  - `tools/generalize.mjs` hits the throw path too. Its cheerful
    "40 of 40 games threw: Input queue empty" is the SAME over-read that hangs
    the judge, reported as benign. I read that line as healthy all session.

**`tools/hang-gate.mjs` now closes this.** It runs each session with a wall
budget and fails on a block. Validated: it correctly flags seed0361 when the
uwep change is applied (exit 1), and passes all 44 clean otherwise. ~16s for
the full set. Run it before every push that adds message output.

WHAT CAUSED IT: this session wired up many dormant message paths at once (all
seven `<X>_on` handlers via set_wear, on_msg, Ring_on, Blindf_on,
toggle_stealth, encumber_msg). Reverted in 655e765 -- the ported FUNCTIONS are
kept, only the calls that can emit a top-line message went back behind their
markers. Re-land them ONE AT A TIME with the hang gate green.

GENERALISES: **an over-read is a divergence, not a stall.** The session's key
list is exactly what C consumed. Needing one more key means we printed a prompt
C did not print. Treat every hang as a wrong-output bug with a specific cause.

## The biggest single divergence cause is dog_move: 7 of 30 sessions

`node tools/diverge.mjs --all` ranks the first-divergence site across sessions:

    dog_move(dogmove.c:1255)          7   <-- biggest single cause
    obj_resists(zap.c:1469)           3
    do_attack(uhitm.c:474)            3
    distfleeck(monmove.c:538)         3
    getbones(bones.c:645)             3
    next_ident(mkobj.c:521)           2
    mount_steed(steed.c:341)          2
    rnd_otyp_by_namedesc(objnam.c:3522) 2

Fixing dog_move would move more sessions than anything else on the list. Run
that tool before picking a target -- it is far better aimed than the
reached-but-unported list, which ranks by REACH not by cost.

**The dog_move symptom, precisely.** On seed0105 at call 2479:

    C     rn2(1)=0      @ dog_move(dogmove.c:1255)
    ours  rn2(100)=81   @ dog_move(dogmove.c:1255)

`dogmove.c:1255` is `if ((j == 0 && !rn2(++chcnt)) || ...)`, and chcnt starts
at 0, so C's first call there is `rn2(1)`. Our line (`js/dog.js:1244`) is
correct. The `rn2(100)` is an obj_resists from `dogfood()` -- **we call dogfood
one more time than C does** before reaching the chcnt draw.

Checked and NOT the cause:
- the condition ORDER matches C exactly: `if (obj.cursed) {...} else if
  (can_reach_food) { dogfood(...) }`, so a cursed object never calls dogfood
  and can_reach_food short-circuits ahead of it.
- `js/dog.js:1244` really is `!rn2(++chcnt)`.

TRIED AND REVERTED: `objects_at()` (`js/dog.js:1321`) filters the flat level
list by ox/oy only, while C's `svl.level.objects[x][y]` chain holds FLOOR
objects only, and `js/monmove.js:470` does test `where === OBJ_FLOOR`. Adding
that filter looked obviously right and **lost 58 screens and dropped whole
sessions** (total steps 11405 -> 10206).

RESOLVED (28 Jul): the filter failed because `place_object` never SET
`where` -- every floor object carried `where === undefined`, so the
OBJ_FLOOR test matched nothing and emptied every pile. place_object now
stamps OBJ_FLOOR (and mpickobj stamps OBJ_MINVENT/ocarry, both landed with
js/steal.js), so the data is trustworthy and the filter is worth retrying
when a divergence points at pile contents again.

Next thing to check: whether `objects_at` returns the pile in the same ORDER as
the ->nexthere chain. place_object prepends, so a filtered flat list is
newest-first only if nothing ever reorders it. An order difference would spend
the same NUMBER of draws in a different sequence -- which is not this symptom --
so more likely there is genuinely one extra object in our pile.


## The reference pipeline is LOSSY about attrs on spaces; the frozen serializer more so

Two distinct effects, discovered on seed0016's spell menu header
("    Name                 Level Category     Fail Retention", ATR_INVERSE):

1. The RECORDINGS re-serialize each row and emit runs of >= 5 blank cells
   as ESC[nC cursor-forward even INSIDE an SGR span. The scorer's
   normalizeScreen() turns ESC[nC back into literal spaces decoded under
   the ACTIVE SGR state, so what survives depends on where the run sat.
   Practical rule mirrored in process_menu_window: runs of 5+ spaces
   inside an attributed menu line paint attr-0; runs of <= 4 keep the
   attribute.

2. Our frames go through frozen terminal.js serialize(), which picks each
   row's firstCol by `ch !== ' '` IGNORING attrs, so leading attributed
   spaces are swallowed into the initial ESC[nC and decode plain. The C
   recording paints the header's 4 leading inverse spaces (they follow
   ESC[7m literally). A menu header that begins with spaces at the row's
   left edge therefore loses those attr cells NO MATTER WHAT WE PAINT.
   seed0016 step 26 stays 4 cells short (35/36) for exactly this reason.
   Do not chase such a screen; check the raw recorded row (session JSON)
   for "ESC[7m<spaces>" at line start to recognize the class.

## tools/diverge.mjs --all is the first-divergence instrument

`node tools/diverge.mjs --all` prints, per session, the RNG match count and
`div@<index>` with the C annotation of the first differing draw, plus a count
of sessions matching end to end. That is the correct way to judge any change
that shifts the RNG rather than growing it.

**Judge an RNG-affecting change by whether div@ moves LATER, not by the total
matched count.** The total can fall while the port gets more correct, because
fixing an early divergence exposes a later one that was previously unreachable
(iter 79: RNG -10, screens +47). Conversely a total can rise from coincidental
post-wall alignment, which `normalizeRng` cannot distinguish.

Baseline at commit 90e3dd9 (board 2249, 7 passes): 11/44 sessions match end to
end. Save `node tools/diverge.mjs --all > before.txt` before an experiment and
diff the div@ column after.

## The hero's worn-slot pointer fields are real now; game.uwep-style reads are bugs

Since the worn[] table landed in js/worn.js, setworn() maintains all sixteen
hero slot fields as `game.u.<name>` (uwep, uarm, uleft, ublindf, ...), matching
where the C keeps its globals in this port. Before that, fourteen of them were
never written and reads of them were silent undefineds — welded() returned 0
forever because it compared `game.uwep`, which no code ever set. Two rules
follow. New code reads slots as `game.u.<field>` (or worn(mask) where the C
scans); any surviving bare `game.uwep`/`game.uarm*` read found in review is a
bug to fix, not a convention to copy. And uprops entries written by setworn
hold C's extrinsic W_* mask as the value (deleted at zero), so truthiness
reads keep working but `=== 1` comparisons would not; none exist today, keep
it that way.

Two shape traps found while wiring this, both crashed sessions at startup:
js/drawing_data.js def_oc_syms is an array of symbol CHARS, not C's
{sym,name,explain} structs — the name column now lives as def_oc_syms_name in
js/weapon.js; and src/allmain.c:453's find_ac() is ONCE PER PLAYER INPUT in
the moveloop, not a preamble one-shot — misreading it as preamble-only cost
seed5006 66 screens (stale AC after multi-turn dressing) because the deleted
reduced-setworn had been calling find_ac on every wear as a side effect.

## Screen col = map x MINUS ONE, and walls have MODES the skeleton dropped

Two lessons from the seed0030 "one-step-early wall reveal" hunt, which
burned three sessions on the wrong suspect because of the first one.

Coordinates: a session screen's row r, col c holds map cell (x = c + 1,
y = r - 1). The hero glyph at screen col 63 is standing at map x 64. An
earlier STATUS entry recorded "terminal col = map x", and every probe
built on it read the wrong column: the "mystery" cells at (64,9)/(64,11)
were really (65,9)/(65,11), the room's doorway column. When a probe's
world model and the screen disagree by exactly one column, check this
before inventing a stale-write theory. The `` ` `` glyph on a room floor
is an ENGRAVING (5.0's S_engroom), not a boulder; boulders are ROCK_CLASS
backticks too, so look at the typ/object dump, not the glyph.

Wall display: C walls are NOT "seenv ? glyph : blank". set_wall_state()
(display.c:3329) stamps a WM_* mode into every wall square's wall_info at
mklev time, and wall_angle() (display.c:3513) intersects the square's
seenv with a per-mode mask to decide vwall/hwall/corner/tee/crosswall OR
S_stone = draw nothing. A room's boundary wall seen only from the outside
diagonal fails its mask and stays invisible until the hero gets a proper
angle on it. The skeleton shipped set_wall_state as a no-op and a
mode-0-only wall_glyph, which over-reveals walls one step early all over
the dungeon — it was the head of the 11-session movement cluster's screen
divergence. If a wall appears in ours and not in C with identical
geometry, suspect the MODE, not the vision scans: the scans (COULD_SEE,
IN_SIGHT via nv range 1) matched C the whole time.

## The wish flow (readobjnam/makewish) and what its port surfaced

The wizard-mode wish is fully ported: js/objnam.js mirrors the C's six-phase
shape (readobjnam_init/preparse/parse_charges/postparse1/2/3 + readobjnam)
and js/zap.js makewish carries the MAXWISHTRY retry loop, wishcmdassist, and
the hold_another_object tail. mondrift-objects passes 2308/2308 RNG and
41/41 screens on the back of it. Things the next agent should not rediscover:

- **A recorded --More-- eats every key that is not space/\r/ESC.** In
  mondrift-objects the recipe's "d%\r" (a drop) never dropped anything in C:
  the wish's "You learn more about your items by comparing them.--More--"
  swallowed 'd' and '%', and '\r' just dismissed it. Later the dog stepped
  on a squeaky board mid-turn, the You_hear forced a More, and C then ate
  FIFTEEN keys (steps 24-38) before the recipe's ESC dismissed it — with the
  turn's remaining 8 draws (mcalcmove etc.) landing on the ESC's step. When
  a generated session's rng-per-step counts show a run of zeros, look for an
  unacknowledged More, not a hang.

- **merged() (js/invent.js) returns 1|0 normally but a Promise resolving to
  1 when its discovery pline must print.** The message is gated on
  otmp.where == OBJ_INVENT, so the sync callers (stackobj on floor piles,
  mpickobj/steal on minvent) can never receive the promise; addinv can, and
  returns `r.then(() => otmp)` which its async callers await. Do not "fix"
  merged to be uniformly async — steal.js and mkobj.js call it from sync
  code and a bare Promise is truthy, which would turn every failed merge
  into a phantom success there.

- **wish_history / wish_history_menu are #ifdef DEBUG and the contest build
  does not define DEBUG** (include/config.h never sets it), so the history
  list stays empty and ^W always goes straight to getlin. The js port keeps
  the empty array and a no-op wish_history_add to mirror that.

- **js/artilist_data.js now also carries artifact_otyps** (second A() field,
  scraped by tools/gen-artifacts.mjs) and js/artifact.js holds the wish
  slice of artifact.c: artifact_name, exist_artifact, artifact_exists,
  artifact_origin, nartifact_exist, permapoisoned, with creation state in
  game.artiexist. mkobj.js's old `nartifact_exist() { return 0; }` stub is
  gone — mksobj's `rn2(20 + 10 * nartifact_exist())` shifts once a wish
  (e.g. seed0108's Mjollnir) creates an artifact, as in C.

- **const.js ONAME_* flags were 3.6 values; 5.0 reserves 0x0001 for
  'exists'** and starts ONAME_VIA_NAMING at 0x0002 (hack.h:1271). Fixed —
  anything comparing raw ONAME literals against these must use the consts.

- prinv(prefix, obj, quan) now honors C's partial-stack form: quan <
  obj->quan drops the trailing period and appends " (N in total)." only
  under flags.verbose — wiz_wish runs with verbose off, which is why the
  recorded wish line is "d - 3 uncursed food rations" with no period.

## petdrift narrows the dog family to a masked pre-head window (23 Aug)

tools/petdrift.mjs (recorded-screen ground truth, hero-@-gated, two-miss
persistence filter) clears seed0012's dog through step 117; at the head
(draw 7227, step 118) OUR dog is adjacent to the hero (udist 1 -> the
dogmove.c:586 invent scan draws rn2(100) per carried item) while C's dog
is >1 away (the follow block short-circuits on !IS_ROOM or distance and
draws nothing). dogfood classification, hungrytime, and the floor-chain
scan were all verified equal first (dogfood(GOLD_PIECE)=APPORT both).
So the position split happens within a few turns before the head, in a
window where every draw matches by argument AND value. Next tool: log
each dog_move's chosen (nix,niy) alongside the mfndpos candidate list
and replay C's recorded candidate-loop draws through OUR candidate list
to find the first turn where the same draws select a different square
(candidate ORDER or COUNT drift, most likely from mfndpos gates).

## The recorder is INSTRUMENTABLE — printf in C beats black-box inference (24 Aug)

The masked-divergence debugging pattern changed. The recorder build at
nethack-c/recorder is our own; a temporary fprintf(stderr,...) in any C
function, `make nethack` in recorder/src (then cp the binary over
recorder/install/games/lib/nethackdir/nethack — there is no install
target), and a throwaway recipe distilled from the shipped session
(seed/datetime/nethackrc/moves concatenated from its steps) prints the
C-side truth for exactly the frames we replay. record.mjs passes stderr
through, so the debug lines interleave with its progress output and
never touch the session JSON. REVERT the C edits and rebuild+reinstall
afterwards; the judge never sees this tree but a dirty recorder would
poison future generated sessions with un-shippable state.

This settled seed1500 in one shot after hours of state-diff guesswork:
PICKDBG in pick_lock showed oldglyph 3992 -> 3993 (S_room -> S_darkroom),
which no amount of our-side probing could reveal because the whole
difference lived in C's memory-glyph identity.

Use it next on the masked dog-goal family: DRKDBG-style prints in
dogmove.c dog_goal/dog_move (goal, candidate list, chosen square) lined
up against our __dog_trace output (globalThis.__dog_trace = true).

## dark_room defaults ON in 5.0, and S_darkroom is a wire-invisible IDENTITY

optlist.h:264: dark_room is opt_out On in 5.0 (3.6 had it off). Three
consequences, all invisible on screen and all real in memory:

- newsym's out-of-sight branch converts remembered S_room floors to
  S_darkroom (even waslit ones, because the condition is
  `!waslit || (dark_room && use_color)`), and feel_location's
  dark-if-unlit tail does the same for FELT floors.
- assign_graphics copies S_room's SYMBOL into S_darkroom's slot
  (display.c:1851), so it renders as the same middle dot (0xfe) under
  DECgraphics and '.' under the plain set; its defsym colour CLR_BLACK
  goes through the same hilites collapse as gray (termcap.js), so the
  serialized cell is identical to a plain floor.
- The identity surfaces wherever C COMPARES memory glyphs. pick_lock's
  "did the hero learn anything" test is one: applying a lock pick at a
  plain floor square rewrites S_room->S_darkroom, the compare says the
  hero learned something, and the attempt consumes a turn. seed1500's
  entire divergence was that one turn of timing.

Related: seed0104 has NO symset line in its rc — it is a plain-ASCII
session ('-','|','.') and passes because the paint path resolves through
showsym() per rc. Do not assume every session is DECgraphics.

## CLR_BLACK collapses to the default foreground (termcap.js)

The recorder build renders CLR_BLACK cells (carnivorous ape, vampire
bat, raven, S_darkroom) with no distinguishing escape the serializer
keeps — recorded cells read as uncoloured. term_start_color folds
CLR_BLACK into the same NO_COLOR collapse as CLR_GRAY. Verified on
seed0373's 'Y' and 'B' monsters and the S_darkroom floors.

## The held-out number is the signal; the supplemental count is not (1 Sep)

Between 27 Aug and 1 Sep the generated corpus went from 75 to 326 recipes
(coverage matrix "98/106 covered, 0 gaps") and the held-out score did not
move by a single point: 6,032/11,265, 9/44, rank 3, while the top fork sits
at 11,264/11,265. A hand-written coverage tag says a scenario was thought
of; it says nothing about the thousands of branches nobody thought of.
`node tools/leaderboard.mjs` after every push, and treat a flat held-out
number as a failed experiment regardless of the local dashboards.

## rng-sites.mjs: coverage measured from the C source, not from tags

Every recorded draw carries `@ fn(file:line)`. Grepping the RNG call sites
out of `src/*.c` and subtracting the tags seen anywhere in sessions/ plus
generated/ gives the exact set of RNG-drawing branches no oracle has ever
exercised: 1,231 of 2,621 sites, 346 of 865 functions, 133 of them already
defined in js/ and therefore ported with no way to check them. Traps met
while building it: a call that spans lines is tagged with the line of its
closing paren (clang's `__LINE__` in a macro argument), so the join walks
back up to six lines; `rn1()`, `ROLL_FROM()` and `AC_VALUE()` are hack.h
macros over rn2/rnd; line numbers must come from the recorder-patched tree
(`nethack-c/recorder/src`), not upstream, or 22 sites go stray. The corpus
scan is cached by mtime under `tools/gen-sessions/.cache/`.

## Compiler branch coverage observes deterministic code (5 Sep)

`tools/c-branch-coverage.mjs` copies the built recorder into `.cache/`, removes
the copied game objects, and rebuilds with Clang's `-fprofile-instr-generate
-fcoverage-mapping`. Darwin's `LLVM_PROFILE_FILE=%p%c.profraw` mode is required:
the driver kills the game at its final input, so exit-only profiles lose the
counters. Each segment gets a separate profile; only recordings matching every
key, RNG entry, screen, cursor, and animation frame are merged. The ordinary
recorder is untouched. Process startup and shutdown are also measured.

Use `llvm-cov export --skip-expansions`; exporting nested expansion regions
produced 576 MB for this program, exceeding Node's maximum string length.
Skipping expansion regions reduces it to about 30 MB while retaining function
branch tuples. The concise census selects branch tuples whose file ID is zero,
so macro-internal conditions are kept in the raw export but excluded from the
direct-C denominator. Inspect reachability before pursuing 100%: the
`cant_wield_corpse()` non-corpse guard is unreachable from its guarded callers.

The initial public-plus-supplemental scan reaches 48.44% of direct C outcomes.
The first useful gap was a corpse-wielding function with no RNG calls and a JS
placeholder. The resulting six-case oracle now covers the state and message
effects and passes exactly. See `gameplay-gap-audit.md` for the full evidence.
One canonical options-help screen contains the original user's local path and
fails even an ordinary C re-recording; its profile is deliberately excluded.

When combining runs, use the full LLVM branch tuples and verify their order
and structural fields within each function. Line/column alone is not a unique
branch identifier. Collapsing missing outcomes to a set of source coordinates
overstates coverage because several compiled branches can share a coordinate.

The inventory continuation found a lit-candle merger which matched every
screen and RNG entry but retained an orphan light and the wrong surviving
radius. C removes the old source, then recomputes the combined stack's radius.
`inventory-adjust-state-gate.mjs` checks the actual light, timer and equipment
references. Omitting the cleanup in an isolated runtime makes that gate fail.
Source-backed state checks can expose defects before a visible frame changes.

The naming follow-up found two representation boundaries that the state gate
must preserve. `ONAME` and `has_oname` must access `obj.oname`, where this port
stores names, rather than C's `obj.oextra.oname`. `strstri` returns an index
or -1 here, so C's `!strstri(...)` becomes `strstri(...) < 0`. The literal C
condition silently omitted articles in `killer_xname`. The new name state gate
checks full stored names and restoration after temporary death-name formatting;
the C terminal row truncates a 62-character name to 59 visible characters.
Do not treat the visible truncation as the object's persisted name length.

The next merger check found a second light-ownership trap. `obfree(obj, merge)`
can replace the surviving object's ID to preserve a higher unidentified-item
price. C light records retain an object pointer, but JS light records retain the
ID number. Retarget them before changing the ID; timers already store the object
itself. The two price-order controls in `inventory-merge-state-gate.mjs` failed
before this fix despite all eight new shop C recordings matching. `vision.h`
defines light source tags as none=0, object=1, monster=2. The old shared constants
were 0/1 while `light.js` had a separate correct enum; it now re-exports the
corrected shared values. This prompted the compiled constant audit in STATUS.

The reusable `tools/c-constant-audit.mjs` found 45 different shared integer
definitions, plus the intentional signed `NOGARLIC` representation, among 1,661
names comparable with the configured C headers. Correct local copies masked
some drift in ordinary gameplay. Compile the actual expressions rather than
evaluating C text as JavaScript. Runtime expressions, function-like macros and
unavailable names must be rejected with reasons; header errors must abort even
when all requested symbols also produce errors. A fault-injection test caught
that false-success case in the first tool implementation. Unsigned constants
above INT64_MAX also need unsigned printing, not a cast to signed long long.
The final audit compares 1,666 names after adding five missing enum entries;
267 rejected names and all noninteger definitions remain outside its credit.

Repeatedly fixing failures in a random-play batch makes that batch regression
coverage. Fresh seeds alone also do not remove the public trigram model's
input-distribution bias. Record first-run results on a fresh batch before
inspecting failures, then replace it as an evaluation set after using it to
edit code. The historical fuzz measurements below predate this distinction.

## fuzz.mjs: random-play evaluation with an oracle attached

The recorder runs a 217-key, four-segment session in under a second, so
random-play sessions are cheap. Keys are sampled from a trigram model of
the PUBLIC sessions' inputs (the judges' command idioms), never their
outputs, with varied seeds and datetimes. This still samples the public input
distribution. The historical first run had 16/42 sessions and 64% screens,
against 9/44 and 53% on the board; that comparison does not establish a reliable
held-out estimator. First divergences provide a debugging work list. Three
things learned running it:

  - Split the input model by rc style, including whether the legacy intro
    is on: a stream sampled from `!legacy` sessions spends every key
    ringing the bell at the intro's --More-- (C swallows them too, so the
    recording is 26 identical screens), and an over-read that happens
    inside `NethackGame.start()` throws outside runSegment's loop and
    loses EVERY screen of the session, not just the tail.
  - The runner's matched-RNG count moves while the head does not: s2-06
    went 3018 -> 3084 "matched" after a fix that changed nothing at the
    head. Only `diverge.mjs`'s first MISMATCH line is evidence (NOTES
    already says this; the fuzz loop makes it bite every ten minutes).
  - `tools/jsplay.mjs --rng-at N` is the missing half of diverge.mjs: when
    ours draws something C never drew, it prints OUR stack for draw N.
    Do not destructure `const { game } = await import(gstate)`: that copies
    the object reference at import time, and `resetGame()` replaces the
    object when the game starts, so every field reads undefined. Keep the
    namespace and read `gstate.game`.

## C quirks the first two fuzz batches surfaced (all verified in the C)

  - `sel_set_feature()` (Lua `des.feature`) writes `levl[][].typ` directly and
    never touches `level.flags.nfountains`; `mklev()` never recounts. Themed
    room fountains are inaudible in C. Ours incremented on placement AND
    recounted after makelevel, so every such level drew an extra rn2(400)
    per turn (s1-03).
  - `addinv_core2()` in 5.0 deciphers scroll labels for Archeologists on
    pickup ("You decipher the label on ...", makeknown, literate conduct),
    and makeknown's discover_object exercises Wisdom, so a wished-for scroll
    costs an rn2(19) that ours never drew (s1-01).
  - `dohelp()` uses `select_menu(PICK_ONE)`: an unmatched key rings the
    bell and keeps the menu; ours dismissed on any key (s2-15).
  - `itemactions()` lists `-` unwield, the whole `iactions.c` apply block,
    and `T` take off before the `c`/`d`/... entries (s1-01, s2-16).
  - `getobj()` says "anything ELSE to <verb>" when an item was excluded as
    inaccessible (already-worn gear for `P`), tracked by `inaccess` (s1-09).
  - `can_reach_floor(TRUE)` is false when teetering at a seen pit or over an
    escaped shaft, when riding unskilled, when held by a hugger, when hiding
    on the ceiling; `maybe_smudge_engr()` draws nothing then (s2-06, tutorial).
  - `getpos()`: C gathers `m o d x a z` through one `gather_locs()` sorted by
    Chebyshev distance then y then x (`cmp_coord_distu`, stable qsort per
    patch 002); ours hand-rolls `d`/`m` and has no `o x a z` at all. Every
    farlook/travel/teleport-control session is exposed (s2-05, s2-13, s2-25).

## Fixed datetime and DST: C shifts winter wall-clock hours by one

`time_from_yyyymmddhhmmss()` copies `localtime(now)` (the RECORDING
moment, including `tm_isdst`) and overwrites the fields, then `mktime()`.
A recorder running in EDT that is handed a January datetime therefore
produces a time_t one hour earlier than the standard-time reading, and
`getlt()` reports hour-1 (and the previous day at hour 0). A fuzz game with
20260126002218 got "It is nighttime." from `^X` where our direct-field
parse says "midnight hour" (s2-27). This is the same unmodelled
recording-timezone input as ubirthday (entry above); the judge's TZ is not
knowable from the corpus, so it is deliberately NOT fitted. Hour-dependent
output (night(), midnight(), moon/Friday-13th at hour 0) will disagree with
oracles recorded in a DST-observing zone during DST; expect it, do not fix
it by guessing. s22-25 (the `^X` moon/night line) and s29-24 ("It is
nighttime." where our clock reads the midnight hour) are more instances.
s30-13 (an undead monster's midnight() extra damage roll at
mhitu.c:1189), s31-03 and s31-09 (the ^X "It is nighttime." and "There is
a full moon in effect." lines) are the same class, as is s33-31 (^X,
"It is nighttime." missing on our side) and s34-09 (a 20260220000058
recording: the C's shifted clock lands on the 19th, whose phase says
"Be careful!  New moon tonight." at startup, so every later screen sits
behind that --More--; ours computes the 20th). s37-20 (^X "It is
nighttime.") is another, as are s39-16, s39-28, s42-10 and s44-18 ("It is
the midnight hour." where our clock says nighttime), s43-12, s46-13 and
s46-18 (the C says nighttime, ours prints no time-of-day line; s46-13 also
has the C's "There is a full moon in effect." from its local date), and
s46-25 (the midnight undead damage doubling of hitmu, like s30-13), and
s47-07 (ours prints the new-moon startup warning from the recording date
where the C's local date did not), and s48-00 and s48-33 ("It is
nighttime." where our clock says the midnight hour) and s48-34 (ours prints
"It is nighttime." in ^X where the C's local hour printed no line), and
s49-07 (nighttime vs midnight hour again; the only miss in seed 49).
s50-13 belongs to the ubirthday class: reading a Tourist's Hawaiian shirt
prints a design hashed from o_id ^ ubirthday (read.c:190), which the
recording does not carry (see "ubirthday"). Seed 51 added s51-18 (the C's
"There is a full moon in effect." line) and s51-24 ("It is nighttime."),
and s51-02 is the recorder rc path class (the options help shows
/var/folders/.../nh-rec-*/home/.nethackrc). Seed 55 added s55-06 (^X "It
is nighttime." where our clock says the midnight hour; the only miss left
in seed 55), and seed 56 added s56-31, seed 59 added s59-19, and seed 61
added s61-25 and s61-35 (the same ^X line), seed 62 added s62-11 (ours
prints "It is nighttime." where the C's local hour printed no line), and
seed 63 added s63-24 (the C printed "It is nighttime." above the shared
"Bad things can happen on Friday the 13th." line), seed 65 added s65-16
(ours prints "It is nighttime." where the C's local hour did not), and
seed 66 added s66-12 (^X nighttime vs midnight) and s66-09 (the midnight
undead damage doubling of hitmu, like s30-13 and s46-25), seed 68 added
s68-03 (^X nighttime), and seed 72 added s72-10 (ours prints "It is
nighttime." where the C's local hour did not) and s72-21 (the reverse).

A related census-only artifact: s67-00 ends while the C blocks at wizard
mode's "Dump core? [ynq] (q)" after #quit. Every recorded screen matches,
but the census's diverge run answers the prompt when the key list runs out
and our done(QUIT) then draws (the disclosure and bones bookkeeping), so
the census reports extra RNG calls "C never made". A recording that ends
at a prompt that leads into done() will always show this; it is not an
over-read (the C needed the same key).

## Fuzz divergence census (2026-09-01, second pass)

`node tools/gen-sessions/fuzz.mjs` corpus is now 102 games. Running
`tools/diverge.mjs` over all of them: **84/102 are RNG-perfect to the end.**
The 18 that diverge cluster almost entirely in deep monster movement, and
crucially the divergence is where it first SHOWS, not the bug:

- `distfleeck` (5 games), `mcalcmove` (2), `unstuck` (1): the first mismatch
  is a monster-move draw, but the preceding draws all match. This is a
  monster-set/ordering/state accumulation drift — by iteration N ours and C
  are processing a different monster. `distfleeck`, `mcalcmove`, `unstuck`,
  `mhitm_knockback` themselves are faithfully ported (checked line-by-line);
  the drift is upstream and needs the recorded C stream walked back further.
- `getbones` (2 games: s3-15, s4-20): wizard `^V` level teleport. Ours runs
  one extra `movemon`/`distfleeck` pass on the OLD level before the teleport's
  `goto_level`→`getbones`, so ours' turn counter over-increments by one
  (T:5→T:6 where C stays). Wizard-only path, low held-out value.
- `place_niche` (s4-04): a normal random level whose room `doorct` differs by
  the time `makeniche` runs (C short-circuits `doorct==1 && rn2(5)`, ours
  evaluates the rn2). A level-gen door-count drift, deep.

**s2-06 tutorial `maybe_smudge_engr`, unresolved.** First mismatch at draw
3018: ours draws `rnd(5)` in `maybe_smudge_engr`, C draws nothing there
(C makes ZERO smudge draws in the whole game). It is the tutorial's first
real move (mv=1) off the "Move around with h j k l" engraving at (12,6).
Ruled out: map offset (both render `@` at the same screen cell at step 57),
engraving placement (both show "Something is engraved here"), engraving type
(both ENGRAVE/nowipeout), and `can_reach_floor` (matches C line-for-line, and
there is no trap at (12,6) so the pit/shaft arm is not taken — the earlier
pit note does NOT explain this case). Both sides appear to have the engraving,
`can_reach_floor` true, and a successful move, yet only ours smudges. Needs
the C binary to confirm whether C's `engr_at(12,6)` is null or its
`domove_succeeded` is 0 at that move. The step-60 screen miss (tutorial map
shown in ours, blank in C) is a separate display-memory difference.

**Takeaway for the next agent.** The recorded oracle stream (diverge.mjs) is
enough to debug most divergences, but this cluster is in already-ported code
and drifts from an earlier, invisible state difference. Higher-leverage work
right now is PORTING stubbed C functions (read C, translate, verify on the
full gate) rather than chasing these. The `note_unported_*` markers (908 of
them) are the work list; filter to ones that draw RNG on a common path.

## Recording semantics: screen[N] and rng[N] describe the processing of key N-1

Verified with two probe recordings (tools/gen-sessions/record.mjs, wizard
`^V` `13` RET then `i`): the recorder snapshots the screen when a key is
REQUESTED, so `steps[N].screen` is the state after key N-1 was fully
processed and before key N is consumed, and `steps[N].rng` holds the draws
made while processing key N-1. `render.mjs msgs` already shifts by one
(it prints key N beside screen N+1), `diverge.mjs` and the frozen runner use
the same convention on our side, so nothing is misaligned — but when you
read the raw JSON you will see, e.g., the level-teleport draws under the
step of the key AFTER the RET. Do not conclude from that that C defers
`deferred_goto()` to the next command; it runs right after `rhack()`
returns (allmain.c:538), same as ours. (The `#if 0` around the immediate
deferred_goto() call in level_tele() is a red herring for the same reason.)

## Tutorial exit portal: mktrap() gives it u.ucamefrom

A magic portal made while `u.ucamefrom` is set (mklev.c:2108, i.e. the
tutorial levels' portals) gets `dst = u.ucamefrom`. Ours never set `dst`,
so stepping into the tutorial's portal noted `no_destination` and the hero
stayed put; every tutorial game diverges the moment it is left. Fixed in
js/mklev.js mktrap(). Leaving still shows one screen difference: at the
"You activated a magic portal!  Resuming regular play.--More--" prompt C's
status line says AC:10 while ours already says AC:9 (the restored cloak),
the same status-timing gap as the earlier "tutorial AC:10" note. RNG is
identical through it.

## Level-teleport sanity: C still had monsters, ours had none — until tut-2

s4-06 diverged after `^V 13` from the tutorial with `mcalcmove` draws we did
not make. Two separate causes: tut-2 was not in the des registry (now
js/dat/tut-2.js), and the exit portal had no destination (above). The
"2 monsters" were the main-dungeon level-1 residents the hero returned to
through the portal, not anything on tut-2 — a blessed potion of monster
detection quaffed there in a probe says "You feel lonely."

## Monster trap selector: list every trap type

`trapeffect_selector()` in js/trap.js is a hand-written switch, and it had
no `case LEVEL_TELEP`, so a monster stepping on a level teleporter fell to
the default (noted, Trap_Effect_Finished) and stayed on the trap with its
mtrapseen bit set. Census symptom: C draws rn2(5) then rn2(7) inside
`random_teleport_level` right after `m_move`, ours goes straight to the next
monster's `distfleeck`. When a trap effect gets ported for monsters, check
the selector too; C's switch is at trap.c:2836.

## Blessed scroll of destroy armor with no cursed armor still destroys

C: `else if (sobj->blessed && disintegrate_cursed_armor()) ... else if
(!destroy_arm())`. A blessed scroll whose wearer has no cursed armor falls
through to `destroy_arm()` and its rn2(4). The old JS returned early for any
blessed scroll (noted), so s2-24 lost the rn2(4)+rn2(idx) draws.
`some_armor()` draws rn2(4)s of its own as well; the old JS picked the first
worn piece with a plain `find` over invent.

## Explosion message order: the anger line comes from zap_over_floor()

In `explode()` C prints "<mon> is caught in the <blast>!" after calling
`zap_over_floor(xx, yy, ...)` for that square, and zap_over_floor ends with
`wakeup(mon, type >= 0)` -> `setmangry()` -> "<mon> gets angry!". So a
peaceful humanoid caught in a hero-caused blast is announced angry BEFORE it
is announced caught. An earlier narrowed port had "pre-announced" the anger
line to match; the faithful explode() gets the order for free. Do not add
message-ordering hacks; find the C call that produces the message.

## The extended command table must match the recorder's build defines

`js/extcmd_data.js` is generated from src/cmd.c's extcmdlist[] by
`tools/gen-extcmd.mjs`. Two entries (`shell`, `suspend`) carry
`#ifndef SHELL | CMD_NOT_AVAILABLE #endif` inside the initializer; the
recorder is a UNIX build with SHELL and SUSPEND defined (include/unixconf.h),
so C lists both commands in `#?` and dokeylist. The generator used to OR in
every flag name it saw, which hid both commands and shifted every later
page of the six-page list. It now evaluates those blocks against the
defines the recorder has. When a screen diff in a long menu shows entries
missing or shifted, check the generator's define set before the menu code.

## A module can load and still be broken: scan for unimported callees

ESM import errors surface at load time, but a function that *calls* a name
that was never imported only fails when that path runs. The muse.c batch
loaded fine and passed 43/44: seed0030 threw "Half_spell_damage is not
defined" inside a monster's wand zap. `tools/`-less check that catches this:
strip comments/strings, collect every `name(` callee, subtract everything
imported (static, `await import` destructuring, Promise.all destructuring),
declared, or a parameter, and look at what is left (a scratch script did
this: `undef_scan2.py`). Run it on every file a batch rewrites, before the
gate. Also beware helper loops that `continue` past an import statement:
one skipped statement silently dropped four trap.js imports.

## An un-awaited async call is a latent ordering bug

`js/do.js dropz()` called `encumber_msg()` without `await`. C runs it before
dropz returns. The JS async function computed the old/new capacity at once
but printed and updated `game.oldcap` only after its first `await`, so any
caller that reached its own `encumber_msg()` without yielding printed the
same "Your movements are slowed..." transition twice. This stayed hidden
for as long as the old polymon() used `await import()` between the drop
and its final encumber_msg(): each dynamic import yielded to the event loop
and let the first call finish. Rewriting polyself.js with static imports
removed the yields and seed0108 failed. Rule: every async C-side call is
awaited, even when its result is unused; grep a rewritten file for
`^\s+[a-z_]+\(.*\);$` calls to async functions before gating.

## `if (!counter++)` on a JS field that may be undefined

C's `if (!u.uconduct.polyselfs++)` relies on zero-initialized memory. In JS
`undefined++` yields NaN, the test still passes (so the livelog line
appears) and the field is then NaN; #conduct later said "You have never
changed form." (seed4500, step 1573). Write such counters as
`x = (x | 0) + 1; if (x === 1) ...`, or initialize the struct where C
zero-fills it.

## Verify an unexercised subsystem with a recorded probe, then keep it

When a batch ports code that no public or fuzz session reaches (genocide,
polymorph prompts), write a recipe and run the C recorder:
`node tools/gen-sessions/record.mjs <recipe.json>` (see
tools/gen-sessions/README.md). Build the key string in node with
`String.fromCharCode(0x17)` for control keys; a literal control byte in a
heredoc is rejected before the shell sees it. Two things bit the first
attempts: every message that ends with --More-- needs its own space in the
key string (count them from `render.mjs <session> msgs` of a first cut), and
a wished-for item takes the next letter after the last one assigned
(`lastinvnr`), not the lowest free letter, so three wishes in a row landed on
n, o, p even though n had been used up in between. Generated sessions are
tracked, so once the recording is right, save the recipe under
tools/gen-sessions/recipes/ and commit the fixture: it is the regression
guard for that subsystem. The genocide probe's first cut caught a #conduct
line that had been hardwired to "never genocided".

## Level arrival must run C's reset list, not just the map swap

`goto_level()` in C (do.c:1612-1622) does more than change `u.uz`: when
falling it drops the floor pile after the hero (`impact_drop`), then
`reset_utrap`, `fill_pit`, `set_ustuck(NULL)`, `set_uinwater(0)` and
`u.uundetected = 0`. The JS port had skipped that block, which was invisible
while every recorded arrival came by stairs. The first dig probe (pit, then
hole from inside the pit) arrived on the new level with `u.utrap` still set
to TT_PIT, and vision in a pit is limited to the adjacent squares, so the
lit room drew as a 3x3 patch. When a screen after a level change shows too
little, check the hero's trap and water state before the vision code.

## One constant, one numbering: flag sets must come from the C header

`js/objnam.js` exported its own `CXN_*` corpse_xname() flags with values
that differed from include/hack.h (`CXN_PFX_THE` was 2 there, `CXN_NO_PFX`
in the C), and `js/const.js` exported the C values under the same names.
Every caller that imported from const.js and passed the result into
corpse_xname() silently got a different flag: the revive port produced
"Your the newt corpse glows iridescently." because CXN_NO_PFX (2) was read
as CXN_PFX_THE. It only surfaced through a recorded probe. objnam.js now
carries the C numbering. When a file defines a bitmask locally, check that
const.js does not already export the same names with other values; there
must be one numbering and it is the header's.

## erode_obj in 5.0 hides erosion inside a pool

`visobj` in trap.c erode_obj() is not just cansee(bhitpos). 5.0 adds
`&& (!is_pool(bhitpos) || (next2u(bhitpos) && Underwater))`, so an object
that lands in a moat and rusts (drawbridge debris, anything thrown into
water) is silent unless the hero is underwater beside it. The port printed
"The iron chain rusts!" and the extra --More-- ate the next key. C also
strips a leading "the " from ostr for visobj messages.

## pline must clear iflags.last_msg, or message-conditional code misfires

vpline() ends with `iflags.last_msg = PLNMSG_UNKNOWN` after every message.
Callers set last_msg to a sentinel before a sequence (muse.c sets
PLNMSG_enum before a monster reads a scroll of teleportation) and test it
afterwards to learn whether anything was printed; trycall() and the
"Call a scroll labeled ...:" prompt hang on that test. The port only set
last_msg at the special sites (PLNMSG_GROWL, PLNMSG_OBJ_GLOWS, ...) and
never reset it, so the prompt never appeared. display.js pline,
urgent_pline and both nohistory variants reset it now.

## Castle: ^T into the outer strip is refused by the teleport region

castle.lua's teleport_region excludes {1,1,61,15} in map coordinates, which
covers the whole fortress including the floor strip just outside the west
moat (screen columns 9..12). tele_jump_ok() refuses a controlled teleport
from outside that region into it; the answer is "Sorry..." and a random
destination. To probe the drawbridge, land at screen column 8 (level x 9)
on the drawbridge row; a wand zapped east from there reaches the span and
the portcullis (zap range rn1(8,6) is at least 6).

## game.killer is not always allocated

C's gk.killer is a static struct. The port creates game.killer lazily
(attrib, end, exper and mcastu assign fresh objects), so code that writes
killer.format and killer.name ahead of a possible death must guard: clear
only `if (game.killer)`, and create `{ format: 0, name: '' }` before
setting. dbridge's e_died and nokiller threw a TypeError inside
open_drawbridge on the first castle probe.

## billable() hands the shopkeeper back before the on-bill test

shk.c billable(&shkp, obj, roomno, reset) stores the resolved shopkeeper in
*shkpp as soon as shop_keeper()/inhishop() succeed, then returns FALSE for
an object that is already on the bill. stolen_value() relies on that: it
calls billable with a null shopkeeper, gets FALSE for billed goods, and
then uses the written-back shopkeeper to find the bill entry. The port
wrote shkpp.shkp only at the end (and wrote null when the object was not
billable), so a stolen unpaid potion produced no "You owe" and no debit.
When a C function takes an in/out pointer, copy the write timing, not just
the value.

## The shopkeeper record must be ONE object

makemon(MM_ESHK) created an empty mextra.eshk (what const.js ESHK() reads)
and shknam.js then built the real record on shk.eshk. Code using ESHK()
saw no shoproom, credit or bill; code using shkp.eshk saw everything, and
46 sites hedged with `shkp.eshk || ESHK(shkp)`. shknam.js now assigns the
same object to both names. Anything that creates a shopkeeper elsewhere
(restore, polymorph recovery) must keep that invariant.

## next_shkp() in the port is inclusive and list-based

C's next_shkp(shkp, withbill) starts at its argument and callers advance
with shkp->nmon. The port's next_shkp(shkp, withbill) is the same
(inclusive), but there is no nmon: advance with
`next_shkp(mons[mons.indexOf(shkp) + 1] ?? null, true)` and start with
`next_shkp(mons[0] ?? null, true)`. `next_shkp(null, ...)` returns null,
so a C-style `for (shkp = next_shkp(NULL...` never iterates.

## mongets() is not "mksobj + mpickobj"

makemon.c mongets() adjusts the object before the monster takes it:
demons never keep blessed items, lawful minions get uncursed erodeproof
gear with spe >= 0, player monsters get +3..+6 swords, the invocation
items are reset (candelabrum unlit, bell uncursed, Book of the Dead
cursed), and a prince (M2_PRINCE: throne room rulers, lords) gets a
weapon of at least +1 and armor of at least +0. None of that draws RNG
(except the sword bonus), so a stub port matches the RNG stream and
still shows the wrong enchantment the first time the item is identified.
Silent, non-RNG fixups are the ones the fuzz census cannot see; only a
recorded probe that prints the item finds them.

## Throne rooms refuse ^T because every square is occupied

A court is packed with sleeping monsters, so a controlled teleport to any
square in it fails goodpos() and lands "Sorry..." somewhere random. To
reach the throne: #wizkill, move the getpos cursor onto the throne from
wherever the hero is (65 l and 2 j in the probe), '.', dismiss the kill
message, ESC out of wizkill's "Next monster:" loop, then ^T onto the now
empty throne. The ruler's death drop lands on the throne and dosit's
object arm wins over the throne arm, so pick it up (the menu takes ',' to
select all, then Return) before sitting.

## Answer unknown prompts with Return in a probe

When a sequence may or may not raise a prompt (the wizard-mode throne
effect getlin, "Analyze throne?", a --More--, "Die?"), send Return after
the command: xwaitforspace accepts it for --More--, getlin returns an
empty string (atoi 0, random effect), and yn prompts take their default.
A bare Return at the command prompt is only "Unknown command", no turn.

## A file's own locals collide with faithful imports; scan before loading

Several JS files define private copies of C macros and helpers
(trap.js: m_in_air, m_easy_escape_pit, dunlev, the FORCETRAP flag set;
teleport.js: next_to_u, Stunned). Adding `import { name }` for a symbol
that already exists as a top-level const or function is a SyntaxError that
node reports one name at a time. Before the load test, list every
top-level declaration and every imported name in the edited file and drop
the imports that clash; a duplicate `function` definition is the same
class of error. The scan is ten lines of Python and saves a round trip
per collision.

## m prefix enters water silently; the moat has eels

domove() in 5.0: without paranoid_confirmation:swim the hero simply does
not step into known water or lava, and only says so when mention_walls is
set; with the m prefix (context.nopick) the move goes through with no
message and drown() runs. The Castle moat is the reachable deep water for
a probe, but giant eels sit in it: a hero at the moat edge is bitten
before the m-move keys arrive and the --More-- swallows them. #wizkill
the three moat squares beside the target (the kills also give experience
levels, so expect "Welcome to experience level N") before walking up.

## surface() and waterbody_name() read SURFACE_AT, not typ

Both look through a raised drawbridge to the terrain under it
(db_under_typ of the drawbridgemask), so the span of a raised castle
drawbridge is "moat" and the levitation landing message names "the
stairs" via On_stairs(). The port's surface() used a stairway wire that
was not connected on the arrival path and answered "ground".

## ELevitation lives in game.u.uprops.LEVITATION as the C slot mask

worn.js stores C's u.uprops[p].extrinsic slot mask under each uprops key
and deletes the key when the mask empties; blocked masks live in
game.u.blocked. float_down(hmask, emask) therefore clears bits in
intrinsic.HLevitation and in uprops.LEVITATION and deletes the key at
zero, and BLevitation == I_SPECIAL is `u.blocked.LEVITATION === I_SPECIAL`.

## walk_path is async; a sync caller treats its promise as "no obstacle"

The jump validator called `walk_path` synchronously and tested the result.
Once walk_path became async (hurtle_step prints), the promise was truthy and
every jump passed the obstacle check, which showed up only as an RNG
divergence in seed4500 (we jumped where the C printed "There is an obstacle
preventing that jump."). After making a C callback path async, grep its
call sites for un-awaited uses: `grep -n "walk_path(" js/*.js | grep -v await`.
Validators handed to `getpos_sethilite` may now be async, so getpos awaits
them.

## Artifact attack records are strings

`artilist_data.js` stores `attk` as the C macro text (`"STUN(3, 4)"`,
`"PHYS(5, 10)"`). Read it through `arti_adtyp()` / `arti_attack()` in
artifact.js. `weap.attk.adtyp` is always undefined; that made `attacks()`
false for every artifact and skipped `Mb_hit` entirely while spec_dbon still
matched, so the divergence looked like a missing rn2(11) inside Mb_hit.

## decl.c common strings: fakename is { "mon", "you" }

`fakename[]`, `the_your[]` and the rest of `c_common_strings` are
initialized in `src/decl.c`; decl.h only names them and hack.h declares the
struct. `noit_mhe/mhim/mhis` are `you.h` macros over
`pronoun_gender(..., PRONOUN_NO_IT | PRONOUN_HALLU)` and live next to
`mhim()` in mondata.js. `mon_hates_light()` is mondata.c:547.

## The runner reports 0 matched calls when the JS throws

`ps_test_runner` and `diverge.mjs` print "RNG diverges at call 0" and
"ours —" for every draw when the JS threw mid-session, whatever the real
position. Run `node tools/jsplay.mjs <session> --rows 0` first: its
"stopped: threw" line carries the stack. `--rng-at N` prints the JS stack
at draw N of the segment, which is the fastest way to name the JS function
that drew when the C did not.

## shieldeff is async; every C shieldeff(x, y) needs an await

The JS shield animation yields 21 times (one game.animationFrame per shield
glyph). Called without await it interleaves with the caller's own beam
frames and the last glyph painted wins, which left a shield `#` on the
hero's square in seed0002 after a reflected sleep ray. The C is sync, so a
port copied line by line drops the await; grep new code for bare
`shieldeff(` before running the gate.

## Beam display: no tmp_at, and hdmgtype is a real draw

dobuzz paints each beam square with display_cmap_at and restores the list
in a finally block; that is the JS twin of tmp_at(DISP_BEAM)/DISP_END.
Under hallucination the C computes `hdmgtype = rn2(6)` in the declarations,
before the uswallow check, so that draw must come first even though the
JS only uses it for the beam color. The animFrames metric (frames captured
at nh_delay_output) is not part of pass/fail: main scored 48 of 1483, the
ray port 90.

## C impossible() calls become comments

There is no `impossible` export. The convention in the tree is a comment
(`/* impossible("...") */`) at the same spot; do not add a helper.

## resist() is async; a call without await always "resists"

`resist()` awaits `shieldeff_mon()` (21 animation frames) when told to
show the effect, so it returns a promise. A caller written the C way,
`if (!resist(...))`, sees a truthy promise and takes the resisted branch
every time, silently. Every call site is awaited now; grep for a bare
`resist(` after porting anything that calls it. The same applies to
`sleep_monst()`, which lives in mhitm.js (its C file), not zap.js.

## query_objlist() has the C signature

`query_objlist(qstr, olist, qflags, how, allow)` returns the picks array
(with a `counts` map) instead of C's count plus out-list. INVORDER_SORT,
USE_INVLET, AUTOSELECT_SINGLE and INCLUDE_HERO are honored; PICK_NONE
menus (probing a monster or a container) go through it exactly like C.
The class grouping still uses the JS `sortloot_items` approximation of
sortloot(), so a flags.sortloot change is not modeled.

## replace_object() leaves the old object OBJ_FREE

C's extract_nobj() sets `obj->where = OBJ_FREE` while unlinking, so
poly_obj()'s closing `delobj(obj)` finds a free object and skips the
newsym. The JS twin sets `obj.where = OBJ_FREE` after the array splice
for the same reason; without it delobj would splice the replacement out
of the floor list.

## The invisible hero's square shows the engraving

newsym()'s hero branch draws what map_location() would when the hero
cannot see himself: an object if one is there, else the engraving glyph,
else the background. Before, it drew the plain floor over an engraving,
which showed up after a make-invisible self-zap on an engraved square.

## display_nhwindow(WIN_MAP, TRUE) is a flush plus a forced --More--

wintty.c's NHW_MAP arm with blocking set does end_glyphout(), marks a
non-empty top line TOPLINE_NEED_MORE and displays the message window, so
the pending message gets a --More-- with the freshly drawn map behind it.
The JS twin is `await flush_screen(0)`, then the two toplin lines, then
`more()`. Without the flush the --More-- screen shows the map from before
the newsym (the hero instead of the gold pile he just became).

## Option flags default to "on" when the JS never parsed them

`game.flags.acoustics` is undefined unless the rc set it, and the C default
is on. Test `game.flags?.acoustics === false`, never `!game.flags.acoustics`;
pline.js and sounds.js already follow that rule. The same applies to every
opt_out boolean in optlist.js.

## The hero's disguise draws through display_self()

newsym()'s hero branch used to paint '@' itself, so `youmonst.m_ap_type`
(a mimic corpse's gold disguise, #monster mimicry) never showed. It now
calls display_self(), which has the furniture, object and monster arms.

## New imports go after the last import statement

The edit-script helper `add_import` used to insert a new `import` line at
the top of the import block. ESM evaluates a module's dependencies in
import order, so a new edge placed first changes the evaluation order of
everything below it. The kick batch added `mon.js -> teleport.js` that
way and coloratt.js then evaluated while tty/wintty.js was still in
progress: "Cannot access 'ATR_NONE' before initialization". Appending
the new statement after the last existing import keeps the old order for
existing edges and only walks the new edge last. The helper now appends;
keep it that way.

## Recipes start with a space

The welcome message ends in --More--, and the first key of a recipe
dismisses it. A recipe whose moves start with ^W loses the wish key to
that prompt; the wish text then runs as commands and an inventory letter
opens the 5.0 item-action menu. Every recipe's moves start with a space.

## wake_nearto() and wake_nearby() are async

mon.c `wake_nearto_core` prints through `wake_msg` ("The newt wakes up"
style messages), so `wake_nearto`, `wake_nearby` and shk.c `noisy_shop`
are async and every caller awaits them. A sync caller silently skips
the wake (and its message) and the next monster move diverges. The old
`wake_nearto_with_messages` split is gone.

## costly_gold() takes (x, y, amount, silent)

The C finds the shopkeeper from the square (`in_rooms`/`shop_keeper`),
so the JS signature is the C one. addtobill passes `obj.ox, obj.oy` and
really_kick_object passes the kicked square.

## Door wishes need a door or wall square

objnam.c `wizterrainwish` only turns an existing door, secret door, wall
or iron bars square into a door ("Door requires door or wall location").
A probe cannot conjure a door where the hero stands, so kick_door has no
dedicated probe yet; the seed0060 kick-search session covers the plain
"WHAMM!!" arm.

## Empty-direction kicks strain the leg one time in three

kick_dumb rolls `rn2(3)` for "Dumb move!  You strain a muscle." unless the
hero has martial arts or Dex 16+. After that every kick refuses with
"Your right leg is in no shape for kicking" (plus a forced --More--) for
5+rnd(5) turns. A kick probe that sweeps all eight directions to find a
created monster loses most of its coverage that way; put the kicks that
matter first, or create the monster and kick into it with fewer misses.

## maketrap() converts the terrain of a dug square

trap.c `maketrap()` does more than record the trap: for a pit or hole it
calls `set_levltyp()`, so a wall or secret door that gets dug (breaking a
wand of digging next to a wall, or digging down while phasing) becomes a
doorway (room floor on a maze level, corridor on a cavernous one), stone
or a secret corridor becomes corridor, and the square's flags are
cleared. The JS used to leave the wall type in place under the trap. The
screen looked right (the trap glyph draws over the wall) but
`goodpos()` still rejected the square, so a monster created next to the
hero landed elsewhere than in the C while the RNG stream stayed
identical. A screen-only miss with a perfect RNG stream is the signature
of a terrain or occupancy difference, not a draw.

## consume_obj_charge() takes (obj, maybe_unpaid)

The C signature has the shop-billing flag; every caller now passes it
(`true` everywhere except `bagotricks(bag, !tipping)`). A one-argument
call would silently skip `check_unpaid()`.

## dowrite() lives in js/write.js

src/write.c has its own JS file now; apply.js imports `dowrite` from it.
The C-form match loops (name, description, then user-assigned names with
the `rn2(++deferralchance)` draw) replace the earlier name-only loop.

## getpos highlight callbacks are inert

`getpos_sethilite(hilitefunc, validfunc)` in getpos.js marks the valid
squares from the validator and ignores the highlight function (C draws
them with `tmp_at(DISP_BEAM, S_goodpos)`). The apply.c callbacks are
ported for the call sites but draw nothing; the screens match because the
validator produces the same set of squares.

## m_at() hides dead monsters; C reads the grid

mon.js `m_at()` returns null for a monster whose mhp is 0, which is a
convenience C does not have: `svl.level.monsters[x][y]` still holds the
monster until `remove_monster()`. Code that ports a C grid read on a
monster that is already dead (`mon_leaving_level()` inside `mondead()`)
must read `game.level.monAt` directly, or it never removes the entry.
The stale entry then makes `goodpos()` refuse the square and leaves a
warning glyph on screen, with a perfect RNG stream right up to the
moment something bumps into it.

## make_corpse() ends with stackobj()

The C stacks the last created object with a mergeable neighbour and
newsyms the square. Two of a paper golem's blank scrolls merge into one
stack, so a striking wand that sweeps the pile draws one breaktest
fewer. A screen-perfect probe with an extra `rn2(100)` from breaktest is
this tail missing.

## Conduct counters start at zero

C zeroes `struct you`, so `u.uconduct.killer++` and friends start from 0.
The JS built `u.uconduct` lazily and an unset counter went NaN on `++`,
which reads as "never" in the end-of-game conducts ("You were a
pacifist"). allmain.js now creates every counter at 0 next to
`u.ualign`.


## Quantum box timers and teleport attacks, 2026-09-06

See quantum-containers-audit.md for the63newnativecases andsourcecoverage.
An unopened quantum box contains a housecat corpse with its ROT_CORPSE
timer stopped. Leaving that timer running passes every creation screen,
cursor and RNG entry but fails the new native state assertion immediately.
Use persistent-state checks alongside output comparison for these paths.

The delayed-loot probe also found missing AD_TLPT dispatch. The shared C
helper now covers all three combat directions and nonfatal damage. The
Upolyd helper takes game.u explicitly. The low-HP safety boundary is
constructed coverage; ordinary native attack cases do not exercise it.

NETHACK_RNGLOG_DISP adds ~drn2 entries, not strings containing "display".
A hallucination potion's enlightenment window already restores the map on
dismissal. The additional docrt inserted six display draws before the
next three normal draws, with no core-RNG difference. Remove only the
proven extra redraw; other callers still need independent source review.

The350-turn rest request in the delayed probe is interrupted by gameplay;
JS reaches82and57elapsedmoves. A351request records identical behavior.
Requested repeat counts are not evidence of elapsed turns. The no-control
attack cases remove the intrinsic, but wizardmode still offers controlled
teleportation. They do not establish random uncontrolled teleport coverage.

## Tipping state and native probe validity, 2026-09-06

See container-tipping-audit.md for the 72 new native cases. An explosion
must leave the unprocessed objects in the source, even after clearing the
destination pointer. Price suppression must still be decremented before
breaking the transfer loop. Deselecting the floor menu entry is distinct
from Escape: zero selected entries still means tip onto the floor.

The all-green screen/RNG corpus hid a supply chest with empty stored weight.
The state gate exposed it. C's wizweight display verified 670 instead of
JS's 600, and fill_ordinary_room explicitly updates the weight after adding
contents. Verify such consistency assertions against C before fixing them;
C can have bookkeeping quirks too. wizweight is diagnostic only until its
JS display path is ported.

A trapped box can also be locked; the lock wins. A heavy wished icebox may
be dropped rather than carried. A floor horn does not pass Is_container.
Check that native actions reach the claimed branch before promotion. For
cursed tipping losses, inspect is_boh_item_gone rolls after #tip, because
opening the bag during setup can independently destroy contents.

The failed armor-shop horn probe exposed a traditional pickup gap before
tipping. Its original extended segment 33 is retained for the pickup pass.
Corrected unpaid horn cases use a shop that buys tools and native-observed
pickup responses. Do not change a failing setup into a passing label and
then claim it exercised the original behavior.

## Longer fuzz games find what the 250-key corpus cannot (2026-09-06)

The 102-game corpus was 102/102 RNG-perfect and still the private score
was 81%. `fuzz.mjs --games 40 --keys 700 --seed 11` produced 9 failures out
of 40, all real bugs, none reachable in 140-step games: wizard-mode deaths,
`^V` to negative levels, five-try prompt limits, getpos `z`, travel to
unexplored squares, achievements in the conduct window. Longer games and
fresh seeds are the cheapest held-out estimator we have; run a new batch
before porting by note count.

## Rush and run keys after g, G and F prefixes are refused

src/cmd.c:2024: the rush and run table entries carry CMD_M_PREFIX only
("accept m prefix but not g/G/F"). `g` followed by ^J, `G` + `J`, `F` + a
control direction all print "The 'g' prefix should be followed by a movement
command." and take no time. Ours translated the control/shift key to its
base direction first and ran. Diverge blamed readobjnam 94 steps later
because C drew nothing between the two; the "divergent call occurs at" line
is C's index, not the step where our stream went wrong.

## Inhell is dungeons[].flags.hellish, not hell_dnum

`game.hell_dnum` was never assigned, so `u.uz.dnum === game.hell_dnum` was
always false. Vlad's Tower and Gehennom are both hellish. Use
`Inhell()` from makemon.js (include/dungeon.h:140).

## getpos gathering must await async validators

`get_valid_jump_position()` is async (is_valid_jump_pos awaits messages).
`gather_locs_interesting()` tested the promise, so every square was "valid"
for the `z`/`Z` keys and the cursor jumped to the nearest square. Both
gather functions are async now; `getpos_menu()` and the key loop await them.

## SYMBOLS= overrides sit on top of the symset

src/symbols.c parsesymbols()/match_sym() and src/options.c sym_val()/
escapes() are ported into js/symbols.js with C's `ov_primary_syms[]`
table (SYM_OFF_P/O/M/W/X layout). `assign_graphics()` applies the
overrides after copying the set and before the dark_room copy, and fills
`gs_showsyms.O/M/X` for object classes, monster classes and the "other"
symbols; display.js, detect.js and pager.js read them through
`showsym_oc()`, `showsym_mon()`, `showsym_other(SYM_BOULDER)`. The
`boulder` option is stored as the S_boulder override, as optfn_boulder()
does. `OPTIONS=S_pool:~` works through parseoptions' "Is it a symbol?"
arm. One public rc carries `SYMBOLS=S_pool:~,S_fountain:{` next to
symset:DECgraphics; the C shows '~' pools, the DEC diamond is wrong.
Under DEC handling a value with the high bit set is a line-drawing
character (win/tty/wintty.c g_putch), matching defsyms' `dec` flag.

## tty prompts are the previous message for Norep

win/tty/topl.c tty_yn_function() and win/tty/getline.c hooked_tty_getlin()
show their prompt through custompline(OVERRIDE_MSGTYPE | SUPPRESS_HISTORY),
and src/pline.c:282 vpline() copies it into gp.prevmsg. A Norep() of the
message shown before the prompt is therefore printed again in C
("You already found a monster." after "Really save? [yn]"). Menus and text
windows do not touch prevmsg. Verified with recipes/probe-norep.json. Ours
now sets `game._prevmsg` in tty_yn_function() and getlin(); the read.js
create_particular hack that nulled it is gone.

## create_particular retries and the try limit

src/read.c:3389 tests `*bufp` after mungspaces(), the raw input, so "25"
(a count with no name) says "I've never heard of such monsters." and only a
blank line gets "Try again (type * for random, ESC to cancel)." After five
failures C prints "That's enough tries!" (thats_enough_tries). makewish has
the same limit and the same message.

## doquiver_core prints "You ready:" before setuqwep for f

src/wield.c:652: `Q` places the item first so the line reads "(at the
ready)"; refilling during `f` prints prinv("You ready:", ...) and then
quivers, so no "(at the ready)". The function is now the full C form:
count splits through objsplit, wielded/alternate weapon confirmation,
ECMD_TIME when a wielded weapon was unwielded.

## level_tele beyond the dungeon

Negative levels: shop bills are settled (u_left_shop), then heaven
(<= -10), Cloud 9 (-9) or "high above the clouds"; without Levitation or
Flying the hero plummets, killer "teleported out of the dungeon and fell
to his death", and done(DIED) is called with u.uz set to the surface; a
wizard who declines to die "finds yourself back on the surface" and
escapes via newlevel {0,0}. Level 0 asks "Go to Nowhere.  Are you sure?"
and commits suicide. Knox refuses positive levels, Gehennom's last level is
"Sorry..." before the invocation, quest levels are floored at qstart.

## Conduct window achievements

src/insight.c:2243 show_achievements() lists every recorded achievement in
recording order (Amulet then ascension moved last), present tense while
alive. Ours listed six of them. The wizard-mode death sequence shows the
window, so "You entered the Big Room." was missing from the end screens.

## is_valid_travelpt: unexplored is not a cmap glyph

include/display.h:543 puts GLYPH_UNEXPLORED after the statue glyphs, so
`glyph_is_cmap()` is false for a never-seen square and only a remembered
S_stone with seenv 0 is rejected before findtravelpath(). Ours also
rejected 'unexplored' glyphs, so a corridor square just outside a known
doorway said "(no travel path)" while C found the path through the
doorway (couldsee() is enough for the neighbor test).

## "No such command" uses visctrl()

src/pager.c:2711 formats the key with visctrl(), so a space prints as
' '. key2txt() ("<space>") is only for dowhatdoes_core's key column.

## rndmonnum() needs its Plan B

src/mkobj.c:395 rndmonnum_adj(): when rndmonst() finds no level-appropriate
monster, C picks any common monster by rn1(SPECIAL_PM - LOW_PM, LOW_PM)
until one is not G_UNIQ|G_NOGEN and matches the level's hell flag. Ours
returned NON_PM, and mktrap_victim() -> mkcorpstat() -> mksobj_init()
crashed on mvitals[-1] the first time a wizard entered such a level. A
thrown exception forfeits every remaining step of a session.

## Leaving the dungeon ends the game in goto_level()

src/do.c:1517: `new_ledger = ledger_no(newlevel); if (new_ledger <= 0)
done(ESCAPED);` runs before anything else in goto_level(). The negative
level_tele arm schedules newlevel {0,0} for exactly this. Ours only had the
"up the level 1 stairs without the Amulet" case, so an escaped wizard kept
playing. Also ported there: the dunlevs_in_dungeon() clamp and the endgame
Amulet check.

## Text window paging is dmore(), not any key

win/tty/wintty.c process_text_window() pages with dmore(quitchars): only
space, return and ESC turn a page; other keys ring the bell. The end-of-game
attributes window in end.js used nhgetch() and turned pages on 'k'. Use
xwaitforspace(' \r\n\x1b') for every text window.

## moverock() compares with the pile top

src/hack.c moverock_core(): "make sure that this boulder is visible as the
top object" tests `otmp != svl.level.objects[sx][sy]` (the top of that
square's pile) and only then re-links it. Ours tested the head of the whole
floor chain, so every failed push moved the boulder to the head of the
chain and changed the order dog_goal() scans objects in (a pet's apport
roll landed on a different object). Floor chain order is state: it is only
visible through scans like this one and "things that are here" lists.

## xname's dn fallback happens after the Samurai substitution

src/objnam.c keeps dn NULL when the class has no description and writes
`dn ? dn : actualn` at each use. The JS defaulted dn to actualn before
Japanese_item_name() changed actualn, so a distant (not dknown) knife was
"a knife" instead of "a shito" in "picks up" messages.

## The command table needs CMD_MOVE_PREFIXES

tools/gen-extcmd.mjs read only numeric #defines with an all-caps regex, so
CMD_gGF_PREFIX (lowercase g) and the composite CMD_MOVE_PREFIXES never made
it into the flags. Movement entries had flags 1024 instead of 1408, which
lost the "[m]" markers in the `?` key list and the CMD_M_PREFIX acceptance
of movement commands. The generator now resolves `#define X (A | B)`.

## The once-per-input flush is conditional

src/allmain.c:474 moveloop_core(): `if (disp.botl || disp.botlx) { bot();
curs_on_u(); } else if (disp.time_botl) { timebot(); curs_on_u(); }` is
the only per-input flush; parse() flushes before reading a key. A command
taken from the command queue (fireassist's doswapweapon+dofire) therefore
runs over a map that still shows the pet where it was, and its getdir
prompt's more() shows that stale map under the --More--. Ours flushed
unconditionally and showed the pet's new square one key early.

## Quitting the character confirmation bails out

The "Is this ok? [ynaq]" confirmation is a real select_menu(): ':' opens
"Search for:", ESC cancels the search, a second ESC returns -1 and
genl_player_setup() returns 0, then win/tty/wintty.c tty_player_selection()
calls bail(NULL): end_screen() clears the terminal, an empty raw line is
printed and the process exits. Ours ignored the result and started the
game. jsmain.js runSegment() now treats the terminate signal during
start() as the end of the segment.

## seffect_magic_mapping() on nommap levels

A scroll on a nommap level says "Your mind is filled with crazy lines!"
then "Wow!  Modern art." or "Your head spins in bewilderment." and confuses
for HConfusion + rnd(30); the spell says "Your head spins as something
blocks the spell!". A blessed scroll converts every SDOOR before mapping;
a cursed one maps under forced confusion and says "Unfortunately, you
can't grasp the details."

## randrole() is only drawn when pick_role() fails

src/role.c:2361: `k = pick_role(...); if (k < 0) k = randrole(FALSE);`.
A JS helper of the form pickOr(pick_role(...), randrole()) evaluates the
fallback eagerly and draws rn2(13) every time the role menu's random entry
is used. Fallbacks that draw must stay behind the condition.

## flags.female is set in u_init_misc(), before the legacy blurb

src/u_init.c:949 u_init_misc() starts with `flags.female = flags.initgend`
and runs before mklev() and long before the legacy pager. Ours set it after
the pager, so "You, a newly trained Plunderess" and the status line's rank
under the legacy window used the male form when chargen picked female.

## getpos: an unknown key ends a non-forced picker with "Done."

src/getpos.c:1115: only "Can't find dungeon feature" jumps back to the
cursor loop (goto nxtc); an unknown key prints "Unknown direction: 'x'
(aborted)." and then falls through to `if (force) goto nxtc; pline("Done.")`
and returns 0. Ours looped in both cases.

## #version is doextversion(), paged with dmore keys

The extended command had an inline copy in cmd.js that turned pages on any
key (^W turned a page C ignores) and a stale second copy of the options
text in pager.js. Both now go through pager.js doextversion(), which reads
js/version_data.js and creates the Lua state only the first time, like
get_lua_version()'s gl.lua_ver cache. The scorer normalises the banner
line to <<VERSION_BANNER>>; screendiff shows that placeholder for C.

## Entering a tended temple records ACH_TMPL

src/priest.c:425 intemple(): `if ((priest = findpriest(roomno)) != 0)
record_achievement(ACH_TMPL);` — the chronicle line "entered a temple"
was missing from ours, shifting every later #chronicle line.

## Shared damage handlers must exist for every AD type that draws

src/uhitm.c mhitm_adtyping() routes each damage type to one shared
mhitm_ad_*() with uhitm/mhitu/mhitm arms. Fifteen of them start with
mhitm_mgc_atk_negated(), an unconditional rn2(10) (unless the attacker is
cancelled). mdamagem() in mhitm.js dispatched only a subset, so a lichen
touching a pet (AD_STCK 0d0) skipped the roll. mhitm_ad_stck, _dren,
_slow and _were are ported in C form; the handlers still missing from the
mhitm dispatch are listed by the note_unported `mdamagem:adtyp=N` hits.

## Run and rush keys are movement commands everywhere

src/cmd.c:3462 reset_commands() binds highc(dirchar) to run and
C(dirchar) to rush (^J/^L/^N override redraw/annotate), so movecmd(sym,
MV_ANY) accepts them: getdir() treats RET (^J) as south and doclose says
"You see no door there." instead of "What a strange direction". With
number_pad the digits walk and M(digit) runs. movecmd() now models these.

## Local copies of constants drift

lock.js carried `P_LANCE = 24`; skills.h says 19 (P_BOW is 20). A bow is
not a forceable weapon in C, so #force takes no time; ours spent the turn
and a pet moved, silently, until its next roll differed. Constants belong
in js/const.js under their C names; grep for local `= <number>` copies
when a divergence looks impossible.

## Silent monster drift, open case (s13-31)

A grid bug two rooms away from the hero ends up one square from where C
has it, with no RNG difference until its mtrack roll rn2(4*(cnt-j)) sees a
different candidate count. can_track()/gettrack()/settrack() and the
mfndpos filters were compared line by line and match. The drift is in a
deterministic m_move decision for a monster that cannot see the hero; the
C recording cannot show the position, so the next step is instrumenting
the recorder (print monster positions per turn) for this seed.

## A JS-only helper around a menu repaints what C leaves blank

The farlook `i` arm had its own `display_inventory_pickone()` that ran
docrt() plus flush_screen() after tty_select_menu(). In C the path is
display_inventory() -> display_pickinv() -> select_menu(), and windows.c
select_menu() runs with bot_disabled set, so erase_menu_or_text's docrt()
redraws the map but not the status rows; the data.base window then
overlays a screen whose rows 22-23 are blank until the next flush. Any
extra redraw a port helper adds after a menu is visible. display_inventory
is now the C wrapper (cmdq_pop check, then display_pickinv with
want_reply); the entry builder is display_pickinv_entries().

## docrt()'s trailing flush is load-bearing

Trying to fix the case above by removing display.js docrt()'s
flush_screen(0) dropped the public score from 44 to 40. Many port call
sites rely on that flush; when a status repaint looks wrong, look for the
caller that flushes, not for docrt().

## '-' is the fight prefix in both number_pad modes

cmd.c:2772 commands_init() binds '-' to "fight" unconditionally;
reset_commands() never rebinds it. Ours printed "Unknown command '-'" and
then treated the next key as a normal command. The prefix validators
(g/G/F/m) must also count '-' as another prefix key. The refusal message
still names 'F' because cmd_from_func() skips '-' for !num_pad.

## doread's non-scroll arms

read.c:375-560: T-shirt and apron text, Hawaiian shirt design, dunce cap
and cornuthaum (tourists only, o_id % 3), credit card (message table plus
the number formula on o_id), can of grease, magic marker (red_mons[]),
coins, the Orb of Fate signature, candy bar wrapper, then "silly thing".
Ours said "That is a silly thing to read." for all of them, which cost a
whole turn of monster movement relative to C's --More-- flow. Two pieces
need ubirthday (NOTES "ubirthday"): hawaiian_motif/design hash o_id with
it, and erode_obj_text seeds wipeout_text with it for eroded shirts; both
are recorded as unported, everything else is ported.

## mhitm_ad_curs is a draw on every landed AD_CURS hit

uhitm.c:3042: the mhitu arm rolls rn2(10) after hitmsg() (unless a gremlin
by day), then attrcurse() and mon_give_prop(); the mhitm arm cancels the
defender, changes were form and destroys clay golems; the uhitm arm needs
night(). All three dispatch chains (mhitm.js mdamagem, mhitu.js hitmu,
uhitm.js damageum) fell to their unported default and skipped the roll.

## flip_level must flip rolling-boulder launch points

sp_lev.c:590 flip_level() moves ttmp->launch and launch2 for
ROLLING_BOULDER_TRAP and transposes pit conjoined bits with
flip_encoded_dir_bits(); ours flipped only tx/ty. On a flipped level the
trap's launch square held no boulder, so launch_obj() returned 0 with no
message and no draws, while C's boulder rolled and hit monsters (ohitmon
rnd(20) per victim). The census caught it deep in Gehennom (Dlvl 40).

## launch_obj's LAUNCH_UNSEEN arm prints

trap.c:3318: for a boulder, "You see a boulder start to roll." when the
launch square is in view, "You hear someone bowling." when hallucinating,
else "You hear rumbling nearby." (distu <= 16) or "in the distance."
Ours consumed the flag as animation-only.

## Hero-square memory follows _map_location order

display.c _map_location() maps object, then a seen trap, then engraving,
then background. newsym's hero arm skipped the trap layer, so a hero
blinded by the magic trap under them remembered floor; C remembers '^'
(seetrap() ran before the flash) and shows it once the hero steps off.

## ESC at the tombstone --More-- cancels the remaining pages

wintty.c process_text_window(): ESC at a page's --More-- sets WIN_CANCEL
and stops. end.js paged on regardless, showing an empty second page with a
--More-- where C had already printed the wizard-mode score notice.

## Pets shoot at lined-up monsters

dogmove.c pet_ranged_attk() -> mattackm() -> AT_WEAP with distmin > 1 ->
thrwmm() (mthrowu.c:969) -> monshoot() with gm.mtarget set. mattackm's
ranged arm was a note_unported placeholder; thrwmm() and m_lined_up() are
now in mthrowu.js (lined_up(), the hero-target form, stays in monmove.js).

## doengrave is the C shape

engrave.c:545-1498: doengrave_ctx_init, doengrave_sfx_item_WAN,
doengrave_sfx_item, doengrave_ctx_verb, doengrave, engrave (occupation with
stylus dulling, marker ink, truncation and finish messages), blind_writing
and blengr(). The old compressed doengrave accepted fingers and the fire
and digging wands only; every other stylus returned ECMD_TIME with no
message, so a quarterstaff "write" spent a turn and the prompt never came.
wand_explode (read.js) and the towel helpers (apply.js) are exported for
it. throw_obj's u_wipe_engr(2) and its bare-handed cockatrice arm were
placeholders too.

## The Rogue level has its own vision

vision.c:584: after the swallowed and Blind arms, vision_recalc() calls
rogue_vision() on the Rogue level instead of view_from(): a lit room is
seen out to its walls (doorways included) and the eight neighbours are
always seen. Ours ran the normal scan, which cannot reach a doorway cell
in the wall row when the Bresenham path to it crosses that wall, so the
doorway ('+' in the Rogue symset) stayed blank. A wizard-mode level
teleport to "rogue: 17" is how the fuzz found it.

## cmd_safety_prevention() has a second refusal

do.c:2325: with safe_wait, a no-op command is refused next to a hostile
("Are you waiting to get hit?") OR while Stoned/Slimed/Strangled/Sick
("Waiting doesn't feel like a good idea right now.", Norep). Ours only had
the first, so a strangled hero's '.' took a turn, moves advanced, and the
level teleport scheduled next ran after the monsters had moved instead of
before. The flag counter increments only when cmdassist is off
(`iflags.cmdassist || !(*flagcounter)++`). doeat() has its own Strangled
refusal ("If you can't breathe air, how can you consume solids?").

## Blocked moves belong to test_move()

domove_core() used a JS-only blocksMove() that returned "blocked" for walls
without test_move's DO_MOVE side effects: a blind hero rushing into a wall
never feel_location()ed it, so C remembered the wall and ours did not.
Obstructions and bars now go through test_move(DO_MOVE), whose wall arm is
the C one (drawbridge up, Sokoban walls, mention_walls naming the
background glyph via back_to_glyph/defsyms); the duplicate inline arms in
domove_core are gone. Closed doors are still handled inline there.

## ^X location annotations

insight.c:625: the "You are in <dungeon>, on level N" line appends ", a
primitive area" on the Rogue level and ", a very big room" on the big room
(when not blind). Is_bigroom() is the dungeon.h Lcheck against
bigroom_level; it lives in js/dungeon.js.

## Every AD type with a shared handler must be in every dispatch chain

uhitm.c:4782 mhitm_adtyping() is one switch used by hitmu, mdamagem and
damageum. The port has three if-ladders; hitmu's lacked AD_ACID, AD_DRIN,
AD_DREN and AD_SLOW although the shared handlers existed, so a 5.0 ice
devil's AT_TUCH/AD_SLOW 1d1 touch printed the hit message and skipped
mhitm_mgc_atk_negated()'s rn2(10). When adding a handler, grep all three
chains. Still unrouted for lack of handlers: SGLD, RUST, CORR, DCAY, CONF,
DISE, DGST, HALU.

## Symbol matching must use the active symbol set

js/drawing_data.js defsyms carries the DECgraphics symbols baked in
(`ch`/`dec`), which is right for the DECgraphics public corpus and wrong
for a game without that option. pager.js compared farlook/autodescribe
symbols against that table directly, so a plain '|' wall matched only the
grave entry and getpos autodescribe printed nothing. It now goes through
symbols.js showsym() (the active set with SYMBOLS= overrides), keeping the
defsyms explanation.

## Prayer in Gehennom

pray.c prayer_done(): "Since you are in Gehennom, %s can't help you." then
angrygods(u.ualign.type) unless the alignment record is positive and
rnl(record) is zero; angrygods() itself substitutes A_NONE (Moloch) while
Inhell. Ours fell through to the normal p_type arms and drew rnz(250).

## Engraving punctuation uses the trimmed-prefix offset

engrave.c:389 compares the last character with the pristine copy at
`off + elen - 1`, where off is how far wipe_engr_at() advanced the text
past leading spaces. Ours indexed the pristine copy without the offset,
so a degraded graffiti whose final '.' survived got a second period. The
231-character maxelen truncation is ported with it.

## Izchak

shknam.c nameshk(): the lighting shop on the Minetown town level is always
"+Izchak" (male), before any name-list arithmetic. The '+'/'_'/'-'/'|'
gender prefixes are stored with the name and stripped by shkname().

## keepdogs() stay-behind arms

dog.c:789: a follower that is eating or trapped stays ("is still
eating/trapped"), one carrying the Amulet is "very disoriented", a leashed
one left behind has its leash come loose, and a trapped one first tries
mintrap(). Level teleport past a feeding kitten printed nothing here.

## Corpse eaters draw through delobj()

mon.c:1656 meatcorpse(): a non-tame corpse_eater standing on a corpse
eats it after moving (m_move's post-move block, after meatmetal and
meatobj). m_consume_obj() -> delobj() -> obj_resists(obj, 0, 0) is the
rn2(100) the census saw as "obj_resists" right after an mtrack roll; the
"You hear a masticating sound." line is this function's unseen arm.

## moverock's trap switch is all draws and messages

hack.c:336 moverock(): a boulder pushed onto a landmine rolls rn2(10) and
may blow_up_landmine(); onto a pit it goes through flooreffects() ("The
boulder fills a pit.") which bury_objs() the pile there (one obj_resists
per object, rnd(250) per organic one); a hole or trap door plugs with a
message and bury_objs(); level teleporters and teleport traps move the
boulder away; a rolling boulder trap launches it. The placeholder that
returned -1 for every one of these left the hero standing still with no
message, and the missing bury draws surfaced two pushes later.

## Direction keys are cmdbinds

cmd.c:3462 reset_commands() removes whatever commands_init() put on the
direction characters and binds them (and highc()/C() forms without
number_pad, M(digit) with it) to the move/run/rush commands. So
cmdbind_get('l') is "moveeast" and key2extcmddesc('l') ends as "move east
(screen right) (#moveeast)"; the early "move"/"run" strings are only what
survives for keys that are not bound at all. cmdbind_table() now applies
that rebinding.

## Light-emitting monsters force a vision recalc

mon.c:1332: after all monsters have moved, `if (any_light_source())
gv.vision_full_recalc = 1` for every source type, and allmain.c:541
recalcs after rhack() before the flush. The port set the flag only for
object lights and had no post-rhack recalc, so a flaming sphere's light
was painted one square behind it and a boulder the hero had just pushed
next to themself stayed dark.

## Open: remembered dark floor after magic mapping (s17-30)

C describes a remembered lit-room square that is out of sight as "dark
part of a room" (its lev->glyph is S_darkroom under dark_room + color);
ours says "floor of a room". Our newsym() does rewrite S_room to
S_darkroom when the square leaves sight (traced), but the memory read
S_room again by the time of the farlook, with no further newsym on that
square: magic_map_background() writes back_to_glyph() (S_room for a
waslit square) in both C and the port, so C must re-darken it on a path
the port lacks (level return or docrt). Not resolved.

## makerooms() stops on the themeroom_failed flag, not on the outer room

Bug class: level generation. `mklev.c:418` breaks the room loop when
`gt.themeroom_failed` is set and there are already MAXNROFROOMS/6 rooms
(or eleven failed tries). The flag is raised by `lspo_room()` for ANY
des.room that fails, including a nested one: "Room in a room" creates its
outer room, then the inner `des.room` goes through `build_room` with a
parent and `create_subroom()` refuses a parent narrower than 4x4. The
outer room stands, the flag is set, and with seven rooms the C stops
generating. Our themerooms_generate() returned whether the OUTER room was
built, so makerooms() kept going: one more rnd_rect() draw and a vault
attempt, and generate_stairs_find_room() saw 3 candidates where the C had
7. Fixed in js/mklev.js: makerooms() clears and tests game.themeroom_failed
around the call, and the inline default-room path sets the flag when
create_room() fails (sp_lev.c:4104). fuzz-s18-37 step 0.

## Typed option values go through parseoptions, and their errors block

Bug class: input consumption (a whole key stream shifted by one). In the
'O' menu a compound option without a handler asks "Set NAME to what?" and
then calls `parseoptions("NAME:value", FALSE, FALSE)` (options.c:8686 in
doset_simple_menu, the same in doset). The option's optfn validates the
text; `optfn_statuslines` rejects anything but 2 or 3 with
`config_error_add("'statuslines:de' is invalid; must be 2 or 3")`. In play
`config_erradd()` (cfgfiles.c:1554) prints that with pline(), adding a
period, and calls wait_synch(). The pline leaves the top line in
TOPLINE_NEED_MORE, so when doset_simple() redisplays the menu,
tty_display_nhwindow() runs more() first and the --More-- swallows every
key until a space, return or ESC. Our port stored the raw string with no
validation and no message, so the menu came straight back and consumed the
keys the C's --More-- ate; the RET that closed the C's menu reached rhack
as ^J (rush south) in ours. Fixed in js/options.js: parseoptions() gained
the optfn_statuslines arm, both 'O' paths call parseoptions_interactive(),
which applies the parsed values to the live store and prints the collected
errors as config_erradd does, and js/tty/wintty.js gained tty_wait_synch().
fuzz-s18-02 step 83.

## An ESC'd --More-- also skips the more() before a menu

Bug class: extra prompt. wintty.c tty_display_nhwindow() begins with
`if (cw->flags & WIN_CANCEL) return;` and, for the message window,
WIN_CANCEL is the same bit as WIN_STOP. So the recursive
`tty_display_nhwindow(WIN_MESSAGE, TRUE)` that a menu or text window makes
to flush an unacknowledged top line returns at once after an ESC at the
previous --More--: no second --More--, and the menu's own clearing erases
the pending text. Our menu path called more() whenever toplin was
NEED_MORE. Seen at game start: the moon-phase message queued behind the
welcome line, ESC at that --More--, then the tutorial query. Our
ask_do_tutorial() also had a JS-only more() before its menu, which the C
does not have. Both fixed (js/tty/wintty.js, js/options.js). fuzz-s18-11
step 16.

## Terrain view: the cursor on the hero reads the terrain

Bug class: autodescribe text. pager.c:661 lookat() describes the hero only
when `!iflags.terrainmode || (iflags.terrainmode & TER_MON)`; #terrain's
browse_map() sets terrainmode without TER_MON, so the hero's square is
"floor of a room", not "human ranger called ricky". The same condition
also excludes a browse made while engulfed (save_uswallow and the
engulfer's glyph on the hero's square). Ported into js/pager.js lookat().
fuzz-s18-28 step 74.

## Racial volley bonus: gnomes and crossbows, elves and orcs and their bows

Bug class: RNG argument. dothrow.c:190 adds one multishot for an elf firing
elven arrows from an elven bow, an orc with orcish arrows and bow, a GNOME
with any crossbow (skill == -P_CROSSBOW, no gnomish gear needed), and one
more when the launcher is the hero's quest artifact; the crossbow strength
gate is 16 for gnomes, 18 for everyone else. Ours noted these arms as
unported, so a gnomish Ranger rolled rnd(2) where the C rolled rnd(3)
("You shoot 3 crossbow bolts"). Ported in js/dothrow.js throw_obj().
fuzz-s19-12 step 49.

## Prayer fixes every trouble the C fixes

Bug class: state drift found through an RNG argument. moveloop rolls
rn2(40 + ACURR(A_DEX) * 3) every turn, so the argument tracks Dexterity;
it went 73 -> 70 when a wall kick wounded a leg (set_wounded_legs does
ATEMP(A_DEX)--) and back to 73 in the C only, at a prayer. pleased() ->
fix_worst_trouble(TROUBLE_WOUNDED_LEGS) -> heal_legs(0) ("Your leg feels
better." queued behind the prayer --More--). Our fix_worst_trouble() had
only the TROUBLE_HIT arm and a note_unported default. Now js/pray.js has the
whole pray.c switch (stoned, slimed, strangled, lava, hunger, sick, region,
hit, collapsing, stuck in wall, cursed levitation, unuseable hands, cursed
blindfold, lycanthropy, punished, fumbling, cursed items, poisoned, blind
and deaf, wounded legs, stunned, confused, hallucination, saddle) plus
worst_cursed_item(), fix_curse_trouble(), stuck_in_wall(), blocked_boulder()
and in_trouble() in C form with the C's TROUBLE_ values; helpers added:
do_wear.js stuck_ring()/unchanger(), region.js region_danger()/
region_safety(), youprop.js Fixed_abil, attrib.js ABASE/AMAX/setABASE
exported, trap.js rescued_from_terrain exported. fuzz-s19-38 step 519.

## Boolean options that live in iflags

Bug class: two stores for one option. optlist.h homes autodescribe,
cmdassist, fireassist, menu_overlay and menu_tab_sep in iflags; getpos's
'#' toggled game.iflags.autodescribe while the 'O' menu read and wrote
game.flags.autodescribe, so the menu showed [true] after three toggles left
the C at [false]. options.js iflag_boolean_options now lists them (and is
exported), and jsmain routes rc values for those names into g.iflags.
fuzz-s19-07 step 256.

## Status line: 'showvers' version field and 'terrainstatus' terrain field

Bug class: missing status fields. With showvers on, the tty render_status()
right-justifies BL_VERS (" %s" of status_version()) at the end of the
second row: vstart = cols - lth in tty_curs() columns, which count from 1,
so "5.0.0" ends one cell before the last column. With terrainstatus on,
BL_TERRAIN (" %s" of terrain_descr[iflags.terrain_typ]) precedes it;
classify_terrain() (hack.c:3090) maps room/corridor to "Floor", doors to
"Doorway"/"Open-door"/"Shut-door", etc., runs from switch_terrain() and
from end_running() (after resetting terrain_typ to MAX_TYPE), and
u_on_newpos()'s level-change arm (dungeon.c:1586: map_location + terrain_typ
= MAX_TYPE) is now ported in teleport.js. Ported: version.js
status_version(), botl.js terrain_descr[], hack.js classify_terrain(),
display.js _statusLine2. BL_WEAPON/BL_ARMOR (weaponstatus/armorstatus) are
still absent. fuzz-s19-07 steps 289 and 292.

## Reading a scroll logs the literacy conduct break

Bug class: missing chronicle line. read.c:498 `if (!u.uconduct.literate++)
livelog_printf(LL_CONDUCT, "became literate by reading %s", book/scroll/
something)` for everything but the Book of the Dead, novels and blank
paper; the fortune cookie arm logs "a fortune cookie" when not blind. Ours
incremented the counter without the livelog, so #chronicle lacked
"1: became literate by reading a scroll". fuzz-s19-30 step 28.

## A rolling boulder is only drawn where the hero can see it

Bug class: stray glyph. display.c tmp_at()'s DISP_FLASH arm returns before
show_glyph() when !cansee(x, y) (unless DISP_ALWAYS). Our launch_obj()
used a JS-only display_object_at() that painted the boulder on every square
of its path, so an unlit square kept a boulder glyph after the crash
--More--. launch_obj() now uses the tmp_at() port (display.js) the way
trap.c does: DISP_FLASH with the object's glyph, tmp_at(x, y) at the top
of each step, DISP_END at the end. fuzz-s19-22 step 734.

## Import aliases: check the name you call exists in that file

monmove.js imports Is_rogue_level as IRL_const. A new call written as
Is_rogue_level() passed node --check and a module import (references are
resolved at call time) and took the public score from 44/44 to 5/44 with
"Is_rogue_level is not defined" on the first monster move. After adding a
call, run at least one session before the full gates, and grep the file's
import list for the exact identifier.

## Firing with an empty quiver applies a wielded polearm or bullwhip

Bug class: missing prompt. dothrow.c:508 dofire(): with nothing quivered
and autoquiver off, a wielded polearm goes to use_pole(uwep, TRUE) and a
wielded bullwhip to use_whip(uwep) (both then ask "In what direction?");
with fireassist and a quivered missile, a wielded polearm that could reach
a monster is applied instead. Ours noted the three arms as unported, so
an Archeologist's 'f' printed nothing and the next key ran as a command.
Now wired to apply.js use_pole()/use_whip()/could_pole_mon(), exported for
it. fuzz-s20-01 step 10.

## The first meal is a chronicle entry

Bug class: missing chronicle line. Every place the C bumps
u.uconduct.food logs LL_CONDUCT the first time: eat.c:2963 "ate for the
first time - %s" (food_xname) for ordinary food, eat.c:575
eating_conducts() "ate for the first time - %s" (monster name) for tinned
and brain meals with "consumed animal products (%s)" / "tasted meat (%s)"
follow-ups gated by ll_conduct, eat.c:1670 "(spinach)", and the non-food
and chewing arms. Ours counted without logging in three of them; ported
into eat.js doeat(), eating_conducts() and the spinach tin. fuzz-s20-01
step 64.

## from_what(): the blindfold and cream-pie arms

Bug class: wizard-mode ^X text. attrib.c:962 — when nothing extrinsic
gives blindness, "because of your blindfold" follows for Blindfolded_only,
and "due to goop covering your face" when the timeout equals u.ucreamed.
Added to js/insight.js from_what(). fuzz-s20-02 step 231.

## Disclosed possessions come from display_inventory(NULL, TRUE)

Bug class: menu semantics. end.c disclose(): the identified inventory is
display_inventory(NULL, TRUE), a PICK_ONE menu (want_reply), followed by
container_contents(invent, TRUE, TRUE, FALSE). An item letter closes it,
any other key rings the bell and waits; our hand-built PICK_NONE menu
closed on any key and ran that key as the next answer. Also,
windows.c:1822 add_menu_heading() suppresses heading highlighting while
program_state.gameover is set; our display_pickinv used a hardcoded
inverse and the suppression checked a flag name nothing set
(game.program_state.gameover vs game.program_state_gameover — the setter
form is the one everything else reads). fuzz-s20-02 steps 269-270.

## The simple options menu dispatches symset and whatis_coord too

doset_simple_menu() calls allopt[k].optfn(do_handler) for any compound
option with a handler; our chain lacked symset (do_symset) and
whatis_coord (handler_whatis_coord), so picking symset from the 'O' menu
redisplayed the menu instead of "Select symbol set:". fuzz-s20-08 step
162.

## An engraving in a corridor is drawn inverse

Bug class: attribute. display.c:2938 map_glyphinfo(): S_engrcorr whose
symbol equals S_corr's or S_litcorr's gets MG_BW_ENGR, and wintty.c
tty_print_glyph() draws MG_BW_* glyphs inverse when iflags.use_inverse is
on (its default). Applied in show_glyph_cell(), which is where a glyph
becomes a cell for both fresh and remembered renders. fuzz-s20-28 step 47
(wizard ^F magic mapping showed the engraving).

## Fountain and sink counters go through set_levltyp()

Bug class: RNG argument (dosounds). level.flags.nfountains gates the
rn2(400) fountain-sound roll and nsinks the rn2(300) one. The C keeps them
in three ways: mkfount()/mksink() call set_levltyp(), which recounts the
whole level whenever a square becomes or stops being a fountain or sink,
and THEN increment once more (so one mkfount() fountain reads as 2 in the
C; the double count is the C's and only truthiness is ever tested);
dryup()/breaksink()/the Excalibur gift also go through set_levltyp(); and a
themed room's des.feature("fountain") writes the terrain directly with no
count at all, so it is counted only when a later mkfount()/mksink() on the
same level recounts. Ours had mkfount() and an inline sink placement
writing typ directly with manual +1, and dryup()/breaksink() doing manual
-1/+1; the Garden fountain never got counted, and after the first fix the
manual decrement in dryup() left a dried fountain counted (three public
sessions regressed until fountain.js was moved to set_levltyp too).
fuzz-s21-03 step 8; sessions seed0007/0012/0014.

## thitu(): the full hit branch

Bug class: missing message. mthrowu.c:75 thitu() after "You are hit by
%s": acid venom with Acid_resistance says "It doesn't seem to hurt you."
(monstseesu M_SEEN_ACID); a stone missile through a rock-passing hero
"passes harmlessly through"/"doesn't harm"; a potion runs potionhit() and
is used up; otherwise a silver missile "sears your flesh" for a hero that
Hate_silver (u.ulycn or hates_silver(youmonst.data)), acid venom says "It
burns!" (monstunseesu), then losehp with the killer name (killer_xname and
KILLED_BY when the missile is formatted, KILLED_BY for names starting
the/an/a) and exercise(A_STR). Ours went straight to losehp. Added
mondata.js hates_silver()/is_were and youprop.js Hate_silver. fuzz-s21-15
step 125.

## The Hawaiian shirt motif decides a menu's placement

The recording-birthday class (hawaiian_design) reaches further than the
shirt's name: "an uncursed +0 Hawaiian shirt with a hibiscus flower motif
(being worn)" is 76 columns, so the tty's offx = max(10, cols - maxcol - 1)
hits 10 and the identified-inventory menu is drawn full screen at column 0;
our shorter name overlays it at column 32 and 769 cells differ. Not
fixable; fuzz-s21-27 step 54.

## Pet swap refusals are messages, not silent stops

hack.c domove_swap_with_pet() has four refusal arms and every one prints:
"You stop.  Fido can't move diagonally.", "... won't fit into the same spot
that you're at.", "... won't fit through.", and for a trapped pet "You
stop.  Fido can't move out of that bear trap." (feeltrap() first and
just_an() instead of "that " when the trap was unseen, then
handle_tip(TIP_UNTRAP_MON)). Ours stopped silently. s22-16 had been filed as
a "silent monster drift" because the footprint looked the same: the hero
does not move and no RNG differs. When a drift's C log shows a "You stop."
the gap is a message, not movement; check the swap arms before
instrumenting the recorder.

## avoid_running_into_trap_or_liquid() runs before the sticky-monster check

hack.c domove_core() calls avoid_running_into_trap_or_liquid(x, y) right
before escape_from_sticky_mon(). It only acts while context.run is set:
avoid_moving_on_trap() (and, blind, avoid_moving_on_liquid()) with
would_stop = (context.run >= 2); on a hit it nomul(0)s, and when would_stop
it also clears context.move and returns true so the move is abandoned
(s22-39, a running hero stopping short of a known trap where we walked on).

## ohitmon(): a thrown potion hits through potionhit()

mthrowu.c ohitmon() breaks a POTION_CLASS missile on the monster with
potionhit(mtmp, otmp, POTHIT_OTHER_THROW) and returns 1 before the damage
arm. Ours fell through to the generic hit (s22-39).

## dopay() for a blind hero

shk.c dopay(): "There appears to be no shopkeeper here" needs
`(!nshopkeepers && (!Blind || Blind_telepat)) || (!Blind && !seen)`; a blind
hero without telepathy on a level with no shopkeeper at all gets "You can't
see..." instead. Blind_telepat (HTelepat || ETelepat) added to youprop.js
(s22-39).

## getobj '?'/'*' lists the hands when they are allowed

invent.c getobj(): when the "hands" choice is allowed (allownone, from a
leading HANDS_SYM in the allowed list or a callback that DOWNPLAYs hands),
the '?'/'*' inventory menu appends a Miscellaneous heading and a
"- - your hands." row; display_pickinv() counts that row in its item count
(usextra), and the single-item shortcut goes through tty_message_menu with
"- - <handsbuf>.". getobj_hands_txt(action) picks the hands wording per
action. dodip() standing at a pool, fountain or sink (and not
menu_requested) uses dip_hands_ok(), which suggests the hands when Glib and
able to reach the floor, instead of dip_ok() (s22-02).

## getpos help: terrain views and the "a monster" goto

getpos.c getpos_help(): the #terrain views set iflags.terrainmode and the
help window drops what the view filtered out: TER_MON gates the m/M line,
TER_OBJ the o/O line, TER_MAP the d/D, x/X and a/A lines, TER_DETECT (set
for every #terrain view) drops the '!' and '"' menu lines, and the whole
tail (z/Z valid locations, '#' autodescribe, "Type a '.' when you are at
the right place." and the dowhatis key lines) sits in `if
(!iflags.terrainmode)`; only "Type Space or Escape when you're done." is
outside. The "a monster" goal gotos into that block at skip_non_mons, so
it skips '*', '!', '"', z/Z and '#' but prints the pick-key lines even in
a terrain view. The cmdassist whatis_coord hint is Sprintf'd into sbuf and
never putstr'd, so it prints nothing; do not add it (s22-30).

## The options help path is the judge's rc file, not the local recorder's

The options help intro prints get_configfile(), the C process's HOME rc
path. The public sessions carry the judge harness's
`/Users/davidbau/git/mazesofmenace/teleport/maud/test/comparison/c-harness/resul`
(cut at the terminal width) and options.js OPT_INTRO_CONFIG reproduces
that; s25-21 is another ^X moon/nighttime instance; reading a Hawaiian shirt (s24-23, "The design features ... on a ...
background.") is the ubirthday class from the entry above and stays a
note_unported, and so is the shirt's own name once it is fully identified
("with a tropical fish motif": read.c:190 hawaiian_motif() indexes its
table by `o_id ^ ubirthday`, s38-23); a local fuzz recording shows `/var/folders/.../nh-rec-XXXX/home/.nethackrc`
instead (s22-10). The held-out sessions come from the same harness as the
public ones, so the judge path is the right one and the local miss is
expected. Do not switch it for the fuzz corpus. s30-24 (`?` then `g`,
the options help intro) is another local `/var/folders` instance.

## A "silent monster drift" can be a missing message that moves the --More--

s23-27 showed ogres at different squares with the RNG stream identical, the
same footprint as the open drifts. It was not movement at all. The C's
grow_up() prints "The ogre grows up into an ogre lord." (pline_mon, before
set_mon_data/newsym, so the screen flushed for that message still shows the
old colour), and that third message forces a --More-- while the drinker is
acting, before the ogres later in the fmon sweep have moved. Our grow_up()
had the message stubbed, so our --More-- came from a later monster's
message, after those ogres had moved: same state, different snapshot. Rule:
when a drift's first bad screen carries a --More--, compare which message
produced it before instrumenting movement. Checklist first: what message is
pending in the C, does our port print it, and does the C flush before or
after the state change (pline_mon then newsym in grow_up).

## grow_up() messages and the awaited call chain

makemon.c grow_up(): "As X grows up into Y, he dies!" for a genocided grown
form (then mondied), otherwise "<Y monnam> grows up into / becomes
(humanoid) / changes into (gender flipped) an <buf>", where buf prefixes
"male "/"female " when the new form forces the other gender (is_male,
is_female of the new permonst decide fem). is_mplayer caps lev_limit at 30;
a shapeshifter's cham index follows the new type; a leashed monster refreshes
the persistent inventory. grow_up() is now async, so every caller awaits it:
muse.js (gain level potion), mhitm.js and the six uhitm.js kill sites use
`(await grow_up(magr, mdef)) ? 0 : M_ATTK_AGR_DIED`, mon.js and do.js
already awaited.

## mattackm(): unhiding a hidden defender speaks

mhitm.c mattackm(): a hidden (mundetected) defender that gets attacked is
revealed, and when the hero can see but not sense it the C prints one of:
"You dream of <plural noname>." (Unaware), "<Mon> emerges from hiding."
(iflags.last_msg == PLNMSG_HIDE_UNDER and the same last_hider), "You notice
<mon>." (last_hider), or "Suddenly, you notice <a mon>." (s23-20, a kitten
biting a hidden garter snake).

## doeat() resumes an interrupted meal

eat.c doeat(): choosing the object that is still context.victual.piece
prints "You resume your meal." (or "You consume the last bite of your
meal." when usedtime + 1 >= reqtime), clears canchoke unless Satiated,
re-touches the food (touchfood, do_reset_eat when it vanishes) and calls
start_eating(otmp, FALSE); it never says "You begin eating". Ours restarted
the meal (s23-20). The main loop's occupation arm also calls reset_eat()
after stop_occupation() when a monster comes into view (allmain.c:507); it
was a note_unported.

## slippery_ice_fumbling() and air_turbulence() run before every move

hack.c domove_core(), non-engulfed arm: air_turbulence() (Plane of Air,
rn2(4) then rn2(3) for the message, returns before moving) and then
slippery_ice_fumbling(): on ice without snow boots, cold resistance,
flight or a floater/clinger/whirly form, !rn2(Cold_resistance ? 3 : 2) sets
HFumbling FROMOUTSIDE with timeout 1; off the ice the FROMOUTSIDE bit is
cleared. Neither existed in the port; s23-11's RNG diverged at the rn2(2)
on an ice square.

## Terrain cells go through the active symbol set

detect.c reveal_terrain_getglyph() and display.c flash_glyph_at() return
glyphs that show_glyph() maps through the active symset. Our
back_to_glyph() returns a hardcoded DEC middle dot for ROOM (and DEC line
symbols for walls), which is right only under symset:DECgraphics; the
recipes without it draw '.' in the C. detect.js (btg_cell, back_cell) and
flash_glyph_at now use display.js terrain_glyph(), which looks the cmap up
in gs.showsyms like the normal newsym path (s23-25, a #terrain view of a
spot that remembered an object).

## Travel is a rush: dotravel() sets DOMOVE_RUSH before its first domove()

cmd.c dotravel() sets `gd.domove_attempting |= DOMOVE_RUSH` next to
context.travel/run = 8/nopick. domove() only calls maybe_smudge_engr()
when domove_succeeded carries a RUSH or WALK bit, so without that flag the
travel's first step never wipes the engraving the hero leaves (rnd(5) in
wipe_engr_at). Ours had no flag for travel; s24-39 diverged on a tutorial
level, which is carpeted with engravings. Continuation moves keep
attempting == 0 in both, so only the first step of a travel smudges.

## makemon(): trap knowledge and wand experience by location

makemon.c right before place_monster(): non-mindless monsters born in
Sokoban learn PIT and HOLE, in the castle TRAPDOOR, quest leaders and
nemeses know ALL_TRAPS; and monsters born in the castle, Fort Ludios, the
endgame, Gehennom, Vlad's tower or the quest get mwandexp = TRUE, so their
first attack-wand zap uses buzz() instead of buzz_force_miss(). s24-36 (a
wizard-mode hero on a quest level) diverged at zap_hit because our monster
was a first-time zapper. mon_learns_traps() in trap.js now has the C's
ALL_TRAPS (~0) and NO_TRAP (0) arms; mondata.js keeps its private copy for
mons_see_trap. dungeon.js gained In_hell() (the dungeon's hellish flag).

## m_throw(): venom and cream pies blind through can_blnd() and make_blinded()

mthrowu.c m_throw(): a hit by BLINDING_VENOM or CREAM_PIE (or POT_BLINDNESS)
rolls rnd(25) only when can_blnd(NULL, &youmonst, AT_SPIT/AT_WEAP, obj)
allows it (blindfold, lenses and an existing cream coating protect), prints
"The venom blinds you." or "Your eyes sting." by eyecount, and at the end
of m_throw() adds the roll to u.ucreamed and make_blinded(BlindedTimeout +
inc, FALSE), with "Your vision quickly clears." if still not blind. Ours
had make_blinded as a note_unported, so the hero stayed sighted (s24-31:
the C hid the monsters and showed Blind on the status line). The port also
read a non-existent `game.u.ublind`; the accessor is Blind().

## The silent monster drifts were m_search_items() filters

s13-31, s14-23 and s17-03 (RNG identical, monsters elsewhere, no message
gap) all came from monmove.c m_search_items(): the C skips an object that
lies under a helpless (sleeping or paralysed) monster, a mines or Sokoban
prize, an unpaid item on a shop square (costly_spot() && !no_charge), and
anything the monster cannot touch safely (can_touch_safely()); ours only
skipped hidden/mimicking/immobile monsters. In s14-23 a forest centaur on a
shortsighted Gehennom level walked toward a corpse under a sleeping wraith
(appr 1, track roll rn2(24)) where the C, with no goal but the far hero,
went to appr 0 (the !rn2(++chcnt) chain). A hostile monster approaching
a goal draws no RNG in m_move, so a wrong goal shows up only as positions,
and every later RNG draw still lines up until a monster that moved
differently reaches an RNG-bearing branch, often thousands of calls later.
Triage rule for a drift: run the MMPROBE hook in monmove.js
(`globalThis.__mm_probe = 1` before importing tools/jsplay.mjs) and dump
the goal (gg) of the monster whose track roll differs; a goal that is not
the hero's mux/muy is an item search result, so compare m_search_items()
line by line before instrumenting the recorder. The recorder monster-log
patch was not needed.

## Temple priests: shralign is A_NONE on an unaligned altar

priest.c priestini() sets EPRI(priest)->shralign = Amask2align(altarmask),
and align.h's Amask2align maps AM_NONE to A_NONE (-128), not to neutral.
priest.js carried a private Amask2align that returned 0 for "no
alignment", so a Valley priest (Moloch's unaligned shrine) looked neutral:
has_shrine() then failed (monmove.js compares against the real helper),
inhistemple() was false, and temple_priest_sound() never rolled its rn2(3)
(s25-25). The private helper is gone; priest.js imports const.js's. The
sanctum Amulet arm ("shralign == A_NONE && on sanctum level") had been
written as `=== 0` to match the private helper; it now compares against
A_NONE. That arm was the regression the census caught (s22-12, seed0360:
wizard-mode games that reach the sanctum): with the helper fixed and the
arm still `=== 0`, the high priest lost the Amulet and the RNG shifted by
the amulet's mksobj draws. Lesson: when a local copy of a C macro is
replaced, grep for every comparison written against the copy's wrong
outputs.

## dochug(): killer bees eat royal jelly, gelatinous cubes digest

monmove.c dochug() PHASE THREE opens with two 5.0 arms: a killer bee
standing on a lump of royal jelly with no queen on the level eats it
(splitobj/delobj, m_lev raised to queen-1, grow_up(), then mfrozen for
3/5/7 turns by BUC), and a gelatinous cube digests the first organic,
non-artifact, non-prize object in its inventory (eaten_stat, extract from
minvent, m_consume_obj). Neither existed in the port (s25-24: delobj's
obj_resists rn2(100) then grow_up's rnd(8)). bee_eat_jelly() and
gelcube_digests() live in monmove.js with a local find_pmmonst() and
is_organic(); their helpers are imported dynamically (static imports of
mkobj/mon/makemon/objnam/invent/worn from monmove.js were tried first and
were harmless, but the dynamic form keeps the module graph as it was).

## Status conditions shrink before they truncate

wintty.c tty_status_update(): the second status row must fit in cols - 1
cells; when it does not, condition names fall back to their second and
then third text (botl.c conditions[] txt2/txt3: Strngl/Stngl/Str,
Slime/Slim/Slm, Stone/Ston/Sto, TermIll/Ill/Ill, FoodPois/Fpois/Poi,
Blind/Blnd/Bl, Conf/Cnf/Cf, Deaf/Def/Df, Fly/Fly/Fl, Hallu/Hal/Hl,
Lev/Lev/Lv, Ride/Rid/Rd, Stun/Stun/St, InLava/Lav/La) before anything
else is shrunk. Ours printed the long names and let the terminal clip
them (s25-34, a wizintrinsic pile-up). Conditions are ordered by the
conditions[] ranking with a case-insensitive useroption tie-break (Strngl
4; FoodPois/Slime/Stone/TermIll 6; InLava 8; the rest 10). bot_conditions()
now takes the shrink level and _statusLine2() tries 0, 1, 2. The
encumbrance-word and Dlvl shrinking that follows level 2 is not ported.

## #wizintrinsic writes the canonical fields and calls float_vs_flight()

wizcmds.c wiz_intrinsic(): every property goes through
incr_itimeout(&u.uprops[p].intrinsic); afterwards LEVITATION and FLYING
call float_vs_flight() (Levitation blocks Fly on the status line via
BFlying's I_SPECIAL), PROT_FROM_SHAPE_CHANGERS calls rescham(), and
WWALKING/LEVITATION/FLYING run pooleffects() when in water. Our default
arm stored a side table plus uprops[key]; STRANGLED now increments
intrinsic.HStrangled (timeout.js and botl.js read it) and the tail is
ported (s25-34: "Strngl" missing, "Fl" shown).

## Character selection menus: RET means random, capitals are group keys

role.c genl_player_setup(): at each of the four PICK_ONE menus a <return>
or <space> with nothing selected makes select_menu() return 0 and the C
uses ROLE_RANDOM ("choice = (n == 0) ? ROLE_RANDOM : ROLE_NONE"); ours
returned ROLE_NONE and quit (s12-31, s17-07, s21-37, s24-03). The
setup_*menu() entries carry the capital of their letter as the group
accelerator (add_menu gch = highc(this_ch)), and tty PICK_ONE accepts a
group accelerator that matches exactly one entry (invert_all, then
finished), so 'N' picks neutral and 'C' chaotic while 'X' is ignored;
verified by recording three probes with the recorder. plselect.js's
select_menu_pick_one() now honours both rules.

## find_trap() shows the trap glyph through map_trap(), not newsym()

detect.c find_trap(): when the remembered glyph at the found trap is not
the trap (an object lies on it), the C does cls(), map_trap(trap, 1),
display_self(), prints "You find a ..." and only redraws after the
--More--. Ours substituted newsym() for map_trap(), which put the object
back on top (s26-31: '%' where the C shows '^'). map_trap() is exported
from display.js and used directly.

## makeplural(): man/men

objnam.c makeplural(): a word ending in "man" that badman() does not
exclude becomes "men" with Strcasecpy ("Caveman" -> "Cavemen", used by
wield.c's "%s aren't able to use two weapons at once."); ours appended
"s" (s26-13). The rule sits before the s/x/z/ch/sh and y rules.

## tty_putstr(BASE_WINDOW) writes only its characters

wintty.c tty_putstr(), NHW_BASE arm: the string goes to the window cursor
with no cl_end(), wrapping at the last column, then curx = 0 and cury++.
Ours padded the rest of the row with spaces. It showed at the rename
prompt: after 'a' on "Is this ok?", docorner() has left the base cursor on
the menu's last row and askname() prints "Who are you? " over the row that
still holds the first prompt and the old name, so the C screen reads
"Who are you? Hextru___..." with the cursor after the prompt (s26-33).
tty_askname()'s retry arm now uses an explicit tty_cl_end_base() where the
C calls cl_end().

## Option handlers: msg_window and runmode

options.c handler_msg_window() ("Select message history display type:",
entries "%-12.12s%c%.60s" from msgwind[] with the second description line
on a following text row, current setting preselected, then "'msg_window'
changed to/is still ...") and handler_runmode() ("Select run/travel display
mode:", teleport/run/walk/crawl) were missing; the doset dispatch skipped
them, so the next selected handler's menu appeared in their place (s26-10).

## Open: s26-12, a giant spider's web roll after moving

monmove.c postmov(): maybe_spin_web() runs for a moved or done monster.
In s26-12 turn 17 the C's first giant spider takes its track roll, moves,
and does NOT roll rn2(1000); ours rolls after the same move. mfndpos,
m_harmless_trap (webs are harmless to webmakers), mspec_used, helpless,
t_at, the postmov block, the track ring and the m_move tail (mdisplacem /
m_in_out_region / boulder returns) all match the C; the level and the web
trap position (a mktrap web with a spider generated on it at level
creation, step 154) are shared since the RNG matches through them. Not
resolved; the recorder would need a debug print of maybe_spin_web()'s
condition values to settle which one differs.

## key2extcmddesc() strips " (##)"

cmd.c key2extcmddesc() appends " (#<extcmd>)" to a bound command's
description, then removes the literal " (##)" so the '#' key reads "enter
and perform an extended command." rather than "... command (##)."; ours
kept the suffix (s27-11, the '?' "What command?" viewer).

## mount_steed(): wounded legs, polymorphed form, and seeing the steed

steed.c mount_steed() refuses a hero with Wounded_legs before anything
else about the steed: legs_in_no_shape("riding") ("Your right leg is in no
shape for riding."), and in wizard mode with force a "Heal your leg(s)?"
question; a polymorphed hero that is not humanoid, or is very small, big or
slithy, "won't fit on a saddle."; and the visibility test is (Blind &&
!Blind_telepat) || mundetected || mimicking furniture or an object. Ours
skipped the first two (s27-23 went straight to "I see nobody there.") and
read a `u.ublind` field that does not exist.

## getpos 'o': a boulder on a pile is still an object target

getpos.c gather_locs_interesting(GLOC_OBJS) excludes objnum_to_glyph(BOULDER)
and (ROCK), the plain object glyphs; a boulder or rock drawn as the top of a
pile carries the 5.0 piletop glyph offset and passes, so 'o' visits that
square and autodescribe says "a boulder". Ours excluded boulders by type
regardless of the pile flag and skipped to the next object (s28-30).

## dosdoor(): trapped doors can be mimics

mklev.c dosdoor(): a door that came out D_TRAPPED becomes, at
level_difficulty() >= 9 with a 1 in 5 roll and while any mimic species
survives, a doorway with a mimic created by makemon(mkclass(S_MIMIC, 0))
and set_mimic_sym(). Ours rolled the rn2(5) but never made the monster
(s28-25: mkclass_aligned's rolls and the mimic's makemon missing from the
level-creation stream).

## dodown() at a seen pit or escaped shaft plunges

do.c dodown(): standing on a seen pit after climbing to its edge
(uteetering_at_seen_pit) or on an escaped hole (uescaped_shaft), '>' calls
dotrap(trap, TOOKPLUNGE) ("You plunge into a pit!" with rn1(6,2) trapped
turns). Ours had that arm as a note_unported (s28-16).

## launch_obj(): "hits another" vs "sets another in motion"

trap.c launch_obj(): when a rolling boulder meets another boulder the
message is "You hear a loud crash as one boulder sets another in motion!"
unless the square beyond is off the map, the roll has no range left, or
that square is obstructed, in which case it is "... as one boulder hits
another!". Ours always said "sets another in motion" (s28-30).

## getmattk(): elementals on their home plane double their dice

A fire elemental on the Plane of Fire hit for `d(6,6)` at
`hitmu(mhitu.c:1187)` while ours rolled `d(3,6)`; the monster table is
3d6 on both sides (s30-21). mhitu.c:436 doubles `damn` when
`is_home_elemental(mptr)` and no alternate attack buffer was used. Our
getmattk() returned early from each substitution arm, so the doubling had
nowhere to go; it is now the C's `if / else if` chain with the elemental
arm after it, and the mhitu.c:399 arm (barrow wight, Nazgul, erinys weapon
attacks forced to AD_PHYS when cancelled or wielding a cockatrice corpse,
Stormbringer or Vorpal Blade) is ported in its place in the chain.

## rnd_misc_item(): See_invisible, and demon princes start out peaceful

Two makemon.js bugs behind one miss (s30-04, a level teleport onto
Asmodeus' lair). `rnd_misc_item()` case 1 returns 0 for a peaceful monster
when the hero lacks see invisible; ours tested `game.u.uprops?.SEE_INVIS`,
which is a property record, so the branch never fired and m_initinv drew
an extra `rn2(6)`. It now calls youprop.js `See_invisible()`. Second,
makemon.c:1397 makes a bribable demon prince (`is_dprince && MS_BRIBE`)
peaceful and invisible at creation unless the hero wields Excalibur or
Demonbane, and makemon.c:1403 makes a raven peaceful when the hero wields
a bec de corbin; both arms sit between the peace_minded() assignment and
m_initinv(), so they decide what the prince carries. Ported.

## hitmu(): rust and decay arms

`mhitm_ad_rust()` and `mhitm_ad_dcay()` had no mhitu arm, so a brown
pudding's bite printed nothing and skipped `erode_armor()`'s `rn2(5)`
slot loop (s31-20: the C rolled two `rn2(5)` there, ours went straight to
the knockback rolls). Both arms are now in hitmu's chain: hitmsg, cancelled
monsters do nothing, a hero polymorphed into something that completely
rusts or rots gets "You rust!"/"You rot!" and rehumanize(), otherwise
erode_armor(youmonst, ERODE_RUST/ERODE_ROT).

## Enlightenment reports the hero's trap

insight.c:1086 prints "You are trapped in a bear trap." (or the steed's
predicament) after the Punished line; `trap_predicament()` (insight.c:233)
builds it, with `{n}` escape counters in wizard mode. Ours lacked the whole
block, so the ^X page had one line too few (s30-18).

## disclose is parsed when the option is set

`optfn_disclose()`'s do_set arm writes `flags.end_disclose` while the rc is
read, and the `O` menu's compound value is that array: an rc with
`disclose:yi ya yv yg yc yo` shows exactly that, ours showed the default
`ni na nv ng nc no` (s30-37). parseoptions() now ports the arm (prefix
settings y/n/?/+/-/#, category letters iavgco with k->v and d->o, "all",
"none", and the "Unknown disclose parameter" error); end.js keeps its lazy
fallback for rcs that never set the option.

## The escape summary lists valuables, artifacts and pets

end.c's `done()` block for ESCAPED/ASCENDED counts gems and amulets
(`get_valuables`, points added with `nowrap_add`), scores artifacts
(`artifact_score`, counting then listing), prints "You and <pet>" when
`gm.mydogs` is non-empty or Schroedinger's cat was resolved live, and
then lists the valuables sorted by count, "worthless pieces of colored
glass" included. Ours printed only the points line, so a wizard who left
with one piece of glass was short a line (s31-29). The Schroedinger
resolution (`observe_quantum_cat(obj, FALSE, FALSE)` in the pre-disclosure
identification loop, end.c:1266) is ported with it because the final score
counts the same cat.

## flip_level() flips the monster grid as a grid

sp_lev.c:835 swaps `level.monsters[x][y]` cell by cell alongside the
terrain, so only a monster that is on the grid moves on it. A detached
monster (a statue's mongone() template from create_object(), still on
fmon until dmonsfree()) keeps its stale mx,my, has them flipped like any
other fmon entry, and stays off the grid. Our re-key loop inserted every
flipped monster into level.monAt, so the dead dragon template landed on
the nymph's square and the nymph lost its grid slot (s32-12, Medusa's
level: no 'n' on our map, and the dragon later walked onto it). The loop
now takes the on-grid monsters off first, flips everyone, and re-keys only
those.

## throw_ok(): slings suggest gems

`uslinging()` (obj.h:269, the wielded weapon's skill is P_SLING) decides
which classes `t` suggests: weapons when not slinging, gems when slinging
(s32-15: `[cd or ?*]` for a hero wielding a sling, ours offered the
dagger). The `bknown && welded` downplay arm was missing too. Both ported.

## number_pad: handler, reset_commands() and the freed vi keys

`O` > number_pad opens `handler_number_pad()`'s six-mode menu (s32-35).
The mode writes iflags.num_pad and iflags.num_pad_mode, and cmd.c:3343
`reset_commands()` derives Cmd.num_pad, Cmd.swap_yz, Cmd.pcHack_compat,
Cmd.phone_layout and Cmd.dirchars ("41236987" for the phone layout) from
them; the same runs from the rc's number_pad:N (optfn_number_pad's do_set
arm, now parsed in parseoptions and wired in jsmain) and from the O
menu's compound value path. Consequences the port had missed: with
number_pad on, rhack() recognises movement through the key's binding
(cmdbind_table() per Cmd.dirchars), so digits walk, M-digit runs, and the
vi letters reach the commands_init() alternates 'h' help, 'j' jump, 'k'
kick, 'l' loot, 'u' untrap, 'N' name, ^L redraw, ^N annotate (all now
bound); a count needs the 'n' prefix (parse(), cmd.c:5087); and any other
bound key runs its command through execute_extcmd() instead of "Unknown
command". swap_yz and the phone layout's own key swaps are recorded as
unported when they turn on. tty_number_pad() only emits termcap keypad
strings, which have no cells.

## The color option gates every glyph color

include/flag.h:507 makes iflags.use_color the `color` boolean itself, and
map_glyphinfo() (display.c:3078) turns every glyph color into NO_COLOR
when it is off; flags.dark_room needs it too. Our glyph builders never
looked at it, so a game that toggled `color` off in the O menu kept
painting colors after the next docrt (s32-35, cell attributes only).
show_glyph_cell() now applies the gate and dark_room_color() includes it.
The tty's inverse substitutes for lava/ice/sink/engraving when color is
off (MG_BW_*, wintty.c:3932) are only ported for the corridor engraving.

## Graveyard levels: has_morgue sets level.flags.graveyard

mklev.c:1560, at the end of makelevel(): a level that got a morgue sets
`graveyard`, which LEVEL_SPECIFIC_NOCORPSE() reads as a `rn2(3)` chance
of no undead corpse in xkilled(). Ours only set it inside mkzoo(MORGUE)
via mkroom.c:474 (which the C also does), but this end-of-level line was
missing, so a zombie killed on such a level skipped the roll (s33-32).

## getpos: '*' skips same glyphs on shifted moves

With iflags.getloc_moveskip on (the '*' toggle, or whatis_moveskip), a
shifted or control direction walks the cursor while the glyph under it
stays the same instead of jumping 8 squares (getpos.c:922); across
unexplored area that is the map edge (s33-13). Ported with record
equality standing in for glyph equality.

## Menu dismissal leaves disp.botlx up

windows.c:1860 select_menu() disables bot() for the whole window-port
call, so the docrt() inside tty_dismiss_nhwindow() cannot repaint the
status rows; docrt sets disp.botlx and the next flush_screen(1) paints
them once select_menu has returned. Our erase_menu_or_text() called bot()
directly without raising botlx, so a full-screen inventory menu dismissed
with RET left rows 22-23 blank until the next status change (s33-11).

## mon_arrive(): stairs, ladders, portals and the wander step

dog.c:500-612 places an arriving monster from its migration record:
MIGR_STAIRS_UP/DOWN and MIGR_LADDER_UP/DOWN through
`stairway_find_from(&fromdlev, isladder)`, MIGR_SSTAIRS through
`stairway_find()`, MIGR_PORTAL at the level's magic portal (or an endgame
updest rn1 pair), and then, when the monster spent turns in limbo
(`wander`), a nearby spot: `somexy()` of the room it lands in, else
`rn1(j - i, i)` on each axis. Ours had only APPROX/EXACT/WITH_HERO and
left the wander block as note_unported, so a pet arriving after a level
teleport was rloc'd instead of nudged (s34-13, `rnd(79)` for the C's
`rn2(15)`). stairs.c's two finders now live in js/stairs.js; the record
keeps fromdlev in mtrack[2].

## magic_map_background() keeps non-background memory

display.c:243 overwrites `lev->glyph` only when it is unexplored or a
cmap glyph; an object, a trap, a warning or the remembered 'I' of an
unseen monster survives magic mapping, and newsym() then re-shows the
'I' through map_invisible(). Ours guessed "object memory" from the symbol
and overwrote everything else, so a wizard ^F wiped an 'I' next to the
hero (s34-27). Records that name their glyph kind now decide directly.

## rest_on_space binds <space> to #wait

cmd.c update_rest_on_space(): with the option On, <space> runs a clone of
the '.' entry named "wait"; Off, it is unbound and prints "Unknown
command ' '." A game that toggled the option in the O menu kept getting
the message from us while the C rested (s34-34). cmdbind_table() now
binds it, execute_extcmd() runs donull for "wait", and the key listing
skips <space> only while the option is Off.

## The tutorial refuses #save through cmd_before

nhlib.lua registers `tutorial_cmd_before` (blacklist: save) on entering
the tutorial and removes it on leaving; cmd.c:461 can_do_extcmd() runs
the cmd_before callbacks before any command and silently refuses when one
returns false (rhack: reset_cmd_vars, no time). Ours prompted "Really
save?" inside the tutorial (s34-26). nhlua.js now carries nh_callback()
and nh_callback_run() with the tutorial's callback, and rhack applies
can_do_extcmd() to the key's bound command, which also brings the
wizard-only and buried refusals to one place.

## The O menu's sortvanquished handler

optfn_sortvanquished's do_handler arm runs insight.c set_vanq_order(TRUE)
(the seven-way sort menu) and reports "'sortvanquished' changed to /
not changed, still \"t: traditional: ...\"". The full O menu processes
every pick in order, so a session that had selected pickup_types and
sortvanquished got the sort menu right after cancelling the autopickup
prompt; ours stopped (s34-34). Both doset chains dispatch it now.

## Conduct: the Sokoban line

insight.c:2216 prints "You did not violate any of the special Sokoban
rules." (or "violated ... N times") only when sokoban_in_play(), i.e. the
entered-Sokoban achievement is set; ours never printed it, so the
conduct window came out a line short and narrower (s35-35).

## An unknown command does not cancel a rush prefix

cmd.c:3833, the bad_command tail of rhack(): the message goes out with
SUPPRESS_HISTORY, both command queues are dropped, context.move and multi
are cleared, and that is all. reset_cmd_vars() does NOT run, so the
context.run and domove_attempting a 'g' or 'G' prefix set stay for the
next command; only prefix_seen, a local of that rhack() call, is gone.
Two visible consequences (s36-17, s36-20): a direction key typed after
"g<space>" rushes ("It's a wall." at the far end), and any other command
typed then runs normally but the T: field is not refreshed, because
allmain.c:262 sets time_botl only while !context.run. Ours ran
reset_cmd_vars() from rhack's tail for every no-time command and then, once
that was fixed, still keyed the "The 'g' prefix should be followed by a
movement command" refusal on domove_attempting; both now follow the C
(refusals key on the pending-prefix marker only).

## reglyph_darkroom() on arrival and on redraw

display.c:1818: after a level is in place (do.c:1715, before
vision_reset(), so cansee() still answers for the level being left) and
after an option change that needs a redraw (options.c:8999), every
remembered floor and corridor glyph is re-derived from dark_room and
color: out-of-sight lit floor becomes S_darkroom, S_litcorr reverts to
S_corr, and with dark_room off S_darkroom goes back to S_room or
nothing. Ours never ran it, so a Sokoban level's premapped floor stayed
S_room out of sight and autodescribe said "floor of a room" where the C
says "dark part of a room" (s37-26). Ported into display.js and called
from both sites.

## test_move(): walking into a closed door without autoopen

hack.c:1097, the DO_MOVE arm for a closed door: an amorphous hero is told
it can't squeeze its possessions through; with autoopen on and the hero
not running, confused, stunned or fumbling, doopen_indir() opens it (this
port runs that arm before domove(), js/cmd.js's closed-door pre-check, so
test_move() never sees it); otherwise an orthogonal bump while Blind,
Stunned, Fumbling or with Dex below 10 prints "Ouch!  You bump into a
door." (or "You can't lead <steed> through that closed door."), exercises
Dex, marks door_opened and move so the turn is spent, and nomul(0)s;
anyone else just hears "That door is closed." The whole else-branch was a
note_unported; it is reachable by any game that toggles autoopen off or
walks into a door while confused.

## Menu keys outside the response set are ignored, count and all

win/tty/wintty.c:1329 process_menu_window() collects every selector and
group accelerator into a response string and hands it to
win/tty/getline.c:230 xwaitforspace(), which returns only those keys plus
space, digits, ESC, newline, carriage return, the menu commands
`^|><.-@,\~:` and the dismiss_more key; anything else rings the bell
and is dropped before the loop's count logic runs. Ours fed every key to
the loop, so a stray letter typed while a count was pending ended the
count and a non-selector could act as a selection (s39-07). The
tty_select_menu loop now applies the same filter.

## forget_temple_entry() when a level is saved

priest.c:545 forget_temple_entry() zeroes a priest's intone, enter,
peaceful and hostile timestamps; save.c:894 savelev() calls it for every
temple priest as the level is put away and mkobj.c:2160 save_mtraits()
does the same for one that migrates in a corpse or statue. Coming back
to the level then re-runs the temple entry ("You experience a strange
sense of peace", the intoning) as if for the first time. Ours kept the
times, so the return visit was silent (s39-11). Both call sites ported.

## put_lregion_here() removes a trap under a one-shot placement

mkmaze.c:413, the oneshot arm: when a level region with exactly one
candidate square (a branch stairs or portal placed by place_lregion)
lands on a square that already holds a destroyable trap, the trap is
deleted (clearing any monster trapped in it) before the stairs go down.
Ours left the trap in place, and the extra trap shifted every later trap
lookup on that level (s39-39).

## mdrop_obj() calls distant_name() even when nobody sees it

steal.c:823: mdrop_obj() evaluates distant_name(obj, doname) before
deciding whether to print, "for its possible side-effects" (doname marks
dknown and friends). Ours only named the object inside the message arm,
so a pet dropping something out of sight left it unidentified in a way
the C does not (s40-01).

## launch_obj() does not recalc vision when the boulder leaves

trap.c:3260 launch_obj(): removing the boulder from the launch square
only schedules a vision update (unblock_point sets vision_full_recalc),
and flush_screen() never recalcs, so the boulder's flight and the
flooreffects() at the far end see the map as it was with the boulder
still blocking the line: a pit behind it gives "You hear a boulder
fall." rather than the seen message (s40-33). Ours called vision_recalc
right after the removal; the moveloop does it in the C.

## tele_trap() puts the departure square on the hero's trail

teleport.c:1492 tele_trap(): for a trap with a fixed destination the C
calls settrack() first (the hero is still on the trap, so the trap square
becomes the newest trail entry), moves any monster standing on the
destination aside with enexto()/rloc_to() ("You shudder for a moment."
if the level is too full), and only then teleds(). settrack() is called
from exactly two places in the C, allmain.c:242 and this one. Ours went
straight to teleds(), so the pet's dog_move() trail search in the C found
the trap square and ours found nothing there and aimed elsewhere
(s41-01). dotele() (teleport.c:1034), the hero-invoked ^T onto a vault
trap, keeps its plain teleds(); the arm lives in trap.js's
trapeffect_telep_trap, which is where the hero's trap effect runs here.

## newcham()'s tail runs even without a message, and in order

mon.c:5484: after the optional "turns into" message, newcham() always
runs the vampshifter marking, possibly_unwield(), mon_break_armor(),
mselftouch() without gloves, check_gear_next_turn(), the ex-giant boulder
drop, poly_steed() and the Elbereth flee re-test. mon_break_armor()
(worn.c:1177) computes mhim() and mhis() on entry, so while hallucinating
it draws rn2(4) twice whether or not anything is worn. Ours ran that tail
only when a message was shown, and as a detached promise: makemon()
gives a shapeshifter its starting form through newcham() from
synchronous level creation, and mon_break_armor() opened with an awaited
dynamic import, so the two rolls landed after the next des.monster()'s
induced_align() (s42-03, a hallucinating hero level-teleporting into the
Valley). Now the tail always runs, possibly_unwield() is awaited only
when something is wielded (a monster still being created wields
nothing), mon_break_armor() imports statically, the nine newcham() calls
in async callers await it, and poly_steed() is ported.

## The O menu's "menu colors" handler and MENUCOLOR

options.c:6407 handler_menu_colors(): handle_add_list_remove() (:9208)
puts up "Do what?" with add/list/remove/exit (list and remove only once
there are entries, exit preselected); add asks "What new menucolor
pattern?", validates it with test_regex_pattern() (:7871), then
query_color() and query_attr() (coloratt.c:475, :396) pick from menus
whose color entries are shown in their own colors because
basic_menu_colors() temporarily swaps in name-matching patterns; list
and remove show `"pattern"=color[&attr]` lines. The coloring itself is
applied by the core add_menu() (windows.c:1805, get_menu_coloring()) to
every menu entry not flagged MENU_ITEMFLAGS_SKIPMENUCOLORS (headings);
this port's callers reach tty_add_menu() directly, so that hook lives
there. MENUCOLOR= rc lines go through cfgfiles.c:1164 add_menu_coloring().
Ours fell into the no-handler "Set menu colors to what?" getlin (s42-11).
iflags.use_menu_color is game.iflags.menucolors. Regular expressions:
sys/share/posixregex.c hands patterns to libc regcomp(REG_EXTENDED), so
js/posixregex.js validates the POSIX ERE with the error codes and
regerror() strings of the recorder's libc (macOS, probed with a small C
program: "repetition-operator operand invalid", "parentheses not
balanced", ...) and matches with an equivalent JS RegExp. A reference
recorded on glibc would differ in that error text only. Bad values typed
at these prompts go through config_error_add()'s interactive arm
(cfgfiles.c:1544: pline plus wait_synch), so options.js now keeps C's
config_error_data around each parse instead of threading the result.

## A Samurai pre-discovers every Japanese-named item

u_init.c:744: after knows_class(WEAPON_CLASS) and knows_class(ARMOR_CLASS)
the Samurai arm walks objects[MAXOCLASSES..NUM_OBJECTS) and calls
knows_object(i, FALSE) for everything Japanese_item_name() renames,
skipping oc_magic (the magic koto). That is what puts "gunyoki [food
ration]", "potion of sake [booze]" and "osaku [lock pick]" on the '\'
discoveries list under Comestibles, Potions and Tools. Ours had replaced
the loop with a comment saying it draws nothing; it draws nothing but it
lengthens the list by a page (s43-07).

## getpos feature search: the third probe is the terrain itself

getpos.c:1050, the '<' '>' '_' '{' ... feature keys: for each square the
C checks the displayed glyph, then (with hero_memory and not in a
#terrain view) the remembered glyph, then '~' against
known_vibrating_square_at(), and last, when the square has ever been
seen (levl[x][y].seenv), back_to_glyph() of the actual terrain. Ours
stopped after the remembered glyph, so '>' in the travel prompt could not
find stairs lying under a corpse and said "Can't find dungeon feature
'>'." where the C moved the cursor and autodescribed the corpse (s43-22).

## done() collects the pets before the escape summary

end.c:1293: for ESCAPED and ASCENDED, keepdogs(TRUE) runs after
dump_everything() and before finish_paybill(), moving the adjacent pets
onto gm.mydogs so the summary can say "You and the little dog escaped
..." and add each tame pet's mhpmax to u.urexp. Our done() read
game.mydogs, which nothing had filled on a wizard-mode level teleport out
of the dungeon, so the summary named no pet and scored 0 (s43-26).

## spot_monsters and mon_movement: the 5.0 accessibility notices

hack.c:1707 notice_mon() prints "You see <mon>." (or "notice", when only
sensed) the first time a monster is spotted, marking mtmp->mspotted;
notice_all_mons() (hack.c:1744) runs it for every spotted monster
nearest-first and clears mspotted on the unspotted ones, and vision.c:856
calls it at the end of every vision_recalc(). Because docrt() runs
vision_recalc(2) (nothing visible: everything unspotted) and then
vision_recalc(0), every redraw re-announces the monsters in view, which
is why an options menu that changes anything visible ends with "You see
your little dog." Blocks (notice_mon_off/on, flag.h:233) bracket the
level change, teleds(), the welcome messages, magic mapping and wiz_map,
each followed by an explicit notice_all_mons(TRUE). msg_mon_movement()
(monmove.c:33, the mon_movement option) reports a spotted monster's move
after place_monster(). None of it existed here (s45-00); the options are
game.flags.spot_monsters / mon_movement. This port's vision_recalc() is
synchronous, so notice_mon() composes the text and marks mspotted at the
C's moment but queues the pline; notice_all_mons_flush() delivers the
queue at the next asynchronous point: docrt() after its vision_recalc,
the pline prologue (a queued notice is an earlier message), a tty menu's
dismissal in tty_select_menu, tty_display_nhwindow's start, the moveloop
after each command, and the explicit C call sites.

## doset_simple runs reset_needed_visuals() after every pass

options.c:8726: the simple options loop calls reset_needed_visuals()
(and flush_screen(1) when a redraw was needed) after each
doset_simple_menu(), so a toggle that sets disp.botl (showexp) repaints
the status rows before the menu is put up again. Ours called it once
after the loop, leaving blank status rows under the next --More--
(s45-00).

## petattr, scores and the simple menu's "other" entries

optfn_petattr's do_handler (options.c:3138) is handler_petattr():
query_attr("Select pet highlight attribute", iflags.wc2_petattr), then
hilite_pet follows the attribute and a redraw is requested. optfn_scores
(options.c:3669) parses "5t 3a o" style values with the '!'/"no" prefix,
"none" and the "Unknown scores parameter '...'" error, and 5.0 resets all
three fields first. The simple options menu's "other" entries (OthrOpt:
menu colors, bind keys, status condition fields, status highlight rules)
dispatch to their handlers; ours fell into the no-handler getlin
("Set ... to what?") for all of them (s45-00, s46-03).

## Coyotes, the locked shop's dust sign, and a subroom's orig_rtype

do_name.c:1526 coyotename() names a coyote "coyote - <Latin name>" by
m_id (pager.c:431, farlook) unless hallucinating (s45-01). shknam.c:750
stock_room() writes "Closed for inventory" in the dust outside a locked
shop door and fixes the square's terrain to ROOM or CORR (s45-23: #wizmap
showed the C's engraving glyph where ours had a bare corridor).
mklev.c:1573 level_finalize_topology() records orig_rtype for all of
svr.rooms[], subrooms included; ours only covered the top-level rooms, so
the Oracle's Delphi subroom never satisfied recalc_mapseen()'s
orig_rtype == DELPHI test and #overview lacked "Oracle of Delphi."
(s45-38).

## jump() lives in apply.c and the jumping spell casts it

apply.c:1988 jump(magic): the whole prologue (the jumping spell when the
hero lacks Jumping, no legs, "can't jump very far", stuck steed,
swallowed, underwater, held, levitating, encumbered, weak or hungry,
wounded legs, trapped steed), the trap escapes (bear trap, pit, web,
lava, buried ball/floor), jumping in place onto a trap, then walk_path()
with hurtle_jump(), teleds(), nomul(-1) and morehungry(rnd(25)).
spell.c:1584 casts SPE_JUMPING as jump(max(role_skill, 1)) and says
"Nothing happens." if no time passed. Ours had only a partial dojump()
in cmd.js and a note_unported for the spell, so a wizard casting jumping
lost a turn to the monsters instead of getting the prompt (s46-04).
stucksteed() (steed.c:878) and the Jumping, Conflict and Wounded_legs
property accessors came with it.

## Open from seeds 45 and 46

s45-00 step 651: after a pickup that makes the hero Stressed, the C's
status rows already show Stressed under the "--More--" that precedes
"You rebalance your load."; ours repaints one message later. The C's
encumber_msg() sets disp.botl after its pline, so some other botl setter
in that moveloop pass is still unidentified. s46-03: the status
highlight rule editor beyond the behavior menu (botl.c:3890
status_hilite_menu_add: threshold value, comparison, color and attribute
dialogs) is not ported; the simple menu now reaches it.

## A mimic's appearance object must be freed (crash class)

makemon.c:2505 set_mimic_sym(): an object mimic takes its appearance from
a throwaway mkobj() and then obfree()s it, which frees the contents too.
Ours kept only the otyp and dropped the object, so a mimic posing as an
ice box left six contained corpses whose rot timers still pointed at a
container in no list; the next level change's save_timers() asked
timer_is_local() about them and obj_is_local() hit the C's panic case
("obj_is_local"), aborting the whole session (s47-27, Juiblex's swamp).
mkobj.c:1300 mkbox_cnts() also stops the ROT_CORPSE and REVIVE_MON
timers of the corpses it generates inside an ice box; ours only zeroed
their age. A thrown exception loses the entire session under the judge,
so this class matters more than its screen count.

## number_pad letters run their commands, and cmdassist draws the digits

cmd.c commands_init(): with number_pad on, h/j/k/l/u/N/^L/^N and the
digit 5 land on help, jump, kick, loot, untrap, name, redraw, annotate
and run. Ours bound them but execute_extcmd() had no arm for help, kick
or redraw, so 'h' silently did nothing where the C opens the '?' menu
(s44-12). cmd.c:4122 show_direction_keys() prints visctrl() of the key
bound to each do_move_*, and help_dir() (cmd.c:4279) prints
Cmd.spkeys[NHKF_GETDIR_SELF2] ('s') instead of '.' under number_pad, so
the "Invalid direction key!" panel shows 7 8 9 / 4 6 / 1 2 3 and "s
direct at yourself"; ours had the letters hard-coded.

## resists_magm() looks at the monster's gear

mondata.c:215: after the species checks, magic resistance comes from a
wielded artifact that defends against AD_MAGM, any worn item whose
oc_oprop is ANTIMAGIC (W_ARMOR | W_ACCESSORY, plus W_WEP for monsters)
and carried artifacts with defends_when_carried(). Ours stopped at the
species checks. An aligned cleric in a cloak of magic resistance treats
an anti-magic field as harmless (m_harmless_trap), so mfndpos() keeps
that square even though the cleric knows the trap type, which changed
its candidate count and the mtrack rn2(4 * (cnt - j)) roll (s44-16).

## GLYPH_NOTHING is not GLYPH_UNEXPLORED

display.c: levl[x][y].glyph starts as GLYPH_UNEXPLORED and becomes
GLYPH_NOTHING only from magic_map_background() (an unlit room square with
dark_room off or no color) and reglyph_darkroom() (S_darkroom with
dark_room off). reglyph_darkroom()'s dark_room arm turns GLYPH_NOTHING
room squares with seenv into S_darkroom on arrival, never unexplored
ones. This port kept both as an absent record, so a square that had
been in view only under a gas cloud's region glyph (seenv set, never
mapped: show_region() returns before _map_location()) came back as
S_darkroom on a return visit where the C shows nothing (s44-23).
display.js now has GLYPH_NOTHING_CELL, a blank record of kind 'nothing',
written at the two C sites and tested for in reglyph_darkroom().

## The status hilite rule editor lives in botl.js

botl.c's STATUS_HILITES half is now ported: initblstats[] (indexed by
table position, so version/weapon/armor/terrain sit at 23..26 while their
BL_* ids are 26/23/24/25), conditions[] and condition_aliases[],
status_hilite_menu(), status_hilite_menu_fld(), status_hilite_menu_add()
(the C's choose_field/behavior/value/color gotos as one state loop, with
the exact prompt and rejection strings), choose_updownboth, the text-match
arrays (enc_stat, alignment, hunger, the role's rank titles split on " or "
into two rules), query_conditions, status_hilite_remove,
status_hilites_viewall ("OPTIONS=hilite_status: ..."), and the linestr
gather/count helpers behind count_status_hilites(). Rules live on
game.blstats_thresholds[fld] (C gb.blstats[0][fld].thresholds) and
game.cond_hilites[] (C gc.cond_hilites), and status_hilite_menu() sets
iflags.hilite_delta = 3 when any rule exists, as the C does. options.js
lost its status_fields stand-in and imports status_hilite_menu and
count_status_hilites; both get_val arms count the real rules. Not ported:
applying the rules to the status rows (the renderer, botl.c's
status_hilite_at/render half, bl_hilite timers) and the hilite_status rc
parser (parse_status_hl1). With no rule set they change nothing; once a
session adds a rule and then looks at the status line, the rendering will
diverge until that half is ported. s46-03 (menu editor exercised by the
fuzzer) now matches every screen.

## A wielded aklys thrown by a monster is tethered

mthrowu.c:584 m_throw() computes arw = autoreturn_weapon(obj) and
tethered_weapon = (obj == MON_WEP(mon) && arw->tethered) before
setmnotwielded(), then: skips u_catch_thrown_obj() for a tethered weapon
(so no rn2(100 - Dex) draw), uses tmp_at(DISP_TETHER) for the flight,
sets return_flightpath instead of drop_throw() when the missile hits the
hero or ends its path, and calls return_from_mtoss() (rn2(100) made it
back, rn2(100) caught unless the monster is confused/stunned/blind, rn2(2)
+ rnd(3) when it hits the thrower, "returns to <mon>'s hand", "a loud
snap!", the static do_not_annoy 500-move throttle) instead of
tmp_at(DISP_END). Ours dropped the aklys and rolled the hero catch, so a
gnome's "thonged club" throw diverged at the catch roll (s48-25).
u_catch_thrown_obj() now tests Blind/Confusion/Stunned/Fumbling through
the property accessors and Role_if(PM_MONK/PM_ROGUE).

## cls() must leave glyph_at() reading unexplored

display.c:2107 clear_glyph_buffer() sets every gbuf entry to
GLYPH_UNEXPLORED, so after cls() glyph_at() reports unexplored everywhere
until newsym() redraws a spot. Ours only emptied the repaint list;
glyph_at() reads the per-cell disp_glyph, which kept the last drawn glyph.
monster_detection() calls cls() before map_monst() and then browse_map()
with autodescribe on, so moving the cursor onto the (cleared) wall next to
the hero printed "wall" where the C prints "unexplored area" (s48-29).
clear_glyph_buffer() now resets each cell's disp_* fields to the blank
unexplored record with gnew = 0 (the physical map was just cleared). The
same applies to docrt()'s cls(), which redraws everything afterwards.

## The last spelleffects() arms: protection, chain lightning, cures, familiar

spell.c:1385 spelleffects() now covers every case. cast_protection()
(spell.c:1104) computes loglev = floor(log2(ulevel)) + 1, natac from
u.uac + u.uspellprot, gain = loglev - uspellprot / (4 - min(3, natac)),
prints the golden-haze message (atmosphere by engulfer type, water, cloud,
tree, stone or air) and sets u.uspellprot/u.uspmtime (20 at Expert, else
10)/u.usptime, then find_ac(); the decay lives in timeout.c:652 nh_timeout
(usptime countdown, "The golden haze around you becomes less dense" or
"disappears" via Norep) and is now in timeout.js too. cast_chain_lightning()
(spell.c:1003) is the 5.0 queue of zaps: eight initial directions with
strength 2, each hit non-resistant monster restores strength 3, peacefuls
are avoided, zhitm(BZ_U_SPELL(AD_ELEC - 1), 2) damages, "You shock <mon>!",
forcefight++ around wakeup(), diagonal spread via DIR_LEFT/DIR_RIGHT2 (the
hack.h macro is now in const.js), drawn through tmp_at(DISP_BEAM/CHANGE)
with zapdir_to_glyph, and Pw drained by one per propagation past a
monster. SPE_CURE_BLINDNESS is healup(0,0,FALSE,TRUE); SPE_CURE_SICKNESS
is healup(0,0,TRUE,FALSE) then "You are no longer/not ill." and
make_slimed(0, "The slime disappears!"); SPE_CREATE_FAMILIAR is
make_familiar(). Skilled fireball/cone of cold go through throwspell()
(spell.c:1655: "Where do you want to cast the spell?", getpos with
can_center_spell_location, "The spell dissipates over the distance!",
"Your mind fails to lock onto that location!", walk_path with
spell_aim_step) and then rnd(8)+1 explosions of
spell_damage_bonus(ulevel/2 + 1) at rnd(3)-2 offsets, reflected back to
the center when the offset is unseen, in stone or the hero is swallowed.
spell_damage_bonus() and BZ_U_SPELL are exported from zap.js, their C
home. Not exercised by any recorded session yet; the arms were the last
note_unported entries in spelleffects().

## still_chewing(), autodig and the boulder push run inside test_move()

hack.c:1216 test_move()'s DO_MOVE arm is where a boulder gets pushed:
tunnelers without a pick chew (still_chewing) and everyone else calls
moverock(), whose negative return blocks the move like terrain. Ours
pushed from a separate block in cmd.js domove_core() before the generic
blocked-move test, and test_move() itself recorded the arm as unported.
blocksMove() in cmd.js now routes boulder squares (Sokoban or not
Passes_walls) through test_move(DO_MOVE), the inline block is gone, and
test_move() carries the C arm, including pline_dir() for "A boulder blocks
your path." still_chewing() (hack.c:647) is ported: teeth on
non-diggable rock/bars, "too full to eat the bars", the chew context
(svc.context.digging: dig.js exports digging_context() and
clear_digging_context()), effort 30/60 + udaminc and +30 per turn to 100,
the first-food conduct livelog, rnd(20) nutrition, and the terrain
outcomes (wall -> ROOM in mazes, CORR in caverns outside town, else a
doorless DOOR with shop damage; tree -> ROOM; iron bars dissolve with
HEAVY_IRON_BALL nutrition for metallivores; secret door and door traps
b_trapped; stone -> CORR), then recalc_block_point/newsym and
pay_for_damage. The autodig arm calls use_pick_axe2(uwep) as the C does.
Only a polymorphed tunneler or an autodig rc reaches these; the boulder
routing is exercised by every session that pushes one.

## hack.c's last recorded arms: overexertion, steed pools, surprise monsters, displacer swaps, boulder details

hack.js has no note_unported calls left. overexert_hp() (hack.c:3040)
takes one HP (u.mh when polymorphed) or "You pass out from exertion!"
with exercise(A_CON) and fall_asleep(-10). pooleffects() (hack.c:3277): a
steed that is not grounded() keeps the hero out of the water; otherwise
dismount_steed(DISMOUNT_FELL when Underwater, else GENERIC), and on a
normal level check_special_room() before returning TRUE. spoteffects()
(hack.c:3396) now warns about thin ice under Warning (spot_time_left of
MELT_ICE_AWAY below 15/10/5) and handles a hidden monster on the hero's
square: a piercer drops from the ceiling (glances off a hard helmet, or
uac+3 <= rnd(20) misses, else d(4,6) halved by Half_physical_damage), a
tame one "jumps near you", a peaceful one is surprised and turns hostile,
a hostile one "attacks you by surprise!", then mnexto(RLOC_NOMSG).
domove_attackmon_at() (hack.c:1972) carries the full displacer beast
test (helpless, meating, mtrapped, utrap/ustuck/usteed, diagonal squeeze
rules, goodpos with GP_ALLOW_U) and cmd.js domove_core() performs the
swap (hack.c:2887: remove/place monster, "<Mon> swaps places with you..."
or Something when unnoticed, map_invisible, minliquid/mintrap under
mon_moving) ahead of the pet-swap arm. moverock_core() gained the blind
"That feels like a boulder." arm (glyph at the square is not the boulder:
map_object, nomul, -1), the m<dir> giant "step over" and the door_opened
learn-something rule, Levitation || Is_airlevel, the verysmall arm,
costly = costly_spot && shop_keeper, Blind feel_location() before each
refusal, surface() in the Sokoban diagonal message, revive_nasty() and
y_monnam(usteed). cannot_push() has the giant arms (inv_cnt/invlet_basic,
carrying(BOULDER), autopickup && !nopick, autopick_testobj, riding skill)
and the "squeeze yourself into a small opening" arm every small or lightly
loaded hero can reach. dopush() uses movobj(), feels both squares when
blind, and adjusts the shop bill (addtobill when pushed out of a costly
spot, subfrombill when pushed back onto the bill, stolen_value once the
boulder leaves the shop).

## passivemm()'s defender-alive arms

mhitm.c:1361: when the defender survives, rn2(3) gates a switch on its
passive attack type: AD_PLYS (a floating eye's gaze reflected or freezing
the attacker via paralyze_monst, a gelatinous cube freezing it), AD_COLD
("mildly chilly" + golemeffects for the resistant, else "suddenly very
cold!", healmon(mdef, tmp/2) and split_mon above (m_lev+1)*8), AD_STUN
(sets magr->mstun once with "<Mon> staggers..."), AD_FIRE and AD_ELEC
(resistant: mild message + golemeffects; else the hot/jolted message), and
the acid/enchantment arms that run even when the defender died (splash,
erode_armor 1/30, acid_damage 1/6, drain_item). Ours only handled AD_PHYS,
so a monster that hit a passive-stun defender never became stunned and the
later dochug() "stunned monsters get un-stunned" rn2(10) never fired
(s50-04, seed 50's one real failure). assess_dmg is an inner closure that
applies tmp to the attacker and returns M_ATTK_AGR_DIED via monkilled().

## Menu group accelerators beat mapped menu commands

win/tty/wintty.c:1498-1533 builds resp[] from the page's selectors, then
the group accelerators (resp_len marks the end of the explicit choices),
then ' ', digits, ESC and RET. process_menu_window() tests the typed key
against that explicit prefix before map_menu_cmd(), so a key that is both
a group accelerator and a menu command (',' for "the type of an object
upon the floor" in the #name menu, which is also menu_select_page; '\\'
for the discoveries entry, also menu_unselect_page) selects the entry.
Inside the default arm gacc is checked before the per-item selectors.
Ours mapped the menu command first, so ',' in the #name menu did nothing
where the C opened namefloorobj()'s getpos (s50-04 step 221). The
group-accelerator branch now comes first in tty_select_menu().

## cursed_book() and the Book of the Dead's raise/pacify arms

spell.c:130 cursed_book() is now the C switch verbatim: blindness through
make_blinded(BlindedTimeout + rn1(100,250)), gold through take_gold(),
contact poison through erode_obj(uarmg, "gloves", ERODE_CORRODE,
EF_GREASE|EF_VERBOSE) or poison_strdmg() with the in_use guard, the
exploding rune through Antimagic/shieldeff and Maybe_Half_Phys, and the
default arm rndcurse(), which ours had dropped (a level 8+ book's rn2(lev)
of 7 or more cursed the inventory in the C and did nothing here).
deadbook() (spell.c:231) gains the raise_dead arm shared by the failed
invocation and a cursed book (1 in 3 master lich or nalfeshnee made
hostile with set_malign, unturn_dead on the inventory, mkundead around the
hero) and the blessed arm, deadbook_pacify_undead() over every on-map
monster: undead or vampshifters in view become peaceful, and are tamed or
gain tameness when their alignment sign matches the hero's within
mdistu 4, otherwise monflee(0, FALSE, TRUE).

## Shopkeeper entry dialogue, blocking, and block_entry()'s door test

shk.c u_entered_shop(): after the customer/visitct bookkeeping the
greeting has four arms: an angry keeper ("So, <name>, you dare return to
<shk>'s <shop>?!", or when deaf/mute "<Shk> seems <quite upset|ticked
off|furious> over your return to <his> <shop>!", which draws rn2(3)), a
surcharged one ("Back again, <name>?  I've got my eye on you." / "The
atmosphere at <shk>'s <shop> seems unwelcoming."), a robbed one ("<Shk>
mutters imprecations against shoplifters." / "is combing through <his>
inventory list."), and the welcome with visitct++. Then, unless the hero
teleported inside, a pick-axe or mattock ("Will you please leave your
<tool>s outside?" / "Leave the ... outside." when surcharged; the mattock
becomes known), a steed ("Will you please leave <steed> outside?"), or
(Fast with a pick on the floor) sets should_block and gives the keeper
dochug(). Ours returned before the angry/surcharge/robbed arms and never
had the blocking section. shop_keeper() now riles an angry keeper without
a surcharge (rile_shk was ported but never called). block_entry()
compared the hero's doormask with 4 (D_CLOSED) for "broken door"; D_BROKEN
is 1, so it never fired; it now carries the C test (keeper on post, next
to the target square, hero Invis or carrying a pick/mattock or riding)
with "<Shk> senses your motion and blocks your way!".

## A monster opening a door can become visible by opening it

monmove.c:1528 UnblockDoor() refreshes canseeit = didseeit ||
cansee(mx, my) after the door state changes and vision is recalculated:
opening the door lets light through, so the kobold that was unseen behind
a closed door is seen once it is open, and the message is "The kobold
opens a door." rather than "You hear a door open." Ours cached canseeit
before the change (s51-22).

## boulder:symbol validation, the disclose handler, and whatis_menu

options.c:1171 optfn_boulder do_set: escapes() the value, rejects a
control character ("boulder symbol cannot be a control character"), and
rejects a clash with a monster class symbol or a warning digit
("Badoption - boulder symbol 'j' would conflict with a monster symbol");
otherwise it sets both ov_primary_syms and ov_rogue_syms and, once the
game is running, opt_need_redraw. Ours had no set arm, only the startup
shortcut. handler_disclose() (the O menu's disclose entry) is ported: the
category menu "Change which disclosure options categories:" with
"<name>       [<mode><letter>]" rows and, per chosen category, the
"Disclosure options for <name>:" menu (never/always/prompt-no/prompt-yes,
plus '#' and '?' for vanquished and genocides). It matters beyond the
option: the menu's display flushes a pending message with --More--, which
is how the C shows "Badoption ...--More--" when boulder and disclose were
picked together (s51-04). Ours also read iflags.getloc_usemenu and
getloc_moveskip in getpos while the whatis_menu and whatis_moveskip
options were stored under their names; both now live in game.iflags under
the option names (iflag_boolean_options), so toggling whatis_menu in the O
menu makes 'a'/'m'/'o'/'d'/'x' open the "Pick an interesting thing" menu.

## dodown() and doup() carry every C arm; a held hero cannot use the stairs

do.c:1110 u_stuck_cannot_go(updn): a held or engulfed hero gets "You are
being held|swallowed|engulfed, and cannot go down|up." and the command
still takes a turn (ECMD_TIME); a hero who is the one sticking releases
the monster instead. Ours had no such check, so '>' while a lichen held
the hero printed nothing and took no time, and the monsters' next moves
came a turn later than the C's (s52-14). dodown() (do.c:1130) and doup()
(do.c:1298) are now the C functions in full: u_rooted() (hack.c:1693, a
form that cannot move: "You are rooted in place|to the ground"),
stucksteed(), the controlled-levitation arm (float_down with I_SPECIAL|
TIMEOUT|W_ARTI, artifact ages bumped by rnz(100), "Your latent levitation
ceases.", the blind stair-knowledge check, "You are floating in the
air|water|a bubble of air" or fountain.c floating_above()), the ceiling
hider drop, the Can_fall_thru() hole test, autodig through use_pick_axe2,
the Valley of the Dead gate question, "You are held back by your pet!",
the trap descent with the MZ_HUGE squeeze prompt and its rnd(4) contusion,
goto_hell() from the Castle, clamp_hole_destination(), and at_ladder
around next_level()/prev_level(). doup() adds climb_pit() for "up" in a
pit, "Your load is too heavy to climb the stairs|ladder." and ledger_no()
for the level-1 warning. artifact_has_invprop() (artifact.c:2299) and
goto_hell() (dungeon.c:1957) were ported for these.

## Enlightenment's encumbrance line is past tense at game end

insight.c:1236: "; movement %s %s slowed" prints "is" during play and
"was" in the final disclosure (the `final` flag). Ours always said "is",
so the end-of-game attributes read "You were burdened; movement is
slightly slowed." (s52-06).

## The last shopkeeper arms: bills, the doorway, trap and litter repair

shk.c sub_one_frombill() (3654): when a stack on the bill is only partly
used up, the remainder gets a fresh o_id from next_ident() (svc.context.
ident++, which shifts every later object id) and goes on the used-up list
with bp->useup; a fully used entry is removed by copying the LAST entry
into its slot, not by shifting (bill order matters for the pay menu).
splitbill() (3623) keeps the C's impossible() checks and BILLSZ limit.
after_shk_move() (4998) resets bill_p and re-runs check_special_room().
contained_cost() (usell) sums set_cost() of saleable, unpaid-free contents
(no balls, no partly eaten food, no nearly burnt candles). pay_for_damage()
(5174): when the keeper is inside the shop and the hero outside, a monster
in the doorway gets "You hear an angry voice:" / "Out of my way, scum!"
and wait_synch(), or growl(), then mnearto(shkp, x, y, TRUE, RLOC_MSG); an
animal keeper that refuses payment growls. repair_damage() (4733) untraps
a land mine or bear trap into the keeper's inventory ("<Shk> untraps a
beartrap."), fills pits and holes, deletes other traps (each with its
message when the hero saw the trap), then restores the wall or door and
scatters floor items into the shop with litter_getpos()/litter_scatter()
(rn2(9) start, up to 10 tries for an in-shop spot, boulders and rocks
merge into the wall, unpaid items leave the bill when they land on a costly
spot) and litter_newsyms(). shk.js keeps one note: dopay's non-ordinary
bill entries.

## Praying in Gehennom never grants invulnerability

pray.c dopray(): "You are surrounded by a shimmering light." and
u.uinvulnerable = TRUE need p_type == 3 AND !Inhell. Ours checked only
p_type, so a wizard-mode hero forcing the gods on Dlvl 48 became
invulnerable: no regen_hp() rn2(100), no gethungry() rn2(20), HP not
regained (s53-25, the only failure in seed 53).

## Ring_on/Ring_off and Amulet_on/Amulet_off are the C switches

do_wear.c:1250 Ring_on() first unwields a ring that was wielded, alt-
wielded or quivered (the slot was already set), masks W_RING out of the
old property unless both hands carry the same ring, and for see
invisible calls set_mimic_blocking() before see_monsters(); Ring_off_or_
gone() (1336) reports impossible() when the property lacks the ring's
bit, uses Invisible (Invis && !See_invisible) for "Suddenly you cannot see
yourself.", keeps floating when BLevitation has FROMOUTSIDE (else
float_vs_flight()), and restartcham() when protection from shape
changers ends. Amulet_on() (895) starts with remove_worn_item(), and
carries magical breathing (region_danger() with the amulet temporarily
masked off: "You are no longer bothered by the poison gas."), unchanging
(make_slimed(0)), change (livelog_newform, "The amulet disintegrates!",
trycall when the sex did not change), strangulation gated on
can_be_strangled(), and flying (float_vs_flight, then EFlying masked off
to see whether flight is new). Amulet_off() (1030) does off_msg() early
for ESP, magical breathing (drown() underwater, "You are breathing
poison gas!"), strangulation ("Your neck is no longer constricted!" when
Breathless) and flying ("You stop flying." over water/air, else "You
land.", then spoteffects()), and makeknown() at the end when an effect
was observed. The ring and amulet "unknown otyp" notes are gone; the
switches list every type as the C does.

## canwearobj(), the ring-finger refusals, set_wear() and the helm of opposite alignment

do_wear.c:1911 canwearobj() is now the C's full test list: no armor in a
form that is verysmall or has no hands; a cloak, shirt or suit that will
not fit a form that cantweararm() (mummy wrapping and small forms
excepted, racial_exception() honoured); "already wearing that"; a welded
two-handed weapon blocks suits and shirts; helmets over horns; shields
against a two-handed weapon ("two-handed sword|axe|weapon") or two-weapon
combat; boots for slithy forms, centaurs ("too many hooves"), a bear trap
("Your foot is trapped!"), the floor or lava ("Your feet are stuck in the
floor!") and a buried ball; gloves over a welded weapon or with Glib
fingers; the shirt, cloak and suit layering; and silly_thing("wear")
(invent.c:1755, now exported and used by getobj too) for anything else.
accessory_or_armor_on()'s ring arm gains the C refusals: slippery gloves
("... are too slippery to remove, so you cannot put on the ring." and a
turn passes), cursed gloves (set_bknown, "You cannot remove your gloves to
put on the ring.", a turn only when the curse was just learned) and a
welded weapon in the ring hand ("You cannot free your weapon hand(s) to
put on the ring."). set_wear() calls Blindf_on/Ring_on/Amulet_on for the
worn accessories (it is async now). Armor_on() uses artifact_light()/
begin_burn()/arti_light_description() ("Your gold dragon scale mail begins
to shine ...!") instead of a gold-dragon special case, and updates the
inventory when the suit's enchantment becomes known. The helm of
opposite alignment summons the furies (makemon.c:2605 summon_furies(),
ported) on the Astral Plane or with rn2(50) < abuse, logs "used a helm to
turn <align>", and retouch_equipment(0) runs when the alignment changed.

## No corpse when a monster is digested or disintegrated

mon.c:2779 monkilled() is now the C body. It first decides
`disintegested = (how == AD_DGST || how == -AD_RBRE || (how == AD_FIRE &&
completelyburns(mdef->data)))`, records whether a worm's death was already
known and whether a pet's death should sadden the hero, and then calls
mondead() for a disintegested victim (no corpse, no drops) and mondied()
otherwise. If the victim was life-saved it returns at once. A pet golem that
dies this way still gets its farewell, "May <name> roast/rust/rot in
peace.", with the verb chosen by the golem's type. s55-33 diverged here: a
gas spore's explosion (AD_FIRE) burning a paper golem left a corpse in ours
and none in the C, so every RNG draw after the death was offset.

## "You have already gone as far <dir> as possible."

hack.c:2130 move_out_of_bounds() is called from domove_core() before the
trap and liquid avoidance checks. An off-map destination with forcefight set
goes to domove_fight_empty(); otherwise, with mention_walls on, it prints
"You have already gone as far <direction> as possible." with the diagonal
collapsed to the axis that is actually blocked (isok() on the other axis),
then nomul(0) and context.move = 0 so no time passes. Ours simply ignored
the key, which desynchronised the turn counter in s55-13 at step 254 when a
fuzz game pressed 'h' on column 1 with mention_walls set.

## A blind hero's own square is mapped by touch

display.c:1043 newsym(): when the hero's square is NOT in sight (blind), the
C calls feel_location(u.ux, u.uy) and then display_self(); only the in-sight
arm uses _map_location(). feel_location() ends with its own dark-floor rule,
`lev->glyph = flags.dark_room ? S_darkroom : S_stone` for a ROOM square
remembered as S_room, which is not DARKROOMSYM. On ordinary levels the two
rules agree, but on the Rogue level DARKROOMSYM is S_stone while the Rogue
symset draws S_darkroom with the default '.', so behind a blind hero the
vacated floor stays a dot in the C and went blank in ours (s55-13 step 474:
arrival by level teleport on the Rogue level while wearing a blindfold, then
one step west). newsym()'s hero arm now takes the C's out-of-sight path.

## A vampire's fog shift flushes the message window even when unseen

monmove.c:2377 vamp_shift() wraps the newcham() that turns a vampshifter
into a fog cloud so it can pass under a closed door. After the change it
calls display_nhwindow(WIN_MESSAGE, FALSE) unconditionally, so a topline
that still needs acknowledgement gets its --More-- right there, in the
middle of the monster phase, even when the vampire was never in sight and
no message was printed. s56-09 showed it: two out-of-sight sounds ("You
hear a masticating sound.  You hear a chugging sound.") were followed by a
--More-- with the map and turn counter still at their pre-move state, and
nothing on the top line after it. postmov() now carries the C's seenflgs
(canseemon | canspotmon << 1, computed in m_move() before the move) and,
when set, moves the monster back to its old square around the shift so
the message lands at the right time; newcham() gets NC_SHOW_MSG only when
the monster was actually seen (seenflgs & 1).

## Diagonal doorway refusals come from test_move, with their message

cmd.js's blocksMove() pre-screens the destination before domove(). Its
diagonal doorway arms (into an intact doorway, hack.c:1140; out of one,
hack.c:1208) returned "blocked" on their own, so the C's DO_MOVE feedback
never ran: feel_location() when blind and "You can't move diagonally
into/out of an intact doorway." under Underwater or mention_walls. Both
arms now call test_move(DO_MOVE) like the obstruction and boulder arms, and
the out-of arm also picks up block_entry() (a shopkeeper blocking a
diagonal entry through a broken door). s56-11: a shifted 'N' from an open
door square with mention_walls set printed the message in the C and
nothing in ours.

## litroom() in full: darkness, artifact lights, gremlins, the Rogue room

read.c:2491 litroom() now carries every arm. Darkening (a cursed scroll)
snuffs each lamplit inventory item with snuff_lit() unless it is an
artifact light, which instead goes through potion.c:1595
impact_arti_light() (ported into potion.js): unless already cursed or
obj_resists(obj, 25, 75), a temporary potion of water is made with
mksobj(POT_WATER, TRUE, FALSE), cursed, and dipped onto the object with
H2Opotion_dip() for the "<obj> glows <color>" message; a blessed scroll
does the same with a blessed potion to raise the BUC state. The messages
follow the C: "The ambient light seems dimmer." when something is still
lit, "It seems even darker in here than before." when swallowed, else
"You are surrounded by darkness!"; when lighting while swallowed, the
engulfer's stomach "is lit", a whirly one "shines briefly", anything else
"glistens". On the Rogue level the whole room (walls included) is set
through set_lit() and the room's rlit follows; a Sunsword invoke lights
only the hero's square; otherwise do_clear_area() with radius 5 or 9.
set_lit() (read.c:2471) collects gremlins standing in newly lit squares
and snuff_light_source()s a darkened square; after the vision_recalc(2)
redraw and vision_full_recalc, each collected gremlin takes
light_hits_gremlin(mon, rnd(5)) after an immediate vision_recalc(0). The
only remaining gap is the ball-and-chain move_bc() dance (ball.c is not
ported), recorded as litroom:move_bc. seffect_light() also gains its
confused arm: three or four (plus two if blessed) cancelled tame yellow
lights, black lights for a cursed scroll, made with MM_EDOG | NO_MINVENT |
MM_NOMSG and initedog(mon, TRUE); "Lights appear all around you!" when any
is spotted, "Tiny lights sparkle in the air momentarily." when the species
is gone; and the uncursed scroll's lightdamage(sobj, TRUE, 5) is the real
zap.c call (a gremlin hero takes rnd damage).

## Milky and smoky potions: ghost_from_bottle, djinni_from_bottle, the worn stack

potion.c:481 ghost_from_bottle() and potion.c:2815 djinni_from_bottle()
are ported into potion.js, with potion.c:2796 mongrantswish() (the
monster is removed first, its glyph kept on the map with
tmp_at(DISP_ALWAYS, glyph) while makewish() prompts, then tmp_at(DISP_END)).
The ghost: "This bottle turns out to be empty." when makemon fails, "As
you open the bottle, something emerges." when blind, otherwise "an
enormous ghost" (a random monster name when hallucinating), the verbose
"You are frightened to death, and unable to move.", nomul(-3) with
multi_reason "being frightened to death" and nomovemsg "You regain your
composure.". The djinni's chance table is the C's (rn2(5), remapped for a
blessed or cursed bottle) and its arms use verbalize(), tamedog(mtmp, 0,
FALSE) for "Thank you for freeing me!" (which wields a weapon and draws),
set_malign() for the peaceful and hostile arms, and mongone() after "It
is about time!". apply.js had grown its own copy of djinni_from_bottle for
the magic lamp; it now imports the potion.js one, since the copy used
initedog() where the C tames through tamedog() and skipped the wish-time
glyph. dodrink()'s worn-potion arm is the 5.0 rule: a worn stack of more
than one is split with splitobj(otmp, 1) and the single potion cleared of
its owornmask, a single worn potion goes through remove_worn_item().

## '?' at the direction prompt shows the help and asks again

cmd.c:3958 getdir(): an invalid key opens help_dir() with "cmdassist:
Invalid direction key!" only when cmdassist is on, but '?'
(Cmd.spkeys[NHKF_GETDIR_HELP]) is a help request: the panel comes without
the cmdassist line and without the "(Suppress this message with
!cmdassist in config file.)" footer, and getdir goes back to `retry:` and
reads another direction. Ours showed the cmdassist form and returned
failure (s58-12 step 266, a '?' at "In what direction?" for a throw).
help_dir() also gets its key-hint arm: when the caller's prompt is a real
one (not a '^' key hint) and the bad key is a letter or '[', it asks "Are
you trying to use ^X as specified in the Guidebook?" with the command's
description from pager.c dowhatdoes_core() (now a real function in
pager.js that dowhatdoes() shares), wizard-only letters EFGIVW only in
wizard mode. The key reaches help_dir() only when the caller's prompt
starts with '^' (cmd.c:4102, `(s && *s == '^') ? dirsym : '\0'`), that is
for key-hint callers; getdir(NULL) and every ordinary prompt such as
dochat's "Talk to whom? (in what direction)" pass NUL, so the hint never
shows there (s62-05: a stray 'a' at the chat prompt printed "Are you
trying to use ^A ..." in ours and only the direction panel in the C).

## The sacrifice arms: conversion, desecration, blood stains, gifts

pray.c's #offer is now complete except for nothing that draws. eval_offering()
(pray.c:1900) is the undead and unicorn valuation: +1 for undead (a wraith
also for a chaotic who eats meat), the unicorn insult ("Such an action is an
insult to law/balance/chaos!", -1 Wis, value -1), the coaligned bonus ("You
feel appropriately <align>." below ALIGNLIM, else "thoroughly on the right
path", adjalign(5), +3), the own-alignment unicorn on a foreign altar
(record set to -1, value 1) and the cross-aligned +3. offer_corpse()
(pray.c:1959) logs the first gnostic conduct break with the corpse name,
feels a cockatrice corpse, lets a Rider revive, sends a former pet's corpse
("So this is how you repay loyalty?", adjalign(-3), intrinsic aggravate)
through offer_negative_valued(), and has the C's hallucinatory variants
("groovy", "cosmic (not a new fact)", "The gods seem tall.", "You realize
that the gods are not like you and I.", "Overall, there is a smell of fried
onions.") plus the "brushed your foot"/"crabgrass"/"four-leaf clover" luck
messages with body_part(FOOT). offer_different_alignment_altar()
(pray.c:1631) gains the angry-god arm: with an unconverted alignment base
the hero converts ("... accepts your allegiance.", uchangealign(altaralign,
A_CG_CONVERT), luck -3, ublesscnt +300), otherwise ugangr +3, adjalign(-5),
"rejects your sacrifice!", "Suffer, infidel!", luck -5, Wis -2 and
angrygods() outside Gehennom; the conflict arm now summons a minion
(summon_minion(altaralign, TRUE)) on the C's rnl/rnd test and angers the
temple priest only when one is present and not coaligned
(findpriest(temple_occupied(u.urooms)), now exported from priest.js).
sacrifice_your_race() (pray.c:1698) desecrates a high altar through
desecrate_altar() and stains a lawful or neutral altar ("The altar is
stained with <race> blood.", altarmask AM_CHAOTIC, angry priest) and then
falls through to the common alignment penalty, which ours skipped.
bestow_artifact() (pray.c:1781) is the C gift: chance !rn2(6 + 2 * ugifts
* nartifact_exist()) (debug mode asks), mk_artifact(NULL, a_align(), value,
TRUE), artifact_origin(ONAME_GIFT | ONAME_KNOW_ARTI), spe floored at 0,
uncursed, erodeproof, "<An object> named <Name> appears at your feet!",
dropy(), "Use my gift wisely!", ugifts++, ublesscnt = rnz(300 + 50 *
nartifacts), the LL_DIVINEGIFT log, unrestrict_weapon_skill(weapon_type()),
and the observe/makeknown/discover trio when the hero can see.
sacrifice_value() (pray.c:1839) uses peek_at_iced_corpse_age() and
eaten_stat(). prayer_done() (pray.c:2276) gains its p_type -2 arm
(unaligned altar: "You hear/intuit diabolical laughter all around you...",
wake_nearby, adjalign(-2), "Nothing else happens." outside Gehennom) and -1
arm (undead form: the god's rebuke, rehumanize(), losehp(rnd(20)), Con
abuse). attrib.c:1320 uchangealign() now lives in attrib.js with all three
reasons (A_CG_CONVERT logs "permanently converted to <align>", sets
ualignbase[A_CURRENT], lets a worn helm of opposite alignment block the
type change, and says "You have a (sudden) sense of a new direction.");
do_wear.js's helm arms call it instead of a local copy.

## The last fountain arms: watchmen, wishes, Excalibur, washing hands, coins

fountain.c is now fully ported. dryup() (fountain.c:201) warns through
get_iter_mons(watchman_warn_fountain): the first peaceful watchman in line
of sight yells "Hey, stop using that fountain!" through verbalize(), or, to
a deaf hero, "earnestly shakes/waves his head/arms!" (nolimbs picks the
verb and body part); only when no watchman objects does "The flow reduces
to a trickle." print. dowatersnakes() names the stream with
makeplural(rndmonnam()) while hallucinating. dowaterdemon() grants the
wish on rnd(100) > 80 + level_difficulty(): "Grateful for his release, he
grants you a wish!" then mongrantswish() (now exported from potion.js).
gush() runs minliquid() on a monster standing where the pool forms.
drinkfountain() and dipfountain() call floating_above("fountain") under
Levitation (the accessor, not a uprops lookup that never fired), the
see-invisible draught has its "feel transparent"/"very self-conscious"/
"image of someone stalking you" messages and grants HSee_invisible from
outside, and dipfountain() gains the Lady of the Lake: a long sword at
level 5+ on !rn2(6 for a Knight, else 30), unique and not yet an artifact
while Excalibur does not exist, is cursed and possibly de-enchanted by a
freezing mist for a non-lawful ("was denied Excalibur! ..."), or named
Excalibur with oname(ONAME_VIA_DIP | ONAME_KNOW_ARTI), blessed, repaired
and made erodeproof for a lawful, and the fountain vanishes either way
(angry guards in town). '-' or worn gloves go through wash_hands()
(fountain.c:558: "You wash your gloved hands in the water.", Glib removal,
water_damage on the gloves, ER_GREASED when the fingers were slippery),
the water demon roll calls dowaterdemon(), and "You see coins" drops
mkgold(rnd((dunlevs_in_dungeon - dunlev + 1) * 2) + 5) into a not yet
looted fountain with "Far below you, you see coins glistening in the
water.".

## Runs stop with a message at traps and liquid edges

hack.c:2444 avoid_moving_on_trap() and hack.c:2463 avoid_moving_on_liquid()
print, under mention_walls, "You stop in front of <a trap>." (an(trapname()))
and "You stop at the edge of the water/lava." (hliquid()) after
set_msg_xy(); ours recorded both arms as gaps. s60-38's travel command ended
next to lava: the C printed the edge message after "The imp suddenly
disappears!" and ours stayed silent. The two functions and
avoid_running_into_trap_or_liquid() are async now and awaited from
lookaround() and domove.

## runmode is stored as its RUN_* index

options.c:3627 optfn_runmode() do_set maps the option text onto
RUN_TPORT/RUN_LEAP/RUN_STEP/RUN_CRAWL with str_start_is() (any prefix of
"teleport", "run", "walk", "crawl"), "Unknown runmode parameter '<op>'" for
anything else and "Value is mandatory for runmode" for an empty value; a
negation is RUN_TPORT. get_val prints runmodes[flags.runmode]. Ours kept
the raw string from the rc, so the 'O' menu printed "[unknown]" where the
C printed "[walk]" (s60-38, a "normal-legacy" session whose rc sets
runmode:walk). The conversion lives in parseoptions(), which both the rc
and the interactive 'O' path go through; runmode_delay_output() reads the
index directly.

## potion.js is complete: drink_ok_extra, the sink dip, burning oil

potion.c:52 drink_ok_extra now exists (in potion.js with drink_ok(), its C
home; cmd.js imports it): dodrink(), dodip() and dip_into() zero it, every
declined fountain/sink/water prompt increments it, and drink_ok(NULL)
returns GETOBJ_EXCLUDE_NONINVENT when it is set so getobj says "You don't
have anything else to drink" after a passed-up fountain. dodrink() also
asks "Drink the water around you?" underwater ("Do you know what lives in
this water?") and honours can_reach_floor(). dodip()'s sink arm calls
fountain.c:716 dipsink() (ported: the 1-in-25, or 1-in-15 after the ring
was found, pipe break through breaksink(), washing hands, holding a
non-potion under the tap, and the potion drain effects: polymorph_sink()
(do.c:404, ported into do.js: fountain, throne, altar with a random or
Moloch alignment in Gehennom, or a grave/floor with "The sink transforms
into <a fountain>!"), the oily film, the drain cleaner, sink_backs_up()
for levitation, "You sense a ring lost down the drain." for object
detection, "Nothing seems to happen." for the effectless potions, and "A
wisp of vapor rises up..." plus potionbreathe() for the rest, then
trycall() and useup()). The pool arm has floating_above(),
rider_cant_reach() for an unskilled rider on a non-swimmer, wash_hands()
for hands or gloves, and water_damage() with the acid special case.
potionbreathe()'s sleeping arm calls monstseesu(M_SEEN_SLEEP) on a yawn;
its and potionhit()'s default arms are gone (the C has none: the remaining
potions do nothing there). peffect_sickness() and peffect_extra_healing()
call make_hallucinated() as the C does (the latter unconditionally, and it
heals wounded legs from a blessed potion unless riding), peffect_oil()'s
burning arm is "Ahh, a refreshing drink." for fire lovers or "You burn
your face." with d(4 or 2, 4) damage and burn_away_slime(),
peffect_paralysis() says "You are motionlessly suspended." when
levitating or on the Planes of Air/Water and "You are frozen in place!"
on a steed, and peffects()' default is the C's impossible().

## postmov() re-reads the monster's species after the trap

monmove.c:1509 postmov(): after mintrap(), a monster that is now off the
map returns MMOVE_DONE, and `ptr = mtmp->data` is refreshed "in case
mintrap() caused polymorph". The rest of postmov() (door handling,
hides_under()/S_EEL hiding with its rn2(5), shopkeeper and priest arms)
then runs for the NEW form. Ours kept the cached pre-move species, so a
monster polymorphed by a trap into a hider skipped the rn2(5) hide roll
(s61-18: a soldier ant became something that hides under objects, and
every draw after that turn was one position early).

## Confused enchant weapon rustproofs, remove curse reaches the saddle

read.c:1627 seffect_enchant_weapon()'s confused arm is ported: the wielded
weapon's oerodeproof is set from !cursed after "Your weapon feels warm for
a moment." (blind, rknown cleared) or "Your <weapon> is covered by a
shimmering golden shield!" / "... a mottled purple glow!" (rknown set),
existing erosion is repaired with "Your <weapon> looks/feels as good as
new!", and losing an existing proofing to a cursed scroll charges the shop
through costly_alteration(COST_DEGRD) first. seffect_remove_curse() treats
a ridden steed's saddle as inventory (blessorcurse when confused, else
uncurse with "Your saddle glows amber." and bknown unless hallucinating)
and frees a hero chained to a buried ball with buried_ball_to_freedom()
and "The clasp on your leg vanishes.". cmd.js: a mounted hero bumping a
closed door hears "You can't lead <steed> through that closed door."
(hack.c:1116), and toggling autopickup with exceptions defined says ",
with one exception" or ", with some exceptions" (options.c dotogglepickup()).

## The status line shows the live load; the "stale encumbrance" hack is gone

The port carried a non-C mechanism (`_encumber_status_stale`,
`_deferred_status_capacity`, set in pick_obj(), dropx(), throwit()'s
caller and addinv's prinv path, consumed by bot_conditions() and
encumber_msg()) that kept the previous capacity on the status line until
encumber_msg() ran, to emulate a C tty that had not yet redrawn. The C has
no such thing: bot() prints near_capacity() whenever it runs, and it runs
at every flush while disp.botl is set. s63-03 showed the hack wrong: a
run east ended on a statue that autopickup lifted with "You have a little
trouble lifting f - a statue of a lichen.--More--", botl was already set,
so the C's status already read Burdened under the --More--; ours kept the
old load for the next twenty screens. The mechanism is removed from
pickup.js, attrib.js, botl.js, do.js, dothrow.js, invent.js and shk.js; the
44 public sessions and the fuzz census stayed perfect without it.

## The starting pony's saddle is "a saddle", not "an uncursed saddle"

steed.c:141 put_saddle_on_mon() fully identifies a saddle it creates and
then hands it to mpickobj(). makedog() saddles the pony BEFORE initedog()
tames it, and steal.c mpickobj() unknow_object()s anything a non-tame
monster picks up out of the hero's view, so the identification is undone
again: when the pony dies its saddle lists as "a saddle" (s64-14, "Things
that are here: a pony corpse, a saddle"). Ours inserted the saddle into
minvent by hand and kept bknown; put_saddle_on_mon() now calls mpickobj()
like the C (a saddle never merges, so the return value is ignored).

## dofire fills the quiver with autoquiver

dothrow.c:1520 autoquiver() is ported: with the autoquiver option on and
an empty quiver, 'f' scans the inventory (unworn, non-artifact, dknown
items; rocks and known flint/glass become ammo for a slinger or misc
otherwise, matched ammo beats missiles, which beat alternate-launcher ammo
and ordinary throwing weapons, daggers count as missiles, aklyses are
skipped) and setuqwep()s the best choice, then dofire prints "You ready:
<item>" with the quiver bit briefly cleared for a shorter name, or "You
have nothing appropriate for your quiver." (s64-08, a "normal-legacy" rc
with autoquiver on) before falling through to doquiver_core("fire").

## wield.js is complete: shop warnings, Shk_Your, restrict_name, Magicbane

The last wield.c arms: ready_weapon() has the shopkeeper's "<Shk> says
\"You be careful with my <weapon>!\"" for an unpaid wield
(shop_keeper(inside_shop(u.ux, u.uy))); dowield() undoes a count split
that could not be wielded with unsplitobj() and prefixes the "remain
readied" refusal with Shk_Your() so shop goods read "<Shk>'s ..."; chwepon()
bills a crysknife dulling through costly_alteration(COST_DEGRD) and a
negative enchantment through costly_alteration(COST_DECHNT), re-prices an
unpaid sharpened or enchanted weapon with alter_cost(uwep, 0), gives the
"faintly glow" refusal when a cursed enchant scroll hits an artifact whose
name restrict_name() protects (artifact.c:575 restrict_name() is ported
into artifact.js: undiscovered types sharing a description or shuffle range
count as the same type, and SPFX_NOGEN|SPFX_RESTR artifacts or a stack of
more than one make the name restricted), and gives Magicbane's clue "Your
right hand itches!/flinches!" when its enchantment stays non-negative.

## Grabs on an unsolid hero fail, and ^X names the blindfold in wizard mode

mhitu.c:808/827 mattacku(): a claw-type hit on an unsolid hero (ghost,
vortex, light, most elementals) that is a hug, wrap, stick or digestion
attack goes through mhitm.c:597 failed_grab() ("<Foo>'s grab passes
through you!") and is skipped, and an AT_HUGS attack lands only when
failed_grab() says no; ours recorded both arms. attrib.c:905 from_what()'s
wizard-mode arm asks what_gives() for the object conveying the extrinsic;
ours keys the extrinsic word by property, and the table lacked BLINDED
(plus INVIS, TELEPORT, LEVITATION, FLYING, SWIMMING, PASSES_WALLS), so a
blindfolded wizard's ^X said "You are temporarily blind." where the C says
"... because of your blindfold." (s65-34; the blindfold sets EBlinded's
W_TOOL bit through setworn(), which is exactly what what_gives() finds).

## toss_up(): an object thrown at the ceiling comes back down

dothrow.c:1620 toss_up() is ported (throwit() used an inline potion-only
sketch and recorded everything else). Without a ceiling the object "flies
up into" the sky; with hitsroof (rn2(5) and not underwater) a breakable
object "hits the ceiling", breakmsg()s and breakobj()s, a crackable one
that survives lands with hitfloor(); otherwise it "hits" or "almost hits"
the ceiling "then falls back on top of your head": a potion goes through
potionhit(), a breakable one (egg, cream pie, venom) breaks on the face,
with the petrifying egg's stoning, the blinding increments and "You've got
it all over your face!"; a harmless missile "doesn't hurt"; anything else
does dmgval() damage, or a weight-based rnd() for non-weapons with the
silver and blessed bonuses, artifact_hit() with a fake rn1(18, 2) roll,
hard-helmet reduction to 1 ("Fortunately, you are wearing a hard helmet."
or "Unfortunately, you are wearing a hat." for a rock against a xorn),
"Your helmet does not protect you.", the petrifying corpse's
"elementary physics" stoning, "The silver sears you!", hitfloor(obj, TRUE)
and losehp(dmg, "falling object"). s66-20 threw a stack upward: the three
obj_resists() rolls of breaktest() were missing.

## The tty hit-point bar, and the recorder's five-space rule

The hitpointbar option (s66-38 turned it on through 'O') wraps the status
title in '[' and ']' at a forced width of 30 (wintty.c:4562, "%-30.30s",
repad_with_dashes() when critically_low_hp(TRUE)) and draws the first
(30 * percent / 100) characters in inverse, all 30 at full HP, at least
one when injured and at most 29 while not at full HP (wintty.c:5117;
percentage() rounds a non-zero HP up to 1%). The recorded reference, though,
shows the inverse only over the title text: scripts/record-session.mjs
compressAnsiLine() turns every run of five or more spaces in the tty's
output line into a cursor-forward regardless of the SGR state in effect,
and screen-decode.mjs restores such a run as plain cells. The status
painter therefore drops the inverse attribute on any run of five or more
padding spaces inside the bar and keeps it on shorter runs, which is what
the scorer will see for the C. Remember this rule for any other inverse
region that can contain long space runs.

## mhitu.js: falling hiders, seduction substitution, protects()

mattacku()'s hider arms are the C's (mhitu.c:1050): a hidden ceiling
hider "falls from the ceiling", the attacker is taken off the map so
enexto() can find the hero a spot (an eel in water refuses to trade with
a hero over land: "<Mon> draws back as you drop!"), the monster takes the
hero's square, a long worm's tail is re-checked, teleds() moves the hero,
and a piercer then hits the monster for d(3,6) unless its hard helmet
deflects ("Your blow glances off <its> helmet."); a surface hider is
told "Wait, <mon>!  There's a <form> named <name> hiding under <object>!"
(or "... a hidden <form> named <name> there!" for eels and trappers, with an
egg's "laid by you" suppressed) or "It tries to move where you are
hiding." getmattk() carries the SYSOPT_SEDUCE=0 substitution table
(monsters.h SEDUCTION_ATTACKS_NO) even though sysconf leaves seduce on;
wildmiss() has its impossible(); magic_negation() consults artifact.c:698
protects() (ported) for a monster's worn or wielded protection sources and
gives aligned priests and minions the intrinsic minimum of 1, as the C
does.

## A discarded long worm takes its tail with it (m_detach, wormgone)

s68-22 diverged during Medusa's level: sp_lev.c create_object() makes a
monster only to source a statue's inventory and throws it away with
mongone(). When that monster is a long worm, makemon has already given it
rn2(5) tail segments, and the C's m_detach() calls mon_leaving_level(),
which uses remove_worm() instead of remove_monster() for a worm, then
wormgone(), which frees the segments and the worm slot. Ours removed only
the head square, so the tail squares stayed in the level's monster grid;
a later des.monster() at one of them failed goodpos() and drew extra
rndmonst() calls. m_detach() now inlines mon_leaving_level() (it is
synchronous because create_object() and mk_trap_statue() are): mtrapped
cleared, remove_worm()/remove_monster() including the vault guard at
<0,0>, mundetected, seemimic(), newsym() and the polearm target, with
notes for unstuck() and fill_pit(), which need the message loop; and it
calls wormgone() after shkgone() as mon.c:2787 does. Two worm.c fixes
came with it: toss_wsegs() now calls remove_monster() for every segment
with a square, as worm.c:146 does. It used to delete a square only when
the monster there still had a wormno, but wormgone() clears wormno before
calling it, so the guard never fired and keepdogs()' pet worm left its tail
squares behind on the old level. remove_worm() is synchronous now
(worm.js already imports remove_monster statically).

## Seed 68: the first-move death line, W-tower disorientation, scroll labels

s68-01: dying on move 1 prints "Do not pass Go.  Do not collect 200
zorkmids." (end.c:1187, `svm.moves <= 1 && how < PANICKED &&
!done_stopprint`) after the achievement and dump-log lines and before the
bones decision. s68-34: scrolltele()'s "You feel disoriented for a
moment." fires for `u.uhave.amulet || On_W_tower_level(&u.uz)` with the
same !rn2(3) (teleport.c:865); ours only tested the Amulet, so a scroll
of teleportation read on a Wizard's Tower level drew one call fewer.
s68-12: an Archeologist reading a scroll label on pickup counts as
becoming literate, and the first time logs "became literate by
deciphering a scroll label" (invent.c:1047, LL_CONDUCT), which shows in
the dumplog and the ^X achievements.

## timeout.js: every nh_timeout() case, slip_or_trip(), burn_object(), storms

nh_timeout() (timeout.c:588) now has the C's whole property switch. The
eleven cases that used to fall into a note were INVIS ("You are no longer
invisible." / "can no longer see through yourself."), SLEEPY (the yawn at
four turns, then "You fall asleep." with fall_asleep(-rnd(20)) and the
next nap rnd(100) later, or a rnd(100) deferral while unconscious or
sleep resistant), LEVITATION (float_down(I_SPECIAL | TIMEOUT), ending a
one-turn Flying first), FLYING ("You land." and spoteffects), FIRE_RES
and WWALKING (the lava life-saving grants ending), DISPLACED
(toggle_displacement), WARN_OF_MON, PASSES_WALLS ("You feel hemmed in
again." via pray.c stuck_in_wall(), now exported from pray.js, or "You're
back to your normal self again."), MAGICAL_BREATHING (the cough in a gas
cloud) and PROT_FROM_SHAPE_CHANGERS (restartcham). The most important of
these for the fuzz corpus was LEVITATION: a potion of levitation timing
out never called float_down() before, so the hero stayed aloft with no
"You float gently to the floor." SEE_INVIS gained set_mimic_blocking().
CONFUSION, STUNNED, HALLUC and BLINDED use set_itimeout(…, 1) and the
stop_occupation() the C has when the condition really ended. Before the
loop, the polymorph countdown `u.mtimedone && !--u.mtimedone` (Unchanging
re-rolls rnd(100*mlevel+1), a were form calls you_unwere(), anything else
rehumanize()) and `u.ugallop` ("<Steed> stops galloping.") were missing
entirely; so were levitation_dialogue() ("You float slightly lower.",
"You wobble unsteadily in the air." or "over the water"), phaze_dialogue(),
region_dialogue() and sleep_dialogue(), all in the C's order.
youprop.js gained Sleepy() and Warn_of_mon().

slip_or_trip() (timeout.c:1222) is the C: tripping over a cockatrice
corpse barefoot sets the killer "tripping over a cockatrice corpse" and
instapetrify()s; the ice line is "<Steed> slips on the ice." when
mounted; the mounted rider loses balance and dismount_steed(DISMOUNT_FELL)s
unless the saddle is cursed, with the !ice_only || !rn2(3) gate; the
!rn2(10 + DEX) hurtle uses confdir(TRUE) except for grid bugs and skips a
hurtle back to the square the move started on; and the mounted rn2(4)
stirrup/reins/saddle-horn/slide messages dismount.

burn_object() (timeout.c:1383) is rewritten in the C's shape: the
timeout-while-away branch frees a burnt-out candle or oil potion
wherever it is and maybe_unhide_at()s a monster standing on it, the
live branch takes x,y from get_obj_location(), the owner prefix from
Shk_Your() ("Your ", "Izchak's ") so an unpaid lamp is named by its
owner, and monster-carried lights (OBJ_MINVENT) get the same lines the
hero's do, with lantern_message() ("<Mon>'s lantern is getting dim.",
and "Batteries have not been invented yet." when hallucinating) and
see_lamp_flicker() as helpers; the unexpected-object default is the
C's impossible(). do_storms() (timeout.c:1847) fires the lightning as
buzz(BZ_M_SPELL(BZ_OFS_AD(AD_ELEC)), 8, …) with buzzer cleared;
BZ_M_SPELL moved to const.js (hack.h:1486) and priest.js imports it.
timeout.js has no note_unported sites left.

## ^X while engulfed: "You are engulfed by the dust vortex (3)."

s70-08 read ^X from inside a dust vortex and the C's attributes ran to
three pages where ours had two: status_enlightenment() (insight.c:1100)
names the engulfer, "swallowed by" when it digests, "engulfed by"
otherwise, adds " and are being digested" (or " and got totally
digested" in a final dump with the swallow timer at 0) for an AD_DGST
engulfer, and in wizard mode appends the remaining swallow time
"(u.uswldtim)". heldmon is computed once for both the engulfed and the
held-by lines, with the C's has_mgivenname() test for a monster named
"it". The held-by distance now comes from getpos.c dxdy_to_dist_descr()
(exported from getpos.js; the insight-only full_direction() copy is
gone), and the C's "stuck to <steed>'s saddle" line for a cursed saddle
is ported, with the C's local Riding (false for a riding-accident death
dump) and steedname computed at the top of the function as insight.c:946
does.

## Blind() reads the property words, and why a rush survives regaining sight

The census caught s14-36 after the timeout.js round: a rush ("B") while
blind ran on for ten squares in the C but stopped after seven in ours. The
C's nh_timeout() BLINDED case is `was_blind = !!Blind; set_itimeout(
&HBlinded, 1); make_blinded(0, TRUE); if (was_blind && !Blind)
stop_occupation();`, and Blind is the macro `((HBlinded || EBlinded) &&
!BBlinded)` (youprop.h:103). The loop has already decremented HBlinded to
zero when the case runs, so was_blind is false unless a blindfold or a
source bit (FROMOUTSIDE, FROMFORM) is set, and the rush is never
interrupted by "You can see again." Ours' Blind() returned the cached
u.ublind flag that make_blinded() maintains, so was_blind was true and
stop_occupation() ended the rush. Blind() is now the macro: `!blocked.
BLINDED && (HBlinded || Blindfolded())`; eyeless polymorph forms are
covered by the FROMFORM bit set_uasmon() sets. The one place that used
the cache as a stand-in, lock.c chest_shatter_msg()'s temporary
HBlinded=1 for singular(), now sets the property words like the C.
u.ublind stays as a cache for the direct reads that remain.

## do.js, dothrow.js and spell.js notes: portals, boulders, slips, spell sorting

do.js: boulder_hits_pool() calls burn_away_slime() when lava splashes
the hero; goto_level() calls selftouch("Falling, you") after a stairs
tumble and a trap-door fall (ballfall() stays a note, ball.c is not
ported); u_collide_m() ends as the C's mon.c-style arm: a monster still on
the hero's square gets "(monster in hero's way)" in wizard mode, rloc(
RLOC_NOMSG), and m_into_limbo() when no room is found; deferred_goto()
removes a UTOTYPE_RMPORTAL portal with deltrap() and newsym(); dropz()
calls container_impact_dmg() for an impact drop. dothrow.js: throw_obj()
restores context.objsplit and unsplitobj()s a thrown half; throwit()
prints "<Obj> misfires!" for launcher ammo and "<Obj> slips as you throw
it!" for greased or throwing weapons; thitmonst() adds spec_abon() of an
artifact launcher. spell.js: the four impossible() arms ("Too many spells
memorized!", "Spell X already known.", "Unknown spell N attempted.",
"tport_spell: spellbook full") and the whole spell sort: spl_sortchoices,
spell_cmp() (letter, alphabetical, level low/high, skill group with three
orderings, current, or reassigning letters), sortspells() over a
spl_orderindx that dospellmenu() displays through, and spellsortmenu()
(letters a..h, 'z' after a blank line for "reassign casting letters",
the current mode preselected, "View known spells list sorted"); dovspell()
frees the index and resets the mode on exit like the C. hacklib.js gained
lowc(), strncmpi() and strcmpi() (global.h:113) for the alphabetical
compare.

## hitmu() dispatches every damage type the C does

uhitm.js gained mhitm_ad_corr() (armor corrosion), mhitm_ad_sgld()
(gold theft: the hero's arm through steal.c stealgold(), now ported in
steal.js with the floor-gold snatch "quickly snatches some gold from
between your feet" and the purse split through somegold(), and the
monster-vs-monster theft with the thief teleporting away), mhitm_ad_conf()
(the !rn2(4) confusion touch with mspec_used = damage + rn2(6)),
mhitm_ad_halu(), mhitm_ad_dgst() (a pet's meal of a swallowed monster,
"Burrrrp!", Riders killing the engulfer) and mhitm_ad_dise() (diseasemu()
for the hero, fungus/ghoul/defended() immunity for monsters). hitmu()'s
fallback is the C's mhitm_adtyping() default, damage 0; mhitu.js has no
note_unported sites left.

## mongone() is asynchronous: vault guards and shape restoration

mongone() now does what mon.c:3267 does before m_detach(): a vault guard
goes through grddead() (vault.c:175, ported: clear_fcorr(), relobj(),
parkguard() and a second attempt), and unstuck() releases a hero the
monster held, tested first so the two synchronous level-generation
callers (create_object()'s statue template, mk_trap_statue()) never
suspend. Every other caller awaits it. m_detach() calls wizdeadorgone()
(wizard.c:815, ported: one fewer Wizard, udemigod and udg_cnt = rn1(250,
50)) and sets MON_ENDGAME_FREE. restore_cham() reverts a cancelled
shapeshifter, or any while the hero has protection from shape changers,
through normal_shape() and is awaited by its three callers.

## Hallucinatory currency, the full '$' report, and the djinni's chat

currency() rolls ROLL_FROM(currencies) while hallucinating (invent.c:1521,
twenty-one names, one rn2 per call) and makeplural()s it; every "Your
wallet contains N <currency>" line and shop price drew nothing before.
doprgold() reports gold stashed in containers (hidden_gold()), has the
terse "You are carrying a total of ..." form, and ends with shk.c
shopper_financial_report() (credit and debt in this shop, then in the
others on the level; shop_debt() sums the debit and the bill), ported in
shk.js. domonnoise() has the C's MS_DJINNI lines and no default: sounds
the C ignores stay silent.
