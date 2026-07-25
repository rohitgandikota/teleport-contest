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
| **Score** | **135/11,405 screens**, 0/44 sessions passing, corpus RNG **112,138/792,838 (14.1%)** · held-out **10.6%** |

### Pet: object search wired, but seed0102 still does not reach it

`dochug` -> `dog_move` -> `dog_goal`'s object search is in and worth **+517
RNG**; `obj_resists` fell from 7 blocked sessions to 5. seed0102 is NOT among
the five that moved and still diverges at its own call 4449.

**Diagnosed properly, and the answer is bigger than the pet.** An earlier
reading of "17 objects, mtame 10 at (29,8)" came from an ad-hoc harness whose run
threw at once — **it was measuring a partial run and is withdrawn.** Use
`frozen/ps_test_runner.mjs`, and note that the runner swallows stderr, so probes
must write to a file.

**Every "0 calls" result below was a BROKEN PROBE. Disregard them.** Three
separate probe attempts silently measured nothing:

1. `console.error` — the runner swallows stderr.
2. `require("fs")` inside `js/mon.js` — that file is an ES module, so `require`
   is undefined and the surrounding try/catch ate the ReferenceError.
3. `import { appendFileSync } from "node:fs"` at the top of `js/mon.js` — broke
   module loading outright (`RNG 0/0`).

If you need to instrument a run, verify the probe fires on a session you KNOW
executes the code first. A silent probe is indistinguishable from a silent bug.

**What is actually true**, by reasoning from the code rather than a probe:
`mcalcmove` and `movemon` are called from the same `if (g.context?.move)` block
at js/allmain.js:302-305, and our `mcalcmove` draws MATCH C at seed0102 calls
4442-4443. So `context.move` is truthy, `movemon()` does run, and `dochug()` does
run. The monster phase is entered.

`movemon()` is called from `js/allmain.js:302` inside `if (g.context?.move)`, and
`game.context.move` is set only by the command handlers in `js/cmd.js` (line 74
onward). seed0102's keys are `#name`, ESC, `f l i`, ESC, `+`, ESC ... `s s :` —
almost all zero-time commands, so `context.move` stays 0 for most of the session.

### FOUND: our moveloop calls movemon() once; C loops it to exhaustion

This is why the pet never acts, and it is structural rather than a missing
function. C (src/allmain.c:207-243):

```c
u.umovement -= NORMAL_SPEED;
do {                                   /* hero can't move this turn loop */
    svc.context.mon_moving = TRUE;
    do {
        monscanmove = movemon();       /* LOOPS until no monster can move */
        if (u.umovement >= NORMAL_SPEED)
            break;                     /* it's now your turn */
    } while (monscanmove);
    svc.context.mon_moving = FALSE;
    ...
    if (!monscanmove && u.umovement < NORMAL_SPEED) {
        /* only NOW is a new turn set up */
        mcalcdistress();
        for (mtmp = fmon; mtmp; mtmp = mtmp->nmon)
            mtmp->movement += mcalcmove(mtmp, TRUE);
        maybe_generate_rnd_mon();
        u_calc_moveamt(mvl_wtcap);
        settrack();
        svm.moves++;
    }
} while (...);
```

Ours (js/allmain.js:300-312) calls `movemon()` **once**, unconditionally allots
movement straight afterwards, and wraps the whole thing in
`if (g.context?.move)`. Three consequences:

1. Monsters never get a second `movemon()` pass in the same turn, so a monster
   that banks movement during allotment does not spend it until the next player
   command.
2. The allotment happens even when monsters could still move, where C only
   allots once `movemon()` returns false.
3. `if (context.move)` skips the monster phase entirely for zero-time commands.
   seed0102's keys are almost all zero-time (`#name`, ESC, `f l i`, `+`, `\\`,
   ^X), so its monster phase almost never runs at all.

**Verified, with a probe that actually works this time:** `dochug` fires **0
times** across seed0102 while the run stays healthy at 4451/4485. The probe
method that works is `process.stdout.write` inserted by a heredoc script — check
`node -e "import('./js/monmove.js')"` reports `syntax ok` before trusting a
result, because a broken edit makes the runner report a clean-looking failure.

This is the next thing to fix and it gates every session's monster phase, not
just the pet.

**The stream at the divergence**, for reference. C's seed0102:

```
4442 rn2(12)   mcalcmove          ok
4443 rn2(12)   mcalcmove          ok      (so C has TWO monsters)
4444 rn2(70)   maybe_generate_rnd_mon     ok
4445 rn2(300)  dosounds                   ok
4446 rn2(20)   gethungry                  ok
4447 rn2(73)   moveloop_core              ok
4448 rn2(5)    distfleeck                 ok   <- dochug IS running
4449 rn2(100)  obj_resists          <-- C scans an object; we emit rn2(12)
```

An `rn2(12)` at 4449 is another `mcalcmove`, i.e. our move loop has gone round
again while C is still inside the pet's turn. Combined with 4448 matching, that
means `dochug` runs, and then either the tame branch is not taken or
`dog_goal`'s search finds nothing within its 5-square box.

So the question is narrow: **at that moment, is there an object within 5 squares
of the pet, and is `mtmp.mtame` set?** C clearly has one in range. Compare our
level's object coordinates against the pet's position at that turn — if they
differ, the divergence is upstream in placement, not in the pet at all.

### Two sessions within touching distance of a full pass

**seed0102 at 4451/4485 (99.2%)** and **seed0101 at 2306/2371 (97.3%)**. Nothing
else in the corpus is close. Both are worth more than any breadth work.

**seed0102** needs the pet. Its remaining 34 calls are `obj_resists`, `dog_goal`,
`dog_move`, `score_targ` — and note the ORDER: `obj_resists(zap.c:1469)` fires
*before* `dog_goal(dogmove.c:554)`'s `rn2(8)`, so it is not the `can_carry()` in
that same condition (which follows the rn2). It comes from an earlier object in
`dog_goal`'s square scan. Porting this needs the scan order, `dogfood()`,
`can_carry()` and `m_cansee()`, not just the two functions the tags name.

**CORRECTION on scoping: `mfndpos` IS needed for the pet.** m_move dispatches
tame monsters at src/monmove.c:1773, before *its own* mfndpos call at :1925 —
but `dog_move()` has one of its own at **src/dogmove.c:1063**, and that is what
actually moves the pet. The 243-line function cannot be skipped.

**Why seed0102 still diverges, measured rather than guessed.** With the move
loop restructured, `dochug` now runs and the pet is correctly first in the
monster list (`tame:10 at (29,8)`, matching C's fmon ordering). But
`dog_goal`'s search finds **zero objects** inside its box, where C finds one:

```
pet at (29,8)  ->  search box x 24..34, y 3..13
our objects:  (74,2) (73,17) (65,17) (65,7) (61,11) (56,17) (43,10) (41,9)
              (40,6) (39,5) (30,14) (28,16) (28,16) (23,14) (7,5) (22,10) (48,14)
```

The nearest, (30,14), misses by one square on y. That is not an object-placement
bug: **our pet has never moved.** C's pet has been walking since turn one, so by
this point the two are standing in different places and C's happens to be within
reach of something. Chasing the object list is the wrong thread — the pet has to
actually move first, which means `mfndpos` and the movement-selection tail of
`dog_move`.

**seed0101 is the SAME blocker — it is the pet too.** Its divergence is at call
2293, immediately after `moveloop_preamble`:

```
2291  rnd(9000)  moveloop_preamble    ok
2292  rnd(30)    moveloop_preamble    ok
2293  rnd(2)     next_ident           <- MISMATCH, we jump straight to mcalcmove
2294  rn2(100)   obj_resists
2295  rn2(12)    mcalcmove            (the monster loop proper)
```

Two facts make this unambiguous, and both are easy to get wrong from the tag
alone:

- **`next_ident()` is called for MONSTERS as well as objects** (makemon.c:871
  and :1251, not just mkobj.c:1187). An `rnd(2)` tagged `next_ident` is not
  evidence of object creation.
- **`obj_resists`'s caller here is `can_carry()` in src/dog.c:1004**
  (`if (is_quest_artifact(obj) || obj_resists(obj, 0, 95))`), which is pet code,
  not zap code.

So the earlier reading of this as a starting-inventory `trquan` transposition was
wrong — that hypothesis is withdrawn. `ini_inv` is fine; it was ruled out by
checking the loop tail against C, and the tag simply pointed somewhere else.

**Consolidated: the pet is the single highest-value target in the port.** It
blocks seed0102 (99.2%), seed0101 (97.3%), the 7 `obj_resists` sessions and the 3
`dog_goal` sessions — and it is smaller than budgeted, because `mfndpos` is not
on the tame path.

**The acceptance test, straight from seed0101's recording.** Port against this
rather than against the C source alone; it is the first turn of the move loop
and it shows the call ORDER, which is the part the source makes hard to see:

```
2291 rnd(9000)  moveloop_preamble(allmain.c:72)      context.rndencode
2292 rnd(30)    moveloop_preamble(allmain.c:79)      context.seer_turn
2293 rnd(2)     next_ident(mkobj.c:521)         <-- still inside the preamble,
2294 rn2(100)   obj_resists(zap.c:1469)             after set_wear + pickup(1)
2295 rn2(12)    mcalcmove(mon.c:1164)           <-- movemon starts here
2296 rn2(12)    mcalcmove
2297 rn2(12)    mcalcmove
2298 rn2(12)    mcalcmove
2299 rn2(70)    maybe_generate_rnd_mon(allmain.c:166)
2300 rn2(20)    gethungry(eat.c:3191)
2301 rn2(73)    moveloop_core(allmain.c:360)
2302 rn2(5)     distfleeck(monmove.c:538)       <-- the pet's turn begins
2303 rn2(100)   obj_resists(zap.c:1469)
2304 rn2(8)     dog_goal(dogmove.c:554)
2305 rn2(100)   obj_resists(zap.c:1469)
2306 rn2(8)     dog_goal(dogmove.c:554)
```

Two things to resolve while writing it, both visible only in this log:

1. **2293-2294 are NOT the pet.** They precede `mcalcmove`, so they happen in
   `moveloop_preamble`'s tail — `set_wear()` and `pickup(1)`, the autopickup at
   the starting square. Do not attribute them to `dog_invent`.
2. **`obj_resists` comes BEFORE `dog_goal`'s `rn2(8)`, repeatedly.** The C source
   reads the other way round —
   `edog->apport > rn2(8) && can_carry(mtmp, obj) > 0` puts the rn2 first — so
   either the pairs are offset by one iteration, or the first `obj_resists`
   arrives through `dogfood()` rather than `can_carry()`. Settle that before
   writing the loop; getting it backwards costs one draw per object per turn.

### CORRECTION: `--More--` is NOT the biggest opportunity — it is unreachable

The claim below ("9.7% of the public score sitting behind one piece of topl.c")
was **wrong**, and the error is worth understanding because it is easy to repeat.

Counting frames that contain `--More--` is not the same as counting frames we
could score by rendering it. Here is where those 1108 frames actually live:

```
  137 /   410   seed5002-wizard-coverage-pair
  131 /   532   seed0399-wizard-hallu-actions
  124 /  1814   seed4500-knight-coverage
  100 /  1953   seed0030-ten-diverse-deaths
   82 /   595   seed0002-healer-reflection-drummer
   60 /    84   seed0900-tourist-explore-actions
```

Every one of those is a deep-gameplay session that diverges from C's PRNG stream
early and scores **zero** screens today. A perfect `--More--` would not win a
single one of them, because the map, the monsters and the messages underneath it
are all wrong by then.

Meanwhile the two sessions we DO render frames for contain almost none:
**seed8000 has 0 of 23, seed0077 has 1 of 33.** That single frame is seed0077
step 12, which is the one the earlier attempts kept chasing.

**The lesson:** a frame-count over the recordings measures what C draws, not what
is available to us. Weight any such count by whether we can already render the
rest of that frame. `tools/generalize.mjs` has the same hazard in a different
form — it ranks paths by "reached", not by "draws".

**Stop rule invoked.** Three iterations, ~1 screen of realistic upside. Moving to
`m_move`, which is what actually gates those sessions. The topl.c findings below
are correct and worth keeping for when the streams reach that far.

### The `--More--` mechanics, correct but not yet worth landing

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

**Attempted, measured, reverted — with the two frames that discriminate.**
A first cut set `toplin = TOPLINE_NEED_MORE` in `pline()`, cleared it wherever
`_pending_message` is cleared, and rendered the suffix from `more()`'s own rule:

```c
tty_curs(BASE_WINDOW, cw->curx + 1, cw->cury);
if (cw->curx >= CO - 8) topl_putsym('\n');   /* CO - 8 == 72 */
putsyms(defmorestr);                          /* appended, NO leading space */
```

That is demonstrably the right rendering — **seed0077 step 12 went from 25
differing cells to 17 and its cursor became exactly C's `[77,0,1]`**. But it
scored 132 against 135, because seed8000 lost 3 frames. The counterexample is
sharp and worth keeping:

| frame | C's top line | C's cursor |
|---|---|---|
| seed0077 step 12 (after key `' '`) | welcome **+ `--More--`** | `[77,0,1]`, past the suffix |
| seed8000 step 0 (initial, before any input) | welcome, **no suffix** | `[36,7,1]`, on the hero |

Both frames carry the same kind of message from the same `pline()`. So the
discriminator is NOT the message and NOT "is there an unacknowledged top line" —
it is whether the game is actually blocking on `display_nhwindow(WIN_MESSAGE,
TRUE)` at the moment the frame is taken. The initial frame is captured after the
map is drawn and the cursor parked on the hero; seed0077 step 12 is captured
inside a genuine `more()`.

**RESOLVED — the answer is that `--More--` is not a state at all, it is a
FRAME captured inside a blocking call.** Reading `more()` end to end settles it:

```c
more(void) {
    ...
    putsyms(defmorestr);        /* the suffix goes up */
    xwaitforspace("\033 ");     /* <-- the frame with --More-- is captured HERE */
    ...
    ttyDisplay->toplin = TOPLINE_EMPTY;   /* and it is gone again */
}
```

So the suffix is on screen for exactly the duration of one input read — the one
*inside* `more()` — and `toplin` is EMPTY the moment that key arrives. Modelling
it as a flag that `pline()` sets and the next `nhgetch()` reads is wrong in both
directions, which is exactly what the seed8000/seed0077 pair showed.

Two corrections to what was written above, both of which cost time:

- The enum values are **`TOPLINE_NEED_MORE = 1`, `TOPLINE_NON_EMPTY = 2`** — the
  opposite of what a first guess suggests from their order in the header.
- `update_topl()` (topl.c:138) sets `NEED_MORE` on **every** pline, so "is the
  top line unacknowledged" does not discriminate anything. Do not gate on it.

**What to build:** a real `more()` in the display layer that draws the suffix by
the rule already verified below, awaits a key, then clears the top line — called
where C calls `display_nhwindow(WIN_MESSAGE, TRUE)`.

**The last clue, and it is in the rc files.** The two frames differ in exactly
one relevant option:

```
seed8000  OPTIONS=... ,!legacy, !tutorial, !splash_screen, ...   -> NO --More--
seed0077  (legacy left at its default, i.e. ON)                  -> --More--
```

With `legacy` on, `com_pager("legacy")` puts up the Book-of-Kos text window
first — that is seed0077 step 11, with its own `--More--` on row 17 — and the
welcome message only reaches the top line afterwards. With `!legacy` the welcome
is the first and only thing on it.

So the thing to check first is `update_topl()`'s own escalation:

```c
if (ttyDisplay->cury && otoplin != TOPLINE_SPECIAL_PROMPT)
    more();
```

`cw->cury` is non-zero only when the message window already holds something. A
preceding message (or the pager's dismissal leaving `cury` advanced) is what
makes the welcome call `more()` in seed0077 and not in seed8000. Verify that
against the two recordings before writing any code — it predicts the whole
split, and it means the trigger lives in `update_topl`, not in the display_
nhwindow call sites after all.

**Three iterations have gone into this.** Each narrowed it — rendering verified,
then the state model discarded, now the trigger localised — but if the next
attempt does not land it, switch to `m_move` and come back with fresh eyes.
1108 frames is worth real effort, not unbounded effort.

### The monster phase is ported; the open question is movement accumulation

`dochug` -> `m_move` / `dog_move` -> `mfndpos` -> `newdogpos` is complete end to
end, plus `mon_allowflags`, `disturb`, `dog_invent`, `dog_goal` and the choice
loops. `js/fastforward.js` is deleted.

**What is left, measured on seed8000.** C runs FOUR `distfleeck` calls per turn;
we run two. Its log makes the whole turn shape explicit:

```
2975-2978  rn2(12)  mcalcmove x4        <- allotment, end of invocation N
2979       rn2(70)  maybe_generate_rnd_mon
2980       rn2(300) dosounds
2981       rn2(20)  gethungry
2982       rn2(82)  moveloop_core        <- u_wipe_engr gate
2983-2986  rn2(5)   distfleeck x4        <- invocation N+1's movemon
2987-2990  rn2(12)  mcalcmove x4         <- and its allotment
```

So our loop ORDER is right (movemon first, then the new-turn block). What
differs is which monsters clear the bar. Our four have

```
speed 1  movement 0      speed 6  movement 0
speed 12 movement 12     speed 1  movement 0
```

Only the speed-12 one banks a full ration each turn. A speed-1 monster gets 12
movement one turn in twelve (`mmove_adj = 1 % 12 = 1; if (rn2(12) < 1)`), so it
should act about once every twelve turns — yet C's four all act every turn.

Ruled out already, so do not re-check:
- `mcalcmove` matches C line for line, including that the `rn2(NORMAL_SPEED)`
  fires even when `mmove_adj` is 0.
- `mmove` is present for all 383 entries in the generated monster table.
- `makemon` does not set `movement` in C either — `cg.zeromonst` zeroes it, and
  ours starts at 0 too.
- The sleep path: `disturb()` is now ported and changed nothing here.

**Named them.** Our four monsters on seed8000 are:

```
lichen  spd 1  at 67,13      newt    spd 6  at 52,17
jackal  spd 12 at 15,7       lichen  spd 1  at 16,4
```

The speeds are correct — verified against `include/monsters.h` directly
(`MON(NAM("sewer rat"), ..., LVL(0, 12, 7, 0, 0), ...)` gives mmove 12, and our
generated table agrees for sewer rat, lichen and newt). So the arithmetic is not
the problem.

But that set CANNOT produce four monster turns every turn. `mcalcmove` gives a
speed-1 monster 12 movement only one turn in twelve, so the expected number
acting is about 1.7, and C shows four consistently.

**Two readings, and they need separating before any more code is written:**

1. **Our species are wrong while the draw COUNT is right.** `rndmonst` picks by
   walking a probability table; a wrong table yields a different monster for the
   same number of draws, so the stream matches and the creatures differ. That
   would make every monster-speed symptom downstream a red herring. This is the
   same failure mode that produced the `oc_prob` and `G_` bugs — check
   `tools/gen-monst.mjs`'s geno/frequency extraction against `monsters.h`.
2. **C has fast monsters acting twice.** A speed-24 monster banks 24, acts,
   still has 12, and the inner `movemon()` loop lets it act again — so four
   `distfleeck` calls could be two monsters moving twice, not four moving once.

**Test run, and reading 1 is DISPROVEN.** C's per-turn counts over the first
dozen turns are:

```
4m/0d  4m/4d  4m/4d  4m/4d  4m/2d  4m/4d  4m/4d  4m/2d  4m/4d  4m/4d  4m/4d
```

Four `mcalcmove` every turn, so exactly four monsters, and never more than four
`distfleeck` — so no monster acts twice and reading 2 is out too.

And the probability table is fine. Verified against `include/monsters.h`
entry by entry:

```
sewer rat  geno=161  = G_GENO|G_SGROUP|1   freq 1   correct
lichen     geno=36   = G_GENO|4            freq 4   correct
newt       geno=37   = G_GENO|5            freq 5   correct
jackal     geno=163  = G_GENO|G_SGROUP|3   freq 3   correct
```

(`G_SGROUP` is 0x80 and `G_FREQ` is 0x07, both from monflag.h.) Lichens and newts
are among the most common early monsters, so generating two lichens and a newt on
level 1 is entirely plausible — our species are very likely RIGHT.

**So both readings are dead and the contradiction stands.** Side by side, first
dozen turns, counting `rn2(12)` as allotment and `rn2(5)` as distfleeck:

```
C:    4m/0d  4m/4d  4m/4d  4m/4d  4m/2d  4m/4d  4m/4d  4m/2d  4m/4d
ours: 4m/0d  4m/2d  4m/1d  4m/1d  4m/2d  4m/2d  4m/3d  5m/1d  4m/1d
```

The allotment count matches exactly — four monsters, every turn. The turn count
does not: C's four nearly always act, ours act once or twice. (Caveat: neither
`rn2(12)` nor `rn2(5)` is unique to those functions, so treat the counts as
indicative. The 5m outlier is an extra `rn2(12)` from somewhere else.)

`mcalcdistress` is ruled out as the cause: `m_calcdistress` (src/mon.c) touches
`mblinded`, `mfrozen`, `mfleetim`, regeneration and shapeshifting — never
`movement` or `mspeed`. `mon_regen` draws nothing; `were_change` and
`decide_to_shapeshift` do draw but are gated on lycanthropes and shapechangers,
which none of these four are.

**What is left, after eliminating everything checkable in rndmonst.** Compared
against src/makemon.c line by line and all MATCHING:

- the weighted-reservoir walk itself (`weight > 0`, `totalweight += weight`,
  `rn2(totalweight) < weight`)
- `monmax_difficulty(levdif) = (levdif + u.ulevel) / 2` and
  `monmin_difficulty(levdif) = levdif / 6` (include/monst.h:259)
- `montooweak` / `montoostrong`
- `align_shift` — same switch on the dungeon's alignment, same ALIGNWEIGHT
  arithmetic
- `temperature_shift` — returns 0 on any level with `flags.temperature == 0`,
  which is every level reached

**And the arithmetic makes the contradiction exact.** `mcalcmove` gives a
monster whose speed is below 12 either 0 or 12, never a partial ration — the
`mmove -= mmove_adj` zeroes it first. So there is no accumulation: per turn the
jackal always acts, the newt acts 1/2 of the time, each lichen 1/12. Expected
turns per turn ~1.67, and we measure 1-3. C measures 4, essentially always,
which is only possible if all four of its monsters have speed >= 12.

Both now checked, and both MATCH:

- `uncommon(mndx)` — identical: `G_NOGEN | G_UNIQ`, then `mvitals & G_GONE`,
  then the Inhell / `G_HELL` split.
- `level_difficulty()` — ours is `depth(u.uz)`, exactly C's ordinary-dungeon
  branch. For dlevel 1 both give 1.

**So the entire rndmonst path is verified and the bug is NOT in it.** With
zlevel 1 and ulevel 1, `maxmlev = (1 + 1) / 2 = 1` and `minmlev = 0`, so only
difficulty 0-1 monsters are eligible — and those are the slow ones. Both C and
our port compute the same bounds from the same inputs.

**Which means the premise is wrong somewhere.** Either C's four monsters were
not all produced by `makemon(NULL, ...)` / `rndmonst` — a themed-room fill, a
`G_SGROUP` group spawn (which puts several jackals down at once), or a special
placement would each bypass the difficulty bounds — or `u.ulevel` is not 1 at
the moment they are created, which would raise `maxmlev` and admit faster
monsters.

**Measurement done. All four of our monsters come from the SAME call site:**
`fill_ordinary_room` -> `makemon(NULL, ...)` -> `rndmonst`. No group spawn, no
themed fill, no special placement. So C's four come from there too, and since
`rndmonst` is verified identical with matching draws, **C's four monsters are
the same species as ours**: lichen, newt, jackal, lichen.

The difficulty pool is not the discriminator either — at `maxmlev` 1 the
eligible set is lichen, newt, jackal, sewer rat, grid bug, kobold, with speeds
1, 6, 12, 12, 12, 6 — all `difficulty = 1` in our generated table.

**So every hypothesis is now dead**, and the contradiction is sharper than ever:
C and our port generate the same four monsters with the same speeds, `mcalcmove`
is identical, and yet C runs four `distfleeck` calls per turn where the
arithmetic says ~1.67.

**That means the reading of C's log is what is wrong, not the port.** The four
`rn2(5)` draws are tagged `distfleeck(monmove.c:538)` but tags name the C
function at that source line, and `rn2(5)` appears in several places. Before
writing another line of movement code, dump C's log for one turn with FULL tags
and confirm those four really are four separate monsters entering `dochug` —
rather than, say, one monster looping, or an unrelated `rn2(5)` sharing the
line number. Everything downstream of that assumption has been chased and
eliminated.

### Next: the glyph layer — newsym never draws monsters or objects

seed0077 step 12 is now **17 differing cells** (from 117), and every one of them
is map content that is present in the level but absent from the screen:

```
r2 c33   C '-'  ours '?'     a wall glyph terrain_glyph() does not know
r3 c33   C 'x'  ours '.'     a grid bug
r3 c34   C '$'  ours '.'     gold
r6 c34   C '('  ours '.'     a tool
```

`js/display.js` `newsym()` carries the line

```js
// Contestants: add monster, object, and trap display here.
```

so the monster, object and trap layers were never written. C's `newsym` picks in
priority order — hero, then monster, then object, then trap, then terrain — and
each needs its class symbol.

**Do NOT hand-write the symbol tables.** `def_monsyms[]` and `def_oc_syms[]`
live in src/drawing.c and are built from macros in include/defsym.h; a
transcribed copy is exactly the failure mode that produced the `oc_prob`, `G_`,
`SPBOOK_no_NOVEL`, `MR_POISON` and `M3_ZOMBIFIER` bugs in this port. Add a
generator (`tools/gen-drawing.mjs`, alongside gen-monst and gen-objects) that
scrapes defsym.h, and emit both tables plus `def_char_to_objclass`.

The `?` at r2 c33 is separate and simpler: `terrain_glyph()`'s default arm
returns `'?'`, so some wall type reaching it is unmapped. Print the `typ` at that
square to name it.

### more() is ported and consumes its key; the FRAME it draws is still wrong

`js/display.js` now has `more()` and `pline()` sets `TOPLINE_NEED_MORE`, hooked
where C hooks it (win/tty/wintty.c:1921 — displaying a menu with an
unacknowledged top line runs more() first). The keystream effect is correct and
that was the point: seed0077 step 13's tutorial menu now matches C row for row
with its cursor on `[27,6,1]`, where before it was showing C's second-pass
"(Please choose 'y' or 'n'.)" line because the key had been eaten.

**But the frame more() itself draws is wrong.** seed0077 step 12:

```
C:     Hello Shade, welcome to NetHack!  You are a chaotic male human Rogue.--More--
       (plus the whole map below)
ours:                                                                        --More--
       (nothing else at all)
```

The cursor is right — `[77,0,1]` in both — so the suffix is being placed at the
correct column. What is missing is the MESSAGE it should follow and the map
underneath. 117 cells differ where 25 did before.

`more()` clears `game._pending_message` only AFTER its `await nhgetch()`, so the
message should still be on screen when the frame is captured. Something else is
clearing it, or `_buildScreenOutput` is running at the nhgetch hook and redrawing
row 0 from an already-empty `_pending_message`. Find which before touching
`more()` again — the suffix placement and the key consumption are both already
right.

Net effect on the score is zero (135 screens either way), so this is a
correctness debt rather than a regression, but step 12 is visibly worse than
before while step 13 is visibly better.

### FOUND: NetHack 5.0 asks "do a tutorial?" at startup — 32 of 44 sessions

`moveloop()` is three lines:

```c
moveloop_preamble(resuming);
if (!resuming)
    maybe_do_tutorial();
for (;;) moveloop_core();
```

`maybe_do_tutorial()` (src/allmain.c) calls `ask_do_tutorial()`, and that
(src/options.c:430) puts up a **two-item menu** — "Yes, do a tutorial" /
"No, just start play" — whenever `tutorial` was NOT set in the config:

```c
boolean dotut = flags.tutorial;
if (!opt_set_in_config[opt_tutorial]) { ...menu... }
```

If the answer is yes it does `schedule_goto(tut-1)` + `deferred_goto()`, which
builds the tutorial level — `getbones`, the nhlib shuffle pair, `splev_initlev`,
`mktrap`, the lot.

**This is a 5.0 feature with no 3.6 equivalent, and it affects 32 of the 44
public sessions** — every one whose rc does not mention `tutorial`. The 12 that
do (seed8000 among them, with `!tutorial`) are the ones that have been working.

It explains three things at once:
- the `getbones` cluster (4 sessions) — C building a second level at startup
- why seed0009's move string is `Swimmer\ryy  y   yH`: after the name and
  `\r`, one of those `y` keys answers THIS menu, not the `[ynaq]` prompt
- a missing menu FRAME in 32 sessions, which is screens as well as RNG

**Port order:** `ask_do_tutorial`'s menu first (it is an ordinary NHW_MENU and
the window layer already draws those), then whether the recorded answer is yes,
then `deferred_goto` + the tutorial level build behind it. Getting only the menu
right already consumes the correct key and unblocks the keystream for 32
sessions.

### Next target: goto_level — 4 sessions, one of them at 90.1%

`getbones(bones.c:645)` heads the histogram with 4 sessions, and the tag is
misleading in the now-familiar way. Our `getbones` IS ported and DOES draw its
`rn2(3)`. The divergence is that C reaches it a second time and we never do:

```
3335 rnd(9000)  moveloop_preamble    ok
3336 rnd(30)    moveloop_preamble    ok
3337 rn2(3)     getbones             <- C is building a SECOND LEVEL
3338 rn2(3)     nhlib shuffle           (mklev's own nhl_init)
3339 rn2(2)     nhlib shuffle
```

Immediately after the preamble, C runs `mklev()` for a new level: `getbones()`,
then the Lua state's `shuffle(align)` pair, then the whole generation sequence
again. Our port stays on level 1 and goes into the move loop (`rn2(12)`,
mcalcmove).

So the missing subsystem is **`goto_level`** — the hero changing levels. The
four sessions are seed0009 (90.1%), seed0116, seed5002 and seed5006, and
seed0009 in particular has almost nothing else wrong with it.

`mklev()` itself is already ported and correct, so this is the surrounding
machinery. **Checked why, and it is NOT a player action:** the divergence sits
between `moveloop_preamble` (3335-3336) and the first `moveloop_core`, so no
recorded key has been consumed yet. seed0009's rc is bare
(`OPTIONS=symset:DECgraphics`) and its move string starts `Swimmer\ryy  y   yH`
— chargen, then ordinary movement.

And the level being built is a SPECIAL one. The draws after `getbones` are:

```
3338 rn2(3)    nhlib shuffle        mklev's own nhl_init
3339 rn2(2)    nhlib shuffle
3340 rn2(2)    splev_initlev(sp_lev.c:2992)   <- a Lua-defined level
3341 rnd(4)    mktrap(mklev.c:2137)
3342 rn2(100)  percent(nhlib.lua:44)
```

`splev_initlev` means this goes through the special-level loader, not the
ordinary `makelevel()` path. So the thing to find is what makes C build a
special level immediately after the preamble and before the hero's first turn.
Candidates, in order: the Gnomish Mines entrance being pre-generated, a
`deferred_goto()` fired by `u.utotype` already set at startup, or the hero
arriving somewhere other than dungeon level 1.

Establish which by reading C's `moveloop` between `moveloop_preamble` and the
first `moveloop_core` — the call has to be in there — rather than by porting
`goto_level` speculatively.

### Monster movement: what is verified, and where seed8000 stands now

The whole path is ported — `dochug` -> `m_move` / `dog_move` -> `mfndpos` ->
`newdogpos`, plus `mon_allowflags`, `disturb`, `mm_aggression`,
`mm_displacement`, `bad_rock`, `cant_squeeze_thru`, `dog_invent`, `dog_goal` and
both choice loops. `js/fastforward.js` is gone.

**The bug that mattered: `distfleeck` is called TWICE per monster**, at
src/monmove.c:791 before the move and :915 after `m_move` returns unless the
monster died. We called it once, so every monster's turn cost half C's draws.
That single line is what made C look like it was moving twice as many monsters,
and it cost a long chain of eliminated hypotheses to find — all of them now
recorded above as verified rather than unexamined.

**`mfndpos` is CORRECT.** Instrumented on seed8000: it returns 8 on open floor,
5 when the bottom row is HWALL, 5 when the left column is VWALL, 6 next to a
door. Those are right for the terrain it is given.

So seed8000's remaining divergence at call 2999 — `rn2(32)` against our
`rn2(20)`, i.e. C's `cnt` 8 against our 5 — is **not an mfndpos bug**. It means
our monster is standing somewhere C's is not by that turn. Since every draw up
to 2998 matches, the position drift comes from a move APPLIED differently, not a
draw chosen differently. Look at:

1. Whether our chosen square (`chi` -> `poss[chi]`) is the one C picks when the
   tie-break draws agree — the scan order is x-outer/y-inner in both, so the
   candidate list should be index-for-index identical.
2. `m_move`'s branches we do not port — `m_balks_at_approaching` changes `appr`,
   and `appr` decides which square wins. A wrong `appr` moves the monster to a
   different legal square while drawing exactly the same numbers.

(2) is the stronger candidate and would explain a silent position drift with a
matching stream.

### The leaderboard, and what it says about our real problem

`node tools/leaderboard.mjs` reads `/leaderboard/data.json` directly — the page
itself renders from JS, so fetching its HTML only ever shows "Loading…".

**Scored 2026-07-25T03:07Z — the level-generation work generalises.**
Held-out RNG **8.9% -> 10.6%**, public RNG **12.2% -> 13.8%**. Those moved by
almost the same amount (+1.7 and +1.6), which is the signal worth watching: the
fixes are faithful rather than tuned to the sessions we can see. Held-out screens
are still 43, because a screen needs the whole frame right and RNG parity is only
the precondition.

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
