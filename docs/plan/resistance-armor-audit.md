# Dangerous meals and loss of protective armor

Fifty-six new C cases match 20,794 screens and cursors, 147,424 RNG entries
and 28 animation frames. The native coverage union adds 104 direct outcomes
and one entered function record. The dangerous-meal extension now has a
visible regression test: disabling stone-resistance renewal causes 12 screen
and five cursor mismatches while preserving every RNG call.

## Source review and changes

The complete Gloves_off body in do_wear.c:646..705 now handles the takeoff
mask, other sources of fumbling, cancelled donning, dexterity bonuses,
slippery fingers, both weapon slots and the optional barehanded status flag.
It calls wielding_corpse after removing protection. The latter keeps C's
255-character bound on the composed death reason. Its name formatter strips
user object names. The constructed oversized-name check verifies stripping,
not native reachability of a 255-character corpse death reason.

The full dragon_armor_handling body at do_wear.c:798..887 now follows the C
switch order and handles every secondary property. Removing yellow scales
or mail calls wielding_corpse for both weapon slots. Armor_on, Armor_off
and Armor_gone pass the same voluntary/involuntary argument as C. Multiple
armor removal routes through Armor_off. Gold armor respects the restoring
flag when changing hallucination resistance. The newly grouped functions
follow source order; the rest of do_wear is not certified by this review.

Two copies of the material predicates had diverged. The trap copy omitted
DRAGON_HIDE from is_rottable and compared the fire-resistance property with
26 instead of FIRE_RES, which is one. Trap callers now use the existing
mkobj implementations and the objclass.h predicates. The complete native
is_flammable/is_rottable functions and macros were read. Yellow dragon armor
can rot away, and an invisibility cloak can burn. Existing callers supplying
the object table still work; shared runtime callers use game.objects.

The null-object returns of eat_ok, offer_ok and tin_ok now report declined
floor alternatives. getobj follows C's hands/alternative switch, tracks the
no-object choice and honors GETOBJ_EXCLUDE_NONINVENT when deciding whether
to prompt. This restores "anything else to eat" after declining floor food.
The full getobj and floorfood bodies were read; other incomplete getobj menu
and command-queue behavior is outside this change.

The wizard intrinsic command now reads and writes the real acid and stone
intrinsic timers. Its fallback map had made them act like equipment and
bypassed nh_timeout's meal guards. Other fallback properties still need a
separate review. newuhs now uses force_save_hs, rather than victual.eating,
and resets its saved hunger state with each game. This permits done_eating
to compare the starting and ending states after clearing the occupation.

The long dragon meal exposed two surrounding omissions. moveloop_core now
uses the existing dirty-status flush instead of an unconditional bot call.
C deliberately leaves the previous hunger display during a meal. Restoring
that behavior exposed three missing dirty flags: more_experienced for
shown XP, spelleffects_check after energy deductions, and docorner when a
menu overlaps status rows. The first full sweep matched every RNG call but
failed 29 fixtures on display. Those C flags restore the affected tests.
The complete source functions were read; this does not certify their other
branches. more_experienced still needs its long-overflow and percentage
highlight behavior. spelleffects_check still needs spell_backfire and its
capacity gate, among other source gaps.

A centipede generated during the long meal exposed m_move's omitted
can_hide_under_obj call. C checks the top object before spending the hiding
roll. Adding that check restores the native movement trace. The full m_move
body was read, but this entry condition is the scope of the correction.

## Recordings and controls

| Recipe | Cases | Evidence |
|---|---:|---|
| resistance-meals | 21 | Natural corpse resistance at nine delays; acid and stone meals on floor and in inventory; declined floor food; long dragon meal |
| protective-armor-loss | 10 | Voluntary removal, refusal, erosion, slippery gloves and polymorph loss while wielding a cockatrice |
| armor-secondary-effects | 25 | All ten dragon colors as scales and mail; power, dexterity and fumbling gloves; burning an invisibility cloak |

All three native re-recordings are exact. All 56 explicit assertions pass.
The ledger has 1,993/1,993 cases, with 99 covered and seven partial scenario
categories. A first gold-mail assertion incorrectly expected "brightly";
C says "brilliantly" for mail. The corrected assertion preserves both exact
messages, and recording bytes and gameplay inputs are unchanged.

The state gate replays all 56 cases. It observes 216 acid and nine stone
renewals while an actual dangerous meal is in progress. It also checks
secondary equipment properties, loss and retention of protection, corpse
release after a wizard reprieve, zero mortality for protected meals and
slippery-glove cleanup. Constructed controls exercise independent fumbling
sources, interrupted donning, takeoff masks, the barehanded dirty flag,
meal-state restoration and reset, and stripped death names. Constructed
states earn no native coverage credit.

An inherited loader disables stone renewal without editing runtime files.
The visible recipe rejects it on 12 screens and five cursors, with all
61,868 RNG calls still matching. The state gate also fails because no
stone renewal occurs. The exact 54edb7b2 baseline, loaded across all eleven
changed runtime modules, fails two of three fixtures: 952 screens, 41
cursors, 24,095 positional RNG entries and two animations. Most secondary
armor properties already worked and now have direct execution evidence.

Initial invalid setups remain only in .cache/resist-meals. Removing the only
armor item auto-selects it, so glove confirmation is T, "yes", Enter. A
single destruction scroll can erode without destroying; thoroughly eroded
armor makes that branch deterministic. Wizard menus restart selection
letters on each page: acid and stone are c/d on page two, reached with >.
The first meal-second probes never enabled resistance. Yellow dragon
corpses are too heavy to carry in this setup, so carried acid controls use
acid blobs. Ordinary recorder behavior and all frozen files are unchanged.

## Validation

All 527 fixtures pass in regression-second.log, with 226,706 screens and
cursors and 9,090,510 RNG entries matching. The 44 public fixtures retain
21 prior animation misses; all 483 supplemental fixtures match 215,301
screens/cursors, 8,297,672 RNG and 21,679 animations. Fuzz remains 101/102,
with its known fixed-date screen miss and all 491,759 RNG calls matching.
All 47 hang checks, 80 role controls, 16 tool tests, source audit (0/268),
the new state gate and twelve related state gates pass. totals.json holds
the exact counts. Runtime files were held fixed during the final sweep.

## Measurement limits and next work

The union is 54,775/108,268 direct C outcomes and 4,348/5,491 entered records.
armor_to_dragon is the newly entered record. Current union coverage is
Gloves_off 22/32, wielding_corpse 15/22, dragon_armor_handling 51/54,
Armor_off 7/10, Armor_gone 3/10 and eating_dangerous_corpse 9/14. Null input,
restoring and interrupted-donning arms still lack native evidence. The
remaining meal preconditions are not declared unreachable.

Reports live in .cache/c-coverage/resist-meals-20260905 and
.cache/resist-meals. Current-corpus success is not whole-game certification.
Next, finish the casting preconditions and forgotten-spell effects exposed
by this review, then continue the remaining timeout, inventory, monster and
Lua source paths. The full-port goal remains active.
