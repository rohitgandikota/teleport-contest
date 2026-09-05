# Gas clouds, hero engulfing and fatal timers

Thirty-five new C cases match 11,548 screens and cursors, 130,031 RNG entries
and 118 animation frames. All 519 public and supplemental fixtures pass.
The expanded native corpus observes 391 additional direct branch outcomes
and enters 26 additional function records. These are measured additions to
coverage, not a claim that these modules or the whole game are complete.

## Source review and implementation

The region.c review covered region construction, rectangle and monster
membership, insertion and removal, movement updates, gas callbacks and cloud
creation. Regions use C's player_flags and callback indices. Removal swaps
the final region into the removed slot; expiration precedes aging and damage.
Fog extends a cloud before the zero-damage guard. Monster damage preserves
immunity, poison resistance, eye irritation, anger and ownership behavior.
The wet-towel reduction requires the towel to be worn. The shared silent and
gas-immunity predicates now use the correct sound constants and species IDs.

Hero movement checks in_out_region and calls m_postmove_effect at C's
position. Monster movement checks m_in_out_region, avoids dangerous gas and
updates worm segments. Relocation calls update_monster_region. The full
avoid_trap_andor_region, immune_to_trap and into_vs_onto bodies were read and
ported. This does not certify the rest of movement or trap handling.

Display work restores map_location, temporary glyph drawing and cleanup,
warning only at worm heads, and feel_location's final dark-floor overwrite.
A cloud can remain in state while a felt floor temporarily covers its glyph.
Vision defaults now match C. make_blinded reports unchanged blindness in
eyeless or permanently blind forms. The entire C feel_location and
make_blinded bodies were read, but some surrounding display arms remain
partial.

The full gulpum, start_engulf, end_engulf and explum bodies were read and
ported with their hmonas dispatch. They preserve swallowing guards, vampire
reversion, fatal contact, digestion, resistance, elemental effects and release.
Finish_digestion applies corpse effects and clears the saved species. Monster
blindness and energy cooldown fields now start at zero. Death restores a
shapeshifter's true species before statistics and keeps the old species for
light cleanup. Zombie corpse scheduling and no-revival flags follow the C
death path. Full mondead remains unfinished.

The fatal probes required stoned_dialogue, slime_dialogue, slimed_to_death,
done_timeout, Popeye and savelife. Intrinsic expiration now visits properties
in C's numeric order. The shared slime and Death attack handlers preserve
their hero and monster dispatch. Urgent messages use WIN_NOSTOP for the
current message only; leaving that flag set changed later ESC handling.
nh_timeout still has unported surrounding arms. This pass does not certify
all timed properties or all ways to die.

## Recordings and independent state checks

| Recipe | Cases | Observed behavior |
|---|---:|---|
| gas-cloud-hero | 9 | Poison damage and resistance, iron and fog forms, wet/dry/carried towels, leaving and teleporting |
| gas-cloud-monsters | 7 | Hostile and peaceful targets, resistant and silent targets, nonliving and immune forms, fog lifetime |
| gas-cloud-trails | 2 | Steam-vortex and hezrou trails, hazard confirmation and redraw |
| hero-engulf-digestion | 8 | Delayed digestion, regurgitation, petrification, Rider death, slime transformation, nurse/lich digestion and true-form death |
| hero-engulf-elements | 9 | Fire, cold, shock, blindness, wrapping, acid resistance, breathless targets and exploding at thin air |

The recipes assert C messages. Earlier scroll probes canceled targeting
before creating gas; a new scroll needs two More prompts before targeting.
Several early engulf probes hit wandering monsters rather than their intended
targets. A canceled ring-hand prompt did not equip slow digestion. Those
setups are excluded from claimed branch coverage. The permanent energy-vortex
case reaches shock, not xdrainenergym. The cockatrice case includes fatal bite
contact and a petrification countdown, not proof of every fatal gulp arm.
The nurse case proves digestion, not a completed healing effect.

gas-cloud-state-gate checks 18 replays plus source controls for membership,
ownership, damage reduction, immunity, blindness, fog extension, thinning,
swap removal and display state. hero-engulf-state-gate checks 17 replays plus
source controls for refusal guards, lifesaver consumption, corpse eligibility,
digestion completion, blindness saturation and recovery, energy cooldowns,
savelife cleanup, tin occupations and conflicting fatal timers. Constructed
controls earn no native coverage or gameplay reachability credit.

Changing only gulpum's blindness saturation from 127 to 126 still passes all
five new visible fixtures, including every RNG and animation entry. The state
gate rejects it at 126 versus 127. This is another concrete case where a
screen-perfect replay does not establish correct persistent state.

Two invalid constructed setups were corrected from C source: nonliving flesh
golems cannot use an ordinary lifesaver, and already blind monsters resist
light-induced blindness. A misspelled species constant was also rejected;
the monster helper now checks the species before calling makemon, which
otherwise treats an undefined species as a request for random creation.

## Regression diagnosis and validation

The first stable full sweep found one older fog-human regression. An exact
fresh recording ruled out oracle drift. Native #timeout snapshots showed a
new cloud lasting longer in JS. A separate diagnostic C build disproved the
initial hypothesis that the monster was absent from the map: C adds it to
the cloud, then removes membership when expulsion relocates it. The port's
rloc_to_core omitted update_monster_region. Restoring that call fixes the
regression. The diagnostic build preserves all screens, cursors, animations
and normalized RNG; source annotations alone shift with instrumentation.
The original recorder remains unchanged.

Exact 20832cc5 runtime modules fail all five new fixtures: only 4,774 screens,
10,932 cursors, 12,737 RNG entries and ten animations match. Both baseline
and mutation loaders are inherited by scoring workers through NODE_OPTIONS.

All 44 public and 475 supplemental fixtures pass. Public matches 11,405
screens/cursors, 792,838 RNG and 1,462/1,483 animations. Supplemental matches
183,034 screens/cursors, 8,051,471 RNG and all 21,473 animations. The 21 public
animation misses predate this pass. Fuzz remains 101/102, with its known
fixed-date screen mismatch: 14,261/14,262 screens and all 491,759 RNG entries.
All 49 hang checks, 80 role controls, 16 tool tests, both new state gates and
ten related state gates pass. The scope/import audit is 0/268. The assertion
ledger is 1,902/1,902, with 99 covered and seven partial scenario categories.

All five native recordings are exact. The union is 54,531/108,268 direct
outcomes and 4,341/5,491 entered function records. Selected measurements:

| C function | Observed direct outcomes |
|---|---:|
| inside_gas_cloud | 20/22 |
| run_regions | 25/30 |
| expire_gas_cloud | 15/16 |
| m_everyturn_effect | 12/12 |
| m_postmove_effect | 11/12 |
| gulpum | 55/82 |
| explum | 7/22 |
| stoned_dialogue | 18/28 |
| slime_dialogue | 18/30 |
| slimed_to_death | 3/10 |
| Popeye | 1/28 |
| xdrainenergym | 0/8 |
| worm_nomove | 0/4 |

This denominator excludes Lua, macro-internal conditions and inactive build
configurations. It includes startup, shutdown and unreachable/error paths.
Outcome coverage does not establish interactions or port correctness.

Logs, loaders, rejected exploratory inputs, native diagnostics and totals
are in .cache/gas-cloud. The final full sweep is regression-relocation;
function-order-score checks the subsequent declaration-only moves. The next
pass targets native energy drain, tin intervention during fatal countdowns,
slimicide and remaining timeout arms. The full-port goal continues.
