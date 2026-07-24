# Port plan — index and status board

Start here. Read this file, then read the one milestone file you are working on.
Do not read the others.

Ground rules are in `/CLAUDE.md`. Read that first if you have not.

---

## Status board

Update this table at the end of every working session, before compacting or
handing off. `Local` is the public-session screen score from `bash frozen/score.sh`.

| # | Milestone | File | Status | Local screens |
|---|---|---|---|---|
| M0 | Strategy and architecture decisions | [00-strategy.md](00-strategy.md) | done | — |
| M1 | Verification loop and dev tooling | [01-verification-loop.md](01-verification-loop.md) | **done** | 0/11,405 |
| M2 | Options, rc parsing, chargen | [02-options-and-chargen.md](02-options-and-chargen.md) | next | — |
| M9a | Lua core (blocks M4) | [09-lua-and-special-levels.md](09-lua-and-special-levels.md) | not started | — |
| M3 | tty windowport (the screen) | [03-tty-windowport.md](03-tty-windowport.md) | not started | — |
| M4 | Level generation | [04-level-generation.md](04-level-generation.md) | not started | — |
| M5 | Display, vision, status lines | [05-display-and-status.md](05-display-and-status.md) | not started | — |
| M6 | Move loop and core commands | [06-moveloop-and-commands.md](06-moveloop-and-commands.md) | not started | — |
| M7 | Monsters, pets, combat | [07-monsters-and-combat.md](07-monsters-and-combat.md) | not started | — |
| M8 | Objects, inventory, menus | [08-objects-and-inventory.md](08-objects-and-inventory.md) | not started | — |
| M9b | Special levels and quests | [09-lua-and-special-levels.md](09-lua-and-special-levels.md) | not started | — |
| M10 | Subsystem sweeps | [10-subsystem-sweeps.md](10-subsystem-sweeps.md) | not started | — |
| M11 | Save, restore, multi-segment, bones | [11-save-restore.md](11-save-restore.md) | not started | — |
| M12 | Generalization hardening | [12-generalization-hardening.md](12-generalization-hardening.md) | not started | — |

**Measured baseline, 2026-07-24, untouched skeleton:**

| | |
|---|---|
| Sessions passed | 0 / 44 |
| Screens matched | **0 / 11,405** |
| RNG positions matched | 25,429 / 792,838 (3.2%) |

Zero screens. The partial credit the README mentions on
`seed8000-tourist-starter` is RNG-only and fake — it comes from
`js/fastforward.js` replaying a recorded list — and it produces no matching
frame at all. Frame 0 renders completely blank.

Reproduce with `node tools/scoreboard.mjs`; history in
[score-history.tsv](score-history.tsv).

**Current milestone:** M2, then M9a.

---

## Reference documents

| File | What it is |
|---|---|
| [00-strategy.md](00-strategy.md) | How scoring actually works, what wins, why the architecture is what it is. Read once. |
| [game-domain-primer.md](game-domain-primer.md) | What NetHack is, the command set, the subsystem-to-C-file map, and **what changed in 5.0 versus 3.6**. Read once, before your first milestone. |
| [porting-protocol.md](porting-protocol.md) | The repeatable per-function recipe. Read before your first port, then keep it open. |
| [coverage-map.md](coverage-map.md) | Which public session exercises which subsystem. Produced by M1. |

Contest docs (upstream, do not edit): `docs/API.md`, `docs/PHASES.md`,
`nethack-c/README.md`, `/README.md`.

---

## Dependency order

Milestones are ordered because each unblocks the next, not by preference.

```
M1 verification loop                      done
     │
M2 options + chargen ──────────────┐   (every session starts here)
     │                             │
M9a Lua core ──────────────────────┤   (blocks M4 — see below)
     │                             │
M3 tty windowport ─────────────────┤   (every screen goes through here)
     │                             │
M4 level generation                │
     │                             │
M5 display + vision + status ──────┘   → first full session pass, fastforward.js deleted
     │
M6 move loop + commands
     │
     ├── M7 monsters and combat
     ├── M8 objects and inventory
     ├── M9b special levels and quests
     └── M10 subsystem sweeps
     │
M11 save / restore / multi-segment
     │
M12 generalization hardening   (runs continuously from M6 onward)
```

M2 through M5, plus M9a, are one indivisible block in practice: nothing scores
until all of them are real, because screen 0 of every session requires chargen, a
generated level, a vision calculation, and a windowport to draw it. Expect the
score to sit at zero through that block and then jump.

**Why M9a sits in that block.** It was originally scheduled after M6, on the
assumption that Lua only builds *special* levels. Measurement says otherwise:
`src/sp_lev.c` executes in 44 of 44 public sessions, and every session makes
Lua-context PRNG calls (minimum 210, tagged `@ nh.rn2()`). In NetHack 5.0
ordinary level generation runs through the Lua machinery, largely via themed
rooms. See [coverage-map.md](coverage-map.md) for the numbers.

---

## How to pick up work cold

1. Read `/CLAUDE.md`.
2. Read this file. Find the current milestone.
3. If this is your first milestone, read `game-domain-primer.md` — in particular
   its 5.0-versus-3.6 section, because your pretrained knowledge of NetHack is
   3.6 knowledge and a lot of it is now wrong.
4. Read that one milestone file. Find the first unchecked item.
5. Read `porting-protocol.md`.
6. Work the item. Verify. Tick it. Commit. Update the status board.

Do not read ahead into later milestones. Do not survey the C tree "to get
oriented" — the milestone file already names the exact C functions in scope.
