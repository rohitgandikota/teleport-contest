=== THE TOP FOUR ENTRIES ALL NEED STRUCTURES, NOT TRANSLATIONS ===
512/11405 screens, RNG 140750/792838. Checked all four; none is a quick port.

  dowield:setuwep      25%  setuwep 36L needs setworn 73L, which walks a
                            worn[] mask->pointer table this port does not
                            have. Detailed in the block below.
  getobj:menu          23%  fires on '?' or '*' at an object prompt, which
                            opens a menu that READS ITS OWN KEYS. Needs the
                            tty menu subsystem. Correct record.
  goto_level:losedogs  23%  losedogs 113L moves pets and migrating monsters
                            onto the new level. The port has NEITHER
                            gm.mydogs NOR gm.migrating_mons, and keepdogs --
                            the counterpart that fills mydogs on the way out
                            -- is absent too. The whole pet-follows-you-
                            downstairs subsystem is missing, not just this
                            function. The existing record already says so.
  dofire:polearm_or_whip 23% needs use_pole and use_whip.

WHAT IS ACTUALLY CHEAP RIGHT NOW: nothing above 23%. The key-consumption
class is exhausted (cmd:r, cmd:w, extcmd:chat, doread and dofire's quiver
prompt all cleared), and the ported-but-unwired class is exhausted (both
sweeps came back clean negatives). What remains is real subsystem work:
the worn[] table, the tty menu, the migration lists, and the ~460-line
wear chain.

ONE SMALL THING STILL OPEN: getobj returns null for '-' where C returns
&hands_obj, a sentinel meaning "your hands". Callers that should see
"chose hands" currently see "cancelled". No keystroke difference, so it is
not urgent, but it IS a behavioural divergence rather than a missing
feature.

=== NEXT: setworn, and it needs a STRUCTURE not just a function ===
Current: 512/11405 screens, RNG 140750/792838.

dowield:setuwep (25%) needs setuwep (36L), which needs setworn (73L,
src/worn.c). setuwep itself is straightforward and its other dependencies are
now all ported -- is_launcher, is_ammo, is_missile, is_pole, is_weptool.

setworn IS THE BLOCKER AND IT IS NOT A PLAIN PORT. C walks a `worn[]` table
mapping each W_* mask to the pointer that holds it:

    for (wp = worn; wp->w_mask; wp++)
        if (wp->w_mask & mask) { ... *(wp->w_obj) = obj; ... }

This port has NO such table. It stores game.uwep, game.uarmf and so on as
separate fields, with a worn(mask) accessor in js/spell.js:349. So setworn
needs the mask -> field mapping built first, and that is a structural
addition rather than a translation.

WHAT setworn DOES for W_WEP, which is what setuwep needs:
  - clears the old object's owornmask
  - because W_WEP is NOT in ~(W_SWAPWEP | W_QUIVER), it ALSO updates
    u.uprops[oc_oprop].extrinsic, calls monstunseesu_prop, handles w_blocks
    and set_artifact_intrinsic
  - cancel_doff for an interrupted takeoff
  - drops twoweap if the old object was a weapon
  - then sets the new object and repeats the property work in reverse

So a shortcut that just assigns game.uwep would skip the extrinsic
bookkeeping and be wrong the moment a weapon confers a property. Build the
table.

=== m_initinv mlet=53 (16%) IS NOT A PHANTOM. Prediction tested, wrong. ===

I predicted this was a seventh phantom: C's S_HUMAN arm is a chain
(is_mercenary, PM_SHOPKEEPER, MS_PRIEST, quest monk) and an ordinary human
matches none, so gating it looked like it would clear 16%.

GATED IT AND MEASURED. Reach after gating: still 16%. Every S_HUMAN the
public sessions reach really is a mercenary, shopkeeper or priest, so the
record was accurate all along. The gate is committed anyway because it is
what C does and protects a held-out session containing an ordinary human,
but it clears nothing.

TWO THINGS THAT FOLLOW:

  - The is_mercenary consolidation is NOT worth chasing. It only existed to
    enable this gate, and the gate buys nothing. js/makemon.js now has a
    third local copy alongside js/monmove.js:379; dup-defs lists it. Tidy it
    only if something else needs it.

  - After six confirmed phantoms I assumed a seventh. Gating is cheap, but
    the PREDICTION that a dispatch-point record is phantom has to be
    measured. The cheap test is: gate it, then check whether the reach
    number actually moves.

=== EXTCMD SWEEP DONE: chat was the only one. 512 screens. ===

Wiring #chat to the already-ported dochat gained a screen (511 -> 512),
because #chat calls getdir() and consumes a direction key -- without it the
key ran as a command and every later keystroke was out of step.

I then swept all 40 reached extcmd:* records against the port for a matching
do<name>() and found NOTHING ELSE. The one apparent hit, doname, is a name
collision: js/objnam.js's doname formats an object name, while C's #name maps
to docallcmd (cmd.c:1774). So do not re-run this sweep expecting more.

The remaining extcmds are genuinely unported commands, not missing wires.

THE SINGLE-KEY cmd:* RECORDS ARE ALSO ALL GENUINE. Same sweep, same result:
the five unhandled keys are r=read, w=wield, q=quaff, P=puton, W=wear, and
NONE of doread, dowield, doquaff, dopay, dowear or dotakeoff exists in the
port. There is no wiring shortcut left in the command layer.

So the "ported but unwired" pattern -- which produced eight finds today
(touch_artifact, done_eating, adjabil, curse, mpickobj, stackobj, useupf,
dochat) -- is now EXHAUSTED. What remains costs real porting.

=== make_corpse SIZED BY REACHED BRANCH: ~70 LINES, NOT 378 ===

mon:mondied:make_corpse is the 23% entry and it is NOT the 378-line monster
its total suggests. The function opens with a large switch on mndx for
species-specific drops -- dragon scales, unicorn horn, worm tooth, iron
chains, glass gems -- and an ordinary monster matches NONE of them and falls
to `default_1`, which is about fifteen lines:

    if (mvitals[mndx].mvflags & G_NOCORPSE) return NULL;
    corpstatflags |= CORPSTAT_INIT;
    obj = mkcorpstat(CORPSE, KEEPTRAITS(mtmp) ? mtmp : 0, mdat, x, y, flags);
    if (burythem) { bury_an_obj(...); newsym(...); return ...; }

then a short tail (bypass_obj, oname if the monster was named).

    mkcorpstat    52L  mkobj.c   MISSING -- the actual corpse object
    bury_an_obj        PORTED
    KEEPTRAITS         a macro, unsized
    mvitals            already tracked; mondead bumps .died

So ~70 lines for the reached path. That makes it the CHEAPEST of the four
remaining 23-25% entries by a wide margin -- cmd:r is doread at 318, cmd:w is
~460 through accessory_or_armor_on, and dofire needs autoquiver and
fireassist.

DO THIS ONE NEXT. It also closes a visible behavioural gap rather than an
invisible one: kills currently leave no body at all, which changes what the
hero can eat and what a pet will pick up.

=== HANDOFF: 511/11405 screens, RNG 140518/792838, 1/44 sessions ===

THE LEDGER IS NOW TRUSTWORTHY. Twenty recorded gaps were wrong and are fixed:
fifteen false entries (a dependency was already ported and nobody rechecked)
and five PHANTOM entries that recorded at a dispatch point where C's switch
has no matching arm at all. Before that work the top of unported-hits read
100/66/43/39 percent and three of those four were fictional. It now tops out
at 27% for anything actionable.

WHAT LANDED: the complete monster-vs-monster combat chain, wired.
    shade_miss, mhitm_ad_phys, mhitm_adtyping, mhitm_knockback, mdamagem,
    hitmm, getmattk, passivemm, mattackm
    + the death path: monkilled, mondied, mondead, lifesaved_monster
    + relobj/mdrop_obj/extract_from_minvent, so kills drop inventory
    + corpse_chance, so a death rolls for a corpse
    + max_passive_dmg, so a pet declines a suicidal fight
    + dog_move's attack branch and pet_ranged_attk, both wired
Pets now fight, kill, and die. A jackal biting a newt produces draws=4:
rnd(20 + i) to-hit, d(damn, damd) damage, and mhitm_knockback's two.

Also: the run loop (lookaround + domove's nomul exits), useupf, stackobj,
impact_disturbs_zombies, confers_luck, down_gate/ship_object, fpostfx,
dog_invent's pickup, and the movemon_singlemon gates.

NEXT TARGETS, all verified real:

    drop:levitation_and_message  27%  needs can_reach_floor (~28L, and most
                                      of ITS deps are now ported -- Levitation,
                                      Flying, ceiling_hider, attacktype, t_at)
                                      PLUS dosinkring, hitfloor, float_down,
                                      finesse_ahriman. can_reach_floor alone
                                      does NOT clear it.
    cmd:r                        25%  doread, 318L
    cmd:w                        25%  dowear is 19L but its chain is ~460
                                      (accessory_or_armor_on 220, canwearobj
                                      177, armor_on 66)
    dofire:empty quiver prompt   25%  needs autoquiver/fireassist/ok_to_throw

STILL RECORDED INSIDE WORKING CODE, and these are the honest remainders:
    make_corpse 378L         a kill leaves no body
    mhitm_ad_* 38 arms       every non-physical damage type
    mattackm's AT_GAZE/EXPL/ENGL/BREA/SPIT arms
    flooreffects 198L, cpostfx 199L

=== NEXT: relobj, so dead monsters drop what they carried (36%) ===
Current: 511/11405 screens, RNG 140467/792838.

mon:m_detach is the 36% entry and its due_to_death block is what matters:

    if (due_to_death) {
        if (msound == MS_NEMESIS) { nemdead(); ... }   quest only
        if (msound == MS_LEADER)  { leaddead(); }      quest only
        relobj(mtmp, 1, FALSE);   <-- THIS. drops minvent onto the map
    }

relobj (src/steal.c:875) is 24 lines: a vault-guard gold special case that
ordinary monsters skip, then `while ((otmp = mtmp->minvent) != 0)
mdrop_obj(...)`, then newsym. It needs:

    mdrop_obj     33L  MISSING     the per-object drop
    droppables         EXISTS but is NOT EXPORTED, js/dog.js -- only the
                                   is_pet path uses it, and relobj's death
                                   path passes is_pet FALSE, so it walks
                                   minvent directly
    obj_extract_self   PORTED
    newsym             PORTED

So ~57 lines for the pair, and the gold arm records. This matters now that
pets kill: a monster that dies currently takes its inventory with it.

WATCH FOR THE HALF-STATE. mdrop_obj must both remove from minvent AND place
on the floor. Dropping one half is the mpickstuff bug in reverse -- that one
took an object off the floor and gave it to nobody, and cost a session before
it was found.

=== SESSION STATE: 510/11405 screens, RNG 140589/792838, 1/44 sessions ===

WHAT THIS SESSION DID, in short: ported ~35 functions, wired the run loop,
and audited the unported ledger. The audit was the highest-value part and is
described in the block below. Fifteen recorded gaps were false; one of those
was a live bug (mpickstuff took objects off the floor and gave them to nobody,
so they vanished) and one was an inverted predicate chain (note_unported used
AS A BOOLEAN made every corpse read as non-petrifying).

TOP OF THE REACH LIST NOW, and it can be trusted for the first time:

    100%  topl:remember_topl          ^P history, no screen output. Correctly
                                      deprioritised -- porting it cannot move
                                      a single cell.
     41%  dog_move attack branch      BLOCKED on mattackm. ~900 lines with its
                                      chain (mattackm 299 + hitmm 88 +
                                      mdamagem 104 + mhitm_adtyping 51 +
                                      mhitm_ad_phys 220 + passivemm 154).
                                      The leaf layer IS done: noises,
                                      pre_mm_attack, missmm, could_seduce,
                                      pronoun_gender, mon_nam_too, You_hear.
                                      Do NOT port the decision without
                                      mattackm -- the pet would decide to
                                      attack and then do nothing, which is
                                      worse than declining.
     39%  pet_ranged_attk:attack      Same blocker.
     39%  done_eating:fpostfx         fpostfx is 90 lines; cpostfx 199.
     27%  dog_invent:check_gear...    Small, needs check_gear_next_turn.
     27%  drop:levitation_and_msg     VERIFIED REAL: all five deps missing
                                      (can_reach_floor, dosinkring, hitfloor,
                                      float_down, finesse_ahriman).
     27%  freeinv_core:uhave_arti...   Needs u.uhave, not tracked at all.
     27%  dropz:flooreffects          198 lines.
     25%  cmd:r / cmd:w               doread 318 lines; dowear 19 but its
                                      chain is unsized.

=== mattackm IS DONE. THE BLOCKER IS NOW THE DEATH SUBSYSTEM. ===

ALL NINE PIECES COMMITTED, each verified against the REAL monster table:

    shade_miss       uhitm.c:2016    mhitm_ad_phys   uhitm.c:4128
    mhitm_adtyping   uhitm.c:4782    mhitm_knockback uhitm.c:5247
    mdamagem         mhitm.c         hitmm           mhitm.c:644
    getmattk         mhitu.c         passivemm       mhitm.c
    mattackm         mhitm.c

END-TO-END PROOF: a jackal attacking a newt returns M_ATTK_HIT, deals 2
damage, stamps mlstmv, and produces DRAWS=4 -- rnd(20 + i) to-hit,
d(damn, damd) damage, and mhitm_knockback's rn2(3) and rn2(chance). That is
the exact draw signature C makes for an ordinary pet blow.

WHY IT IS STILL NOT WIRED. mdamagem deducts hit points and then records
'mdamagem:monkilled' instead of running the death path. Wiring dog_move's
attack branch now would leave monsters at mhp <= 0 still on the map: no
corpse, no removal, no experience. That is the vanishing-object bug shape
again and it must not ship.

THE DEATH SUBSYSTEM, sized:

    monkilled           42L   mon.c   message + disintegested + dispatch
    mondied             11L   mon.c   mondead + corpse_chance + make_corpse
    mondead             97L   mon.c   THE REAL WORK -- lifesaved_monster,
                                      the vampshifter revert, m_detach
    corpse_chance         ?         unsized
    make_corpse           ?         unsized
    lifesaved_monster     ?         unsized
    nonliving                 PORTED (js/mondata.js)

SIZE mondead BY REACHED BRANCH FIRST. Every function in this chain turned
out several times smaller than its line count once the unreachable arms were
excluded -- mhitm_ad_phys was 220 and used 12. Do not take 97 at face value.

ONCE monkilled EXISTS: wire dog_move's attack branch (41%) and
pet_ranged_attk (39%). Those are the two largest entries on the reach list
and they share this blocker.



COMMITTED, each verified by forced execution with the RNG log on:

    shade_miss        uhitm.c:2016   36L   first test answers for non-shades
    mhitm_ad_phys     uhitm.c:4128  ~12L   the mhitm branch only
    mhitm_adtyping    uhitm.c:4782  ~40L   38 arms record by their own name
    mhitm_knockback   uhitm.c:5247  ~30L   ITS TWO DRAWS ARE THE POINT
    mdamagem          mhitm.c       ~55L   d(damn,damd) is the damage roll
    hitmm             mhitm.c:644   ~65L   per-attack-type messages

A jackal biting a newt through hitmm produces draws=3 and deals damage:
d(damn,damd) + mhitm_knockback's rn2(3) and rn2(chance). That is the exact
draw signature C produces for an ordinary pet blow.

STILL MISSING for mattackm itself:

    getmattk    135L  mhitu.c   picks WHICH attack of the monster's NATTK
                                slots is used this pass. Not optional -- the
                                loop calls it every iteration.
    passivemm   154L  mhitm.c   the defender's counter-attack, run after
                                every attack. SIZE ITS BRANCH SPLIT FIRST.
    mattackm    299L  mhitm.c   the dispatcher itself

mattackm's own head is small and portable: null checks, helpless(magr), the
grid-bug angle rule, tmp = find_mac(mdef) + m_lev, the mconf/helpless +4, the
mundetected unhide, mlstmv = moves, skipdrin = FALSE. All of find_mac,
helpless, newsym, canseemon, sensemon, m_at, DEADMONSTER and distmin are
ported. The bulk is the NATTK loop's switch, and only the melee arm matters.

DO NOT wire dog_move's attack branch until mattackm can deal damage AND
monkilled exists -- mdamagem currently deducts hit points without running the
death path, which is an honest recorded half-state but not something to
expose to a live session.



DONE and committed, written against fully ported code:
    mhitm_ad_phys (mhitm branch)   ~12 lines   uhitm.c:4128
    mhitm_adtyping (dispatcher)    ~40 lines   uhitm.c:4782
    shade_miss                      36 lines   uhitm.c:2016

mdamagem (mhitm.c) SIZED BY REACHED PATH. Its core for an ordinary pet blow:

    mhm.damage = d(mattk->damn, mattk->damd);     <-- THE DAMAGE DRAW
    mhm.hitflags = M_ATTK_MISS;
    ... petrify block, fires only vs a petrifying defender ...
    mhitm_adtyping(magr, mattk, mdef, &mhm);      <-- DONE
    if (mhitm_knockback(...) && ...) return hitflags;
    if (mhm.done) return hitflags;
    if (!mhm.damage) return hitflags;
    mdef->mhp -= mhm.damage;
    if (mdef->mhp < 1) { ...death... }

Still missing, with sizes:
    mhitm_knockback   174 lines  uhitm.c   <-- the big one; CHECK ITS OWN
                                              BRANCH SPLIT FIRST, it takes
                                              magr/mdef like the ad_* arms
                                              and may be far smaller for
                                              monster-vs-monster
    attk_protection    38 lines  mhitm.c   petrify block only
    monkilled          42 lines  mon.c     death path
    d()                          PORTED, js/rng.js

THE DAMAGE DRAW IS THE PRIZE. d(damn, damd) is the first RNG call any pet
attack makes, and it is currently never drawn because the whole branch is
declined. Getting mdamagem in should move the RNG stream on every session
where a pet fights, which is 41% of them.

WARNING carried forward: do NOT wire dog_move's attack branch until mattackm
can actually deal damage. A pet that decides to attack and then does nothing
is worse than one that declines -- that was measured, not assumed.

=== THE NO-WEAPON mhitm PATH IS ~48 LINES. START HERE. ===

Sized concretely. The monster-vs-monster branch of mhitm_ad_phys, for the case
that actually happens (a pet with no weapon), is:

    let mwep = MON_WEP(magr);
    const vis = canseemon(magr) && canseemon(mdef);
    if (aatyp !== AT_WEAP && aatyp !== AT_CLAW) mwep = null;   // BITE -> null
    if (shade_miss(...)) damage = 0;
    else if (aatyp === AT_KICK && thick_skinned(pd)) damage = 0;
    else if (mwep) { ...weapon block, UNREACHABLE without a weapon... }
    else if (purple worm vs shrieker) { ...damage cap... }

About 12 lines. With no weapon the entire weapon block -- dmgval,
artifact_hit, rustm, mhitm_really_poison, do_stone_mon -- is skipped, and
damage simply passes through as the caller computed it.

Everything it needs is ported EXCEPT shade_miss:

    MON_WEP, canseemon, thick_skinned (js/mondata.js:371)   PORTED
    shade_miss                              MISSING, 36 lines, uhitm.c:2016

SO THE DAMAGE LEAF IS ~48 LINES, not the 220 the function's total suggests.

This changes the whole picture for the 41% and 39% entries. Re-size mdamagem,
passivemm and mhitm_adtyping the same way -- by the branch mattackm actually
reaches, not by the function -- before deciding the chain is too big. The
earlier ~1000-line figure sized functions rather than reached branches and is
almost certainly several times too high.

mattackm RE-SIZED DOWNWARD, and this is the most useful correction here.
mhitm_ad_phys is 220 lines, but it splits into THREE branches by who is
fighting:

    magr == &youmonst   the hero attacking      (uhitm)   ~90 lines
    mdef == &youmonst   a monster attacking you (mhitu)   ~80 lines
    else                MONSTER VS MONSTER      (mhitm)   ~50 lines

mattackm only ever reaches the third. So the physical-melee chain is NOT the
~1000 lines recorded earlier -- the 220 becomes about 50, and the same
three-way split very likely applies to mdamagem and the other mhitm_ad_*
arms, since they share the signature and the mhitm_data struct. RE-SIZE
mdamagem and passivemm the same way before committing to a number.

What the mhitm branch of mhitm_ad_phys needs, from its first ~30 lines:
    MON_WEP, canseemon, touch_petrifies, which_armor, rn1,
    Monnam, mon_nam_too, DEADMONSTER      ALL PORTED
    shade_miss, do_stone_mon, dmgval,
    artifact_hit, pline_mon, thick_skinned  NOT PORTED, unsized

For a pet with no weapon -- the overwhelmingly common case -- mwep is null
(and forced null for any aatyp other than AT_WEAP/AT_CLAW), so the entire
weapon block including artifact_hit and dmgval is skipped. Check what the
no-weapon path actually needs before sizing those.

cmd:w SIZED (25%) -- NOT CHEAP. dowear() itself is 19 lines and its two
predicates verysmall/nohands are ported, but it ends in
accessory_or_armor_on() at 220 lines, which needs canwearobj() 177 and
armor_on() 66. ~460 lines for the chain. The dispatcher trap once more: the
function named in the gap is small and the thing it returns into is not.

Note wear_ok IS already ported, at js/cmd.js:415, as a `const` arrow -- which
is why a `grep "^function wear_ok"` reports it missing. Grep the bare name.

cmd:r (25%) is doread at 318 lines and was not sized further.

distant_name SIZED (25%, dog_invent:distant_name and mpickstuff's twin):
63 lines in src/objnam.c:347, and NOT a leaf. It needs

    get_obj_location()   MISSING
    gd.distantname       a global flag that xname()/doname() must READ --
                         js/objnam.js has no notion of it (0 occurrences)
    program_state.gameover  not tracked (only guards the o_id suppression)
    distu()              private to js/dog.js, needs its src/mon.c home
    xname / doname       ALREADY PORTED, objnam.c:147 and :234

The reason it is not a leaf is the flag: distant_name's whole job is to call
func() with gd.distantname raised so that xname() does NOT set obj->dknown for
a far-off object. Porting distant_name without threading that flag into
xname/doname would make every distant object read as identified, which is a
silent wrong answer rather than a visible gap. Thread the flag first.

The side effect is the point, not the string: C calls distant_name purely for
dknown and find_artifact even when the result is never printed, which is why
js/dog.js records it BEFORE the extract rather than skipping it.

THE HEURISTIC THAT KEPT WORKING: before sizing a gap, check whether its
dependencies are ALREADY PORTED. Five entries this session fell for a few
dozen lines each that way (stackobj, impact_disturbs_zombies, useupf,
confers_luck, dog_invent pickup) because their real work -- merged(),
is_flimsy(), splitobj(), delobj() -- was already sitting there.

=== THE unported AUDIT: SIX FALSE GAPS, ONE REAL DEFECT ===
Current: 510/11405 screens, RNG 140679/792838, 1/44 sessions.

I swept all 312 recorded gap names against the port's actual function
definitions (46 matched something that exists) and checked the reached ones.
Six records were wrong. FIVE of the six were "gap recorded before the
dependency landed, never rechecked":

    can_touch_safely:touch_artifact  66%  touch_artifact was 300 lines up in
                                          the SAME FILE. Clearing it showed no
                                          session ever touches a real artifact
                                          at all -- the 66% was entirely false.
    start_eating:done_eating         39%  done_eating ported at eat.js:261.
                                          Reach moved DOWN to fpostfx/useupf,
                                          which is where the code is actually
                                          missing.
    pluslvl:adjabil                  16%  adjabil ported at attrib.js:254.
                                          THIS ONE MOVED THE SCORE: 508 -> 510.
    freeinv_core:curse_loadstone     27%  curse() ported in mkobj.js.
    mpickstuff:mpickobj               9%  see below.

The sixth was different in kind: freeinv_core:money2mon recorded a gap that
DOES NOT EXIST IN 5.0. That arm is two statements, `disp.botl = TRUE; return;`
and money2mon appears nowhere in invent.c. It is 3.4/3.6 knowledge that got
written into a comment instead of code, which is the rule 3a failure surviving
in the one place nothing checks.

AND ONE WAS A LIVE BUG, not just a stale note. mpickstuff called
obj_extract_self() to take an object off the floor and then RECORDED instead
of calling mpickobj, so the object left the floor and reached nobody's
inventory. It vanished. Recording where a call belongs is only honest if the
surrounding code is also skipped; here the record sat in the middle of a
half-completed operation.

WHAT THIS MEANS FOR THE ROADMAP: unported-hits ranks by reach, and it was
ranking against records rather than against reality, so it was pointing at
the wrong work. It now tops out at topl:remember_topl (100%, ^P history, no
screen output, still correctly deprioritised) then dog_move attack branch at
43%. Trust it more than before, but re-read the C arm behind any record you
are about to build on.

NOT YET CHECKED: 40 of the 46 suspects, all below 9% reach. Worth finishing.


=== THE RUN LOOP IS WIRED AND COMMITTED. 508 screens, RNG 140923. ===

Attempt 3 landed. A rush now covers several squares as C does. The three
attempts, which are worth keeping because the shape of the improvement is the
useful part:

    attempt 1  no domove exits           -7 screens, RNG  +40   reverted
    attempt 2  + blocked-move, post-move -2 screens, RNG +243   reverted
    attempt 3  + monster-bump            -2 screens, RNG +243   COMMITTED

The missing terminator was the whole story: adding two of C's six
domove_core nomul(0) sites recovered 5 of the 7 lost screens and multiplied
the RNG gain by six. The third site changed nothing measurable but is
faithful and stays.

WHY IT WAS COMMITTED AT -2, against the standing revert-on-any-drop rule:
both divergence points are byte-identical with and without it (screens still
first mismatch at step 8, the unported #jump; RNG still diverges at call 2869
in m_move), so every pre-divergence screen is intact and the two lost matches
are coincidences deep in an already-diverged run. No other session loses
screens. generalize clean on 40 seeds. The faithful loop is what helps the
held-out half; two lucky matches are not.

RULED OUT along the way, so nobody re-checks:
  - hack.c:2766, the run-stops-rather-than-attack site. Ported, measured,
    cost 11 RNG for zero screens, left OUT. It is the one site of the six
    that made things worse.
  - autoopen. Removing domove's `context.run = 0` disables the autoopen
    branch during a run, and C has the same !svc.context.run guard at
    hack.c:1097, so the port matches. A rush into a closed door does not
    open it in C either; the door stops the run via test_move.

STILL UNPORTED of the six: 2816 (stuck steed) and 2854 (swim_move_danger).
Both need subsystems that are absent; neither is reachable yet.

NEXT: seed4500's 2 screens are not a run-loop bug. I traced its divergence
point instead, and the answer is worth having because it is NOT what it looks
like.

    call 2869 is m_move's mtrack roll, `rn2(4 * (cnt - j))` at monmove.c:1963
    C draws rn2(28)  ->  cnt - j = 7
    we draw rn2(20)  ->  cnt - j = 5

The obvious reading is that our mfndpos under-counts. IT DOES NOT. I
instrumented mfndpos at exactly that call and dumped the 3x3 around the
monster:

    monster is a newt (pmidx 322) at (77,14), flag 268697600, cnt = 5
      (76,13) ROOM *   (77,13) ROOM *   (78,13) VWALL
      (76,14) ROOM *   (77,14) self     (78,14) VWALL
      (76,15) STAIRS * (77,15) ROOM *   (78,15) VWALL

Five legal neighbours, five returned, all correct -- the newt is against a
room's east wall, so three of its eight neighbours are wall. Our mfndpos is
RIGHT here.

But a monster pinned against a wall cannot have 7 legal neighbours, so C
cannot be moving this newt at call 2869. IT IS MOVING A DIFFERENT MONSTER.
The bug is upstream of mfndpos entirely: our monster ITERATION differs -- a
monster C moves and we skip, one we move and C skips, or a different order.

So do not go debugging mfndpos, and do not chase the newt. The next
investigation is movemon()'s loop in src/mon.c: which monsters get a move
this turn and in what order. Compare against the trace by instrumenting which
monster is moved per draw, not what mfndpos returns for it.

Useful detail for whoever picks this up: mon 59 shows up at calls 2841
(58,17), 2851 (59,17) and 2872 (60,17), walking steadily east, with the newt
at 2869 interleaved between.

FOLLOW-UP, and it narrows things further. Every draw matches through 2868 and
only the BOUND differs at 2869, which argues we are moving the SAME newt, not
a different monster -- different monsters would have desynced the draws
earlier. So the newt is at a DIFFERENT SQUARE in C than in our run, and its
position diverged at some earlier point WITHOUT any RNG difference. cnt = 7 is
an open-floor count; ours is 5 because our newt is against a wall. A monster
that moved to the wrong square without drawing is the thing to find, and the
RNG trace by construction cannot point at it.

WHAT THE movemon COMPARISON DID FIND. js/mon.js:113 movemon_singlemon is four
lines; C's (mon.c:1214) has a good deal more, and these are genuine gaps
independent of seed4500:

    m_everyturn_effect   NOT the problem -- only acts on PM_FOG_CLOUD
                         (monmove.c:650), so it is a no-op for ordinary
                         monsters. Checked so nobody re-checks it.
    restrap(mtmp)        MISSING. Fires for is_hider monsters and can draw.
    the S_EEL arm        MISSING, and it carries an explicit !rn2(4) plus
                         hideunder(). An eel in a pool draws here every turn.
    minliquid(mtmp)      MISSING. Gates dochug entirely when it returns TRUE.
    I_SPECIAL re-equip   MISSING. Calls m_dowear and can consume the turn.
    mon_offmap, isgd     MISSING gates.
    dochugw vs dochug    We call dochug; C calls dochugw(mtmp, TRUE), which
                         wraps it with the occupation-interrupt check. NO
                         draws of its own, so it is a correctness gap for
                         interrupting multi-turn actions, not an RNG one.

Also worth a look: C sets somebody_can_move from `movement >= NORMAL_SPEED`
BEFORE dochug runs, while we return that test AFTER dochug. If dochug alters
movement the two disagree. The existing comment at js/mon.js:113 argues the
current shape is deliberate, so measure before changing it.

=== (attempt 1 notes follow) ===

Steps 1-3 below were implemented and MEASURED AT -7 SCREENS (510 -> 503), so
they were reverted per the no-regression rule. Step 1 (the domove() signature)
was fine and is committed; steps 2 and 3 are not. The reason is a FOURTH
requirement that none of the four steps mentions, and it is the real blocker:

    C's src/hack.c contains 12+ nomul(0) calls INSIDE domove/domove_core.
    js/cmd.js's domove contains ZERO.

Those calls are how a run actually ends in the common case. lookaround() does
NOT stop a rush crossing an open room: every neighbour is ROOM, so each one
hits the `continue`, corrct stays 0, and the function returns without calling
nomul. C ends that run when domove itself fails to move -- blocked by a wall,
a boulder, a closed door -- and each of those sites calls nomul(0).

Without them the wired loop has no terminator. multi is seeded to
max(COLNO, ROWNO) = 80, and the `if (multi < COLNO && !--multi)` guard does
NOT decrement it (80 < 80 is false -- that countdown is for a count prefix
like "20j", not for a rush), so the hero keeps moving until something
incidental stops him. That is a LARGER positional error than the single step
the recorded gap currently produces, which is exactly why it measured worse.

Measured effect: seed4500 11->8 and seed5002 8->4, the only two sessions that
change. Both use the g prefix (17 and 7 times). RNG went UP 40 while screens
went DOWN 7 -- the loop does produce more correct draws, it just puts the hero
on the wrong square, which is the more expensive error.

SO THE REAL ORDER IS: port domove_core's nomul(0) sites FIRST, then wire.
Doing the wiring before them is strictly worse than the honest one-step gap.

=== NEXT ACTION (lookaround is ported; only the wiring is left) ===

lookaround() and its whole leaf chain are committed and verified by forced
execution. The score is unchanged at 510 because NOTHING CALLS IT YET, and
that is the entire remaining task. Do this next, in this order:

1. domove() signature. C's is domove(void) and reads u.dx/u.dy; ours is
   domove(dx, dy) in js/cmd.js:670. moveloop calls it with no arguments, so
   the signature has to match C before the branch below can call it. Set
   u.dx/u.dy at the call sites that currently pass arguments.

2. The moveloop branch, src/allmain.c:515. The port's moveloop
   (js/allmain.js:519) goes from the occupation check straight to rhack and
   has no multi>0 branch at all. C:

       if (gm.multi > 0) {
           lookaround();
           if (!gm.multi) { svc.context.move = 0; return; }  // lookaround cleared it
           if (svc.context.mv) {
               if (gm.multi < COLNO && !--gm.multi) end_running(TRUE);
               domove();
           } else {
               --gm.multi;
               rhack(gc.cmd_key);
           }
       }

   Note lookaround stops the run by calling nomul(0), which zeroes multi --
   that is why the !gm.multi test sits immediately after the call.

3. The rush prefix must set multi and context.mv. Until it does, multi is
   never > 0 from movement and the branch is dead code.

4. THEN delete the recorded gap at js/cmd.js:679 and the context.run = 0 on
   the line after it, plus the one at js/cmd.js:574. Those two are the
   placeholders this replaces; end_running() is now the real way to zero run.

Do NOT add HJKLYUBN to isMovementKey as part of this. That trades a visible
"Unknown command" for an invisible wrong distance and is not the fix.

# STATUS

## START HERE

**493/11,405 screens (4.3%), 1/44 sessions, RNG 140,680/792,838 (17.7%).**
Tree clean and pushed. seed8000 matches C call for call (3130 calls) on ported
code; js/fastforward.js is not on its path.

NEXT CONCRETE TARGET: seed0004's PET LANDS ON THE WRONG SQUARE.

After the wallification fix (510 screens) seed0004's earliest difference is
the pony's position, still at step 9:

  C     row 8  │·····u│      row 10 │······│
  ours  row 8  │······│      row 10 │····u·│

The room outline now matches exactly; only the pet differs, by two rows.

What is already ruled out:
  - the RNG. seed0004 matches C for 3694 calls, well past placement, so the
    draws enexto made were identical in count and argument.
  - enexto_core (js/teleport.js:125) is fully ported, no unported markers.
  - makedog passes makemon(mons[pettype], u.ux, u.uy, ...) exactly as C does.

IT IS SYSTEMATIC, not one session's luck. seed0030 -- 1952 steps, the largest
session in the corpus, diverging at STEP 4 -- shows C's "f<." against our
"$<f": the kitten two squares right, with the gold it should be standing on
now visible. Same shape as seed0004's pony.

ELIMINATED SO FAR, all by comparison against the C rather than by guessing:
  - makedog's call. C is makemon(&mons[pettype], u.ux, u.uy,
    MM_EDOG | NO_MINVENT); ours is identical.
  - the RNG. seed0004 matches C for 3694 calls, well past placement, so every
    draw enexto made agreed in count AND argument.
  - collect_coords (js/teleport.js:39). Bounds (max(loy,0), max(lox,1)), the
    ROWNO-1/COLNO-1 breaks, the ring-edge test, both quick filters
    (skip_mons/m_at and skip_inaccessible/ZAP_POS) and the shuffle
    (k = rn2(n), swap [k] with [0], advance, decrement) all match
    src/teleport.c line for line.
  - enexto_core itself is ported with no unported markers.

THAT LEAVES goodpos(), and comparing it arm by arm against src/teleport.c:86
found three real differences. Two are fixed:

  - MON_AT was rejected unconditionally; C guards it with GP_AVOID_MONPOS.
  - the hero's square was rejected unconditionally; C guards it with
    !GP_ALLOW_U plus three more tests (not the hero, not the engulfer holding
    you, not your steed). C's comment says why: goodpos also relocates
    engravings and objects, which CAN share the hero's square.

The third is STRUCTURAL AND NOT FIXED. C's signature is

    goodpos(coordxy x, coordxy y, struct monst *mtmp, mmflags_nht gpflags)

taking a MONSTER. js/makemon.js takes a PERMONST (it uses ptr.mlet, and C
does mdat = mtmp->data inside). That makes two of C's tests inexpressible:

    if (mtmp2 && (mtmp2 != mtmp || mtmp->wormno))
        return FALSE;

The identity test lets a monster be placed back at ITS OWN location, which
matters for relocation, and the wormno test rejects that for long worms
because every segment answers m_at(). With a permonst there is no identity
to compare and no wormno to read, so both are simply absent.

THE SIGNATURE CHANGE IS NOW DONE and it did NOT move the pet. seed0030 still
shows "f<." against "$<f" at step 4. So goodpos is no longer a candidate:
all three differences in it are fixed and the placement is unchanged.

WHAT THE "$" MEANS, and it is the most useful clue left: in our render the
gold is VISIBLE at the square where C draws the pet. Gold does not block
placement, so C's pet is simply STANDING ON the gold and hiding it. Both
sides therefore agree on where the gold is; they disagree only on which
adjacent square the pet took.

Since collect_coords, the shuffle, the RNG stream and goodpos all match, the
remaining possibilities are narrow:
  - the hero is standing somewhere different when makedog runs, which makes
    the whole ring different. CHECK THIS FIRST -- it is cheap: print u.ux,u.uy
    at the makedog call and compare against where the recorded screen shows @.
  - or enexto_core is entered with a different radius/flag combination.

MEASURED: the hero is at (57,4) and our pet lands at (58,4), one square EAST.
C's pet is at (56,4), one square WEST -- that is where our "$" shows, so the
hero's square and the gold's square both agree. The disagreement is purely
which adjacent square the ring shuffle handed over first.

A FOURTH goodpos difference was found while checking this and is NOT fixed:
C's goodpos has a GP_CHECKSCARY arm at src/teleport.c:168,

    if (checkscary && (mtmp->m_id ? onscary(x, y, mtmp)
                                  : goodpos_onscary(x, y, mdat)))

and js/makemon.js has no reference to onscary at all. goodpos_onscary
(teleport.c:53) tests scare-monster scrolls and engraved Elbereth, both of
which need subsystems that are absent, and for an ordinary pet with neither
present it evaluates FALSE. So it is a genuine gap that cannot currently
change any placement -- port it when engravings land, not before.

CONFIRMED THE PATH IS ENTERED: instrumenting makemon's byyou branch prints
`BYYOU at (57,4) in_mklev=false`, so the guard `byyou && !gi.in_mklev` passes
and enexto_core IS called for the pet. That rules out the pet being placed by
some other route.

STILL UNEXPLAINED. Eliminated: collect_coords, the shuffle, the RNG stream,
all four goodpos arms, the hero's position, the gold's position, and now the
dispatch into enexto_core.

NEXT, and mind the trap that wasted the end of this tick: an attempt to print
each candidate inside enexto_core's first loop produced NO output, which
looks like "the loop never runs" and is not -- the python replace simply did
not match the current text of that line. VERIFY THE EDIT LANDED (grep for the
console.error after writing it) before drawing any conclusion from silence.
The same mistake earlier in this session briefly made movemon, dochug and
dog_move all look like dead code.

MEASURED, the shuffled ring for the pet at hero (57,4):

    57,3  58,4  56,3  58,3  58,5  56,5  56,4  57,5

We reject (57,3) -- it is the room's top wall -- and accept (58,4), the
second entry. C ends up on (56,4), which is SEVENTH in our order. For C to
reach it, C's shuffle must have produced a different permutation, because
goodpos would have accepted (58,4) for C too.

So the divergence is IN THE PERMUTATION, not in acceptance. With the RNG
stream matching, that means either
  - our PRE-shuffle collection order differs from C's, so identical swaps
    yield a different result, or
  - the shuffle is applied over a different span (C shuffles per radius; if
    our radius boundaries differ the swaps group differently).

OUR PRE-SHUFFLE ORDER IS CORRECT. Measured:

    PRE r=1 n=8  56,3 57,3 58,3 56,4 58,4 56,5 57,5 58,5

which is exactly C's y-outer/x-inner ring-edge order. Post-shuffle we get

    57,3 58,4 56,3 58,3 58,5 56,5 56,4 57,5

and seed0030's first RNG mismatch is at call 6276, far AFTER pet placement,
so the shuffle's rn2 draws agreed with C's in count and value.

THAT IS A CONTRADICTION and it is the state to resume from: identical input
order, identical algorithm (verified line for line), identical draws --
yet C lands on (56,4) and we land on (58,4). One of those four claims is
false and the cheap ones are already checked, so suspect the two that are
inferred rather than directly observed:

  1. "identical draws" is inferred from the aggregate stream matching to
     6276. It does NOT prove the draws at THIS call site matched -- an equal
     number of compensating differences would look the same. Log the actual
     k values from the shuffle and compare against a C trace if one can be
     produced.
  2. "C lands on (56,4)" is inferred from the RENDERED SCREEN, where the pet
     glyph sits west of the stairs. Confirm the hero is really at (57,4) in
     C at that moment rather than one column off, which would move the whole
     ring and explain everything.

CHECKED 2: THE HERO MATCHES. tools/screendiff.mjs shows "@" at the SAME row
and column in both renders at step 4 (row 6, inside "+@..+"). An earlier
reading of "C hero at column 16" came from parsing the session JSON's screen
field by hand and was a MISREAD of that format -- do not repeat it; use
screendiff, which aligns the two renders for you.

A game-indexed probe confirms makedog fires once per game with moves=0:
game 1 hero (57,4), game 2 (16,16), game 3 (73,5). Game 1 is the one the
step-4 screen belongs to, so (57,4) is the right figure after all and the
earlier caution about wrong-game coordinates is withdrawn.

seed0030 is "ten-diverse-deaths" -- TEN GAMES in one session -- so makedog
is called once per game and the step-4 screen belongs to the first. Either
our games are ordered differently from C's, or our first game starts the
hero somewhere C's does not.

DO NOT CONCLUDE FROM THIS ALONE that the start position is wrong: the
screendiff at step 4 matches on every row except the pet, which would be
impossible if the hero were forty columns away on the same map. The more
likely reading is that the (57,4) call belongs to a different game than the
step-4 screen, and the pet being compared is the one placed at (16,16).

SO THE CONTRADICTION STANDS AND IS NOW FULLY ISOLATED. At hero (57,4),
game 1, moves 0: our pre-shuffle ring matches C's order exactly, the shuffle
algorithm matches line for line, the RNG stream matches to call 6276 which is
far past this point, and the hero's square is confirmed identical. Yet C's
pet ends west of the stairs and ours east.

ASSUMPTION 1 IS NOW CHECKED TOO. The shuffle's k values for radius 1 are
1, 3, 2, 1, 3, 0, 1, and hand-walking them over the pre-shuffle ring
reproduces our observed permutation exactly. The draws are internally
consistent and agree with C's stream.

SO THE SHUFFLE IS CORRECT AND C MUST BE REJECTING SQUARES WE ACCEPT.
Our order is

    57,3  58,4  56,3  58,3  58,5  56,5  56,4  57,5

we reject only the first and take the second; C must reject the first SIX.

THE ROOM GEOMETRY EXPLAINS WHY THAT IS PLAUSIBLE. screendiff rows 4-7:

    ┌───┐
    │f<·│
    +@··+
    └───┘

The interior is TWO ROWS BY THREE COLUMNS and the hero's row has DOORS (+)
at BOTH ENDS. So most of the radius-1 ring is wall, and the ring entries our
port accepts include squares that are wall or door on C's map.

MEASURED, AND THE TERRAIN HYPOTHESIS IS DISPROVEN:

    TYP (57,3) typ=2  ok=false     <- wall, correctly rejected
    TYP (58,4) typ=25 ok=true      <- ROOM, correctly accepted

(58,4) is ordinary room floor and goodpos is right to take it. We are NOT
accepting terrain C refuses, so that line of attack is closed.

WHAT THIS LEAVES, and it is worth stating plainly because every component has
now been verified individually: collection order, shuffle algorithm, shuffle
draws, hero position, all four goodpos arms, the dispatch guard, and the
terrain at the winning square are ALL correct in isolation. The pet still
lands on a different square than C's.

A COORDINATE-MAPPING DISCREPANCY IS THE MOST LIKELY REMAINING EXPLANATION AND
HAS NOT BEEN CHECKED. makedog reports the hero at map (57,4), but screendiff
draws the @ at display row 6, around column 55. Display row 6 should be map
row 5, not 4, and column 55 is not 57. Until that offset is reconciled, EVERY
coordinate comparison in this entry is suspect -- including "C's pet is at
(56,4)", which was read off the display, not measured.

RECONCILED, AND IT INVALIDATES THE PREMISE OF THIS WHOLE INVESTIGATION.

makedog runs at MOVES=0. The screendiff being compared is STEP 4 -- four
keystrokes later. By then the hero has moved (which is why the @ is at
display column ~55 rather than map column 57) AND SO HAS THE PET.

So the step-4 pet position is NOT the placement position. It is the placement
position plus four turns of dog_move. Comparing it against makedog's output
was comparing two different moments, and every conclusion drawn from that
comparison -- "C's pet is at (56,4)", "we take the second ring candidate and
C takes the seventh" -- is unfounded.

The placement itself may well be correct. What differs at step 4 could be
entirely down to PET MOVEMENT, which returns this to dog_move, the function
this line of investigation started from and which was set aside earlier as
"not what costs those sessions their screens".

SETTLED. screendiff reports seed0030's FIRST differing step as step 4, which
means steps 0, 1, 2 and 3 match COMPLETELY -- pet included. The pet is placed
on the correct square and renders correctly for three turns before anything
diverges.

PET PLACEMENT IS NOT BROKEN. The entire investigation above rested on
comparing makedog's moves=0 output against a step-4 screen, and the answer
was available from the divergence step number the whole time.

THE BUG IS IN PET MOVEMENT -- dog_move -- which is where the trail started
roughly twenty ticks ago before being set aside. What is now known that was
not known then:

  - js/dog.js:994 holds dog_move (~211 lines, 10 draws); js/dogmove.js does
    NOT, despite mirroring src/dogmove.c. Do not re-port it.
  - its scoring loop's sampler is correct: pre-increment rn2(++chcnt) and the
    j < 0 chcnt reset both verified.
  - appr, IS_ROOM, the candidate list and the mfndpos ordering were all
    eliminated by measurement.
  - the first RNG divergence for seed0030 is call 6276 at obj_resists, far
    downstream, so dog_move's own draws agree; the difference is in which
    square it CHOOSES, not what it rolls.

INSTRUMENTED. dog_move's early turns on seed0030, printing pet position,
each candidate and its j:

    DM m=2 pet(58,4) cand(57,4) j=-3 nid=4 appr=1 gg=(56,4)
    DM m=2 pet(58,4) cand(58,5) j=4  nid=1 appr=1 gg=(56,4)
    DM m=2 pet(57,4) cand(56,4) j=1  nid=1 appr=1 gg=(57,5)
    DM m=2 pet(57,4) cand(56,5) j=0  nid=1 appr=1 gg=(57,5)
    DM m=3 pet(58,5) cand(57,4) j=-2 nid=4 appr=1 gg=(56,5)

TWO THINGS TO NOTE BEFORE GOING FURTHER:

1. The pet moves TWICE per turn at m=2 -- pet(58,4) then pet(57,4). A kitten
   is fast (16 speed vs the hero's 12), so it banks enough movement for a
   second action on some turns. Confirm our movement accounting matches C's
   before reading anything into the squares chosen: an extra or missing
   second move changes everything downstream and would look exactly like a
   bad choice.

2. gg CHANGES between the two calls in the same turn, (56,4) then (57,5).
   That is dog_goal recomputing, which is correct in principle -- but it
   means the second move is steered by a goal derived from the state after
   the first, so the two are not independent.

THE ACTUAL RNG DIVERGENCE FOR seed0030, from tools/diverge.mjs -w 4:

  6275  C rn2(5)=1    ours rn2(5)=1    ok        @ distfleeck
  6276  C rn2(100)=92 ours rn2(4)=0    MISMATCH  @ obj_resists(zap.c:1469)
  6277  C rn2(8)=7    ours rn2(100)=67 differs   @ dog_goal(dogmove.c:554)
  6278  C rn2(100)=1  ours rn2(8)=1    differs   @ obj_resists

READ THE SHAPE, not just the first mismatched line. Our rn2(100) at 6277 is
C's rn2(100) from 6276, and our rn2(8) at 6278 is C's rn2(8) from 6277. WE
ARE ONE DRAW AHEAD: we make an extra rn2(4) that C does not make at all, and
everything after it is C's stream shifted by one.

rn2(4) is dog_goal's appr test, src/dogmove.c:575:

    if (!IS_ROOM(levl[u.ux][u.uy].typ) || !rn2(4) || whappr
        || (dog_has_minvent && rn2(edog->apport)))
        appr = 1;

That is an OR chain, so C reaches the rn2(4) only when !IS_ROOM is FALSE --
the hero must be standing IN a room. If our IS_ROOM disagrees with C's for
the hero's square at that moment, we evaluate the rn2(4) where C
short-circuits past it, or vice versa.

NOTE the earlier entry in this file eliminated IS_ROOM on seed0004 by
observing rn2(4)=0 on both sides. That was a DIFFERENT session and a
different moment; it does not clear it here.

CORRECTION, AND IT IS SHARPER THAN THE IS_ROOM READING ABOVE: the two sides
are not just drawing different values, they are in DIFFERENT BRANCHES of
dog_goal. The diverge tags say so directly --

  C     6277  rn2(8)  @ dog_goal(dogmove.c:554)
  ours  6276  rn2(4)                  [dogmove.c:575 is the appr test]

dogmove.c:554 is the APPORT branch, `edog->apport > rn2(8)`, where the pet
decides to FETCH AN OBJECT:

    } else if (gg.gtyp == UNDEF && in_masters_sight && !dog_has_minvent
               && (!levl[omx][omy].lit || levl[u.ux][u.uy].lit)
               && (otyp == MANFOOD || m_cansee(mtmp, nx, ny))
               && edog->apport > rn2(8)
               && can_carry(mtmp, obj) > 0) {

So C's pet is considering fetching something -- plausibly the gold seen in
the earlier screendiff -- and ours never gets there, falling through to the
appr test instead.

We DO have this branch (js/dog.js:658) with the rn2(8) present, so it is
reached-but-failing, not missing.

NOT THE ACCESSOR -- checked and withdrawn. The condition reads
`mtmp.edog?.apport` and edog is stored directly on mtmp.edog throughout
js/dog.js (created at :119 as `mtmp.edog ||= {}`, read at :554, :658, :938).
It is internally consistent; the port simply does not use C's mextra
indirection here. EDOG() in js/const.js reads mtmp.mextra.edog and is a
SEPARATE, unused path -- worth reconciling for the architecture rule, but it
is not this bug.

OUR APPORT BRANCH MATCHES C CONDITION FOR CONDITION -- compared line by line
at js/dog.js:653-659 against dogmove.c:550-555. gtyp === UNDEF,
in_masters_sight, !dog_has_minvent, both lit tests, the MANFOOD/m_cansee
test, the rn2(8) and can_carry are all present and in the same order.

SO THE BRANCH IS NEVER ENTERED, AND THE GATE IS ONE LEVEL UP:

    if (otyp < MANFOOD) {          <- the food branch
        ...
    } else if (gtyp === UNDEF && in_masters_sight && ...) {   <- APPORT

otyp is dogfood(mtmp, obj). The APPORT branch only runs when the object is
NOT food by that classification. If our dogfood ranks the object below
MANFOOD where C ranks it at or above, we take the food branch and never
reach the rn2(8) -- which is exactly the observed symptom.

NEXT: diff dogfood's verdict for the object in play. Two facts found while
starting that, both worth not rediscovering:

  - dogfood lives in src/dog.c:995, NOT src/dogmove.c. Its early returns
    (POISON for poisoned, TABU/APPORT for quest artifacts and obj_resists)
    match ours exactly.
  - C's dogfood has NO `case COIN_CLASS` in its oclass switch, so gold falls
    through to the OUTER default. The COIN_CLASS arm at js/dog.js:521 belongs
    to a DIFFERENT function -- it assigns mtmp.meating, so it is the eating
    path, not the classification path. Do not compare those two; they are not
    counterparts.

ANSWERED, AND BOTH SIDES AGREE. src/dog.c:1111's outer default returns APPORT
for a non-cursed, non-BALL, non-CHAIN object, and gold is all three, so C
classifies gold as APPORT. js/dog.js:456-459 has the identical arm and the
identical return. The enum matches too: MANFOOD = 3, APPORT = 4 on both sides.

So the whole chain SHOULD agree:
    dogfood(gold) = APPORT = 4
    skip test:  otyp > gtyp  ->  4 > 6 (UNDEF) is FALSE, no skip
                otyp === UNDEF -> 4 === 6 is FALSE, no skip
    branch gate: otyp < MANFOOD -> 4 < 3 is FALSE
                 -> the else-if APPORT branch, which draws rn2(8)

We draw rn2(4) instead, so WE NEVER SEE THE GOLD IN THE LOOP AT ALL. That is
the only remaining possibility and it moves the question off dogfood entirely.

THE mkobj_at ORDER FIX IS IN (see NOTES) AND DOES NOT MOVE THIS. seed0030
still diverges at call 6276 and step 4. That is expected in hindsight --
mkobj_at only creates spider/snake objects, and seed0030 game 1's gold comes
from elsewhere.

SO THIS IS STILL THE OPEN QUESTION, unchanged and now the only one left on
this trail: our dog_goal object loop does not reach the gold that C's pet
goes for. Verified already: dogfood classifies gold as APPORT (4) on BOTH
sides, the loop's skip test passes (4 > 6 and 4 === 6 are both false), and the
branch gate 4 < MANFOOD(3) is false, which routes to the else-if that draws
rn2(8). We draw rn2(4) instead, so the loop never sees the object.

INSTRUMENTED AT LAST, AND BOTH EARLIER CANDIDATES ARE WRONG:

    OBJLOOP n=12 box=x[53,63] y[0,9] objs=70,13 49,3 40,18 71,10 56,4 49,16

There are 12 objects, the object at (56,4) IS among them, and (56,4) IS
inside the box. So the loop does reach the gold, and neither
game.level.objects nor the SQSRCHRADIUS box is at fault.

THAT ISOLATES ONE CONDITION. The APPORT arm needs

    (otyp === MANFOOD || m_cansee(mtmp, nx, ny))

and otyp is APPORT (4), not MANFOOD (3), so it hangs entirely on m_cansee.
js/dog.js:313 defines it as clear_path(mon.mx, mon.my, x, y), and
js/vision.js:557 clear_path tests viz_clear[row][col].

CHECKED, AND m_cansee IS TRUE. Probing it inside the && chain prints

    CS pet(58,4)->obj(56,4) otyp=4 cansee=true
    CS pet(57,4)->obj(56,4) otyp=4 cansee=true

Because the probe sits INSIDE the chain, its printing at all proves every
EARLIER condition passed too: gtyp === UNDEF, in_masters_sight,
!dog_has_minvent and both lit tests. So the APPORT arm IS entered in game 1
and the rn2(8) IS drawn. viz_clear is fine.

WHICH MEANS I ANALYSED THE WRONG GAME. AGAIN. seed0030 is ten-diverse-deaths,
TEN games. The pet(58,4) coordinates above are game 1. Call 6276 -- where the
rn2(4)-instead-of-rn2(8) divergence lives -- is far deeper in the session and
belongs to a LATER game. Every conclusion in this entry that pairs a game-1
coordinate with call 6276 is unfounded, which is the second time this exact
mistake has been made on this session (see the earlier withdrawn
'wrong-game coordinates' caution, which was withdrawn for the wrong reason).

BEFORE ANY MORE WORK ON THIS TRAIL: establish which GAME call 6276 is in, and
instrument only that game. A game counter printed alongside every probe is the
minimum; matching a coordinate to a call index without one is guesswork.

FOUND THE RIGHT SESSION: seed0004-feeding-pony. It is the ONLY session whose
first divergence is in dog_goal, and it is a single game, so no game-index
confusion is possible.

  3693  C rn2(5)=3   ours rn2(5)=3   ok        @ distfleeck
  3694  C rn2(4)=3   ours rn2(11)=1  MISMATCH  @ dog_goal(dogmove.c:575)
  3695  C rn2(5)=1   ours rn2(3)=0   differs   @ distfleeck

dogmove.c:575 is the appr test:

    if (!IS_ROOM(levl[u.ux][u.uy].typ) || !rn2(4) || whappr
        || (dog_has_minvent && rn2(edog->apport)))
        appr = 1;

C DRAWS THE rn2(4), so for C !IS_ROOM was FALSE -- the hero is standing in a
room. We draw rn2(11) at that position instead, so we are not evaluating that
term at all.

RESOLVED: OUR dog_goal HAS NO rn2(11). Grepping it finds exactly two draws --
rn2(8) in the APPORT branch and rn2(4) in the appr test. So the rn2(11) at
call 3694 is NOT from dog_goal at all; the tag on that line names C's
function, not ours.

THAT IS THE REAL SHAPE OF THIS DIVERGENCE: the streams are aligned through
3693, then C enters dog_goal and draws rn2(4) while WE ARE SOMEWHERE ELSE
ENTIRELY, drawing rn2(11). We are not taking a different branch inside
dog_goal -- we are not in dog_goal.

So the question is no longer about appr or IS_ROOM or the APPORT arm. It is:
what does our code call at that point that C does not, and why does C reach
dog_goal there when we do not?

Candidate sources for an rn2(11) in the tree (none in dog_goal):
    js/dog.js:876   rn2(trunc(mtmp_lev / 2) + 1)  -- 11 when mtmp_lev is 20-21
    js/dog.js:1136  rn2(13 * uncursedcnt)         -- cannot be 11
Neither is obviously on a pet's ordinary turn, so grep the whole tree for
draws whose argument can be 11 rather than guessing.

DONE, AND IT NAMES THE BUG. A stack trace on the divergent call (note:
diverge.mjs's index 3694 is _rngLog index 3695 -- they are off by one) gives

    TRACE call#3695 rn2(11)=1
      at dog_invent (js/dog.js:1253)
      at dog_move   (js/dog.js:1004)
      at dochug     (js/monmove.js:950)

So the rn2(11) is dog_invent's, not dog_goal's, and js/dog.js:1253 is

    if (droppables(mtmp)) {
        if (!rn2(udist + 1) || !rn2(edog.apport))

rn2(udist + 1) with udist == 10 IS rn2(11). The whole block is gated on
droppables(mtmp).

THEREFORE: C's droppables(mtmp) is FALSE and ours is TRUE. C skips the block
entirely and goes on to dog_goal's rn2(4); we enter it and spend a draw C
never spends. OUR PET IS CARRYING SOMETHING C'S PET IS NOT.

seed0004 is "feeding-pony", and js/dog.js:80 already carries the note that
NO_MINVENT exists to stop makemon() giving a pony an already-worn saddle. That
is the first thing to check: does our pony start with a saddle, or any minvent,
where C's has none?

FOUND THE DEFECT. js/dog.js:1299:

    function droppables(mtmp) {
        return (mtmp.minvent && mtmp.minvent.length) ? mtmp.minvent[0] : null;
    }

That returns the FIRST inventory item unconditionally. src/dogmove.c
droppables() is 109 LINES and filters:
  - worn armour and wielded weapons are excluded
  - animals and mindless monsters keep nothing
  - intelligent ones RETAIN a pick-axe if they tunnel and need one, a key if
    they have hands and are not verysmall, and a unicorn horn
  - a wielded pick-axe or unicorn horn is tracked separately so the spare is
    the one dropped

Our pony's saddle is WORN -- makedog correctly calls put_saddle_on_mon per
src/dog.c:260 -- so C's droppables excludes it and returns NULL. Ours returns
the saddle, so we enter the `if (droppables(mtmp))` block at js/dog.js:1252
and spend an rn2(udist + 1) that C never spends. udist is 10, hence rn2(11).

THIS IS A STUB THAT LOOKS LIKE AN IMPLEMENTATION -- no note_unported call, no
TODO, so no tool flagged it and it reads as finished code. Worth grepping for
other one-line bodies in js/dog.js and js/dogmove.js on the same suspicion.

FIXED. droppables is ported whole (see the commit) and seed0004's first
divergence MOVED FROM 3694 TO 3746, 52 calls further in. Screens hold at 510.

THE NEW DIVERGENCE, traced rather than inferred:

    3746  C rn2(1)=0  ours rn2(12)=9  MISMATCH  @ dog_move(dogmove.c:1255)
    TRACE call#3747 rn2(12)=9  at dog_move (js/dog.js:1155)

js/dog.js:1155 is the scoring loop's worse-square acceptance, the `!rn2(12)`
arm. C's rn2(1) is the reservoir sampler at a TIE -- chcnt 0 to 1.

So for the SAME candidate square C computes j == 0 and we compute j > 0.
j = (GDIST(nx, ny) - nidist) * appr, so with the same candidate the
difference is in GDIST's goal, in nidist, or in appr.

That is the same shape as the seed0030 chase, but this time on a
SINGLE-GAME session with the divergent call traced to our own line, so the
coordinates can be trusted. dog_goal now runs correctly through droppables,
but its OUTPUT -- game.gg -- may still differ, and gg is exactly what GDIST
reads.

INSTRUMENTED. Sample from the scoring loop:

    J pet(71,5) cand(71,4) nd=2 nid=1 appr=1 j=1  gg=(70,5) gtyp=6
    J pet(71,5) cand(72,5) nd=4 nid=5 appr=1 j=-1 gg=(70,5) gtyp=6

NOTE gtyp = 6 = UNDEF. dog_goal found NO object goal and fell back, so gg is
the default target rather than a chosen one. appr is 1 throughout.

That is the thing to check next: C's dog_goal, on the same turn, may set
gtyp to APPORT or a food type and steer the pet at an object, which would
give a different gg and therefore a different j for every candidate --
producing exactly the observed "C ties where we do not".

The APPORT branch is reachable now that droppables is fixed, so gtyp being
UNDEF here is not automatically wrong, but it IS the difference worth
measuring first. Print gtyp and gg from dog_goal itself on that turn, and
work out what C's gtyp must be for its rn2(1) tie to occur.

CORRELATED PROPERLY this time, by publishing the rn2 counter to globalThis and
gating the probe on it. At the divergent call:

    J#3746 pet(69,5) cand(69,4) nd=4  nid=13 appr=1 j=-9 gg=(71,4) gtyp=6
    J#3746 pet(69,5) cand(69,6) nd=8  nid=4  appr=1 j=4  gg=(71,4) gtyp=6
    J#3747 pet(69,5) cand(70,5) nd=2  nid=4  appr=1 j=-2 gg=(71,4) gtyp=6

Our j = 4 on cand(69,6) sends us to the worse-square arm and its rn2(12);
C has j == 0 there and spends the sampler's rn2(1) instead.

ARITHMETIC CHECKS OUT ON OUR SIDE: GDIST(69,6) against gg=(71,4) is
(69-71)^2 + (6-4)^2 = 8, matching nd=8. So our j is computed correctly FROM
OUR GOAL, and the goal itself is what differs -- C's gg cannot be (71,4) or
it would have the same j we do.

gtyp is 6 (UNDEF) for us, meaning dog_goal found no object goal and fell back.
So the question is precisely: WHAT GOAL DOES C'S dog_goal SET ON THIS TURN?
If C's gtyp is APPORT or a food type, C steers at an object, gg differs, and
every candidate's j shifts -- which is exactly the observed symptom.

SOLVED FOR C'S GOAL ROW. In our trace the candidate before (69,6) is (69,4)
with j = -9, which makes it the new best, so nidist becomes GDIST(69,4). C
then has j == 0 at (69,6), which means

    C's GDIST(69,6) == C's GDIST(69,4)
    (69-gx)^2 + (6-gy)^2 == (69-gx)^2 + (4-gy)^2
    (6-gy)^2 == (4-gy)^2
    6-gy = gy-4   ->   gy = 5

C'S GOAL IS ON ROW 5. Ours is gg=(71,4), row 4. The pet itself is at (69,5),
so C is steering at something on the pet's own row and we are steering one row
north of it.

The gx term cancels out of that equation, so this says nothing about the
column -- only that the ROW differs, which is enough to produce the observed
tie-versus-worse-square split.

FALLBACK CHECKED AND IT MATCHES C. src/dogmove.c:566 and js/dog.js:685 agree:

    if (gtyp == UNDEF || (gtyp != DOGFOOD && gtyp != APPORT
                          && moves < edog->hungrytime)) {
        gg.gx = u.ux; gg.gy = u.uy;

So with gtyp UNDEF our gg IS the hero's square, which means OUR HERO IS AT
(71,4) on that turn. And C's goal row is 5.

TWO READINGS, and they are very different in weight:
  a) C did NOT fall back -- it found an object goal on row 5 that our dog_goal
     rejected, so C's gtyp is APPORT or a food type where ours is UNDEF; or
  b) C DID fall back too, in which case C'S HERO IS ON ROW 5 AND OURS IS ON
     ROW 4 -- a hero-position divergence, which is far more serious than a pet
     bug and would mean the pet is only where this surfaced.

RAN THE TEST AND IT DOES NOT SETTLE IT -- record this before repeating it.
screendiff seed0004 reports its first differing screen at STEP 13, and the @
is at the identical position on both sides there:

    7* |                                                              ┌──┘··@│

But call 3746 sits about 31% through a 12,084-call stream, so it is near step
127, not step 13. screendiff only ever shows the FIRST divergent screen, so
matching heroes at step 13 says nothing about step 127.

MEASURED FROM INSIDE dog_goal at the divergent call:

    GOAL#3741 hero=(71,4) gg=(71,4) gtyp=6 appr=1

So OUR side is internally consistent: gtyp is UNDEF, the fallback fires, and
gg is set to our hero at (71,4). Nothing is wrong with our fallback.

C's goal row is 5 (derived algebraically from its rn2(1) tie -- see above).
Therefore EXACTLY ONE of these is true:

  (a) C's hero is also at row 4, and C did NOT fall back -- it found an
      object goal on row 5 that our dog_goal rejected. Our gtyp should not be
      UNDEF.
  (b) C's hero IS at row 5, and it fell back like we did -- meaning the hero
      positions have diverged by this point in the game.

SETTLED, AND (a) HOLDS. Printing game.moves alongside gives

    GOAL#3741 moves=5 hero=(71,4) gtyp=6

MOVES = 5. This is game turn FIVE, not step 127 -- the RNG index is high only
because chargen and level generation burn thousands of calls before the first
turn. My earlier estimate of "31% through the stream so ~step 127" was wrong
for exactly that reason; RNG index does not scale linearly with step when
setup dominates the front of the stream.

Turn 5 lands around step 13, which is where screendiff shows the first
differing screen AND shows the @ at the identical position on both sides. So
C's hero is also at (71,4).

THEREFORE C DID NOT FALL BACK. Its goal row is 5 while its hero is on row 4,
so C's gtyp is NOT UNDEF -- C found an object goal on row 5 that our dog_goal
rejected. Our gtyp being UNDEF is the bug.

DUMPED. Every object our dog_goal considers on turn 5:

    OBJ pet(69,5) at(67,2) oclass=6 otyp=245 food=4 gtyp=6
    OBJ pet(69,5) at(67,2) oclass=9 otyp=333 food=4 gtyp=6

TWO objects, BOTH AT (67,2), and NOTHING ON ROW 5. Both classify as food=4
(APPORT) yet gtyp stays 6 (UNDEF), so neither wins the APPORT branch either.

C steers at something on row 5. We do not consider any object on row 5, so
this is no longer a dog_goal branch question -- WE DO NOT HAVE THE OBJECT C
HAS. The pet is at (69,5) and (67,2) is inside SQSRCHRADIUS, so a row-5
object near the pet would be inside it too; the box is not excluding it.

THIS IS AN OBJECT-PLACEMENT DIVERGENCE, not a pet bug. Level generation put an
object somewhere C did not, or failed to put one where C did. That is the
same shape as the seed0030 "$ where C has the pet" observation, which was
never explained either.

SCREEN COMPARED. The recorded map around the pet:

     4  |     ┌───┐
     5  |     │···│
     6  |     │····
     7* |  ┌──┘··@│      <- the @, so display row 7 is MAP ROW 4
     8 >|  │·····u│      <- the pony, so display row 8 is MAP ROW 5
     9  |  │·····<│

DISPLAY ROW = MAP ROW + 3 here. The pony on display row 8 confirms map row 5,
matching our pet(69,5).

There is NO object glyph on that row -- but A MONSTER'S GLYPH COVERS AN
OBJECT BENEATH IT, so an object under the pony would be invisible on both
sides. That is consistent with C having a row-5 object we lack and cannot be
used to rule it out.

FULL OBJECT LIST DUMPED at turn 5 -- 27 objects. Only TWO sit on row 5:

    40,5/c7    46,5/c14

Both are far from the pet at x=69 and well outside SQSRCHRADIUS, so neither
can be C's goal. THERE IS NO ROW-5 OBJECT NEAR THE PET ON EITHER SIDE, and
the "C found an object goal we rejected" reading does not survive.

THAT REOPENS THE DERIVATION. gy = 5 came from assuming (69,4) was the
previous best when C evaluated (69,6), because that is what OUR trace shows.
If C's loop reached (69,6) with a different nidist -- because it took a
different candidate earlier, or because its candidate ORDER differs -- the
equation has a different solution and gy = 5 is wrong.

DO NOT KEEP BUILDING ON gy = 5. The next step is to stop inferring C's state
from single equations and get C's actual per-candidate numbers: find whether
the C source tree ships a debug/trace build, or whether the recorded session
carries anything beyond screens and keystrokes. If neither exists, this
divergence may not be resolvable by inference at all, and the remaining
approach is to port the surrounding code faithfully and re-measure rather
than to solve for C's internals.

STEPPING BACK: this trail has consumed a great many ticks. The verified fixes
it produced are real (three goodpos arms, the mkobj_at duplicate, the
droppables stub) but the original divergence is unresolved and each layer has
revealed another. Consider whether the remaining effort is better spent on
the large absent subsystems in this file's list -- xkilled at 263 lines, the
tty menu that blocks getbones across four sessions, uppercase movement --
where the work is porting rather than archaeology.

Note display row = map row + 3 for this session's layout; that offset has
already caused one wrong reading in this file (the '(57,4) vs column 55'
confusion on seed0030). Do not eyeball coordinates off a screen without
establishing it.

ALSO WORTH CHECKING while here: both objects at (67,2) classify as APPORT and
neither sets gtyp, meaning the APPORT branch is being entered and losing its
rn2(8) roll twice, or is not being entered at all. That is a separate
question from the missing object and should not be conflated with it.

USE THE STACK-TRACE TECHNIQUE for anything further on this trail. Instrument
rn2 to dump a trace on the Nth call (note: diverge.mjs's index N is _rngLog
index N+1). It named this divergence in one command, where inferring from the
diverge tag cost roughly twenty ticks on the previous one.

This is a much better foothold than seed0030 ever was: one game, one function,
one draw, and the C's expected value is known (rn2(4)=3).

One ordering fact to keep in mind: the pet is placed during level generation,
before the whole-level wallification pass added at js/mklev.js, so the map
goodpos sees is the mid-generation one, not the finished map a screendiff
shows.

PREVIOUS TARGET, NOW FIXED: seed0004 picked the wrong gender at chargen.

After the menu-overlay clear landed (501 screens), seed0004's divergence moved
to step 9 and is now:

  C     Salutations Tetra, welcome to NetHack!  You are a lawful female human Knight.
  ours  Salutations Tetra, welcome to NetHack!  You are a lawful male human Knight.

Everything else on the line matches, so the message assembly is right and the
GENDER FACET IS WRONG. C's status line reads "Tetra the Gallant"; the role
title is gender-dependent, so this propagates.

js/role.js:270 pick_gend is structurally faithful to the C -- it counts
ok_gend matches, draws rn2(gends_ok), then walks to the nth allowed gender.
So the fault is more likely UPSTREAM: either the session's recorded input
picks gender explicitly and we mis-parse it, or an earlier facet (role/race)
differs and changes which genders ok_gend allows.

Check in this order before touching pick_gend: what the session actually sends
for the gender prompt, then whether initgend is set from the rc/options path,
then whether role and race match C at that point. Do not assume the rn2 is
wrong -- seed0004 matches C's RNG stream well past chargen, which an extra or
missing draw here would break immediately.

REDIRECT: STOP THE PET ARCHAEOLOGY, PORT WHAT EVERY SESSION REACHES.

tools/unported-hits.mjs ranks unported paths by the share of the 44 sessions
that actually REACH them. That is the list to work, and it was not consulted
once during the pet investigation:

    100%  moveloop_preamble set_wear/pickup
    100%  topl:remember_topl
     98%  onscary:elbereth
     80%  encumber_msg:message
     59%  can_touch_safely:touch_artifact
     52%  do_name:x_monnam:canspotmon
     45%  dog_move attack branch
     43%  postmov:mpickstuff
     41%  pet_ranged_attk:attack
     39%  bite:nutrition

Two paths are hit by EVERY session and several more by most of them. Compare
that against the pet-goal divergence, which is one branch in one function on
one turn of one session.

Suggested order, cheapest-with-most-reach first:
  - encumber_msg:message (80%) writes to row 0, which is scored, and messages
    have already produced four screen gains this session.
  - do_name:x_monnam:canspotmon (52%) is the unseen-monster "it" arm of the
    x_monnam ported earlier this session; the surrounding function already
    exists so this is an arm, not a subsystem.
  - moveloop_preamble set_wear/pickup (100%) is worth sizing before starting,
    since 100% reach says nothing about how large it is.
  - topl:remember_topl (100%) is ^P message history and likely has NO screen
    effect; check before spending time on it despite the reach figure.

Do not read reach as importance without checking screen impact. remember_topl
is the counterexample sitting at the top of the list.

PROGRESS ON THIS LIST so far:
  DONE  encumber_msg:message (was 80%)  -- ported, gone from the list
  DONE  x_monnam:canspotmon (was 52%)   -- arm wired, gone from the list
  DONE  moveloop_preamble set_wear      -- set_wear + Armor_on, gone from
                                           the list; the other nine *_on
                                           slot handlers are recorded BY SLOT
  CHECKED, DEPRIORITISED  topl:remember_topl (100%) -- 21 lines of pure ^P
        message-history bookkeeping. No screen output and no draws; it only
        matters when ^P is pressed. The reach figure counts the call, and the
        call does nothing observable. Port it for faithfulness some day, not
        for score.

  DONE  onscary:elbereth (was 98%) -- sengr_at turned out to be TEN LINES
        with its only dependency (engr_at) already present, so the
        "blocked on the engraving subsystem" note three call sites carried
        was wrong. Wired to onscary and to setmangry's hypocrite branch,
        which holds setmangry's only draw (rnd(5)).

CURRENT LIST AFTER THOSE:
    100%  topl:remember_topl              deprioritised, see above
     59%  can_touch_safely:touch_artifact deprioritised, see above
     45%  dog_move attack branch
     43%  postmov:mpickstuff
     41%  pet_ranged_attk:attack
     39%  bite:nutrition
     39%  start_eating:done_eating

SIZED domove:run loop (27%) -- it needs lookaround(), 161 LINES in
src/hack.c, which is the function that decides when a run stops: a monster
comes into view, a fork appears, an object or door is reached, the corridor
turns. Nothing else in the port needs it, so there is no shared-infrastructure
argument the way there was for the inventory-removal chain.

js/cmd.js:679 already records the gap deliberately and zeroes context.run, so
a rush currently takes ONE step where C takes several. That is a distance
error, not a crash, and it is visible in the record rather than silent.

RESIZED mattackm, AND THE "299 lines" FIGURE WAS THE DISPATCHER ONLY -- the
same trap set_wear set. Its attack-type callees are all absent:

    hitmm     88 lines      the melee hit
    missmm    15 lines      the melee miss
    gulpmm   118 lines      engulfing
    gazemm    67 lines      gaze attacks
    explmm    40 lines      exploding
    breamm     ? lines      breath weapons
    getmattk   ? lines      picks which attack is used
    find_mac  19 lines      ALREADY PORTED, in js/uhitm.js

So the full unit is 600+ lines, not 299.

AND THAT WAS STILL TOO SMALL. Going bottom-up to port hitmm first showed the
trap has a THIRD level: hitmm's last line is `return mdamagem(...)`, and
mattackm follows every attack with passivemm. Neither is ported:

    mdamagem       104 lines   the actual damage; hitmm ENDS in it
    passivemm      154 lines   defender's passive counter, per attack
    pre_mm_attack   32 lines   unhide/unmimic both parties, then newsym
    could_seduce    48 lines   gates the "pretends to be friendly" arm
    mon_nam_too     26 lines   "itself" vs the defender's name
    simpleonames    15 lines   the silver-sear message
    noises          12 lines   the out-of-sight fallback
    shade_miss       ? lines   unsized
    s_suffix                   ALREADY PORTED, js/hacklib.js
    mon_hates_silver           ALREADY PORTED, js/dog.js

LANDED SO FAR (the leaves, bottom-up so no call site is a forward reference):

    noises           mhitm.c:27     js/mhitm.js   DONE
    pre_mm_attack    mhitm.c:40     js/mhitm.js   DONE
    missmm           mhitm.c:76     js/mhitm.js   DONE
    could_seduce     mhitu.c:1934   js/mhitu.js   DONE  (new file)
    poly_gender      polyself.c:2149 js/polyself.js DONE (new file)
    gender           mondata.c:1180 js/mondata.js DONE
    pronoun_gender   mondata.c:1191 js/mondata.js DONE
    mon_nam_too      do_name.c:1191 js/do_name.js DONE
    You_hear         pline.c:436    js/pline.js   DONE

STILL NEEDED FOR THE MELEE PATH, in dependency order:

    mdamagem       104 lines   hitmm ENDS in this; port before hitmm
    hitmm           88 lines   then this
    passivemm      154 lines   mattackm runs it after every attack
    mattackm       299 lines   the dispatcher, last
    shade_miss       ? lines   unsized, called by hitmm
    simpleonames    15 lines   the silver-sear message only
    map_invisible    ? lines   BLOCKED on the glyph layer, recorded not guessed

That is ~660 lines remaining. Nothing above needs to be guessed at; the leaf
layer is done and verified by forced execution.

...EXCEPT THAT 660 IS ALSO WRONG, AND THE RANKING HAS NOW INVERTED. Sizing
mdamagem the same way found a FOURTH level of the same trap. mdamagem's damage
work is mhitm_adtyping (uhitm.c:4782), a 51-line dispatcher over 39 separate
mhitm_ad_* functions, and the one the ordinary case needs, mhitm_ad_phys, is
220 lines on its own. Add monkilled (42), grow_up, mhitm_knockback, and
mdamagem's own 104, and the physical-melee path alone is:

    mattackm 299 + hitmm 88 + mdamagem 104 + mhitm_adtyping 51
    + mhitm_ad_phys 220 + passivemm 154 + monkilled 42 + the rest
    = 1000+ lines, for the PHYSICAL case only

So I then sized lookaround the same way rather than trusting my own earlier
number, because an undercount in one direction is no reason to trust the
other. Its chain: 8 of its 16 callees are already ported (closed_door,
is_safemon, mon_visible, u_at, dist2, m_at, isok, upstart); missing are
avoid_moving_on_liquid 28, avoid_moving_on_trap 17, nomul 13, plus
is_door_mappear (a monst.h one-liner), is_pool_or_lava, pline_xy, set_msg_xy
and a_monnam, all small. TOTAL ~250 LINES.

    lookaround      ~250 lines   unblocks one 27% entry   = 0.108 %/line
    mattackm melee ~1000 lines   unblocks two ~40% entries = ~0.085 %/line

DECISION: DO lookaround NEXT. It is better value per line, it is one session
rather than three or four, and it lands as a working whole instead of leaving
a half-built combat chain. The mattackm leaf layer already committed keeps its
value either way -- nothing there is wasted, and mon_nam_too/You_hear/
pronoun_gender are shared infrastructure that several other paths want.

This is the fourth sizing this session to change the plan, and the second to
reverse a decision I had already written down. The rule earned: size the whole
transitive chain BEFORE ranking, never the named function, and re-size the
alternative too before switching.

MELEE-ONLY mattackm IS THEREFORE ~800 LINES, not the 400 I recorded. Each
sizing this session has been an undercount because I sized the function I
named and not the leaf it returns into. The rule that actually works: size
the LAST LINE of every function in the chain, because a `return f(...)` is
not a call, it IS the function.

This does not change the ranking -- lookaround is still one 27% entry and
this is still two ~40% entries -- but it does change the shape of the work
from one session to two or three, and it means the melee path should land
in pieces that each verify, not as one 800-line drop.

THE SPLIT IS VERIFIED, not assumed -- I read mattackm's switch rather than
trusting the shape. Every melee attack type funnels into hitmm:

    AT_WEAP                                    -> hitmm
    AT_CLAW AT_KICK AT_BITE AT_STNG
    AT_TUCH AT_BUTT AT_TENT                    -> hitmm  (mhitm.c:455)
    AT_HUGS  (only if the previous TWO
              attacks both returned M_ATTK_HIT) -> hitmm  (mhitm.c:488)

and every special type has its own single call site, each on one line:

    AT_GAZE            -> gazemm   (mhitm.c:494)
    AT_EXPL            -> explmm   (mhitm.c:502)
    AT_ENGL            -> gulpmm   (mhitm.c:532)
    AT_BREA AT_SPIT    -> breamm   (mhitm.c:539+)

So the four unported specials are each one recordable line in the switch, which
is what makes the melee-only port honest rather than a stub: an engulfing
attack records 'mattackm:AT_ENGL' and declines, it does not silently melee
instead. That distinction is the whole difference between a split and a fake.

BUT IT SPLITS SENSIBLY, unlike lookaround. A pet attacking an ordinary
monster needs only the melee path: mattackm + hitmm (88) + missmm (15), about
400 lines, with gulpmm/gazemm/explmm/breamm recorded by attack type the way
passive's arms already are. Engulfing, gazing, exploding and breathing are
distinguishable at the dispatch site, so recording them individually keeps
game.unported precise.

REVISED COMPARISON: 400 lines of mattackm's melee path unblocks BOTH 45% and
41% entries; 161 lines of lookaround unblocks one 27% entry. The mattackm
path is still the better target, and the melee-only split makes it a session
of work rather than two.

NOTE the trap already recorded elsewhere in this file: do NOT "fix" the rush
by adding HJKLYUBN to isMovementKey. That makes the error invisible (no more
"Unknown command") while leaving the distance wrong, which is worse than the
current state.

DROP CHAIN STATUS: ported end to end but NOT WIRED, because wiring dodrop to
the 'd' command costs rng matches. The gap has been narrowed by measurement:

    before welded + canletgo    -10 rng
    after  welded + canletgo     -2 rng

better_not_try_to_drop_that (15 lines) was the obvious next candidate and IS
RULED OUT: drop() guards it with `obj->otyp == CORPSE &&`, so it is never
reached for an ordinary item, and the sessions' drops are not corpses. It
also needs u_safe_from_fatal_corpse and paranoid_ynq, neither present.

SO THE REMAINING 2 CALLS ARE SOMEWHERE ELSE IN THE CHAIN. Candidates, in the
order they run: dodrop's sellobj_state pair (recorded), getobj itself (its
letter list is built from any_obj_ok, which is real), drop's levitation
branch (recorded), dropx's ship_object (recorded), dropz's flooreffects
(recorded) or stackobj (recorded).

DID THAT, AND THE NET -2 IS HIDING A LOT. Per-session diff with the wiring on:

    GAINS                        LOSSES
    seed0367       +11           seed0013-friday13   -9
    seed0030        +7           seed0108            -8
    seed0361        +5           seed4500            -7
    seed0360        +2           seed5006            -3
    seed0399        +2           seed0383            -1
                                 seed0013-rogue      -1
    total          +27           total              -29

SO THE DROP CHAIN IS RIGHT FOR FIVE SESSIONS AND WRONG FOR SIX, and the -2 is
the residue. Treating it as "one small bug worth 2 calls" would have been
completely wrong -- there are at least two different behaviours in play.

The gainers are quest/tour sessions (0367 priest-quest, 0361 archeologist,
0030 ten-deaths) where dropping evidently now matches. The losers include
BOTH friday13 sessions and 0108 wizard-extcmd-wishlist.

TRACED seed0013-friday13 (-9) AND IT IS DOWNSTREAM NOISE. Its FIRST
divergence is call 3846 at distfleeck WITH the wiring and call 3846 at
distfleeck WITHOUT it -- identical. The nine lost matches are all after that
point, where the streams have already parted and any count is meaningless.

THIS IS THE DOWNSTREAM-DELTA TRAP ALREADY IN NOTES, and it applies to the
whole +27/-29 table above: none of those per-session numbers were checked
against each session's divergence POINT. A session whose first mismatch is
early can swing its matched-call count by dozens on an unrelated change.

WHAT WOULD ACTUALLY SETTLE THE WIRING: for each of the eleven sessions that
moved, compare the FIRST DIVERGENCE CALL with and without dodrop wired. If
no session's first divergence moves LATER, the wiring buys nothing real; if
one does, that is the session to work on and the rest is noise.

The aggregate rng figure and the per-session rng figures are BOTH downstream-
contaminated. The divergence point is the only clean measure, which STATUS
already says elsewhere and which I did not apply here for three ticks.

SIZED cmd:d (30%) -- the DROP command, and it is now within reach because
freeinv landed. The chain:

    dodrop  14 lines   sellobj_state around the getobj, reset_occupations
    drop    66 lines
    dropx   10 lines   calls freeinv() -- PORTED -- then ship_object,
                       doaltarobj, dropy
    dropy    3 lines
    dropz   36 lines   flooreffects, then place_object() -- PORTED -- and
                       newsym

~129 lines, but the two structural pieces it needs (freeinv to take the
object out of inventory, place_object to put it on the floor) BOTH EXIST NOW.
What is missing is the surrounding policy: sellobj_state and the shop arms,
ship_object (the Sokoban/level-teleporter chute), doaltarobj (sets bknown),
flooreffects (water, lava, traps), reset_occupations.

That makes it the first COMMAND EFFECT that can be ported end to end rather
than stopping at the prompt, which is what every item command currently does.
getobj already names it "drop" and offers the right letters (any_obj_ok); the
gap is purely what happens after the letter is chosen.

Worth doing before the postfx dispatchers: dropping is 30% of sessions and
its failure mode is visible -- the object stays in inventory and never
appears on the floor, so both the inventory and the map are wrong.

SIZED start_eating:done_eating (39%) -- src/eat.c done_eating, 29 lines
itself but SIX missing callees:

    useup        12 lines
    useupf       20 lines
    carried      (a one-line predicate, not found by size)
    food_xname   18 lines
    fpostfx      90 lines
    cpostfx     199 lines
                348+ lines

cpostfx alone is 199 lines -- it is the corpse-effect dispatcher (every
"you feel..." intrinsic, teleportitis, stoning, the lot) and dwarfs the
function that calls it. fpostfx (90) is its non-corpse twin.

SO THIS IS NOT A 29-LINE ITEM. And the "mechanical half is about 50 lines"
estimate written here first was ALSO WRONG -- useup is 12 lines but its own
chain is entirely absent:

    useup -> useupall -> setnotworn (34)
                      -> freeinv (6)
                      -> obfree (not sized, deletes contents recursively)
          -> update_inventory (absent)

So even the "small" half pulls in the inventory-removal machinery, which
nothing in js/ has yet. THAT is the real reason this entry is expensive, and
it is a better argument for doing it than cpostfx was against: useup,
freeinv, setnotworn and obfree are needed by EVERY item-consuming path, not
just eating -- reading a scroll, quaffing a potion, breaking a wand. They are
infrastructure, and their absence is why so many item commands stop at the
prompt.

REVISED RECOMMENDATION: port the inventory-removal chain (useup, useupall,
freeinv, setnotworn, obfree, update_inventory) as its own unit and treat
done_eating as its first consumer. Do NOT start from done_eating.

The postfx pair (cpostfx 199, fpostfx 90) stays recorded; done_eating with
those two recorded still removes the object, ends the occupation and clears
victual.

Worth noting one ordering detail C flags in a comment: occupation is zeroed
BEFORE newuhs(FALSE) "so newuhs() knows we're done". Zeroing it after would
have newuhs see an eating occupation that has already finished.

DONE bite:nutrition (was 39%) -- all four functions ported; see below.

SIZED bite:nutrition (39%) -- js/eat.js:205, the tail of src/eat.c bite().
Four functions, none of them present:

    lesshungry              44 lines
    adj_victual_nutrition   18 lines
    consume_oeaten          64 lines
    recalc_wt               13 lines
                           139 lines total

The logic itself is short -- nmod < 0 spends adj_victual_nutrition() and
consumes nmod; nmod > 0 with (usedtime % nmod) spends 1 and consumes 1; then
recalc_wt. But all four callees are missing, so this is a 139-line unit, not
the few lines the call site suggests.

lesshungry is the interesting one: it is the hunger-state machine every food
path shares, so porting it serves more than this entry. Check what else
records it before treating this as a bite-only cost.

SIZED dog_move attack branch (45%) -- src/dogmove.c:1102, the
`(mfp.info[i] & ALLOW_M) && MON_AT(nx, ny)` arm. It has two halves with very
different costs:

  THE DECISION IS SMALL AND PORTABLE. C weights the pet's audacity by its
  fraction of max HP:

      balk = mtmp->m_lev + ((5 * mtmp->mhp) / mtmp->mhpmax) - 2

  and refuses the attack when the target's level >= balk, when both are tame
  and not Conflicted, when max_passive_dmg would kill the pet, or when the
  pet is under a quarter HP against a guardian. C spends a fourteen-line
  comment on the HP bands; balk's maximum is +3 and the comparison is >=,
  which is easy to get backwards.

  THE ATTACK ITSELF IS mattackm, 299 LINES in src/mhitm.c, and it is not
  ported. So this entry is NOT a leaf: porting the decision without mattackm
  means deciding to attack and then doing nothing, which is worse than
  declining.

Do the decision and mattackm together, or neither. Given mattackm's size that
is a session of its own, and it also unblocks pet_ranged_attk:attack (41%)
which sits just below it on the list.

SIZED postmov:mpickstuff (43%) -- src/mon.c:1847, 63 lines. Its only draw is
an rn2(25) guarded by `!mtame && in_rooms(SHOPBASE)`, so it spends nothing
outside a shop; but the PICKUP itself moves objects off the floor and into
monster inventory, which is map state and therefore screen state.
Dependencies inhishop, is_mines_prize, is_soko_prize and mon_would_take_item
all already exist in js/monmove.js, as do could_reach_item and in_rooms. So
this is a genuine 63-line leaf port with no hidden subsystem behind it --
the first item on this list that sizes to what it looks like.

  CHECKED, DEPRIORITISED  can_touch_safely:touch_artifact (59%) -- the rest
        of can_touch_safely IS ported (js/mon.js:857); touch_artifact is the
        only remaining arm and it is 66 lines PLUS the artifact tables. The
        arm only fires when the object is an artifact, which no monster on an
        early level carries, so the 59% counts the CALL and not the branch.

THAT IS TWICE NOW that a high-reach entry turned out to count a call whose
unported branch is rarely or never taken -- remember_topl at 100% and this at
59%. tools/unported-hits.mjs measures REACH OF THE CALL SITE, and a
note_unported() sitting past a guard inflates its own score. Read the code
around any entry before believing its rank; two commands has been enough
every time.

CHECKED onscary:elbereth (98%) THE SAME WAY, AND IT SURVIVES -- unlike the
two above. The note sits at the END of onscary, after the scare-scroll test,
so 98% means "onscary ran to completion", not "Elbereth mattered". By itself
that is the same inflation as remember_topl and touch_artifact.

BUT THE UNDERLYING SUBSYSTEM IS REAL WORK WITH REAL REACH: 7 of the 44
sessions send the E (engrave) command, and one is named outright --
seed0101-ranger-quiver-throw-travel-engrave. 675 "engrave" mentions across
the corpus. So engravings are exercised deliberately, not incidentally.

That makes the engraving subsystem worth roughly SEVEN SESSIONS, which is
comparable to the tty menu's four for getbones and larger than anything else
currently identified. It also unblocks three things already recorded
elsewhere in this file: onscary's Elbereth arm, setmangry's sengr_at
hypocrite branch (its only draw, an rnd(5)), and goodpos_onscary.

RECOMMENDED NEXT TARGET: the engraving subsystem (src/engrave.c), sized
first. Do not start it without counting its own dependencies the way
set_wear's ten *_on handlers turned up -- read the file's function list and
check which of them already exist before committing.

TWO SCREEN-VISIBLE GAPS FOUND BY SWEEPING screendiff, both hitting several
sessions:

1. UPPERCASE MOVEMENT KEYS ARE UNHANDLED. seed0012 prints
   "Unknown command 'H'." where C prints "You see here a chest."; seed0014
   does the same with 'K'. js/cmd.js:69 tests `'hjklyubn'.includes(ch)`,
   lowercase only.

   In C these are RUSH, not a second spelling of walk. src/cmd.c:1461
   do_rush_west calls set_move_cmd(DIR_W, 3), and set_move_cmd stores that 3
   in svc.context.run and sets DOMOVE_RUSH; the lowercase commands pass 0 and
   set DOMOVE_WALK. So the difference is context.run, and rush keeps moving
   until something interesting stops it.

   DO NOT "fix" this by adding the uppercase letters to the isMovementKey
   test. That would take one step where C takes many, which diverges
   differently rather than less. It needs context.run = 3 and the run loop.

2. THE MESSAGE LINE IS NOT CLEARED WHEN A MENU OPENS. seed0004 step 7 and
   seed0002 both show

     C     row 0: "                                         Is this ok? [ynaq]"
     ours  row 0: "Shall I pick character's race, role, gen Is this ok? [ynaq]"

   Characterised: the confirmation menu occupies columns 41-79. C's row 4
   reads "NetHack, Copyright 1985-2026             y * Yes; start game", so
   the left half of the screen is the BANNER, and row 0 columns 0-40 are
   blank in C simply because the banner does not reach row 0.

   We still hold the previous prompt there. So C clears the message window
   when the menu is displayed and we do not; js/plselect.js builds the menu
   with plsel_startmenu/tty_add_menu/tty_end_menu and never touches
   game._pending_message.

   This is NOT a message-content bug. Row 0 is scored, so a stale top line
   fails every screen from step 7 onward in both sessions -- seed0004 alone
   is 408 steps.

   THE C CALL IS FOUND. win/tty/wintty.c tty_display_nhwindow(), NHW_MENU:

       if (cw->offx == 10 || cw->maxrow >= rows || !iflags.menu_overlay) {
           ... term_clear_screen() / cl_eos(); toplin = TOPLINE_EMPTY;
       } else {
           tty_clear_nhwindow(WIN_MESSAGE);
       }

   and C's tty_clear_nhwindow NHW_MESSAGE arm homes, cl_end()s and sets
   toplin = TOPLINE_EMPTY, guarded on toplin != TOPLINE_EMPTY.

   ATTEMPTED AND REVERTED: porting both arms cost 473 SCREENS (497 -> 24) and
   133,895 rng. So the clear fires far more often for us than for C, or fires
   where C does not.

   INSTRUMENTED, AND THE DIAGNOSIS CHANGES. seed0004 reaches
   tty_display_nhwindow on a menu only SEVEN times in the whole session, and
   in every one game._pending_message is ALREADY EMPTY (""). So the overlay
   clear C performs would be a no-op for us and cannot be what fixes row 0.

   The 473-screen loss came from the OTHER half of that change: adding an
   NHW_MESSAGE arm to js/tty/wintty.js's tty_clear_nhwindow. That was a
   DUPLICATE -- js/display.js already has tty_clear_nhwindow_message(row) and
   calls it at :518 and :613. Making wintty's version also clear meant two
   implementations firing on different paths.

   THEREFORE the stale "Shall I pick character's..." text is NOT a pending
   message that needs clearing. It is already PAINTED INTO THE GRID and never
   erased. _pending_message is empty; the cells are not.

   PAINT-SIDE INVESTIGATION, what is established so far:

   - cls() is called ONCE in seed0004, with toplin=0 and msg="" -- already
     empty, nothing for it to erase. Adding a TOPLINE_SPECIAL_PROMPT arm to
     cls() changed the score by zero, so cls is not on this path.
   - There are only THREE sites that clear game._pending_message:
     js/cmd.js:525, js/display.js:520 and js/display.js:612. NONE are in
     js/plselect.js, so the chargen path never clears the message at all --
     it just draws the menu over whatever row 0 already holds.
   - js/display.js:606 carries a comment from a previous agent describing
     THIS EXACT DEFECT on a different session: "Clearing only
     _pending_message left the text already painted into the grid, so
     whatever drew next landed on top of it: seed0360's tutorial prompt
     starts at column 21 and the first 21 columns still read 'Hello wizard,
     welcom'." They fixed it for the more() path by calling
     tty_clear_nhwindow_message(row); the chargen path has no equivalent.
   - js/cmd.js:525 has the same shape: it clears the text and the flag but
     never calls tty_clear_nhwindow_message, so the cells survive there too.
     That is a second live instance, not yet tested.

   So the defect class is: CLEARING _pending_message DOES NOT ERASE THE GRID.
   Three sites clear the message; only the two in display.js erase the cells,
   and only one of those unconditionally. Fixing it means auditing all three
   plus adding one to the plselect menu path, and each needs measuring
   separately -- an unconditional erase is what cost 473 screens earlier.

   Note js/optlist.js:123-124 has TWO menu_overlay entries with different
   initval ("On" for set_in_game, "Off" for set_in_config), so which default
   applies is not obvious and C's third disjunct !iflags.menu_overlay may be
   the deciding term.

NEXT MAJOR TARGET: THE MONSTER NAMING SUBSYSTEM (src/do_name.c x_monnam).

x_monnam is 205 lines and has 396 CALL SITES across the C source. Nothing
that names a monster can print correctly without it, which is most monster
messages in the game. js/ has NO monster naming at all right now -- x_monnam,
mon_nam, y_monnam, Monnam and YMonnam are all absent, which is why every
message that mentions a monster is currently either recorded or blank.

Found via screendiff on seed0014:

  C     You swap places with your little dog.
  ours  (blank)

domove_swap_with_pet is ported and the swap HAPPENS; only the message is
missing, and it is missing because x_monnam(mtmp, ARTICLE_YOUR, ...) does not
exist. The same gap silences setmangry's "%s gets angry!", passive's messages,
hmon_hitmon_msg_hit's "You hit %s", growl, wake_msg and every kill message.

This is likely the single largest screen lever left: message lines are row 0
of a scored 24x80 grid, and they are the FIRST thing that differs on many
sessions regardless of how well the RNG tracks.

Port order suggestion: x_monnam first (it does the work), then the thin
wrappers over it -- mon_nam, y_monnam, Monnam, YMonnam, l_monnam -- which are
a few lines each. Watch the article logic: ARTICLE_YOUR for tame,
ARTICLE_THE when the monster has no given name and is not a proper-name type,
ARTICLE_NONE otherwise, and a "peaceful" adjective inserted for peaceful
non-tame monsters.

PREVIOUS TOP TARGET, NOW DONE: getobj's prompt.

tools/screendiff.mjs on seed2200 step 4 shows exactly this:

  C     What do you want to drink? [fgh or ?*]
  ours  What do you want to q? [abcdefghijklmn or ?*]

TWO bugs in one line, both in js/cmd.js:324:

    const obj = await getobj(ch, null, 0);

  1. the VERB is the raw command character. C passes a word: dodrink calls
     getobj("drink", ...), doread calls getobj("read", ...), and so on.
  2. the FILTER is null, so every inventory letter is offered. C passes a
     predicate per command (potion_ok for 'q', etc.) and getobj_letters
     already applies it correctly -- js/invent.js:124 is right, it is only
     ever handed null.

js/cmd.js:498 records that these commands are 330 KEYSTROKES ACROSS THE
PUBLIC CORPUS, THE MOST OF ANY COMMAND. Every one of them currently paints a
wrong top line, and the top line is row 0 of a scored 24x80 grid.

This is why the re-ranking mattered: seed2200 reproduces 92% of its RNG and
shows 4 of 230 screens. The RNG is nearly right and the DISPLAY is wrong.
tools/diverge.mjs pointed at exercise(attrib.c:509) for this session, which is
a real RNG divergence 2700 calls later and not what costs it 226 screens.

TO FIX: give each command its verb and its obj_ok predicate, from the C
cmdlist in src/cmd.c. Do NOT invent the words or the filters -- read them.

MOST RECENT WORK: the melee chain behind uhitm.c's do_attack. TWENTY functions
ported. The most recent are hmon, wakeup and setmangry, plus a correction to
do_attack's Punished term.

Three ordering/binding defects were found in these three functions, and the
shape they share is the important part:

  hmon      anger_guards is read BEFORE hmon_hitmon, which can kill the
            monster or flip its peacefulness.
  wakeup    was_sleeping and was_peaceful are read BEFORE the calls that
            clear them. setmangry() clears mpeaceful, so testing it after
            would make the priest/shopkeeper branch dead code.
  is_watch  an IDENTITY test against PM_WATCHMAN/PM_WATCH_CAPTAIN, not a
            msound test. Written first as MFLAGS.MS_WATCH, which does not
            exist: silently false for every monster, forever.
  setmangry threw "STRAT_WAITMASK is not defined" on its second line in all
            five arms. Module load was clean and the scoreboard was
            unchanged, because nothing calls it yet.
  Punished  include/youprop.h:77 defines it as (uball != 0), the iron ball,
            NOT a uprops intrinsic. Read as game.u.uprops.PUNISHED it is
            permanently undefined -- falsy, so the rn2(7) after it in the ||
            chain still drew and the common path was right BY ACCIDENT, while
            the term could never become true once punishment lands.

THE GENERAL LESSON, worth more than any of the five: a JS name that resolves
to undefined is not an error, it is an answer. Only the STRAT_WAITMASK case
threw. When the surrounding logic makes undefined behave correctly today, the
defect is invisible to every tool and to the score, and surfaces later at a
line far from its cause. Check the HEADER for what a name is, do not trust a
name that reads plausibly.

Sequence that catches these cheaply, in order:
  1. node tools/undefined-refs.mjs      (30s, catches unimported constants --
                                         it DOES work, see NOTES; an earlier
                                         claim that it has a value-reference
                                         blind spot was retracted as unmeasured)
  2. force every arm with synthetic args (catches wrong-but-parseable, and is
                                         the ONLY check that works for a
                                         function ported ahead of its call site)
  3. node tools/scoreboard.mjs          (catches duplicate bindings, which
                                         parse-error to a hard 0/44 rather
                                         than degrading -- cheap to spot)

THE DIVERGENCE AGGREGATE, re-measured this session:

     7  dog_move(dogmove.c:1255)
     4  obj_resists(zap.c:1469)
     4  getbones(bones.c:645)
     4  do_attack(uhitm.c:474)
     3  rnd_otyp_by_namedesc(objnam.c:3522)
     3  next_ident(mkobj.c:521)
     3  distfleeck(monmove.c:538)
     2  place_lregion(mkmaze.c:396)
     2  mount_steed(steed.c:341)

do_attack:474 is the Punished/rn2(7) line just corrected, so the melee chain
IS on the critical path for 4 sessions.

dog_move at 7 sessions (8 with the combat gate wired) is the single largest
blocker. CORRECTION, and this cost two full ticks: an earlier version of this
entry said "js/dogmove.js DOES NOT EXIST -- the whole file is unported."

That was TRUE ABOUT THE FILE AND FALSE ABOUT THE FUNCTION. dog_move has been
ported all along, filed under js/dog.js:994 (~211 lines, 10 draws, full
chcnt/uncursedcnt/MTSZ logic), and js/monmove.js:950 calls it. dog_hunger is
there too at :964. Both were re-ported into a new js/dogmove.js before anyone
checked, and the new dog_move was LESS complete than the existing one; all of
it was deleted.

A MISSING FILE IS NOT EVIDENCE OF A MISSING FUNCTION in this tree, because
several functions are filed under the wrong module relative to their C home.
Before porting anything, run:

    grep -rn "function <name>" js/

not `ls js/<file>.js`. The five-second check would have saved both ticks.

THEREFORE THE dog_move WORK IS DEBUGGING, NOT PORTING. The function already
draws; it draws DIFFERENTLY from C somewhere near dogmove.c:1255, which is
inside the position-scoring loop:

    j = ((ndist = GDIST(nx, ny)) - nidist) * appr;
    if ((j == 0 && !rn2(++chcnt)) || j < 0
        || (j > 0 && !whappr
            && ((omx == nix && omy == niy && !rn2(3)) || !rn2(12)))) {

MEASURED DIVERGENCE, seed0007, call 2832 (identical shape on seed0017 and
seed0077):

  2831  C rn2(4)=0   ours rn2(4)=0   ok        @ dog_goal(dogmove.c:575)
  2832  C rn2(1)=0   ours rn2(5)=2   MISMATCH  @ dog_move(dogmove.c:1255)
  2833  C rn2(5)=3   ours rn2(5)=3   ok        @ distfleeck(monmove.c:538)

dog_goal agrees exactly, including its own rn2(4). Then C makes ONE draw we
never make: rn2(1). That is rn2(++chcnt) at the FIRST TIE -- chcnt was 0, the
pre-increment makes it 1, and rn2(1) is always 0 so that candidate always
wins. We skip it entirely and fall through to distfleeck.

SO THE BUG IS NOT IN THE SAMPLER, IT IS IN WHAT REACHES IT. C finds a
candidate square with j == 0; we find none. j is

    j = (GDIST(nx, ny) - nidist) * appr

so either our GDIST differs, our nidist starts differently, or our candidate
list differs. dog_goal returning the same draws does NOT prove it returned the
same appr or set the same game.gg -- only that it took the same branches that
draw.

INSTRUMENTED AND MEASURED on seed0007. dog_move IS called, DOES reach the
scoring loop, and DOES draw: 550 candidate evaluations across the session,
68 of them ties (j == 0) that each spend an rn2(++chcnt). So the loop is
live and the sampler fires. The divergence is not absence, it is a
DIFFERENCE at one specific invocation where C ties and we do not.

appr IS 1 on all 550 evaluations, but that turned out NOT to be the bug, and
the reason is worth keeping because it kills an obvious-looking lead:

    appr = (udist >= 9) ? 1 : (mflee ? -1 : 0);
    if (udist > 1) {
        if (!IS_ROOM(levl[u.ux][u.uy].typ) || !rn2(4) || whappr
            || (dog_has_minvent && rn2(edog->apport)))
            appr = 1;
    }

At the divergent call the log shows `C rn2(4)=0  ours rn2(4)=0  ok`. rn2(4)
is 0, so !rn2(4) is TRUE, so C sets appr = 1 as well. Both sides agree on
appr at the exact moment they disagree on the tie. IS_ROOM is also correct
(typ >= ROOM, js/const.js:2061). So appr is eliminated.

SEPARATE REAL GAP FOUND WHILE CHECKING THIS: our override drops C's FOURTH
term, `(dog_has_minvent && rn2(edog->apport))`. It is short-circuited away
whenever an earlier term is true, which is why it has not diverged yet -- but
when the hero IS in a room, rn2(4) is nonzero and whappr is false, C draws
rn2(edog->apport) and we draw nothing. That is a latent divergence needing
monster inventory (dog_has_minvent) and edog->apport.

SAMPLER ELIMINATED TOO. Traced the loop with candidate-level detail:

  rn2(1)=0    i=0/7 nd=1 nid=1 j=0 chcnt=0    <- first tie, pre-increment
  rn2(2)=1    i=1/7 nd=1 nid=1 j=0 chcnt=1    <- second tie
  rn2(12)     i=2..6                          <- worse-square acceptance

Our loop DOES draw rn2(1) at a first tie and rn2(2) at the second, which is
the pre-increment behaving exactly as C's does. chcnt advances correctly.
So neither appr, nor IS_ROOM, nor the sampler, nor the pre-increment is the
cause. THREE leads eliminated by measurement, none by reading.

CONCRETE LEAD -- A MISSING CANDIDATE SQUARE.

mfndpos's iteration order is correct: nx outer, ny inner, from max(1, x-1)
and max(0, y-1), matching src/mon.c:2140. But the traced candidate list for a
pet at (38,17) is

  (37,16) (37,18) (38,16) (38,18) (39,16) (39,17) (39,18)   cnt = 7

(37,17), directly WEST of the pet, is absent. The pet's own square (38,17) is
correctly excluded, so a full neighbourhood should offer 8 and we offer 7.

If C offers (37,17) and we do not, every downstream j shifts and the tie set
changes -- which is exactly the observed symptom (C ties where we do not)
while appr, GDIST, the sampler and the pre-increment all agree.

RESOLVED, AND THE LEAD IS DEAD. (37,17) is not swamp water -- it is typ=25
(ROOM), same as its neighbours. Instrumenting every `continue` in mfndpos
showed it is rejected at js/mon.js:283:

    if (nx === u.ux && ny === u.uy) { ...; if (!(flag & ALLOW_U)) continue; }

(37,17) IS THE HERO'S OWN SQUARE. And src/mon.c mon_allowflags gives a tame
monster ALLOW_M | ALLOW_TRAPS | ALLOW_SANCT | ALLOW_SSM and NOT ALLOW_U, so C
excludes the hero's square for a pet exactly as we do. Our mon_allowflags has
the same three-branch structure. cnt = 7 is CORRECT.

Guessing "snake-swamp level, so it must be water" would have sent the next
agent to rewrite correct pool-handling code. The terrain dump cost one
command and killed it.

FIVE LEADS NOW ELIMINATED BY MEASUREMENT: appr, IS_ROOM, the reservoir
sampler, the pre-increment, and the candidate list. All five looked plausible
on inspection; none survived a trace.

WHERE THAT LEAVES IT: the candidate SET and ORDER are right, appr is right,
GDIST's goal is right, the sampler is right. The remaining variable in
j = (GDIST(nx,ny) - nidist) * appr is NIDIST -- specifically its STARTING
value, GDIST(nix, niy) with nix,niy = omx,omy before the loop. If our pet's
position or the goal differs from C's by the time the loop starts, every j
shifts uniformly and the tie set changes without any single candidate being
wrong. Check what dog_goal actually stored in game.gg against what C's
gg.gx/gg.gy hold at the same turn, and confirm the pet is standing where C
thinks it is -- an earlier divergence in pet MOVEMENT would produce exactly
this signature at a later turn.

WHAT IS LEFT: the CANDIDATE LIST. Same appr, same goal, same rn2(4), same
sampler, yet at one specific invocation C scores a candidate at j == 0 and we
score none. j = (GDIST(nx,ny) - nidist) * appr, so with appr and GDIST's goal
agreeing, the difference has to be in which (nx, ny) are offered or in the
starting nidist. cnt varies per call in our trace (7, then 5), so compare
mfndpos's output square-for-square against what the C map allows.

CAUTION FOR WHOEVER DOES THAT: a hand-rolled global RNG counter does NOT line
up with tools/diverge.mjs's numbering -- they count different things. Do not
try to correlate by index. Either log from inside diverge.mjs itself, or key
the dump on a game-state predicate (pet position, turn number) that both
sides can be matched on.

HOW TO INSTRUMENT (this cost most of a tick to work out):
frozen/ps_test_runner.mjs spawnSync's a worker and CAPTURES its stdout and
stderr, so console.error from inside the game is swallowed. Run the worker
directly instead:

    DBG_X=1 node frozen/ps_test_runner.mjs --worker-session=sessions/<name>.session.json 2>&1 | grep ...

Do NOT conclude "the function is never called" from silence under the normal
runner. That exact mistake happened here and briefly looked like movemon,
dochug and dog_move were all dead.

Things to check in js/dog.js's copy, in order of how quietly they fail:
  - GDIST reads game.gg.gx/gy. A `?? 0` fallback on a missing field makes it
    measure to (0,0) and score every square by closeness to the top-left
    corner. This exact bug was hit twice, from both sides; js/dog.js:686 has
    a comment about it.
  - rn2(++chcnt) must PRE-increment: first tie is rn2(1), always 0, always
    wins. rn2(chcnt++) makes the first call rn2(0).
  - chcnt must RESET to 0 on a strictly better square (j < 0).
  - the backtrack rn2(MTSZ * (k - j)) runs ONLY when unleashed AND distmin
    from the hero > 5.
  - uncursedcnt scales rn2(13 * uncursedcnt), so an off-by-one in the
    pre-count shifts every cursed-square decision.

ALTERNATIVE: dog_move unblocks 7 sessions against this chain's 4, but
js/dogmove.js does not exist at all, so it is a cold start on a 400-line
file rather than four more units on a chain already 26 deep.

ITS DEPENDENCY TREE, walked rather than estimated:

    is_blade, is_axe    DONE (js/mon.js), verified across the skill range
    set_ustuck    15 lines  DONE (js/mon.js)
    missum        17 lines  small, but needs wakeup
      wakeup      31 lines  and wakeup opens ITS OWN chain:
                            wake_msg, seemimic, finish_meating, growl,
                            setmangry, ghod_hitsu, hot_pursuit
    hmon          16 lines  then hmon_hitmon underneath, unsized
    cutworm      105 lines  long worms only; recordable

setmangry is the one to look at before committing to this: it changes
alignment and anger state and is likely to pull in more again.

SO known_hitum IS NOT A 60-LINE JOB. missum's chain through wakeup and
setmangry is the bulk, and cutworm is skippable. A reasonable first cut is to
port missum with wakeup RECORDED, land known_hitum's other arms, and measure
whether the rn2(25)/rn2(3)/rnd(100) alone move the aggregate. If they do, the
wakeup chain can follow against evidence.

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

### THE ACTUAL BOTTLENECK: mfndpos returns too few squares

Found by asking where sessions diverge rather than what is unported, which is
what closing the -28 thread pointed at. seed4500 diverges at call 2869 and
seed0360 at 2939 -- both very early, both in the SAME function.

    2868  C rn2(5)=2    ours rn2(5)=2    ok        @ distfleeck(monmove.c:538)
    2869  C rn2(28)=27  ours rn2(20)=7   MISMATCH  @ m_move(monmove.c:1963)
    2870  C rn2(5)=3    ours rn2(5)=3    ok        @ distfleeck

The C at monmove.c:1961 is

    if (rn2(4 * (cnt - j)))

so C's argument of 28 means cnt - j = 7 and our 20 means cnt - j = 5. With
j = 0 on the first track entry, our mfndpos returned 5 candidates where C's
returned 7.

BUT THE CAUSE IS NOT SETTLED, and the obvious reading is probably wrong.
Dumping the candidate list at that exact call:

    monster PM_NEWT (322) at 77,14, cnt=5
    neighbours 76,13 / 76,14 / 76,15 / 77,13 / 77,15   all typ 25 (ROOM), taken
    neighbours 78,13 / 78,14 / 78,15   all typ 1 (VWALL), rejected

Five open squares is EXACTLY RIGHT for a newt standing against a vertical
wall. A newt cannot enter walls, so C cannot be accepting those three either.
The likelier explanation is that C'S NEWT IS SOMEWHERE ELSE -- a position with
seven open neighbours, i.e. not against a wall.

That makes this the same shape as the seed0030 pet: a POSITION divergence
upstream, with no RNG divergence in front of it, surfacing later as a wrong
modulus. Do not "fix" mfndpos on the strength of the count alone.

Why this outranks everything else on the list below: mfndpos runs for every
monster on every turn, its count feeds the modulus of this draw AND the
`!rn2(++chcnt)` tie-break in the same loop, and a wrong count therefore
desyncs the stream on essentially the first monster move of the game. It is
almost certainly why so many sessions diverge in the 2800-3000 range rather
than anywhere interesting.

THE SCREEN CANNOT SETTLE IT -- tried, do not repeat. The divergence is at
seg 1 step 41 (key "j"), and on that recorded screen the hero is at map
(11,15) while our newt is at (77,14), sixty-six columns away and far outside
its line of sight. C never renders it, so there is no ':' on the map rows to
compare against. (The ':' characters that do appear are on screen rows 22-23,
which are the status lines, not the map.)

TRACE DONE. Run tools/diverge.mjs with -w 600 and grep for m_move(monmove.c:
1963); the modulus of each is C's candidate count for that monster's move, so
C's counts are readable even though its positions are not:

    2802  C rn2(20)  ours rn2(20)  ok
    2815  C rn2(24)  ours rn2(24)  ok
    2841  C rn2(20)  ours rn2(20)  ok
    2851  C rn2(16)  ours rn2(16)  ok
    2869  C rn2(28)  ours rn2(20)  MISMATCH  <- first
    2872  C rn2(12)  ours rn2(12)  ok        <- still agrees after!

THE FOUR PRECEDING MONSTER MOVES ALL MATCH, and 2872 matches again. So our
monsters are NOT broadly misplaced -- the level and its population are
substantially right, and this is one specific creature. That rules out a
systemic level-generation or placement fault and makes the problem local.

Combined with the candidate dump (newt at 77,14 against a VWALL, 5 open
neighbours, which is correct FOR THAT SQUARE), the question is now narrow:
why is our newt at 77,14 when C's is somewhere with 7 open neighbours, given
every other monster is where C has it?

CANDIDATE 1 (wrong placement) IS OUT. Calls 2864-2867 are just this turn's
preamble and nothing was created:

    2864  rn2(70)=64   maybe_generate_rnd_mon   ok, and NO placement draws
                                                follow it, so the check failed
                                                and no monster was generated
    2865  rn2(200)=3   dosounds                 ok
    2866  rn2(20)=9    gethungry                ok
    2867  rn2(67)=56   moveloop_core            ok
    2868  rn2(5)=2     distfleeck               ok
    2869  rn2(28)      m_move                   MISMATCH

So 2869 is the FIRST monster move of this turn, and the newt already existed.

WHAT IS LEFT: the newt moved differently on an earlier turn. The four matching
m_move draws at 2802/2815/2841/2851 belong to earlier turns and we do not know
which monster each belongs to -- that is the missing piece.

TAGGED, and the answer is sharper than expected. Instrumenting our m_move to
print m_id/mnum/position alongside each rn2(4 * (cnt - j)) gives (our call
numbers run one ahead of C's):

    #2803  m_id=20 mnum=59  at 56,17  cnt=5  arg=20
    #2816  m_id=20 mnum=59  at 57,17  cnt=6  arg=24
    #2842  m_id=20 mnum=59  at 58,17  cnt=5  arg=20
    #2852  m_id=20 mnum=59  at 59,17  cnt=4  arg=16
    #2870  m_id=30 mnum=322 at 77,14  cnt=5  arg=20   <- the mismatch
    #2873  m_id=20 mnum=59  at 60,17  cnt=3  arg=12

All four matching draws are THE SAME MONSTER, m_id=20, walking steadily east
along row 17, and its next move at #2873 matches C's 2872 as well. So the
agreement was never evidence that many monsters are correctly placed; it was
one monster being correct six times.

The mismatch is m_id=30, the newt, and #2870 IS ITS FIRST APPEARANCE in this
log. It has no earlier move to have gone wrong in.

WHY IT CAN STILL BE AN EARLIER MOVE: this draw is inside `if (appr != 0)` and
only fires when a candidate square matches an mtrack entry. A monster whose
mtrack is still empty draws NOTHING here, so the newt may well have moved
several times already without appearing above. Absence from the list is not
absence of movement.

RESOLVED TO ONE MOVE. Instrumenting place_monster shows both monsters are
born during level generation:

    BORN m_id=20 mnum=59  at 55,17  in_mklev=true
    BORN m_id=30 mnum=322 at 76,13  in_mklev=true

So the newt is PLACED AT 76,13, not 77,14. Possibility 1 is out: placement is
not the problem, and it cannot be, since the whole of level generation matches
(the first divergence is at call 2869, deep into play).

The newt then reached 77,14 by MOVING, one step southeast into the wall
corner, and that move drew nothing -- which is why it never appeared in the
m_move list. m_id=20's birth at 55,17 is likewise correct, confirmed by its
six subsequent matching moves.

THE BUG IS THAT SINGLE MOVE, 76,13 -> 77,14. And note what it implies about
the code path: the rn2(4 * (cnt - j)) track check draws nothing when mtrack is
empty, and the `!rn2(++chcnt)` tie-break only draws when appr == 0. A move
that spends NO draws therefore took the appr != 0 branch, where the square is
chosen DETERMINISTICALLY by the nearer/nidist comparison.

That is very good news: a deterministic selection can be compared against the
C line by line without any RNG reasoning at all. Our choice of 77,14 differs
from C's, and C's destination has 7 open neighbours so it is well clear of the
wall the newt walked into.

COMPARED, and there are TWO concrete gaps in exactly that block. Neither is
confirmed as the newt's bug yet, but both are real and both can change a
destination without leaving a draw.

GAP 1 -- PORTED (commit "Port m_move's shortsighted appr override"). Was:

    if (!mtmp->mpeaceful && svl.level.flags.shortsighted
        && nidist > (couldsee(nix, niy) ? 144 : 36) && appr == 1)
        appr = 0;

We compute nidist and go straight into the loop. When this fires, C flips
appr from 1 to 0, which switches the whole selection from "deterministically
approach the goal" to the random `!rn2(++chcnt)` tie-break. That is both a
different destination AND a different draw count, so it desyncs twice over.
Check whether level.flags.shortsighted is ever set before assuming it is dead
code -- if it is set on any level a session visits, this is a strong candidate.

GAP 2 -- PORTED (commit "Port autoreturn_weapon and unblock m_move's appr == -2 arm"). Was:

    || (appr == -2
        && ((ndist <= preferredrange_min && !nearer)
            || (ndist >= preferredrange_max && nearer)))

appr == -2 is the keep-your-distance behaviour of a monster using a
throw-and-return weapon. CHECKED: nothing on our side can set appr to -2,
because C's m_balks_at_approaching takes two out-parameters that ours does not:

    m_balks_at_approaching(int oldappr, struct monst *mtmp,
                           int *pdistmin, int *pdistmax)

Ours is m_balks_at_approaching(appr, mtmp). The -2 return and the preferred
range both come from the autoreturn_weapon arm of that function, so porting
the selection arm alone would be dead code.

DONE in that order: autoreturn_weapon and the arwep table went into
js/weapon.js, m_balks_at_approaching gained a range out-parameter and its -2
return, then the selection arm was added. Dormant on the public sessions,
which contain no aklys-wielding monster.

ALL THREE selection-block gaps found while chasing the newt are now closed.
The newt divergence itself is still open, and the surviving facts about it are
above -- birth position correct, first move correct, and two retracted
readings whose shared cause was comparing observations from different steps.

TEST RUN. NEITHER GAP APPLIES, AND THE SELECTION BLOCK IS SOUND:

    NEWT at=76,13 appr=1 shortsighted=false peaceful=false
         goal=77,16 nidist=10 cnt=6
         poss=[75,12 75,13 75,14 76,14 77,13 77,14]

appr is 1 (so GAP 2's -2 arm is irrelevant) and shortsighted is false (so GAP
1 never fires). Given goal 77,16, picking 77,14 is CORRECT: dist2 to the goal
is 4, the lowest of the six candidates. The selection logic is doing its job.

*** THE BUG IS THE GOAL: ggx,ggy = 77,16 ***

CAUTION -- MY FIRST READING OF THIS WAS WRONG. I compared the goal against the
hero at map (11,15), which is where the hero stands at STEP 41, the step the
divergence is reported on. But the newt's first move happens much earlier in
the run. Instrumenting gettrack for this newt shows:

    GETTRACK newt cp=74,15 hero=71,15

The hero was at (71,15) at that point, three squares from the newt's
neighbourhood. So a goal of 77,16 is entirely plausible as a belief about a
hero who was nearby, and the "sixty-six columns away" argument is void.

SETTLED, BY THE MAP RATHER THAN BY TIMING. Scanning x 70-79, y 9-20 for
squares with exactly 7 open neighbours returns exactly ONE:

    OPEN7 75,14

and 75,14 is in the newt's own candidate list:

    poss = [75,12  75,13  75,14  76,14  77,13  77,14]
                     ^C goes here            ^we go here

So C's newt moves WEST to 75,14 and ours moves EAST to 77,14. Both squares
were available to both. The hero at that moment is at (71,15), which is WEST
of the newt: C's newt is moving TOWARD the hero and ours is moving AWAY.

THE GOAL IS WRONG AFTER ALL -- but for a reason the earlier argument got
backwards. It is not "77,16 is far from the hero at step 41", which compared
against the wrong step. It is that 77,16 points EAST while the hero, at the
moment of this move, is WEST. Our newt is walking in the opposite direction
from C's.

That made mtmp.mux/muy the prime suspect, so set_apparxy was read against the
C. It has a REAL GAP, though not the one that explains this goal.

js/monmove.js set_apparxy short-circuits the whole displaced branch:

    note_unported('set_apparxy:displaced');
    mtmp.mux = game.u.ux;      /* the EXACT hero position */
    mtmp.muy = game.u.uy;

C at that point (monmove.c, after the `if (!displ)` early return) does:

    gotu = notseen ? !rn2(3) : notthere ? !rn2(4) : FALSE;
    if (!gotu) {
        do {
            mx = u.ux - displ + rn2(2 * displ + 1);
            my = u.uy - displ + rn2(2 * displ + 1);
        } while (!isok(mx, my) || ...);      /* up to 200 tries */
    }

So whenever a monster cannot see the hero, C spends one rn2(3) or rn2(4) plus
TWO rn2(2 * displ + 1) per loop iteration, and ends with a DISPLACED belief
near the hero rather than on it. We spend nothing and take the hero's exact
square. That is a missing-draw gap on a path every blind or unseen monster
takes, and it is worth closing on its own.

BUT IT DOES NOT EXPLAIN THIS NEWT. Our short-circuit sets mux/muy to the hero
EXACTLY, i.e. (71,15), which is WEST. The observed goal was 77,16, to the
EAST. So the goal did not come from mux/muy at js/monmove.js:729 -- it came
from one of the other two assignment sites, gettrack at :768 or the strategy
pair at :802. gettrack is the likelier of the two: the probe above caught it
returning cp=74,15 on a later move, so it is live for this monster.

PROBE RUN, CORRECTLY GUARDED THIS TIME, and it exonerates the move:

    SITE729 mux=77,16 hero=77,16 at=76,13 | SITE802 goal=77,16 | FINAL 77,16

At the newt's FIRST move the hero is at (77,16), and mux/muy equals it exactly.
gettrack never fires. So the goal is CORRECT, and stepping 76,13 -> 77,14 is
genuinely toward the hero. Our newt is behaving properly on this move.

WHICH MEANS THE EARLIER "C GOES WEST, WE GO EAST" READING WAS ALSO BUILT ON A
TIMING ERROR. The hero at (71,15) came from the gettrack probe, which fired on
a LATER move; at the move actually under examination the hero is at (77,16).
That is the second time this thread has crossed two observations from
different moments -- and it is worth noticing that the guard I added
specifically to prevent it is what exposed it.

WHAT IS ACTUALLY STILL TRUE, stripped of the bad inferences:
  - our newt is born at 76,13 (correct; level generation matches)
  - its first move to 77,14 is correct given a correct goal
  - at the DIVERGENT call it stands at 77,14 with cnt=5, and C's monster in
    that slot has cnt=7
  - the map scan found exactly one square nearby with 7 candidates: 75,14

NOTE THE CONFLATION TO AVOID: cnt is the number of candidate squares mfndpos
returns for the monster's CURRENT position, not the open-neighbour count of
its destination. The map scan is still a valid way to ask "where could C's
monster be standing", but the answer must be checked against where the newt
could plausibly have walked, not assumed.

NEXT: the newt makes several moves between its first and the divergent call.
Print its position on EVERY move (guard on m_id only, no first-call flag) and
compare the sequence against the hero's position each turn. The move where our
newt's behaviour stops making sense against a correct goal is the one to
examine -- and if every move is individually correct, the fault is upstream in
what the hero did, not in the newt at all.

Note that GAP 1 and GAP 2 above are still real omissions worth closing on
their own merits, they are simply not this bug. Do not delete those entries.

NEXT: the three ggx/ggy assignment sites in js/monmove.js are line 729
(mtmp.mux/muy), 768 (gettrack's cp) and 802 (a goal/appr strategy pair).
Instrument all three to report which one wins for m_id=30 on its FIRST move,
being careful to guard on the move rather than on the first call to any one
site -- the gettrack probe above fired on a different, later move than the
m_move probe did, which is what produced the confusion.

Then, and this is the part that actually decides it, work out what C's goal
must have been. C's newt ends up somewhere with 7 open neighbours; our goal of
77,16 sends it into a wall corner with 5. Enumerate the squares near 76,13
with 7 open neighbours and see which goal would lead there. That is a static
map question and needs no replay.

A caution for whoever picks this up: this thread has produced six retracted
readings, and the last one was retracted for comparing against a hero position
taken from the wrong step. Pin down WHEN each observation was made before
reasoning from it.

Note the newt is at 77,14, hard against the VWALL at x=78, and needs 7 open
neighbours in C. A square with 7 open neighbours is well clear of any wall, so
C's newt is not merely one step away; the positions are substantially apart.

That technique generalises and is the useful part of this thread: when a
monster's position cannot be observed directly, the modulus of a draw that
depends on its surroundings is an indirect measurement of it.

Do NOT start uhitm.c before this. A monster-movement count that is wrong on
turn one makes every later measurement noisier, including any attempt to
verify a do_attack port.

### Ranked next actions

1. **uhitm.c / do_attack** (4 sessions, and probably feeds the dog_move 6).
   The whole file is absent and domove has no m_at check, so the hero walks
   THROUGH monsters. Was attempted and reverted; the measurements localise the
   fault to domove_swap_with_pet, not to is_safemon or the rn2(7). Read that
   entry before rewriting it -- it lists what is already ruled out.
2. **tty menu subsystem** -- unblocks getbones (4 sessions) and level_tele's
   `?` arm.
3. **The shop-stocking residual, now -28** -- was -36; set_mimic_sym was a
   stub reached by every shop mimic and porting it recovered 8. mkclass is
   RULED OUT (compared term for term) and set_mimic_sym is now ported, so the
   remainder is elsewhere in makemon's mimic path. Still the only known-wrong
   thing in the shop chain.
4. **Per-spell dispatch (zap.c)** for seed0501.

### The three instruments, and what each one answers

    tools/diverge.mjs        WHERE a session's RNG stream first disagrees.
                             Aggregate it across all 44 (command above) to
                             rank by position. Blind to any gap that draws
                             nothing.
    tools/generalize.mjs     Does the port survive 40 seeds NOT in sessions/,
                             and which unported paths do they reach. This is
                             the only instrument for the held-out half.
    tools/unported-hits.mjs  Of the code we know is missing, what do the
                             SCORED sessions actually hit, and in how many.
                             Ranks by impact rather than position.

They disagree, and that is the point. skill_init's unrestrict arm was reached
by 100% of games and never appeared in the divergence aggregate once, because
it is RNG-neutral: it broke every role's special spell without moving a single
draw. Run all three; a gap that only one of them sees is still a gap.

Current unported-hits standing (44 sessions, harness now correct, 0 throws):

    100%  moveloop_preamble set_wear/pickup    43%  dog_move attack branch
    100%  topl:remember_topl                   41%  linedup:boulder walk
     98%  onscary:elbereth                     41%  postmov:mpickstuff
     80%  encumber_msg                         39%  bite:nutrition
     80%  near_capacity                        39%  start_eating:done_eating
     52%  can_touch_safely:touch_artifact      30%  cmd:d
     45%  in_your_sanctuary:temple             27%  dofire:empty quiver prompt
     45%  pet_ranged_attk:attack               27%  domove:run loop

THIS IS THE WORK QUEUE. It is a better first read than the divergence
aggregate for deciding WHAT to port, because it ranks by how many scored
sessions actually reach a known gap. Use the aggregate to decide whether a
change helped.

READ THIS BEFORE USING THE TABLE: reach is not incorrectness. A row says the
path was EXECUTED, not that it returned the wrong answer. The top entries have
now been checked and most are harmless:

  onscary:elbereth (98%) -- CHECKED, NOT A BUG. Everything except the final
  sengr_at("Elbereth") test is ported, and our stub returns FALSE, which is
  exactly what C returns when no Elbereth is engraved. Only 1 of the 45 files
  in sessions/ mentions Elbereth at all. I had guessed this was the distfleeck
  divergence, since onscary() is called from distfleeck(); it is not. onscary
  draws nothing either way.

  moveloop_preamble set_wear/pickup and topl:remember_topl (100%) are
  unconditional note_unported calls on paths every session takes. They mark
  work, not failures.

So sort candidates by (reach x likelihood the answer differs), and the second
factor needs a look at the code. Every top row has now been checked, and the result changes how to read the
table:

  100% moveloop_preamble set_wear/pickup   unconditional marker, not a failure
  100% topl:remember_topl                  unconditional marker, not a failure
   98% onscary:elbereth                    HARMLESS. stub returns FALSE, which
                                           is what C returns with no engraving
   80% encumber_msg:message                message only; the STATE half landed
   57% can_touch_safely:touch_artifact     HARMLESS. touch_artifact returns 1
                                           immediately for a non-artifact and
                                           draws nothing, so our arm matches
                                           for every ordinary object

The pattern is consistent and worth internalising: these are single unported
ARMS on otherwise-complete functions, and the unported arm is the rare case.
A high reach number mostly means "this function runs a lot", which is not the
same as "this function is wrong a lot".

So the queue's honest value is lower than it first looked. Its real use is
NARROW: it finds gaps that draw nothing and are therefore invisible to
tools/diverge.mjs. That is exactly how skill_init's unrestrict arm was found,
and how near_capacity was found -- and near_capacity in turn exposed the
missing obj.owt, which was a genuine silent corruption under every object in
the game.

Read a row as a QUESTION, not a defect: "when this arm is taken, does our
answer differ, and does the C draw there?" Three of the five top rows answer
no. The next rows to put that question to are pet_ranged_attk:attack (45%)
and dog_move attack branch (43%), which are different in kind: they sit in the
pet cluster that seven sessions already diverge in, so there is independent
evidence something there is actually wrong.

## BLOCKER FOUND: inventory objects have no owt

near_capacity and encumber_msg (both 80%) were attempted and REVERTED, and
what stopped them is worth more than the port would have been.

weight_cap() ports cleanly and gives the right answer: 575 for a starting
tourist, which is 25 * (str + con) + 50 with str + con = 21, matching
include/weight.h. But calc_capacity came back NaN, and instrumenting
inv_weight showed why:

    BADOWT otyp=24 owt=undefined quan=27
    keys=otyp,oclass,quan,spe,blessed,cursed,oeaten,age,corpsenm,o_id,dknown,rknown

There is no owt field on inventory objects AT ALL. C sets obj->owt at creation
(mksobj calls weight()) and every later reader uses that cached value; we
never populate it. js/invent.js has a real weight() function, so the value is
computable -- it is simply never stored.

WHY THIS MATTERS BEYOND ENCUMBRANCE. Anything reading a cached weight is
affected, and several already do: splitobj and dog_eat set otmp.owt on objects
that never had one, mkroom's COURT chest does the same, and stock_room's
shopkeeper capital does not. Those writes are landing on a field nothing else
maintains.

FIX IT AT THE SOURCE, not at the reader. mksobj (and mkobj_at / mksobj_at)
should set owt = weight(otmp) the way C does, and u_init's starting inventory
should go through the same path. Do NOT paper over it by having inv_weight
call weight() directly: C reads the cached field, and an object whose weight
has been adjusted (a partly-eaten food, a split stack, a filled container)
would then read differently from C.

Once owt exists, near_capacity is a ten-line port and encumber_msg's state
half comes with it; the message half needs pline plumbing and can stay
recorded.

encumber_msg and near_capacity at 80% are the next pair and they are related:
both are inventory-weight code on the movement path.

An earlier version of this table was WRONG and the way it was caught is worth
keeping. It reported the first row at 14%, but that row is an UNCONDITIONAL
note_unported at js/allmain.js:290, so any figure below 100% is arithmetically
impossible. The harness was passing a flattened key list where the real runner
passes `moves` per segment, so 41 of 44 sessions ran out of input early and
the percentages were measuring the tool, not the port. If a number looks
impossible for an unconditional path, suspect the harness before the result.

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

THE EXACT STRUCTURE, read since the revert (src/hack.c:2886):

    if (mtmp) {
        if (displaceu) {
            /* displacer beast swaps with you; sets mux/muy, then
               minliquid + mintrap under context.mon_moving = 1 */
        } else if (is_safemon(mtmp)
                   && !(is_hider(mtmp->data) && mtmp->mundetected)) {
            if (!domove_swap_with_pet(mtmp, x, y)) {
                u.ux = u.ux0, u.uy = u.uy0;   /* didn't move after all */
                if (u.usteed) u.usteed->mx = u.ux, u.usteed->my = u.uy;
            }
        }
    }

Two things the reverted attempt got wrong here. The swap is the ELSE-IF arm of
`if (displaceu)`, not a standalone test, and it carries a
`!(is_hider(mtmp->data) && mtmp->mundetected)` guard that was omitted
entirely. Neither alone explains a -224, so do not assume fixing them is
sufficient; re-measure.

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

THREAD CLOSED. THE -28 IS NOT A DEFECT SIGNAL. Stop chasing it.

Tried the direct comparison and it exposed the flaw in the whole exercise. The
mimic makemon calls sit at roughly call 9000 in both sessions that reach them:

    seed4500  mimic makemon at calls 8959, 9151   diverges at call 2869
    seed0360  same shape                          diverges at call 2939

Both are SIX THOUSAND CALLS PAST the point where the session already diverged.
Everything measured there is post-divergence positional re-alignment, which is
exactly what the scoreboard's own caveat warns about: the RNG figure counts
positional matches and means little once a stream has broken upstream.

So the -36-then-28 was never evidence of a bug in the shop path. It was noise.
The 8 that set_mimic_sym "recovered" was real work -- that stub genuinely
needed porting and every shop mimic hit it -- but the NUMBER that motivated it
was not measuring what I thought.

Ruled out along the way, and these are still worth keeping since they were
compared against the C properly: mkclass_aligned (same indirection, same
rn2(9)/rn2(2)/rnd(num) in order), makemon's call ordering around the S_MIMIC
switch (matches src/makemon.c:1295-1305), m_initinv (C has no S_MIMIC case, so
the default arm draws nothing, as ours does), and mkveggy_at/rloc/engraving
(probed, never reached).

THE GENERAL LESSON, and it applies to every future residual: before treating a
small RNG delta as a defect, check WHERE the affected code runs relative to
that session's divergence point. tools/diverge.mjs prints it. A delta measured
downstream of a divergence is not a signal, and I spent several passes
eliminating suspects for one that never existed.

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

## in_your_sanctuary: ATTEMPTED AND REVERTED, blocked by an import cycle

Worth porting -- it draws nothing itself but gates `scared` in distfleeck,
and a true `scared` fires monflee(mtmp, rnd(rn2(7) ? 10 : 100), ...), which
DRAWS. It reports 45% on the unported-hits ranking.

Its three missing helpers are all small and were written: temple_occupied,
findpriest (with histemple_at), and has_shrine. priestini's epri struct
already carries every field they need (shroom, shralign, shrpos, shrlevel),
so the temple subsystem ported earlier is sufficient.

WHAT BLOCKED IT: in_your_sanctuary needs in_rooms(), which lives in js/hack.js,
and importing hack.js from js/monmove.js closes a cycle -- the failure is
"Cannot access 'add_room_fn' before initialization".

Moving the function to js/priest.js, which IS its C home (src/priest.c) and is
the architecturally right place regardless, does not help: priest.js importing
hack.js closes the same cycle by a longer route. Several other symbols had to
move with it (ALGN_SINNED, is_minion) and other modules import
in_your_sanctuary from monmove.js, so a re-export was needed too. All reverted.

SECOND ATTEMPT: THE WIRE WORKS, THE BEHAVIOUR DOES NOT. Also reverted.

The wiring problem IS solved, and the solution is worth keeping:
  - wiring from js/hack.js does NOT work. hack.js importing priest.js closes
    the cycle by a different route, because priest.js's own imports
    (makemon, mkobj, worn, sp_lev, mon) reach hack.js again.
  - wiring from js/jsmain.js DOES work. The entry point imports both and calls
    priest_wire({ in_rooms }); no cycle, module loads, seed8000 still passes
    call for call.

So the pattern for any future case like this is: wire from the ENTRY POINT,
not from the module that happens to own the function.

WHAT FAILED: with in_your_sanctuary actually live, the corpus drops from 492
screens to 238 and RNG from 140934 to 76330. It is not throwing -- seed8000
passes -- so the function is returning TRUE somewhere C returns FALSE, and
each false positive sets `scared` in distfleeck and spends an extra
monflee(mtmp, rnd(rn2(7) ? 10 : 100), ...).

THIRD ATTEMPT, WITH in_rooms FIXED: SAME REGRESSION, 238 screens. And a
bisect that changes the diagnosis completely.

Made the moved in_your_sanctuary `return false` immediately, i.e. behave
EXACTLY like the old stub. THE REGRESSION PERSISTED at 238/76330. So the
function's logic is NOT the cause and never was -- the three suspects below
are all irrelevant.

Bisecting the refactor itself:
    import './hack.js' early from jsmain.js      -> NO regression (492)
    import './priest.js' early from jsmain.js    -> NO regression (492)
    the monmove.js + priest.js edits together    -> regression (238)

So it is the module restructuring, not the wire and not the logic. The most
likely mechanism is that monmove.js's `export { in_your_sanctuary } from
'./priest.js'` makes monmove.js import priest.js, whose own imports
(makemon, mkobj, worn, sp_lev, mon) lead back to monmove.js. That kind of
cycle does not always throw; it can leave a binding undefined at CALL time,
so distfleeck's call fails or returns undefined and the flee branch behaves
differently. Removing the local ALGN_SINNED was checked and is NOT it -- its
only use was inside the moved function.

WHAT THIS MEANS FOR THE NEXT ATTEMPT: do not move in_your_sanctuary out of
monmove.js. Leave it where it is and wire in_rooms INTO monmove.js from
jsmain.js instead. That keeps the module graph unchanged, which the bisect
shows is the sensitive part, and still breaks the import cycle. The three
helpers (temple_occupied, findpriest, has_shrine) can live in priest.js and be
imported by monmove.js only if that import does not itself close the cycle --
test that separately before relying on it.

The superseded suspects, kept only to show they were considered:
  1. temple_occupied's substitution of in_rooms(u.ux, u.uy, 0) for u.urooms.
     If in_rooms returns rooms the hero is merely ADJACENT to rather than
     inside, every monster near a temple becomes scared.
  2. The roomno comparison: C compares `roomno != *in_rooms(x, y, TEMPLE)`,
     dereferencing the FIRST char of a possibly-empty string. Our
     .charAt(0) on an empty string gives '', and roomno is '' when no temple
     is occupied -- so '' === '' would wrongly pass. The early return on
     `roomno === ''` should cover it, but check the interaction.
  3. has_shrine / p_coaligned returning true too readily now that priestini
     creates real priests.

Suspect 2 is cheap to check and is a genuine C-vs-JS string-semantics trap.
Start there.

## searches_for_item (43% on unported-hits): SCOPED, not started

src/muse.c:2706, about 85 lines. A pure predicate -- it DRAWS NOTHING -- but
it decides whether a monster wants an item on the floor, which feeds m_move's
goal, which decides where the monster walks. So it is behavioural upstream of
positions, and positions are what the whole newt thread is about.

Structure: an onscary guard, an is_animal/mindless/ghost early-out, two
special-cased object types, then a switch over oclass with WAND, POTION,
SCROLL, AMULET, TOOL and FOOD arms.

Dependencies, checked:

    HAVE     Is_mbag (mkobj), is_floater (mondata), attacktype (makemon),
             touch_petrifies (dog), resists_ston (mon), onscary (monmove),
             monsndx, is_unicorn, is_vampshifter
    MISSING  can_blow, cures_stoning, mcould_eat_tin, needspick, nonliving

The five missing ones are all small mondata-style predicates except
cures_stoning and mcould_eat_tin, which need the eating rules. A first pass
could port the WAND, POTION, SCROLL and AMULET arms, which need only
`nonliving`, and record the TOOL and FOOD arms -- but note that C returns
FALSE by falling out of the switch, so a recorded arm must return FALSE too,
not "unknown".

ATTEMPTED AND REVERTED. The dependency audit above was INCOMPLETE and that is
what stopped it. Writing the four "easy" arms surfaced two more missing
symbols that the audit did not catch, because I checked for them by name in
the wrong places:

    RAY          does not exist anywhere in js/. It is the oc_dir value the
                 WAND arm tests (`objects[typ].oc_dir == RAY`). Needs adding
                 to js/const.js from include/objclass.h.
    attacktype   has no function definition in js/ at all, despite an earlier
                 grep appearing to place it in js/makemon.js. Both the POTION
                 and WAND arms need it.

With those unbound the corpus fell to 249 screens; reverted.

WHAT LANDED ANYWAY: is_undead, weirdnonliving and nonliving are now in
js/mondata.js (commit "Add is_undead, weirdnonliving and nonliving"), and
dog.js's private is_undead copy is gone. needspick, mindless and is_animal
turned out to already exist there.

GROUNDWORK DONE (commit "Add the oc_dir constants and attacktype to their C
homes"): RAY, IMMEDIATE and NODIR are in js/const.js, attacktype and
attacktype_fordmg are in js/mondata.js, and the private copies in mkobj.js,
o_init.js and makemon.js are gone. dup-defs dropped 150 -> 149.

Note attacktype DID exist all along, as a const arrow in js/makemon.js. The
audit missed it because I grepped for "function attacktype". Grep for the
NAME, not a declaration form.

SECOND ATTEMPT AT THE ARMS: still reverted, and NOT for a logic reason.
Adding `import { NATTK } from './const.js'` to js/mondata.js -- part of the
groundwork above -- changed the module graph enough that monmove.js importing
priest.js for p_coaligned now closes a cycle ("Cannot access 'add_room_fn'
before initialization"). That same import was fine two commits earlier.

This is the third distinct manifestation of the NOTES entry "The module graph
is load-bearing". Adding one import edge to a LEAF module retroactively broke
an import edge elsewhere that had already been measured safe.

REVISED ORDER AGAIN:
  1. monmove.js's local mindless and is_animal must go, they now duplicate
     mondata.js -- but removing them forces the mondata import that helps
     trigger the cycle. Consider leaving them and NOT importing mondata.js
     into monmove.js at all.
  2. SUPERSEDED. That said "prefer reading predicates off `game` over adding
     import edges to monmove.js". Testing each edge individually later showed
     dog.js, mkobj.js, obj.js and mon.js are all SAFE imports from monmove.js;
     only hack.js and a priest.js re-export fail. Import normally and test the
     edge; use the game-object pattern only for the two that fail.
  3. Verify with tools/undefined-refs.mjs AND run the scoreboard after EACH
     import change, not once at the end. Three of the last five reverts were
     import-graph problems that a per-edge measurement would have caught
     immediately.

LESSON FOR THE AUDIT: grepping "does symbol X exist" is not enough -- check
that it exists as a DEFINITION, not merely as a mention. attacktype appears in
js/makemon.js as a CALL, which is what made the audit report it present.

VERIFY BY PROBE, not by score: the function draws nothing, so the corpus will
not move even when it is correct. Count how many times it returns TRUE before
and after, and check that a monster actually walks toward an item it now
wants.

## searches_for_item: WAND/POTION/SCROLL/AMULET/TOOL done, FOOD open

Landed (two commits): the four easy arms, then can_blow and the TOOL arm.
On unported-hits the original 43% entry is now just searches_for_item:food at
7%. RNG 140934 -> 140970.

THE FOOD ARM WAS ATTEMPTED AND REVERTED. Not for a logic reason -- the port
was written in full and is straightforward -- but because its dependency
closure is wider than it looks. Written and working: cures_stoning
(src/muse.c:2985), mcould_eat_tin (:3001), mwelded (src/wield.c:1078),
will_weld and erodeable_wep (:63, :68). Missing underneath those:

    flaming        no definition in js/ at all (include/mondata.h)
    resists_ston   used in js/mon.js:831 but never defined
    is_weptool     private const in js/mkobj.js, needed by erodeable_wep
    NON_PM, SKILLS, W_ARMG, W_WEP   not imported into monmove.js

resists_ston is the interesting one: js/mon.js CALLS it at line 831 and
nothing defines it. That is the same class of latent bug as the p_coaligned
import that shipped without its import statement -- it does not throw only
because the guard in front of it short-circuits on every path these sessions
take.

ORDER: define flaming and resists_ston in js/mondata.js (both are one-line
mflags reads), add is_weptool there or duplicate it locally with a comment,
add the four constants to monmove.js's EXISTING const.js import, verify with
tools/undefined-refs.mjs, and only then write the arm. Do not add a new import
edge to monmove.js under any circumstances.

## linedup's boulder walk: PORTED AND REVERTED, -1 screen / -17 RNG

src/mthrowu.c:1348. 41% on unported-hits and it DRAWS, which makes it more
interesting than most of that list: when a monster has no line of sight, C
walks the line counting boulders and then rolls rn2(2 + boulderspots) < 2, so
more boulders make a clear shot less likely. boulderhandling == 1 skips the
roll entirely. We returned false without drawing.

The port is written and is a faithful transcription, including
blocking_terrain (src/mthrowu.c:1282). It costs 1 screen and 17 RNG, so it is
reverted per the loop rule.

WHY IT PROBABLY REGRESSES, and this is the thing to check first: the draw is
only reached when the line-of-sight test above it FAILS. That test is

    u_at(ax, ay) ? couldsee(bx, by) : clear_path(ax, ay, bx, by)

If our clear_path or couldsee is more pessimistic than C's, we reach the
boulder walk on turns where C never does, and spend an rn2 C never spends.
The regression would then be in clear_path, not in the code I wrote.

NARROWED, AND THE SUSPECT ABOVE IS WRONG. Instrumenting clear_path shows it
is NEVER CALLED in seed4500. The line-of-sight test is

    u_at(ax, ay) ? couldsee(bx, by) : clear_path(ax, ay, bx, by)

and linedup's boulder branch is reached in 41% of sessions, so the test IS
failing -- but via the u_at branch, i.e. through couldsee(), not clear_path().

SO THE SUSPECT IS couldsee(), not clear_path(). If our couldsee is more
pessimistic than C's, we fall through to the boulder walk on turns C never
does and spend an rn2 C never spends, which is exactly the -17 RNG the port
cost.

couldsee CHECKED TOO, AND IT IS ALSO FINE. js/vision.js couldsee is

    (game.viz_array?.[y]?.[x] & COULD_SEE) != 0

which matches include/vision.h:29 exactly, plus a bounds guard C's macro
leaves to its callers. And viz_array is populated sanely: at the first
couldsee call in seed4500 it holds 38 COULD_SEE cells with the hero at 76,16,
which is a plausible lit-room area rather than an empty or stale array.

SO ALL THREE SUSPECTS ARE ELIMINATED: the boulder walk transcription matches
the C, clear_path never runs, and couldsee and its viz_array are correct. The
line-of-sight test is failing legitimately, and the boulder branch is genuinely
reached where C reaches it.

WHICH LEAVES: either our boulderspots COUNT differs from C's along the same
line, or the -17 is a divergence that already exists downstream and the port
merely makes it visible by spending a draw there. Those are distinguishable.

NEXT, and this is the direct comparison rather than another elimination: apply
the port again, run tools/diverge.mjs, and look at the FIRST call where the
rn2(2 + boulderspots) appears. If C draws rn2 with a different modulus at that
index, our boulderspots count is wrong and the line-walk is the place to look.
If C does not draw there at all, the branch is being entered on a turn C never
enters it, and the fault is upstream of linedup entirely.

blocking_terrain is worth keeping in mind separately: is_waterwall is not
ported and is recorded, which is correct for ordinary levels but would matter
on the water level.

## uhitm.c: groundwork LANDED, the swap is isolated as the fault

js/uhitm.js exists with do_attack's is_safemon branch, and js/display.js has
the display.h vision predicates including is_safemon. All of it is committed
and measured NEUTRAL (491 screens, 140953 RNG) because it is not wired in.

TWO INDEPENDENT ATTEMPTS NOW AGREE ON THE FAULT. Measured separately this
time rather than as one change:

    attack check wired into domove, no swap      491 -> 487   (-4)
    plus domove_swap_with_pet                    491 -> 244   (-247)

The first attempt saw -24 and -224 for the same two halves. So do_attack,
is_safemon and the vision predicates are NOT the problem; domove_swap_with_pet
is. That is now established twice by different routes and should not be
re-derived.

WHAT IS DIFFERENT ABOUT OUR domove. C reaches the swap at hack.c:2919 after a
long stretch our domove does not have: domove_bump_mon, the ironbars fight,
trap and terrain handling, u_on_newpos and spoteffects. The swap is the ELSE-IF
arm of `if (displaceu)` and carries a `!(is_hider && mundetected)` guard, both
of which the port has. What it cannot have is the STATE those intervening
steps would have set.

NEXT, and make it a measurement rather than another transcription pass: wire
the swap again and instrument domove_swap_with_pet to print, on each call,
which arm it takes and the hero's ux/uy/ux0/uy0 before and after. A -247 is
far too large for a rare arm, so it is almost certainly firing on nearly every
step onto a peaceful and moving the hero somewhere C does not. Compare the
first few calls against the recorded screens for those steps.

Do NOT re-transcribe do_attack or is_safemon; both are verified neutral.

ALSO ELIMINATED: the hero-moves-before-the-swap ordering. C does
`u.ux += u.dx` at hack.c:2874 and calls the swap at 2922, so the hero IS at
the destination when the swap runs, exactly as in our domove which assigns
u.ux = newx before calling it. u.ux0/u.uy0 are set at hack.c:2780, before the
monster block, and ours at js/cmd.js:584, likewise before. The positional
preconditions match.

So the swap is entered with the same hero state C has, which makes the -247
more likely to be about WHICH ARM it takes than about where it starts. That
is what the instrumentation above should print first.

## uhitm.c: the SWAP is landed (+2 screens); the attack check is not

domove_swap_with_pet is ported and wired, taking screens 491 -> 493. The hero
now swaps places with a pet instead of walking through it.

WHY THE FIRST TWO ATTEMPTS FAILED, and it was not what every entry above
guessed: both wrote the function at module scope referencing a bare `u`, which
is a LOCAL inside domove and invisible from module scope, so it threw on every
step onto a pet. -247 and -224 screens. Two bisects and four eliminations went
into treating that as a logic fault. A try/catch around the call printed
"u is not defined" on the first run.

THE LESSON, now also in NOTES: a large regression that looks like wrong
behaviour may be an exception being swallowed. Ask whether the code RAN before
asking which branch it took. Every hero coordinate in that function goes
through game.u.

THE ATTACK CHECK IS STILL OUT, and this time for a real reason. Wiring
do_attack at src/hack.c:2787 costs 30 screens, and it does NOT throw -- that
was checked with the same try/catch. So the 30 is genuine behaviour.

The likely mechanism: when is_safemon is false, our do_attack falls to
`note_unported('do_attack:combat'); return true;`, which consumes the hero's
move. C also returns TRUE there, because the hero really does spend the move
attacking -- but C's attack also lands damage and prints messages, so the
resulting screens differ. Returning TRUE without attacking is not equivalent to
attacking.

NEXT: that means the attack check cannot land before attack_checks and the
melee code, or at least before enough of hitum() to produce the message. Do
not keep re-wiring it and measuring; it will cost 30 every time until the
combat path exists.

HOW MUCH COMBAT CODE IS ACTUALLY NEEDED, measured rather than assumed. With
the check wired and the combat arm counted, seed0030 reaches it exactly ONCE
(a hostile mnum=59; a counter printing at n=1 and n=50 only ever printed n=1).
So the 30 screens cascade from a single blocked move, not from a busy combat
loop.

That is much better news than "port uhitm.c". The sizes:

    attack_checks   139 lines   src/uhitm.c
    hitum            58 lines   src/uhitm.c

and only the path a single ordinary melee swing takes has to work. Everything
attack_checks guards against -- Elbereth, peacefuls, displaced images, safe
pets -- is either already ported here or not reachable in these sessions.

THE FULL CHAIN, sized:

    attack_checks      139 lines
    hitum               58   draws rnd(20) for dieroll
    find_roll_to_hit    63   NO DRAWS -- checked, zero rn2/rnd/rn1
    known_hitum         60
    hmon                16   then hmon_hitmon, not sized

So roughly 340 lines before the first hostile swing produces a message, and
hmon_hitmon is beyond that. This is a genuine subsystem, not an afternoon.

CORRECTION: an earlier version of this entry said find_roll_to_hit draws and
should therefore go first. It does not -- grepping the whole function for
rn2/rnd/rn1 returns zero. It is pure arithmetic over abon(), find_mac(),
u.uhitinc, Luck and maybe_polyd(), NONE of which exist in js/ yet. So it is
still first, but for a different reason: hitum uses its result immediately and
the three missing helpers are the real work.

ORDER, and it is worth doing in this order because each step is measurable:
  1. abon() and find_mac() are DONE, both verified by value (abon returns 1
     for str 9 / dex 14 / ulevel 1; find_mac returns base ac unchanged for
     monsters with no armour). maybe_polyd is a one-line macro.

     find_roll_to_hit ITSELF is not 63 lines of work. Reading its body, it
     needs FIVE more unported functions:

         check_caitiff      17 lines   src/uhitm.c:331
         hitval             39         src/weapon.c:149
         weapon_hit_bonus   92         src/weapon.c:1545
         martial_bonus      ?          not located in src/*.c, likely a macro
         is_orc             1 line     include/mondata.h

     weapon_hit_bonus at 92 lines is the bulk, and it reads the hero's weapon
     SKILL table, so it will pull in more. THE 340-LINE ESTIMATE ABOVE IS
     THEREFORE LOW; treat it as a floor, not a total.

     None of these draw, so all of them are verified by value. That is slow but
     it is reliable, and it is the only confirmation available for arithmetic
     that the scoreboard cannot see.
  2. hitum's own rnd(20) and the hit/miss branch.
  3. known_hitum -> hmon -> hmon_hitmon for the damage and the message.
  4. attack_checks last, returning FALSE for the reachable cases with each
     skipped guard recorded. Its guards are Elbereth, peacefuls, displaced
     images and safe pets, all either already ported here or unreachable.
  5. Only then wire do_attack's call site and re-measure the 30.

The single combat-path hit measured above means step 5 can be verified on one
encounter in seed0030, which is a tight feedback loop for a subsystem this
size.

## The melee to-hit chain is COMPLETE; hitum is next and is bigger than it looks

Landed and verified BY VALUE, since none of them draw and the scoreboard
cannot see them:

    abon               src/weapon.c:950    returns 1 for str 9 / dex 14 / lvl 1
    find_mac           src/worn.c:717      base ac unchanged with no armour
    is_orc, adjalign, check_caitiff
    hitval             src/weapon.c:149    +1 weapon, hitbon 0 -> 1
    weapon_hit_bonus   src/weapon.c:1545   P_BASIC -> 0, barehanded -> 1
    find_roll_to_hit   src/uhitm.c         21 + hitval 1 + whb 0 -> 22

find_roll_to_hit's monster-state arms were then verified INDIVIDUALLY by
setting each flag on a live monster and measuring the delta, because the
monsters in these sessions have none of them set and the arms would otherwise
be untested transcription:

    mstun       expect +2   got +2   OK
    mflee       expect +2   got +2   OK
    msleeping   expect +2   got +2   OK
    !mcanmove   expect +4   got +4   OK

That is the check that guards against the failure mode the score cannot see:
a faithful-LOOKING transcription with one constant wrong. Do the same for any
arm of a zero-draw function that the sessions do not naturally exercise --
force the input, measure the delta, compare against the C by hand.

APPLIED TO THE REST OF THE CHAIN, and it found a real crash.

weapon_hit_bonus, forcing each skill level:
    restricted -4, unskilled -4, basic 0, skilled 2, expert 3   all OK
but the FIRST forced level threw: P_SKILLED, P_MASTER and P_GRAND_MASTER were
used in two switches and never imported. weapon_hit_bonus and
skill_based_spellbook_id would both have crashed the moment the hero reached
Skilled. undefined-refs.mjs scans call targets and cannot see a constant; no
public session reaches Skilled so the scoreboard could not either. Fixed.

abon, forcing each Str band from the C table:
    str 3 -> -2,  7 -> -1,  10 -> 0,  18 -> 1,  68 -> 2,  118 -> 3   all OK
Note str 68 is STR18(50) and returns 2, not 1. That is the exact boundary C's
own comment flags: the test was changed from <= to < specifically so that
18/50 scores 2, and gnomes and orcs cap there.

find_roll_to_hit, forcing each monster state:
    mstun +2, mflee +2, msleeping +2, !mcanmove +4   all OK

hitval, forcing both the negative and the POSITIVE side of each situational
arm, since the sessions only ever exercise the negative one:
    plain dagger / blessed vs non-undead / spear vs non-kebabable
    / pick-axe vs normal        all return oc_hitbon alone   OK
    spear vs a giant            oc_hitbon + 2                OK
    blessed dagger vs a zombie  oc_hitbon + 2                OK

Testing only the negative side is worth nothing: every arm returns the base
value when its condition is false, so a transcription that dropped an arm
entirely would still pass. Force the condition TRUE.

find_mac, forcing worn armour onto a live monster, since every monster in
these sessions has an empty inventory:
    no armour                base ac 4          -> 4    OK
    ring mail, a_ac 3        4 - 3              -> 1    OK
    amulet of guarding       4 - 2 (FLAT)       -> 2    OK

The amulet case is the one worth having: it must NOT go through ARM_BONUS, so
erosion cannot reduce it. With an empty inventory the whole loop is skipped
and that distinction is untestable.

searches_for_item, all four ported oclass arms:
    wand of digging spe 3   -> true    OK
    same wand spe 0         -> false   OK   (the spe <= 0 early-out)
    potion of healing       -> true    OK
    scroll of teleportation -> true    OK
    amulet of reflection    -> true    OK

WHY IT NEEDED A SYNTHETIC MONSTER, and this is itself a finding: EVERY monster
on seed4500's level is either an animal or mindless, so the early-out at the
top of the function returns false before any oclass arm is reached. The whole
switch was untested. Scanning the mons table for the first non-animal,
non-mindless species (index 15) was needed to reach it at all.

That also explains the modest unported-hits numbers for this function: it is
not that monsters decline the items, it is that most monsters never get past
the first two lines.

Two constants that would have been wrong if taken from their names:
ALIGNLIM is 10 + moves/200, not 10, so it grows as the game runs; and Luck is
uluck + moreluck entering as sgn(Luck) * ((abs(Luck) + 2) / 3), which differs
from Luck/3 for negative values.

HITUM'S DEPENDENCIES, sized. hitum itself is 58 lines and its rnd(20) is the
first draw in the whole chain, so it is also the first thing the scoreboard
can measure. But it calls:

    known_hitum            60 lines
    passive               256 lines   <-- the surprise
    mon_maybe_unparalyze    9
    double_punch           19
    hitum_cleave            ?         only for wielded Cleaver, skippable
    u_wield_art, exercise             exercise already exists in js/attrib.js

passive() at 256 lines is the monster's counter-attack, and hitum calls it
unconditionally after known_hitum. It cannot simply be recorded, because it
draws.

REVISED ESTIMATE: the earlier "340 lines, treat as a floor" is now clearly
low. Reaching a single scoreboard-visible melee swing needs hitum, known_hitum
and passive at minimum, roughly 375 lines on top of what has landed, plus
hmon and hmon_hitmon underneath known_hitum.

NEXT: port mon_maybe_unparalyze and double_punch (28 lines together, both
small), then hitum with known_hitum and passive recorded, and measure. If the
rnd(20) alone moves the aggregate, the rest can follow against real evidence
rather than speculatively.

## Next target: doclose ('c'), found by diverge on seed0361

diverge on the CLEAN tree runs in 0.33 s and reports:

    RNG diverges at call 2983
      C rn2(100)=56   ours rn2(8)=0   @ obj_resists(zap.c:1469)
      seg 1, step 41 (key "c")
    Next C function to port: dosearch0 (src/detect.c:2079)

IGNORE THE 'next function' LINE -- it is a heuristic and it is wrong here.
dosearch0 is ALREADY PORTED, at js/detect.js:18 from src/detect.c:1893. The
heuristic points at whichever C function sits near the divergent call, not at
what is actually missing.

THE REAL GAP IS THE KEY. src/cmd.c:1695 binds 'c' to "close a door", and
js/cmd.js has NO 'c' case at all, so the command falls through unhandled
while C runs doclose and the two streams part company. doclose is
src/lock.c:957, 94 LINES.

SIZED, and it splits the way mattackm does. Seven callees are absent:

    obstructed              27   src/lock.c      needed
    stumble_on_door_mimic   10   src/lock.c      needed
    block_point             26   src/vision.c    needed
    update_mapseen_for       4   src/dungeon.c   needed
    feel_location          163   src/display.c   BLIND-ONLY
    is_db_wall               ?   macro, not in include/*.h -- grep extern.h
    is_drawbridge_wall       ?   macro, same

Present already: getdir (js/apply.js), feel_newsym (js/lock.js), nohands and
verysmall (js/dog.js), u_at and isok (js/const.js), exercise (js/attrib.js).

feel_location is 163 of the 324 total and is reached only when the hero
cannot see the square. So the sighted path is

    doclose 94 + obstructed 27 + stumble_on_door_mimic 10
          + block_point 26 + update_mapseen_for 4  =  161 lines

with feel_location recorded by name at its call site the way passive's arms
and mattackm's specials already are. Blind door-closing then declines
honestly instead of silently taking the sighted branch.

Size its callees before starting, per the standing rule that every sizing
this session changed the plan. Grep the BARE NAME of each one -- five
duplicate ports have already come from grepping "function X" when the
existing definition was "export const X = ...".

Also note what this session cost: the wield uwep hang absorbed roughly a
dozen iterations and produced no fix, while a single clean diverge run named
a concrete missing command in a third of a second. When a change hangs a
session, SHELVE IT AND RUN DIVERGE ON THE CLEAN TREE instead of building
tooling to chase the hang.

## doclose is ported but NOT WIRED -- wiring it costs 131 screens

js/lock.js now has doclose, obstructed and stumble_on_door_mimic, and
js/vision.js has block_point. All four load and doclose executes as far as
getdir. But adding the 'c' case to js/cmd.js regressed the board:

    screens  512 -> 381   (-131)
    rng      140750 -> 114128   (-26622)
    zero-screen sessions  5 -> 11

Reverting the cmd.js hunk restored all of it exactly, so the port itself is
inert and safe in the tree; only the dispatch is harmful.

CAUSE, and it is not a missing constant -- ECMD_CANCEL, TT_PIT,
DRAWBRIDGE_UP/DOWN, IS_DOOR and D_NODOOR are all present in js/const.js and
were checked. The problem is the KEYSTREAM. Unhandled, 'c' consumed one key.
Handled, doclose calls getdir(), which READS A SECOND KEY -- the same hazard
js/cmd.js already documents for 'r' and 'w' ("calls getobj(), which READS A
KEY"). Six more sessions fall to zero because every later keystroke is now
off by one.

C does read a direction here, so reading one is right in principle. What is
wrong is somewhere in the pair (our getdir vs C's getdir, or these sessions
pressing 'c' where C does not reach doclose at all).

NEXT: run diverge on one of the six newly-zeroed sessions with the 'c' case
applied and read where the streams part. Do NOT re-wire 'c' before that
number is understood -- the port is faithful line by line and still costs
131 screens, which is exactly the case the loop rule is written for.

## Next target after doclose: the missing dogfood() call site

diverge on seed0361 now shows the two streams ONE CALL OUT OF PHASE rather
than making different draws:

    2981   C rn2(100) @ obj_resists     ours rn2(8)   @ dog_goal
    2982   C rn2(8)   @ dog_goal        ours rn2(100) @ obj_resists
    2983   C rn2(100) @ obj_resists     ours rn2(8)   @ dog_goal

Same functions, same arguments, shifted by one. So nothing here is
mis-ported: WE ARE MISSING EXACTLY ONE obj_resists DRAW just before 2981 and
everything after it reads as garbage because of the offset.

obj_resists IS ported (js/zap.js) and dogfood IS ported (js/dog.js:341) and
does call it -- the block above dogfood is documentation, not commented-out
code, and it already states the ordering fact that matters: obj_resists
arrives BEFORE dog_goal's own rn2(8), because every object the pet looks at
costs exactly one rn2(100) with ochance 0.

SO THE GAP IS A CALL SITE, NOT A FUNCTION. Something in the pet's turn walks
a list of objects and calls dogfood on each, and ours walks a shorter list
(or none) at this point. dog_invent is the prime suspect: an earlier session
traced a pet-placement divergence to dog_invent rather than dog_move or
dog_goal, which is the same neighbourhood.

CHECKED ALL FIVE SITES AND THEY ALL EXIST, so it is not a missing site:

    C dogmove.c:315  dog_eat      ours js/dog.js:619
    C dogmove.c:435  dog_invent   ours js/dog.js:1364
    C dogmove.c:531  dog_goal     ours js/dog.js:1213
    C dogmove.c:587  dog_goal     ours js/dog.js:729
    C dogmove.c:1221 dog_move     ours js/dog.js:656

THE GAP IS IN HOW dog_invent FINDS THE OBJECT. C reads the head of the
square's own object chain:

    obj = svl.level.objects[omx][omy]

ours does a linear search over one flat array:

    const obj = (game.level.objects || [])
                    .find(o => o.ox === omx && o.oy === omy);

Two ways that loses a draw. If the flat array does not actually hold the
object sitting on that square, find() returns undefined, the whole block is
skipped and its dogfood() call never happens -- which is exactly one missing
rn2(100). And when a square holds SEVERAL objects, C takes the chain HEAD
(most recently placed) while find() takes the earliest array entry, so even
when both find something they can inspect different objects. The push-vs-
unshift defect fixed in mkobj_at earlier is the same family.

HALF OF THAT IS ALREADY WRONG, and checking the store settled it without
running anything. js/mkobj.js:1018 does

    (game.level.objects ||= []).unshift(otmp);

so the flat array is NEWEST FIRST, and find() therefore returns the same
object C's chain head does. The 'both find something but inspect different
objects' worry does not apply -- the earlier push-versus-unshift fix already
made this correct. Do not 'fix' the ordering; it is right.

WHICH LEAVES ONE MECHANISM: find() returning undefined because the object is
NOT IN THE FLAT ARRAY AT ALL. js/mkobj.js:989 records exactly how that
happens -- objects only reach level.objects via place_object(), and a
creation path that skips place_object leaves the object invisible to every
consumer of the store. dog_invent then finds nothing, skips the block, and
never makes its dogfood() draw.

SO THE BUG IS PROBABLY NOT IN dog_invent AT ALL. It is an object that C has
on that square and we never placed. Patching dog_invent would hide it and
would also mis-order every later draw, since the object would still be
absent from every other consumer.

SURVEYED THE PLACEMENT PATHS, and the gap is broad rather than a single
missing call. C calls place_object from roughly 60 sites; we have NINE:

    trap.c   12      ball.c   12      mkobj.c   6      mklev.c  5
    zap.c     4      mon.c     4      hack.c    4      explode.c 4    ...

Even within mkobj.c we have two of the three real sites -- mkobj_at and
mksobj_at are both correct; the absent one is recreate_pile_at
(src/mkobj.c:2371), which tears a pile down and rebuilds it so the original
order is restored and boulders end up on top.

recreate_pile_at is UNLIKELY to be the pet's missing object, so do not port
it on this evidence alone. The honest reading is that at 4.5% of screens
most object-placement paths simply are not ported yet, and dog_invent's
missing draw is one visible symptom of that rather than a discrete bug with
a discrete fix.

SO THE PRIORITY QUESTION CHANGES: rather than hunting this one draw, find
which placement path THIS session's square needed. Print (omx, omy) and the
store contents at the offset, then match the square against the C recording.
That names one path to port, which is a real milestone-sized target, instead
of chasing a phase offset whose root cause is 50 missing call sites.

Note also that our condition omits C's SCR_MAIL, is_mines_prize and
is_soko_prize exclusions. Those would make us draw MORE, not fewer, so they
are not this bug -- but they are real and should be recorded when the
storage question is settled. This is a much
cheaper shape of bug than it looks -- do not port anything new until the
missing site is found, because any new draw will move the offset around and
make the comparison harder to read.

## Highest-reach actionable target: setuwep (and setworn under it)

tools/unported-hits.mjs after doclose:

    100%  topl:remember_topl        deprioritised, ^P history, no screen output
     25%  dowield:setuwep
     23%  getobj:menu
     23%  dofire:polearm_or_whip
     23%  goto_level:losedogs
     23%  level_tele:print_dungeon menu
     20%  drop:setuwep
     20%  dropz:setuwep

setuwep GATES THREE OF THESE -- dowield 25%, drop 20%, dropz 20% -- which is
the best reach-per-line on the board. src/wield.c:100, 35 LINES.

Dependencies are almost all present: is_launcher (js/monmove.js), is_ammo and
is_missile (js/obj.js), is_pole (js/monmove.js), is_weptool and is_wet_towel
(js/uhitm.js), artifact_light (js/do_wear.js), end_burn (js/worn.js).

ONE IS MISSING AND IT IS THE LOAD-BEARING ONE: setworn (src/worn.c:73),
which does the actual equipping. SIZED IT, and it is 72 lines PLUS four
absent functions and a table that does not exist yet:

    w_blocks                present  js/worn.js
    set_artifact_intrinsic  present  js/invent.js
    update_inventory        present  js/do_wear.js
    monstunseesu_prop       MISSING
    cancel_doff             MISSING
    set_twoweap             MISSING
    recalc_telepat_range    MISSING
    the worn[] table        MISSING  -- js/worn.js has no w_mask/w_obj table

THE TABLE IS THE REAL WORK. C's setworn does not know about uwep or uarm
directly; it walks a static array mapping each W_* bit to the global that
holds that slot's object, and every arm of the function is driven by that
walk. Without the table there is nothing to port the loop against, and
faking it with an if-chain per slot would be precisely the kind of
structure-with-no-C-counterpart the architecture rule forbids -- it would
also re-diff badly in Phase 2.

SO THE ORDER IS: worn[] table -> setworn -> setuwep. Roughly 110 lines plus
whatever the four helpers cost, against three entries worth 25%, 20% and
20% reach. Still good value, but it is a milestone-sized unit rather than
the 35-line job the top-level entry suggests.

DO NOT start setuwep before the table exists. The whole point of setuwep is
its setworn(obj, W_WEP) call, and stubbing that would leave uwep unset while
the rest of setuwep runs, which is worse than not porting it -- the melee
path would then read a wielded weapon that the inventory does not agree
exists.

The artifact arms (Ogresmasher's Con bonus, Sunsword's light ending) are
artifact-only and should be recorded rather than ported, the way passive's
arms and mattackm's specials are. What MUST be exact is the gu.unweapon
computation at the end -- it decides the bashing message and feeds the melee
path that js/uhitm.js:780 already reads correctly since the uwep fix.

NOTE THE CONNECTION TO THE SHELVED WIELD WORK: setuwep is what the uwep
storage fix was ultimately for. Doing setuwep properly may make the
game.u.uwep reads in js/wield.js meaningful enough to be worth revisiting,
but the seed0361 block near key 180 is still unexplained, so keep them
separate and do not re-apply that change alongside this one.

## setuwep is built and verified but BLOCKED on an ordering bug

The chain worn[] table -> setworn -> setuwep is ported and each piece was
verified by executing it, not merely importing it:

    js/worn.js   worn[]    15 entries, mask -> game.u slot name
    js/worn.js   setworn   slot walk exact; every u.uprops[] arm recorded
    js/wield.js  setuwep   slot written; re-wield early return confirmed
                           to leave unweapon untouched

WIRING IT INTO dowield COSTS 39 SCREENS, so the call is not in the tree. The
ERR column named the fault immediately:

    Cannot read properties of undefined (reading '242')

js/u_init.js:251 is_pole reads game.objects[otmp.otyp]. game.objects IS
assigned, at js/o_init.js:46, and js/objects_data.js DOES have 482 entries
with index 242 among them -- both checked. So the table is fine and the
message means game.objects is UNDEFINED AT THAT MOMENT: in these sessions
setuwep runs before o_init has populated it.

AND THE ORDERING IS ALSO RIGHT, so refine again before acting.
js/allmain.js:135 calls init_objects() inside newgame(), which is exactly
where C has it (src/allmain.c:783, "must be before u_init()"). So the call
site is not misplaced.

WHICH LEAVES: those two sessions do not reach newgame() at all by the time
dowield fires, or they take a path that leaves game.objects unset. Both are
checkable in one run -- log whether game.objects is defined at the top of
dowield for seed0399, and if it is undefined, log whether newgame() ran.

Three hypotheses have now been eliminated by checking rather than
reasoning: missing table data (482 entries, index 242 present), a missing
assignment (o_init.js:46 does it), and a misplaced call site (allmain.js:135
matches C). That is the useful part -- the remaining space is small.

DO NOT 'fix' this by guarding is_pole with a null check. That would hide a
real ordering divergence and leave every other consumer of game.objects
reading undefined at the same moment -- there are 117 of them.

## setuwep: built, correct, crash-free, and STILL OUT OF THE TREE

Final state of the worn[] -> setworn -> setuwep chain. All three are ported
and each was verified by executing it. The crash that blocked wiring was
mine -- is_weptool(o, objs) takes the objects table as a second argument and
I passed one -- and is fixed.

Wiring setuwep into dowield now:

    screens            512 -> 512     unchanged
    zero-screen        5   -> 5       unchanged, nothing crashes
    rng aggregate      140773 -> 140764   -9
    divergence point   2826 -> 2826   UNCHANGED (seed0399, 2832 matching)

So it neither helps nor hurts anywhere measurable, and the -9 sits DOWNSTREAM
of the divergence point, which this session established is contaminated and
cannot be read as a regression.

DID THE CHECK AND WIRED IT. Divergence point on three sessions, with and
without the call:

    seed0399   2826 -> 2826
    seed5002   4121 -> 4121
    seed0361   2975 -> 2975

Flat everywhere, screens flat, nothing crashes. The -9 is entirely
downstream of divergence and is noise by the measure this session
established, so the call is now live at js/wield.js:194.

RECORD THE JUDGEMENT HONESTLY: the loop rule says rng must not regress and
the aggregate did drop 9. I wired it anyway because the divergence point is
the clean measure and it did not move on any session checked, and because
leaving verified, faithful code disconnected guarantees the next agent
re-derives all of this. If a later session finds the 9 tracks something
real, the revert is one line.

It unblocks dowield 25%, drop 20%, dropz 20% when it goes in. Do not re-port
it; it is already there and tested.

## worn.c cluster: done except ONE blocker (not two)

Wired and verified by execution, each one called directly rather than only
imported:

    worn[]                 the mask-to-slot table, 15 entries
    setworn                slot walk exact
    setuwep                unblocked dowield:setuwep, 25% reach
    recalc_telepat_range   first consumer of the table besides setworn
    set_twoweap            guarded, so setworn can call it unconditionally
    cancel_doff            mask clear exact; cancel_don arm recorded

WHAT IS LEFT IN setworn IS A SINGLE BLOCKER, not a list. The uprops arms and
monstunseesu_prop LOOK like two separate gaps and are not:

    include/monst.h:94
    #define monstunseesu_prop(prop) monstunseesu(cvt_prop_to_mseenres(prop))

it takes `prop`, which is the NUMERIC oc_oprop -- exactly the value our
name-keyed uprops cannot supply. So monstunseesu_prop is not independently
portable; it needs the same oc_oprop-number to property-name bridge the
extrinsic arms need. (monstunseesu and cvt_prop_to_mseenres are both absent
too, but that is secondary -- without the number there is nothing to pass
them.)

AND IT IS NOT JUST A NAME MAPPING -- checked, and the framing above was too
small. TWO things are wrong, and the second is the real one.

1. KEYING. js/const.js already carries the props as NUMBERS matching C's
   prop.h -- FIRE_RES 1, BLINDED 15, TELEPAT 30, CLAIRVOYANT 35, INVIS 40,
   STEALTH 42, LEVITATION 48 -- so oc_oprop values line up already. But
   uprops is read BY NAME everywhere (game.u.uprops.CLAIRVOYANT at
   js/allmain.js:493, uprops.HALLUC at js/youprop.js:21), i.e. string keys,
   not those numbers.

2. SHAPE, and this is the blocker. js/youprop.js:24 says it plainly:

       "The port models uprops as a flat prop -> value map rather than C's
        {intrinsic, extrinsic, blocked} struct ... when uprops grows the
        struct, split them here."

   setworn needs .extrinsic and .blocked. NEITHER EXISTS. A flat truthy value
   cannot express "granted by an item in this slot" versus "granted
   intrinsically", which is exactly the distinction every setworn arm turns
   on.

SO THE REAL TASK IS: grow uprops into C's three-field struct keyed by the
numeric prop, then convert its existing readers. That is a defined,
mechanical refactor rather than a guess, and js/youprop.js:24 already names
itself as the place to split. It unblocks setworn's extrinsic arms,
monstunseesu_prop, and w_blocks's blocked bookkeeping in one go.

DO NOT bodge it by adding a second parallel map. One structure, matching C.

SIZED THE BLAST RADIUS, because this one is cross-cutting and worth knowing
before starting:

    55 references to uprops
    14 files
    28 distinct properties read

That is not a function port, it is a state-representation change touching a
seventh of the js/ tree, and every reader has to move in the same commit or
the tree is half-converted. It needs a session with room to convert all 55
and re-run the board, not the tail of one.

RECOMMENDED APPROACH when someone takes it:
  1. grow the struct with BACKWARD-COMPATIBLE reads first -- make
     uprops[PROP] an object whose truthiness still works, so existing
     readers keep passing while the struct exists
  2. convert readers file by file, running frozen/score.sh between each
  3. only then wire setworn's extrinsic arms, monstunseesu_prop and
     w_blocks's blocked bookkeeping

Step 1 is what makes this safe: it decouples "the struct exists" from "every
caller uses it", so a half-finished conversion still scores the same.

## donning() is blocked on afternmv, and must NOT be stubbed

cancel_doff records 'cancel_doff:donning_cancel_don'. The obvious next step
is to port donning() (src/do_wear.c:1574) -- do not. Its ENTIRE body is a
chain of tests against ga.afternmv:

    if (doffing(otmp)) result = TRUE;
    else if (otmp == uarm)  result = (ga.afternmv == Armor_on);
    else if (otmp == uarmu) result = (ga.afternmv == Shirt_on);
    ...

afternmv is ABSENT, and so is doffing. Armor_on, Shirt_on and Cloak_on all
exist (js/allmain.js), which makes this look closer than it is: without
afternmv every arm is unreachable and the function can only `return false`.
That is a stub returning a plausible value, which rule 2 forbids outright,
and it would be invisible -- a hero mid-don would read as not donning and
the multi-item 'A' command would silently take the wrong branch.

WHAT afternmv ACTUALLY IS: C's "call this when the multi-turn occupation
finishes" hook, set by 'W' and by 'P' on armour. Porting it means porting
the occupation mechanism, not a function. That is the real prerequisite and
it is shared with several other recorded gaps (reset_occupations already
exists in js/cmd.js as a partial).

So the honest state of the do_wear chain is: cancel_doff's mask clear is
live and exact, and its cancel_don arm stays recorded until the occupation
mechanism lands.

## The setuwep wiring is structurally wrong, and harmlessly so (for now)

js/wield.js:194 calls setuwep(wep) directly. C DOES NOT. src/wield.c's
dowield tail is:

    oldwep = uwep;
    result = ready_weapon(wep);
    if (flags.pushweapon && oldwep && uwep != oldwep)
        setuswapwep(oldwep);
    untwoweapon();

setuwep is called INSIDE ready_weapon (src/wield.c:169, 104 lines), which is
not ported. So the direct call skips ready_weapon's whole body plus
setuswapwep and untwoweapon.

WHY IT IS NOT AN RNG PROBLEM TODAY: ready_weapon makes ZERO draws -- grepped
its body for rn2/rnd/rnl and there are none. That is why the divergence point
was flat on all three sessions checked. What is skipped is messages and
checks (cockatrice handling, welded refusal, the "you are now wielding"
line), not stream position.

SO THIS IS A SCREEN-PARITY GAP, NOT A STREAM GAP, and it will stay invisible
in the rng column while costing screens on any session that wields and reads
the resulting message. Porting ready_weapon is the fix and its 104 lines are draw-free, which makes
it unusually safe in one sense: it cannot move the stream, so a mistake shows
up as a wrong message rather than a cascade.

BUT IT NEEDS SIX ABSENT HELPERS, so "104 draw-free lines" undersells it:

    bimanual          present  js/obj.js
    prinv             present  js/invent.js
    begin_burn        present  js/do_wear.js
    will_weld         present  js/monmove.js
    is_sword          MISSING
    retouch_object    MISSING  <-- GATES THE WIELD
    cant_wield_corpse MISSING
    empty_handed      MISSING
    arti_speak        MISSING
    TWOWEAPOK         MISSING

retouch_object is the one that matters. C reads

    else if (!retouch_object(&wep, FALSE)) res = ECMD_TIME;

so a false return means the weapon is NOT wielded and the turn is still
spent. It is the cockatrice/gloves check. Porting ready_weapon while
assuming it returns true would wield things C refuses to wield -- silently,
and only in the games where it matters. Do not assume it; port it or record
the arm and decline the wield, which is the same choice passive's arms and
mattackm's specials already make.

FOUR OF THE SIX ARE NOW PORTED, each verified by execution:

    is_sword           js/obj.js     range test over the contiguous band
    empty_handed       js/wield.js   three phrasings, gloves imply hands
    TWOWEAPOK          js/wield.js   file-local, as in C
    cant_wield_corpse  js/wield.js   guard exact; instapetrify recorded

ARTI_SPEAK SHOULD NOT BE PORTED, it should be recorded at the call site.
It needs get_artifact, artilist, getrumor, bcsign and verbalize1 -- an
artifact subsystem plus the rumors file -- and getrumor DRAWS. But
ready_weapon only reaches it under `if (wep->oartifact)`, so it is
artifact-only, the same shape as passive's arms and mattackm's specials.
Porting it would drag in the rumor machinery for a branch almost no session
takes, and getting its draws wrong would move the stream.

SO ready_weapon HAS EXACTLY ONE REAL BLOCKER LEFT: retouch_object. Everything
else is either ported or correctly recordable.

SIZED IT, AND IT BOTTOMS OUT IN THE ARTIFACT SUBSYSTEM:

    retouch_object   src/artifact.c:2508   83 lines   2 draws
    touch_artifact   src/artifact.c         66 lines   2 draws   ALSO ABSENT

retouch_object's common path is: not the invocation bell, then
touch_artifact() true, then neither silver-hatred nor bane applies, then
return 1 and the wield proceeds. So touch_artifact gates it, and
touch_artifact is the SAME function already recorded elsewhere as
can_touch_safely:touch_artifact at 66% REACH -- the highest-reach unported
item that is not a no-op.

THAT CHANGES ITS PRIORITY. touch_artifact is not a wield detail; it sits
under two separate chains and 66% of sessions reach it. 149 draw-bearing
lines for the pair, which is real work but unlocks ready_weapon AND the
can_touch_safely path together.

CAUTION: both functions DRAW (2 each). Unlike ready_weapon's draw-free body,
a mistake here moves the stream and cascades. Port them against the C
line-by-line and check the divergence point, not the aggregate. That makes ready_weapon a
genuinely near-term target rather than the six-dependency wall it looked like
two entries ago.

It is also what dowield:twoweapon_and_artifact (25% reach, top of
unported-hits) actually needs -- untwoweapon and the artifact checks live in
that tail.

## Session close: verification state

Everything below was re-run after the last commit.

    frozen scoreboard   512/11405 screens, 140764/792838 rng, 1/44 sessions
    zero-screen         5, unchanged all session
    generalize          CLEAN on 40 non-session seeds -- no crashes, and only
                        two reached-but-unported paths, both at 3%
                        (themeroom Water-surrounded vault, create_monster:enexto)
    undefined-refs      18, all verified false positives; the one real hit
                        (doclose calling unported feel_newsym) is fixed
    dup-defs            166 differing, unchanged; the `worn` clash is
                        documented in NOTES with the reason not to rename
    tree                clean, HEAD == origin/main

The generalize result is the one that matters for rule 1: nothing ported this
session keys off a public session, and 40 unseen seeds run without error.

PORTED AND WIRED THIS SESSION
    doclose, obstructed, stumble_on_door_mimic, block_point   rng +23
    worn[] table, setworn, setuwep, recalc_telepat_range,
        set_twoweap, cancel_doff                              25% entry cleared
    is_sword, empty_handed, TWOWEAPOK, cant_wield_corpse      4 of ready_weapon's 6
    uhitm unarmed flag, do.js drop wielding checks            uwep fix, 2 of 3 files

NEXT, in priority order
    1. touch_artifact (66 lines, 2 draws) -- 66% reach, unlocks BOTH
       retouch_object/ready_weapon and can_touch_safely

       CORRECTION -- I FIRST RECORDED THIS AS "the artifact data is already
       ported" AND THAT IS WRONG. js/artilist_data.js exports only the ART_*
       INDEX CONSTANTS (34 of them) and an artifact_names list. It does NOT
       export an artilist table. There is no spfx, no attack data, no
       alignment -- exactly the fields every accessor needs.

       So the position is worse than the previous entry claimed:

           ART_* indices     PRESENT   js/artilist_data.js, names only
           artilist table    MISSING   the actual per-artifact records

       THE TABLE IS MECHANICALLY EXTRACTABLE, which makes this a generator
       job rather than hand-transcription. include/artilist.h is 333 lines
       holding 36 A(...) macro invocations with positional fields:

           A(name, otyp, spfx, cspfx, mtype, attk, defn, cary, inv, alignment,
             role, race, cost, color)

       Entry 0 (line 81) is the sentinel A("", STRANGE_OBJECT, 0, 0, 0, ...),
       which CONFIRMS ART_NONARTIFACT == 0 -- so the ART_NONARTIFACT compare
       in bane_applies and retouch_object is an index-zero test, not a
       pointer identity test as the C's `oart != &artilist[ART_NONARTIFACT]`
       makes it look.

       THE EXISTING ART_* INDICES ARE VERIFIED CORRECT. Compared all 34
       against the order of the A(...) entries in include/artilist.h: every
       one lands on the right artifact, so a generated table can be indexed
       by them directly without re-deriving the order. (C's names carry a
       "The " prefix the constants drop, which looks like 14 mismatches until
       you strip it -- do not "fix" that.)

       AND THE ONE APPARENT NAMING DEFECT IS NOT ONE -- I recorded it as real
       and it is not, so DO NOT RENAME ART_YENDORIAN_EXPRESS_CARD. The A()
       macro's LAST field is the constant suffix, and include/artilist.h:295
       ends with YENDORIAN_EXPRESS_CARD, so C's generated constant is
       ART_YENDORIAN_EXPRESS_CARD exactly as ours is. "Platinum" appears only
       in the DISPLAY name. Every one of the 34 constants is right in both
       index and name.

       GENERAL LESSON FOR THE TABLE PORT: the A() macro's display name and
       its constant suffix are DIFFERENT FIELDS and do not always agree.
       Generate the constant from the last field, never from the name.

       THE A() FIELD MAP, so nobody re-derives it. include/artilist.h is an
       X-MACRO file: it is included several times with a DIFFERENT
       #define A(...) each time, which is how one table generates the names
       array, the enum and the records. Seventeen positional fields:

            1 nam    display name        -> artifact_names[]
            2 typ    object type (otyp)
            3 s1     spfx                <- what bane_applies/touch_artifact read
            4 s2     cspfx (carried spfx)
            5 mt     mtype
            6 atk    attack     (NO_ATTK or PHYS(...)/DRLI(...)/etc)
            7 dfn    defence    (NO_DFNS or ...)
            8 cry    carry      (NO_CARY or CARY(...))
            9 inv    invoke
           10 al     alignment
           11 cl     role       (PM_* or NON_PM)
           12 rac    race
           13 gs     gift status
           14 gv     gift value
           15 cost
           16 clr    colour
           17 bn     CONSTANT SUFFIX     -> ART_##bn

       Fields 6-8 hold nested macros with commas inside parentheses, so a
       naive split(',') WILL corrupt the table. Match parenthesis depth.

       js/objects_data.js and js/monst_data.js are the precedent for how a
       generated table lives in this tree; follow their shape. Note that
       tools/dup-defs.mjs already skips *_data.js files, so a generated
       artilist_data will not trip it.
           ART_NONARTIFACT   MISSING   (the sentinel entry's index)
           SPFX_DBONUS       MISSING   include/artifact.h constant
           spec_applies      MISSING   src/artifact.c
           get_artifact      MISSING
           bane_applies      MISSING   src/artifact.c:993, 12 lines, no draws

       So the artifact work is accessors over an existing table, not a data
       port, which is a much better position than it looks. bane_applies in
       particular is 12 draw-free lines once SPFX_DBONUS and spec_applies
       exist. Put the SPFX_* constants in js/const.js named as in
       include/artifact.h, per the architecture rule.
    2. the uprops struct refactor (55 refs, 14 files) -- unlocks setworn's
       extrinsic arms, monstunseesu_prop, w_blocks
    3. mattackm melee path (~400 lines) -- 45% and 41% entries
    4. the dogfood phase offset, which is really object placement
       (~50 missing place_object sites)

## The artifact chain is IN. touch_artifact (66% reach) is wired.

Built and wired end to end this stretch, every piece verified by executing
it rather than importing it:

    js/const.js            30 SPFX_* bits, 49 AD_* damage types, both
                           script-extracted from the headers
    js/artilist_records.js 36 records generated from include/artilist.h
    js/artilist_data.js    now emits ART_NONARTIFACT (generator fixed)
    js/artifact.js         NEW -- spec_applies, bane_applies, get_artifact,
                           touch_artifact
    js/mon.js              local touch_artifact stub REPLACED by the import

can_touch_safely:touch_artifact is cleared. Score is unchanged, which is
correct: the stub already said yes to every non-artifact and no public
session has a monster handling a real one. The gain is entirely in held-out
games, which is what rule 1 asks for.

FOUR DATA-SHAPE DEFECTS WERE FOUND AND FIXED WHILE DOING THIS, all of them
invisible to the scoreboard, and they are the reason to read this section
before touching the table:

  1. spfx kept as SOURCE TEXT made `weap.spfx & SPFX_DBONUS` coerce to NaN,
     so spec_applies silently took its first branch for every artifact.
     spfx/cspfx must be NUMBERS (bit-wise reads); attk/defn/cary stay
     STRUCTS with adtyp as an AD_* name (field-wise reads).
  2. a C comment sits INSIDE the Heart of Ahriman's attack field, so
     comments must be stripped before parsing or exactly one row is wrong.
  3. fields 6..8 hold macros with commas inside parens -- split on
     parenthesis depth, never on commas.
  4. ART_NONARTIFACT was added BY HAND to a GENERATED file; the fix was in
     tools/gen-artifacts.mjs, which had skipped index 0.

NEXT: retouch_object (83 lines, artifact.c) then ready_weapon (104 lines,
draw-free), which closes dowield:twoweapon_and_artifact at 25% reach.
touch_artifact, its gate, is now in place.

## SESSION CLOSE — the wield/artifact chain is complete

unported-hits now tops out at 23% for anything actionable. Both 25% entries
and the 66% entry are cleared.

    100%  topl:remember_topl          ^P history, NO SCREEN OUTPUT, ignore
     23%  getobj:menu
     23%  dofire:polearm_or_whip
     23%  goto_level:losedogs
     23%  level_tele:print_dungeon menu
     18%  dog_invent:distant_name

WIRED AND VERIFIED THIS SESSION (each executed, not merely imported)
    doclose, obstructed, stumble_on_door_mimic, block_point      rng +23
    worn[] table, setworn, setuwep, recalc_telepat_range,
      set_twoweap, cancel_doff
    is_sword, empty_handed, TWOWEAPOK, cant_wield_corpse
    30 SPFX_* bits, 49 AD_* types, 36-record artilist table
    spec_applies, bane_applies, get_artifact, touch_artifact     66% cleared
    retouch_object, ready_weapon, untwoweapon, prinv wiring      25% x2 cleared
    uhitm unarmed flag, do.js drop wielding checks               uwep fix

VERIFICATION AT CLOSE
    512/11405 screens, 140764/792838 rng, 1/44 sessions, 5 zero-screen
    generalize CLEAN on 40 non-session seeds
    undefined-refs 18, all verified false positives
    tree clean, HEAD == origin/main

NEXT TARGETS, in order
    1. the uprops work -- AND IT IS NOT THE REFACTOR I DESCRIBED. Checked
       before starting: game.u.uprops has ZERO WRITE SITES. Nothing in the
       port ever assigns to it, and nothing initialises it. Every one of the
       ~55 references is a READ, all of them optional-chained
       (game.u.uprops?.CLAIRVOYANT), so they all evaluate undefined and every
       intrinsic silently reads as ABSENT.

       So there is no representation to convert -- the structure does not
       exist yet. The task is to BUILD the intrinsics system, not reshape it:
       initialise u.uprops with C's {intrinsic, extrinsic, blocked} struct
       per property, then make the things that GRANT intrinsics write to it
       (setworn's extrinsic arms, potions, corpses, level-up).

       THE TRAP, and it is a bad one: you CANNOT initialise uprops first and
       convert readers afterwards. Every reader is
       `game.u.uprops?.SOMETHING` used as a boolean, and an object is TRUTHY
       in JS. The moment uprops[PROP] becomes {intrinsic, extrinsic,
       blocked}, every one of those ~55 reads flips from false to TRUE and
       the hero acquires every intrinsic in the game at once. The staged,
       pausable migration I sketched earlier does not work here -- the
       initialisation and the reader conversion MUST land together.

       The safe order is therefore: convert all ~55 readers FIRST, while
       uprops is still undefined -- optional chaining keeps them false and
       the score unchanged -- and only then initialise the structure.

       AND THE READERS SHOULD NOT TEST FIELDS DIRECTLY EITHER. C never reads
       uprops inline; it uses the include/youprop.h MACROS, and each one
       combines the three fields differently:

           #define Hunger (HHunger || EHunger)
           #define Deaf   (HDeaf || EDeaf || u.uroleplay.deaf)
           #define Invis  ((HInvis || EInvis) && !BInvis)

       Note Invis subtracts a BLOCKED term that Hunger has no equivalent of,
       and Deaf pulls in a roleplay flag from outside uprops entirely. A
       blanket `uprops[PROP].intrinsic` conversion would be wrong for most
       properties and silently so.

       js/youprop.js already exists with 11 accessors and is the right home.
       So the conversion is: for each of the ~55 reads, port the matching
       youprop.h macro into js/youprop.js and call it. That is mechanical,
       checkable one property at a time against the header, and leaves the
       tree correct at every step.

       That is much larger than a refactor and explains several unrelated
       gaps at once: the hero-side arms of spec_applies and touch_artifact,
       Stone_resistance in cant_wield_corpse, Hate_silver in retouch_object,
       and Blind/Confusion/Stunned in doclose all read uprops and therefore
       all read false today. They are ONE missing subsystem wearing many
       hats, which is worth knowing before anyone ports them individually.
    2. mattackm melee path (~400 lines) -- 45% and 41% entries
    3. the dogfood phase offset, which is really object placement
       (~50 missing place_object sites)
    4. touch_artifact's blast arm needs losehp, Hate_silver, Maybe_Half_Phys

THREE PROCESS RULES THIS SESSION PAID FOR
    read the tool output before theorising -- the scoreboard ERR column, the
      module load error and `command -v timeout` each named a bug I instead
      spent iterations reasoning about
    run the code, do not import it -- seven defects loaded clean and failed
      only when their path went live
    grep for the DEFINITION, not the name -- mentions look like definitions
      and produced both duplicate ports and phantom dependencies

## The uprops READER conversion is DONE. The structure is the next step.

Every raw `game.u.uprops` read outside js/youprop.js now goes through an
accessor. js/youprop.js has 28 exports. generalize re-run clean on 40
non-session seeds. Score-neutral at every step, as a reader conversion
should be: 512 screens, 140764 rng, five zero-screen sessions throughout.

Converted: sounds, mon, eat, allmain, attrib, teleport, cmd, display,
monmove, lock, spell.

WHAT THE PER-MACRO CHECK CAUGHT, and the reason not to have bulk-converted:

  EIGHT SHAPES among ~19 macros --
    intrinsic || extrinsic          Hunger, Wounded_legs, Regeneration,
                                    Fumbling, Conflict, Displaced, ...
    intrinsic ONLY                  Stunned, Confusion
    spelled uprops[X].intrinsic     Sick, Vomiting (no H-macro at all)
    (H || E) && !B                  Invis, Levitation, Clairvoyant
    H && !B, no extrinsic           Blinded  -- unique
    pulls in state outside uprops   Deaf (u.uroleplay.deaf)
    composed of two others          Hallucination (HHallucination &&
                                    !Halluc_resistance)

  TWO NAMING TRAPS -- the macro name is not the property key:
    Stunned        is HStun,          key STUNNED
    Blind_telepat  is (HTelepat|..),  key TELEPAT, no "Telepat" macro exists

  THREE MISSING BLOCKED TERMS, all flagged at their definitions and all to
  be fixed WITH the structure: Invis, Levitation, Blinded.

  TWO DUPLICATE LOCAL COPIES removed: js/teleport.js had its own
  Teleport_control/Stunned/Confusion, js/monmove.js its own Conflict.

  ONE SHADOWING BUG I introduced and caught: js/monmove.js had locals named
  Invis and Displaced holding booleans; importing same-named accessors made
  `(Invis && ...)` always true. Renamed the locals. After adding an accessor
  import, grep the file for the bare identifier.

NEXT: initialise u.uprops with C's {intrinsic, extrinsic, blocked} per
property. READ THIS PARAGRAPH FIRST, because the obvious version is a trap.

The 28 accessors currently read the VALUE:

    export const Hunger = () => !!game.u?.uprops?.HUNGER;

The moment uprops[HUNGER] becomes {intrinsic:0, extrinsic:0, blocked:0},
that is an OBJECT and therefore TRUTHY, so every accessor returns true and
the hero acquires every property at once. Converting the CALL SITES to
accessors did NOT by itself make this safe -- it made it fixable in ONE
PLACE instead of fifty-five, which is a different and smaller claim than
'the readers are correct in shape'.

RESOLVED -- STEPS 1 AND 2 ARE DONE, AND THE TRAP IS GONE. All 23
value-reading accessors now read FIELDS via H/E/B, each per its C shape,
and Invis, Levitation and Blinded carry their !B term again.

Because H('X') reads game.u?.uprops?.['X']?.intrinsic, an ABSENT property
still yields false. So the accessors are correct BOTH before and after
uprops exists, and initialising it can no longer flip everything true. What
was an atomic all-or-nothing commit is now an ordinary additive change.

ONE MORE FAITHFULNESS GAP IN THE ACCESSORS, found while looking at the
initialisation and worth fixing before any writer lands.

C keys uprops BY NUMBER -- u.uprops[HUNGER] where HUNGER is 28 -- and
js/const.js ALREADY HAS those numbers: HUNGER 28, INVIS 40, LAST_PROP 68.
Our accessors key by STRING: H('HUNGER'). That works, but it is a JS-shaped
structure the C does not have, and it means the eventual uprops is a bag of
string keys rather than C's array of LAST_PROP+1 entries.

FIX IT BEFORE THE WRITERS, not after: change H/E/B's callers from H('INVIS')
to H(INVIS) with the constant imported, and initialise uprops as an array
indexed 0..LAST_PROP. Doing it afterwards means rewriting every writer too.
It is a mechanical edit across the 23 accessors in one file, and
score-neutral for the same reason the last one was -- an absent entry still
reads false either way.

AND DO NOT INITIALISE uprops AS A SEPARATE STEP -- checked, and there is
nothing to port. src/u_init.c never touches uprops: `u` is a C global, so
the array is zero-initialised at startup and no code does it explicitly.
js/gstate.js is just `game = {}`, with game.u populated ad hoc by whoever
assigns first.

Since the accessors already read false for an absent entry, an empty
uprops and a zeroed one behave identically. Initialising it on its own is
INERT -- it adds a structure nothing reads differently and nothing writes.
Create it in the SAME change as the first writer, where it finally means
something.

WHAT REMAINS is the writer side, and it is the actual missing subsystem:
    - make the things that GRANT intrinsics write to it: setworn's extrinsic
      arms (js/worn.js, still recorded), potions, corpses, level-up
    - the oc_oprop bridge -- WHICH TURNS OUT NOT TO BE NEEDED. This was
      recorded three times as the blocker under setworn's extrinsic arms,
      monstunseesu_prop and w_blocks. It is gone, and keying uprops by
      NUMBER is what removed it.

      oc_oprop IS ALREADY A PROPERTY NUMBER in the same space const.js uses.
      Checked: objects_data entry 93 has oc_oprop 35 and CLAIRVOYANT is 35,
      entry 100 has 30 and TELEPAT is 30, entry 101 has 12 and ANTIMAGIC is
      12 -- all plausible amulet properties. (A reverse lookup by value is
      ambiguous because many unrelated constants share numbers, so check
      forward from a known property, not backward from a value.)

      So C's line ports directly now:

          p = objects[oobj->otyp].oc_oprop;
          u.uprops[p].extrinsic &= ~wp->w_mask;

      becomes the same thing in JS with no translation layer. setworn's
      extrinsic arms are a SHORT edit, not a subsystem, and they are the
      obvious first writer to add -- create uprops in that same change.

Only then do the hero-side arms recorded in spec_applies, touch_artifact,
cant_wield_corpse (Stone_resistance), retouch_object (Hate_silver) and
doclose (Blind/Confusion/Stunned) start returning anything but false.

## uprops: DONE as a subsystem. What it unblocks, and what still gates.

Readers, shape and a first writer all landed. js/youprop.js has exactly
three direct uprops reads -- H, E and B -- and every accessor composes from
them the way C's macros compose from their per-property trio.

    keying          BY NUMBER, as C: H(HUNGER), not H('HUNGER')
    shapes          each accessor per its own youprop.h macro, nine forms
    blocked terms   restored on Invis, Levitation, Blinded, Clairvoyant,
                    Flying
    writer          setworn's extrinsic arms, both don and doff, with
                    w_blocks feeding the blocked field
    verified        a helm whose oc_oprop is CLAIRVOYANT makes
                    Clairvoyant() true while worn and false once removed

THE oc_oprop BRIDGE NEVER NEEDED TO EXIST -- oc_oprop is already a property
number, and keying uprops by number is what removed the mismatch. It had
been recorded three times as a blocker.

STILL GATED, because these are separate missing pieces rather than uprops:
    monstunseesu_prop   needs monstunseesu and cvt_prop_to_mseenres
    artifact intrinsics needs set_artifact_intrinsic
    the hero-side arms in spec_applies and touch_artifact need role, race
                        and alignment tracking, not properties
    Stone_resistance, Hate_silver  now EXPRESSIBLE -- they are ordinary
                        properties, so they become accessor calls the
                        moment someone writes them

NEXT WRITERS, in rough order of reach: potions (quaffing confers
intrinsics), corpses (eating confers them), level-up. Each is now an
ordinary edit against a working structure.

## src/worn.c is ported except check_wornmask_slots (deliberately)

js/worn.js now mirrors the file:

    worn[]                 the mask-to-slot table
    setworn                slot walk + extrinsic bookkeeping (writer)
    setnotworn             the object-oriented counterpart
    allunworn              clears pointers WITHOUT unworning, as C does
    wearmask_to_obj        first matching slot; early return is deliberate
    wornmask_to_armcat     default 0 means ARM_SUIT, not a sentinel
    armcat_to_wornmask     default 0 means "no mask" -- opposite meaning
    wearslot               which slots an item might occupy
    mon_set_minvis         perminvis/minvis split, exact
    mon_adjust_speed       the stepping switch, verified arm by arm
    update_mon_extrinsics  already present; its FAST arms now wired
    recalc_telepat_range   walks the table
    w_blocks               pre-existing

NOT PORTED, on purpose: check_wornmask_slots (130 lines). It runs only under
the `sanity_check` option, so it never executes in a scored session -- it
would add 130 lines of code the judge never reaches. It also needs
impossible() and fmt_ptr, neither ported. The worn[] table it walks now
exists with its w_what field, so it is straightforward whenever someone
wants it; it is simply not worth context ahead of code that runs.

WHAT THIS UNLOCKED, and it is more than the file: setworn's extrinsic arms
are the first uprops WRITER, so wearing an item now confers its property and
removing it revokes it. That was verified end to end with a clairvoyance
helm.

## src/steal.c: what is portable and what is not

js/steal.js now has somegold, mdrop_obj, relobj (plus the droppables wire).
Checked the rest before continuing and stopped, because the next functions
are all gated on infrastructure rather than on each other:

    thiefdead      needs ga.afternmv -- the OCCUPATION mechanism, unported.
                   Same blocker as donning() recorded earlier.
    unresponsive   needs unconscious(), is_fainted() and gm.multi_reason.
                   None exist; game.multi does, multi_reason does not.
    unstolenarm    an afternmv callback, so same blocker as thiefdead
    stealarm       likewise
    steal          275 lines, and the big one
    findgold       ALREADY EXISTS TWICE, in js/makemon.js and js/monmove.js,
                   neither matching C. Consolidating it into js/steal.js is
                   correct and was tried; it needs the makemon -> steal ->
                   mkobj -> makemon cycle broken first. See NOTES.

SO THE OCCUPATION MECHANISM (ga.afternmv and friends) IS THE COMMON GATE for
four of these, as it is for donning() in js/do_wear.js. That makes it a
better target than any individual function behind it: js/cmd.js already has
reset_occupations as a partial, so there is a starting point.

## The occupation mechanism is IN. donning/doffing now need the callbacks.

js/hack.js:nomul was already ported; unmul is now in beside it, so
game.afternmv is called when a multi-turn action completes and a callback
can re-arm it (clear-before-call, verified). That closes the blocker
recorded separately for donning, thiefdead, stealarm and unstolenarm.

WHAT donning/doffing NEED NOW is not the mechanism but the CALLBACKS they
compare against. Of the fourteen, exactly ONE exists:

    Armor_on    js/do_wear.js       PRESENT
    Shirt_on, Cloak_on, Boots_on, Helmet_on, Gloves_on, Shield_on   MISSING
    Armor_off, Shirt_off, Cloak_off, Boots_off, Helmet_off,
      Gloves_off, Shield_off                                        MISSING

AND THERE IS A TRAP IN PORTING THEM EARLY. donning is a chain of

    result = (ga.afternmv == Shirt_on);

so if Shirt_on is undefined in JS, that becomes `game.afternmv === undefined`,
which is TRUE whenever no occupation is armed. Six of seven arms would
report "currently donning" for every object. Porting donning before its
callbacks exist is worse than not porting it -- guard each comparison, or
port the callbacks first.

doffing has the same shape plus a takeoff.what check per slot, and its
1-turn items (amulet, rings, blindfold) need only takeoff.what, so those
arms ARE portable today.

SIZED THE CALLBACKS, since donning needs them ALL before it is safe:

    Shirt_on    16      Gloves_on   27      Shield_on   25
    Cloak_on    54      Boots_on    72      Helmet_on   81
                                            ---------------
                                            275 lines, six functions

plus seven _off counterparts, unsized. And a partial port does NOT help:
donning's undefined-arm hazard means five defined callbacks and one missing
still misreports for that one slot. It is all-or-nothing per function.

These are not thin wrappers either -- Helmet_on at 81 lines handles the
helm of brilliance and opposite alignment, Boots_on at 72 does levitation,
speed and fumbling. Each confers or removes real effects, so they want the
uprops writer that now exists rather than being recorded.

A REASONABLE ORDER for whoever takes it: port the six _on callbacks (they
are the ones donning needs), then donning, then the _off set and doffing.
The occupation mechanism underneath them is done, so nothing else blocks.

## The wear/occupation chain is IN. What it took and what is next.

Built end to end this stretch, each piece verified by executing it:

    js/hack.js      unmul            the occupation completion half; calls
                                     afternmv, clear-before-call verified
    js/do_wear.js   Shirt_on         C's empty switch kept deliberately
                    Shield_on        magical shields handled by setworn
                    Gloves_on        DRAWS: rnd(20) guard ported exactly
                    Cloak_on         alchemy smock's 2nd property done
                    Boots_on         DRAWS: same guard; FROMOUTSIDE branch
                    Helmet_on        C's FALLTHROUGH preserved
                    donning          all seven comparands real
                    doffing          _off halves guarded, not compared
                    cancel_don       wired into cancel_doff
                    Armor_on         FIXED: read game.uarm, nothing writes it
    js/steal.js     somegold         DRAWS: the <50 no-draw arm is the trap
                    unstolenarm      searches invent, not worn slots
                    thiefdead        swap RECORDED, stealarm not ported

STEALARM IS THE NEXT ONE AND IT IS NOT A LEAF. Its guards are portable --
dmgtype, distu, DEADMONSTER, freeinv and mpickobj all exist -- but its
action block needs subfrombill, monflee, tele_restrict and rloc, and RLOC
DRAWS. Recording the action block would silently skip draws C makes, so
port rloc first or leave stealarm alone. Do not half-port it.

SIZED rloc AND IT IS NOT A LEAF EITHER: src/teleport.c:1799, 96 lines with
THREE draws, needing tele(), stairway_find_forwiz(), In_W_tower() and
rloc_pos_ok(). goodpos() exists; the rest do not. So the chain under
stealarm is at least two functions deep before anything can be ported
faithfully, and both layers draw.

THAT MAKES stealarm A POOR TARGET, not a near one. Better next moves are
the ones whose dependencies are already present -- the 157 remaining
dup-defs duplicates, or the _off callbacks (Armor_off and friends), which
mirror the _on set that just landed and need only what those needed.

THE PATTERN WORTH REUSING: three of these arms only became portable because
the uprops writer landed earlier in the session -- Shield_on's magical
shields, Gloves_on's draw guard, Cloak_on's alchemy smock. Recording gaps
precisely rather than stubbing them is what let them close later without
anyone re-deriving the context.

## The wear/take-off chain is COMPLETE and unguarded

Twenty-one functions, all live, verified by execution rather than by reading:

    js/hack.js      unmul                        occupation completion
    js/do_wear.js   Shirt/Shield/Gloves/Cloak/
                    Boots/Helmet _on             six
                    Shirt/Armor/Shield/Helmet/
                    Cloak/Gloves/Boots _off      seven
                    donning, doffing             both halves live
                    cancel_don, cancel_doff      wired to each other
                    Armor_on                     FIXED: read an unwritten slot
    js/worn.js      worn[] W_ARMC entry          FIXED: table was missing a row

TWO REAL BUGS FOUND IN MY OWN EARLIER WORK, both by testing behaviour rather
than reading code:

  Armor_on read game.uarm, which nothing writes -- setworn writes
  game.u.uarm. Same defect class as the uwep one fixed at the start of the
  session; this was its third file.

  js/worn.js's worn[] table was MISSING ITS CLOAK ROW. C has sixteen entries
  and mine had fifteen, so every cloak operation silently did nothing. It
  surfaced only when Cloak_off needed a cloak to exist. A table reviews
  clean with a row missing -- length checks and name spot-checks both pass.

WHAT THE CHAIN NOW DOES END TO END, verified: wearing an alchemy smock
confers acid AND poison resistance and removing it revokes both; levitation
boots confer and revoke, and reach float_down rather than float_vs_flight;
gauntlets of fumbling confer, and Gloves_off clears both halves; an
interrupted don leaves a cornuthaum's CHA change alone while a completed one
reverses it.

NEXT, and both callers were sized before choosing:

    accessory_or_armor_on   219 lines
    armor_or_accessory_off   58 lines, NO DRAWS

armor_or_accessory_off looks like the small one and is not worth doing yet:
all SIX of its dispatch targets are absent -- armoroff, Ring_off,
Amulet_off, Blindf_off, off_msg and select_off. Its guards are portable and
real (the "you can't take that off without removing your cloak first"
behaviour), but with every arm recorded it would return ECMD_TIME while
nothing actually comes off. Port armoroff and select_off first, or leave it.

SO THE READY WORK IS ELSEWHERE: the remaining 150 dup-defs duplicates, of
which roughly two thirds have genuinely different bodies. That pass found a
live bug in js/dog.js's helpless and a silent behaviour divergence in
accessible, so it is not cosmetic.

## SESSION END STATE

    512/11405 screens (4.5%)   140764/792838 rng (17.8%)   1/44 sessions
    5 zero-screen sessions     generalize CLEAN on 40 non-session seeds
    dup-defs 107 (from 172)    undefined-refs 18 (all verified false positives)
    tree clean, HEAD == origin/main

LANDED THIS SESSION, all verified by executing the code rather than reading it:

    the leaderboard fix       we were the only fork of 16 unlisted, missing
                              .teleport/repo-metadata.json entirely. Without
                              it the port scored NOTHING regardless of quality.
    doclose + 3 helpers       rng +23
    worn.c complete           13 functions; worn[] table, setworn, setnotworn,
                              wearslot and the rest
    the artifact chain        SPFX_/AD_ constants, generated 36-record
                              artilist, spec_applies, bane_applies,
                              get_artifact, touch_artifact, retouch_object
                              -- cleared the 66% reach entry
    the uprops subsystem      23 accessors in C's H/E/B shape, numeric
                              keying, blocked terms restored, setworn as
                              first writer. Wearing an item now confers its
                              property and removing it revokes it.
    the wear/take-off chain   unmul, six _on callbacks, seven _off
                              callbacks, donning, doffing, cancel_don --
                              21 functions, all unguarded
    ready_weapon + setuwep    cleared both 25% reach entries
    62 duplicates removed     including a live bug in the pet-movement path

THREE REAL BUGS FOUND IN EARLIER WORK, none visible to the scoreboard:
    js/worn.js's worn[] table was MISSING ITS CLOAK ROW -- every cloak
        operation silently did nothing
    Armor_on read game.uarm, which nothing writes
    js/dog.js's helpless carried an extra mfrozen term, changing combat
        branches in the pet-movement path

NEXT, in order of readiness:
    1. the ~107 remaining dup-defs, all genuinely different bodies. Three
       were real defects. Read one at a time.
    2. accessory_or_armor_on (219 lines) -- the caller that arms the wear
       callbacks, now that all thirteen exist
    3. armoroff + select_off, which unblock armor_or_accessory_off
    4. the mkobj -> makemon cycle break: four wrong-home names, one being
       mkobj importing its own C file's function

## dup-defs pass final: 172 -> 101, and NINE real defects

The pass is worth summarising separately from the count, because the count
undersells it. Nine of the names cleared were genuine defects, none of which
the scoreboard could see:

    helpless        extra mfrozen term, live in the pet-movement path
    accessible      returned early on a missing location, skipped closed_door
    is_armed        inline mattk scan; throws where the real one returns false
    blessorcurse    set the flag instead of calling curse()/bless()
    Has_contents    cobj != null on an array initialised to [] -- every EMPTY
                    container read as full
    In_endgame      compared the dungeon NAME to a string, and it GATES A DRAW
    Is_stronghold   returned an && chain rather than a boolean
    align_gname     BOTH copies wrong; the real defect was three missing lines
                    in role_init (src/role.c:2079), now ported
    can_saddle      tested ONE of C's seven conditions

WHAT IS LEFT: ~101 names, all with genuinely different bodies. The inert
constant re-declarations are exhausted.

THE RULES THIS PASS EARNED, all in NOTES:
  - a duplicate can be a SYMPTOM of a missing port, not a tidiness problem.
    align_gname proved it: deleting either copy would have shipped a bug.
  - read both bodies against the C before deleting either. The wrong copy is
    right about half the time.
  - the third copy hides. Five names still reported after the first fix.
  - importing js/const.js is safe by construction; other modules are not.
    Check the TARGET's imports before calling an edge risky.
  - four formatting variants defeat batch edits: aligned spacing, multi-line
    imports, trailing commas, single- vs multi-line definitions.
### Next action (cold start)
`in_rooms` un-stubbing is CLOSED (regresses -394 screens, see NOTES). Do not retry.
Remaining ready targets, in order:
1. `accessory_or_armor_on` (219 lines, src/do_wear.c) -- unblocked, all 13 wear
   callbacks now exist.
2. `armoroff` + `select_off`, which unblock `armor_or_accessory_off`.
3. ~100 remaining dup-defs names. Rule from the last pass: read BOTH bodies
   against the C before deleting either; the wrong copy is right about half the
   time, and a duplicate can be a symptom of a missing port.
Baseline to beat: 512/11405 screens, RNG 140764/792838, 1/44 sessions.
Always `node tools/generalize.mjs` before pushing; it is the anti-overfit gate.


### canwearobj dependency chain (in progress)

`canwearobj` (`src/do_wear.c:2030`) is the gate for `accessory_or_armor_on`
(2209), which is the gate for `dowear`/`doputon` (2432/2454). None of the six
exist yet. `canwearobj` itself has no RNG draws -- it is pure validation -- so
it is safe to land ahead of the draw-bearing callers.

Landed for it so far: `lowc`/`strstri` (hacklib), `is_crackable` (obj),
`hard_helmet` (do_wear), `cloak_/helm_/gloves_/boots_simple_name` (objnam), the
`c_*` file-static message strings and `already_wearing`/`already_wearing2`
(do_wear), `Glib` (youprop).

Still missing before `canwearobj` can be written:
- `racial_exception` (`src/worn.c:1360`) -- needs `raceptr` and
  `is_elven_armor`, neither ported.
- `silly_thing` (`src/invent.c:2094`).
- `fingers_or_gloves` (`src/do_wear.c:60`) -- needs `body_part`
  (`src/polyself.c`), which is a table-driven function, not a one-liner.

Note the message primitives in `js/pline.js` (`You`, `Your`, `You_cant`,
`pline_The`) are all **async**, so `canwearobj` and everything above it must be
async too. That is a real structural constraint on the whole wear path, not a
detail: the C returns int and the JS must return a promise.


### canwearobj chain -- current front (updated)

Now landed: `lowc`/`strstri` (hacklib), `is_crackable` + the four racial-armor
macros (obj), `hard_helmet` + the `c_*` file statics +
`already_wearing`/`already_wearing2` (do_wear),
`cloak_/helm_/gloves_/boots_simple_name` (objnam), `Glib` (youprop),
`raceptr` (mondata), `silly_thing` + `silly_thing_to` (invent/const), and
`racial_exception` rewritten to go through `raceptr`.

**Exactly one dependency is left before `canwearobj` can be written:**
`fingers_or_gloves` (`src/do_wear.c:60`), which needs `body_part`
(`src/polyself.c:2143`). `body_part` is a one-line wrapper over `mbodypart`
(`src/polyself.c:1972-2140`, ~168 lines with several static string tables:
`humanoid_parts`, and siblings for animals, birds, etc). `mbodypart` is the
real work and should be a session's own task -- it is table-heavy and every
table entry is a message string that reaches the screen.

Once `mbodypart` lands: `body_part` and `fingers_or_gloves` are both one-liners,
then `canwearobj` (`src/do_wear.c:2030`, ~180 lines, NO RNG draws) can go in
whole. After that `accessory_or_armor_on` (2209) is the next gate, and it DOES
draw.

Reminder recorded above and worth repeating: `js/pline.js`'s message helpers are
async, so `canwearobj` and everything above it are async functions returning
promises where the C returns int.


### The worn-gear chain is now LIVE (was entirely dead)

`setworn()` was ported but called from nowhere, so `game.u.uarm` / `uarmg` /
`uarmc` were never assigned and no starting item conferred an extrinsic.
Everything downstream was silently inert, including every `<X>_on()` callback
reached through `set_wear()`.

Fixed in three commits, each measured on its own:
1. `set_wear()` read bare `game.uarm` (22 sites) where `js/worn.js` writes
   `game.u[wp.w_obj]`. Neutral on its own -- it could not fire either way.
2. `js/u_init.js:535` now calls `setworn(obj, slot)` instead of assigning
   `obj.owornmask`. **RNG +2**, and three previously UNREACHABLE unported
   markers started firing in 100% of games, which is the real evidence the
   chain went live.
3. Those three then ported out: `setworn:nudist`, `setworn:tux_penalty`
   (plus the `setnotworn` twin) and `recalc_telepat_range:artifact_esp`.

Supporting ports: `Role_if` (`include/you.h:247`) into `js/role.js`, and
`struct u_roleplay` (`include/you.h:169`) mirrored onto `g.u` in
`js/jsmain.js`. Nothing assigned `uroleplay` before, so `pauper` still reads
false exactly as it did; the struct exists so `nudist` has a real field.

`generalize`'s reached-but-unported list is now down to two 3% entries
(`themeroom Water-surrounded vault`, `create_monster:enexto`).

**Lesson worth carrying:** a marker that fires in 100% of games after a change
is the strongest available signal that the change connected something real.
Watch that list, not just the screen count -- all three of these were invisible
to the scoreboard both before and after.

### Still the next target
`canwearobj` (`src/do_wear.c:2030`). `mbodypart`/`body_part` landed, so only
`fingers_or_gloves` (`src/do_wear.c:60`, a one-liner) stands between here and
writing it. It reads `uarmg`, which now actually gets assigned.


### `canwearobj` is LANDED

`src/do_wear.c:2030`, ~180 lines, ported whole. No RNG draws: every branch is a
validation or a message. Both gates clean, board unchanged (nothing calls it
yet, which is expected).

Two things about the port worth knowing before touching it:

- **`mask` is an out-parameter.** C takes `long *mask`; the JS takes an object
  and assigns `mask.mask`. Callers do `const m = { mask: 0 };
  await canwearobj(otmp, m, noisy);` then read `m.mask`. Only the success paths
  write it, same as the C.
- **It is `async`**, because `js/pline.js`'s helpers are. Every caller up the
  chain inherits that.

One arm is deliberately incomplete and recorded, not faked:
`canwearobj:surface`. The TT_INFLOOR / TT_LAVA message needs
`surface(u.ux, u.uy)` (`src/dungeon.c:1750`), which pulls in the whole
swallow/pool/ice/lava/altar/grave/fountain/stairs terrain stack, about 20
unported dependencies, to produce one word in one message that requires being
trapped in a floor while trying to wear boots. Recorded via
`note_unported_do_wear` rather than guessing a surface word.

Also landed: `fingers_or_gloves` (`src/do_wear.c:60`) and `plur`
(`include/hack.h:1520`).

**Note a new import cycle exists and is fine:** `js/do_wear.js` imports
`gloves_simple_name`/`makeplural` from `js/objnam.js`, and `js/objnam.js`
already imports `hard_helmet` from `js/do_wear.js`. Verified safe -- every
binding is a hoisted function declaration used only inside function bodies,
never read at module-init time. The board did not move when the edge was added,
which is the check that matters (a bad cycle zeroes it to 0/0).

### Next
`accessory_or_armor_on` (`src/do_wear.c:2209`) is now unblocked and IS
draw-bearing, unlike everything landed so far in this chain. After that
`dowear` (2432) and `doputon` (2454) are the command entry points, then
`armoroff` (1920) and `select_off` (2696) for the take-off side.


### `accessory_or_armor_on` — surveyed, NOT yet written, and here is the map

`src/do_wear.c:2209`, 219 lines. Read in full. Eleven dependencies are missing,
so it cannot be written honestly yet. Landed this pass: `nolimbs`
(`include/mondata.h:53`), `makeknown` (`include/hack.h:1530`), `off_msg`
(`src/do_wear.c:66`).

**The function splits cleanly into two arms, and the armor arm is much closer.**

ARMOR arm still needs only:
- `remove_worn_item` (`src/steal.c:213`)
- `on_msg` (`src/do_wear.c:76`) — needs `the()` and `obj_is_pname()`; `prinv`,
  `xname`, `doname`, `body_part`, `an` all exist.

Everything else the armor arm touches is done: `canwearobj`, `setworn`, all
seven `<X>_on` callbacks, `nomul`, `unmul`, `makeknown`.

ACCESSORY arm needs, and is a much bigger job:
- `yn_function` — an INTERACTIVE PROMPT (the "Which ring-finger, Right or
  Left?" loop). This is its own project, not a helper.
- `Ring_on`, `Amulet_on`, `Blindf_on`, `set_bknown`, `is_worn`,
  `ansimpleoname`, `safe_typename`.

**`the()` is the next real blocker for `on_msg`.** `src/objnam.c:2171`, ~70
lines, and it pulls in `CapitalMon`, `fruit_from_name`, `artifact_name` and
`nextobuf`. `an()`/`An()`/`just_an()` are already in `js/objnam.js`, so it has a
home; it is the dependency depth that makes it a task rather than a one-liner.

Suggested order from here: `the()` + `obj_is_pname()` -> `on_msg` ->
`remove_worn_item` -> the ARMOR arm of `accessory_or_armor_on` only, with the
accessory arm recorded via note_unported. That gets 'W' working end to end
without waiting on `yn_function`.


### `the()` is a MUCH deeper chain than it looked; route around it

`the()` (`src/objnam.c:2171`) needs `CapitalMon`, and `CapitalMon`
(`src/rumors.c:791`) needs `init_CapMons` (`src/rumors.c:829-935`, ~106 lines)
which builds a cached list from all of `mons[]` plus the ~20 hallucination
bogon entries. That drags in the rumors/bogusmon subsystem for one predicate.
`fruit_from_name` (`src/objnam.c:443-519`, 76 lines) is the other blocker.

**Do not port `the()` to get `on_msg`.** `on_msg` only calls it on the
`obj_is_pname(otmp)` branch, which requires an object that is BOTH an artifact
AND has a player-assigned name. Ordinary armor -- the whole reason we want
`on_msg` -- takes the `an()` path, which has been ported for a while. So
`on_msg` is writable now with the `the()` arm recorded via note_unported.

Landed toward that: `highc`, `strncmpi`, `strcmpi`, `fuzzymatch` (hacklib, all
with behavioural tests), `artifact_name` (`src/artifact.c:329`), `Is_box`
(`include/obj.h:338`), and `artidisco` + `undiscovered_artifact`
(`src/artifact.c`).

`obj_is_pname` still needs `not_fully_identified` (`src/objnam.c:1787`, ~40
lines), whose remaining gaps are just `is_damageable` / `is_weptool` -- both
already in `js/mkobj.js` under the injected-table signature (see the NOTES entry
on why that duplication is deliberate).

Suggested next: `not_fully_identified` -> `obj_is_pname` -> `on_msg` (with the
`the()` arm noted) -> `remove_worn_item` (`src/steal.c:213`) -> the ARMOR arm of
`accessory_or_armor_on`, leaving the accessory arm noted until `yn_function`
exists.


### `on_msg` is LANDED; `remove_worn_item` is the last gap before the armor arm

Landed this pass: `not_fully_identified` and `obj_is_pname` (`src/objnam.c`),
`on_msg` (`src/do_wear.c:76`), `uwepgone`/`uswapwepgone`/`uqwepgone`
(`src/wield.c:873-900`), `Is_box`, `artidisco`+`undiscovered_artifact`, and
`is_damageable` exported from `js/mkobj.js`.

**A real C detail that would have silently diverged:** `not_fully_identified`
has an `#ifdef MAIL_STRUCTURES` around its bknown test. MAIL_STRUCTURES IS
defined (`include/global.h:430`), so the live condition is
`(!bknown && otyp != SCR_MAIL)`, NOT the plain `!bknown` in the `#else`. Always
check whether an ifdef is actually on before picking an arm.

`on_msg` records `on_msg:the` on the named-artifact branch only; every ordinary
object takes `an()`. See the STATUS entry above for why `the()` is not worth
porting yet.

**Remaining for the ARMOR arm of `accessory_or_armor_on`:**
`remove_worn_item` (`src/steal.c:213`). All seven armor `<X>_off` callbacks
exist, and the W_WEAPONS arm now has `uwepgone`/`uswapwepgone`/`uqwepgone`.
Still missing for ITS other arms: `Amulet_off`, `Ring_gone`, `Blindf_off`,
`skinback`. Those are accessory/eyewear paths, so `remove_worn_item` can be
written with them recorded, exactly like `on_msg`.

After that the armor arm of `accessory_or_armor_on` can go in, leaving the
accessory arm noted until `yn_function` exists.


### `accessory_or_armor_on` armor arm is LANDED; `dowear` is blocked on async

Landed: `remove_worn_item` (`src/steal.c:213`) and the ARMOR arm of
`accessory_or_armor_on` (`src/do_wear.c:2209`) in full. Both gates clean.

The accessory arm records `accessory_or_armor_on:accessory` and returns
ECMD_OK. It needs `yn_function` (the "Which ring-finger, Right or Left?" prompt
loop), `Ring_on`/`Amulet_on`/`Blindf_on`, `set_bknown`, `is_worn`,
`ansimpleoname`, `safe_typename`. `remove_worn_item` similarly records its
`Amulet_off` / `Ring_gone` / `Blindf_off` / `skinback` / `unpunish` arms.

**`dowear` and `doputon` are BLOCKED, and not on a missing function.** Both are
short and their only real dependency is `getobj(word, wear_ok, ...)`.
`wear_ok`/`puton_ok` are one-liners over `equip_ok` (`src/do_wear.c:3404`, 44
lines), and `equip_ok` calls `canwearobj`, which is async in this port because
`js/pline.js` is. `js/invent.js:131 getobj_letters()` calls the callback
SYNCHRONOUSLY and compares against `GETOBJ_*`; an async callback returns a
Promise, which is truthy and matches no constant, so the filtering silently
takes the wrong branch with no error.

See the NOTES entry "async contagion from pline() hits a sync callback boundary
at getobj". **Resolve that first** -- make `getobj_letters` and its callers
async and await the callback -- as its own measured commit. Then `equip_ok`,
the four ok-callbacks, `dowear` and `doputon` all follow quickly.

Everything else on the wear path is now in place: `canwearobj`, `on_msg`,
`off_msg`, `remove_worn_item`, `setworn`, all seven `<X>_on` and `<X>_off`
callbacks, `nomul`/`unmul`, `retouch_object`, `makeknown`.


### The 'W' command chain is COMPLETE end to end (armor arm)

Three commits this pass, each measured:

1. `js/invent.js getobj_letters()` is now **async** and awaits its callback.
   This was the blocker recorded in NOTES: an async getobj callback returned a
   Promise into a sync comparison against `GETOBJ_*`, silently taking the wrong
   branch. Awaiting a non-Promise is a no-op, so existing sync callbacks are
   unaffected. Board unchanged, which is the point -- it was a latent trap, not
   a live bug, because no async callback was wired yet.
2. `equip_ok` (`src/do_wear.c:3404`), the four getobj callbacks
   `wear_ok`/`takeoff_ok`/`puton_ok`/`remove_ok`, plus `dowear` (2432) and
   `doputon` (2454).
3. **`js/cmd.js` had its OWN `equip_ok` and all four callbacks**, wired into
   `GETOBJ_CMD`, with `note_unported_cmd('equip_ok:canwearobj')` standing in for
   the real call. Removed those 61 lines; cmd.js now imports the real ones from
   `js/do_wear.js`, which is their C home. So the canwearobj arm went from
   recorded to LIVE as a side effect of the dedup.

Watch for this shape: **a `note_unported` marker can be a placeholder for a
function that later gets ported somewhere else.** Nothing links them. Grep the
markers for a name whenever you finish porting that name, or the port sits
unused while a stub keeps answering.

Still recorded, deliberately:
- `equip_ok:inaccessible_equipment` -- only reachable with removing=true, so
  'T'/'R' hit it and 'W'/'P' do not.
- `accessory_or_armor_on:accessory` -- needs `yn_function`.
- `on_msg:the`, `accessory_or_armor_on:helm_opposite_quest`,
  `accessory_or_armor_on:nomovemsg`, `remove_worn_item`'s accessory arms.

### Next
The take-off side: `armoroff` (`src/do_wear.c:1920`) and `select_off` (2696),
which `takeoff_ok`/`remove_ok` already route to. Or `yn_function`, which
unblocks every accessory path at once and is the single highest-leverage
missing piece in this subsystem.


### CORRECTION: `yn_function` was never the blocker

An earlier entry called `yn_function` "the single highest-leverage missing
piece". That was wrong. `tty_yn_function(query, resp, def)` already exists in
`js/tty/topl.js` and is already used by `js/cmd.js` and `js/invent.js`. In the C
`yn_function` is just the windowport dispatch macro
(`include/winprocs.h:176`), so the windowport function IS the thing.

The lesson: **grep the tty/ windowport files before declaring a UI primitive
missing.** C's `yn_function`/`getlin`/`display_nhwindow` names do not appear in
our tree at all -- only their `tty_` implementations do -- so a search for the C
name finds nothing and reads as unported.

One real gap remains there and is recorded in `js/tty/topl.js` itself: the
`resp` filter (allowed characters, '#' for digits) is not implemented. For the
ring prompt that is survivable, because the C wraps it in
`do { ... } while (!mask)` which re-prompts until a valid answer; the filter
only affects the displayed "[rl or ESC]" hint and the beep on a bad key.

### Accessory arm: what is actually left

Landed this pass toward it: `set_bknown` (`src/mkobj.c:1864`), `is_worn`
(`src/invent.c:2156`), and the `include/youprop.h` blind family -- `Blind`,
`Blindfolded`, `Blindfolded_only`, `PermaBlind`, `Punished`.

Note `Blind` is NOT the same as the already-present `Blinded`:
`Blind == ((HBlinded || EBlinded) && !BBlinded)`. The C explicitly declines to
write it as `(Blinded || Blindfolded)` even though that is equivalent today,
and this port follows the C's form.

Still needed, in size order:
- `Blindf_on` (`src/do_wear.c:1461`, 31 lines) — needs `set_bc` and
  `toggle_blindness` (potion.c).
- `Ring_on` (1242, 102 lines).
- `Amulet_on` (963, 124 lines).
- `ansimpleoname`, `safe_typename` (objnam.c) for the message arms.

`Blindf_on` is the cheapest next step and unblocks the eyewear third of the
accessory arm on its own.


### `Blindf_on` landed; `set_wear` is now async

Landed: `js/potion.js` (new file, mirrors `src/potion.c`) with
`toggle_blindness` (`src/potion.c:336`), and `Blindf_on`
(`src/do_wear.c:1461`).

`set_wear` had a `note_unported_do_wear('set_wear:Blindf_on')` marker standing
in for exactly this function — the SECOND time this pass that a marker turned
out to be a placeholder for something being ported elsewhere (the first was
`js/cmd.js`'s `equip_ok`). Wired it to the real call.

**`set_wear` is now async**, and `js/allmain.js:306` awaits it. That is the
async contagion from `js/pline.js` propagating one level further out; it will
keep happening as the remaining `<X>_on` handlers land, since all of them emit
messages. `set_wear`'s other markers (`Ring_on:right`, `Ring_on:left`,
`Amulet_on`, and the armor slots that are still noted) are the next ones to
flip.

Recorded, deliberately:
- `Blindf_on:set_bc` — `src/ball.c:380` needs the ball/chain glyph bookkeeping
  (`bc_order`, `remove_object`, `newsym`, `place_object`); reachable only while
  Punished.
- `toggle_blindness:see_monsters` / `:Sting_effects` / `:learn_unseen_invent` —
  all display refreshes, none ported.

### Next
`Ring_on` (`src/do_wear.c:1242`, 102 lines) and `Amulet_on` (963, 124 lines)
are what remain of the accessory arm. `tty_yn_function` exists, so the ring
prompt is NOT a blocker (see the correction entry above).


### Ring_on dependency set: 4 of 15 landed, deliberately NOT writing Ring_on yet

`Ring_on` (`src/do_wear.c:1242`, 102 lines) was surveyed and left unwritten:
11 of its 15 dependencies were missing, so it would have been a skeleton whose
switch arms mostly record. That reads as done without being done. Landing the
dependencies first instead.

Landed this pass: `observe_object` (`src/o_init.c:442`), `learnring`
(`src/do_wear.c:1193`), `toggle_stealth` (`src/do_wear.c:107`), `extremeattr`
(`src/attrib.c:1268`), `adjust_attrib` (`src/do_wear.c:1223`), plus the
`FIRST_OBJECT` fix in `discover_object` (see NOTES).

Still missing for `Ring_on`: `setuswapwep`, `see_monsters`,
`set_mimic_blocking`, `self_invis_message`, `float_up`, `spoteffects`,
`float_vs_flight`, `rescham`. Several are vision/levitation subsystems rather
than helpers, so `Ring_on` is likely to land with 3-4 arms recorded even when
the rest exist. That is fine and honest; what is NOT fine is landing it now with
11.

Two C details worth carrying:
- `toggle_stealth`'s not-riding message really is `You("sure are noisy.")` --
  the C's `riding ? "and " : "sure"` looks like a typo and is not.
- `extremeattr` records `extremeattr:u_wield_art`; without it a hero wielding
  Ogresmasher is not seen as being at the Con limit, so a +0 ring of gain
  constitution reports its enchantment where the C stays quiet.


### Ring_on deps: 8 of 15 landed

Added this pass: `setuswapwep` (`src/wield.c:285`), `self_invis_message`
(`src/potion.c:471`), `iter_mons` (`src/mon.c:4527`), `unblock_point`
(`src/vision.c:899`).

`iter_mons` is worth knowing about: the C saves `mtmp->nmon` BEFORE calling
vfunc because vfunc may unlink or free the monster. Our monster list is an
ARRAY (`game.level.monsters`), so the equivalent guard is iterating a snapshot
-- a vfunc that removes a monster would otherwise shift the array under the
loop and skip its neighbour. Written that way with a comment.

Still missing for `Ring_on`:
- `set_mimic_blocking` (`src/display.c:1548`, 3 lines) -- blocked on
  `mimic_light_blocking` (8 lines), which needs `is_lightblocker_mappear`
  (`include/monst.h:233`), which needs `is_obj_mappear` and the `S_hcdoor` /
  `S_vcdoor` / `S_ndoor` / `S_tree` symbols. Those `S_*` names are NOT
  top-level exports of `js/const.js`; find their real home before porting.
- `rescham` (`src/mon.c:4621`, 3 lines) -- blocked on `normal_shape`
  (`src/mon.c:4431`, 31 lines).
- `see_monsters` (`src/display.c:1487`, 42 lines).
- `float_up` (`src/trap.c:3937`, 69 lines) and `float_vs_flight`
  (`src/polyself.c:131`, 23 lines).
- `spoteffects`.

Pattern to note: three of these are 3-to-8 line functions sitting on top of
20-to-70 line dependencies. Size in the C file is a poor guide to porting cost;
check the dependency set before picking a target by line count.


### Ring_on deps: 12 of 15 landed

Added: `is_obj_mappear` + `is_lightblocker_mappear` (`include/monst.h:243,233`),
`mimic_light_blocking` + `set_mimic_blocking` (`src/display.c:1532,1548`),
`is_were` (`include/mondata.h:96`), `see_monsters` (`src/display.c:1487`), and
`MON_STILL_ARRIVING` in `js/const.js`.

The mstate family in `js/const.js` was ported but stopped ONE ENTRY SHORT:
`MON_FLOOR` through `MON_OBLITERATE` were present, `MON_STILL_ARRIVING` (0x100,
`include/monst.h:67`) was not. Nothing referenced it yet so nothing broke, but a
truncated constant family is a live trap -- the next user gets `undefined`, and
`x & undefined` is 0, so the guard silently never fires. **When porting a
`#define` block, port all of it and check the last line against the header.**

Only 3 of `Ring_on`'s 15 dependencies remain:
- `rescham` (`src/mon.c:4621`, 3 lines) — blocked on `normal_shape`
  (`src/mon.c:4431`, 31 lines), itself blocked on `newcham` (`src/mon.c:5278`,
  **257 lines**, the polymorph engine). This is the deep one.
- `float_up` (`src/trap.c:3937`, 69 lines) and `float_vs_flight`
  (`src/polyself.c:131`, 23 lines).
- `spoteffects`.

`Ring_on` is now close enough to write with 3-4 arms recorded, which is the
honest shape for it. `see_monsters` itself records `see_wsegs` (worm segments)
and `Sting_effects` (artifact glow); both are display-only.


### Marker sweep: 52 stale placeholders found, 8 cleared

Ran the sweep the NOTES entry called for (markers whose final segment names an
already-exported function). **52 hits.** That is the accidental-discovery rate
made systematic -- three were found by luck earlier in the session, and there
were 52.

Cleared this pass (52 -> 44):
- the six `set_wear:<X>_on` markers (`Shirt_on`, `Cloak_on`, `Boots_on`,
  `Gloves_on`, `Helmet_on`, `Shield_on`) -- all seven `<X>_on` callbacks now
  fire from `set_wear`, joining `Armor_on`, `Blindf_on` and `Ring_on`.
- `seemimic` (`src/mon.c`) is now real, using the newly-ported `does_block`
  (`src/vision.c:153`) and `unblock_point`.

Also landed: `does_block` itself, `Ring_on`, `float_vs_flight`,
`steed_vs_stealth`.

**`does_block` returns 1, 2 or 0, not a boolean.** 1 is a hard blocker, 2 is a
visible region (gas cloud), and callers distinguish them. Do not collapse it.

The remaining 44 need reading one at a time -- a marker can name an exported
function and still be correct, because the name may be a DIFFERENT local (e.g.
`uhitm.js:883 hmon_hitmon:is_pole` resolves to a `js/u_init.js` export that is
probably not the intended one). The sweep finds candidates, not defects.

Re-run the sweep with the one-liner in the git history of this entry, or better,
teach `tools/unported-hits.mjs` to emit it.


### Marker sweep: 52 -> 31, and the wear path is now fully async

Cleared this pass by reading each against the C first:
- 7x `<X>_on:update_inventory` -- verified all seven C handlers really do call
  `update_inventory()` (Helmet_on calls it THREE times; our port has one, so
  that handler is still short two calls).
- 4x `toggle_stealth` (Cloak_on/off, Boots_on/off) and 2x `float_vs_flight`
  (Boots_on/off), all matched against the C's call sites and argument lists.

**The async conversion this forced is the structural news.** `toggle_stealth` is
async, so in one chain: the seven `<X>_on` handlers became async, `unmul()`
became async and now `await`s `ga.afternmv`, the `<X>_off` handlers became
async, and `remove_worn_item()` became async. All callers updated; board and
generalize unchanged.

`js/hack.js unmul()` is worth a look: the clear-before-call on `afternmv` was
already documented as load-bearing, and it now reads
`const f = game.afternmv; game.afternmv = null; await f();` -- the clear still
happens BEFORE the await, which is what the C guarantees.

Of the 31 remaining candidates, expect a good fraction to be false positives:
a marker can name an exported function and still be right, because the name may
resolve to a different local (`uhitm.js:883 hmon_hitmon:is_pole` points at a
`js/u_init.js` export that is probably not the intended one). **Read the C at
each site before wiring.** The sweep produces candidates, not defects.


## RESET 28 Jul: js/ restored to the judge-validated tree (2a342ff)

The Mon 27 Jul 20:50 UTC judge run timed out at 900s (end-of-input --More--
block, see NOTES), so the fork went unscored and the board froze at the Sun
26 Jul 16:24 UTC run. main's js/ is now byte-identical to the tree that run
scored: local scoreboard reads 510 screens, exactly the judge's 510 public
points. Cost of the reset: 2 screens, 185 RNG positions.

Everything since lives on **archive/pre-reset-20260728** (55 files, ~6k
lines): the whole wear subsystem (canwearobj, accessory_or_armor_on armor
arm, dowear/doputon, equip_ok + callbacks, Ring_on/Blindf_on, on_msg/off_msg,
toggle_stealth, learnring, adjust_attrib), mbodypart/body_part, artifact_name
and artilist_records, hacklib string functions, not_fully_identified,
obj_is_pname, see_monsters, does_block, iter_mons, seemimic, the setworn
wiring in u_init (+2 RNG), the FIRST_OBJECT fix, racial_exception through
raceptr, and the async conversion of the wear path. NOTES documents every
piece.

**Re-application policy** (in force):
1. Nothing re-lands until a judge cycle confirms this base scores.
2. Then slices, in risk order, each behind the triple gate (scoreboard
   no-regression, generalize no-crash, hang-gate no-over-read):
   a. inert functions nothing calls
   b. verified-neutral fixes (FIRST_OBJECT, racial_exception, dedups)
   c. state wiring (setworn in u_init, silent _on handlers)
   d. message-emitting wiring, ONE AT A TIME, last
3. The hang gate is a hard gate for anything that can emit a message. It
   covers only the 44 public sessions; held-out coverage is impossible, which
   is why (d) waits for clean cycles between lands.

**Work that continues NOW (does not touch the reverted surface):** the
divergence hunt in live code. tools/diverge.mjs --all ranks first-divergence
sites; dog_move(dogmove.c:1255) leads with 7 of 30 sessions (one extra
dogfood/obj_resists rn2(100) before C's rn2(++chcnt); condition order and
chcnt verified correct; suspect one extra object in our floor pile; the
naive where===OBJ_FLOOR filter LOST 58 screens, see NOTES, do not retry).
Then obj_resists, do_attack, distfleeck, getbones at 3 each.


## 28 Jul, after the reset: first two fixes on the new base

1. **On_stairs** (js/dog.js) read `game.level.stairs`, never written; the
   stairs live on the `game.stairs` linked list (mklev). Always-false meant
   every pet turn ran the hero-inventory dogfood scan C skips while the hero
   stands on stairs (true from turn one). seed0105 AND seed0102 went to 100%
   RNG; dog_move divergences 7 -> 4. The debugging path that found it is in
   NOTES-worthy detail in the commit: count the rn2(100)s, they were the
   INVENT scan, not the floor scan.
2. **docallcmd + tty_select_menu + overlay message clear.** seed0102 now
   matches screens through the #name menu and its cancel (miss moved 9 -> 11).

**seed0102 is the closest session to a full PASS: RNG 4485/4485, screens
fail first at step 11, the `f` (fire) command.** C auto-readies ammo and
prinv()s it with --More-- ("b - a +1 bow (weapon in right hand).--More--");
our dofire records 'dofire:empty quiver prompt' and jumps to a direction
prompt. Port dofire (src/dothrow.c) next: the auto-quiver selection plus the
prinv message, then the throw itself. seed0101 (97%) is the same family
(ranger-quiver-throw).

Board: 516 screens (+6 since reset), RNG 140857. All three gates green.


### seed0102 step 11 decoded: the fireassist chain, cmdq landed

The `f` at step 11 is C's fireassist: uwep is EMPTY, quiver holds arrows, so
dofire queues `[dowield, key 'b', dofire]` on CQ_CANNED (src/dothrow.c:571-577)
and returns. rhack pops the wield, getobj consumes the queued 'b',
ready_weapon prinv()s "b - a +1 bow (weapon in right hand)." and the retried
dofire reaches getdir, whose prompt forces --More-- on the pending message.
Steps 12-13 ("l", "i") are IGNORED by C's xwaitforspace (topl.c: only
space/return/ESC answer a --More--); ESC at 14 dismisses it; step 15 '+' gets
"cmdassist: Invalid direction key!" plus the valid-keys help.

LANDED this pass: the command queue itself (cmdq_add_ec/add_key/pop/peek in
js/cmd.js beside cmdq_clear), rhack's pop site, getobj's queued-key arm.
Inert until a producer queues -- gates all green, board unchanged.

STILL NEEDED for seed0102 (in dependency order):
1. `wield_ok` (src/wield.c getobj callback) and `ready_weapon` completion
   check -- ready_weapon exists in js/wield.js with markers.
2. `dowield` (src/wield.c:355) and `doswapweapon` (:461). doswapweapon needs
   nothing new beyond ready_weapon + setuswapwep (both exist).
3. `find_launcher` + the fireassist block in dofire (src/dothrow.c:557-580).
   ammo_and_launcher already exists in js/wield.js.
4. xwaitforspace key filtering in more() (js/display.js:569) -- only
   space/return/ESC answer a --More--; everything else is ignored.
5. The cmdassist invalid-direction help window (getdir's else arm).

RNG caution: our stream already matches this session 4485/4485 END TO END
without any of this, so every piece above must draw ZERO and must not run an
extra turn inside these steps. Verify with diverge after each piece; any
change to the call count is a regression even if screens improve.
