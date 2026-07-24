# M7 — Monsters, pets, and combat

**Goal:** monsters move, fight, die, and are drawn the way C's do.

**C files in scope:** `src/mon.c`, `src/monmove.c`, `src/mondata.c`,
`src/monst.c` (data), `src/mhitu.c`, `src/mhitm.c`, `src/uhitm.c`,
`src/weapon.c`, `src/wield.c`, `src/worn.c`, `src/dog.c`, `src/dogmove.c`,
`src/steed.c`, `src/mcastu.c`, `src/muse.c`, `src/mthrowu.c`, `src/minion.c`,
`src/were.c`, `src/worm.c`, `src/mplayer.c`, `src/priest.c`, `src/sounds.c`.

**JS targets:** the matching `js/*.js` files.

---

## Items

### 7.1 Monster data

- [ ] Generate `js/monst_data.js` from `src/monst.c` with the M2 generator
- [ ] Port `src/mondata.c` predicates (`resists_*`, `is_*`, `can_*`) — these are
      used everywhere and must be exact
- [ ] **5.0 additions:** displacer beast, genetic engineer (polymorphs its target
      on hit), gold dragon, baby gold dragon. Do not assume the 3.6 monster list.

### 7.2 Monster lifecycle and movement

- [ ] `src/mon.c`: `movemon`, `dochug` entry, `mondead`, `mondied`, `monkilled`,
      `xkilled`, corpse and death-drop generation
- [ ] **5.0:** monsters no longer drop food as death drops, except their own
      corpse
- [ ] `src/monmove.c`: `dochug`, `m_move`, `dog_move` dispatch, fleeing, and the
      covetous warp — **5.0** sends fleeing covetous monsters to either staircase,
      not always up
- [ ] **5.0:** monsters can use containers and unlock chests; they loot unlocked
      containers and animate corpse piles on levels the hero has left

### 7.3 Player attacks monster

- [ ] `src/uhitm.c`: `do_attack`, `attack`, `hmon`, `hmon_hitmon`, the to-hit and
      damage chains, and every message they emit
- [ ] `src/weapon.c`: `hitval`, `dmgval`, weapon skill, `weapon_hit_bonus`
- [ ] **5.0:** two-handed weapons get a 50% larger strength damage bonus
- [ ] Two-weapon combat — `seed0107-samurai-twoweapon-enhance`
- [ ] Skill advancement via `#enhance` (`src/weapon.c` `enhance_weapon_skill`)

### 7.4 Monster attacks player and each other

- [ ] `src/mhitu.c`: `mattacku` and every attack type
- [ ] `src/mhitm.c`: monster versus monster
- [ ] `src/mcastu.c`: monster spellcasting. **5.0:** touch of death deals heavy
      damage plus max-HP drain instead of instant death; magic resistance still
      blocks it
- [ ] `src/muse.c`: monsters using items
- [ ] `src/mthrowu.c`: monsters throwing and firing
- [ ] The knockback mechanic (5.0) and its hurtle steps — these emit animation
      frames, which are supplemental; get the final frame right first

### 7.5 Pets and steeds

- [ ] `src/dog.c`: `makedog`, taming, pet lifecycle, `losedogs`, `keepdogs`
- [ ] `src/dogmove.c`: pet movement and item fetching
- [ ] **5.0:** pets can gain resistances from eating corpses; dead pets can be
      revived by praying at a co-aligned altar while standing on the corpse
- [ ] `src/steed.c`: riding, `#ride`, mounting and dismounting, saddle handling
- [ ] **5.0:** the amulet of flying confers flight on the steed as well

Sessions: `seed0004-feeding-pony` (409 steps), `seed0103-knight-ride-pony` (60),
`seed0104-knight-ride-combat` (43), `seed0015-valk-level2-pit-dog-wait` (44).

### 7.6 Special monster classes

- [ ] `src/were.c` lycanthropy, `src/worm.c` long worms, `src/mplayer.c` player
      monsters, `src/minion.c` minions and demons, `src/priest.c` temple priests
      and aligned priests
- [ ] `src/sounds.c` ambient dungeon sounds — these are message-line output, so
      they are directly scored

Sessions: `seed0006-wizard-water-demon` (123), `seed0007-rogue-snake-swamp` (302),
`seed0009-swimmer-mforce` (73).

---

## Done when

- The pet, combat, and monster-movement sessions listed above pass end to end
- `seed0013-rogue-friday13-combat` passes, confirming the Friday-the-13th luck
  penalty from M2 feeds combat correctly
- No monster behaviour is implemented from remembered 3.6 semantics
