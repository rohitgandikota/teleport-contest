# M2 — Options, rc parsing, and character generation

**Goal:** from `{seed, datetime, nethackrc, moves}`, produce the same PRNG stream
C produces from process start through the end of character creation, and reach
the point where the first level is about to be generated.

**Why here:** all 88 sessions start with chargen. Nothing else can be verified
until this stream is exact. `seed0077-rogue-chargen` (33 steps) and
`seed0102-ranger-name-cancel` (25 steps) exist specifically to exercise it.

**C files in scope:** `src/options.c`, `src/cfgfiles.c`, `src/role.c`,
`src/u_init.c`, `src/attrib.c`, `src/calendar.c`, `src/decl.c`, `src/rnd.c`,
`src/hacklib.c`, `src/allmain.c` (the `newgame()` path only).

**JS targets:** `js/options.js`, `js/cfgfiles.js`, `js/role.js`, `js/u_init.js`,
`js/attrib.js`, `js/calendar.js`, `js/rnd.js`, `js/hacklib.js`.

---

## Items

### 2.1 Data tables, generated not typed

`src/role.c` holds the role, race, gender, and alignment tables. These are large
and mechanical. Write `tools/gen-tables.mjs` that parses the C and emits
`js/role_data.js` (or extends `js/roles.js`), so 5.1 regenerates rather than
hand-edits. Same machinery will serve `src/objects.c` and `src/monst.c` later.

- [ ] Generator script under `tools/`
- [ ] Emitted file carries a header saying it is generated and by what
- [ ] Field names match the C struct field names
- [ ] Round-trip check: every role's every field matches the C

**Verify:** spot-check three roles against `src/role.c` by grep.

### 2.2 `nethackrc` / OPTIONS parsing

`input.nethackrc` is a multi-line `OPTIONS=` blob. It drives name, role, race,
gender, alignment, pet type, autopickup, `msg_window`, symset, and more. Only the
options the sessions actually set need behaviour, but the *parser* must be
general — a held-out session may set an option no public session does.

- [ ] Enumerate which options appear across all 44 public `nethackrc` blobs
      (script it; do not read 44 files by hand)
- [ ] Port the parser from `src/options.c` (`parseoptions` and its dispatch)
      faithfully, including unknown-option handling and error messages
- [ ] Port `src/cfgfiles.c` rc-file reading for the entry path used here
- [ ] Options that are parsed but not yet acted on must be *stored*, never
      silently dropped

**Verify:** parsing all 44 blobs produces no errors and no unknown-option
warnings that C would not produce.

**Careful:** option parsing itself can consume RNG in some paths (e.g. random
role selection). Check the C caller annotations at the head of each session's RNG
log to see what runs before chargen proper.

### 2.3 Fixed datetime

`NETHACK_FIXED_DATETIME` pins the clock. C uses it for moon phase, Friday the
13th luck penalty, hire dates, and shopkeeper greetings.

- [ ] Port `src/calendar.c` (`phase_of_the_moon`, `friday_13th`, `night`,
      `midnight`, and the date accessors)
- [ ] `input.datetime` ("YYYYMMDDHHMMSS") feeds all of them
- [ ] No use of the host clock anywhere in `js/`

**Verify:** `seed0013-rogue-friday13-combat` and
`seed0016-healer-newmoon-eat-zap` compute the same moon phase and luck penalty as
C. The second segment of `seed0013-friday13-save-then-fullmoon-restore` changes
the moon phase across a restore, which is a good end-to-end check later.

### 2.4 RNG wrappers

`js/rng.js` already wraps `frozen/isaac64.js`. Confirm it against `src/rnd.c`.

- [ ] `rn2`, `rn2_on_display_rng`, `rnd`, `d`, `rn1`, `rne`, `rnz`, `rnl`
      all match `src/rnd.c` exactly, including the `rnl` luck adjustment
- [ ] Three separate contexts (core, display, Lua) are distinguishable and each
      logs in the format `docs/API.md` specifies
- [ ] Log entries are emitted for every call, in call order

**Verify:** hand-compare each function against `src/rnd.c` line by line. This is
30 lines of C and it underpins everything; do not skim it.

### 2.5 `u_init` and attribute rolling

- [ ] Port `src/u_init.c` `u_init()` and its helpers in C order
- [ ] Port `src/attrib.c` `init_attr()`, `adjattrib()`, `exerper()` as needed by
      the init path
- [ ] Starting inventory per role, in the C's order (this is RNG-relevant:
      object creation draws)
- [ ] Starting pet selection

**Verify:** `tools/diverge.mjs seed0077-rogue-chargen` shows RNG matching through
the whole chargen prefix. Do the same for one session per role: tourist, ranger,
priest, valkyrie, healer, monk, samurai, knight, wizard, rogue, caveman,
barbarian, archeologist.

### 2.6 Chargen prompt flow

The recorded `moves` string starts at the very first keystroke and includes the
chargen prompts. The number and order of input boundaries during chargen must
match, or every subsequent frame is offset.

- [ ] Role/race/gender/alignment prompts appear exactly when C's do
- [ ] `seed0102-ranger-name-cancel` — the cancel path is handled
- [ ] The intro lore text and its `--More--` boundaries match

**Verify:** frame count for the chargen prefix of each of the eight short
sessions equals C's.

---

## Done when

- Every public session's RNG stream matches from call 0 to the start of level
  generation
- Chargen input boundaries match, so frame indices are aligned
- No host clock, no hardcoded role or seed anywhere
- `js/fastforward.js` chargen entries are deleted

## Notes for whoever picks this up

The skeleton currently skips chargen entirely and fakes its RNG draws from
`js/fastforward.js`. Expect the local score to *drop* while this milestone is in
progress, because deleting fastforward entries removes fake credit before the
real code replaces it. That is correct and expected. Do not restore them.
