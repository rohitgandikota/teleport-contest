# Engulfing and its shared state transitions

Twenty new C cases match 4,579 screens and cursors, 55,683 RNG entries and
22 animation frames. Exact modules from the preceding checkpoint, 85153c8b,
fail all three fixtures: 3,555 screens, 4,482 cursors, 29,205 RNG entries and
nine animations match. The baseline loader runs inside the scoring worker
through NODE_OPTIONS. Neither the runtime nor the C oracle is edited.

## Source review

The full gulpmu body in mhitu.c:1289-1590 was read. Its missing setup now uses
the shared engulf_target and failed_grab predicates, removes punishment pieces,
dismounts the hero, stops occupations, releases traps and detaches leashes.
Initial contact with a petrifying hero restores the attacker to its original
square before petrification, then restores punishment and clears the grip.
The swallow message is flushed before clearing vision. While swallowed, free
punishment pieces follow the engulfer's coordinates.

Damage now uses shared resistance and physical-reduction properties, applies
golem effects, burns away slime, renews disease and preserves the C order of
digestion damage and reduction. A negative-AC roll can turn zero slow-digestion
damage into one point because C clamps a negative result to one. The release
tail handles a petrifying hero and huge forms. The full diseasemu body was
read; renewing existing sickness still exercises constitution through make_sick.
Its rn2(2) draw is not a new illness-duration draw.

The full failed_grab and engulf_target bodies were reviewed in mhitm.c.
The latter tests the defender monster's mtrapped field, even for the hero;
substituting u.utrap changes the C behavior. unstuck now returns punishment
pieces from limbo. cmd.reset_occupations imports do_wear.reset_remarm so it
clears the real context_takeoff state, rather than a duplicate unused record.

The mounted probes required the missing dismount_steed branches, including
shared injury reduction, temporary removal of the steed while evaluating hero
movement properties, terrain consequences and relocation of a displaced steed.
The entire C body was read. The three native probes exercise worm, fire-vortex
and ochre-jelly dismounts, not every newly ported terrain or placement branch.

The black-light case exposed makemon's missing nearby set_apparxy call and
set_apparxy's incomplete invisibility/displacement properties. Later automatic
search exposed missing warnreveal feedback. mfind0, dosearch0, warnreveal and
warning_of were read in full. Search now applies artifact and lens bonuses,
uses shared touch helpers and sets the C message coordinates. feel_location's
levitation, underwater, engraving and punishment branches were restored after
reading the whole C body. Remaining rendering differences are listed below.

Yellow-light rehumanization exposed del_light_source failing to request vision
recalculation. The full del_light_source/delete_ls bodies were read. Fog-cloud
feedback now comes from shared make_gas_cloud, with runtime callers awaiting
it. The full make_gas_cloud and m_poisongas_ok bodies were read; this does not
certify the surrounding region implementation.

## C cases and state checks

| Recipe | Cases | C-observed behavior |
|---|---:|---|
| engulf-resistance | 6 | Fire, cold, shock and acid resistance; human and breathless fog engulfing |
| engulf-form-transitions | 6 | Wraith and black-light failed grabs; warning reveal; yellow-light death and rehumanization; huge-form and cockatrice release |
| engulf-attachments | 8 | Punishment after death reprieve and slow digestion, including a carried ball; web and leash release; three mounted engulfers |

The recipes assert the actual C messages before receiving intent credit.
Initial ghost polymorphs were rejected by C. Other discarded probes lacked
their claimed resistance, never entered a trap, or never reached engulfing.
The yellow-light case dies to a bite before swallowing, so it earns light
removal evidence, not failed-grab evidence. The huge-form case is expelled
immediately by polymorph handling, so it does not cover gulpmu's size tail.

tools/engulfing-state-gate.mjs checks persistent state after all 20 replays.
Constructed source controls cover terrain and grip guards, initial stoning and
life saving, punishment placement, occupations, multiple leashes, resistance,
golem healing, slime burning, physical reduction, disease renewal, blindness,
gas immunity and mounted flight. These controls earn no native branch or
gameplay-reachability credit.

Omitting only gulpmu's three ugolemeffects calls still passes every new visible
replay. The state gate rejects the missing iron-golem healing, HP 10 instead
of 19. A separate state check first failed because swallowing left the actual
take-off mask set. Both findings show why replay output alone is insufficient.

## Measurement limits and continuation

All three native recordings are exact. They add 90 direct outcomes and no
entered records: union 54,140/108,268 and 4,315/5,491. gulpmu reaches 75/100,
engulf_target 20/32, failed_grab 17/28, unstuck 9/14, dismount_steed 45/84,
set_apparxy 43/52, mfind0 9/18, warnreveal 12/12, feel_location 49/86 and
m_poisongas_ok 17/20. C macros and other configurations are not exhausted by
this direct-branch measurement. The remaining gulpmu outcomes include initial
stoning, multiple leashes, disease, cancellation and several damage/release
guards; source controls are not substitutes for native recordings.

All 514 fixtures pass, 44 public and 470 supplemental. Supplemental matches
171,486 screens/cursors, 7,921,440 RNG entries and 21,355 animations. Public
remains 11,405 screens/cursors, 792,838 RNG entries and 1,462/1,483 animations.
Fuzz remains 101/102 with the known fixed-date screen miss. All 47 hang checks,
80 role controls, 16 tool tests, source audit (0/268), engulfing state and
related state gates pass. The assertion ledger is 1,867/1,867, with 99 covered
and seven partial categories. Logs, rejected probes, loaders and totals are
under .cache/engulfing. regression-occupation is the final full sweep.

Continue with region.c's incomplete monster cloud effects and the missing
hero m_postmove_effect hook in hack.js. feel_location still lacks C's complete
display-suppression guards and exact dark-room/sensed-monster rendering.
del_light_source still has incomplete diagnostic handling. Full mondead,
mon_break_armor and the surrounding modules remain unfinished. Passing this
corpus does not complete the full-port goal.
