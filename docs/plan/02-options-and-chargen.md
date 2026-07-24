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

### 2.1 Data tables, generated not typed — DONE

- [x] `tools/gen-roledata.mjs` parses `src/role.c` and emits `js/role_data.js`:
      **13 roles, 5 races, 4 genders, 4 alignments**. It parses C aggregate
      initialisers generically (comment stripping, brace nesting, string
      literals) and maps top-level positions onto the field names from
      `struct Role` at `include/you.h:183`.
- [x] Emitted file says it is generated and by what
- [x] Field names match the C struct field names
- [x] Leaf values kept as raw C expressions (`PM_ARCHEOLOGIST`,
      `MH_HUMAN | MH_DWARF | ROLE_LAWFUL`, `-4`). Resolving constants is
      `js/const.js`'s job; this table reproduces shape, not meaning.
- [x] Line-continued bitmask expressions are collapsed to one line.

**Verified:** Archeologist checked field by field against `src/role.c:31-71` —
`attrbase` `{7,10,10,7,7,7}`, `attrdist` `{20,20,20,10,20,10}`, gods, filecode,
`questarti`, `hpadv`, `enadv`, `xlev` 14, `initrecord` 10, and all seven `spel*`
fields. Every role, race, gender and alignment named across the 44 public rc
blobs resolves. The public corpus uses **all 13 roles**.

Note genders and alignments have four entries each, not three: NetHack carries a
`group` gender and an `unaligned` alignment. Those are real table entries, not
array terminators.

### 2.2 `nethackrc` / OPTIONS parsing — MOSTLY DONE

- [x] Enumerated every option across all 44 public rc blobs (scripted). The
      surface is small: **14 valued options** (`symset` 50, `role`/`race`/
      `gender`/`align` 48, `name` 47, `suppress_alert` 42, `disclose` 24,
      `playmode` 17, `msg_window` 4, `pettype` 3, `runmode` 2, `pickup_types` 2,
      `horsename` 1) and **11 booleans** (`autopickup` 40, `tutorial` 24,
      `legacy` 17, `showexp`/`time`/`color` 8, `lit_corridor`/`pushweapon` 6,
      `splash_screen` 3, `verbose` 2, `mention_walls` 1). Two non-OPTIONS
      directives also appear: `SYMBOLS=` and `BIND=`.
- [x] **The option table is generated, not hand-typed.** `tools/gen-optlist.mjs`
      parses `include/optlist.h` and emits `js/optlist.js`: **255 options**
      (128 boolean, 120 compound, 7 other), 18 with aliases. Count verified
      against the header (267 macro invocations minus 12 `#define` lines) and
      fields spot-checked entry by entry. A 5.1 option change is absorbed by
      re-running the generator.
- [x] `parseoptions()` ported table-driven from `src/options.c:489`, including
      the two behaviours that are easy to miss: elements are processed **right
      to left** (the C splits on the first comma and recurses before handling
      the current element), and negation accepts `!opt`, `noopt`, and `no-opt`
      and **stacks**.
- [x] Unknown options are recorded as errors, never silently dropped.
      `negateok`/`valok` are enforced from the table.
- [x] `parse_config_line` dispatch in `parseNethackrc`: `OPTIONS=` parsed;
      `SYMBOLS=` and `BIND=` captured as pending rather than ignored.
- [x] **Verified: all 44 public rc blobs parse with zero errors.**
- [ ] **Option abbreviation (`minmatch`) is not implemented.** The C computes a
      minimum unambiguous prefix per option in `determine_ambiguities()` and
      matches on it, so `OPTIONS=col` is legal for `color`. No public session
      uses an abbreviation, but a held-out one may. Port
      `determine_ambiguities()` and use it in the match loop.
- [ ] Options are parsed and stored but most are not yet *acted on*. That is
      correct for now — behaviour lands with the subsystem that needs it.

**Still open here.** The parser is general, but option parsing in the C can
itself consume RNG on some paths (random role selection, for one). Check the C
caller annotations at the head of each session's RNG log to see exactly what runs
before chargen proper, and make sure our parse consumes the same draws — or
none, if C consumes none for these rc files.

### 2.3 Fixed datetime — DONE

`NETHACK_FIXED_DATETIME` pins the clock. C uses it for moon phase, Friday the
13th luck penalty, hire dates, and shopkeeper greetings.

- [x] `js/calendar.js` ports all of `src/calendar.c`: `getnow`, `getlt`,
      `getyear`, `yyyymmdd`, `hhmmss`, `yyyymmddhhmmss`,
      `time_from_yyyymmddhhmmss`, `phase_of_the_moon`, `friday_13th`, `night`,
      `midnight`
- [x] `input.datetime` feeds all of them via `game.fixed_datetime`, set in
      `js/jsmain.js` — mirroring how patch 001 makes `getnow()` read the env var
- [x] `struct tm` field semantics preserved, in particular `tm_year` as
      (year - 1900). `phase_of_the_moon` uses `tm_year % 19`, so storing a plain
      year would silently shift the moon.
- [x] Day-of-week and day-of-year computed in UTC so no host timezone can
      perturb them
- [x] `getlt()` throws rather than falling back to the host clock when no
      datetime is set — a silent fallback would make output depend on run time
- [x] **Audited: no `Date.now()` / `new Date()` anywhere in `js/`**

**Verified against the sessions' own names**, which assert calendar properties:

| Session | datetime | result |
|---|---|---|
| `seed0013-rogue-friday13-combat` | 20001013090000 | Fri the 13th ✓ |
| `seed0013-…-save-then-fullmoon-restore` seg 1 | 20001013090000 | Fri the 13th ✓ |
| `seed0013-…-save-then-fullmoon-restore` seg 2 | 20001111120000 | moon phase 4, **full** ✓ |
| `seed0016-healer-newmoon-eat-zap` | 20000205090000 | moon phase 0, **new** ✓ |

All four match what the filenames claim, which is independent confirmation the
arithmetic is right.

**Known risk, not yet exercised.** The C's `time_from_yyyymmddhhmmss` builds a
`struct tm` by copying the *current* time's `tm_isdst` and then calling
`mktime()`. If the fixed datetime falls on the other side of a DST boundary from
the recording machine's clock, `mktime`/`localtime` can round-trip an hour off,
which would move `hhmmss`, `night`, and `midnight`. Our port sidesteps this by
treating the string as literal calendar fields. No public session appears to be
affected. To check: record a session with a datetime an hour either side of a US
DST transition and compare `hhmmss` against C.

### 2.4 RNG wrappers — DONE

`js/rng.js` wraps `frozen/isaac64.js`. Audited line by line against `src/rnd.c`.

- [x] `rn2`, `rnd`, `rn1`, `rne`, `rnz` verified correct as they stood
- [x] **`d(n,x)` was wrong and is fixed.** C draws through `RND()` directly
      (`src/rnd.c:186`), so the log carries one `d(n,x)=tmp` entry. The JS called
      `rnd()` n times, emitting n bogus `rnd(x)` entries and no `d(...)` entry —
      which would have desynchronised the whole log the first time any dice roll
      happened.
- [x] **`rnl(x)` was missing entirely** and is now ported, with the Luck
      adjustment. 155 calls in the public corpus.
- [x] `sgn()` added to `js/hacklib.js` from `src/hacklib.c:650`, since `rnl`
      needs it.
- [x] Seeding verified: `init_isaac64` (`src/rnd.c:43-58`) writes the seed as 8
      little-endian bytes, which is exactly what `initRng` does.
- [x] Log entry types confirmed against the corpus: `rn2` (749,484), `rnd`
      (38,037), `d` (3,393), `rne` (1,062), `rnz` (707), `rnl` (155). No `rn1`
      entries — it is a macro (`include/hack.h:1535`) and logs as its inner
      `rn2`.
- [x] Wrapper nesting verified: `rnz` emits its inner `rn2(1000)`, then `rne`'s
      inner draws, then `rne(4)`, then `rn2(2)`, then `rnz(...)` last. Our output
      reproduces that exactly.
- [ ] Display context (`rn2_on_display_rng`) — **deliberately deferred to M10.6**,
      see [NOTES.md](NOTES.md). It is not scored and needs a zero-initialised
      ISAAC64 context that `js/isaac64.js` has no constructor for.
- [ ] Lua context — M9a.

### 2.7 `o_init` — the first RNG consumer (DO THIS BEFORE 2.5)

Measurement put this ahead of `u_init` in the stream: every session's first PRNG
call is `randomize_gem_colors(o_init.c:89)`, and `o_init` accounts for 10,945
calls across 44/44 sessions. Until it matches, no later call can.

- [ ] Generate the object table: `tools/gen-objects.mjs` parsing
      `include/objects.h` (1,659 lines, 361+ macro entries) into
      `js/objects_data.js`. Reuse the `tools/gen-optlist.mjs` pattern — skip
      `#define` lines, and step over string literals when balancing parens.
- [ ] Port `src/o_init.c` `randomize_gem_colors` (o_init.c:85), `shuffle`
      (:113), `obj_shuffle_range` (:269), `shuffle_all` (:322), `init_objects`
      (:151), `init_oclass_probs` (:240)
- [ ] `shuffle()`'s draw count depends on `oc_name_known` and the class ranges,
      so the object table must be faithful before the counts can match
- [ ] `init_objects` ends with `objects[WAN_NOTHING].oc_dir = rn2(2) ? ...` —
      one draw, easy to forget, and it shifts everything after it

**Verify:** `node tools/diverge.mjs <session>` should move its first-divergence
index from 0 to roughly 200+ on *every* session at once. That is the signal this
milestone is working; the screen score will still be zero.

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
