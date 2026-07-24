# M10 — Subsystem sweeps

**Goal:** close the remaining named subsystems, one compact sweep at a time.

By this point the engine runs and most sessions get deep before diverging. Each
item below is an independent, self-contained sweep: pick one, port it, verify
against its named sessions, commit, move on. They can be worked in any order and
by different agents in parallel, because they touch disjoint files.

Use `tools/diverge.mjs` on the highest-step failing session to choose which sweep
to do next — it names the C function, and that names the sweep.

---

## Sweeps

### 10.1 Traps and hazards
`src/trap.c` (7,211 lines), `src/dbridge.c`, `src/ball.c`.
Trap effects, pits, webs, teleport traps, magic traps, rust traps, falling.
**5.0:** iron shoes and kicking boots absorb trap punishment, including bear
traps, spiked pits, polymorph traps, and anti-magic drain.
Sessions: `seed0015-valk-level2-pit-dog-wait`, `seed4500-knight-coverage`.

### 10.2 Prayer, gods, sacrifice
`src/pray.c`, `src/priest.c`, `src/artifact.c` (gift path).
**5.0:** sacrifice for artifact generation requires a minimum sacrifice value;
sacrificing weak corpses no longer grinds Luck when your Luck already exceeds the
corpse's difficulty; priest donation baselines are randomised between 150 and 250
× XL with 500 × XL guaranteeing protection, and under-donating sets a persistent
cheapskate flag.
Sessions: `seed0017-samurai-altar-pray` (67 steps).

### 10.3 Fountains, sinks, thrones
`src/fountain.c`, `src/sit.c` (thrones).
**5.0:** Excalibur dipping is 1-in-30 for non-Knights, 1-in-6 for Knights; sink
dipping identifies potions by message.
Sessions: `seed0014-dequa-fountain-explore` (714 steps).

### 10.4 Vaults and guards
`src/vault.c`.
Session: `seed0012-monk-vault-escort` (308 steps).

### 10.5 Polymorph and shapeshifting
`src/polyself.c`, `src/were.c`, `src/zap.c` (polymorph path).
**5.0:** blessed potions of polymorph grant controlled polymorph; genetic
engineers polymorph their target on hit; a polymorphed vampire can `#monster` to
cycle between vampire, bat, and fog cloud forms.
Sessions: `seed0398-wizard-wandpoly-pile` (87 steps).

### 10.6 Hallucination and the display PRNG
`src/display.c` hallucination paths, `src/rnd.c` `rn2_on_display_rng`.
This is the third PRNG context and it must not mix with the core stream.
Sessions: `seed0383-wizard-hallucinate` (219), `seed0399-wizard-hallu-actions`
(532). Together these are 751 steps, one of the largest single blocks of points
outside the coverage sessions.

### 10.7 Water, swimming, drowning
`src/mon.c` water handling, `src/trap.c` drowning, `src/dothrow.c`.
Sessions: `seed0009-swimmer-mforce` (73), `seed0006-wizard-water-demon` (123),
`seed0007-rogue-snake-swamp` (302).

### 10.8 Detection, magic mapping, clairvoyance
`src/detect.c`.
Sessions: `seed0002-healer-reflection-drummer` (595 steps).

### 10.9 Music, drums, and sound
`src/music.c`, `src/sounds.c`.
Sessions: `seed0002-healer-reflection-drummer`.

### 10.10 Digging and mining
`src/dig.c`.
Sessions: `seed4500-knight-coverage`, `seed0360-wizard-world-tour`.

### 10.11 Explosions, rays, regions
`src/explode.c`, `src/region.c`, `src/light.c`.
**5.0:** chain lightning spreads in all directions and chains between monsters.

### 10.12 Death, endgame, scoreboard
`src/end.c`, `src/topten.c`, `src/rip.c`.
The tombstone screen and the topten listing are pure screen output and are worth
a lot in `seed0030-ten-diverse-deaths` (1,953 steps across 10 segments), where a
death screen ends every segment.

### 10.13 Attributes, intrinsics, conducts
`src/attrib.c`, `src/insight.c`, `src/exper.c`.
**5.0:** unicorn horns no longer restore lost attributes; new conducts tracked
are pauper, petless, permadeaf, and Sokoban.

### 10.14 Engraving, writing, naming
`src/engrave.c`, `src/write.c`, `src/do_name.c`.
Sessions: `seed0101-ranger-quiver-throw-travel-engrave`.

### 10.15 Wizard mode and debug commands
`src/wizard.c`, `src/wizcmds.c`.
Needed by the wishlist session and by any session recorded in wizard mode.
Sessions: `seed0108-wizard-extcmd-wishlist` (303 steps).

---

## Done when

- Every sweep above is either complete or explicitly deferred with a reason
  recorded in this file
- No public session diverges for a reason attributable to a listed sweep
- The two coverage sessions (`seed4500-knight-coverage`,
  `seed0360-wizard-world-tour`) and the three long tours run to completion

## How to pick the next sweep

Score-weighted, not interest-weighted:

```bash
node tools/scoreboard.mjs          # which sessions lose the most steps
node tools/diverge.mjs <session>   # which C function loses them
```

Take the sweep that unblocks the most steps. Re-measure after every sweep,
because unblocking one session often unblocks several.
