# Fatal timers, first bites and energy drain

Thirty-four new C cases match 11,473 screens and cursors, 98,777 RNG entries
and 178 animation frames. All 524 public and supplemental fixtures pass.
The native coverage union adds 140 direct outcomes and six entered function
records. This is evidence for the paths below, not whole-game certification.

## Source review and changes

The full cursetxt body in mcastu.c:63..85 supplies visible targeting feedback
and Norep for unseen curses. Repeated unseen curses were adding More prompts.
The source function now precedes spell-selection helpers. Existing status
conditions follow C's rank and option-name ordering, after hunger and load.
This fixes simultaneous Slime/Stone display but does not complete botl.

The full domove_fight_empty body in hack.c:2229..2350 supplies its forcefight
and stale-marker guards, off-map handling, statue/boulder selection, digging,
underwater feedback, remembered-object clearing, terrain naming and exploding
form cleanup. C's unmap_object clears remembered gold even while blind.
The first regression sweep caught a JS representation error: invisible
markers use kind `invis`, not `invisible`. Correcting both tests restores the
Knight replay. No C or frozen file was changed.

use_misc now calls the existing precheck before consuming a utility item.
The complete C use_misc and precheck bodies were read. The reached difference
was the occupant draw for a milky potion. This entry-call correction does not
certify all of either function, including successful occupants and backfires.

eat.c:790..878 supplies cprefx and fix_petrification. First bites perform the
cannibal check, fatal petrifying contact, stone-golem conversion, pet penalty,
lizard/acid cure, Rider death/revival and slime infection. start_eating calls
cprefx and checks whether the food or eating state survived before continuing.
Its saved nomovemsg handling now follows the complete C body at 2022..2075.
consume_tin calls the same precheck before cpostfx and honors early tin removal.
The entire consume_tin body was read; its other partial arms remain separate
work. The duplicated local cannibal guard was removed.

maybe_cannibal's static guard previously survived runSegment resets. A
domestic-meat case followed by a human-meat case at the same turn skipped the
second game's penalty. The guard now lives on game and resets with the native
process lifetime. The combined nine-case fixture catches this; isolated
replays alone did not.

The ACID_RES and STONE_RES expiration arms in timeout.c:813..843 now extend
protection while an accessible dangerous corpse is being eaten. The complete
eating_dangerous_corpse body at eat.c:475..494 checks the actual occupation,
food type, species, location and hazard. Resistance expiry also calls the
ported wielding_corpse control flow from do_wear.c:608..640. It preserves
glove and alternate-slot guards, petrification feedback and weapon removal
after survival. Other callers, bounded death-reason formatting and the wider
do_wear and nh_timeout functions are not certified by this pass.

## Independent recordings and state

| Recipe | Cases | Observed behavior |
|---|---:|---|
| energy-drain | 6 | Four cases drain monster energy; unseen curses, blind remembered gold and utility potion prechecks |
| fatal-countdowns | 6 | Stone/slime warnings, simultaneous conditions, deafness and an amulet reprieve |
| fatal-tin-interventions | 10 | Helpful/unknown tins continue, unhelpful tins stop, lizard/acid cures and a chameleon attempt |
| slimicide | 3 | Wizard and amulet reprieves followed by a second death; luminous-form transformation |
| first-bite-effects | 9 | Ordinary corpse cures, pet/cannibal penalties, petrification, golem conversion, slime glob, Rider meat and held corpse expiry |

The ledger has 35 explicit assertions for these 34 cases, including the
remembered-gold cell and native xdrainenergym/precheck annotations. All five
final native re-recordings are exact. The two energy group cases that never
drain a monster receive curse-feedback evidence only.

Tin inputs required inventory b after consuming the genocide scroll and
Ctrl-I, b, Enter to identify. Two initial recipes never opened their tins.
The final rescue uses a dagger and reaches stiffening while still opening.
Lizard and acid meat cure the countdown. Chameleon meat becomes a marilith in
this recording, then sliming completes; it is an attempted cure, not a cure.
A wished green-slime tin is invalid, so the source probe uses a slime glob.

The initial first-bite batch accidentally accepted death and saved bones.
Later cases then loaded that level, changing their initial RNG count. Those
setups earn no branch credit. Corrected inputs decline death; all nine final
cases begin as fresh games. The recorder intentionally preserves bones
between segments and was not changed.

fatal-timers-state-gate checks all 34 replays, including actual cures without
death reprieves, conduct penalties, both slimicide deaths, restored genocide
flags, amulet consumption and releasing a held corpse when protection ends.
Constructed controls check delayed-killer removal, protection during carried
and floor meals, interruption/inaccessibility, and stale invisible markers.
These controls do not earn native coverage.

Changing the dangerous-meal extension from one turn to zero still passes
all five new visible fixtures, including RNG and animation frames. The state
gate rejects it at `HStone_resistance: carried`, zero versus one. Native
coverage for eating_dangerous_corpse remains only 1/14; constructed evidence
is deliberately kept separate.

## Validation and limits

The final runtime passed the existing 519 fixtures in regression-second.log
and all five additions in permanent-score.log. Public matches 11,405 screens
and cursors and 792,838 RNG entries; its prior 21 animation misses remain.
All 480 supplemental fixtures match 194,507 screens and cursors, 8,150,248
RNG entries and 21,651 animation frames. The separate fuzz corpus remains
101/102 with its known fixed-date screen miss and all 491,759 RNG entries.
All 49 hang checks, 80 role controls, 16 tool tests and the source audit pass.
The new state gate and eight related state gates pass.

The exact 08b8d021 baseline modules fail four of five new fixtures, differing
on 1,934 screens, 72 cursors, 32,868 positional RNG entries and 61 animations.
Slimicide already matches that baseline and adds execution evidence for the
previous port. The baseline and mutation loaders are inherited by scoring
workers through NODE_OPTIONS; no production file changes for these controls.

The native union is 54,671/108,268 direct outcomes and 4,347/5,491 entered
function records. New entries include eating_dangerous_corpse,
fix_petrification, temp_givit, m_cure_self, xdrainenergym and badman. Current
union coverage is cprefx 24/40, Popeye 15/28, xdrainenergym 3/8,
slimed_to_death 8/10, wielding_corpse 8/22 and domove_fight_empty 32/62.
Reports are in .cache/c-coverage/fatal-timers-20260905 and
.cache/fatal-timers/{totals.json,remaining.json,union.log}.

Next, make native recordings for protection expiring during dangerous meals,
the remaining glove/armor removal callers, and unused first-bite branches.
The shared nh_timeout, use_misc, display and death modules still contain
unreviewed paths. Lua, unreachable/error branches and other build modes are
outside this compiled C coverage denominator. The full-port goal continues.
