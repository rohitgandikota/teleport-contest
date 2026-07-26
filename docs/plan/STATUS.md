# STATUS

## START HERE

**492/11,405 screens (4.3%), 1/44 sessions, RNG 140,718/792,838 (17.7%).**
Tree clean and pushed. seed8000 matches C call for call (3130 calls) on ported
code; js/fastforward.js is not on its path.

Run this FIRST, before picking anything. It is the targeting instrument and
takes about three minutes:

    for f in sessions/*.session.json; do
        node tools/diverge.mjs "$f" 2>/dev/null | grep -m1 MISMATCH | sed 's/.*@ //'
    done | sort | uniq -c | sort -rn

Standing at last run:

       6  dog_move(dogmove.c:1255)      3  rnd_otyp_by_namedesc(objnam.c:3522)
       4  obj_resists(zap.c:1469)       3  next_ident(mkobj.c:521)
       4  getbones(bones.c:645)         3  distfleeck(monmove.c:538)
       4  do_attack(uhitm.c:474)

Read it as "which C function is running when we first disagree", NOT as "which
function is missing" -- our code is often correct there and the STATE reaching
it is wrong. Use it as the before/after for every change; when it and the
advisory RNG number disagree, TRUST IT. Removing a duplicate pet_ranged_attk
call moved a session later while the RNG proxy fell 78, and the aggregate was
right.

### Ranked next actions

1. **uhitm.c / do_attack** (4 sessions, and probably feeds the dog_move 6).
   The whole file is absent and domove has no m_at check, so the hero walks
   THROUGH monsters. Was attempted and reverted; the measurements localise the
   fault to domove_swap_with_pet, not to is_safemon or the rn2(7). Read that
   entry before rewriting it -- it lists what is already ruled out.
2. **tty menu subsystem** -- unblocks getbones (4 sessions) and level_tele's
   `?` arm.
3. **The -36 shop-stocking residual** -- narrowed to the makemon inside
   mkshobj_at. mkclass is RULED OUT, compared term for term. Small, and it is
   a known-wrong thing rather than a missing one.
4. **Per-spell dispatch (zap.c)** for seed0501.

### Two rules this session paid for the hard way

- **After landing a subsystem, PROVE it does its work.** RNG rose 3,961 on a
  mkshop that had never once made a shop; the gain was entirely the chain's
  condition draws. One stderr counter found it in a minute.
- **Never write a constant from memory.** ROOM is 25, not 20; 20 is LAVAPOOL.
  That bug was committed hours after the NOTES entry warning about it.

New this stretch, in the order it landed:

- create_object's buried-dealloc path (bury_an_obj's `dealloced` out-parameter,
  the container-slot clear, the NULL-container branch that destroys the
  content), spo_pop_container, MAX_CONTAINMENT
- add_to_container moved to js/mkobj.js, the OBJ_* where-enum and
  carried/mcarried to js/obj.js, DEADMONSTER to a new js/monst.js
- make_dig_engraving, lspo_engraving, selection_clear; make_engr_at gained C's
  six parameters and its rnd(N_ENGRAVE - 1) branch
- start_timer and the timer queue, in a new js/timeout.js
- m_in_air, is_clinger, has_ceiling, and the poolok/lavaok fix in mfndpos
- update_topl and xwaitforspace, in new js/tty/topl.js and js/tty/getline.js
- moveloop_preamble's moon-phase block, change_luck, You()/Your()
- cls() now flushes the message window the way C's display.c:2189 does, and
  both places that drop the topline text now clear the toplin flag with it

### The topline invariant, learned the hard way

`game._toplin` and `game._pending_message` are ONE piece of state. Whenever the
text is dropped the flag has to go to TOPLINE_EMPTY in the same breath, because
update_topl's joining branch keys off the flag alone: with the flag still at
TOPLINE_NEED_MORE and the text empty, the next message is glued onto "" and
comes out indented two columns. That cost seed8000 its pass until it was found.
C never has the problem because tty_clear_nhwindow(WIN_MESSAGE) does both.

## The next blocker, measured rather than guessed

Run this to rank what to port next. It tags each session's FIRST divergent
call with the C function containing that source line:

    for f in sessions/*.session.json; do
      node tools/diverge.mjs "$f" 2>/dev/null | grep "Next C function to port"
    done | sort | uniq -c | sort -rn

As of this writing:

    7  getbones (src/bones.c:645)
    6  obj_resists (src/zap.c:1469)
    6  dog_move (src/dogmove.c:1255)
    4  next_ident (src/mkobj.c:521)
    3  somex (src/mkroom.c:668)
    3  rnd_otyp_by_namedesc (src/objnam.c:3522)

**getbones is not the thing to port.** We already have it, rn2(3) and all. Its
appearance means the session is generating a SECOND LEVEL and we are not:
C spends getbones' rn2(3) and walks into makelevel, while we walk into
mcalcmove. seed5002 shows the trigger plainly, `\u0016` at step 2 is Ctrl-V,
the wizard level teleport. So the work is level CHANGE, not bones:
wiz_level_tele / level_tele, then goto_level driving mklev for the new level.
js/do.js already has dodown, next_level, goto_level and stairway_at.

Same caution applies to obj_resists at 6 sessions: js/zap.js has it. The tag
names the C function containing the divergent line, not a missing function.

### The highest-yield sweep right now: rank sessions by FIRST-mismatch size

    for f in sessions/*.session.json; do
      n=$(basename $f .session.json)
      d=$(node tools/screendiff.mjs "$f" 2>/dev/null \
          | grep -oE "^cells +[0-9]+ of" | grep -oE "[0-9]+")
      [ -n "$d" ] && echo "$d $n"
    done | sort -n | head

A session whose first bad frame differs by ONE cell is a single bug, and
several sessions usually share it. That sweep produced, in one pass:

  - nine sessions at one cell; five of them the SAME cell, r0 c56, the digit
    in "Welcome to experience level N." That was pluslvl() calling pline()
    without awaiting it. Worth +48 screens.
  - one at one cell: a '%' drawn brown that should take the monster's colour
    (obj_to_glyph makes a corpse a BODY glyph). Worth +6.

Re-run it after every landing; the cheap ones regenerate as deeper frames
become reachable.

### await pline(), always

pline() is async: it routes through update_topl(), which can reach more(),
which BLOCKS. Any caller that does not await it keeps running while the
message sits behind an unawaited promise. This does not throw and does not
change the RNG, it just freezes the top line. Five call sites had it.

When making a function async to fix this, the ripple has to go all the way to
the command dispatcher in js/cmd.js, or the same bug reappears one level up.

### seed0700 traced to the end: the pet is on the wrong square

The turn counter reading T:3 where C reads T:2 is a SYMPTOM, not the bug. The
chain, measured:

  moveamt at that turn is 12 for us, so umovement hits 0 after one move and
  the next (blocked) keypress triggers a new turn. C had 24, so its blocked
  keypresses cost nothing and the turn holds. Fast() and Very_fast() are
  correct (true/false for a Samurai) and the rn2(3) is drawn identically, so
  the moveamt difference is downstream of an earlier divergence, at call 2740:

    2739  rn2(4)  dog_goal(dogmove.c:575)   ours matches
    2740  rn2(1)  dog_move(dogmove.c:1255)  ours draws rn2(5) instead

  dogmove.c:1255 is `(j == 0 && !rn2(++chcnt))`, where
  j = (ndist - nidist) * appr. Instrumented, our pet is at 60,3 with appr 1,
  nidist 4, and its first candidate is at distance 2, so j is -2 and nothing
  is drawn. For C to draw exactly one rn2(1) there, C's pet must be on a
  square where exactly ONE candidate sits at the pet's own distance from the
  goal.

So our pet is on a different square, and it got there without any draw
disagreeing. That means a NON-DRAWING difference in the choice: mfndpos's
candidate list (content or order), GDIST, or which branch of dog_move's
selection wins. mfndpos is the prime suspect and is known incomplete -- it is
still missing C's onscary/ALLOW_SSM, ALLOW_SANCT, NOGARLIC, ALLOW_ROCK,
NOTONL/monlineu and trap arms, every one of which REJECTS a square C rejects
and we accept, which is exactly how a candidate list goes wrong without
changing a single draw.

Those arms are now ported: onscary/ALLOW_SSM, ALLOW_SANCT, NOGARLIC,
ALLOW_ROCK and NOTONL, plus online2, monlineu, OBJ_AT, in_rooms and
m_can_break_boulder. Two things learned doing it:

  - mux/muy were never assigned by anything (set_apparxy is not ported) and so
    read as undefined. monlineu feeds them to online2, where undefined makes
    every delta NaN and `!dy` answers TRUE for every square, marking NOTONL
    everywhere. They now start at 0, which is what C's zeroed struct holds.
  - the boulder arm costs seed0030 three screens and gains it 77 RNG
    positions, with the divergence point unchanged at call 6276. Both numbers
    are post-divergence coincidence. The arm is verbatim C and is KEPT;
    deleting faithful code to buy screens is the rule-1 failure mode.

mfndpos is now COMPLETE except for two arms with real subsystem dependencies:
the poison-gas region test (needs the NhRegion subsystem) and the worm_cross
diagonal (needs long worm segments). Everything else landed, including the
trap arm and the resistance chain under it: dmgtype, defended, Resists_Elem,
resists_magm and the eight resists_* wrappers in js/mondata.js, plus
floor_trigger, check_in_air and m_harmless_trap in js/trap.js and hastrack in
js/track.js.

dog_move also gained m_avoid_kicked_loc, m_avoid_soko_push_loc, and the
rn2(40) that lets a pet step onto a trap it has seen -- a DRAW that was
missing outright, not merely a decision.

### Four header macros were defined twice, with two of them DIFFERING

Consolidated into js/monst.js (include/monst.h): DEADMONSTER, MON_WEP,
is_vampshifter. Into js/const.js: Is_rogue_level, where js/mkobj.js had a copy
testing `game.level.flags.is_rogue_level`, a flag nothing sets, against the
real Lcheck. js/monmove.js also carried its own dist2 labelled "src/hack.c"
when dist2 is src/hacklib.c and already lived in js/hacklib.js.

Run this after touching anything shared -- a duplicate with a DIFFERENT body
is the dangerous kind, and it does not show up in any score:

    grep -rhoE "^(export )?(function|const) [a-z_A-Z0-9]+" js/*.js js/tty/*.js \
      | awk '{print $NF}' | sort | uniq -d

### Previously open on seed0700: the turn counter is one ahead

C shows T:2 where we show T:3 at step 5, so our new-turn block in
moveloop_core runs one extra time. RNG matches through that point, so
u_calc_moveamt's rn2(3) is being drawn identically and Fast() agrees; the
difference is in how much umovement a command consumes, i.e. which commands
set context.move. moves itself starts at 1 and increments plainly, already
verified against src/u_init.c:645 and src/allmain.c:244.

### seed0101's SCREENS break much earlier, at step 2, on ONE cell

RNG and screens diverge in different places and both are worth chasing. The
screen break is step 2, the tutorial-prompt menu, at r6 c20:

    C     "                   m (end)"
    ours  "                   m\u2500(end)"   (a horizontal line at c20)

MEASURED, cols 17-29 of rows 2-6, before and after the menu appears:

    step 1 (map only)   r6: "  mqqqqqaq~qj"
    step 2 (menu up)    r6: "  m (end)    "

So the 'm' at col 19 is the MAP's lower-left corner showing through beside the
menu -- C does NOT clear it. C overwrites from col 20 with " (end)" and then
spaces. We leave the map's 'q' (the DECgraphics horizontal) at col 20, i.e. we
start the footer one column too far right, or we do not blank col 20 at all.

FOUND THE MECHANISM. process_menu_window (win/tty/wintty.c:1329) emits every
menu line like this:

    tty_curs(window, 1, page_lines);   /* window-relative column 1 */
    if (cw->offx)
        cl_end();
    (void) putchar(' ');               /* <- AN EXPLICIT LEADING SPACE */
    ++ttyDisplay->curx;
    ... then the selector, the space, and the text

tty_curs(window, 1, y) is window-relative column 1, i.e. 0-based cw->offx. So
the space lands AT offx and the content starts at offx + 1. That is where
C's " (end)" comes from: the space is not part of morestr, it is emitted
ahead of every menu line.

Which means cw.offx here is 20, not 19 -- the 'm' at column 19 is the map
outside the menu, which C never touches.

maxcol IS NOT THE CAUSE -- I inferred that from arithmetic and then MEASURED
it, and the inference was wrong. Instrumenting the entry loop gives, for this
window:

    ENTRY len=59 "Put \"OPTIONS=!tutorial\" in .nethackrc to skip this query."

57 characters + 2 = 59, which is exactly C's value, so cw.cols is 59 and
offx = min(min(82, 40), 80 - 59 - 1) = 20. Our offset is RIGHT.

MEASURED AT THE FOOTER PAINT, which settles it:

    FOOT type=4 offx=22 cols=0 maxcol=57 morestr=""

Three things wrong at once, and they are one cause:

  - cw.cols is ZERO. tty_end_menu never ran for this window. maxcol 57 came
    from tty_putstr's `+1` path (js/tty/wintty.js:283), not from the menu's
    `+2` path (js/tty/wintty.js:239).
  - therefore offx is 22, where C's is 20 (C's maxcol is 59).
  - therefore morestr is "" and the footer falls back to defmorestr
    "--More--", not "(end) ".

FIXED. The menu footer row never blanked column cw.offx, where the content
rows already did. C emits `tty_curs(window, 1, y); if (offx) cl_end();
putchar(' ')` for every menu line, so a space lands ON offx and the text
starts at offx + 1. seed0101's screens move step 2 -> 4.

What found it, after four wrong inferences, was a NEGATIVE result:
instrumenting the footer path at js/tty/wintty.js:367 produced no output at
all for this window. That meant a different function drew it -- the menu
display path at :429 -- and that one was missing the clear loop. The lesson is
that "my instrumentation printed nothing" is itself data, not a failed run.

The four wrong readings are kept below because each one looked right:

WRONG (1 of 4): that FOOT line is NOT the tutorial menu.
ask_do_tutorial (js/options.js:185) does use tty_add_menu and does call
tty_end_menu, so its cols is set properly. The window measured above -- an
NHW_MENU with cols 0, built by putstr -- is the LEGACY window, which
js/tty/wintty.js:280 already documents as exactly that case.

So the trace captured the wrong window and proves nothing about the tutorial
menu. The instrumentation has to filter on the window whose footer lands on
row 6, or key off morestr === "(end) ".

FOUR readings of this one cell have now been wrong: missing leading space,
maxcol 60 vs 59, offset formula, and putstr-vs-add_menu. Every one was an
inference from partial data. Do not add a fifth from reasoning. Instrument
the specific window -- match on footerRow === 6 or on cw.morestr -- print
offx, cols, maxcol and the entry strings, and only then decide.

This supersedes TWO earlier readings in this file, both wrong: that the cause
was a missing leading space, and that maxcol was 60 against C's 59. Both were
inferences; only the instrumented run gave the actual numbers.

The superseded arithmetic argument follows; it is kept only to show the
inference and why measuring beat it.

SUPERSEDED -- WRONG:  Both of C's branches agree
on this window:

    H2344_BROKEN (the one we use):
        min(min(82, cols/2), cols - maxcol - 1) = min(40, 80 - 59 - 1) = 20
    default:
        max(10, cols - maxcol - 1)              = max(10, 20)          = 20

Both need maxcol == 59 to produce 20. Ours produces 19, so our maxcol is 60 --
one too large. The menu is therefore one column left of C's for its whole
width, and the missing leading space at the footer is a symptom, not the bug.

NARROWED FURTHER. C's tty_end_menu does:

    for each menu entry:
        len = strlen(curr->str) + 2;   /* extra space at beg & end */
        if (len > cw->cols) cw->cols = len;
    ... then morestr ("(end) ", 6 chars) is measured the same way ...
    cw->maxcol = cw->cols;

js/tty/wintty.js:259 already has `cw.maxcol = cw.cols`, so the discrepancy is
in cw.cols: ours reaches 60 where C reaches 59. Note the +2 here versus the +1
in tty_putstr (js/tty/wintty.js:283) -- a menu built with add_menu and one
built with putstr measure DIFFERENTLY, and the legacy window is the case that
tells them apart.

The measurement to make next: log every entry string and its computed length
for this window, and compare against the recorded screen's longest line. One
entry is a character longer than C thinks it is, or we are applying +2 where C
applies +1 (or the reverse) for one of them.

Do NOT widen the clear in js/tty/wintty.js:374 and do NOT switch the offx
branch -- the comment at js/tty/wintty.js:291 records that the H2344_BROKEN
branch was chosen deliberately because it matches the chargen recordings, and
both branches agree here anyway.

One cell, and it gates all 26 screens in the session.

### RESOLVED: seed2200's cell was a STATUE, not a monster

statue_to_glyph (include/display.h:950) makes a STATUE into
corpsenm + GLYPH_STATUE_*_OFF, and src/display.c:2829 resolves it as

    gmap->sym.symidx = mons[offset].mlet + SYM_OFF_M;   /* MONSTER's symbol */
    obj_color(STATUE);                                  /* STATUE's colour  */

so a grid bug statue is an 'x' in stone grey. We drew '`' in the object's
colour. Fixed; 473 -> 482 screens, seed2200 step 0 -> 4.

Note the asymmetry with the corpse case: a corpse changes only COLOUR, because
a body glyph and a food object are both '%'. A statue changes SYMBOL TOO.

### The same glyph family explains seed0030, but the cause is different

seed0030's first diff is r5 c55: C 'f' color 15, ours '$' color 11.
objects[STATUE].oc_color is 15, and 'f' is a kitten's letter -- so C is
drawing a STATUE OF A KITTEN there, and we are drawing GOLD.

NOT pile order -- I guessed that and then measured it. Dumping our objects at
map (56,4) at step 0 gives:

    PILE otyp=438 cls=12 n=1        (one GOLD_PIECE, nothing else)

There is no statue there at all. It is MISSING, not underneath.

seed0030's RNG matches through level generation (it diverges at 6276), so if C
created the statue with any draw we would have made that draw too. Candidates,
in order of likelihood:

  a. a themeroom fill that we spend the draws for and do not create the object
     from -- js/themerms.js fill_statuary is the obvious one to read first,
     and that exact shape (draws spent, object not made) was already found and
     fixed once this session in fill_buried_zombies.
  b. mkcorpstat(STATUE, ...) reached from a path we skip.

Check fill_statuary against dat/themerms.lua before anything else.

CHECKED, and (a) is NOT it: js/themerms.js fill_statuary really does call
lspo_object('statue') d(5,5) times and lspo_trap for the statue traps. So the
objects are being created.

Which means the statues exist somewhere and just are not at map (56,4). Two
things could do that with the RNG still matching:

  - create_object places them at different coordinates (the position comes
    from somexyspace inside the room, so a room-geometry difference moves them
    without changing a draw), or
  - they are created and then lost, the "computed and discarded" shape.

MEASURED: our whole level holds exactly ONE statue.

    STATUES n=1  at 15,10  corpsenm=158

Two facts from that, and no inference beyond them:

  - corpsenm IS being set (158), so lspo_object('statue') does reach
    set_corpsenm. The statue glyph fix will render it correctly.
  - n=1 is far short of fill_statuary's d(5,5), which is 5..25. Either
    fill_statuary never ran this game (the "Statuary" themeroom simply was not
    picked, in which case that lone statue came from somewhere else and C's at
    56,4 needs a different explanation), or it ran and only one object
    survived.

SETTLED BY MEASUREMENT: fill_statuary is entered ZERO times for seed0030. The
"Statuary" themeroom is not picked this game.

So fill_statuary is NOT the lead. The one statue we do have (15,10) and the
one C shows (56,4) both come from somewhere else. Statues are also created by

  - mkcorpstat(STATUE, ...) -- e.g. makeniche's dead adventurer behind iron
    bars, which js/mklev.js already calls
  - STATUE_TRAP, whose trap carries a statue object

FOUND IT, and it is in our own source rather than the C: js/mklev.js:335 is

    case STATUE_TRAP:
        note_unported_lev('mk_trap_statue');
        break;

mk_trap_statue (src/trap.c:508) is what puts a statue on a STATUE_TRAP square,
and it is not ported. That is a statue source we skip entirely.

It DRAWS, and the draws are not trivial:

    do { mptr = &mons[rndmonnum_adj(3, 6)]; }
    while (--trycount > 0 && is_unicorn(mptr)
           && sgn(u.ualign.type) == sgn(mptr->maligntyp));
    statue = mkcorpstat(STATUE, NULL, mptr, x, y, CORPSTAT_NONE);
    mtmp = makemon(&mons[statue->corpsenm], 0, 0, MM_NOCOUNTBIRTH|MM_NOMSG);
    ... move mtmp's whole inventory INTO the statue ...
    statue->owt = weight(statue);
    mongone(mtmp);

i.e. a retry loop that rejects a co-aligned unicorn, then mkcorpstat, then a
full makemon whose inventory is transferred into the statue. Port it as a
unit; the makemon and the inventory transfer are not optional decoration, the
statue is meant to contain that monster's gear.

RETRACTED, and the retraction is the useful part. mk_trap_statue is now
ported (commit "Port mk_trap_statue, mongone and m_detach") and it changed
NOTHING: 482 screens and 135915 RNG before and after. Instrumenting the
function shows it is entered ZERO times for seed0030, exactly as
fill_statuary was. Neither statue source fires. There is no missing statue.

The 'f' was never a statue. Dumping C's own first screen:

    @ row 5 col 19
    f row 5 col 20

The 'f' is DIRECTLY ADJACENT to the hero. It is the starting pet. The whole
statue thread came from matching objects[STATUE].oc_color == 15 against a
white 'f' and never checking the far cheaper thing, which was where the
glyph sits relative to '@'. Colour equality is not identification. Two
sessions of work hung off that one unchecked inference.

The port is kept anyway: mk_trap_statue is a real C function that was a
note_unported_lev stub, so a statue trap generated a trap with no statue.
It will fire on a held-out session that rolls one. But it was not this bug,
and it was not found by the reasoning that led to it.

WHERE seed0030 ACTUALLY DIVERGES (measured, tools/diverge.mjs):

    6275  C rn2(5)=1     ours rn2(5)=1     ok        @ distfleeck(monmove.c:538)
    6276  C rn2(100)=92  ours rn2(4)=0     MISMATCH  @ obj_resists(zap.c:1469)
    6277  C rn2(8)=7     ours rn2(100)=67  differs   @ dog_goal(dogmove.c:554)
    6278  C rn2(100)=1   ours rn2(8)=1     differs   @ obj_resists(zap.c:1469)
    6280  C rn2(4)=1     ours rn2(100)=85  differs   @ dog_goal(dogmove.c:575)

    C:    100, 8, 100, 100, 4
    ours:   4, 100, 8, 100, 100

We emit one EXTRA rn2(4) and then C's next four draws in order. Stack trace
at that call (the RNG-log index is off by one from diverge's numbering, so
trace a window, not a point):

    at rn2 (js/rng.js)
    at dochug (js/monmove.js:686)

Line 686 is `|| (is_wanderer(mdat) && !rn2(4))`. The monster there is
mnum=32 tame=10 peac=1 nearby=true scared=false cansee=true wander=true,
i.e. the pet kitten. Our dochug condition matches C's (monmove.c:881) term
for term and in order, and include/monsters.h:386 confirms the kitten really
does carry M2_WANDER, so is_wanderer is right in both. C therefore has to be
short-circuiting on an EARLIER disjunct and never reaching the rn2(4).

The disjuncts before it are !nearby, mflee, scared, mconf, mstun,
(minvis && !rn2(3)), and the leprechaun clause. C drew no rn2(3), so minvis
is false there. The candidate that fits without contradicting anything
measured is `!nearby` being TRUE in C, which would mean C's pet is NOT
adjacent at seg 1 step 4 while ours is. That is a POSITION divergence with
no RNG divergence in front of it, which is possible whenever a movement
decision picks between equally-rated squares without drawing.

CONFIRMED, and it is NOT a bug at monmove.js:686. C's recorded screen for
seg 1 step 4:

    @ row 16 col 19
    f row 17 col 31

C's pet is TWELVE columns from the hero. Our trace at the same call reports
nearby=true. So `!nearby` is TRUE in C, short-circuits the disjunction on its
very first term, and C never evaluates is_wanderer at all. Our condition is
correct as written; do not touch it. The rn2(4) is a SYMPTOM.

The bug is that our pet is glued to the hero while C's has wandered twelve
squares off. dochug is reading a position that our dog_move put in the wrong
place, so the fix is upstream in the goal choice, not in the draw.

That points at dog_goal's object search rather than its follow-player block.
A pet twelve squares away has almost certainly picked an OBJECT goal
(gtyp != UNDEF), which is what makes it ignore the hero; ours picks no goal
and falls through to "follow player" every turn. The obj_resists draws
bracketing the divergence are dogfood() evaluating floor objects, which is
the same search. Note the direction of the error: ours approaches MORE than
C's, so the missing `dog_has_minvent` term at js/dog.js:567 is NOT the cause,
since that term can only make a dog approach more often.

MEASURED (instrumentation since reverted, js/dog.js is untouched). Over a
full seed0030 run, ~19 objects on the level, dog_goal's outcomes:

    gtyp chosen   APPORT 68    UNDEF 732        (9% of turns get a goal)
    dogfood says  ACCFOOD 4  MANFOOD 24  APPORT 1220  POISON 48  UNDEF 43

So the object search is NOT dead: dogfood returns real verdicts and the
APPORT arm fires 68 times. Two things follow, and both cut off a guess that
looked obvious a moment earlier.

MANFOOD never becoming a goal is CORRECT, not a bug. The C is
`if (otyp < MANFOOD)`, and MANFOOD is not less than MANFOOD, so those 24 fall
through to the APPORT arm exactly as C intends. Do not "fix" this.

ACCFOOD (4 occurrences) never became a goal either, which is the one gap
worth a look: an ACCFOOD verdict SHOULD set gtyp=2 unless could_reach_item()
or can_reach_location() rejected it. Four samples is too few to conclude
anything, and those two reachability calls are the untested part of the loop.

NEXT ACTION: this is where the seed0030 thread stands. The remaining question
is narrow and stated so it can be answered without re-deriving the above:
for each of the 4 ACCFOOD objects, did could_reach_item or can_reach_location
reject it, and does C reject it too? Instrument those two predicates rather
than dogfood, which is already cleared.

Keep the standing caution: the pet-position gap is the thing being explained,
and a 9%-goal-rate pet that follows the hero every other turn is consistent
with what we see on screen. Do not change monmove.js:686, and do not change
the MANFOOD comparison.

One real gap found in passing, not the cause: js/dog.js:567 omits C's
`|| (dog_has_minvent && rn2(edog->apport))` from the follow-player test
(dogmove.c:575). It is RNG-neutral while dog_has_minvent is hardcoded false
at js/dog.js:504, and unhardcoding it needs droppables() ported.

### Three cheap one-cell diffs: seed2200 is a MISPLACED MONSTER

Ranked by first-mismatch size, the cheapest remaining screen diffs are:

    1 cell  seed0012-monk-vault-escort     step 16  r6 c3   C 'r'  ours '`'
    1 cell  seed2200-wizard-quaff-zap-read step 0   r11 c16 C 'x'  ours '`'
    1 cell  seed0700-samurai-explore-descend

IT IS A MONSTER AFTER ALL. Settled by dumping the row verbatim, which is the
only screen evidence worth trusting here. seed2200 step 0, columns 8-25:

    r9  " lqqqqqqqqqqqq You"
    r10 " x~~~~~~~~~~~@ to "
    r11 " x~~~~~~x(~~~~    "
    r12 " x~~~~~~~~~~~~ You"

The 'x' at column 9 IS the window border. The 'x' at column 16 sits in the
middle of the floor ('~' on both sides) with an object '(' beside it, so it is
a grid bug. C has a monster at map (17,10).

MEASURED FACTS ONLY, because three successive readings of this cell were
wrong. Instrumenting makemon at seed2200 step 0 gives all three of our
monsters and where each came from:

    mndx=158  at 42,4   <- fill_ordinary_room
    mndx=158  at 75,6   <- fill_ordinary_room
    mndx=32   at 23,10  <- makedog          (this is the PET)

So the monster on row 10 is the starting pet, and the "same row, six columns
off" reading was coincidence. C's grid bug at map (17,10) has no counterpart
in our level at all -- we create two fill_ordinary_room monsters and a pet,
and C evidently creates at least one more.

AND A CONSTRAINT THAT NARROWS IT SHARPLY: seed2200's RNG matches C call for
call all the way through level generation. It diverges at 2724, in
exercise(attrib.c:509), which is AFTER moveloop_preamble -- so every draw that
creates or places a monster already agrees.

That rules out "C makes an extra makemon we skip", because an extra makemon
would draw. What is left:

  a. our port DOES have that monster and does not DISPLAY it. js/display.js
     checks m_at(), which filters on `m.mhp > 0` -- a monster whose mhp was
     never set would vanish from the screen while still existing, and the
     object underneath ('`') would show instead. CHECK THIS FIRST, it fits
     the symptom exactly.
  b. C creates it through a path that spends no draws.
  c. the glyph is still not what I think it is.

Probe for (a): dump game.level.monsters WITH mhp for seed2200 step 0. Three
monsters were logged (two fill_ordinary_room, one makedog pet); if any has
mhp undefined or <= 0, that is the answer.

I retracted this reading once on the grounds that 'x' is a border glyph. That
retraction was WRONG -- the glyph is ambiguous and only its neighbours settle
it. Both the original mis-read (scanning glyph classes on a blurb screen) and
the bad retraction came from not dumping the row.

The superseded caution follows:

  - 'x' is the DECgraphics VERTICAL LINE, not a grid bug. In the tty symset a
    window border is lqqqk / x / mqqqj, so an 'x' at a window's edge column is
    a border segment.
  - seed2200's step 0 is the LEGACY BLURB screen, not the map. Scanning it for
    "monster glyphs" returns the blurb's own prose, which is how I first
    mis-read it (the same trap as the object-glyph scan recorded further down,
    which read "Go bravely with Kos!" as a potion).

What IS known: at seed2200 step 0, r11 c16, C draws 'x' and we draw '`'. Our
level at that moment holds three monsters, at 23,10 / 75,6 / 42,4 -- none of
them near column 16 -- so the cell is almost certainly window border versus
map bleed-through, i.e. the same FAMILY as the menu-footer cell that was fixed
by blanking column offx, not a monster problem at all.

NEXT: decode seed2200 step 0 and print rows 9-13 columns 8-24 verbatim, both
sides, the way the menu cell was finally settled. Do not scan for glyph
classes on a screen that may not be showing the map.

### seed0101 is now at step 9; the prompt chain is DONE

Ported this stretch, in the order the session exercises them:

    getobj's prompt + letter list (src/invent.c:1830, :1919)
    yn_function's resp arm, i.e. "[ynq] (q)"   (win/tty/topl.c:365)
    getdir's prompt                            (src/cmd.c)
    ready_ok, doquiver_core, dowieldquiver, 'Q'  (src/wield.c)
    throw_ok                                   (src/dothrow.c)
    setuqwep, xprname, prinv                   (src/invent.c, src/wield.c)
    u_init's alternate-weapon slot             (src/u_init.c:1291)

seed0101 went from breaking at step 2 to step 9, and the corpus from 429 to
473 screens.

WHAT IS LEFT for it is throwit()'s trajectory (src/dothrow.c:1600 onward).
Step 9's message

    "You aren't wielding a bow, so you throw your arrow by hand."

comes from src/dothrow.c:1643, inside the range calculation: is_ammo without a
matching launcher HALVES the range and prints that line. It needs skill_name,
weapon_descr, body_part and an(), plus the range arithmetic around it. That is
the throw subsystem proper, not a stray message -- do not port the pline
alone, it is meaningless without the range halving it accompanies.

### SUPERSEDED: seed0101's screens break at step 4: 'Q' is not bound

Measured, not inferred:

    step 4, key "Q"
    C     "What do you want to ready? [- cd or ?*]"
    ours  "Unknown command 'Q'."   (33 cells differ, all on row 0)

dowieldquiver (src/wield.c:505) is not ported and 'Q' has no arm in rhack.
It needs getobj with a quiver-specific prompt and the "That is your alternate
weapon. Ready it instead? [ynq]" confirmation that step 5 shows, so it pulls
in getobj's object-letter prompt as well.

This is the same subsystem seed0101's RNG divergence needs: 'Q' at step 4,
't' at step 7 and the throw at step 9 are one chain.

TWO pieces, and binding 'Q' alone is NOT enough:

  1. dowieldquiver (src/wield.c:505) is a one-liner onto doquiver_core, which
     is substantial: getobj with a ready_ok filter, setuqwep, the
     already-quivered and coin-split arms, unsplitobj.
  2. js/invent.js getobj() NEVER PRINTS ITS PROMPT. It goes straight to
     nhgetch at :110. C builds "What do you want to ready? [- cd or ?*]" by
     scanning inventory with the filter and listing the letters that pass.
     Every getobj-driven command in the corpus shows that string, so this is
     worth more than the one session -- 't' at step 7 shows
     "What do you want to throw? [bcd or ?*]" from the same code.

Do getobj's prompt FIRST. It is the shared piece, and it is measurable on its
own: any session that reaches a getobj prompt will show the difference.

The assembly is src/invent.c:1919 and is short:

    Sprintf(qbuf, "What do you want to %s?", word);
    if (!buf[0])
        Strcat(qbuf, " [*]");
    else
        Sprintf(eos(qbuf), " [%s or ?*]", buf);
    ilet = yn_function(qbuf, (char *) 0, '\0', FALSE);

tty_yn_function is ALREADY ported (js/tty/topl.js) for the resp == NULL arm,
which is exactly this call, and our getobj already reads a key with nhgetch at
js/invent.js:110 -- so swapping that read for tty_yn_function(qbuf, null, 0)
adds the paint without changing which keys are consumed.

The work is `buf`, the letter list. Read in full, the core is SMALLER than the
line span suggests -- most of src/invent.c:1765-1915 is the command-queue and
force_invmenu paths that no recorded session takes. The part that matters:

  1. The '-' block (src/invent.c:1830-1850). obj_ok(NULL) is called for the
     "your hands / nothing" choice. On GETOBJ_SUGGEST it appends HANDS_SYM
     and then A SPACE -- `*bp++ = ' '` with the comment "put a space after the
     '-' in the prompt". That space is why C reads "[- cd" and not "[-cd".
  2. sortloot(&invent, SORTLOOT_INVLET, FALSE, 0) -- inventory MUST be walked
     in invlet order before letters are collected, not in list order.
  3. The accumulation loop (src/invent.c:1864):
         bp[suggested++] = otmp->invlet;
         switch ((*obj_ok)(otmp)) {
         case GETOBJ_EXCLUDE_INACCESS: suggested--; inaccess++; break;
         case GETOBJ_EXCLUDE: case GETOBJ_EXCLUDE_SELECTABLE: ...
         }
     i.e. append first, then un-append when the filter rejects.

So the pieces are: the GETOBJ_* return enum, sortloot's INVLET ordering, this
loop, the assembly at :1919, and one filter per command (ready_ok for 'Q',
and whatever 't' uses). Land them together, per the note above.

Land the assembly and the letter list TOGETHER. A prompt reading "[*]" where
C reads "[- cd or ?*]" is still a screen mismatch, just a different one, and
it would look like the port regressed rather than advanced.

### seed0101 at 2293 is the THROW subsystem, at step 9

    2291  rnd(9000)  moveloop_preamble(allmain.c:72)   ours matches
    2292  rnd(30)    moveloop_preamble(allmain.c:79)   ours matches
    2293  rnd(2)     next_ident(mkobj.c:521)           ours draws rn2(12)
    2294  rn2(100)   obj_resists(zap.c:1469)

next_ident is called by mksobj (o_id) and by makemon (m_id), so C is CREATING
something between seer_turn and the first move, and we go straight to
mcalcmove. The session's first key is 'Q' at step 4, well after this, so it is
not the command.

IT IS NOT moveloop_preamble. Those two tags are simply the last calls that
still matched; the divergence itself is at SEG 1, STEP 9. Always read the
"divergent call occurs at" line before inferring from the adjacent tags -- I
got this wrong once already.

Step 9 is the THROW:

    4  "Q"  What do you want to ready? [- cd or ?*]
    5  "b"  That is your alternate weapon.  Ready it instead? [ynq] (q)
    6  "y"  b - a +1 bow (at the ready).
    7  "t"  What do you want to throw? [bcd or ?*]
    8  "d"  In what direction?
    9  "l"  You aren't wielding a bow, so you throw your arrow by hand.

So the next_ident + obj_resists at 2293-2294 are throwit() splitting the arrow
stack: splitobj() makes a new object, which calls next_ident for its o_id and
then gets checked. The whole Q/t/direction sequence ahead of it also has to
work -- dowieldquiver's prompt, the "alternate weapon" ynq, and getobj for the
throw -- so this is the throw subsystem (src/dothrow.c), not a stray draw.

### seed0501 at 2205 is the spell-casting subsystem

    2203  rnd(9000)  moveloop_preamble   ours matches
    2204  rnd(30)    moveloop_preamble   ours matches
    2205  rnd(100)   spelleffects_check(spell.c:1372)   ours draws rn2(12)

The session's first command casts a spell, and we walk straight into
mcalcmove instead. The entry point is docast -> spelleffects ->
spelleffects_check (src/spell.c, the check returns TRUE on failure). Its one
visible draw is `rnd(100) > percent_success(spell)`, and the exercise(A_WIS)
at attrib.c:509 that follows spends rn2(19).

percent_success() (src/spell.c:2173) is the real work. It has been read in
full; it draws NOTHING, and here is exactly what it needs:

  from js/role_data.js, already present:
      spelbase, spelheal, spelstat, spelarmr, spelshld, spelspec, spelsbon
  from js/spell.js:
      spellid (present), spellev (ABSENT), spell_skilltype (ABSENT, it is just
      objects[booktype].oc_skill)
  from src/spell.c:106, three literal defines:
      uarmhbon 4, uarmgbon 6, uarmfbon 2
  from js/hacklib.js:
      isqrt (ABSENT; src/hacklib.c:682, the odd-number subtraction loop)
  from js/attrib.js:
      ACURR (present, and correct since it now delegates to acurr)
  worn items: uarm, uarmc, uarms, uarmh, uarmg, uarmf, uwep
      js/do_wear.js reads game.invent by owornmask, so these are reachable
  weight(uarms) vs objects[SMALL_SHIELD].oc_weight — both present

THE BLOCKER WAS P_SKILL(skilltype), i.e. u.weapon_skills[], which did not
exist. That is now DONE: js/weapon.js carries skill_init and weapon_type, and
u_init_skills_discoveries calls skill_init(skills_for_role()) at C's position
(src/u_init.c:1404). It draws nothing, so the corpus is unchanged by it.

DONE since: skill_init + u.weapon_skills (js/weapon.js), isqrt
(js/hacklib.js), spellev and spell_skilltype (js/spell.js, the latter MOVED
from js/u_init.js), percent_success, spelleffects_check, and morehungry
(js/eat.js). None of it moved the corpus, and that is expected: nothing calls
spelleffects_check yet.

WHAT IS LEFT is the entry path, and it is a menu problem, not a spell problem:

    docast() -> getspell(&spell_no) -> spelleffects(sp_id, FALSE, FALSE)

getspell (src/spell.c:715) either pops a queued key, or with
flags.menu_style == MENU_TRADITIONAL builds a "Cast which spell? [a-c *?]"
prompt and reads a letter, or otherwise opens the spell MENU.

THE CHAIN NOW FIRES. seed0501: 2205 -> 2208.

The last blocker was a constant I got wrong: UNKNOWN_SPELL is -1
(include/spell.h:9) and I had written 0. spelleffects_check takes the spell
INDEX, so index 0 -- the first known spell -- looked unknown and every cast was
rejected on the function's opening line. What found it: getspell was returning
ilet 'a' and idx 0 correctly while spelleffects_check was never reached, so the
failure had to be between them.

WHAT IS LEFT for seed0501 is the per-spell dispatch itself: at call 2208 C is
in zapyourself(zap.c:2911) drawing d(6,4). That switch has an arm per spell and
every arm draws; it needs zap.c's effect code. A genuine subsystem.

SUPERSEDED (the chain was incomplete when this was written): Ported and committed:
getspell (traditional arm), docast, spelleffects, spelleffects_check,
percent_success, initialspell, skill_init, tty_yn_function, and u_init's
"force starting Pw" block (src/u_init.c:1408, without which a Priest's uen is
below SPELL_LEV_PW(1) and the cast is rejected on energy).

Instrumented, at seed0501's 'Z':
    docast IS reached
    getspell sees num_spells() == 2, spl_book populated with sp_know 20000,
        rejectcasting() false
    spelleffects_check is NEVER reached

So getspell's prompt loop is not returning. It reads with tty_yn_function ->
nhgetch(); the session's next key is 'a', which spell_let_to_idx maps to 0. If
nhgetch is handing back something else the loop retries ten times and gives
up with "That's enough tries."

NEXT: instrument the ilet that tty_yn_function returns inside getspell. The
likely cause is input-queue position -- our 'Z' handler may be consuming the
key differently from C's, or the three leading keys (" ", " ", "n") are not
being absorbed by the same prompts. Compare against the recorded screens at
those steps before changing anything.

CHECKED: seed0501's keys are  " " " " "n" "Z" "a" "." "r" "g" "y"  -- 'Z' is
docast and 'a' picks the first spell, so it takes the TRADITIONAL LETTER path.
No menu subsystem is needed for it. That path is num_spells(), the
"Cast which spell? [%s *?]" prompt with its retry_limit of 10, yn_function to
read the letter, and spell_let_to_idx. Do that, not the menu.

The menu subsystem is still wanted by getbones' '?' arm and level_tele's '?'
arm (4 + 4 sessions), so it remains a real piece of work -- just not this
session's blocker.

SUPERSEDED, kept for the dependency list:

Remaining for percent_success, in order:

  1. spellev(spell) and spell_skilltype() -- spell_skilltype already exists in
     js/u_init.js as objects[booktype].oc_subtyp; move it to js/spell.js, its
     C home, rather than adding a second copy
  2. isqrt (src/hacklib.c:682) into js/hacklib.js -- the odd-number
     subtraction loop, six lines
  3. percent_success itself into js/spell.js
  4. spelleffects_check, then docast/spelleffects around it

The worn-item reads (uarm, uarmc, uarms, uarmh, uarmg, uarmf, uwep) go through
js/do_wear.js's owornmask lookup, which is already there. The three armour
bonuses are literals in src/spell.c:106 -- uarmhbon 4, uarmgbon 6, uarmfbon 2.

### Every sub-1000 divergence is now cleared; the earliest is 1956

    1956  seed0367-priest-quest-tour
    2205  seed0501-priest-cast-read-turn
    2293  seed0101-ranger-quiver-throw-travel-engrave
    2300  seed1500-rogue-explore-move

seed0367 at 1956 is in the pet's ranged-attack targeting. C spends ONE
rnd(5) at score_targ(dogmove.c:830) and moves on to distfleeck; we spend a
second one, so best_target() (src/dogmove.c:838) found a target in a direction
where C found none.

best_target scans all eight directions with find_targ(mtmp, dx, dy, 7), which
walks up to seven squares and SKIPS invisible monsters unless the pet has see
invisible. score_targ is called once per direction that yields a target, and
its rnd(5) fuzz factor is the visible draw.

All three have now been compared against the C line by line and all three
MATCH, including the early returns: score_targ returns before the rnd(5) for
quest friendlies (MS_LEADER/MS_GUARDIAN), for an adjacent target, for a tame
one, and when find_friends sees a friendly behind the target. So the extra
rnd(5) is not a logic difference in the targeting itself.

m_cansee and clear_path have now been checked too and BOTH match. m_cansee is
clear_path(mx, my, x2, y2) in both (include/vision.h:42), and our clear_path's
generic Bresenham walk is line-for-line the same as C's four quadrant macros
(src/vision.c:1212 q1_path and its siblings) including the error-term setup,
the tie-break order, and the blocked-by-default result.

So five functions in the chain -- find_targ, best_target, score_targ, m_cansee,
clear_path -- are all verbatim. The extra target therefore comes from a MONSTER
STANDING SOMEWHERE ELSE, which is the same non-drawing-difference class as the
pet-position divergence recorded further down: something moves a monster
without any call disagreeing.

Do NOT keep re-reading the targeting code; it is correct. The productive thing
is to dump the monster list and positions at that turn for both sides -- ours
from an instrumented run, C's from the recorded SCREEN, which shows every
monster the hero can see -- and find which monster is in the wrong place. That
is a different and slower measurement than the RNG trace, and it is the one
this divergence needs.

### Rank sessions by DIVERGENCE POINT, not by screens

    for f in sessions/*.session.json; do
      n=$(basename $f .session.json)
      d=$(node tools/diverge.mjs "$f" 2>/dev/null \
          | grep -oE "diverges at call [0-9]+" | grep -oE "[0-9]+")
      [ -n "$d" ] && echo "$d $n"
    done | sort -n | head

An early divergence is a cheap bug: everything after it is noise. Six sessions
sat at calls 302-528, all inside character creation, and two of them came from
ONE cause -- optfn_playmode was never ported, so game.wizard and game.discover
were read in five places and assigned in none. getbones() returns before its
rn2(3) when discover is set, so every explore-mode session drew a call C does
not. seed0900 went 302 -> 2431 and seed1150 302 -> 2357, +4,315 corpus RNG.

seed0015 was then chased from 358 to 2513 in three steps, each found by
stack-tracing RND() at the divergent call and READING THE CALLER CHAIN rather
than guessing from the C tag:

  1. the trace showed makemon <- rndmonst, i.e. a RANDOM monster where C made
     a named one. name_to_mon read a scalar `pmname`; a permonst carries
     pmnames[] INDEXED BY GENDER and a ghost is [null, null, "ghost"], so it
     matched nothing and every des.monster("ghost") fell through to rndmonst.
  2. create_monster never called induced_align(80), which C uses for any spec
     that named no alignment -- most of them.
  3. makemon never named the ghost, and rndghostname() draws twice.

seed2600 at 395 IS explained, and it is structural rather than a missing
function. C's tags at 389-394 read `parent=room([C]:-1)` and then
`somex(mkroom.c:668)`: C is inside a des.room{} contents callback, so
gc.coder->croom is set, and create_altar takes its `if (croom)` branch into
get_free_room_loc -> somexy -> somex/somey, i.e. a coordinate INSIDE the room.

Our stack at the same call is

    get_location <- get_location_coord <- create_altar <- lspo_altar
      <- fill_temple_of_the_gods <- themeroom_fill <- lspo_region
      <- filler_region

so we reach the same fill through lspo_region, where nothing sets
game.coder.croom -- only lspo_room does (js/sp_lev.js:1394). create_altar
therefore takes its `else` branch and draws rn2(80)/rn2(21), a whole-map
random, where C draws rn2(8)/rn2(4) within the room.

The dispatch is NOT the problem: dat/themerms.lua:880 filler_region really
does call des.region({..., contents = themeroom_fill}), so our path matches C.
C's lspo_region (src/sp_lev.c:5693) pushes the region onto coder->tmproomlist,
calls update_croom(), runs the contents, then spo_endroom() pops. gc.coder is
created by create_des_coder() with n_subroom starting at ONE and
tmproomlist[0] left NULL, which is why update_croom() still yields null at the
top level and spo_endroom() pops only while n_subroom > 1.

**This was implemented and REVERTED.** Porting create_des_coder, update_croom,
spo_push_room and spo_endroom, and pushing the region around its contents,
made seed2600 stand still at 395 and drove seed0015 BACKWARD from 2513 to 359,
costing 2,286 corpus RNG. game.coder was never created before that change, so
every `game.coder?.croom` read in the port has always been undefined and a
good deal of code is presumably written around that. Setting croom for real
changes get_location, create_monster's placement and the des.* verbs all at
once.

WHY it regressed is now known, and it names the rest of the job.

src/sp_lev.c cvt_to_relcoord():

    if (gc.coder && gc.coder->croom) {
        *x -= gc.coder->croom->lx;
        *y -= gc.coder->croom->ly;
    } else {
        *x -= gx.xstart;
        *y -= gy.ystart;
    }

Every coordinate handed OUT to Lua is converted to room-relative first
(nhlsel.c:939 in selection:iterate, and the same for rndcoord), and
get_location() adds the origin back on the way IN. So the Lua works in
RELATIVE coordinates throughout and the round trip is exact.

Our port hands back ABSOLUTE coordinates from selection_iterate and
selection_rndcoord, and that is only correct because croom is always null, so
get_location's mx/my are xstart/ystart. Set croom without converting and every
explicit coordinate from a selection gets offset by the room origin a second
time -- which is exactly what drove seed0015 backward.

That pass is now DONE and committed: create_des_coder, update_croom,
spo_push_room, spo_endroom, both lspo_room and lspo_region pushing their room
around the contents callback, and cvt_to_relcoord/cvt_to_abscoord applied in
selection_iterate and selection_rndcoord. Nothing regresses -- seed0015 holds
at 2513 -- and the machinery is faithful where before it was absent.

seed2600 is FIXED: 395 -> 2830. The last piece was that themerooms_generate
builds a themed room with create_room + topologize and calls its contents
function DIRECTLY. That is our inline equivalent of the
des.room({type="themed", contents=themeroom_fill}) the Lua writes, so it owes
lspo_room's bookkeeping too -- push the room, update_croom, run contents, pop.
Neither lspo_room nor lspo_region was on that path, which is why instrumenting
create_altar kept showing coder=false even after both of those pushed.

seed0013 is FIXED: 528 -> 540 -> 3846, in two steps. fill_buried_zombies
skipped its des.object() and spent only the zombify timer's draw, so the
corpse's own somex/somey never happened. Then lspo_object turned out to ignore
the `montype` option entirely, so the corpse had no corpsenm, create_object
never called set_corpsenm, and start_corpse_timeout -- whose single rnz() is
five PRNG calls -- never ran. montype resolves WITHOUT a gender draw, unlike
des.monster()'s id.

OLD, now resolved: seed2600 and seed0013 did not move when only
lspo_room and lspo_region pushed. C draws somex/somey
inside the room at those calls and we still draw a whole-map random, so
create_altar is reaching its no-croom branch for another reason. Next step is
to instrument create_altar again now that the coder exists, and find which
path reaches it with croom null -- the earlier probe showed `coder=false`,
which is now fixed, so the answer will have changed.

The nhlua.c:428/483 conversion sites are still unported; nothing currently
routes through them.

Do NOT undo the conversions to "simplify": they are what keep the enablement
from regressing, and the version without them cost 2,286 corpus RNG.

seed0013's two sessions at 528 are the SAME cause as seed2600: C's tag at
522-524 reads parent=region(...), so croom is set there too, and C draws
somex/somey where we draw rn2(21)/rn2(4).

The lesson is the method. `js/rng.js`'s RND() with a temporary env-gated
stack trace, run through `node frozen/ps_test_runner.mjs
--worker-session=<file>` (the parent runner spawns a child and swallows
stderr), names OUR caller. The diverge tool names C's. Comparing the two is
what turns "obj_resists is next" into "our name lookup returns NON_PM".

### Two missing DRAWS found by following divergences down, not by guessing

Both were invisible to the "reached but unported" list, because the code path
WAS reached -- it just spent fewer draws than C.

  - finddpos_shift() had no irregular-room walk. C steps inward through
    STONE/CORR looking for a good wall position and SHIFTS x/y to it; without
    that every such pick failed and finddpos() spent another rn1() on its
    retry loop. Themed rooms are irregular, so it fires on most levels.
    seed0004: 1923 -> 2458.
  - makedog() never saddled the starting pony. src/dog.c:260 calls
    put_saddle_on_mon(NULL, mtmp) for a PM_PONY, and creating that saddle
    spends a next_ident(). seed0103: 2334 -> 2440.
  - dog_invent() skipped the fetch entirely, including its rn2(20) and
    rn2(udist)/rn2(apport), because can_carry and could_reach_item had not
    landed when it was written. They have now.

The method that found all three: take a session's first divergence, read the
C function named in the tag, and compare it line by line against ours. The tag
names the function containing the divergent SOURCE LINE, not a missing
function -- getbones, obj_resists and next_ident were all already ported and
all three were pointing at a caller that drew a different number of times.

### The next blocker, re-measured after level_tele

    6  dog_move (src/dogmove.c:1255)
    4  obj_resists (src/zap.c:1469)      <- the SAME job as dog_move
    4  next_ident (src/mkobj.c:521)      <- already ported; caller differs
    4  getbones (src/bones.c:645)        <- needs level_tele's '?' menu
    3  somex (src/mkroom.c:668)
    3  rnd_otyp_by_namedesc (src/objnam.c:3522)

getbones dropped from 7 to 4 when level_tele landed. The remaining 4 all take
the '?' branch, which is print_dungeon(), the dungeon-overview MENU, and needs
the tty menu system.

### The pet divergence, traced to the end

seed1500 diverges at call 2300, where C spends three more obj_resists than we
do. Every layer of that has now been measured:

  - the three extra calls are dog_goal's INVENTORY scan, which calls dogfood()
    on each carried item (6 of them) looking for something the pet likes
  - the scan only runs when appr == 0
  - appr is 0 only when `udist > 1` is false, i.e. the pet is ORTHOGONALLY
    ADJACENT to the hero
  - instrumented, our pet is at udist 4 at that moment and C's must be at 1

So the pet is on a different square, and it got there without a single draw
disagreeing. That means a NON-DRAWING decision differs. mfndpos is no longer a
candidate: every one of its arms is now ported. What is left is dog_move's own
selection (the j/chcnt/whappr branch at dogmove.c:1253) and dog_invent, which
runs BEFORE dog_goal, can move the pet by eating, and still carries
note_unported for its pickup path.

Look at dog_invent first: it is the only thing that can move the pet before
the goal is even computed.

### Where the pet work stands, and the open question

acurr(), initedog()'s edog fields and dog_move's per-square object walk are in
(see the commits). dog_goal now settles on a goal on the first object instead
of re-drawing rn2(8) for every object in its box.

What is still open is LEVEL CONTENT. On seed1500, C's dog_goal calls dogfood()
on FIVE objects inside the pet's 11x11 box and we call it on TWO. Measured:

    pet at 68,14   box x 63..73, y 9..19
    our whole level holds 20 objects: 16 gold, 1 corpse, 1 blank paper,
    2 scrolls of teleportation
    only 2 of them are in the box: gold at 72,13 and the corpse at 68,13

Only ONE mkobj_at() call happens in our entire level generation, and RNG
matches C call for call through all of it, so the rn2(3) gate at
src/mklev.c:1156 is being answered identically. Either C's extra objects come
from a placement path we do not run at all (one that spends no draws), or the
three extra obj_resists belong to dog_move's walk over squares that hold
objects in C and not in ours.

Counting object glyphs off a recorded screen does NOT work and wasted a pass.
Step 0 of most sessions is the LEGACY BLURB, not the map, so a scan for object
symbols picks up punctuation from the intro text ("Go bravely with Kos!" reads
as a potion at map 55,15). Even on a real map frame it would only ever see the
hero's lit room. Do not repeat that measurement.

What HAS been measured: fill_ordinary_room runs for 9 rooms on seed1500 and
its rn2(3) results are 1,0,1,1,2,2,2,2,2 -- exactly one zero, so exactly one
mkobj_at() call. RNG matches C call for call through all of level generation,
so C answers that gate identically and makes the same single call. Our object
COUNT from this site is therefore right, and the earlier "C has three more
objects near the pet" reading is unproven.

The callers HAVE now been read directly, by stack-tracing RND() in js/rng.js
(gate it on an env var and run the worker directly -- the parent runner spawns
a child and swallows stderr, so `node frozen/ps_test_runner.mjs
--worker-session=<file>` is required). Ours, around the divergence:

    #2296 rn2(100)  obj_resists <- dogfood <- dog_goal <- dog_move
    #2297 rn2(8)    dog_goal
    #2298 rn2(100)  obj_resists <- dogfood <- dog_goal <- dog_move
    #2299 rn2(5)    distfleeck   <- NEXT MONSTER; dog_move drew nothing more

C spends three more obj_resists between its equivalent of #2298 and its
distfleeck. dog_move's per-square object walk is ported and live (167 calls a
session) but finds zero objects on the pet's neighbours here, while C finds
three.

Since the object COUNT from fill_ordinary_room is provably right, the most
likely shape is a PILE: C walks svl.level.objects[nx][ny] through ->nexthere,
so three objects stacked on ONE square give three dogfood calls from one
square. Look for a placement that should stack and instead merges or replaces
-- mkgold onto an existing pile is the obvious suspect, since gold is 16 of
our 20 level objects.

### What the obj_resists cluster actually is

Six sessions' first divergence is tagged obj_resists(zap.c:1469). js/zap.js has
obj_resists and it is correct. What differs is how MANY times C calls it.
seed1500 at call 2297:

    2296  rn2(4)    dochug(monmove.c:886)
    2297  rn2(100)  obj_resists      <- ours matches
    2298  rn2(8)    dog_goal(dogmove.c:554)   <- edog->apport > rn2(8)
    2299  rn2(100)  obj_resists      <- ours matches
    2300  rn2(100)  obj_resists      <- ours stops here, draws rn2(8) instead
    2301  rn2(100)  obj_resists
    2302  rn2(100)  obj_resists

C runs four consecutive obj_resists after dog_goal's rn2(8) and we run one.
dog_goal's APPORT branch cannot be the source of all four: it short-circuits on
`gg.gtyp == UNDEF`, so once a goal is set no later object reaches the rn2(8).
can_carry() calls can_touch_safely(), which does not draw. So the extra calls
come from the pet actually PICKING UP and eating, i.e. dog_move (dogmove.c:1255)
and the meatobj/meatmetal arms at mon.c:1482 and mon.c:1586.

That makes obj_resists and dog_move the same 6-session job, not two. Port
dog_move and its object handling and both tags should move together.

## The pattern worth internalising

Four of the six fixes were "the state was right, the draw was missing or
wrong". None of them touched a single RNG call. Symptoms to look for:

- **High RNG agreement, zero screens.** seed0105 matched 2479 of 2499 calls and
  scored 0 of 30 screens, on one cell of its first frame (an engraving we
  generated and then painted floor over). Run `screendiff <session> 0` first.
- **All 1920 cells match, cursor differs.** That was getlin's NEWAUTOCOMP
  insertion point, worth 50 screens.
- **A case that does not exist.** `terrain_glyph` had no arm for fountain,
  altar, pool, lava, tree, bars, ladder, ice, drawbridge, sink, throne or
  grave; they all drew blank. Worth 12.

## What landed this stretch

New files, all mirroring a real C file: `js/mondata.js`, `js/hack.js`,
`js/worn.js`, `js/tty/termcap.js`, `js/wizcmds.js`, `js/extcmd_data.js`
(+ `tools/gen-extcmd.mjs`, 170 commands, 92 with key bindings, 52
autocompletable).

Ported or corrected: `sobj_at` (was `return false` in two files),
`can_touch_safely`, `bad_rock` (had 3 of its 5 terms), `mfndpos`' ALLOW_DIG arm
and obstruction test, `m_carrying` (was returning a dummy `{}`), `onscary`'s
scare-monster arm, `extcmds_match`, `ext_cmd_getlin_hook`, `wiz_level_change`,
`term_start_color`, the engraving glyph, the DEC open-door glyph, the missing
terrain glyphs, and space falling through to "Unknown command".

## THE BIGGEST REMAINING TARGET: death and restart. Ground truth located.

**seed0030's first death is CHOKING, not combat.** The message at step 73 is
`You("die...")` from src/eat.c:285, inside choke():

    } else {
        You("choke over it.");
        Strcpy(svk.killer.name, "quick snack");
    }
    You("die...");
    done(CHOKING);

So the route in is the EAT command, not mattacku. That is a far narrower
subsystem than "combat" and it is already partly reachable -- rhack dispatches
'e' today. What is missing between the command and the death is doeat/eatfood's
occupation loop and the choke() gate.

Do not port combat for this. Measured, the eat chain is small:

    doeat         268 lines  2 draws    <- the bulk; 'e' already dispatches to it
    choke          44 lines  1 draw
    eatfood        23 lines  0 draws
    start_eating   53 lines  0 draws

js/cmd.js:460 already routes 'e' and reaches floorfood(); what is missing is
doeat's body, start_eating's occupation, and the choke() gate that ends the
game. Under 400 lines total for the path that unblocks seed0030's first death.

## seed0030's FIRST screen divergence is a pet TRAIL, at step 4.

The largest session in the corpus (1953 steps) breaks on screens long before
its RNG divergence at 6276. `screendiff sessions/seed0030... --first`:

    step 4, after key "h"     3 of 1920 cells differ
      r5 c55   C 'f' white     ours '$' yellow
      r5 c56   C '<' yellow    ours 'f' white
      r5 c57   C '.' default   ours 'f' white

**Ours has TWO 'f' monsters, and it is NOT a display trail.** I assumed a
stale glyph, added the missing `newsym(omx, omy)` from src/monmove.c:1508 (a
real omission -- remove_monster is a bare macro that only clears
level.monsters[][], so the vacated square is never redrawn without it), and the
three cells did not change.

So there really are two monsters on screen where C has one. That is a
makemon/level-generation difference, not a rendering one. C's single 'f' sits
at c55 ON the gold pile (ours still shows '$' there), so C's pet has moved onto
the gold and ours has not -- and we have an extra monster besides.

**Confirmed twice over: it is NOT a display bug.** The vacated-square redraw
`newsym(omx, omy)` was genuinely missing and is now ported into postmov (where
src/monmove.c:1508 has it -- inside postmov, so EVERY path returning through it
redraws, including dog_move's at :1773). The three cells did not change either
time.

The frames side by side:

    C     |f<.|      pet at c55 ON the gold, upstair at c56, floor at c57
    ours  |$ff|      gold visible at c55, monsters at c56 AND c57

So we generate an EXTRA monster, and our pet has not moved onto the gold.
seed0030 diverges on screens at step 4 while its RNG matches to call 6276, so
the extra monster is placed with draws that happen to line up -- most likely a
makemon that C makes elsewhere, or one we make twice.

**Measured.** A `globalThis` counter inside makemon, over seed0030 segment 0
with the first six keys, logs exactly three calls:

    random@13,10 | random@51,16 | random@57,4

The third is at (57,4) -- screen row 5, column 57 -- which is EXACTLY where our
extra 'f' sits. So level generation places a random monster there and C does
not. All three have ptr == null (a random species), so this is makelevel's
random-monster fill, not the pet: makedog does not appear in the log at all.

The caution about not assuming it is the pet was right; it is not.

**Located in the C.** src/mklev.c:974, inside fill_ordinary_room:

    if ((u.uhave.amulet || !rn2(3)) && somexyspace(croom, &pos)) {
        tmonst = makemon((struct permonst *) 0, pos.x, pos.y, MM_NOGRP);
        if (tmonst && tmonst->data == &mons[PM_GIANT_SPIDER]
            && !occupied(pos.x, pos.y))
            (void) maketrap(pos.x, pos.y, WEB);
    }

One sleeping monster per room, gated on !rn2(3), placed by somexyspace. Our
three calls are three rooms passing that gate.

Since the RNG matches to call 6276, the rn2(3) gates and the somexyspace draws
agree with C's. So the difference is WHICH ROOM each draw applies to, or what
somexyspace returns given the same draws -- i.e. room ORDER or room GEOMETRY,
not the monster fill itself.

**Our room list for seed0030 level 1, measured (5 rooms):**

    room0: 10,8-18,10     room1: 33,6-38,10     room2: 48,16-53,18
    room3: 56,4-58,5      room4: 66,8-71,10

Room3 is the one on screen row 5. BOTH anomalies live in it: our pet at (56,4)
and the extra random monster at (57,4). C's frame for the same row is

    row 4   +---+   walls
    row 5   |f<.|   pet at 55, upstair at 56, floor at 57

**and the room bounds are CORRECT -- I misread the axis.** js/display.js maps
`setCell(x - 1, y + 1, ...)`, so SCREEN COLUMN = MAP X - 1 and screen row =
map y + 1. Converting C's frame:

    screen col 55 -> map x 56    C: pet
    screen col 56 -> map x 57    C: upstair
    screen col 57 -> map x 58    C: floor

which is exactly our room3 at x = 56..58. The walls matching was the clue that
the bounds were fine; the "shift" was my own screen-vs-map confusion, and
NOTES already records that screen row R is map row R-1 for the same reason.

So the real difference is:

    C     map 56 = pet (standing on the gold), 57 = upstair, 58 = floor
    ours  map 56 = gold visible, 57 = monster, 58 = monster

Our pet has not moved onto the gold at map 56, and there is a second monster at
map 58. makemon logged only ONE random monster in this room, at (57,4) -- so
the thing at map 58 is the PET, and the thing at 57 is the random sleeper. C's
pet is at 56 and ours is at 58: two squares apart, not one.

**FINAL, measured twice. The pet moves fine; the EXTRA MONSTER is the bug.**

Tracing dog_move on seed0030 shows it called every turn and committing:

    dog_move-enter | move 58,4->58,5 | move 58,5->57,4 | move 57,4->57,5
                   | move 57,5->56,4

so the pet does follow the hero and does reach (56,4), which is exactly where
C's pet is. An earlier reading here said "the pet never moves" -- that was
wrong, taken from a single step-4 snapshot without tracing.

So the two 'f' glyphs at step 4 are the PET plus the random sleeper that
fill_ordinary_room placed at (57,4), and C has NO monster at 57 -- its frame is
pet / upstair / floor. The extra monster was the bug all along, which was the
FIRST reading, discarded through four intermediate theories.

Where it comes from: src/mklev.c:974, one sleeper per room gated on !rn2(3) and
placed by somexyspace. Our three calls land at (13,10), (51,16) and (57,4). The
RNG matches to call 6276, so the gate draws agree; C's third sleeper must land
somewhere our somexyspace does not put it, or C skips a room we fill.

Our sleeper code at js/mklev.js:2122 is

    if (!rn2(3) && somexyspace(croom, pos)) makemon(null, pos.x, pos.y, MM_NOGRP);

against C's src/mklev.c:974

    if ((u.uhave.amulet || !rn2(3)) && somexyspace(croom, &pos)) ...

The missing `u.uhave.amulet ||` is harmless HERE -- without the Amulet the ||
short-circuits to the same rn2(3) and spends the same draw -- but it should be
added anyway, because WITH the Amulet C skips the rn2(3) entirely and we would
spend a draw C does not. That is a real future desync on Amulet levels.

**somexyspace and occupied both match C EXACTLY -- verified line by line.**

    somexyspace   src/mkroom.c   somexy && isok && !occupied && (ROOM|CORR|ICE),
                                 100 tries -- ours is identical
    occupied      src/mklev.c:1806  t_at || IS_FURNITURE || is_lava || is_pool
                                 || invocation_pos -- ours is identical
                                 (invocation_pos records, and is meaningful
                                 only on the invocation level)

So neither predicate is the bug, and the sleeper landing on C's upstair square
is NOT an occupied() gap: C's occupied does not reject stairs either, because
IS_FURNITURE covers fountains/thrones/sinks/altars, not staircases.

**somexy also matches for the room in question**, which takes the
`if (!croom->nsubrooms) { somex; somey; return TRUE; }` arm -- room3 has no
subrooms, so it is one somex/somey pair and return, identical to C.

**But somexy's SUBROOM arm has a real gap.** C, src/mkroom.c:

    while (try_cnt++ < 100) {
        c->x = somex(croom); c->y = somey(croom);
        if (IS_WALL(levl[c->x][c->y].typ)) continue;
        for (i = 0; i < croom->nsubrooms; i++)
            if (inside_room(croom->sbrooms[i], c->x, c->y))
                goto you_lose;              <- MISSING IN OURS
        break;
     you_lose: ;
    }

Ours returns TRUE as soon as the square is not a wall, so it will happily place
things INSIDE a subroom that C rejects -- and each rejection in C costs another
somex/somey pair, so this is a draw difference too. It has not fired yet
because nothing generated a subroom until this session's "Room in a room"
themeroom went in; now that lspo_room calls create_subroom, it can.
`inside_room` is ported (js/sp_lev.js) and only needs wiring here.

That leaves `somexy` -- the raw coordinate pick inside the loop. Compare it
against src/mkroom.c somexy, and in particular the ORDER of its rn2 calls and
whether it draws once or twice per attempt: somexyspace retries up to 100
times, so one extra or missing draw per attempt shifts every later placement on
the level while the total still happens to line up at call 6276.

So the placement is the remaining suspect: same gate, same draw, different
square. **Compare somexyspace's result for room3 (56,4-58,5) against C's.**
js/mklev.js:1426 somexyspace already carries a fix for the irregular-room retry
loop; check the SPACE_POS/accessible test it uses to reject a square, since
rejecting one square more or fewer than C changes which position the same draws
land on.

That is the whole remaining distance on seed0030's first screen divergence:
one square, one predicate.

Superseded readings follow; each was overturned by one measurement.


Dumping the pet's square immediately after makedog on seed0030:

    pet at creation: 58,4   hero=57,4      <- correctly adjacent

and at step 4 the hero has walked to (55,5) while our pet is STILL at (58,4).
C's pet is at (56,4), diagonally adjacent, having followed. So makedog and
makemon are fine; the pet simply is not moving.

That reframes everything above: the extra 'f' was never extra, the room bounds
were never shifted, and enexto was never implicated. Our pet is stationary
while C's follows the hero.

Check dog_move's return path first: js/monmove.js dochug dispatches pets to
dog_move, and dog_move's own tail does `remove_monster(omx, omy);
place_monster(mtmp, nix, niy)` -- verify that it is REACHED and that mmoved
comes back MMOVE_MOVED. A pet that computes a goal correctly and then never
commits the move looks exactly like this, and js/dog.js:905 is where the
commit happens.

Superseded analysis follows.

js/dog.js makedog() calls

    makemon(mons[pettype], u.ux, u.uy, MM_EDOG | NO_MINVENT)

i.e. at the HERO's own square, and relies on makemon to relocate it because the
hero is standing there. Check that our makemon actually does that relocation --
C's makemon calls enexto/goodpos when the requested square is occupied, and
enexto is one of the functions this port RECORDS rather than implements
(js/sp_lev.js create_monster has the same gap). If makemon places the pet on
the hero's square or picks a different free square than C's, every later
dog_move inherits the error.

At step 4 the hero is at map (55,5) and C's pet is at (56,4), diagonally
adjacent. Ours is at (58,4) -- three columns away, so it has wandered rather
than started wrong, OR started wrong and compounded. Distinguish those two by
dumping the pet's square immediately after makedog, before any move.

Check `topologize` and the wall-drawing path against croom->lx/hx before
touching room creation. If the walls come from a different source than the
room bounds, the two can disagree silently -- and every somexy/somexyspace
placement in that room inherits the wrong bounds, which is exactly the
signature here: pet one square off AND a monster one square off, same room.

## Superseded: dump our room list
compare against the room the C places its third monster in. If the rooms differ
in order or extent, the fill is innocent and the bug is in mklev's room
creation -- which would also explain the pet being one square off, since
somexy/somexyspace read the same room bounds.

## Superseded: how many random monsters C places
where. src/mklev.c's makelevel ends with a loop over rnd(...) monsters; compare
its count against our three, and check whether our third call is one C never
makes or one C makes at a different square. The RNG matching to call 6276 means
the DRAWS line up, so the likeliest cause is a placement difference rather than
an extra creation -- somexy or the room choice putting it at 57,4 where C puts
it elsewhere. C has one 'f' at c55, with the
upstair and floor visible where ours shows the trail.

Where it should be cleared: src/monmove.c:1655 calls `newsym(mtmp->mx,
mtmp->my)` on the NEW position only, so the OLD square is redrawn by something
else -- find it before patching. Candidates: remove_monster in src/mon.c, or
the per-turn vision/flush pass. Do NOT just add a newsym on the old square
without finding the C's actual mechanism; a redraw in the wrong place is how
the display picks up a second bug.

This matters more than the choke path right now: seed0030 is 1953 steps and
currently matches 20 of them. A pet that leaves a trail is wrong on nearly
every frame with a pet in it, which is most frames of most sessions.

## Reachability sweep on the des.* verbs — one gap found

`grep -rn "container_obj\["` in src/sp_lev.c turns up the pop path our port
does not implement, at :2428 inside create_object:

    if (o->buried) {
        boolean dealloced;
        (void) bury_an_obj(otmp, &dealloced);
        if (dealloced) {
            if (container_idx)
                container_obj[container_idx - 1] = NULL;   <- MISSING
            otmp = NULL;
        }
    }

bury_an_obj DEALLOCATES rocks and boulders (they merge into the burying
material). When that happens and the object was the open container, C nulls the
stack slot so nothing is later put inside a freed object.

Our bury_an_obj returns nothing and signals no dealloc, and our create_object
never clears the slot. It cannot bite today -- Buried treasure buries a CHEST,
which is neither ROCK nor BOULDER, so the dealloc arm does not run. It will the
moment anything buries a boulder with contents open.

Port it as: bury_an_obj returns whether it deallocated, and create_object
clears container_obj's top and nulls otmp when it did.

## Reachability sweep on the OCCUPATION mechanism — one gap found

Same method as the subroom sweep: grep the C for everything that reads the
structure a new subsystem creates. `grep -rn "go\.occupation\|stop_occupation"`
turns up:

    allmain.c:506   the moveloop check              PORTED
    allmain.c:684   stop_occupation                 PORTED, but see below
    dogmove.c:386   a begging pet stops it          reachable now
    do_wear.c:3254  taking armour off stops it      not ported
    dig.c:197,599   `go.occupation == dig` tests    dig not ported
    cmd.c:209,212   set_occupation itself           PORTED

**The gap: stop_occupation calls maybe_finished_meal(TRUE).**

    if (go.occupation) {
        if (!maybe_finished_meal(TRUE))
            You("stop %s.", go.occtxt);
        go.occupation = 0;
        disp.botl = TRUE;
        nomul(0);
    } else if (gm.multi >= 0) {
        nomul(0);
    }

Ours clears the slot and returns. So an interrupted meal that is nearly done is
never finished, and the "You stop eating." message is printed where C prints
nothing. maybe_finished_meal is in src/eat.c and is small; port it with
stop_occupation rather than separately, since the message is conditional on it.

Also note dogmove.c:386 -- a hungry pet begging calls stop_occupation, and
dog_hunger IS ported, so this path is live.

## THE OCCUPATION LOOP (now ported): js/allmain.js had none.

doeat -> start_eating -> bite -> choke -> done is PORTED and connected for
ordinary food. It has not fired yet because multi-turn meals run through the
OCCUPATION mechanism, and js/allmain.js has no occupation machinery at all --
grep it for "occupation" or "multi" and there are zero hits.

The C, src/allmain.c:485, inside moveloop_core BEFORE the command read:

    if (gm.multi >= 0 && go.occupation) {
        if ((*go.occupation)() == 0)
            go.occupation = 0;
        if (monster_nearby())
            stop_occupation();
        ...
    }

and set_occupation (11 lines) is just:

    if (xtime) { go.occupation = timed_occupation; timed_occ_fn = fn; }
    else       { go.occupation = fn; }
    go.occtxt = txt; go.occtime = 0;

So the work is: an `occupation` slot on game, set_occupation/stop_occupation,
and the four-line check in moveloop_core. eatfood() is the callback and is 23
lines with 0 draws.

**This also unblocks the run loop** (gm.multi + lookaround + end_running),
which is the same `gm.multi >= 0` plumbing and was already on the queued list.
Two subsystems behind one mechanism.

Be careful: this edits moveloop_core, which every session runs every turn. Land
the slot and set_occupation first with the loop check absent, verify 352 holds,
then add the check as its own commit.

**doeat's tail sets everything the death depends on** (src/eat.c, the last
lines of doeat before `return ECMD_TIME`):

    victual.reqtime = objects[otmp->otyp].oc_delay;
    ... rounddiv adjustments for partly-eaten food ...
    if (reqtime == 0 || otmp->oeaten == 0)      nmod = 0;
    else if (otmp->oeaten >= reqtime)           nmod = -(oeaten / reqtime);
    else                                        nmod = reqtime % oeaten;
    victual.canchoke = (u.uhs == SATIATED);     <- THE DEATH CONDITION

    if (!dont_start) start_eating(otmp, already_partly_eaten);

So `canchoke` is latched ONCE, when the meal starts, from the hunger state at
that moment -- not re-checked per bite. That is why the death is deterministic
given the hunger state: the hero commits to a meal while Satiated and bite()
kills on the first turn that uhunger is still >= 2000.

choke() and bite() are PORTED (js/eat.js). What remains is doeat's tail above
plus start_eating's occupation loop:

    start_eating: victual.eating = 1; fullwarn = doreset = 0
                  if (bite()) { ...finish if usedtime >= reqtime...; return }
                  if (++usedtime >= reqtime) { done_eating(...); return }
                  set_occupation(eatfood, "eating <food>", 0)

Note bite() is called BEFORE usedtime is incremented, so a one-turn meal
eaten while Satiated chokes on the very first call.

**The exact death condition, src/eat.c:3138 in bite():**

    if (svc.context.victual.canchoke && u.uhunger >= 2000) {
        choke(svc.context.victual.piece);
        return 1;
    }

So the hero chokes by eating while ALREADY at 2000+ nutrition -- Satiated to
the point of death. `canchoke` is set when the food is a normal meal (not a
tin, not a corpse being force-fed). That means the port needs u.uhunger tracked
across meals, not just the eat command: the death is a consequence of
accumulated nutrition, and eating one item at the wrong hunger level is what
triggers it.

js/eat.js already has doeat and floorfood; the gap it records is
'doeat:eating'. What is missing is start_eating's occupation loop, bite()'s
per-turn call, and u.uhunger accounting in gethungry (which IS already ported
-- js has gethungry in the moveloop, it appears in the RNG log at eat.c:3191).

The second choke() caller at eat.c:2387 is AMULET_OF_STRANGULATION and is not
seed0030's path.

Note choke() draws once and doeat twice, so this DOES move the RNG stream --
unlike done()/outrip(), which spend nothing. Measure per-session and check the
divergence point, not the corpus total.

**The frames.** The exact frames, decoded from the
recorded session:

    step 73  "You die...--More--"        (top line)
    step 74  "You die...--More--"
    step 75  the tombstone:

                             ----------
                            /          \
                           /    REST    \
                          /      IN      \
                         /     PEACE      \
                        /                  \
                        |      Quincy      |

That is `outrip()` in src/end.c, and the block is fixed ASCII with the hero's
name centred in it. Everything between step 73 and the next game is SCREENS --
done/done_in_by/really_done spend ZERO draws between them (728 lines measured).

So the work is, in order:

  1. done() reaching "You die..." with its --More-- (js/end.js has the seam;
     losehp in js/hack.js is the route in)
  2. outrip()'s tombstone -- a fixed block, name centred, then the killer line,
     the gold, and the year
  3. the final-inventory and score screens
  4. newgame() a second time; check what resetGame() in js/gstate.js clears

seed0030 is 1953 steps, the largest session in the corpus, and reaches step 73
of them today. Seven sessions share this blocker.

## Measured sizes

**js/end.js does not exist. Death is entirely unported.** There is no done(),
no done_in_by(), no u.uhp <= 0 check anywhere in js/.

Measured, src/end.c is 1948 lines total:

    done          107 lines  0 draws
    done_in_by    160 lines  0 draws
    really_done   461 lines  0 draws

**Zero draws in all three.** That is the important number: the death sequence
itself spends nothing. What it does is print the DYWYPI prompt, the tombstone,
the final inventory and the score -- all SCREENS -- and then start a new game,
whose u_init() and mklev() are where the draws resume.

So this is a screen-parity job with a control-flow job attached, not an RNG
job. For seven sessions the current state is: we keep playing a hero C has
already killed, so every subsequent frame is wrong.

Order of work:
  1. the u.uhp <= 0 check and done() reaching the death screens
  2. the DYWYPI / tombstone / final-inventory screens (pure output, and the
     tombstone is a fixed 20-line ASCII block)
  3. newgame() running a second time in the same process -- check what
     resetGame() in js/gstate.js already does

seed0030 alone is 1953 steps, the largest session in the corpus, and it is
named "ten-diverse-deaths".

## How this was found, and the rule it earned

Traced properly this time. The calls immediately BEFORE the divergence are:

    3329  C rn2(20)  ours rn2(20)  ok  @ vary_init_attr(attrib.c:769)
    3330  C rn2(20)  ours rn2(20)  ok  @ vary_init_attr(attrib.c:769)
    ...
    3337  C rn2(3)   ours rn2(12)  MISMATCH  @ getbones(bones.c:645)

`vary_init_attr` has exactly ONE caller in the whole tree: u_init.c:1391,
inside u_init() -- character creation. And every one of these sessions is a
SINGLE segment, so this is not a new segment starting.

So C is running u_init() and then mklev() partway through a single session,
which means **the hero DIED and a new game began in the same session**.
seed0030 is literally named "ten-diverse-deaths". getbones is simply the first
draw the new game's first level makes.

**The blocker is death and restart, not goto_level.** '>' is wired and correct
but irrelevant to these seven: they press it zero times.

What that needs: done_in_by/done(), the death sequence, then newgame() running
a second time in the same process. Check first whether our port even survives a
hero death -- if u.uhp reaching 0 currently does nothing, that is the entry
point.

This is the THIRD target in a row derived from a correct measurement and aimed
at the wrong mechanism (the -915 fills, the '>' descend path, and the earlier
mktrap chase). The pattern: a cross-session tally names the FUNCTION where the
streams part, which is not the same as the EVENT that put them there. Read the
calls before the mismatch, not just the mismatching one.

## Reference: the '>' descend path, ported and wired

js/do.js (dodown, next_level, goto_level's new-level arm, stairway_at,
u_on_dnstairs) is ported and wired to rhack. It cost three missing-symbol
fixes to get there, all recorded in the commit log.

**But the seven sessions that block inside mklev() press '>' ZERO times:**

    seed0009-swimmer-mforce        > keys: 0
    seed0116-wizard-wear-shop      > keys: 0
    seed0373-barbarian-quest-tour  > keys: 0

So C is entering mklev() by some route OTHER than the down-staircase command.
Candidates, matching the session names:

  - a TRAPDOOR or hole fall (dodown's other arm, and mktrap makes trapdoors)
  - the Mysterious Force pushing the hero UP a level -- seed0009 is literally
    named "mforce", and goto_level's three Quest draws are exactly that code
  - entering the Quest or Mines through a magic portal -- seed0373 is
    "quest-tour"
  - a level teleport trap

**Find the real route before porting more of goto_level.** The cheapest test:
instrument our own goto_level with a counter, then compare against the C rn2
log around each session's divergence call to see what precedes mklev's first
draw. The '>' path being correct does not mean it is the path being used.

This is the same error as assuming the -915 was the fills: the fix was right
and the target was wrong.

## Reference: the descend chain, mapped call by call.

The descend path (dodown, next_level, goto_level's new-level arm,
stairway_at, u_on_dnstairs) is in js/do.js and correct. Wiring `>` to it
costs 11 screens and 423 RNG with:

    "STAIRS is not defined"    thrown from js/mklev.js mkstairs()

STAIRS **is** imported at js/mklev.js:113. So this is a TDZ on that import
binding, not a missing symbol. Four wiring placements were tried and ALL
produce it identically:

    1. dynamic import('./mklev.js') inside goto_level
    2. do_wire_mklev() called from mklev.js
    3. do_wire_mklev() called from cmd.js
    4. do_wire_mklev() called from jsmain.js (the entry point!)

That (4) fails is the important clue: jsmain runs after every module has
evaluated, so a normal import cycle would already be resolved. **The trigger is
cmd.js importing do.js at all** -- the wire location is irrelevant.

Hypotheses in order:
  a. cmd.js is itself imported DURING mklev.js's evaluation (grep mklev.js's
     transitive imports for cmd.js; display.js and invent.js are likely routes),
     so adding any new edge from cmd.js reorders the whole graph.
  b. js/const.js imports js/terminal.js (a FROZEN file) at its top, so const.js
     is not a leaf; anything that changes when const.js finishes evaluating can
     leave its exports in TDZ for an importer mid-cycle.
  c. Try giving do.js NO imports at all (pass rn2/game in through the wire) and
     see whether the error moves -- that isolates whether do.js's own import
     list is what reorders the graph.

The baseline is 352 screens; the unwired file keeps it exactly there. Do not
ship the wiring until the error is understood -- it is an 11-screen regression,
not a post-divergence artifact.

## The descend chain, mapped call by call.

    dodown()              src/do.c:? -> next_level(!trap)
      next_level(at_stairs) src/dungeon.c:1497
        stway = stairway_at(u.ux, u.uy); stway->u_traversed = TRUE;
        newlevel = { stway->tolev.dnum, stway->tolev.dlevel }
        goto_level(&newlevel, at_stairs, FALSE, FALSE)
      goto_level()        src/do.c
        ...
        if (!(level_info[new_ledger].flags & LFILE_EXISTS)) {
            mklev();            <- ALREADY PORTED AND WORKING
            new = TRUE;
        } else { ...reload from file... }   <- record this arm
        ...
        u_on_dnstairs()   at the ~277 mark
        u_on_upstairs()   at the ~295 mark
        losedogs()        at the ~338 mark

The LFILE_EXISTS test is the whole reason this is tractable: a first descent
takes the mklev() branch, and mklev() is ported. The file-reload branch is for
revisiting and can record.

Of goto_level's four draws, THREE are the Mysterious Force
(rn2(4 + mysteryforce), rn2(odds), rn2(diff + 2)) which only fires in the
Quest, and the fourth is rnd(3) falling damage. A plain staircase descent
spends NONE of them -- so the descend path can be ported without touching any
of goto_level's own draws.

dodown's own two draws are the !rn2(3) / rnd(4) pair for falling through a
trapdoor, also not on the staircase path.

## Measured sizes:

    goto_level      src/do.c   520 lines  4 draws   <- the work
    dodown          src/do.c   164 lines  2 draws
    doup            src/do.c    47 lines  0 draws
    schedule_goto              15 lines  0 draws
    deferred_goto              30 lines  0 draws

520 lines is the headline number and it overstates the job: much of goto_level
is save/restore for REVISITING a level (save_currentstate, the level-file
read/write, mapseen bookkeeping). A first descent to an unvisited level takes
the mklev() path, and mklev() is already ported and working -- that is exactly
why the seven sessions' first mismatch lands on getbones, mklev's first draw.

So the port order is: the descend path only (dodown -> goto_level's new-level
arm -> mklev), with the revisit/save arms recorded. Then u_on_dnstairs and
losedogs, which put the hero and the pets on the new level.

`<` and `>` already reach js/cmd.js:119; they currently do nothing.

## The tally that produced this, for reference:

Tallying the first mismatching function across all 44 sessions:

    7  getbones          <- NOT a bones bug; see below
    6  obj_resists
    6  dog_move
    4  next_ident
    3  rnd_otyp_by_namedesc   (the wish parser)
    2  makelevel
    1  each: u_calc_moveamt, spelleffects_check, somex, mksobj_init, makeniche

**The getbones seven are not a bones bug.** getbones() IS ported and does spend
its rn2(3). The mismatch is:

    seed0009  3337  C rn2(3)   ours rn2(12)  @ getbones(bones.c:645)
    seed0116  2978  C rn2(3)   ours rn2(5)   @ getbones(bones.c:645)
    seed0373  2549  C rn2(3)   ours rn2(12)  @ getbones(bones.c:645)

C is inside mklev() -- generating a NEW LEVEL -- while we are still running
monster movement (rn2(12) is mcalcmove, rn2(5) is distfleeck). So C has
descended and we have not. getbones is simply the first draw mklev makes.

**The blocker is goto_level / level change, and it gates seven sessions.**
That is more than any other single cause, and far more than the wish parser's
three. It was already on the queued list; this measurement says it is the top
item, not a middling one.

Do NOT port readobjnam first. The divergence point names what breaks FIRST in
one session; this tally names what breaks the MOST across all of them, and they
disagree.

## Reference: the wish chain, measured

After pluslvl, seed0360 diverges at call 2939 instead of 2898, and the first
mismatch names the next function directly:

    2939  C rn2(67)  ours rn2(12)  @ rnd_otyp_by_namedesc(objnam.c:3522)

That is the object-by-name path, i.e. WISHING. seed0360 is a wizard-mode
"world tour" session, so it is issuing wishes. Measured:

    rnd_otyp_by_namedesc   src/objnam.c    75 lines  1 draw
    readobjnam             src/objnam.c   491 lines  8 draws   <- the bulk
    makewish               src/zap.c      109 lines  0 draws

readobjnam is the big one: it parses an arbitrary wish string into an object.
491 lines, and the draws are scattered through the parse rather than at the
end, so a partial port that handles only some syntaxes will spend the wrong
count on the ones it does not.

Before starting it, check how many public sessions actually wish -- grep the
session keystrokes for the wish prompt. If it is only seed0360 and seed0108
(the extcmd-wishlist one), weigh 491 lines against two sessions; the
divergence-point instrument names what is FIRST, not what is most valuable.

## Reference: the divergence-point instrument

With one 3% entry left, `generalize.mjs` has little more to say. The other
instrument is the DIVERGENCE POINT of each big session, and its first
mismatching call names the missing function directly. Measured:

    seed0360  2898  C rnd(8)     ours rn2(12)   @ newhp(attrib.c:1101)
    seed0014  2915  C rn2(500)   ours rn2(5)    @ mksobj_init(mkobj.c:1001)
    seed4500  2869  C rn2(28)    ours rn2(20)   @ m_move(monmove.c:1963)
    seed0030  6276  C rn2(100)   ours rn2(4)    @ obj_resists(zap.c:1469)

Three different causes, and **seed0360's is the clearest lead in the tree**:

C is calling `newhp()` where we call `mcalcmove()`. newhp's level-up branch is
only reached from `pluslvl()`, so C is granting a LEVEL GAIN that we never
grant. pluslvl's two helpers, newhp and newpw, were fixed earlier in this
session (the level-up branch did one rn1 where C does two gated rnd calls, and
the Constitution bonus was missing entirely) -- so the helpers are ready and
`pluslvl` itself is the missing piece.

**Do pluslvl next.** src/exper.c, and it needs setuhpmax, newuexp, xlev_to_rank
and adjabil beyond the two helpers already done. seed0360 is 833 steps.

seed0014 is a separate object-init divergence (mksobj_init's rn2(500) arm) and
seed4500 a monster-movement one (m_move:1963's rn2(28)); neither is the same
bug, so fixing one will not move the others.

## The last themeroom entry: "Water-surrounded vault". It is the biggest of the fifteen.

`tools/generalize.mjs` is down to a single 3% entry from thirteen. Everything
else in the themeroom subsystem is ported AND wired: all fifteen fills, all four
des.* verbs with their chains, des.room/des.door/des.altar, the selection
primitives, containment, the postprocess queue, subrooms, and the three nested
themerooms (Room in a room, Huge room, Nesting rooms).

**What the last one needs, read from dat/themerms.lua:765.** It is not another
des.room entry -- it is the only genuinely SHAPED themeroom, and it uses Lua
object bindings nothing else in the file touches:

    des.map({ map = [[...6x6...]], contents = function(m) ... end })
    des.region({ region={3,3,3,3}, type="themed", irregular=true,
                 filled=0, joined=false })
    shuffle(chest_spots)                        -- 3 draws over 4 entries
    obj.new("scroll of teleportation")          -- NOT PORTED, a Lua obj binding
    itm:class()                                 -- NOT PORTED
    box = des.object({ id="chest", coord=..., olocked="no" })
    box:addcontent(itm)                         -- NOT PORTED

`obj.new`, `:class()` and `:addcontent()` are src/nhlobj.c bindings -- a file
this port has not touched at all. They are what let the Lua build an object
OUTSIDE the level and then insert it, which is different from des.object's
create-in-place.

Order of work: nhlobj.c's obj.new/class/addcontent first, then des.map's
contents callback (lspo_map already exists and stamps the map; what is missing
is running its `contents` with the map's coordinate frame), then this fill.

Note `math.random(#escape_items)` is ONE draw picking among four, and the
glass/crystal test branches on the RESULT, so the two des.object arms differ
only in olocked -- the draw count is the same either way.

`tools/generalize.mjs` is down to:

    3%  themeroom Nesting rooms
    3%  themeroom Huge room with another room inside
    3%  themeroom Room in a room
    3%  themeroom Water-surrounded vault

**Correction to an earlier note in this file: they are NOT all shaped rooms.**
Checked against js/themerms_data.js:

    Room in a room                       maps: 0
    Nesting rooms                        maps: 0
    Huge room with another room inside   maps: 0
    Water-surrounded vault               maps: 1   <- the only shaped one

So three of the four take the SAME des.room() path built in this stretch. What
they need is a general `lspo_room()` function, because their contents are
NESTED des.room() calls:

    -- "Room in a room"
    des.room({ type = "ordinary", filled = 1, contents = function()
       des.room({ type = "ordinary", contents = function()
          des.door({ state = "random", wall = "all" });
       end });
    end });

The des.room option handling currently lives INLINE in themerooms_generate's
switch (js/mklev.js), which can only handle the top level. Extracting it into
lspo_room(opts) that create_room()s, topologize()s and then runs `contents`
with gc.coder->croom pushed -- exactly as src/sp_lev.c:4028 does -- makes the
nesting work and closes three of the four entries.

Note the inner rooms are SUBROOMS in C (create_subroom, not create_room) when
gc.coder->croom is already set; check lspo_room's `if (mkr)` branch before
assuming create_room for both levels.

des.door is also needed for "Room in a room" and is not ported.

Everything else on that list is closed. What went in, bottom-up:

    js/selvar.js        selection primitives, rndcoord, filter_mapchar,
                        filter_percent, iterate, from_mkroom, not, numpoints
    js/themerms.js      all 15 fills + the postprocess queue + make_a_trap
    sp_lev.js           get_location, is_ok_location, get_location_coord,
                        get_unpacked_coord, get_room_loc, get_free_room_loc,
                        lspo_terrain, create_trap, lspo_trap,
                        get_traptype_byname, create_object, lspo_object,
                        find_objtype, def_char_to_objclass, the class/id fixup,
                        containment, blessorcurse, get_table_buc,
                        create_monster, lspo_monster, name_to_mon,
                        pm_to_humidity, inside_room, create_altar, lspo_altar,
                        sp_amask_to_amask, bury_an_obj, mkroom_table
    mklev.js            mktrap generalised from mktrap_room, des.room options

## Reference: earlier target notes

The themeroom subsystem is COMPLETE: des.room() options, all fifteen fills, and
all four des.* verbs with their chains. The three "themed fill" themerooms are
gone from the reached-unported list. What is on it now is the fills' remaining
leaves, and they cluster:

     5%  des.object:buried chest          Buried treasure
     5%  des.object:random in chest       Buried treasure
     5%  postprocess:make_dig_engraving   Buried treasure
     3%  des.monster:ghost                Ghost of an Adventurer
     3%  des.object:dagger/bow/arrow/scroll   Ghost of an Adventurer (4 entries)
     3%  des.altar                        Temple of the gods
     3%  four SHAPED themerooms (des.map, a different path)

**Ghost of an Adventurer is FIVE entries for TWO small create_object options**:
`coord` (place at a given square rather than random) and `buc`
(get_table_buc -> curse_state; "not-blessed" is one of its values). Both are
already sketched in create_object's recorded arms. Best ratio on the list.

Then Buried treasure's three: `buried` plus a contents closure. The closure
calls des.object() with no arguments, i.e. the RANDOM_CLASS arm, so it needs no
new machinery either.

## Reference: the des.* leaves, measured sizes and draw counts:

The themeroom fills all run now, so what the generalization sweep lists is what
THEY call. Measured before planning (the awk/grep from NOTES):

    lspo_object     199 lines   0 direct draws
    lspo_monster    187 lines   3 direct draws
    lspo_feature     80 lines   0 direct draws
    lspo_trap        74 lines   0 direct draws     <- smallest
    lspo_altar       36 lines   0 direct draws

"0 direct draws" does NOT mean cheap: each one bottoms out in a creator that
draws. lspo_trap is the shortest path in and the chain is fully mapped:

    lspo_trap -> create_trap (sp_lev.c, 35 lines, 0 direct draws)
              -> get_free_room_loc (20 lines, 0 direct draws, but calls
                 get_location_coord and get_room_loc, which DO draw)
              -> mktrap(type, flags, croom, &tm)

### des.trap and des.object are DONE. des.monster is the last leaf.

    lspo_monster    src/sp_lev.c  187 lines  3 direct draws
    create_monster  src/sp_lev.c  263 lines  1 direct draw
    mkclass, makemon, get_location_coord, enexto   ALREADY PORTED

**The draw detail that matters, sp_lev.c create_monster:**

    if (pm) {
        int loc = pm_to_humidity(pm);
        /* If water-liking monster, first try is without DRY */
        get_location_coord(&x, &y, loc | NO_LOC_WARN, croom, m->coord);
        if (x == -1 && y == -1) {
            loc |= DRY;
            get_location_coord(&x, &y, loc, croom, m->coord);   <- SECOND call
        }
    } else {
        get_location_coord(&x, &y, DRY, croom, m->coord);
    }

A monster whose humidity is not DRY gets TWO full get_location_coord calls when
the first finds nothing, and each spends up to 100 tries' worth of draws. Only
the pm == 0 arm makes a single call. Collapsing these into one lookup is the
same mistake as collapsing get_location_coord's own internal retry.

Also: `In_mines && your_race(pm) && (Race_if(DWARF) || Race_if(GNOME)) && rn2(3)`
spends an rn2(3) on every create_monster in the Mines for a dwarf or gnome hero.

Storeroom's `des.monster({ class = "m", appear_as = "obj:chest" })` takes the
mkclass(class, G_NOGEN) arm, so the id path is not what to port first.

**Helper status:**

    inside_room       PORTED     pm_to_humidity   PORTED
    mkclass, makemon, get_location_coord          PORTED
    enexto             8 lines, wrapper           NOT PORTED
    enexto_core      154 lines, 1 draw            NOT PORTED
    goodpos          (measure it)                 NOT PORTED

**Scoping call: port create_monster with enexto RECORDED, not blocked on it.**
enexto is reached only through

    if (MON_AT(x, y) && enexto(&cc, x, y, pm)) x = cc.x, y = cc.y;

i.e. only when the chosen square is already occupied. On a freshly generated
level that is rare, and enexto_core spends one draw when it happens. Porting
create_monster's main path now and recording the collision case is the same
trade already made for create_object's option arms, and it unblocks Storeroom
and Cloud room. Do NOT stub enexto to "return false" -- that silently changes
placement; record it and leave x,y as they were, which is what C does when
enexto fails.

### des.object chain, for reference:

    lspo_object    src/sp_lev.c  199 lines  0 direct draws
    create_object  src/sp_lev.c  248 lines  0 direct draws   <- the real work
    mkobj_at       src/mkobj.c     8 lines  0 direct draws   ALREADY PORTED
    mksobj_at                                                ALREADY PORTED
    mksobj                        81 lines  1 draw           ALREADY PORTED

create_object's first four lines are the whole shape:

    get_location_coord(&x, &y, DRY, croom, o->coord);   <- ported
    ...
    otmp = mkobj_at(RANDOM_CLASS, x, y, !named);        <- ported
    otmp = mksobj_at(o->id, x, y, TRUE, !named);        <- ported
    otmp = mkobj_at(oclass, x, y, !named);              <- ported

So every leaf create_object needs already exists. The 248 lines are option
handling (buc, spe, quantity, contents, buried, lit, montype, name, eroded,
trapped, ...), and the four fills that call des.object use only a handful:

    Storeroom      des.object("chest")
    Statuary       des.object({ id = "statue" })
    Massacre       des.object({ id = "corpse", montype = ... })
    Light source   des.object({ id = "oil lamp", lit = true })
    Buried treasure des.object({ id = "chest", buried = true, contents = ... })

Port create_object's placement and id/class resolution first, record the
option arms that need absent subsystems, and wire those five. Do NOT skip
get_location_coord: it is where the placement draws happen, and des.object with
no coord is the common case.

**RESOLVED — read this instead of re-deriving it.**

The four lines at sp_lev.c:2204 read as though `des.object("chest")` makes a
RANDOM object: lspo_object sets `class = -1` for any multi-character name, that
gives `c = 0`, and create_object's first arm is `mkobj_at(RANDOM_CLASS, ...)`,
which never reaches the `mksobj_at(o->id, ...)` arm.

It does not, because of a FIXUP after all the argument-form parsing, at
sp_lev.c:3662:

    if (tmpobj.class == -1 && tmpobj.id > STRANGE_OBJECT)
        tmpobj.class = objects[tmpobj.id].oc_class;
    else if (tmpobj.class > -1 && tmpobj.id == STRANGE_OBJECT)
        tmpobj.id = -1;

So a named object gets its class back from objects[id].oc_class before
create_object ever runs, `c` is non-zero, and arm (B) mksobj_at IS the one
taken. The converse also matters: a class given with no id has its id forced to
-1, which is what sends it to the third arm's def_char_to_objclass/mkgold path.

**Port the fixup with create_object.** Without it every named object in every
themeroom fill becomes a random one, and the draw counts differ: mkobj_at picks
a class and then an object, mksobj_at knows the type.

### The original question, for the record

src/sp_lev.c:2204 reads:

    if (o->class >= 0) c = o->class; else c = 0;

    if (!c) {
        otmp = mkobj_at(RANDOM_CLASS, x, y, !named);     <- (A)
    } else if (o->id != -1) {
        otmp = mksobj_at(o->id, x, y, TRUE, !named);     <- (B)
    } else { ... def_char_to_objclass / mkgold / mkobj_at(oclass) ... }

and lspo_object sets, for a multi-character name like "chest":

    tmpobj.class = -1;
    tmpobj.id = find_objtype(L, paramstr, -1);

class = -1 gives c = 0, which takes arm (A) — a RANDOM object — and never
reaches (B) despite id being set. Taken at face value, `des.object("chest")`
would not make a chest.

Either the table branch of lspo_object sets `class` from the id's own oclass
somewhere past sp_lev.c:3580 (most likely, and unverified), or `object` is
initialised with class != -1 and the -1 is only for the string forms, or (A) is
genuinely reached and the fills' chests are random objects.

**Read lspo_object's table branch to the end and settle it. Do not port
create_object from the four lines above.** The draw counts of arms (A) and (B)
differ -- mkobj_at picks a class and then an object, mksobj_at knows the type --
so guessing wrong changes the stream, not just the item.

### mktrap already exists as `mktrap_room` — and is missing draws

js/mklev.js:1839 `mktrap_room(croom)` is a partial src/mklev.c:2036 mktrap().
Generalising it to the real signature `mktrap(num, mktrapflags, croom, tm)` is
the remaining work, and these are the differences that COST OR ADD DRAWS:

1. **The placement retry loop is absent.** C does

       do {
           if (++tryct > 200) return;
           if (mktrapflags & MKTRAP_MAZEFLAG) mazexy(&m);
           else if (croom && !somexyspace(croom, &m)) return;
       } while (occupied(m.x, m.y)
                || (avoid_boulder && sobj_at(BOULDER, m.x, m.y)));

   Ours calls somexyspace ONCE. Every rejected square in C is another
   somexyspace, so a crowded room diverges by however many retries it needed.
   `avoid_boulder` is `is_pit(kind) || is_hole(kind)`.

2. **`Inhell && !rn2(5)` is absent** — a fire-trap bias in Gehennom that spends
   an rn2(5) on every mktrap call down there, before the traptype_rnd loop.

3. **WEB spawns a giant spider**: `if (kind == WEB && !(flags & NOSPIDERONWEB))
   makemon(&mons[PM_GIANT_SPIDER], m.x, m.y, NO_MM_FLAGS)`. makemon draws.
   Spider nest passes spider_on_web, so this fires from a themeroom fill.

4. **`lvl` is `level_difficulty()`, not `u.uz.dlevel`.** Ours uses dlevel. They
   differ once the hero is off the first branch, and lvl gates the
   mktrap_victim() block (`lvl <= rnd(4)`), so the rnd(4) is spent either way
   but the block runs on the wrong levels.

5. Missing arms that do not draw but change the result: the `num` parameter
   (a caller-specified trap type skips traptype_rnd entirely), `tm` (an
   explicit location skips the placement loop), MKTRAP_SEEN, MKTRAP_NOVICTIM,
   `Is_rogue_level`, and the early `is_pool_or_lava(tm)` rejection.

**The full chain, measured. Port bottom-up in this order:**

    get_location      src/sp_lev.c   68 lines  2 draws   NOT PORTED
    get_location_coord               17 lines  0 draws   NOT PORTED
    get_room_loc                     20 lines  2 draws   NOT PORTED
    get_free_room_loc                20 lines  0 direct  NOT PORTED
    mktrap            src/mklev.c   119 lines  2 draws   NOT PORTED
    create_trap       src/sp_lev.c   35 lines  0 direct  NOT PORTED
    lspo_trap                        74 lines  0 direct  NOT PORTED

    somexy / somexyspace   js/mklev.js   ALREADY PORTED and faithful
    (somexy's irregular-room retry loop is in and correct)

Two practical notes for whoever does it:

- `somexy` lives in js/mklev.js and is NOT exported, and mklev.js imports
  sp_lev.js. Putting get_room_loc in sp_lev.js therefore needs either an export
  plus a cycle check, or get_room_loc placed in mklev.js instead. Its C home is
  sp_lev.c, so prefer exporting somexy and verifying the cycle resolves.
- get_free_room_loc's first get_location_coord() is spent UNCONDITIONALLY; the
  retry loop only runs if that lands on a non-ROOM square, and each pass costs
  another get_room_loc(). Collapsing the two into one loop changes the count.

An attempt to land get_room_loc/get_free_room_loc without get_location_coord
was backed out rather than left half-wired.

Do lspo_trap first: five of the fifteen fills call des.trap (Boulder room, Trap
room, Spider nest, Statuary, Teleportation hub), so it unblocks the most.

## Then: update_mon_extrinsics is DONE; this section is history

`merged` (was 58%) and `m_dowear` (was 20%) are both ported and gone from the
reached-unported list. Latest `tools/generalize.mjs`:

      8%  update_mon_extrinsics     <-- next, src/worn.c, inside m_dowear_type
      5%  themeroom Default room with themed fill
      5%  themeroom Unlit room with themed fill
      3%  (six more themerooms, one themeroom_fill)

`update_mon_extrinsics` needs monster intrinsics, which this port does not
track at all yet -- check whether that is a small struct addition or a real
subsystem before committing to it.

The themerooms are still 28% collectively but need src/nhlsel.c (1051 lines)
first; see below.

`merged` WAS this entry at 58% and is now ported; it no longer appears on the
reached-unported list at all. Latest `tools/generalize.mjs` run:

     20%  m_dowear with inventory       <-- next
      5%  themeroom Default room with themed fill
      5%  themeroom Unlit room with themed fill
      5%  mergable:erosion_matters
      3%  (six more themerooms, one themeroom_fill)

Measured before you plan around it: **`m_dowear` (src/worn.c:757) is 40 lines
and `m_dowear_type` (:799) is 204, and NEITHER CONTAINS A SINGLE RNG DRAW.**
Grep them yourself if you doubt it. So this is a state-only fix: it will not
move the RNG number at all, and it will not move the local screen score much
either. What it does is make `which_armor` (js/worn.js) start returning real
answers, which `mfndpos`' dig arm, `can_touch_safely` and monster AC all read,
and it sets `owornmask`/`misc_worn_check`, which nothing currently sets.

Budget it as one full session for m_dowear_type alone; it is long rather than
subtle, and the payoff is generalization, not local score.

**The themerooms are one port, not eight — this is checked, not assumed.**
They share the dispatch at js/mklev.js:708 AND the work. Each theme's `contents`
in dat/themerms.lua is one to three lines that all bottom out in `des.room()`:

    -- "Default room with themed fill"
    des.room({ type = "themed", contents = themeroom_fill });
    -- "Unlit room with themed fill"
    des.room({ type = "themed", lit = 0, contents = themeroom_fill });
    -- "Room with both normal contents and themed fill"
    des.room({ type = "themed", filled = 1, contents = themeroom_fill });
    -- "Room in a room"        (des.room nested inside des.room, + des.door)
    -- "Nesting rooms"         (same, with w/h from nh.rn2 and math.random)

So porting `des.room()` once — that is `lspo_room()` in sp_lev.c, with the
option table type/lit/filled/w/h/contents — unlocks most of the eight at 1-3
lines apiece. Collectively 28% of random games, against m_dowear's 20%, and
unlike m_dowear these DO draw (nh.rn2 and math.random are right there in the
Lua), so this one moves the RNG number.

**Do this before m_dowear.** Note also that tools/gen-themerms.mjs currently
scrapes only index/name/frequency/mindiff/maxdiff and drops `contents`
entirely; it needs extending, or the bodies need hand-porting into js/themerms.js
as the C's own functions.

### The des.room() wiring: -915 FOUR times, and here is what that eliminates

Attempted four times, always **exactly -915**. The constancy is the clue: the
loss does not vary with anything about the fills, so it is not draws inside
them. Ruled out by direct experiment, each independently:

  1. the fills being unported          (all 15 ported -> still -915)
  2. the des.* leaves being unwired    (all wired and drawing -> still -915)
  3. the mkroom_table shape            (passed as filler_region does -> -915)
  4. needfill FILL_NONE vs FILL_NORMAL (isolated to 0)

And the split within it, isolated separately:

    rtype/rlit change only, no contents call     -21
    contents call from des.room                  -894

So `contents(rm)` from THIS call site costs 894 no matter what contents does.
That points at the call site, not the callee.

**Next hypotheses, in order of cheapness:**

  a. These three themerooms may not reach this path in C at all. Check whether
     they have a `maps` entry and go through themeroom_contents() instead --
     js/mklev.js:700 returns early for those, and the reservoir sample would
     then be picking a DIFFERENT entry than we think.
  b. themeroom_fill() may be reached twice per room: once here as des.room's
     contents and once via filler_region(). C would then draw one reservoir
     sample; we would draw two.
  c. create_room() with rtype = THEMEROOM may take a different path than with
     OROOM somewhere downstream of js/mklev.js:623, which already treats the
     two alike for filling.

Test (b) first: instrument themeroom_fill with a per-level counter and compare
against the C's rn2 log around the themeroom block. Two samples where C has one
would produce a constant loss exactly like this.

**RESULT — themeroom_fill is never called today. Read this before testing.**

A counter inside themeroom_fill reads **0 across ALL segments** of seed0030
(ten), seed4500 and seed0360. The only path to it in the current tree is
filler_region(), which fires only for SHAPED rooms behind a percent(30), and
no public session reaches it.

This resolves the confusion in the four failed attempts:

  - Every fill-related hypothesis was tested against a function that never
    ran. That is why the number never moved: not because the hypotheses were
    wrong, but because nothing was exercising them.
  - The -894 therefore IS the first-ever call to themeroom_fill on these
    levels. The three "themed fill" themerooms ARE being picked by the
    reservoir sample; today they fall through to note_unported_lev plus a
    default room, and wiring des.room's contents calls themeroom_fill for the
    first time.
  - So the question is now sharp: **when the sample picks "Default room with
    themed fill", does C call themeroom_fill there at all?** If it does, our
    reservoir sample inside themeroom_fill must be drawing differently from
    C's. If it does not, we are picking a different themeroom than C is, and
    the bug is upstream in themerooms_generate's own sample.

Test that by dumping our themerooms_generate pick per level against the C rn2
log for the same level. The picks, not the fills, are what to compare.

**RESULT — seed0030's picks across all ten segments:**

    default          92
    Blocked center    1
    Z-shaped, rot 1   1

The three "themed fill" entries are picked ZERO times there, and the two
non-default picks are SHAPED rooms that return early through
themeroom_contents() before reaching the des.room switch at all. So the
des.room change is a NO-OP for seed0030 -- yet the corpus still loses 915.

**Therefore the -915 is concentrated in specific other sessions.** Find them
before theorising further:

    apply the des.room change, run tools/scoreboard.mjs, and diff the
    per-session rng column against the committed baseline. Two or three
    sessions will account for the whole loss.

Then dump picks for THOSE sessions. If they pick a themed-fill entry where C
picks something else, the bug is in themerooms_generate's reservoir sample
(is_themeroom_eligible's difficulty gates are the likely suspect, since they
decide how many entries the sample walks and therefore how many rn2 it spends).

Do not run another whole-corpus experiment without first knowing which sessions
move. Four attempts were spent measuring a total while reasoning about a path
that was never reached in most of it.

Also note: all fifteen fills and the des.* chains are for the HELD-OUT half.
generalize.mjs finds themerooms in 3-5% of random games while the public
corpus reaches them zero times. That is the clearest example this session of
work that score.sh cannot see.

**Earlier partial result:** a `globalThis` counter inside
themeroom_fill reads **0** on seed8000 segment 0 and **0** on seed0030 segment
0. So themeroom_fill is not reached on those levels at all -- yet wiring its
contents gained +9 RNG, so it IS reached somewhere. It must be firing on deeper
levels or later segments.

Consequences for the next attempt:

  - Count across ALL segments, not segment 0. `runSegment` per segment and sum;
    seed0030 has ten.
  - The -915 therefore comes from levels this probe never visited, which is
    also why every fill-related hypothesis failed to move it: on the levels
    that matter, the fills may not be what differs.
  - Consider counting create_room calls and their rtype instead. If the
    themerooms that take the des.room path are generated on deeper levels, the
    -21 from rtype/rlit may be the whole story there and the -894 may be a
    second, unrelated effect on those same levels.

`themeroom_fill` IS wired and gained +9 RNG (113,910 -> 113,919). It is reached
through `filler_region()`, which every shaped room ends with, so it does not
need the des.room() option handling at all. All fifteen fills in js/themerms.js
are transcribed.

Wiring des.room()'s option handling on top of that costs **-915** and has been
reverted twice. The second attempt ISOLATED it, which the first did not:

    rtype/rlit change only, no contents call     -21
    contents call (themeroom_fill from des.room) -894
    needfill FILL_NONE vs FILL_NORMAL              0   <- not the cause

So the earlier "the fills were missing" explanation was WRONG. The fills exist
now and the number is identical.

**The live lead, unfinished:** src/sp_lev.c:3059 l_push_mkroom_table() shows the
Lua `contents` function receives a TABLE, not the C mkroom --

    width  = 1 + (hx - lx)      height = 1 + (hy - ly)
    region = {x1,y1,x2,y2}      lit    = (boolean) rlit
    irregular, needjoining, type

Our fills read `rm.width`, `rm.height`, `rm.region.x1` and `rm.lit` directly,
which are ALL undefined on a raw mkroom. fill_buried_zombies' loop bound is
`(rm.width * rm.height) / 2`, so it is NaN and the loop never runs; that alone
changes the draw count of every Buried zombies fill.

`mkroom_table()` is ported in js/sp_lev.js ready for this. Applying it at the
filler_region call site cost -15, so EITHER that site passes something that is
already table-shaped, OR a fill has a second bug. Check what lspo_region hands
its contents function before wiring it further -- do not just apply it.

### The earlier attempt, for completeness

Routing the three "themed fill" entries through the existing default-room path
in themerooms_generate(), with rtype = THEMEROOM, rlit from `lit`, needfill =
FILL_NONE when `filled` is absent, and calling themeroom_fill(aroom) after
topologize(), **cost 915 RNG positions** and was reverted. Screens did not move.

**All four are now SETTLED from src/sp_lev.c lspo_room():4028. Do not re-derive.**

  1. needfill default is `gi.in_mk_themerooms ? 0 : 1`, with the C's own
     comment `/* theme rooms default to unfilled */`. in_mk_themerooms is TRUE
     for the whole themerooms_generate() call, so absent `filled` means
     FILL_NONE. **My guess was right.**
  2. rlit is `get_table_int_opt(L, "lit", -1)`, so `lit = 0` reaches
     create_room() as rlit = 0. **Right.**
  3. rtype is `get_table_roomtype_opt(L, "type", OROOM)`, and sp_lev.c:3962
     maps "themed" to THEMEROOM. `chance` defaults to 100, so build_room's
     `rn2(100) < r->chance` is always true and the roll is always spent.
     **Right.**
  4. The contents ORDER is where I was wrong. lspo_room does:

         tmpcr = build_room(...);        /* create_room + topologize */
         update_croom();
         <contents(tmpcr)>
         spo_endroom(gc.coder);
         add_doors_to_room(tmpcr);       /* <-- I omitted this */

     I called contents after topologize (correct) but skipped update_croom()
     before it and spo_endroom() + add_doors_to_room() after it.
     js/sp_lev.js already has add_doors_to_room.

**But the ordering was NOT the cause of the 915 loss, and this is measured:**
`add_doors_to_room` only records doors the map already stamped; it draws
nothing. Neither does update_croom or spo_endroom.

The cause is `themeroom_fill`. Its reservoir sample IS ported (it draws) but the
15 fills' contents are NOT — and those contents contain **16 draws**
(`nh.rn2`, `math.random`, `percent`) across the table:

    awk '/^themeroom_fills = \{/,/^\}/' nethack-c/upstream/dat/themerms.lua \
      | grep -cE 'nh\.rn2|math\.random|percent\('     # => 16

So wiring the themed-fill rooms makes the sample fire at the right moment and
then go silent exactly where C keeps drawing, which moves several sessions'
divergence EARLIER. That is precisely a 915-position loss with no screen change.

**Therefore: do not port the themed-fill themerooms without porting the fills
they call.** They are one change, not two.

**And this is bigger than "15 short functions" — checked.** Every fill body is
written against the *selection API*, which is a whole file we do not have:
`src/nhlsel.c`, 1051 lines. The shortest fill still needs most of it:

    -- "Ice room", the smallest one
    local ice = selection.room();          -- selection.room()
    des.terrain(ice, "I");                 -- des.terrain over a selection
    if (percent(25)) then ... ice:iterate(ice_melter) end   -- :iterate, timers

    -- "Boulder room"
    local locs = selection.room():percentage(30);  -- :percentage DRAWS
    locs:iterate(function(x,y) ... des.object / des.trap ... end)

So the real unit of work is: `js/nhlsel.js` mirroring src/nhlsel.c (selection
create/room/percentage/iterate/filter), then `des.terrain`/`des.object`/
`des.trap` over a selection, then the fills, then lspo_room's option handling.
That is a multi-session subsystem, not an afternoon.

Given that, **`m_dowear` (20%, self-contained, no new subsystem) is the better
next target after all**, even though the themerooms are 28%. Revisit the
themerooms once nhlsel.js exists for some other reason.

## How to pick a target (this is the part that matters)

`tools/generalize.mjs` runs 40 games on seeds NONE of which come from
`sessions/`, so what it reports is generalization, not public-session fit.

**Run it before picking any target, and re-run it after.** A session-driven
divergence tells you about one game; this tells you what the held-out half will
hit. Porting `merged` moved the local score by zero and removed the single
biggest generalization gap in the port — those are not the same axis, and the
score is the one that lies to you.

The seed0030 work below is one session and should come after the list above.

## The seed0030 divergence — identified precisely, do not re-derive

**`m_move` is missing its entire post-move block, `src/monmove.c:1660-1681`.**

    if (mmoved == MMOVE_MOVED || mmoved == MMOVE_DONE) {
        if (OBJ_AT(mtmp->mx, mtmp->my) && mtmp->mcanmove) {
            if (metallivorous(ptr))          meatmetal(mtmp);
            if (ptr == &mons[PM_GELATINOUS_CUBE]) meatobj(mtmp);
            if (corpse_eater(ptr))           meatcorpse(mtmp);
            if (mpickstuff(mtmp))            mmoved = MMOVE_DONE;
            ...

Our m_move places the monster and returns. So **no monster ever eats anything
off the floor and no monster ever picks anything up.**

This was found from the RNG log, not guessed. seed0030 diverges at call 6276:

    6275  C rn2(5)=1     ours rn2(5)=1      ok        @ distfleeck(monmove.c:538)
    6276  C rn2(100)=92  ours rn2(4)=0      MISMATCH  @ obj_resists(zap.c:1469)
    6277  C rn2(8)=7     ours rn2(100)=67   differs   @ dog_goal(dogmove.c:554)

C's rn2(100) is `obj_resists(otmp, 5, 95)` at src/mon.c:1482, inside
`meatmetal()`. A metallivore moved onto a metal object and ate it; we skipped
straight on to the pet's turn, whose rn2(4) is dog_goal's `!rn2(4)`.

**`meatmetal` is now ported and wired, and seed0030 still diverges at 6276.**

First rule out that the caller is even meatmetal. `obj_resists` has THREE call
sites and the RNG tag names only the callee, not the caller:

  - src/mon.c:1482  meatmetal()        obj_resists(otmp, 5, 95)
  - src/mon.c:1586  meatobj()          obj_resists(otmp, 5, 95)   gelatinous cube
  - src/mon.c:3323  make_corpse()      obj_resists(obj, 0, 0)     dying monster's
                                                                  inventory

The third is worth knowing about on its own: with ochance and achance both 0 the
comparison `chance < 0` can never be true, so it always returns FALSE -- and it
still spends the rn2(100). That is the "computed and discarded" class in NOTES.
js/zap.js draws before comparing, so it is already right, but any future caller
must not short-circuit it.

If it turns out to be the third site, the divergence is a monster DEATH we are
not performing, not an eating path, and meatmetal is a red herring for seed0030
(still correct to have ported, just not the cause).

If it is genuinely meatmetal, ask why no metallivore reaches it:
Check, in this order:
1. whether the monster taking that turn is a pet (meatmetal returns 0 for pets
   at its first line, and dog.c handles pet eating separately);
2. whether `OBJ_AT(mtmp.mx, mtmp.my)` is true for it — our `game.level.objects`
   is one flat list, so confirm the object is actually on that square;
3. whether the caller is a path that does not yet route through `postmov` —
   C has five, and only the three ours has were wired.

`postmov` is a real function now (src/monmove.c:1455), NOT the tail of m_move.
That mattered: the block existed but every early return skipped it, so wiring
meatmetal in changed nothing until postmov was extracted. src/monmove.c:1773 is
the pet path, so dog_move's result goes through postmov as well.

Then `mpickstuff`, which affects the most turns of the four.

The visible symptom that led here was seed0030 step 4: C has the kitten at col
55 and the upstair at 56, we have gold at 55 and the kitten at 56. That is a
*consequence*, not the cause — `dog_move`'s choice loop and `dog_goal`'s APPORT
guard were both checked line by line against the C and both already match.

Then `pluslvl`/`losexp` (src/exper.c), which is what seed0360 waits on at step
20 — it needs `newhp`, `newpw`, `setuhpmax`, `newuexp`, `xlev_to_rank`, so it
is a subsystem, not a one-liner.

seed0017 is a separate shape worth one look: its step 0 differs in 737 cells
because C's first frame has no intro text and ours does.

## Do not re-derive these

All measured, all in NOTES.md:
- `dat/symbols`' `start: DECgraphics` section **overrides** `include/defsym.h`.
  Grep it for any `S_*` before hardcoding a map character.
- the step-0 `--More--` count is **3** sessions, not the 32 an earlier entry
  claimed.
- an RNG "positions match overall" drop is not a regression by itself; check the
  divergence point with `git stash` + `diverge.mjs`.

## Still queued, unchanged

`merged`/`mergable` (needs `weight`, `obj_extract_self`), `pick_lock`,
`set_wear`, `mkroll_launch`, the run loop (`gm.multi` + `lookaround` +
`end_running`), `throwit`'s trajectory, `mattacku`, `goto_level`, `dog_eat`,
`pickup(1)`.

seed0102/seed0105 remain close on RNG; the `score_targ` over-count trace predates
the `dog_goal` fix, so **re-run the count before tracing further**.

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

### RETRACTED: seed0077's inventory is fine (probe artifact)

An earlier entry here claimed seed0077 builds no starting inventory. **That was
wrong** — it came from probing `game.invent.length` at keystroke 0, and for an
interactively-chargen'd session keystroke 0 is the NAME PROMPT, long before
`u_init` runs.

Measured properly, tracking every keystroke: inventory is 0 for keys 0-10 (the
name "Shade\r" plus the role/race/gender/alignment picks) and **6 from key 11
onward**, which is exactly right. seed8000 shows 13 at key 0 only because its
rc names role, race, gender and alignment, so it has no chargen prompts at all.

**Lesson for any probe on a chargen session:** key 0 is not "the start of the
game". Gate probes on a keystroke after chargen completes, or on a game-state
condition, not on `keyIdx === 0`.

So the cause of the `a` (apply) regression on seed0077 is still unknown — see
the NOTES entry, which records both failed attempts. The invlet hypothesis
there is now also dead: the letters exist and are correct once chargen is done.

### The held-out score is moving, and that is the real check

Leaderboard, scored 2026-07-25T18:58Z: we are **9th of 16**, up from 11th, with
**77 held-out screens (was 43)** and held-out RNG 10.9%. Public at that pickup
was 197 with 1/44 passing.

That near-doubling matters more than the public number: none of this session's
fixes were tuned to a session. The ones that moved it are exactly the ones with
no local payoff — `getobj` for seven commands, `walk_path`, `somexy`'s
irregular-room branch, `F`/`g`/`m`, `dothrow` — plus the window `offx` fix,
which lands on any session opening with an inset window.

Read the board for the strategic picture too: four entrants sit at a perfect
11405 public with held-out of 2524, 265, 61 and 0. That is the overfitting
signature the rules warn about. serteal leads at 92.5% held-out via an
Emscripten transpile, which generalises almost perfectly but has no
function-for-function structure to diff, so Phase 2 divides its parity by a
very large number.

### The real blocker for seed0102/seed0105: the PET is in the wrong place

`pet_ranged_attk` is now ported (see below) and seed8000 still matches call for
call with it active — but neither target session advanced, because their
divergence is UPSTREAM of it.

Traced: at the divergent call our pet is at **udist = 5** from the hero with
**appr = 0**. dogmove.c:571 computes
`appr = (udist >= 9) ? 1 : mtmp->mflee ? -1 : 0`, and appr == 0 is what sends
dog_goal into the inventory scan whose dogfood() calls spend the rn2(100)s we
see instead of C's next draw. **C's appr is non-zero there, so C's pet is at
udist >= 9** — about four squares further from the hero than ours.

So this is pet positional drift, the same class as the seed4500 mfndpos 5-vs-7
finding, and it draws nothing until it changes a branch like this one.

**Traced per keystroke (seed0102).** The hero never moves — 28,7 for the whole
session. Our pet sits at **29,8 from key 0 through key 21**, then 30,8 at K22
(udist 5) and 30,7 at K23. Step 0's screen matches C's on all 1920 cells, so
both pets START at 29,8.

For C's appr to be non-zero at that point its pet must be at **udist >= 9**,
i.e. at least three squares out on one axis. **C's pet moved several squares
where ours barely moved at all.**

**FIXED (whappr), and the chain now fires correctly.** seed0102 advances to
4454, and calls 4452-4453 match exactly — including score_targ's rnd(5), which
is the proof that pet_ranged_attk/best_target/find_targ/score_targ are right.

**Remaining on seed0102: the pet gets an EXTRA TURN, it does not mis-score.**

Traced best_target's finds: each call sees the HERO along dir <-1,-1> and a
monster at <23,8> along <-1,0>. The hero hit returns early (score -3000, before
the rnd(5)), so **exactly one rnd(5) is spent per best_target call** — which is
what C spends at 4453, and ours matches it.

The extra rnd(5) at 4454 is therefore a SECOND best_target call, i.e. a second
pet turn, where C has already moved on to the next monster's dochug (its 4454 is
distfleeck's rn2(5)).

So the question is movement allotment, not targeting: **our pet acts more often
than C's.**

Checked and ELIMINATED this iteration:
- `mcalcmove` — matches src/mon.c line for line, including the MSLOW/MFAST
  arms and the `rn2(NORMAL_SPEED) < mmove_adj` rounding.
- moveloop_core's monster phase — the `do { movemon(); if (umovement >=
  NORMAL_SPEED) break; } while (monscanmove)` loop and the allotment below it
  match src/allmain.c:207-232 exactly.
- Duplicate monsters in `level.monsters` — none; m_id set size equals array
  length.
- `movemon_singlemon`'s return — WAS wrong (returned "has any movement left"
  where C returns FALSE) and is now fixed, but it is neutral because mcalcmove
  only ever grants multiples of NORMAL_SPEED.

**Counted, and the over-count is confirmed.** Grep the session's recorded RNG
for the tag:

    C (seed0102, whole session):  score_targ draws = 2,
                                  dogmove.c:1255 draws = 2,
                                  distfleeck draws = 8
    ours:                         score_targ CALLS = 10

best_target scores the HERO (early return at `score -= 3000`, no rnd(5)) plus
one monster per call, so 10 calls is roughly 4-5 drawing calls against C's 2.
**Our pet acts about twice as often as C's.**

**Cross-check taken, and it REVERSES the "acts twice as often" reading.**

    distfleeck:  C = 8 draws, ours = 6 calls

dochug calls distfleeck twice per monster turn, so C has FOUR monster turns and
we have THREE. **We take fewer turns than C, not more.**

Yet we spend more score_targ draws. The two facts only reconcile one way: our
`best_target` finds a scoring target on MORE of its turns than C's does. The BT
trace shows every one of our calls finding the hero along <-1,-1> (early return,
no draw) AND a monster at <23,8> along <-1,0> (one rnd(5)). C's pet found a
target on only two of its four turns.

**Visibility is NOT the fault — checked.** Probed row 8 from x=23 to x=30: every
square is typ 25 (ROOM) with `viz_clear = 1`. There is no wall between the pet
and <23,8>; the monster is genuinely visible from where our pet stands, and C's
find_targ would see it too from the same square.

Post-whappr score_targ trace (10 calls):

    HERO, 23,8 | HERO, 23,8 | HERO, HERO | HERO, 23,8 | HERO, 23,8

Five best_target calls, four of which find the monster and spend rnd(5). C
spends 2. So **C's pet was not standing where it could see <23,8> on two of its
turns** — it had moved off row 8 — while ours stays on it.

So this is the PET'S PATH again, one layer below the whappr fix. Our pet still
does not follow C's route even with appr = 1. The next thing to take is the
per-call goal: dump `gx`/`gy` from inside dog_goal (they are in ITS scope, not
dog_move's — an earlier attempt traced the wrong scope and printed nothing) for
each of the five calls, and check they head toward the hero at <28,7> as
appr = 1 should make them.

Note the seed4500 mfndpos 5-vs-7 drift is probably the SAME root — both are
"our monster perceives more open space than C's".

This is the same subsystem that would explain the seed4500 mfndpos 5-vs-7
drift, so a fix here may resolve both.

--- superseded diagnosis, kept so it is not re-derived ---

**Correction — it is NOT under-movement.** Instrumenting dog_move's entry and
early exits shows it runs **four times**, entering at

    29,8  ->  29,7  ->  30,8  ->  31,8

so the pet moves on every turn it gets and takes none of the early exits
(dog_hunger, appr == -2). The per-keystroke trace looked static only because
few keys in this session consume a turn.

The real difference is the PATH. Hero is at 28,7 throughout, so those entries
are udist 2, 1, 5, 10. The divergent call is the third, at 30,8 / udist 5 —
where C's pet is already at udist >= 9, i.e. one square further right. **Our pet
detours via 29,7 (upward) before heading right; C's goes more directly.**

So the bug is in which square dog_goal/the position loop CHOOSES, not in how
often the pet acts. That is a goal or appr computation difference on the first
or second turn — early enough to trace exhaustively. Dump gx/gy, appr and the
chosen nix/niy for all four calls and compare against where C's pet demonstrably
ends up (udist >= 9 by call three).

Do not chase it through dog_goal's object scan — that scan is a SYMPTOM of
appr == 0, not the cause.

### pet_ranged_attk — ported, and why it had to wait for clear_path

`seed0102` (24 calls from a full RNG match) and `seed0105` (20) both stop at the
same place. C's trace:

    4451  rn2(4)   dog_goal(dogmove.c:575)     ok
    4452  rn2(1)   dog_move(dogmove.c:1255)    MISMATCH — ours draws rn2(100)
    4453  rnd(5)   score_targ(dogmove.c:830)

**We never call `pet_ranged_attk()` at all.** src/dogmove.c:1273 calls it from
dog_move AFTER the position loop (label `nxti:`) and BEFORE `newdogpos:`:

    if ((i = pet_ranged_attk(mtmp, FALSE)) != MMOVE_NOTHING)
        return i;

The chain and its draws:
- `pet_ranged_attk` (src/dogmove.c:889) — one `rn2(5)`, only when the pet is
  hungry (`moves > hungrytime + DOG_HUNGRY`).
- `best_target` (:838, 48 lines, no draws) — scans all 8 directions, calling
  find_targ then score_targ for each direction that yields a monster.
- `find_targ` (:796, 42 lines, no draws) — walks up to 7 squares out.
- `score_targ` (:738, 98 lines) — draws `rn2(3)` and a second `rn2(3)` ONLY
  when the pet is confused, `rn2(mtmp_lev/2+1)` only for a vampshifter, and
  **`score += rnd(5)` unconditionally**. That last one is the 4453 draw, and it
  fires once per target found.

**The catch, and why this needs care rather than a quick port:** `find_targ`
calls `m_cansee(mtmp, curx, cury)`, which is include/vision.h:42's
`clear_path()` — absent from this port. Our stub returns TRUE, so find_targ
would walk through walls and find targets C rejects, spending MORE rnd(5)s than
C rather than fewer. Porting the chain on top of a permissive m_cansee can
overshoot.

Either port `clear_path` first, or port the chain and measure both sessions
immediately — the divergence call number is the check, not the RNG total.

### The reached-unported dump is the best small-win worklist

Print it by tracing `game.unported` in the capture hook at a late keystroke:

    if (process.env.NHTRACE && keyIdx === 30)
        process.stdout.write('UNP ' + JSON.stringify([...(game.unported||[])]));

It lists only paths the corpus ACTUALLY executes, which beats guessing. For
seed0077 at key 30 it gave: merged, qtext_pronoun, moveloop_preamble
set_wear/pickup, pick_lock, onscary's Elbereth branch, dog_hunger,
mon_hates_silver, m_cansee, may_dig, lined_up, mon_would_consume_item.

Three of those are now ported exactly — `mon_hates_silver`, `dog_hunger`,
`may_dig` — each small, each neutral on the public corpus, each in the category
that took held-out screens from 43 to 77.

Five are now ported exactly: `mon_hates_silver`, `dog_hunger`, `may_dig`,
`mon_would_consume_item`, `qtext_pronoun`. Three of those turned out to affect
more than "which square gets chosen" — `dog_hunger`'s return value changes
dochug's draw count, `mon_would_consume_item` calls dogfood() which DRAWS, and
`may_dig` let pets route through solid rock. **Treat "only narrows a choice"
as a hypothesis, not a fact.**

Sizes checked for the rest, so nobody re-measures:
- `merged` — src/invent.c:814-948, **134 lines**, zero draws, plus `mergable`.
  Object stacking. No PRNG risk, but big.
- `pick_lock` — src/lock.c, **299 lines**, zero draws in the function itself.
  Reached now that `a` is wired and dispatches lock tools to it.
- `set_wear` — src/do_wear.c, **31 lines**, zero draws — but it calls
  `Ring_on`, `Armor_on`, `Boots_on`, `Helmet_on` and the rest, which have not
  been checked for draws. seed8000 matches call-for-call without it, so none of
  them draws for a Tourist's starting gear; verify per role before relying on
  that.
- `m_cansee` / `lined_up` — both need `clear_path()`, the quadrant-path vision
  walk, **absent from this port entirely**. One dependency, not two gaps, and
  it also gates m_move's ranged-attack branch.

### Where the effort is best spent next — read this before picking

Ranked by expected value, from the evidence in this file:

1. **`mkroll_launch`** (js/mklev.js:346 records it unported). A real gap with
   certain value: C spends TWO draws in `find_random_launch_coord()` that we do
   not, on any level with a ROLLING_BOULDER_TRAP. Needs `linedup()` and
   `clear_path()`. Note no public session appears to create one, so it cannot
   be verified locally — port it for held-out correctness, and expect no local
   movement.
2. **The run loop.** `g` sets `context.run` correctly now but domove
   single-steps, so C travels several squares where we take one.

   Structure, already traced so it need not be re-derived: the repeat is driven
   by **`gm.multi`**, not by `context.run` alone. `moveloop_core`
   (src/allmain.c:514) does `if (gm.multi > 0) { lookaround(); ... if
   (!gm.multi) { context.move = 0; return; } if (context.mv) { if (gm.multi <
   COLNO && !--gm.multi) end_running(TRUE); ... } }`. `lookaround()`
   (src/hack.c:3898, 162 lines, **zero draws**) is what clears `multi` when
   something interesting comes into view.

   So porting this means: `gm.multi` plumbing + the moveloop_core branch +
   `lookaround` + `end_running`. No PRNG risk anywhere in it, but it is the
   largest single piece left that has no draws, and a wrong `lookaround` moves
   the hero silently. Needs a session with room to verify, not a tail-end one.
3. **The command sweep below** — still the most reliable small-gain source.

**AVOID: the seed0105 boulder.** Four iterations, no fix, three hypotheses
dead (dig_corridor, fill_ordinary_room's random objects, mkroll_launch). It is
ONE cell on ONE session. The eliminations are recorded above; leave it.

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
| ~~`a`~~ | 232 | **DONE.** Needed a different input path per item: lock tools reach `get_adjacent_loc`, five others reach `getdir`, lamps take a turn because `use_lamp` is void. See the NOTES entry on per-keystroke state tracing |
| `r` `d` `w` | 437 | wired via getobj; the EFFECTS are unported |
| `?` | 113 | `dohelp` (src/pager.c) builds a menu and calls `select_menu(tmpwin, PICK_ONE, &selected)`, then returns ECMD_OK. Key count depends on the selection: a letter plus confirm, or a single ESC. Needs our `select_menu` to consume exactly what C's does — verify against a session that presses `?` before wiring it |
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

### dig_corridor's path arithmetic differs from C's — concrete repro

The window-rendering bugs are fixed and 23 of 44 sessions now match at step 0.
What blocks most of the rest is CONTENT, and there is now a sharp instance.

`node tools/screendiff.mjs seed0105 0` leaves ONE differing cell: C draws a
boulder (backquote, colour 12) at map <25,17>; we draw plain floor.

Measured: we DO create boulders — three of them, at <52,6>, <31,11> and
<28,3> — and every constant is right (BOULDER is 475, ROCK_CLASS, glyph
backquote). C has one at <25,17>, which is none of ours.

Boulders on an ordinary level come from exactly one place:
**src/sp_lev.c:2605**, inside `dig_corridor()` —
`if (nxcor && !rn2(50)) mksobj_at(BOULDER, xx, yy, TRUE, FALSE);`
Our js/mklev.js:1159 has that line and calls mksobj_at correctly.

So the DRAW SEQUENCE matches (RNG agrees call for call through level
generation) while the COORDINATES the corridor walk reaches between draws do
not. That is `dig_corridor`'s path arithmetic — the dix/diy stepping below the
boulder branch — diverging from C's.

**Compared, and `dig_corridor` is NOT the bug.** js/mklev.js:1128-1193 matches
src/sp_lev.c line for line: the bounds check after the step, the
`maybe_sdoor(100)` SCORR branch, the boulder branch, the dix/diy
recomputation, both direction-change arms, the straight-on test and the
final reversal. No difference.

**And the corridor was the wrong suspect entirely.** Our map at <25,17> has
`typ = 25` (ROOM), and `dig_corridor` only drops boulders on squares it is
digging as CORR. A boulder standing on ROOM floor did not come from there.

**SOURCE FOUND: `mkroll_launch`, which we record as unported.**
js/mklev.js:346 has

    case ROLLING_BOULDER_TRAP:
        note_unported_lev('mkroll_launch');

while src/trap.c:511 calls `mkroll_launch(ttmp, x, y, BOULDER, 1L)`, and that
function (src/trap.c, 34 lines) does `mksobj(BOULDER)` +
`place_object(cc.x, cc.y)` + `stackobj()`. That is C's boulder.

Ruled out on the way: `fill_ordinary_room()`'s random-object loop is not the
source — traced on seed0105, its seven rooms roll 1,0,0,2,1,1,2 and place at
<11,3> and <30,6> only, and since the RNG matches C skips the same rooms. Our
three boulders at <52,6>, <31,11>, <28,3> are dig_corridor ones in unseen
areas.

**RETRACTED — both halves of this lead are wrong. Do not follow it.**

1. `linedup(x, y, x, y, 1)` returns **FALSE** for a point against itself:
   src/mthrowu.c sets `tbx = ax - bx; tby = ay - by;` and returns FALSE
   immediately when both are zero. So the early return in
   `find_random_launch_coord()` does NOT fire on an ordinary level and its two
   draws ARE live.
2. seed0105 has no rolling-boulder trap anyway. Its traps are ttyp 15 at
   <26,19> and ttyp 3 at <46,10>, and `game.unported` contains no
   `mkroll_launch` entry — so that code path was never reached on this level
   and cannot be the source of C's boulder at <25,17>.

`mkroll_launch` is still genuinely unported (js/mklev.js:346) and worth porting
on its own merits, but it is NOT this bug.

**What is still true about the boulder**, all measured: it sits on ROOM floor
(`typ = 25`), so it is not from `dig_corridor`; `fill_ordinary_room`'s
random-object loop places only at <11,3> and <30,6> on this level with rolls
1,0,0,2,1,1,2 that C shares; and our three boulders at <52,6>, <31,11>, <28,3>
are corridor ones in unseen areas. The source remains unidentified.

--- superseded reasoning below, kept so it is not re-derived ---

**Reconciled — on an ordinary level it costs NO draws.**
`find_random_launch_coord()` (src/trap.c, 58 lines) does have two unconditional
draws, `distance = rn1(5, 4)` and `tmp = rn2(N_DIRS)`. But they sit BELOW an
early return:

    bcc.x = ttmp->tx + gl.launchplace.x;
    bcc.y = ttmp->ty + gl.launchplace.y;
    if (isok(bcc.x, bcc.y) && linedup(ttmp->tx, ttmp->ty, bcc.x, bcc.y, 1)) {
        cc->x = bcc.x; cc->y = bcc.y; return TRUE;
    }

`gl.launchplace` is `{0, 0}` in src/decl.c:484 and is only ever written by
src/sp_lev.c:4441/4452, i.e. by a des-file. On a randomly generated level it
stays zero, so `bcc` IS the trap's own square and the early return fires with
no draws — which is exactly why seed0105 matches C to call 2479 of 2499 while
we skip this entirely.

**Before implementing, verify the one assumption:** that
`linedup(x, y, x, y, 1)` returns TRUE for a point against itself. If it does,
the port is `mksobj(BOULDER)` + `place_object()` + `stackobj()` at the trap's
own coordinates, drawing nothing, and js/mklev.js:346's `note_unported_lev`
can be replaced by it. If it does not, the two draws are live and the RNG
match has another explanation.

Do NOT chase `join()` on the strength of this repro; that trail was based on
the mistaken corridor assumption. `dig_corridor` matching C exactly is still a
useful result, just not for this bug.

The repro is unchanged and still cheap: `node tools/screendiff.mjs seed0105 0`,
one cell, C has a boulder at map <25,17> and we have three boulders at <52,6>,
<31,11>, <28,3>.

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

**Measured further — seed0102 step 0 is only SIX cells away.** Run
`node tools/screendiff.mjs seed0102 0`: cursor matches, and the only
differences are rows 7-12 at **column 22**, where C has spaces and we show map
content bleeding through (`─`, `·`, `k`, `"`). The legacy text is already
rendered correctly, so this is the window's drawn EXTENT being one column
narrow, not the message content.

`compute_offx()` in js/tty/wintty.js was compared against
win/tty/wintty.c:1908 and **matches exactly**, so the bug is not where the
window starts.

Traced further: `render_page()` in js/tty/wintty.js blanks from the end of each
line to COLS, so a line that exists but is EMPTY would still blank column 22.
We show map there across **six consecutive rows (7-12)**, which means those
rows are not painted at all — our window has fewer lines than C's.

Both original candidates are now ELIMINATED:
1. Line count is fine — `questtext.common.legacy` holds **17 lines** and
   `page_capacity()` is 23, so every line is painted.
2. C does not clear a rectangle here. win/tty/wintty.c:1925 only clears when
   the window COLLAPSES (`maxrow >= rows || !menu_overlay`); otherwise it takes
   the else branch and merely clears WIN_MESSAGE.

**What is left is a one-column offset in where each line starts.** C puts a
space at column 22 on rows 7-12 (empty lines, blanked from their start); we
never touch column 22, so the map shows through. Both should compute
`offx + 1`, so either our `offx` is 22 where C's is 21, or the window type
differs (NHW_MENU vs NHW_TEXT changes the leading-space rule in
`render_page()`).

**PROBED — the answer is a one-character-short LINE, and it is arithmetic:**

    WIN type=4 offx=22 offy=0 maxcol=57 rows=17

`offx = min(min(82, cols/2), cols - maxcol - 1) = min(40, 80 - 57 - 1) = 22`.
For C to place the window at offx 21 its `maxcol` must be **58**, so C's
longest legacy line is one character longer than ours.

That is a TEXT-CONTENT bug, not a windowing bug. Measured both sides:

- Our longest converted line is **56** chars:
  `"    Under World, where he now lurks, and bides his time."` — FOUR leading
  spaces. (Dump them by tracing `convert_line()`'s return in
  `deliver_by_window()`.)
- C's rendered row 7 shows that same sentence indented one column further,
  i.e. **five** leading spaces, 57 chars.

57 + 1 = maxcol 58 -> offx 21.

**Checked and ruled out: the generated data is faithful.** `dat/quest.lua:145`
holds `[    Under World, where he now lurks, and bides his time.]` with FOUR
leading spaces, exactly as js/quest_data.js has it. So no space was lost in
generation and `convert_line()` is not trimming.

**Remaining candidate — a placeholder expansion.** `dat/quest.lua:147` is
`Your %G %d seeks to possess the Amulet, and with it`. `%G` and `%d` expand to
the deity's title and name, and if C's expansion is one character longer than
ours that line becomes the longest and sets maxcol 58.

Next step is a MEASUREMENT, but **the obvious way to take it does not work** —
noted here so the next attempt does not lose an iteration to it as this one did.

Reading `segments[0].steps[0].screen` and joining each row's cells gives row
lengths that disagree with what `tools/screendiff.mjs` renders (row 0 came out
39 characters where screendiff shows 56). The cell accessor is dropping
content: the rows are not plain strings and the per-cell shape is not simply
`{ch}` or `[ch]`. **Find the real cell shape first** — read how
`tools/screendiff.mjs` itself decodes a row and reuse that, rather than guessing
at `c.ch ?? c[0]`.

Once rows decode correctly: print C's per-row rendered length beside our
`convert_line()` output length for the same line, and find the single row that
differs by one. The `%G`/`%d` expansions on `dat/quest.lua:147` are the
candidate; the indented prose is ruled out (it matches the Lua byte for byte).

Note the +1: our `maxcol` came back 57 for a 56-char line, so tty_putstr already
adds one. C does the same, which is why 57 -> 58 rather than 57 -> 57.

Everything downstream follows from that single character: maxcol 57 -> 58 moves
offx 22 -> 21, which paints column 22 and closes all six remaining cells. The
same window opens 32 of the 44 sessions.

Six cells is the entire remaining gap on this screen, and the same window opens
32 of the 44 sessions.

Note also win/tty/wintty.c:1921 — inside the same function, BEFORE painting:
`if (ttyDisplay->toplin == TOPLINE_NEED_MORE) tty_display_nhwindow(WIN_MESSAGE,
TRUE);`. That is a real `more()` trigger, but it cannot fire at startup because
nothing has been plined yet when the legacy pager runs.

**Where a `--More--` DOES belong**, in C's order, is after printing the
messages C prints and letting `update_topl` produce it on its own:
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

## Where the 44 sessions actually diverge (aggregate, re-run this)

The single most useful targeting instrument in the repo, and it did not exist
before. One line, ~3 minutes:

    for f in sessions/*.session.json; do
        node tools/diverge.mjs "$f" 2>/dev/null | grep -m1 MISMATCH | sed 's/.*@ //'
    done | sort | uniq -c | sort -rn

Current standing:

       6  dog_move(dogmove.c:1255)
       4  obj_resists(zap.c:1469)
       4  mksobj_init(mkobj.c:1001)
       4  getbones(bones.c:645)
       3  rnd_otyp_by_namedesc(objnam.c:3522)
       3  makelevel(mklev.c:1350)
       3  distfleeck(monmove.c:538)
       2  next_ident(mkobj.c:521)
       2  mount_steed(steed.c:341)

Read it as "which C function is executing when we first disagree", NOT as
"which function is unported" -- the tag names the C function containing the
divergent source line, and our code is often correct there while the STATE
reaching it is wrong. dog_move + obj_resists + distfleeck is one cluster,
14 of 44 sessions, all pet behaviour.

USE IT AS THE BEFORE/AFTER, not just the picker. Removing the duplicate
pet_ranged_attk call moved distfleeck from 4 sessions to 3 while the advisory
RNG proxy went DOWN 78. The aggregate said "one session now diverges strictly
later" and the proxy said "worse"; the aggregate was right and the change was
provably correct against C, which has exactly one call site (dogmove.c:1273).
When the two disagree, trust the divergence point.

## dog_eat landed, and the cluster did NOT move

dog_nutrition, dog_eat, splitobj, nextoid and oid_price_adjustment are ported
(commit "Port dog_nutrition, dog_eat, ..."). The bug was real and worth
fixing: dog_move's eat branch returned MMOVE_NOTHING, so a pet that decided
to eat froze in place while C's walked onto the food.

It did not move the aggregate. dog_move(dogmove.c:1255) is still 6 sessions,
screens still 482, and the proxy moved -9. Instrumenting dog_eat shows it is
called ZERO times in seed0030 and seed8000, so the branch is simply not
reached in those; the -9 means it does fire somewhere in the other 42.

So dogmove.c:1255 is NOT blocked on the eat branch. That line is the square
scoring test, `(j == 0 && !rn2(++chcnt)) || j < 0 || (j > 0 && !whappr && ...)`,
and our copy of it matches C term for term and in order -- checked. What
differs is the STATE it scores with: appr, nidist, cnt, uncursedcnt, mtrack,
and the mfndpos candidate list.

NEXT ACTION for this cluster: stop reading the scoring test and start dumping
its inputs. For one of the six sessions, print appr, cnt, uncursedcnt and the
candidate (nx,ny) list on the turn of the first mismatch, and compare against
what C must have had for its pet to end up where the recorded screen shows it.
appr comes from dog_goal, which is where the earlier measurements pointed
(goal chosen on only 9% of turns), so appr is the first input to check.

Do NOT port more dogmove functions speculatively. Two ports in a row now have
been faithful, correct, and worth zero, because the cause was upstream state
rather than a missing function. The aggregate above is cheap; run it before
and after anything, and let it, not the RNG proxy, decide whether to keep.

## THE NEXT THING TO PORT: uhitm.c do_attack, the pet-displacement path

After the lamp fix, the first-mismatch aggregate is:

       6  dog_move(dogmove.c:1255)
       4  obj_resists(zap.c:1469)
       4  getbones(bones.c:645)
       4  do_attack(uhitm.c:474)        <-- newly surfaced
       3  rnd_otyp_by_namedesc(objnam.c:3522)
       3  makelevel(mklev.c:1350)
       3  distfleeck(monmove.c:538)

MEASURED: there is no js/uhitm.js and no do_attack anywhere in the tree. The
hero's melee and displacement code is entirely absent. Our domove (js/cmd.js:537)
has NO m_at() check at all: it tests closed_door, then blocksMove, then moves
the hero. The hero walks straight THROUGH monsters, drawing nothing.

C's path when the hero steps onto a pet or peaceful (uhitm.c:462 onward):

    if (is_safemon(mtmp) && !svc.context.forcefight) {
        if (!u_wield_art(ART_STORMBRINGER)) {
            boolean foo = (Punished || !rn2(7)
                           || (is_longworm(mtmp->data) && mtmp->wormno)
                           || (IS_OBSTRUCTED(levl[u.ux][u.uy].typ)
                               && !passes_walls(mtmp->data))), ...
            if (inshop || foo) {
                if (mtmp->mtame) monflee(mtmp, rnd(6), FALSE, FALSE);
                You("stop.  %s is in the way!", buf);
                return TRUE;
            } else if (mtmp->mfrozen || helpless(mtmp)
                       || (mtmp->data->mmove == 0 && rn2(6))) {
                pline("%s doesn't seem to move!", Monnam(mtmp));
                return TRUE;
            } else
                return FALSE;   /* caller swaps hero and pet */

Three draws on a path the hero takes constantly: rn2(7) every time, then
rnd(6) or rn2(6) depending on the arm.

HYPOTHESIS, NOT ESTABLISHED, and worth stating because it would tie the top
two entries together: if the hero never displaces the pet, the pet ends up on
a different square from C's, and dog_move then scores its candidate squares
from the wrong place. That would make do_attack the upstream cause of the
dog_move(dogmove.c:1255) cluster as well, 10 of 44 sessions between them, and
it fits the seed0030 evidence recorded further up this file, where our pet was
ADJACENT to the hero and C's was twelve columns away.

Do not treat that as proven. The cheap test is to port only the displacement
path, then re-run the aggregate: if dog_move drops below 6, the link is real.

SCOPE IT SMALL. Do not port all of uhitm.c. The reachable path needs
is_safemon, the foo test, monflee, and the hero/pet position swap in domove.
attack_checks and everything past it is the actual combat code and is a
separate job; a hostile monster can keep hitting note_unported.

PATH CONFIRMED LIVE (probe added to domove, counted m_at hits, then reverted):

    seed0030-ten-diverse-deaths   tame 16   hostile 19
    seed4500-knight-coverage      tame  0   hostile  1
    seed8000-tourist-starter      never steps onto a monster at all

So the displacement path is taken sixteen times in a single session, each one
an rn2(7) we never draw plus a hero/pet swap we never perform. Note the third
line: seed8000 is the ONE session that currently passes, and it is also the
one that never steps onto a monster. That is consistent with this being a real
and widely-taken gap rather than a rare corner.

The hostile counts are the separate, larger job (attack_checks and the combat
code). The tame count is the bounded one described above.

Method note, learned twice in this session: run the aggregate before and after
and let it decide, not the advisory RNG proxy. The lamp fix moved screens 482
to 492 and removed mksobj_init from the aggregate entirely. Two faithful ports
before it (mk_trap_statue, dog_eat) moved nothing, because a correct port of a
function that is never reached is worth exactly zero. Check that the code you
are about to write is on a path the sessions actually take -- instrumenting a
function with a counter and running one session costs a minute and would have
saved both of those.

## do_attack: ATTEMPTED AND REVERTED. Read this before trying again.

The displacement port described in the entry above was written in full and
backed out. Everything below is measured, and it saves the next attempt the
whole dead end.

WHAT WAS BUILT (all reverted, tree is clean at 492 screens / 136523 RNG):
js/uhitm.js with do_attack's is_safemon branch; mon_visible, sensemon,
canseemon, canspotmon and is_safemon added to js/display.js (their C home,
include/display.h plus display.c:215); domove_attackmon_at and
domove_swap_with_pet next to domove in js/cmd.js; exports for helpless,
verysmall and goodpos.

THE ONE FINDING WORTH KEEPING, verified from include/optlist.h:634:

    On, Yes, No, No, NoAlias, &flags.safe_dog, Term_False,

flags.safe_dog ("safepet") DEFAULTS ON. We never set it, so game.flags.safe_dog
is undefined. That single fact controls the whole path: is_safemon() is
`flags.safe_dog && mpeaceful && canspotmon && !Confusion && !Hallucination
&& !Stunned`, so with safe_dog unset is_safemon is ALWAYS FALSE and every step
onto a pet falls through to the combat code instead of swapping.

THE MEASUREMENTS, in order, because the direction is the diagnostic:

    baseline                              492 screens   136523 rng
    wiring in, safe_dog left unset        468 (-24)     133326 (-3197)
    wiring in, safe_dog = true            244 (-224)     81625 (-51701)

Read that carefully. With safe_dog unset, do_attack always reached the
`note_unported('do_attack:combat'); return true;` arm, so the hero's move was
consumed and it never stepped onto a monster at all: -24 screens is the cost
of blocking a move the hero should make. Turning safe_dog on ENABLED the swap
path and made things ten times worse, which means the swap itself is wrong,
not merely absent. That is the useful signal: the bug is inside
domove_swap_with_pet or in where domove calls it, NOT in is_safemon or in
do_attack's rn2(7).

RULED OUT, so do not re-check these:
  - blocksMove (js/cmd.js:94) does NOT test for monsters, so it was not
    swallowing the move before the swap could run.
  - u.ux0/u.uy0 are set by domove before the swap call, so they were not stale.
  - goodpos draws only for S_EEL, so it was not adding spurious draws.
  - do_attack's gate matches C: !mtmp->mundetected is true for ordinary
    monsters in both, so do_attack fires on the same steps C fires it on.

WHERE TO LOOK NEXT: our domove is in js/cmd.js, not js/hack.js, and it is a
much shorter function than C's domove_core. C runs a long sequence between the
monster check and the swap (domove_bump_mon, the ironbars fight, trap and
terrain handling, u_on_newpos) that ours does not have, and C's swap is inside
an `else if` chain whose earlier arms we do not model. Port the swap ONLY
after establishing which of C's intermediate steps our domove is missing;
grafting hack.c:2919 onto a domove that skips hack.c:2790-2918 is what failed
here.

Cheapest next experiment: land ONLY the safe_dog default plus is_safemon and
do_attack returning FALSE for a safe monster, with NO swap at all, and see
whether the hero simply walking onto the pet's square (leaving the pet in
place) scores better or worse than blocking. That isolates the swap from the
attack gate, which this attempt conflated.

## MAJOR GAP FOUND: the whole special-room subsystem is absent

This is almost certainly the largest single structural hole left, and it is
not on any milestone list. Found by chasing makelevel(mklev.c:1350), which the
first-mismatch aggregate puts at 3 sessions.

MEASURED: there is no js/mkroom.js, and mkshop, mkzoo, mktemple and mkswamp
appear NOWHERE in js/. js/mklev.js goes straight from the vault block to
place_branch, skipping src/mklev.c:1344-1376 entirely -- the "make up to 1
special room" step. We have room_threshold (js/mklev.js:571, incremented at
603 for a vault) and then never use it.

The C we skip:

    if (wizard && nh_getenv("SHOPTYPE"))            do_mkroom(SHOPBASE);
    else if (u_depth > 1 && u_depth < depth(&medusa_level)
             && svn.nroom >= room_threshold && rn2(u_depth) < 3)
                                                    do_mkroom(SHOPBASE);
    else if (u_depth > 4  && !rn2(6))               do_mkroom(COURT);
    else if (u_depth > 5  && !rn2(8) && leprechauns_left)  do_mkroom(LEPREHALL);
    else if (u_depth > 6  && !rn2(7))               do_mkroom(ZOO);
    else if (u_depth > 8  && !rn2(5))               do_mkroom(TEMPLE);
    else if (u_depth > 9  && !rn2(5) && killer_bees_left)  do_mkroom(BEEHIVE);
    else if (u_depth > 11 && !rn2(6))               do_mkroom(MORGUE);
    else if (u_depth > 12 && !rn2(8) && antholemon())      do_mkroom(ANTHOLE);
    else if (u_depth > 14 && !rn2(4) && soldiers_left)     do_mkroom(BARRACKS);
    else if (u_depth > 15 && !rn2(6))               do_mkroom(SWAMP);
    else if (u_depth > 16 && !rn2(8) && cockatrices_left)  do_mkroom(COCKNEST);

WHY IT IS URGENT, and this is the part worth reading carefully. Work the
arithmetic at shallow depth rather than assuming special rooms are a deep-level
concern:

  depth 1: the first arm fails on `u_depth > 1` and every later arm fails on
           its depth test. NOTHING is drawn. Our level 1 is therefore correct,
           which is exactly why seed8000-tourist-starter still passes.

  depth 2: `u_depth > 1` passes, `u_depth < depth(medusa_level)` passes (medusa
           is around 21-24), and then `rn2(2) < 3` is ALWAYS TRUE, because
           rn2(2) is 0 or 1 and both are less than 3. So at depth 2, whenever
           nroom >= room_threshold, C ALWAYS MAKES A SHOP.

So this is not a rare deep-level feature. The shop arm's probability is
rn2(u_depth) < 3, i.e. min(1, 3/u_depth):

    depth 2   always      depth 5   3/5        depth 16  3/16
    depth 3   always      depth 10  3/10       depth 20  3/20

Depths 2 and 3 make a shop EVERY time nroom >= room_threshold.

MEASURED with a probe on our own makelevel (since reverted), printing depth,
nroom and room_threshold per level generated:

    seed0030-ten-diverse-deaths   depth=1 x many        shoparm never fires
    seed4500-knight-coverage      depth 1, 5, 10, 20    fires at 5, 10, 20
    seed0360-wizard-world-tour    depth 1, 16, 18, 2    fires at 16, 18, 2

Two things to take from that. First, nroom >= room_threshold held in EVERY
case where depth > 1, so the room-count gate is not what saves us. Second,
and this corrects the paragraph above: seed0030 generates only depth-1 levels,
so this gap does not touch it at all. Sessions that stay on level 1 are
unaffected, which is a different and smaller claim than "every session".

The cost when it does fire is the rn2(u_depth) draw plus the whole of mkshop:
the shop-type selection, the door placement, and one mkobj per square of
stock.

SCOPE. This is a real subsystem, not a one-liner, and it should get its own
session with a fresh context:
  - js/mkroom.js, new file mirroring src/mkroom.c
  - do_mkroom (src/mkroom.c:52), the dispatch, small
  - mkshop + shop stocking, the big one and the only one needed for depth 2-4
  - mkzoo, mktemple, mkswamp for depth 5+
  - the chain itself wired into makelevel between the vault block and
    place_branch, in that exact position

ORDER OF WORK: port the chain's CONDITIONS and mkshop first and measure. Do
not port mkzoo/mktemple/mkswamp until the shop path is verified, since the
sessions reach depth 2 far more often than depth 9. Confirm with the aggregate
before and after, per the method note above.

DO NOT port the conditions alone as a way to "get the draws right". The rn2
would land correctly and then mkshop's absence would desync a few calls later,
which reads as progress on the RNG proxy while leaving the level wrong.

## Special-room subsystem: LANDED (except mktemple)

The gap recorded above is closed apart from one arm. js/mkroom.js now exists
with do_mkroom, mkshop, pick_room, mkzoo, mkswamp, isbig, has_dnstairs,
has_upstairs, invalid_shop_shape, nexttodoor and the shtypes table, and the
depth-gated chain is wired into makelevel between the vault block and
place_branch, which is exactly where C has it.

    RNG 136,523 -> 140,488   (+3,965)
    screens 492, unchanged;  sessions 1/44, unchanged
    makelevel(mklev.c:1350) DROPS OUT of the first-mismatch aggregate

Nearly all of that came from mkshop and the chain conditions. pick_room and
mkzoo added 4, and mkswamp added 0, because those arms are gated on depth
greater than 4 and 15 respectively and the sessions mostly generate shallow
levels. That is the expected shape, not a disappointment: the shop arm is the
one that fires at depth 2 and 3, and it is the one that paid.

WHAT IS STILL OPEN HERE, in the order it is worth doing:

1. mktemple (src/mkroom.c:598). The last arm. NOT small: it needs shrine_pos,
   induced_align(80) which DRAWS, and priestini, which creates the temple
   priest. Gated on u_depth > 8.
2. antholemon (src/mkroom.c:502) needs ubirthday, the game start timestamp,
   which we do not model. The session JSON carries a datetime per segment, so
   the value is available in principle. Until then the ANTHOLE arm falls
   through and we draw the following rn2(4) that C does not, on levels below
   depth 12 only.
3. fill_zoo (src/mkroom.c:275) and the shop stocking. Both rooms are currently
   MARKED but not FILLED. mkshop and mkzoo only set rtype and needfill, which
   is faithful, and C stocks them at the end of makelevel through the
   fill_special_room pass we already run for the vault. VERIFY that our pass
   actually reaches these new rooms; if it does not, the levels have empty
   shops and zoos and the divergence will show up as missing objects and
   monsters rather than as a missing draw.

Item 3 CHECKED, and it found two bugs in the port that had just landed. See
the commit "Fix two wrong lookups in invalid_shop_shape". mkshop was returning
without making a shop on EVERY level, because invalid_shop_shape read
game.doors (the array is game.level.doors) and compared square types against a
hardcoded ROOM_TYP = 20 written from memory. ROOM is 25; 20 is LAVAPOOL. So
insidect was always 0 and every candidate room was rejected.

That is the NOTES entry "Never infer a constant's value from its name" being
violated by the same session that wrote it. The lesson that generalises: after
landing a subsystem, PROVE it does its work rather than trusting the score to
tell you. RNG went UP 3,961 on a mkshop that never once made a shop; the whole
gain was the chain's condition draws. One stderr counter in mkshop showed the
truth in a minute.

Shops are now genuinely created (+265 more RNG on top).

## NEXT: stock_room, i.e. shops are MARKED but still EMPTY

This is now the live end of the special-room work, and it is a screen problem
rather than only an RNG one: a shop with no stock and no shopkeeper renders
as an empty room.

js/sp_lev.js fill_special_room() reaches the shop branch and calls
note_unported('stock_room'). The comment there claiming it "is not reached by
any session" has been corrected; it IS reached now.

THE CHAIN, sized by reading it (src/shknam.c):

    stock_room           84 lines   shknam.c:718
    shkinit              65 lines   shknam.c:628   places the shopkeeper
    mkshobj_at           30 lines   shknam.c:454   one object per square
    stock_room_goodpos   20 lines   shknam.c:695   no RNG, pure geometry

Order matters: stock_room RETURNS EARLY on `if ((sh = shkinit(shp, sroom)) < 0)
return;`, so shkinit cannot be skipped or stubbed to get the objects working.

THE GOTCHA THAT WILL BITE, found while reading mkshobj_at. It calls
get_shop_item(), which reads the iprobs sub-table of shtypes[] -- the
`{ { 90, ARMOR_CLASS }, { 10, WEAPON_CLASS }, ... }` block in each entry.
js/mkroom.js's shtypes carries ONLY name, symb and prob, because that is all
mkshop needed. Extending that table is step one, and it should be regenerated
from src/shknam.c rather than hand-copied, since it is six pairs per entry
across twelve entries.

Draws per stocked square, so the order is load-bearing: mkshobj_at draws
rn2(100) FIRST, and only if that fails to make a mimic does it call
get_shop_item and then mkobj_at/mksobj_at. A port that picks the item first
and checks for a mimic afterwards would look equivalent and desync on every
shop square.

Also needed: mkveggy_at for the VEGETARIAN_CLASS arm, and make_engr_at for the
"Closed for inventory" engraving on a locked shop door (the engraving
subsystem is absent, so that arm should be recorded rather than faked).

DONE SINCE: js/shknam.js now exists with shtypes (moved out of js/mkroom.js,
which was the wrong home) carrying the full iprobs sub-table, plus
get_shop_item. get_shop_item is COMPLETE BUT UNCALLED -- its caller
mkshobj_at is gated behind shkinit. Shops are still marked and empty.

SHKINIT, read in full (src/shknam.c:628). Three things in it are not obvious
and each is a draw:

  1. mkmonmoney(shk, 1000 + 30 * rnd(100)) -- the shopkeeper's starting
     capital. One rnd(100), unconditional.
  2. The mongets block is gated on the shop's SHKNMS field, which js/shknam.js
     does NOT yet carry:

         if (shknms == shktools || shknms == shkwands
             || (shknms == shkrings && rn2(2))
             || (shknms == shkgeneral && rn2(5)))
             mongets(shk, SCR_CHARGING);

     So a ring shop draws rn2(2) and a general store draws rn2(5), and a tools
     or wand shop draws NEITHER because the first two disjuncts short-circuit.
     Getting shknms wrong changes which draw happens, not just which item.
     A ring shop also gets a TOUCHSTONE, with no draw.
  3. nameshk(shk, shp->shknms) picks the shopkeeper's name from that list and
     DRAWS. The twelve name arrays have to be carried for this.

good_shopdoor() is the other missing piece and it decides the shopkeeper's
square, so it is positional as well as a gate: shkinit returns -1 when it
fails, and stock_room returns immediately on that, leaving the shop empty.

NAMESHK, read in full, and the result is better than feared. It looks like a
blocker because it needs ubirthday, which we do not model:

    int nseed = (int) ((long) ubirthday / 257L);
    name_wanted += ledger_no(&u.uz) + (nseed % 13) - (nseed % 5);
    if (name_wanted < 0) name_wanted += (13 + 5);
    shk->female = name_wanted & 1;
    for (names_avail = 0; nlp[names_avail]; names_avail++) continue;
    name_wanted = name_wanted % names_avail;
    for (trycnt = 0; trycnt < 50; trycnt++) {
        if (nlp == shktools) { shname = shktools[rn2(names_avail)]; ... }
        else if (name_wanted < names_avail) { shname = nlp[name_wanted]; }
        else if ((i = rn2(names_avail)) != 0) { ... }

Work the control flow. `name_wanted = name_wanted % names_avail` makes
name_wanted ALWAYS less than names_avail, so for any shop that is not a tools
shop the second arm is taken on the FIRST iteration and NOTHING IS DRAWN.
Only a tools shop draws, and it draws exactly one rn2(names_avail).

So ubirthday decides WHICH NAME appears, which is a screen difference, but it
does not change the DRAW COUNT for any shop except a tools shop, and even
there the count is fixed at one. shkinit can therefore be ported RNG-faithfully
now, with the chosen name recorded as depending on unmodelled ubirthday. That
is a much smaller blocker than antholemon's, where the unmodelled value gates
whether an arm fires at all.

The name lists still have to be carried for the tools-shop draw to have the
right modulus: names_avail is the list LENGTH, so a wrong list length is a
wrong rn2 argument. Lengths measured from src/shknam.c:

    shkliquors 30   shkbooks 26   shkarmors 30   shkwands 31   shkrings 32
    shkfoods 32     shkweapons 31  shktools 67   shklight 32   shkgeneral 30
    shkhealthfoods 31

shktools at 67 is the one that matters most, since it is the only list whose
length feeds an rn2.

ORDER: generate the shknms name lists into js/shknam_data.js with a
tools/gen-shknam.mjs, following the repo convention for data tables rather
than hand-copying ~370 names, and add the shknms field to shtypes. Then
good_shopdoor, then shkinit, then stock_room_goodpos and mkshobj_at, then
stock_room itself. Verify with a stderr counter that a shop actually gets
stock, exactly as the mkshop bug above was caught -- do not trust the RNG
number to tell you.

## Shop stocking: LANDED. Shops now have a shopkeeper and stock.

stock_room, shkinit, good_shopdoor, nameshk, stock_room_goodpos, mkshobj_at
and get_shop_item are ported, and tools/gen-shknam.mjs generates
js/shknam_data.js (11 lists, 372 names, plus the shknms of each shtypes entry).
fill_special_room's shop branch calls stock_room instead of note_unported.

VERIFIED BY PROBE, not by the score: seed4500's general store places 32
objects where it previously placed none. Do this every time; it is what caught
the mkshop bug one entry above.

    RNG 140,753 -> 140,717  (-36, and NOT explained; see below)
    screens 492, unchanged; aggregate unchanged

THE -36 IS AN OPEN LOOSE END. Checked and ruled out: depth() matches
src/dungeon.c:1431 exactly, and the specialspot comparison matches C's
`((stockcount) && (stockcount == specialspot))`. Not chased further. The
likeliest remaining suspects, in order:
  1. mkveggy_at / shkveg, unported. Only the health food store (prob 2/100)
     routes through VEGETARIAN_CLASS, so it should be rare, but shkveg draws
     an rnd(maxprob) that we never spend when it IS hit.
  2. The mimic path in mkshobj_at: mkclass(S_MIMIC, 0) and its makemon.
  3. mkobj_at / mksobj_at behaviour for shop stock specifically, since these
     are called with init and artif TRUE in a context nothing else used.
NARROWED (probe on each recorded hole, since reverted). Across seed4500 and
seed0360:

    mkveggy_at   0 hits
    rloc         0 hits
    engraving    0 hits
    mimic path   5 hits   (4 in seed4500, 1 in seed0360)

So suspects 1 and the engraving are OUT: those holes are never reached, and
the -36 is entirely inside the mimic path. Five hits, thirty-six draws, is
about seven draws each, which is the right order for mkclass plus makemon.

Probing further, mkclass(S_MIMIC, 0) returns a valid permonst on every hit
(pmidx 64 each time), so it is not failing and falling through to the
get_shop_item branch, which was the obvious guess.

MKCLASS RULED OUT. Compared js/makemon.js mkclass_aligned against
src/makemon.c term for term: same init_mongen_order and MONSi indirection,
same rn2(9) hell-only gate, same rn2(2) montoostrong reject, same
rnd(num) final walk, in the same order. It is not the divergence.

So the residual is in the makemon() that FOLLOWS the mkclass, called as
makemon(ptr, sx, sy, NO_MM_FLAGS) from mkshobj_at. That is a heavily-shared
function, so the difference is more likely in a branch that only a shop-square
mimic reaches than in makemon's common path, which many other call sites
already exercise correctly.

NEXT: dump our rn2/rnd sequence across ONE of those five makemon calls and
diff it against the recorded log at the same call index (tools/diverge.mjs
prints the index). Do not re-check mkclass.

STILL OPEN in the special-room area:
  - mktemple (src/mkroom.c:598): needs shrine_pos, induced_align which DRAWS,
    and priestini. Gated on u_depth > 8.
  - antholemon (src/mkroom.c:502): needs ubirthday. Unlike nameshk, here the
    unmodelled value gates whether the arm fires, so it changes draw counts.
  - fill_zoo (src/mkroom.c:275): mkzoo MARKS rooms but fill_special_room does
    not yet fill COURT/ZOO/BEEHIVE/ANTHOLE/COCKNEST/MORGUE/BARRACKS. Same
    shape of gap stock_room just closed for shops, and the same test applies:
    probe that a zoo actually gets monsters.

    SCOPED. fill_zoo is ~120 lines and, unlike mkshop, its dependency set is
    mostly ABSENT. Checked:

        have    make_grave, somexyspace, occupied   (js/mklev.js)
        have    mkgold                              (js/mkobj.js)
        MISSING courtmon, squadmon, morguemon, mk_tt_object, sq

    The three *mon() functions each pick a species and DRAW, so they are not
    optional decoration: courtmon backs COURT, squadmon backs BARRACKS,
    morguemon backs MORGUE. mk_tt_object backs both the MORGUE corpse and the
    COCKNEST statue.

    Per-square draws, which is where the volume is. Every eligible square runs
    one makemon with MM_ASLEEP|MM_NOGRP, then a per-type tail:
        ZOO, LEPREHALL   mkgold(rn1(i, 10)) with i from the door distance
        MORGUE           rn2(5), rn2(10), rn2(3), rn2(5)
        BEEHIVE          rn2(3)
        BARRACKS         rn2(20), rn2(3)
        COCKNEST         rn2(3)
    So a MORGUE spends four rn2 per square on top of the makemon. Getting the
    tail order wrong desyncs every square of the room.

    ORDER: courtmon, squadmon, morguemon and mk_tt_object first, since
    fill_zoo cannot run without them, then fill_zoo itself, then wire it into
    fill_special_room's switch beside the shop branch. antholemon still gates
    the ANTHOLE arm and is still blocked on ubirthday.

## Special-room area: now complete except mktemple and antholemon

fill_zoo landed (commit "Port fill_zoo with courtmon, morguemon, squadmon and
mk_tt_object"), verified by probe: seed4500 fills a leprechaun hall, seed0360
a zoo. RNG 140,717 -> 140,719, screens 492.

State of the whole area:

    do_mkroom chain in makelevel   DONE
    mkshop + pick_room + mkzoo     DONE
    mkswamp                        DONE
    stock_room + shkinit + nameshk DONE   (shops stocked, verified by probe)
    fill_zoo + the species pickers DONE   (zoos filled, verified by probe)
    antholemon                     DONE   (see below; ubirthday finessed)
    mktemple + priestini           DONE

THE SPECIAL-ROOM AREA IS COMPLETE. Every arm of do_mkroom is ported and every
marked room is filled. Remaining holes inside it are individually recorded
through game.unported and none of them gates a draw: rloc's insurance case,
the sanctum Amulet arm, uncurse's artifact-light bookkeeping, ndemon in
morguemon's deep arm, the maze-level throne rescan, mkveggy_at/shkveg, and
nameshk's chosen NAME (its draw count is unaffected, see below).

Both remaining items are genuinely blocked rather than merely unstarted:

  mktemple (src/mkroom.c:598) is the last one, gated on u_depth > 8. SCOPED,
  with every dependency checked rather than guessed:

    shrine_pos      (mkroom.c:577)   20 lines. Draws rn2(2) TWICE, but only
                                     when the room's width/height delta is
                                     odd. Trivial, no missing deps.
    induced_align   (dungeon.c:1999) 17 lines. Draws rn2(100) only when the
                                     level or dungeon carries an align flag,
                                     then rn2(3) unconditionally. For an
                                     ordinary dungeon level it is just
                                     rn2(3) - 1 through Align2amask, which
                                     js/const.js already has.
    priestini       (priest.c:220)   57 lines. THE BLOCKER.

  priestini's draws, in order: rn2(N_DIRS) for the starting direction, then
  makemon(MM_EPRI), then rn1(3, 2) for the spellbook count with one
  mkobj(SPBOOK_no_NOVEL, FALSE) per book, then rn2(2) for the robe. Missing
  dependencies: pm_good_location, p_coaligned, uncurse. Present: mpickobj,
  which_armor, curse, Amask2align, SPBOOK_no_NOVEL.

  DO NOT port mktemple with priestini left as a note_unported. The altar and
  the shrine would render, so it would look like progress, while every one of
  the draws above went missing and desynced the rest of the level. Either the
  whole chain lands or none of it does. This is the same trap as porting the
  special-room chain's conditions without mkshop, warned about further up.

  Rough order once started: pm_good_location, p_coaligned and uncurse first
  (all small), then priestini, then induced_align and shrine_pos, then
  mktemple, then flip do_mkroom's TEMPLE arm. Probe that a temple actually
  gets a priest, the same way the shop and zoo fills were confirmed.

  antholemon is DONE, and the reasoning is worth reusing (NOTES has it as a
  general entry). ubirthday is genuinely not derivable -- the recorder builds
  it with mktime() in the RECORDING MACHINE'S timezone with tm_isdst from the
  real recording moment -- but antholemon uses it only as `% 3`, and every
  timezone offset is a multiple of 1800, which is divisible by 3. So the
  offset cannot change the answer. Computed from game.fixed_datetime, which
  the runner already threads through, so it holds for any recording timezone
  rather than just the one behind the public sessions.

  Do NOT try the same trick on nameshk: it divides by 257 and has no such
  invariance. Its draw count was already shown to be unaffected, so only the
  displayed name stays unported.

The gains from this whole area were concentrated in ONE place. mkshop and the
chain conditions paid ~3,961; pick_room and mkzoo paid 4; mkswamp 0; fill_zoo
2. That is the depth gating: the shop arm fires at depths 2 and 3, everything
else at depth 5 and below, and the sessions mostly generate shallow levels.
Worth remembering before spending a session on a deep-level subsystem.

Open loose end still unresolved: the -36 in the shop stocking, narrowed to
mkclass(S_MIMIC, 0) and its makemon. See the entry above for what was ruled
out.
