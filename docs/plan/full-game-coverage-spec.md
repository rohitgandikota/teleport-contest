# NetHack 5.0 game and contest coverage specification

This document defines what this port must reproduce. It is both a game-domain
reference and a test-coverage contract. It deliberately does not duplicate every
row of the generated monster and object tables. Those tables are the exhaustive
machine-readable inventories, while this document explains every element family,
the rules that connect them, and the scenarios needed to test them.

Last source audit: 2026-08-24. Last score snapshot: commit `79ed734`.

## 1. Sources and authority

The sources were read in this order:

1. The live [Teleport contest site](https://mazesofmenace.ai/), announcement,
   rules, leaderboard, and scoring API describe the submission environment.
2. The complete [Traveler's Companion](https://mazesofmenace.ai/spoilers/)
   explains NetHack 5.0 to a player. Its six parts, appendices, tables, Sokoban
   solutions, bestiary, and 5.0 change appendix were included in the audit.
3. The official [NetHack 5.0 Guidebook](https://nethack.org/v500/Guidebook.html)
   defines the player-facing game, screen, commands, options, conduct, and score.
4. The pinned source under [`nethack-c/upstream/`](../../nethack-c/upstream/) and
   output from the patched C recorder define exact behavior.
5. The frozen local scorer in [`frozen/`](../../frozen/) defines what this
   checkout actually measures.

The C source and recorder are the implementation oracle. The prose guides are
advisory. If a guide, the live site, and the pinned scorer disagree, use the
pinned C build for game behavior and the frozen local runner for the local
contract. Record the disagreement in `docs/plan/NOTES.md`.

This matters because the Companion contains a few internally inconsistent
statements, and because the live API description has changed while this fork's
frozen runner still calls `runSegment(input)` with storage inside `input`.

## 2. Exact contest contract

The entry is a plain ES6 JavaScript port of NetHack 5.0. It must run without a
build step in Node 22 or newer and in a modern browser. During scoring it cannot
use WebAssembly, the network, filesystem access outside the allowed module
reads, child processes, threads, or native add-ons. Persistent game files must
go through the supplied storage interface.

The judge replaces these files with canonical copies:

- `js/isaac64.js`: the three-context deterministic random-number source.
- `js/terminal.js`: the 24 by 80 terminal capture and screen representation.
- `js/storage.js`: the virtual filesystem used for saves, bones, and records.

The local runner supplies a seed, fixed datetime, `OPTIONS` text, key stream,
and per-session storage. `runSegment` returns terminal screens, cursor positions,
random-number logs, and optional animation frames. The ground-truth output is
never passed to the port.

The ranked unit is a screen at an input boundary. A screen matches only when
the canonical cell grid and cursor match. Random-number parity is diagnostic,
not a ranked point. Animation frames are reported separately. A session may
earn partial screen credit after earlier mismatches, but an input over-read that
blocks can consume the judge timeout and invalidate the submission.

The current corpus has 44 public and 44 held-out sessions. As of this audit the
public maximum is 11,405 screens and the held-out maximum is 11,265 screens.
The contest site can add harder held-out cases. Phase 1 ends 2026-11-29 at
00:00 UTC. The top ten qualify for Phase 2. Phase 2 measures parity after a
NetHack change and divides by the size or complexity of the required `js/`
diff. That makes a C-shaped, maintainable port part of the score strategy.

## 3. What the game is

NetHack is a turn-based, single-character dungeon expedition. A run begins with
character creation and ends in death, quitting, escape, or ascension. The main
goal is to descend through the Dungeons of Doom and Gehennom, retrieve the
Amulet of Yendor from Moloch's Sanctum, perform the return journey through the
Elemental Planes, reach the Astral Plane, and offer the real Amulet on the altar
of the hero's alignment.

The game is not a sequence of independent rooms. It is a persistent state
machine with procedural levels, branches, monster and object identities,
inventories, timers, occupations, shops, religion, conduct, knowledge, save
files, and bones. Many rules are conditional on the exact combination of role,
race, alignment, form, equipment, status, terrain, time, and prior events.

The implementation has three deterministic random contexts: core gameplay,
Lua special-level generation, and display effects such as hallucination. Calls
must happen in the same context, order, and integer form as C. A single extra
draw can change later levels and monster turns.

## 4. Exhaustive inventory snapshot

These counts come from generated data derived from the pinned C build.

| Element | Pinned inventory |
|---|---:|
| Roles | 13 |
| Races | 5 |
| Character-choice genders | 2 |
| Player alignments | 3 |
| Monster definitions | 383 |
| Monster display classes | 60 |
| Numbered object definitions | 481 |
| Artifacts | 34 |
| Character properties | 68 |
| Map and effect glyph definitions | 105 |
| Actual terrain values | 37 |
| Trap and trap-like types | 25 |
| Room and shop types | 26 |
| Dungeons | 9 |
| Inter-dungeon branches | 7 |
| Named level templates | 37 |
| Themed-room definitions | 31 |
| Themed-room fill algorithms | 15 |
| Command table entries | 170 |

The exact records live in `js/monst_data.js`, `js/objects_data.js`,
`js/artilist_data.js`, `js/role_data.js`, `js/dungeon_data.js`,
`js/drawing_data.js`, `js/themerms_data.js`, and `js/extcmd_data.js`. They are
generated from the C headers and data files, not hand-maintained approximations.

## 5. Character identity and creation

### Roles

The 13 roles are Archeologist, Barbarian, Caveman or Cavewoman, Healer, Knight,
Monk, Priest or Priestess, Ranger, Rogue, Samurai, Tourist, Valkyrie, and Wizard.
Each role controls starting inventory, base and distributed attributes, HP and
energy advancement, starting alignment record, spell behavior, skill caps,
rank titles, gods, Quest branch, leader, guardians, nemesis, preferred enemies,
Quest artifact, and level-based intrinsics.

### Races, gender, and alignment

The five races are human, elf, dwarf, gnome, and orc. Race controls allowed
role and alignment combinations, attribute limits, racial equipment, monster
relations, infravision, nutrition, and level-based intrinsics. Character
selection uses male and female. Neutral and group grammar forms also exist in
the shared gender data for monsters and messages.

The selectable alignments are lawful, neutral, and chaotic. Unaligned exists
for gods, monsters, altars, and internal state. Alignment affects gods, prayer,
sacrifice, artifacts, peacefulness, Quest access, conflict with actions, and
the winning altar. Alignment type is distinct from alignment record, which
tracks how faithfully the hero has behaved.

Creation can be explicit, random, filtered by role and race constraints, or
driven by options. It also includes naming, roleplay conducts such as pauper,
permanently blind or deaf, nudist, reroll state, and mode selection. Normal,
explore, and wizard modes change prompts and available commands. Wizard mode
also changes early random draws, so it is not a deterministic scout for a
normal-mode seed.

## 6. Screen, input, and knowledge

The canonical display is 24 rows by 80 columns. It contains a message area, a
map viewport, status lines, menus, text windows, prompts, and a cursor. Output
includes characters, colors, attributes, DEC line graphics, erased cells, and
cursor motion. `--More--`, menu paging, get-line editing, position selection,
and restore of the underlying map are game-visible behavior.

Map memory is separate from the current world. The hero can remember terrain,
objects, traps, monsters, and engravings incorrectly or incompletely. Vision
depends on light, line of sight, blindness, telepathy, infravision, warning,
monster detection, invisibility, displacement, underwater state, swallowed
state, and special levels. Hallucination changes display names and glyphs using
the display random context without changing the underlying entity.

The command table has ordinary keys, extended commands, option-dependent
bindings, movement aliases, mouse entries, and wizard commands. Command counts,
repeat, run, rush, travel, move-without-fight, force-fight, number-pad mode,
occupation interruption, and prefix parsing all affect turn consumption.

Major command families are:

- Movement: eight directions, run, rush, travel, wait, stairs, ladders, jump,
  teleport, riding, and movement without pickup or combat.
- Inventory: pickup, drop, wield, swap, quiver, fire, throw, wear, remove, put
  on, eat, quaff, read, zap, cast, apply, rub, tip, dip, loot, name, call, pay,
  and invoke.
- World interaction: open, close, kick, force locks, search, engrave, sit,
  offer, pray, chat, untrap, turn undead, and look or identify symbols.
- Information: inventory filters, discoveries, spells, attributes, conduct,
  overview, event history, previous messages, terrain, version, and help.
- Lifecycle: save, restore on startup, quit, explore-mode confirmation, death
  disclosure, panic, and record display.
- Debug: create, wish, map, detect, level teleport, polymorph, kill, intrinsic,
  special-level loading, and other `wiz*` commands. These are still part of the
  executable surface because public and supplemental sessions use wizard mode.

## 7. Turn, movement-point, timer, and occupation model

Commands either consume no time, one action, multiple movement points, or an
occupation spanning several input boundaries. Player and monster speed are
energy systems, not simple one-for-one alternation. Fast actors can act more
often, slow monsters bank movement, and mounts change movement behavior.

The move loop handles the hero action, monster energy and actions, regions,
light, hunger, regeneration, exercise, property timeouts, corpse and egg timers,
spell aging, environmental damage, demigod harassment, and status redraws. A
message, prompt, combat interruption, nearby monster, damage, or changed target
can stop a run, travel route, repeated command, or occupation.

Multi-turn actions include eating, opening or forcing locks, wearing and taking
off armor, reading some books, digging, and travel. Interrupting them at every
possible boundary is part of the state machine.

## 8. Dungeon topology and level generation

The nine dungeon records are the Dungeons of Doom, Gehennom, the Gnomish Mines,
the Quest, Sokoban, Fort Ludios, Vlad's Tower, the Elemental Planes, and the
Tutorial. The seven branch edges connect the Mines, Sokoban, Quest, Fort Ludios,
Gehennom, Elemental Planes, and Vlad's Tower to their parents.

The 37 named templates cover the Rogue level, Oracle, Big Room, Medusa, Castle,
Valley, Sanctum, demon lairs, three Wizard levels, Orcus Town, fake Wizard
levels, Minetown, Mines' End, role Quest start, locate, and goal templates, four
Sokoban tiers, Fort Ludios, three Vlad levels, Astral, Water, Fire, Air, Earth,
and tutorial templates. Variant selection, mirroring, flipping, coordinate
conversion, exclusions, region fill, and Lua random draws are observable.

Ordinary levels combine rooms, corridors, doors, stairs, traps, monsters,
objects, niches, vaults, themed rooms, and supply containers. Branch placement,
level depth, difficulty, alignment, maze flags, temperature, lighting, and
special-level scripts change generation and later behavior.

### Terrain values

The 37 actual terrain values are stone; vertical, horizontal, corner, cross,
T-junction, and drawbridge walls; trees; secret doors and corridors; pools,
moats, water, raised drawbridges, lava pools, lava walls, and iron bars; doors,
corridors, floors, stairs, ladders, fountains, thrones, sinks, graves, altars,
ice, lowered drawbridges, air, and cloud.

Terrain carries more state than its glyph. Doors can be absent, open, closed,
locked, trapped, broken, warned, or orientation-specific. Altars have alignment
and shrine state. Fountains can be blessed or dry. Ice can melt and retains
buried timers. Drawbridges have wall, span, direction, and mechanism state.
Hot ground, pools, lava, air, clouds, and water apply form and equipment-aware
movement and damage rules.

### Rooms

The 26 room types are ordinary, themed, court, swamp, vault, beehive, morgue,
barracks, zoo, Delphi, temple, leprechaun hall, cockatrice nest, anthole,
generic shop, armor shop, scroll shop, potion shop, weapon shop, food shop,
ring shop, wand shop, tool shop, book shop, health-food store, and candle shop.

Room type controls population, treasure, furniture, messages, ownership,
resident monsters, and sound. Only some ordinary rooms are converted to a
special room. Shops add inventories, billing, credit, debt, theft, damage,
shopkeeper pathing, anger, pursuit, and price-identification behavior.

### Map and effect glyphs

The 105 glyph definitions include terrain, all trap displays, beams, slants,
dig and flash beams, boomerang frames, shield effects, poison cloud, valid
position markers, swallowed borders, and explosion cells. Monster and object
glyphs are layered over remembered terrain. Correct draw order is required even
when two worlds have the same logical entities.

## 9. Traps and environmental hazards

The 23 on-map trap types are arrow, dart, falling rock, squeaky board, bear
trap, land mine, rolling boulder, sleeping gas, rust, fire, pit, spiked pit,
hole, trap door, teleport, level teleport, magic portal, web, statue, magic,
anti-magic, polymorph, and the vibrating square. Trapped doors and trapped
chests are two additional trap-like knowledge types, bringing the enum surface
to 25.

Trap behavior depends on whether it is known, once-only, made by the hero,
conjoined with another pit, fixed to a destination, carrying a launch object,
or attached to a door or container. Flight, levitation, size, strength,
amorphousness, webmaking, magic resistance, antimagic, form, footwear, steed,
fumbling, and deliberate entry alter outcomes. Monsters maintain their own trap
knowledge and can learn, avoid, trigger, escape, or remove traps.

Other hazards include drowning, lava immersion, hot ground, freezing or
melting, drawbridge crushing, falling, boulder movement, poison clouds,
engulfment, suffocation, disintegration, petrification, sliming, illness,
strangulation, starvation, choking, brainlessness, level drain, max-HP drain,
and direct divine or endgame effects.

Engravings are floor state with text, type, age, degradation, and ward effects.
They can be written in dust, engraved, burned, or formed by other actions.
Elbereth affects only eligible monsters and is subject to visibility, location,
conduct, item, occupation, and defilement rules. It is not a universal safe
square.

## 10. Monsters

There are 383 monster definitions across 60 display classes. Each definition
contains name forms, class glyph, level, speed, armor class, magic resistance,
alignment, generation flags, up to six attacks, weight, nutrition, sound, size,
resistances, corpse-conveyed resistances, behavior flags, difficulty, and color.
The full inventory is `js/monst_data.js`, generated from `include/monsters.h`.

Attack delivery types include claw, bite, kick, butt, touch, sting, hug, spit,
engulf, breath, active explosion, death explosion, gaze, tentacle, weapon, and
spellcasting. Damage effects include physical, magic missile, elemental and
acid damage, sleep, disintegration, poison, blindness, stun, slowing, paralysis,
life and energy drain, leg injury, petrification, sticking, gold or item theft,
seduction, teleport, rust, confusion, digestion, healing, wrapping, lycanthropy,
attribute or brain drain, disease, decay, hallucination, death, Pestilence,
Famine, sliming, enchantment drain, corrosion, polymorph, clerical and arcane
spell dispatch, random breath, Amulet theft, and curses.

Monster flags describe movement through air, water, walls, tunnels, and solid
objects; anatomy; senses; diet; regeneration; teleport; resistances; race and
monster family; sex; uniqueness and genocide eligibility; hostility; domestic
or pet status; wandering and stalking; strength; collection preferences; magic;
covetous goals; displacement; group generation; corpse rules; and branch
generation constraints.

At runtime every monster also has identity and mutable state: position, HP,
energy, peaceful or tame status, tameness and abuse, strategy, target memory,
inventory, equipment, trapped state, blindness, confusion, fleeing, eating,
sleep, paralysis, cancellation, speed, disguise, undetected state, worm body,
shop or priest role, migration destination, and prior track.

Shapechanging is persistent monster state, not just a temporary species name.
Chameleons, doppelgangers, sandestins, and the vampire family retain a natural
form index while transformed. Vampire forms are restricted to fog cloud,
vampire bat, and, for the stronger vampire types, wolf, with current health,
visibility, terrain, genocide, and carried special objects affecting changes.
Petrifying a shifted vampire restores mobility and health, expels an engulfed
hero, moves an amorphous form out of a closed doorway before it becomes solid,
and restores the natural vampire form unless that form was genocided. A shifted
monster whose natural form intrinsically resists stone, notably a sandestin,
also reverts instead of becoming a statue.

Monster turns include energy gain, wake and helpless checks, conflict, ranged
and defensive item use, spells, covetous warps, hiding, door and container use,
movement candidate generation, attacks on the hero or other monsters, traps,
object pickup, eating, post-move effects, migration, death, corpse creation, and
revival. Pets add goal selection, apport, hunger, loyalty, training, abuse,
food preference, stealing avoidance, trap caution, and following between levels.
Steeds add saddles, riding skill, gallop, mounted traps, dismount, and shared
flight or movement properties.

## 11. Objects, inventory, and identification

The 481 numbered object records are grouped as follows. Counts include generic
class placeholders because those are real numbered records in the C table.

| Class | Count | Core behavior |
|---|---:|---|
| Invalid or generic | 2 | Sentinels and class-level placeholders |
| Weapons | 72 | Melee, missile, launcher, reach, skill, damage, poison, erosion |
| Armor | 85 | Seven slots, AC, magic cancellation, delay, fit, properties |
| Rings | 29 | Two hand slots, charge or enchantment, continuous properties |
| Amulets | 14 | Neck slot, properties, strangulation, life saving, real or fake Yendor |
| Tools | 51 | Containers, locks, light, instruments, digging, vision, traps, cameras |
| Food | 34 | Nutrition, eating time, spoilage, corpse and tin effects |
| Potions | 27 | Quaff, throw, dip, vapor, alchemy, dilution, environmental breakage |
| Scrolls | 44 | Read effects, confusion variants, blank and mail-like records |
| Spellbooks | 45 | Learning, study delay, spell metadata, novel, Book of the Dead |
| Wands | 29 | Direction, charges, wresting, breaking, engraving, recharging |
| Coins | 2 | Gold stacks, payment, theft, score |
| Gems | 37 | Real gems, glass, gray stones, value, sling use, unicorn interaction |
| Rocks | 3 | Boulder, statue, heavy terrain and monster interactions |
| Iron ball | 2 | Punishment ball state |
| Iron chain | 2 | Punishment chain state |
| Venom | 3 | Monster-created projectiles and blinding or acid effects |

Every object instance has type, class, quantity, weight, location, owner or
container relation, inventory letter, age, BUC state, enchantment or charges,
erosion, proofing, crack state, poison, trap and lock state, knowledge flags,
artifact identity, corpse species, worn mask, unpaid or shop state, timers, and
class-specific bits. Instances can merge, split, stack, migrate, fall, burn,
rot, hatch, revive, polymorph, transform, spill, break, or become buried.

Identification is itself persistent game state. Appearance is randomized by
class. The hero can know the base type, description, BUC, charges, enchantment,
erosion, proofing, lock, trap, contents, and user-assigned name independently.
Discovery comes from role knowledge, shops and prices, priests and pets, use,
messages, engraving, sink tests, scrolls and spells, skill advancement, and
direct identification. Hallucination, blindness, ambiguity, and stack changes
affect what is displayed.

BUC changes effects and safety. Cursed worn items can stick. Blessed items
often strengthen effects. Enchantment, charges, erosion, proofing, cracking,
recharging, cancellation, and polymorph each have class-specific failure paths.
Container rules cover nested weight, locks, traps, bags of holding, magical-bag
explosions, refrigeration, monster access, shop ownership, and spilling.

## 12. Combat and damage

Combat resolves intent, safety prompts, displacement and mimic reveals,
to-hit, multiple attacks, weapon or natural damage, artifact effects, poison,
silver and material hatred, jousting, two-weapon penalties, skill training,
knockback, passive retaliation, monster death, experience, corpse or special
death drops, and post-kill alignment and conduct effects.

Armor class reduces hit chance and can reduce damage. Magic cancellation and
resistances block or reduce specific special attacks. Weapon damage depends on
target size, enchantment, erosion, skill, strength, launcher and ammunition
matching, two-handed strength scaling, artifact bonuses, and monster traits.
Unarmed, martial arts, kicks, thrown objects, fired ammunition, polearm reach,
spells, wands, explosions, and monster-versus-monster attacks have separate
paths.

Death is not always final. Life saving, wizard-mode refusal, polymorph HP,
amulet effects, lifesaving monsters, revival timers, trolls, statues, undead
creation, and bones can change the result. The exact killer text, tense, corpse,
grave, disclosure, score, and record screen are observable output.

## 13. Properties, status, and survival

The 68 character properties are grouped below. A property may come from a timed
intrinsic, experience, race, an outside event, current monster form, worn or
carried gear, or an invoked artifact. Equipment can also block a property.

- Resistances and protection: fire, cold, sleep, disintegration, shock, poison,
  acid, stone, drain, sickness, invulnerability, and antimagic.
- Troubles and trouble resistance: stunned, confused, blind, deaf, sick,
  stoning, strangled, vomiting, slippery hands, slimed, hallucinating,
  hallucination resistance, fumbling, wounded legs, sleepy, and hunger.
- Senses: see invisible, telepathy, warning, warning of selected monsters,
  warning of undead, automatic searching, clairvoyance, infravision, monster
  detection, and blindness resistance.
- Appearance and behavior: adornment, invisibility, displacement, stealth,
  aggravate monster, and conflict.
- Movement: jumping, teleport, teleport control, levitation, flight, water
  walking, swimming, magical breathing, and wall passing.
- Physical and magical support: slow digestion, half spell damage, half physical
  damage, HP regeneration, energy regeneration, protection, protection from
  shape changers, polymorph, polymorph control, unchanging, speed, reflection,
  free action, fixed abilities, and life saving.

The hero also tracks six attributes, current and maximum HP and energy,
experience level and points, armor class, hunger, encumbrance, alignment record,
god anger, prayer timeout, luck, skill slots, spells, exercise, movement points,
steed, stuck or engulfed state, polymorph form, light, and many event flags.

Hunger advances with time and actions. Food has nutrition and eating time.
Corpses add age, rot, poison, sickness, cannibalism, petrification, slime,
intrinsic, transformation, and pet rules. Choking depends on satiation and form.
HP regeneration in 5.0 uses experience level and Constitution, with the
regeneration property adding unconditional healing. Energy regeneration,
exercise checks, luck timeout, spell retention, and property timeouts run on
their own schedules.

## 14. Magic

The seven spell schools are attack, healing, divination, enchantment, clerical,
escape, and matter. The object table contains 41 ordinary castable spellbooks,
plus a generic record, blank paper, a novel, and the Book of the Dead. Spell
success depends on role, casting attribute, experience, skill, spell level,
knowledge age, energy, hunger, armor, shield, metal, and special role bonuses.

Spell effects cover rays, projectiles, healing, detection, status, locks,
creation, fear, clairvoyance, haste, levitation, invisibility, mapping,
identification, undead turning, polymorph, teleport, familiar creation,
cancellation, protection, jumping, stone-to-flesh, and chain lightning. Spell
skill advancement changes failure and can identify books of the school.

Wands have nondirectional, immediate, ray, and special effects. They can be
zapped at the world or hero, used to engrave, broken, recharged, cancelled, or
wrested for a final charge. Rays reflect, bounce, strike terrain and entities,
animate frames, and can continue through several cells. Potions act when
quaffed, thrown, inhaled as vapor, dipped into, mixed, boiled, diluted, or
shattered. Scrolls have normal and confused readings, blessed and cursed
variants, targeting prompts, and identification side effects.

The confuse-monster scroll and spell charge the hero's hands when the hero is
clear-headed and human. An ordinary scroll adds three base charges plus a small
random increment, while a blessed reading adds a larger random increment. A
cursed reading, or any reading in a nonhuman form, confuses the hero instead.
A confused ordinary reading lengthens confusion, while a confused blessed
reading cures it. Blindness and unseen invisibility replace visible glow
messages with touch or sound feedback. A successful hand-to-hand hit spends one
charge before checking the target's magic resistance, then confuses a target
that fails that check. An already confused target spends no charge.

Polymorph applies to the hero, monsters, and objects. It must preserve or reset
different identity and state fields depending on the target. Genocide, wishing,
recharging, cancellation, and artifact invocation have global constraints and
rare failure paths.

## 15. Religion, alignment, luck, and conduct

Prayer evaluates trouble, alignment, record, god anger, prior prayer timeout,
altar alignment, and whether the request is safe. Outcomes include help,
blessing, healing, punishment, lightning, disintegration, crowning, and death.
Sacrifice evaluates corpse species, freshness, sacrifice value, altar and hero
alignment, conversion, demon or human sacrifice, pet history, gifts, and Quest
constraints. Priests handle donation, protection, temple ownership, chat,
healing, anger, and 5.0's cheapskate pricing state.

Luck combines base luck and item bonuses, normally bounded around -10 to +10
with a three-point luckstone contribution. Full moon and Friday the 13th alter
the equilibrium. Luck affects generation, combat, traps, prayer, wishes,
enchantment, and many random checks. Alignment record, sins, anger, gifts,
blessings, and crowning are separate variables.

Tracked conducts include vegetarian, vegan, foodless, atheist, weaponless,
pacifist, illiterate, no object polymorph, no self-polymorph, wishless,
artifact-wishless, genocide restrictions, Sokoban conduct, petless, pauper,
permanently blind, nudist, permanently deaf, and bonesless roleplay state.
The Companion also explains combinations and player-imposed restrictions. The
port must track the exact C counters and disclose them correctly at death.

## 16. Social systems, pets, shops, and special actors

Monsters can be hostile, peaceful, tame, shopkeepers, priests, guards, Quest
actors, minions, demons, riders, covetous uniques, or player monsters. Chat,
bribery, payment, theft, damage, healing, sacrifice, conflict, displacement,
attacks, and alignment can change relations.

Pets follow, eat, become hungry, gain tameness and apport, fetch objects, avoid
some cursed items and traps, attack enemies, resist conflict, gain corpse
resistances, go feral, migrate, die, revive, and leave bones. Mounts add saddle
ownership, riding prompts, shared movement, steed hunger and combat, and special
dismount causes.

Shop state includes room ownership, stock generation, price modifiers, charisma
and Tourist penalties, credit, cash, unpaid stacks, used-up merchandise,
container contents, damage, robbery, pursuit, Kops, and restitution. Selling
gems and price-identifying randomized objects are intentional information paths.
Vault guards run a separate escort conversation and route-building state
machine.

## 17. Artifacts, Quest, and progression

There are 34 artifacts: Excalibur, Stormbringer, Mjollnir, Cleaver, Grimtooth,
Orcrist, Sting, Magicbane, Frost Brand, Fire Brand, Dragonbane, Demonbane,
Werebane, Grayswandir, Giantslayer, Ogresmasher, Trollsbane, Vorpal Blade,
Snickersnee, Sunsword, the Orb of Detection, Heart of Ahriman, Sceptre of Might,
Palantir of Westernesse, Staff of Aesculapius, Magic Mirror of Merlin, Eyes of
the Overworld, Mitre of Holiness, Longbow of Diana, Master Key of Thievery,
Tsurugi of Muramasa, Platinum Yendorian Express Card, Orb of Fate, and Eye of
the Aethiopica.

Artifacts have a base object type, alignment, role or race affinity, touch and
blast restrictions, special attacks, defenses, carried effects, invoked powers,
warning targets, intelligent behavior, gift and wish rules, naming rules, and
uniqueness. Twenty are general artifacts and fourteen are role Quest artifacts.

Each role's Quest has a leader, home level, locate level, goal level, guardians,
nemesis, enemies, messages, alignment and level entry checks, a Bell of Opening,
and the role artifact. The Quest can be called, refused, expelled, entered,
completed, and reported back. These are persistent events, not only special
maps.

Skills cover weapon families, riding, two-weapon combat, unarmed or martial
arts, and seven spell schools. Practice points and experience unlock skill
advances. Roles cap each skill differently. Advancement spends slots and can
alter to-hit, damage, spell failure, multishot, riding, and identification.

## 18. Deep dungeon and ascension

The Castle is the transition from the main dungeon toward Gehennom and provides
the guaranteed wand-of-wishing route, drawbridge puzzle, tune state, and strong
population. Gehennom adds the Valley of the Dead, no ordinary prayer safety,
hot ground and fire behavior, demon rulers and lairs, Vlad's Tower, Orcus Town,
Wizard levels, fake Wizard levels, and Moloch's Sanctum.

The invocation requires the Bell of Opening, Candelabrum of Invocation with
seven lit candles, and Book of the Dead at the vibrating square. It creates
access to the Sanctum. The hero then obtains the real Amulet, becomes a target
for the Wizard and covetous monsters, and climbs back to the top.

The endgame contains the Planes of Earth, Air, Fire, and Water, then Astral.
Each plane has distinct terrain, movement, monsters, environmental rules, and a
portal that must be found. Astral contains three temples, player monsters,
angels, the Riders, and aligned or incorrect altars. Offering the real Amulet
on the correct altar ascends. Offering it incorrectly, carrying the fake, or
losing it follows different paths.

## 19. Death, save, restore, bones, and records

Save serializes the complete game through the frozen storage API and exits.
Restore validates and reconstructs object, monster, timer, level, branch,
knowledge, display, RNG-adjacent, and global state. Multi-segment sessions share
storage within one session and reset it between sessions.

Eligible deaths can write a bones level containing the map, possessions,
monsters, traps, engravings, ghost or arisen form, and altered names and
knowledge. A later game at the matching depth can load it. Bones generation and
loading are random and have eligibility restrictions. Death can also update the
record file.

End-of-game output includes the death message, tombstone or escape and ascension
text, inventory disclosure, attributes, vanquished and genocided lists, conduct,
achievements, dungeon overview, score calculation, and top-ten entry. The C
source defines exact wording, tense, ordering, menu paging, and cursor behavior.

The 31 encoded achievements include the invocation artifacts and milestones,
Gehennom, endgame, Astral, ascension, Mines and Sokoban prizes, Medusa, blind
and nudist runs, branch and room milestones, Oracle and novel events, rank
advances, and learning the Castle tune.

## 20. NetHack 5.0 rules that invalidate older NetHack memory

The pinned version is 5.0, not 3.6. Important changes include themed rooms,
supply containers, mirrored special levels, four Medusa variants, Orcish Town,
changed Gehennom temperature and teleport rules, and revised Castle monsters.

New monsters include displacer beasts, genetic engineers, gold dragons, and
baby gold dragons. Monsters use containers and unlock or loot chests. Pets can
gain resistances and can be revived by prayer in the right conditions. Mind
flayers no longer erase the map and item knowledge, but still damage
Intelligence and learned capabilities.

New gear includes helms of caution, amulets of flying and guarding, and revised
dragon scale mail properties. Unicorn horns no longer restore attributes. Bags
of holding scatter contents when they explode. Glass can crack in stages.
Candle radius, wand engraving, wand speed, blessed polymorph potions, alchemy,
shop prices for intrinsic corpses, and sink identification changed.

Combat and magic changes include chain lightning, changed spell levels, school
identification on skill advance, revised touch of death, larger two-handed
strength bonuses, new HP regeneration, knockback, and trap protection from iron
shoes and kicking boots.

Role and religion changes include Valkyrie starting gear, Excalibur fountain
odds, Demonbane as the Priest's first sacrifice gift, minimum sacrifice value,
randomized priest donations and cheapskate state, expanded artifact powers,
new wish sources, and new conducts. Every one of these must be verified against
the exact C function before porting.

## 21. Complete Companion and Guidebook audit map

The Companion coverage audit includes every major section:

| Source part | Included topics |
|---|---|
| Before setting out | roles, races, alignment, starting choices, supplies, first descent, early hazards, supply containers |
| Dungeon sights | world topology, map symbols, room types, early and deep bestiary, furniture, branches, landmarks, traps, secret doors, engravings, Elbereth, bars, sounds and level feelings |
| Survival | to-hit, damage, AC, speed, two-weapon combat, tactical combat, named threat families, saving, bones, every instant-death family, prayer, sacrifice, priests, altars, crowning, pets and taming |
| Gear and provisions | identification, BUC, price identification, every randomized object table, engraving and sink tests, food, corpse effects, potions, alchemy, scrolls, wands, rings, amulets, tools, containers, locks, light, instruments, armor, weapons, erosion, dragon armor, curses |
| Mastery | all 13 role guides, spell learning and casting, luck, exercise, skills and all role caps, wishes, wish syntax, all general and Quest artifacts |
| Deep dungeon | Castle, Gehennom and every named lair, invocation, ascension kit, ascent, Elemental Planes, Astral Plane |
| Appendices | advanced controls, options, Sokoban solutions, all conducts, shop pricing and behavior, weapon tables, armor tables, spell tables, all 60 bestiary classes, all intrinsic and extrinsic groups, 5.0 changes, index |

The Guidebook audit includes its goal and game modes, screen and symbols,
character creation, command and prefix tables, options, rooms and corridors,
monsters, objects, actions, time, combat, transport, religion, shops, conduct,
scoring, save and restore, and end-of-game behavior.

## 22. Coverage standard for supplemental tests

"All game coverage" cannot mean every combination of 383 monsters, 481 object
types, status stacks, seeds, maps, and action histories. That state space is
unbounded for practical testing. For this project it means all of the following:

1. Every element family in this document has at least one deterministic C
   reference scenario or a direct data-integrity test.
2. Every command family has normal, cancel, invalid, and interrupted paths where
   those paths exist.
3. Every mutable subsystem has at least one cross-turn scenario. Persistent
   subsystems also have save and restore coverage.
4. Interactions are tested across normal play and wizard-built setup. Wizard
   mode is a setup tool, not a substitute for normal generation and timing.
5. Rare and late-game branches are reached through C-recorded world tours, but
   their key interactions receive smaller focused tests too.
6. Each scenario records its feature tags, mode, seed, datetime, expected input
   boundaries, random contexts, and known limitations.
7. Public, supplemental, hang-gate, and held-out metrics are tracked separately.
   No change is accepted solely because public points increase.
8. A code change must correspond to a real C function or data table. Session
   seed checks, replayed answer data, special screen patches, and recorded RNG
   shortcuts are forbidden.

The current supplemental recipes cover chargen variants, fountains, dipping,
kicks, scroll reading, armor timing, doors struck by wands, engravings,
martial arts, prayer at low HP, save and restore, monster drift, all 13 Quest
maps, and the Elemental Planes. The next manifest must explicitly add the gaps:
shops and billing, every object-effect family, spell schools, traps, room types,
monster attack-effect families, polymorph forms, pets and steeds, priest and
sacrifice edges, containers and locks, timed statuses, environmental deaths,
bones, invocation, Castle and Gehennom events, Amulet ascent, Astral outcomes,
options and command cancellation, and end-of-game disclosures.

## 23. Baseline used for future comparisons

At commit `79ed734`:

| Corpus | Sessions passing | Screens | Screen rate | RNG positions |
|---|---:|---:|---:|---:|
| Public local | 21/44 | 5,120/11,405 | 44.89% | 312,405/792,838 |
| Supplemental C recorder | 9/28 | 1,041/1,762 | 59.08% | 266,118/282,098 |
| Held-out leaderboard | 1/44 | 3,438/11,265 | 30.52% | 15.98% |

The held-out to public screen-point ratio is 0.67. The leaderboard rank was
5 of 18 by held-out points at the audit time. These values are the starting
line for broader-coverage work, not proof of comprehensive behavior.
