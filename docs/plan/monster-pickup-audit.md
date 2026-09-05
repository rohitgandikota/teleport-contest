# Monster pickup and engulfed light

The pickup pass adds 17 C scenarios and fixes paths absent from the preceding
504-fixture corpus. All four new fixtures match 2,098 screens and cursors,
41,364 RNG entries and zero animation frames. Replaying exact modules from
669b8416 through the same worker fails all four fixtures, matching only 1,949
screens, 2,089 cursors and 22,036 RNG entries.

## Source review and changes

The full `mpickobj` body in `steal.c:618-687` is translated. It guards null
and attached punishment objects, clears thrown or kicked references, removes
unpaid goods and nested contents from the correct bill, updates ownership and
knowledge, applies carrying effects, and uses shared `add_to_minv`. Snuffing
runs after insertion because the light must resolve an owned object. Runtime
callers await its feedback, while unlit construction remains synchronous.

The light review covers `new_light_core`, `snuff_light_source`,
`obj_sheds_light`, `obj_is_burning`, and the `ignitable` object macro.
New sources go at the head and dirty vision. Snuffing walks cached source
coordinates in that order, skips artifact lights and extinguishes only the
first eligible source. The JS representation resolves object IDs through the
shared owner chains. C stores pointers. Save and restore parity for every
light location is a separate obligation.

The tests exposed six additional gaps. Swallowed ordinary objects incorrectly
used `tmiss`, which printed a miss and consumed `rn2(3)`. The C branch instead
wakes the engulfer, handles a petrifying corpse, and describes the object
vanishing into its entrails or currents. Engulfing omitted initial inventory
snuffing and dust blindness. Explicit searching while swallowed omitted the
exit message. Applying a candle used the wrong refusal text. Petrifying a
digesting engulfer omitted the escape message. These branches now follow C.
The full `thitmonst`, `gulpmu` and `monstone` bodies were read; this pass does
not claim their remaining arms are complete.

## Independent C cases

| Recipe | Cases | Verified C intent |
|---|---:|---|
| monster-pickup-light | 5 | Lit oil, brass and magic lamps transfer and go out; an unlit lamp transfers; a candle refuses lighting and then transfers |
| monster-pickup-currents | 3 | Ice and steam vortices snuff transferred lamps; dust blinds the hero and suppresses the light-out message |
| engulf-carried-light | 6 | Worm, ice and steam entry snuff carried light; a fire vortex preserves it; ordinary and magic lamps and a candle are covered |
| swallowed-corpse-transfer | 3 | Cockatrice corpse petrifies an animal engulfer and is destroyed; a vortex keeps it; a worm keeps an ordinary corpse |

Recipe assertions bind the intended messages and final inventory to independently
recorded C frames. Fog-cloud attempts never engulfed. The air-elemental attempt
never reached the lamp pickup. Those attempts remain ignored and earn no intent
credit. The candle refusal is an unlit control, not evidence of extinguishing a
burning candle during transfer.

## Hidden-state checks and mutation control

`tools/monster-pickup-state-gate.mjs` replays all 17 scenarios, checking ownership,
projectile references, light removal, timer removal, retained fire-vortex light,
blindness and disposal of the petrifying corpse. Source-derived controls check
visible, unseen, held and tame knowledge rules; lost-item flags; stack merging;
null and attached punishment guards; direct and nested billing; six fuel types;
cached coordinate matching; newest-source order; and the artifact exception.
They earn no additional native C credit.

The ignored loader `retain-no-charge.mjs` removes only the acquisition step
which clears an object's old shop exemption. All four visible replays still
match every metric. The state gate fails at that ownership check, observing 1
instead of 0. The loader is inherited by the scoring worker through
`NODE_OPTIONS`; the runtime and C fixtures are unchanged. This demonstrates
why visible corpus success alone is insufficient for the full-port goal.

## Verification and remaining work

The stable run passes 44 public and 464 supplemental fixtures, 508 total.
Supplemental matches 164,617 screens/cursors, 7,836,900 RNG and 21,326 animations.
Public remains 11,405 screens/cursors, 792,838 RNG and 1,462/1,483 animations.
Fuzz remains 101/102 with the known fixed-date mismatch. All 48 hang checks,
80 role controls, 16 tool tests, source audit and five state gates pass.
The assertion ledger is 1,837/1,837. Logs and totals are under
`.cache/monster-pickup/`, with exact names in `STATUS.md`.

All four native re-recordings are exact. They add 56 direct outcomes and one
entered record, `snuff_light_source`, to the measured union: 54,001/108,268
outcomes and 4,315/5,491 function records. `mpickobj` reaches 23/32,
`snuff_light_source` 6/12, `thitmonst` 79/156, `gulpmu` 55/100 and `monstone`
19/28. These are compiled-C execution counts, not proof of whole-game parity.

Next, finish the remaining `gulpmu` setup, polymorph, resistance, damage and
release branches, and `monstone`'s vampire/lifesaving, worn inventory, floor
and light effects. `read.c` still has a snuff-light call absent from JS.
The full-port goal remains active after this checkpoint.
