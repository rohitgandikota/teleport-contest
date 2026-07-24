# M4 — Level generation

**Goal:** generate dungeon level 1 (and then arbitrary levels) with the same RNG
consumption and the same resulting map as C.

**Why it matters:** level generation is the largest single block of RNG
consumption in the early game. If it diverges by one call, every monster, item,
and map feature afterwards is wrong, and no screen matches for the rest of the
session. It is also the point where the skeleton's `js/fastforward.js` fakery
currently hides the most.

**C files in scope:** `src/mklev.c`, `src/mkroom.c`, `src/mkmaze.c`,
`src/mkmap.c`, `src/mkobj.c`, `src/makemon.c`, `src/dungeon.c`, `src/rect.c`,
`src/dig.c` (corridor digging), `src/stairs.c`, `src/trap.c` (trap placement
only), `src/light.c`, `src/region.c`, `src/extralev.c` (rogue level).

> **M9a is a hard prerequisite of this milestone.** Measurement (see
> [coverage-map.md](coverage-map.md)) shows `src/sp_lev.c` running in 44 of 44
> public sessions, and every session making Lua-context PRNG calls. In NetHack
> 5.0 ordinary level generation goes through the Lua machinery, mostly via
> themed rooms. You cannot finish M4 without the Lua core. Do
> [09-lua-and-special-levels.md](09-lua-and-special-levels.md) §M9a first.

Named special levels (Oracle, Minetown, Sokoban, the Quests) stay in **M9b**.
This milestone covers ordinary procedurally generated levels — which still means
`sp_lev.c` and Lua, just not the named-level scripts.

**JS targets:** `js/mklev.js` (exists, 1,888 lines, needs auditing against the C),
`js/mkroom.js`, `js/mkmaze.js`, `js/mkmap.js`, `js/mkobj.js`, `js/makemon.js`,
`js/dungeon.js`, `js/rect.js` (exists), `js/stairs.js`, `js/light.js`,
`js/region.js`.

---

## Domain background

A standard Dungeons of Doom level is rooms joined by corridors, with up and down
staircases, doors, and a scattering of monsters, objects, and traps. The dungeon
is a branching tree: the main trunk runs roughly levels 1-27 (Dungeons of Doom)
and then Gehennom below the Castle. Side branches are the Gnomish Mines, Sokoban,
the role-specific Quest, and sometimes Fort Ludios. Branch staircases render in a
different colour once used.

Room types that are not plain rooms: shops, temples, throne rooms, zoos,
barracks, beehives, and — **new in 5.0** — themed rooms. 5.0 also gives every
level above the Oracle a 2/3 chance of a "supply chest". Both of these are 5.0
additions, so they will not be in any agent's pretrained memory of NetHack;
port them from the C, and do not assume 3.6 behaviour anywhere in this milestone.

## Items

### 4.1 Audit the existing `js/mklev.js`

1,888 lines already exist and their provenance is unknown. Before adding
anything, verify what is there against `src/mklev.c` function by function.

- [ ] List every function in `js/mklev.js` and its C counterpart
- [ ] Flag any function with no C counterpart (candidate for deletion)
- [ ] Flag any function whose structure has been "improved" away from the C
- [ ] Add provenance comments where missing

**Verify:** every remaining function maps to a named function in `src/mklev.c`.

### 4.2 Dungeon topology

- [ ] Port `src/dungeon.c`: dungeon description parsing, branch placement,
      level numbering, `dunlev`, `ledger_no`, `In_*` predicates
- [ ] Port `src/stairs.c` staircase placement

Level 1 needs only a small part of this, but the accessors are used everywhere
downstream, so port them properly now rather than stubbing.

### 4.3 Rooms and corridors

- [ ] Port `src/mklev.c` in C order: `makelevel`, `makerooms`, `create_room`,
      `makecorridors`, `dig_corridor`, `join`, `makeniches`, `make_niches`,
      `makevtele`, `mkstairs`, `finddpos`, `dosdoor`, `okdoor`, `dodoor`
- [ ] Port `src/rect.c` rectangle bookkeeping (a `js/rect.js` already exists —
      audit it the same way as 4.1)
- [ ] Port `src/mkroom.c`: `mkroom`, `courtmon`, `mkshop`, `mkzoo`, `mkswamp`,
      `mktemple`, `mkgarden`, the special-room selection logic, and the 5.0
      themed-room machinery

**Verify:** `tools/diverge.mjs` on the eight short sessions shows RNG matching
from the start of `makelevel` through its end.

### 4.4 Objects on the floor

- [ ] Port `src/mkobj.c`: `mkobj`, `mksobj`, `mkbox_cnts`, `rnd_class`,
      `mkobj_at`, `mkgold`, and the object-creation RNG order exactly
- [ ] Generate the object data tables from `src/objects.c` with the M2 table
      generator, not by hand

Object creation order inside a room matters and is easy to get subtly wrong.

### 4.5 Monsters on the level

- [ ] Port `src/makemon.c`: `makemon`, `rndmonst`, `m_initweap`, `m_initinv`,
      `m_initgrp`, `mkclass`, `peace_minded`, `set_malign`
- [ ] Generate the monster data tables from `src/monst.c` via the generator
- [ ] Pet creation (`makedog` in `src/dog.c`) — the starting pet is placed during
      level 1 creation, and `seed0004-feeding-pony` and
      `seed0103-knight-ride-pony` depend on it

### 4.6 Traps, lighting, regions

- [ ] `mktrap` and trap placement from `src/trap.c` (trap *effects* are M10)
- [ ] `src/light.c` light source placement and `src/region.c` region setup
- [ ] Lit vs unlit room determination, which feeds vision in M5

### 4.7 The rogue level

- [ ] Port `src/extralev.c` — the Rogue-tribute level has its own generator and
      its own display rules

Low priority unless a public session reaches it; check `coverage-map.md`.

---

## Done when

- RNG matches from process start through the end of level-1 generation for every
  public session
- The generated map (walls, floors, doors, corridors, stairs, room types) matches
  what the first recorded frame draws, verified with `tools/screendiff.mjs` once
  M3 and M5 can render it
- No `js/fastforward.js` entries remain for level generation

## Traps for the unwary

- Argument evaluation order inside expressions like `somex(rn2(a), rn2(b))`
  decides RNG order. Port expressions as written. See `00-strategy.md` §3.
- `rn2` vs `rnd` vs `rn1` are different draws. Never substitute one for another
  to make a number line up.
- Room-selection loops that retry on failure consume RNG on every failed attempt.
  The retry structure must be identical, not just the successful outcome.
