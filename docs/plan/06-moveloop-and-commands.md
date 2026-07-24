# M6 — The move loop and core commands

**Goal:** a playable turn loop with the full command dispatch table, so that
arbitrary key sequences from any session drive the same code paths C drives.

**Why here:** M2-M5 get one frame right. This milestone is what lets a session run
for hundreds of steps. It is also the point where breadth starts paying: every
command ported is credit across many sessions.

**C files in scope:** `src/allmain.c`, `src/cmd.c`, `src/iactions.c`,
`src/hack.c`, `src/do.c`, `src/do_name.c`, `src/detect.c` (search),
`src/dokick.c`, `src/lock.c`, `src/engrave.c`, `src/track.c`, `src/sit.c`,
`src/exper.c`, `src/timeout.c`, `include/func_tab.h`.

**JS targets:** `js/allmain.js` (exists, 122 lines — nowhere near complete),
`js/cmd.js` (exists, 78 lines, knows ~5 commands), `js/iactions.js`,
`js/hack.js`, `js/do.js`, `js/do_name.js`, `js/detect.js`, `js/dokick.js`,
`js/lock.js`, `js/engrave.js`, `js/track.js`, `js/sit.js`, `js/exper.js`,
`js/timeout.js`.

---

## Items

### 6.1 The move loop

`src/allmain.c` `moveloop()` and `moveloop_core()`. Everything is timed off this:
movement points, monster turns, timers, regions, hunger, regeneration, and the
occupation callbacks that make multi-turn actions (searching, eating, digging)
work.

- [ ] `moveloop`, `moveloop_core`, `do_move_something`, `nh_timeout`
- [ ] Movement point accounting and speed, exactly as C computes it
- [ ] Occupation handling (`occupation` callback, interruption rules)
- [ ] Hunger and the 5.0 HP/Pw regeneration formulas
- [ ] `src/timeout.c` timer queue and `src/region.c` region ticking

`frozen/play.sh` drives `moveloop_core()` one key at a time and is the
playability check; keep that entry point intact and named as C names it.

### 6.2 Command dispatch

`src/cmd.c` plus `include/func_tab.h` is the command table: about 60 single-key
commands and about 100 extended commands. See `game-domain-primer.md` §3 for the
map.

- [ ] Port the command table itself, generated from `include/func_tab.h` and
      `src/cmd.c` by the M2 table generator where possible
- [ ] Prefix handling: counts (digits, or `n` with `number_pad`), `m`, `F`, `g`,
      `G`, `^`
- [ ] `#` extended-command entry with completion, and the `M-x` aliases
- [ ] `number_pad` remapping (`h` help, `j` jump, `k` kick, `l` loot, `N` name,
      `u` untrap)
- [ ] Custom key bindings from the rc file — `seed2600-wizard-custom-binds`
      exists for exactly this
- [ ] Unknown-key handling and its message, which is itself a screen

**Verify:** `seed0106-priest-extcmd-sweep` (267 steps) and
`seed0108-wizard-extcmd-wishlist` (303 steps) are the conformance tests here.

### 6.3 Movement

`src/hack.c` is the largest single behaviour surface in the early game.

- [ ] `domove`, `domove_core`, `test_move`, `may_dig`, `moverock`, `still_chewing`
- [ ] Running and rushing (`G`, `g`, shift-move), including the stop conditions
- [ ] Travel (`_`) and its pathfinding — `seed0101-ranger-quiver-throw-travel-engrave`
- [ ] `src/track.c` movement history
- [ ] Displacing pets, swapping places, and the messages each produces
- [ ] Trap triggering on entry (effects are M10, the trigger point is here)

### 6.4 Level change

`src/do.c` and `src/stairs.c`: `dodown`, `doup`, `goto_level`, level save and
restore on transit, arriving-on-a-level setup.

- [ ] Stair traversal both directions
- [ ] Level persistence across visits (uses the M11 machinery — coordinate)
- [ ] Branch transitions, including the yellow branch-staircase rendering

`seed0700-samurai-explore-descend` and `seed0015-valk-level2-pit-dog-wait` need
this.

### 6.5 The simple world commands

Each is small and each unlocks steps across many sessions.

- [ ] `s` search — `src/detect.c` `dosearch`, `dosearch0`
- [ ] `o` / `c` open and close — `src/lock.c`
- [ ] `^D` kick — `src/dokick.c` (note 5.0: iron shoes and kicking boots absorb
      trap punishment)
- [ ] `E` engrave — `src/engrave.c` (note 5.0: cursed wands may explode when used
      to engrave)
- [ ] `#force`, `#untrap`, `#sit`, `#jump`, `#chat`
- [ ] `C` / `#name` — `src/do_name.c`
- [ ] `.` wait, `^A` repeat, `^P` prevmsg, `^R` redraw, `V` version, `^X` attributes

### 6.6 Experience and levelling

- [ ] `src/exper.c` experience points, level gain and loss, and the messages

---

## Done when

- All eight short sessions pass end to end
- `seed0200-monk-north-search`, `seed1500-rogue-explore-move`,
  `seed1150-caveman-explore-move`, `seed0700-samurai-explore-descend` pass
- The extended-command sweep sessions run past step 100
- `bash frozen/play.sh` reports playable (under 1 ms per move)

## Splitting this milestone

M6 is large. Safe parallel split across agents, by file ownership:

- Agent A: `js/allmain.js`, `js/timeout.js`, `js/exper.js` (the loop)
- Agent B: `js/cmd.js`, `js/iactions.js` (dispatch)
- Agent C: `js/hack.js`, `js/track.js`, `js/do.js` (movement)
- Agent D: `js/detect.js`, `js/lock.js`, `js/dokick.js`, `js/engrave.js`,
  `js/sit.js`, `js/do_name.js` (the simple commands)

They share `js/gstate.js` and `js/const.js`; coordinate edits to those two.
