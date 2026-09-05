# Shared beatitude effects and figurine timers

The four C beatitude helpers now update carried luck, bag weight, figurine
timers, equipment state and artifact light. curse interrupts active spellbook
study through book_cursed and drops a cursed alternate weapon during dual
wielding. reset_remarm clears C's saved selection while preserving delay and
other context fields. Message-producing callers await these operations;
free-object construction still completes its flag and weight changes before
returning to the constructor.

carry_obj_effects starts cursed figurine timers on hero and monster pickup.
Removal, uncursing, blessing and manual activation cancel them where C does.
attach_fig_transform_timeout replaces any old deadline. fig_transform follows
the complete C callback, including retry, location, perception, creation and
disposal branches. The measured cases reach only part of that body.

The new artifact probes also exposed missing inventory brightness suffixes.
doname now includes intensity for wielded artifacts and worn luminous armor.
maybe_adjust_light uses C's pronoun after a dipping glow. The dipping name
budget follows C's expression, which evaluates to 50 characters. Its nearby
comment says 49; the old literal shortened a blind hero's Sunsword prompt
unnecessarily.

| Permanent recipe | Cases | Screens/cursors | RNG entries |
|---|---:|---:|---:|
| beatitude-shared | 12 | 1,105 | 36,887 |
| beatitude-light-equipment | 10 | 1,000 | 25,552 |
| figurine-timers | 3 | 397 | 56,228 |
| beatitude-lifecycle | 8 | 615 | 25,055 |

All 3,117 screens/cursors, 143,722 RNG entries and 3,224 animations match C.
Each scenario has C intent assertions. The first 12 already matched all
screens before the fix but were missing three figurine timer draws.
The long-wait scenarios set live wizard options, remove existing monsters,
and restore generation one turn before the recorded deadline. Earlier
startup-flag and dual-wield setups did not reach their intended behavior and
were rejected before promotion.

tools/beatitude-state-gate.mjs checks all 33 scenarios. It verifies exact bag
weights, luck, C-derived deadlines, timer ownership, cleanup, light radii and
alternate-weapon disposal. Separate source controls verify construction,
monster carrying, genocide versus extinction, blocked-floor retry, retained
armor-removal context and interrupted study. They earn no native C coverage.
The blind kitten remains hostile: C's chance==1 arm preserves makemon's
initial disposition, and the recorded peace_minded roll was zero.

A loader omitting bless's bag weight update still passes every shared-case
screen and RNG entry. The state gate fails because the filled bag remains at
35 rather than 25. This control changes neither the runtime files nor C
expected data. It and its logs are .cache/beatitude/retain-bag-weight.mjs,
negative-replay.log and negative-state.log.

All 44 public and 450 supplemental fixtures pass. Supplemental has 151,014
exact screens/cursors, 7,336,372 exact RNG and 6,522 exact animations. Public
remains at 11,405 screens/cursors, 792,838 RNG and 1,462/1,483 animations.
Fuzz is unchanged at 101/102 with the fixed-date artifact. All 48 hang checks,
80 reused role-smoke controls, 16 tool tests, source audit and six state gates
pass. The assertion ledger is 1,761/1,761. Logs are .cache/beatitude/.

All four native recordings in .cache/c-coverage/beatitude-20260905 are exact.
They add 98 outcomes and five entered records. The union reaches
53,743/108,268 direct outcomes and 4,310/5,491 entered records. bless reaches
12/14, unbless 8/8, curse 24/26, uncurse 11/12 and fig_transform 15/56.
These are direct C outcomes, excluding macro-internal decisions and Lua.
They do not establish complete gameplay or held-out parity.

Next are floor and monster-carried transformations, visibility and hiding,
retry timing, and mpickobj's remaining billing and light handling. Active
book interruption still needs an independent C action case. Warning-glow
inventory annotations and the other dodip environment paths remain open.
The full-port goal stays active after this checkpoint.
