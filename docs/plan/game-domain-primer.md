# Game domain primer

What NetHack *is*, in enough detail to port it. Read this once, before your first
milestone. It exists so that agents stop treating the C as an undifferentiated
mass of functions and start recognising which subsystem they are standing in.

**Sources:** the Traveler's Companion spoiler guide and the Guidebook at
[mazesofmenace.ai](https://mazesofmenace.ai/spoilers/), both written for 5.0.

**Status of everything below: advisory.** The C source is the only ground truth.
Where this document and `nethack-c/upstream/` disagree, the C wins and this file
gets corrected. Never port from this primer; port from the C, and use the primer
to know *where to look* and *what to expect*.

---

## 1. Read this part twice: 5.0 is not 3.6

NetHack 5.0.0 shipped 2026-05-02. It is the first major version bump since 3.0 in
1989. Every model's pretrained knowledge of NetHack is 3.4/3.6 knowledge, and a
large amount of it is now **wrong**.

This is the single largest source of silent, plausible-looking porting bugs in
this project. An agent that "knows" how unicorn horns work will write correct-
looking 3.6 code that diverges from C on the first draw.

Documented 5.0 changes from 3.6.x (advisory list, verify each against the C
before relying on it):

**Level generation and dungeon**
- Themed rooms are a regular part of dungeon generation (new room category).
- Supply chests: levels above the Oracle have roughly a 2-in-3 chance of one,
  placed in a random ordinary room, holding early-game items.
- Special levels can generate mirrored/flipped, so fixed map assumptions break.
- Medusa's Island has four possible layouts.
- Minetown has a 1-in-7 chance of generating as Orcish Town (no shops, no priest).
- Gehennom levels are more varied; Gehennom has hot ground that shatters dropped
  potions; teleport is blocked only while a demon lord is present.
- The Castle no longer generates master or arch-liches at level creation.

**Monsters**
- Four new species: displacer beast, genetic engineer, gold dragon, baby gold
  dragon. The genetic engineer polymorphs its target on hit.
- Mind flayers no longer cause amnesia (no map/identification wipe). They still
  drain Intelligence and can make you forget spells and weapon skills.
- Monsters can use containers and unlock chests; they loot unlocked containers
  and animate corpse piles on levels you have left.
- Covetous monsters fleeing to heal warp to either staircase, not always up.
- Monsters no longer drop food as death drops, except their own corpse.
- Pets can gain resistances from eating corpses; dead pets can be revived by
  praying at a co-aligned altar while standing on the corpse.
- Shopkeepers can remove pits and webs near themselves; walking into a peaceful
  shopkeeper auto-pays debts before the inventory prompt.

**Items**
- New armor: helm of caution (grants warning). Helm of brilliance always appears
  as a crystal helmet rather than a randomised appearance.
- New amulets: amulet of flying (flight, and it extends to your steed), amulet of
  guarding (+2 AC, +2 MC).
- Dragon scale mail grants two extrinsic resistances. Black DSM adds drain
  resistance; green DSM adds sickness immunity; gold DSM is a light source with a
  2-square radius.
- Unicorn horns no longer restore lost attributes.
- Bags of holding scatter contents on explosion rather than destroying them.
- Loadstones resist the new knockback mechanic.
- Glass items crack in stages rather than shattering instantly, and can be made
  crackproof.
- Candle light radius uses a square-root formula.
- Spellbooks can be applied to check wear.
- Cursed wands may explode when used to engrave.
- Wand of speed monster no longer grants permanent speed when self-zapped.
- Blessed potions of polymorph grant controlled polymorph.
- Alchemy nerf: diluted stacks alchemize 2 potions, not the whole stack; an
  alchemy smock reduces the blast chance to 1-in-30.
- Corpses, tins, and eggs from intrinsic-granting monsters have higher shop
  prices, making price identification possible.
- Sink dipping identifies a potion by message without consuming a scroll.

**Spells and combat**
- Chain lightning: new level 2 attack spell, spreads from the caster in all
  directions and chains between monsters.
- Spell level changes: charm monster 3 → 5, sleep 1 → 3, confuse monster 2 → 1.
- Advancing a spell school's skill auto-identifies spellbooks of that school by
  appearance.
- Touch of death reworked: heavy damage plus max-HP drain instead of instant
  kill. Magic resistance still blocks it.
- Two-handed weapons get a 50% larger strength damage bonus.
- HP regeneration formula is now (experience level + Constitution)% per turn; the
  regeneration intrinsic heals 1 HP unconditionally on top.
- A knockback mechanic exists (hurtle steps; see the animation-frame note below).
- Iron shoes and kicking boots absorb trap punishment.

**Roles, artifacts, gods**
- Valkyries start with a spear, not a long sword.
- Excalibur fountain dipping is 1-in-30 for non-Knights (1-in-6 for Knights).
- Demonbane is a silver mace and is the guaranteed first sacrifice gift for
  Priests.
- Sacrifice for artifact generation requires a minimum sacrifice value; sacrificing
  weak corpses no longer grinds Luck.
- Priest donation amounts are randomised: baseline rolls between 150 and 250 (×XL),
  500 × XL always guarantees protection, and under-donating sets a persistent
  "cheapskate" flag inflating future baselines.
- Broadened artifact effects: Snickersnee grants a free reach attack per turn,
  Sunsword gains an `#invoke` blinding ray usable on any monster, Trollsbane
  regenerates while wielded.
- New wish sources: Vlad's throne is guaranteed, the Amulet of Yendor grants a
  wish on pickup, and Orcus Town guarantees a magic lamp or magic marker.
- New conducts tracked: pauper, petless, permadeaf, and Sokoban.

**Where this bites us most:** M2 (Valkyrie starting inventory), M4 (themed rooms,
supply chests), M7 (new monsters, monster container use), M8 (new items, price
identification), M9 (flipped special levels), M10 (priest donation, sacrifice,
fountain dipping, sink dipping, HP regen).

---

## 2. The shape of the game

**Structure.** The dungeon is a branching tree. The main trunk descends through
the Dungeons of Doom (roughly levels 1-27), ending at the Castle, then continues
into Gehennom, at the bottom of which is the Amulet of Yendor in Moloch's
Sanctum. Retrieving it and climbing back through the Elemental Planes to the
Astral Plane is victory. Side branches: the Gnomish Mines, Sokoban, a
role-specific Quest, and sometimes Fort Ludios.

**Levels** are procedurally generated: rooms joined by corridors, with up and down
staircases, doors, traps, objects, and monsters. Special rooms are shops,
temples, throne rooms, zoos, barracks, beehives, gardens, and themed rooms.
Special *levels* (Oracle, Big Room, Minetown, Sokoban levels, quest levels,
Medusa, Castle) are defined by Lua scripts in `dat/` and built by `src/sp_lev.c`.

**The turn loop.** The player enters a command; the command consumes some number
of movement points; monsters then act; timers, regions, and status effects tick.
`src/allmain.c` `moveloop()` is the spine, `src/hack.c` is player movement,
`src/monmove.c` is monster movement.

**The screen** is 24 rows by 80 columns: one message line at the top, the map in
the middle (21 rows), and two status lines at the bottom. `--More--` appears when
messages overflow. Everything we are scored on is this grid.

**Map symbols.** Terrain: `.` floor, `#` corridor, `-` and `|` walls, `+` closed
door or spellbook, `<` `>` stairs, `{` fountain, `_` altar, `\` throne, `}` water,
`^` trap. Monsters are letters, with colour distinguishing species within a class.
Items are punctuation: `)` weapon, `[` armor, `%` food, `!` potion, `?` scroll,
`/` wand, `=` ring, `"` amulet, `(` tool, `*` gem, `$` gold, `` ` `` boulder.
Branch staircases render yellow once used.

Do not hardcode any of this: it all comes from `src/drawing.c`, `src/symbols.c`,
and the symset the session's `nethackrc` selects. This list is for recognising
what you are looking at in a diff, nothing more.

---

## 3. Commands — the M6 work list

The command set is the surface area the sessions drive. Ground truth is
`src/cmd.c` and `include/func_tab.h`; this table is a map, not a spec.

**Movement and travel:** `yuhjklbn` step, `YUHJKLBN` run until obstacle,
`m<dir>` move without pickup or fight, `F<dir>` force fight, `g<dir>` move until
something interesting, `G<dir>` / `^<dir>` rush, `_` travel, `.` wait.

**Objects:** `,` pickup, `d` drop, `D` drop by type, `i` inventory, `I` inventory
subset, `w` wield, `W` wear, `T` take off, `P` put on, `R` remove, `A` remove
multiple, `x` exchange weapons, `X` toggle two-weapon, `q` quaff, `r` read,
`e` eat, `t` throw, `f` fire quiver, `Q` select quiver, `z` zap wand, `Z` cast,
`a` apply, `p` pay, `$` gold, `+` spells, `\` discoveries.

**World interaction:** `o` open, `c` close, `s` search, `^D` kick, `<` up,
`>` down, `E` engrave, `:` look here, `;` identify a visible symbol,
`/` whatis, `^` identify adjacent trap, `C` call/name.

**Meta:** `?` help, `O` options, `^A` repeat, `^P` previous message, `^R` redraw,
`^X` attributes, `^O` dungeon overview, `S` save, `v` events, `V` version.

**Extended commands** are `#`-prefixed with completion, and there are about a
hundred. The ones the public sessions exercise by name: `#chat`, `#enhance`,
`#pray`, `#offer`, `#ride`, `#sit`, `#loot`, `#force`, `#dip`, `#untrap`,
`#jump`, `#invoke`, `#adjust`, `#name`, `#terrain`, `#overview`, `#conduct`,
`#twoweapon`, `#wipe`, `#turn`, `#monster`, `#tip`, `#quit`, `#wizwish` (wizard
mode). `M-x` bindings alias many of them. `seed0106-priest-extcmd-sweep` and
`seed0108-wizard-extcmd-wishlist` sweep this surface deliberately — treat them as
the extended-command conformance tests.

A `number_pad` option remaps several letters (`h` help, `j` jump, `k` kick,
`l` loot, `N` name, `u` untrap). Sessions that set it will exercise the remap.

---

## 4. Subsystem → C file → session map

Use this to decide which sessions to test a change against.

| Subsystem | Primary C files | Public sessions that exercise it |
|---|---|---|
| Chargen, roles | `role.c` `u_init.c` `attrib.c` | `seed0077-rogue-chargen`, `seed0102-ranger-name-cancel`, all |
| Options / rc | `options.c` `cfgfiles.c` | `seed2600-wizard-custom-binds`, all |
| Level generation | `mklev.c` `mkroom.c` `mkobj.c` `makemon.c` | all |
| Vision, display | `vision.c` `display.c` `botl.c` | all |
| tty windowport | `win/tty/*.c` `pline.c` | all |
| Movement, search | `hack.c` `detect.c` | `seed0200-monk-north-search`, `seed1500-rogue-explore-move`, `seed1150-caveman-explore-move` |
| Travel, engrave, quiver | `hack.c` `engrave.c` `dothrow.c` | `seed0101-ranger-quiver-throw-travel-engrave` |
| Kick, force, lock | `dokick.c` `lock.c` | `seed0060-orc-rogue-kick-search` |
| Combat | `uhitm.c` `mhitu.c` `mhitm.c` `weapon.c` | `seed0013-rogue-friday13-combat`, `seed0104-knight-ride-combat` |
| Pets, steeds | `dog.c` `dogmove.c` `steed.c` | `seed0004-feeding-pony`, `seed0103-knight-ride-pony`, `seed0015-valk-level2-pit-dog-wait` |
| Eat, food | `eat.c` | `seed1800-tourist-eat-throw`, `seed0016-healer-newmoon-eat-zap`, `seed0105-valk-chat-lamp-ration` |
| Potions, quaff | `potion.c` | `seed2200-wizard-quaff-zap-read` |
| Scrolls, read | `read.c` | `seed2200-wizard-quaff-zap-read`, `seed0501-priest-cast-read-turn` |
| Wands, zap, poly | `zap.c` `polyself.c` | `seed0398-wizard-wandpoly-pile`, `seed0016-healer-newmoon-eat-zap` |
| Spells | `spell.c` | `seed0501-priest-cast-read-turn` |
| Prayer, altars, sacrifice | `pray.c` `priest.c` | `seed0017-samurai-altar-pray` |
| Shops | `shk.c` `shknam.c` | `seed0116-wizard-wear-shop` |
| Vaults, guards | `vault.c` | `seed0012-monk-vault-escort` |
| Fountains | `fountain.c` | `seed0014-dequa-fountain-explore` |
| Hallucination (display RNG) | `display.c` `rnd.c` | `seed0383-wizard-hallucinate`, `seed0399-wizard-hallu-actions` |
| Quests (Lua) | `quest.c` `questpgr.c` `sp_lev.c` `nhlua.c` | `seed0373-barbarian-quest-tour`, `seed0367-priest-quest-tour` |
| Skills, two-weapon | `weapon.c` `wield.c` | `seed0107-samurai-twoweapon-enhance` |
| Extended commands | `cmd.c` `iactions.c` | `seed0106-priest-extcmd-sweep`, `seed0108-wizard-extcmd-wishlist` |
| Water, drowning | `mon.c` `trap.c` | `seed0009-swimmer-mforce`, `seed0006-wizard-water-demon`, `seed0007-rogue-snake-swamp` |
| Calendar (moon, Friday 13) | `calendar.c` | `seed0013-rogue-friday13-combat`, `seed0016-healer-newmoon-eat-zap` |
| Save, restore, bones | `save.c` `restore.c` `bones.c` | `seed0013-friday13-save-then-fullmoon-restore`, `seed5006-tourist-stress-disaster` |
| Death, topten | `end.c` `topten.c` `rip.c` | `seed0030-ten-diverse-deaths` (10 segments) |
| Broad coverage | many | `seed4500-knight-coverage`, `seed0360-wizard-world-tour`, `seed5002-wizard-coverage-pair` |

M1 regenerates this table from measured data (the C caller annotations in each
session's RNG log). When it does, this hand-written version is replaced by
`coverage-map.md` and this section becomes a pointer to it.

---

## 5. Two mechanics worth knowing before you meet them

**Animation frames.** Some actions draw intermediate frames: zap beams crossing
the map, thrown objects in flight, knockback hurtle steps, explosion expansions,
and runmode travel. C's recorder captures these under `animation_frames` in each
step. They are **supplemental** — scored in a separate `Anim%` column, not in the
ranking — and we implement them via `await game.animationFrame()` inside our port
of `nh_delay_output()`. Do not spend milestone time on them before M12.

**Bones and multi-segment sessions.** A session can be several games in sequence:
save then restore, a chained `#quit` then new game, or a death that leaves a bones
file the next game loads. State crosses segments only through the frozen
`js/storage.js` VFS. `seed0030-ten-diverse-deaths` is ten segments and is the
strictest test of this. See M11.
