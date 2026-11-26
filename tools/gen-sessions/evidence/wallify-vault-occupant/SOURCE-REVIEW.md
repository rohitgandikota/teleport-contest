# Wallify tame-occupant feedback, source-only review

Verified source gap: C `vault.c:669-673` calls `yelp(mon)` for a tame boundary
occupant before `rloc(mon, RLOC_MSG)`. Fixed f5ba `vault.js:264-269` relocates
that occupant without the call. No runtime candidate is present. The three
locked keyboard inputs establish JS reach and a C-derived expectation. Native
reach and full parity remain pending parent recording.

The baseline is the parent's fixed redraw composition, 280 files, map SHA256
`f5ba1cfce94028c1c24a790b54020eb82a058dbc2af5eb2328b0bf2478564ee5`.
It includes the restored-entry and doorway-engraving changes. The current
owner preserves the redraw prerequisite. Main and all earlier packets are
untouched.

## Owner and call order

The complete C owner is `vault.c:646-731`; the complete JS owner is
`vault.js:241-314`. Both scan the vault perimeter in x-then-y order. A square
is eligible when it is not a wall, or contains gold, rocks, or a boulder,
and is not part of the guard's fake corridor. C handles an occupant before
gold, debris, traps, wall state, engraving, redraw, and restoration feedback.
The guard itself is excluded. The tame test belongs inside that occupant
branch. Relocation failure then sends the monster to limbo.

The complete direct callers were reviewed: C `gd_move` at 888-1201 and
`gd_move_cleanup` at 836-867, JS `gd_move` at 526-805 and cleanup at 409-423.
The three C call sites are 855, 913 and 920, corresponding to JS 413, 543
and 551. The locked cases reach the normal peaceful escort call at 913/543,
when both hero and guard are outside the vault. They stop with the guard at
28,5, still escorting, before cleanup. The target 23,4 is outside the fake
corridor, which runs east through y=5.

Complete `rloc`, `m_into_limbo`, perimeter/accessor, redraw and terrain-wish
contracts reuse the sealed source38 review where exact bytes agree. Changed
wallify and gd_move owners were read fresh. `source-ranges.json` distinguishes
complete named owners from focused transitive excerpts and records provenance,
line ranges, full-file hashes and range hashes. This is not a claim that the
whole monster movement or naming subsystem is closed.

## Existing yelp helper and async ordering

C `sounds.c:427-476` and JS `sounds.js:1004-1042` both reject helpless or
silent monsters. C `monst.h:251` defines helpless as sleeping or unable to
move. JS's imported macro in `monst.js:34-42` has those same two terms.
Eating alone is not helpless.

Without hallucination, `MS_BARK` selects `yelp` for a hearing hero and
`recoil` for a deaf hero. The helper uses `Monnam` and `vtense(NULL, verb)`.
Complete C/JS naming and inflection owners were read; the unnamed, ordinary
dog uses that existing path. The primary assertion requires `yelps!`, without
inventing a C visibility-dependent monster-name prefix or native step number.

After its message, yelp stops running if needed and wakes nearby monsters
using the pet's original coordinates and species level times 12. Complete
`nomul`, `wake_nearto_core`, `wake_nearto`, `wake_msg` and
`disturb_buried_zombies` were reviewed. The distance comparison is strict.
`wake_msg` can itself display a message. JS awaits both the yelp's `pline`
and `wake_nearto`; its wake loop awaits `wake_msg` before clearing sleep.
C `pline`/`vpline` and current JS `pline` were also read. JS drains earlier
notices and can suspend at terminal feedback. A future call must therefore
await the existing yelp helper before relocation. Fire-and-forget would
violate both message ordering and the original wake origin.

The narrow proposed implementation, only after parent native confirmation,
is to import existing `yelp` into vault.js and await it under
`occupant.mtame` immediately before the existing relocation. No helper,
species, RNG, display or billing change is justified by this packet.

## Real keyboard production

The route derives from the maintained guard-cleanup keyboard pattern already
reviewed in source38. It uses seed 7303, normal commands plus wizard keyboard
terrain, wish, phase and create-monster commands. No map injection, runtime
exports, helper substitution or RNG mocks are used.

The complete `create_particular` parser/creation/wrapper, `tamedog`,
`initedog`, `dogfood`, `dog_nutrition`, `dog_eat`, `dog_invent`, `dog_goal`
and `dog_move` were read. Makemon's placement/initialization and m_move's
trap/meal/special-dispatch sequence are pinned excerpts. The ordinary state
checks require the actual producer results rather than assuming their shape.

First prepare a guard goal at 29,4. Open the north boundary at 23,4 via
throne then floor, and wish for a gray dragon corpse there. The heavy corpse
actually lands on the floor. Move to the adjacent stone square using the
already-produced temporary phasing, then create a tame little dog. Makemon
places it on the only accessible neighboring square, 23,4. The hero walks
around it. Dog invent finds the real corpse and calls dog_eat. Dog nutrition
sets a long eating duration from the corpse species weight; m_move decrements
it and returns before ordinary movement. The pet remains awake and mobile.

At the last pre-restoration JS boundary, step 257, the dog is tame 11, awake,
mobile, alive with HP 10 and still eating for 30 actions, at 23,4. The next
boundary shows the same pet alive at 62,8 and the target restored to HWALL.
JS prints the incantation and restoration but no yelp. This is the sole
failed C-derived predicate. These are JS observations, not native results.

The two matched negatives exercise different exclusions. The tame blue
jelly has zero speed and `MS_SILENT` in the C species declaration. It remains
on 23,4 and is relocated alive, but the existing yelp helper must be silent.
The empty-boundary case creates no monster, retains the real corpse, and
restores the same boundary. Each locks all five output hashes. Neither case
claims to isolate the outer untamed-audible guard, which remains uncovered.

## Preserved attempts and limits

Proposals 01 and 02 reached restoration, but their later escort-cleanup tail
printed `newsym: attempting screen update for <0,0>` and the program-disorder
message. Those reports and complete inputs are retained. No C comparison of
that tail exists, so this packet does not call it a confirmed new regression.
Proposal 03 tried a late peaceful-dog placement. Teleporting to stone produced
`Sorry...` and sent the hero elsewhere; restoration happened before creation.
That failed ordinary proposal is retained and is not counted as coverage.

Proposal 04 prepares a more distant guard goal before pet creation and ends
after restoration while the guard is still escorting. It supplies the locked
three inputs unchanged. This is a separate keyboard route chosen before any
candidate, not an output mask. The initial diagnostic runner also retained a
0/3 observer error: it read fakecorr before guard initialization completed.
Only that passive observation gained the empty-array fallback. Its exact
original tool, report and invocation remain under evidence/reports. No input
or assertion changed, and the corrected runner gives 3/3 reach, 2/3 C predicates.

Other wallify omissions remain open: `obfree` after extracting rock/boulder
debris, `deltrap` instead of filtering the trap array, and
`xy_set_wall_state` after clearing wall_info. The C deltrap/conjoined-pit
contracts and live dig producers were examined. Stale reciprocal pit bits
have no established ordinary visible witness here; disabled
`join_adjacent_pits` is not treated as a producer. JS also clears extra wall
fields compared with C. None of these changes is bundled into the yelp lead.

The ordinary cases do not cover helpless pets, deaf/hallucinating heroes,
other sound classes, running cancellation, actual sleeping neighbors,
buried-zombie timers, limbo fallback, or hostile-guard cleanup. Full pet-owner
reading also exposes existing unrelated differences, including guardian/minion
handling, dog_invent's prize exclusions, and off-map/region checks in dog_move.
The selected real meal uses none of those branches. There is no broad pet or
shared naming repair, and no whole-owner closure claim beyond the narrow
missing wallify call under review.
