# M5 — Display, vision, and status lines

**Goal:** turn game state into the exact 24x80 grid C draws. This is the
milestone that first converts correct game state into actual points.

**Target:** `seed8000-tourist-starter` passes 23/23 with `js/fastforward.js`
deleted from the repo, followed by the other seven short sessions.

**C files in scope:** `src/display.c`, `src/vision.c`, `src/botl.c`,
`src/insight.c` (attribute/status computation feeding botl), `src/glyphs.c`,
`src/coloratt.c`, `src/pager.c` (look/farlook), `src/getpos.c` (cursor
positioning for `;` and travel).

**JS targets:** `js/display.js` (exists, 301 lines — audit it), `js/vision.js`
(exists, 543 lines — audit it), `js/botl.js`, `js/insight.js`, `js/pager.js`,
`js/getpos.js`.

`js/game_display.js` (122 lines) has no C counterpart. Determine what it does and
either fold it into the file matching its C origin or delete it.

---

## The screen, precisely

Row 0 is the message line. Rows 1-21 are the map (21 rows of the dungeon's 21).
Rows 22-23 are the two status lines. `js/terminal.js` (frozen) is the grid;
`js/tty/**` (M3) is the writer; this milestone decides *what* gets written.

---

## Items

### 5.1 Audit the existing display and vision code

Same procedure as M4.1. 844 lines exist with unknown provenance.

- [ ] Map every function in `js/display.js` to a function in `src/display.c`
- [ ] Map every function in `js/vision.js` to a function in `src/vision.c`
- [ ] Delete or relocate anything with no C counterpart
- [ ] Add provenance comments

### 5.2 Vision

`src/vision.c` computes what the hero can see: line of sight, lit rooms, night
vision radius, blindness, and the "remembered but not currently seen" distinction
that drives how the map is drawn.

- [ ] `vision_recalc`, `view_from`, `do_clear_area`, the quadrant scanners
- [ ] Lit vs unlit room handling (fed by the light sources placed in M4.6)
- [ ] Light radius: note the 5.0 square-root formula for candle stacks, and that
      gold dragon scale mail is itself a 2-square light source
- [ ] Blindness and telepathy paths

Vision bugs show up as map cells that are drawn when C leaves them blank, or the
reverse — a very common early failure mode.

### 5.3 The map layer

`src/display.c` maps game objects to glyphs and glyphs to screen cells.

- [ ] `newsym`, `map_location`, `map_object`, `map_trap`, `map_invisible`,
      `feel_location`, `show_glyph`, `flush_screen`
- [ ] Layering order: what wins when a monster, an object, and a trap share a
      square, and what the hero's own square shows
- [ ] Remembered-terrain rendering (`glyph_at` and the memory arrays)
- [ ] The display PRNG context: hallucination picks random glyphs through
      `rn2_on_display_rng`, a **separate stream**. `seed0383-wizard-hallucinate`
      (219 steps) and `seed0399-wizard-hallu-actions` (532 steps) are the tests.
      Getting the display stream mixed into the core stream corrupts both.

### 5.4 Status lines

`src/botl.c` builds the two bottom lines. This is 4,582 lines of C and it is
pure screen output, so it is unusually high value per line ported.

- [ ] Field computation: name, rank, attributes, AC, HP, Pw, XP, level, gold,
      time, dungeon level
- [ ] Status conditions (hungry, confused, stunned, hallucinating, blind, ill,
      levitating, and the rest) with C's exact spelling, order, and truncation
- [ ] Field highlighting and colour if the session's options enable it
- [ ] Conditional fields driven by options (`showexp`, `showscore`, `time`,
      `hitpointbar`, …) — parsed in M2, honoured here
- [ ] Note 5.0's HP regeneration formula changes what HP displays turn to turn;
      port `src/allmain.c`'s regen, not remembered 3.6 behaviour

Status lines appear on **every single frame**. A permanently wrong status field
costs every point in the corpus. Verify this one first and hardest.

### 5.5 Look, farlook, and cursor positioning

- [ ] `src/pager.c` `dolook`, `do_look`, `checkfile` — the `:` and `;` commands
- [ ] `src/getpos.c` — interactive cursor movement for `;`, `_` travel, and
      targeting. Cursor position is a scored tiebreaker and is also visible in the
      frame, so the cursor dance matters.

### 5.6 Kill fastforward

- [ ] Delete `js/fastforward.js` entirely
- [ ] Remove every reference to it from `js/jsmain.js` and anywhere else
- [ ] Confirm the score comes only from ported code

**Verify:** `grep -rn fastforward js/` returns nothing.

---

## Done when

- `seed8000-tourist-starter` passes 23/23 screens and 22/22 RNG, with no
  fastforward file in the repo
- At least four of the eight short sessions pass end to end
- `tools/screendiff.mjs` reports zero differing cells on those sessions
- Status lines match on every frame we render

## Note on ordering

This is the first milestone where the local score becomes meaningful. Record the
number in the status board and start the `score-history.tsv` habit here.
