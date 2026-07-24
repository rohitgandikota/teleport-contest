# M9 — Lua and special levels

> **Plan correction, 2026-07-24, from measurement.** This milestone was
> originally scheduled after M6 on the assumption that Lua only builds *special*
> levels. That is wrong for NetHack 5.0. `tools/coverage-map.mjs` shows
> `src/sp_lev.c` executing in **44 of 44** public sessions (97,479 PRNG calls),
> and every session makes Lua-context calls — a minimum of 210 each, tagged
> `@ nh.rn2()` by recorder patch 004. Ordinary level generation goes through the
> Lua machinery in 5.0, largely via themed rooms (`themerms.lua`, `nhcore.lua`,
> `nhlib.lua`).
>
> **So this milestone splits.** M9a below is a prerequisite of M4 and must be
> done inside the M2-M5 block. M9b keeps its original position after M6.
>
> The good news: exactly **one** Lua binding draws randomness across the whole
> corpus — `nh.rn2`. The randomness surface is tiny; it is the script *execution
> order* that has to be right.

**Goal:** special levels (Oracle, Big Room, Minetown, Sokoban, the Quests,
Medusa, the Castle) generate identically to C, including their own PRNG context.

**Why this is its own milestone:** NetHack 5.0 builds special levels by executing
Lua scripts. `dat/` holds 131 `.lua` files; `src/nhlua.c` (3,138 lines) is the
binding layer; `src/sp_lev.c` (6,504 lines) is the level builder those scripts
drive. There is a **separate Lua PRNG context** (recorder patch 004 tags it), so
this cannot be approximated.

**C files in scope:** `src/sp_lev.c`, `src/nhlua.c`, `src/nhlobj.c`,
`src/nhlsel.c`, `src/selvar.c`, `src/mkmaze.c`, `src/quest.c`, `src/questpgr.c`,
`src/dungeon.c` (special level placement), plus `dat/*.lua` and `lib/lua/`.

---

## Decision D1 — RESOLVED 2026-07-24: build the interpreter

Chosen: **Option B, a small Lua interpreter in JS**, with `dat/*.lua` shipped as
embedded data. Rationale below; the scoping measurements that back it follow.

### Scoping results (measured, 2026-07-24)

**Corpus:** 131 `.lua` files, 17,223 lines.

**Language subset is small.** Across all 131 files: no `goto`, no coroutines, no
`setmetatable`/`getmetatable`, no `pcall`, no `tonumber`. Present are functions,
locals, `if`/`elseif`/`else`, numeric and generic `for`, a little `while` (2
files) and `repeat`/`until` (3 files), `break` (2 files), `and`/`or`/`not`, table
constructors, and string literals. Standard library use is thin: `math.*` (90
call sites, nearly all `math.random`), `table.*` (6), `string.*` (3).

**API surface is ~129 registered functions**, all in four namespaces:

| Namespace | Functions | Registered in |
|---|---:|---|
| `des.*` — level building | 36 | `src/sp_lev.c:6379` |
| `selection.*` | 33 | `src/nhlsel.c:981` |
| `nh.*` and `u.*` | 44 | `src/nhlua.c:1848`, `:2056` |
| `obj.*` | 16 | `src/nhlobj.c:629` |

By call volume the scripts are dominated by a handful: `des.monster` (2,111),
`des.object` (1,420), `des.trap` (794), `des.door` (603), `des.region` (364),
`selection.area` (356). A working subset is far smaller than 129.

**Conclusion:** the interpreter is bounded and tractable. It is a Lua subset with
no metatables, no coroutines, and a thin stdlib. Option B also wins on the
Phase 2 formula: a 5.1 change to a level script becomes a data change with a
near-zero `js/**` diff, whereas hand-porting leaves 131 translated files to
re-diff.

### The trap that makes this non-optional: two Lua randomness sources

`src/nhlua.c:1880-1881` registers `nh.rn2` and `nh.random`, which draw from
NetHack's core RNG and **are** written to the RNG log.

But `math.random` is different. `src/nhlua.c:2946` carries an upstream comment
saying `math.random` uses **Lua's own xoshiro256\*\* generator regardless of what
the rest of the game uses**, and that fixing it would mean changing `lmathlib.c`.
Those draws appear **nowhere in the RNG log**. Recorder patch 001 pins them by
calling `math.randomseed(NETHACK_SEED)` at state setup.

`math.random` is used 84 times across `dat/`, including **11 times in
`nhlib.lua` and 6 in `themerms.lua`** — both of which run during ordinary level
generation. So a port can reach 100% RNG parity and still generate the wrong
level, with no diagnostic anywhere pointing at why.

**This is solved.** The algorithm is fully specified in
`lib/lua-5.4.8/src/lmathlib.c`: `nextrand` (line 320), `setseed` (609),
`project` (549), `math_random` (574). A BigInt implementation in JS was verified
against the real interpreter and matches exactly, including the raw signed
64-bit value. Re-verify any implementation with:

```bash
./nethack-c/recorder/lib/lua-5.4.8/src/lua -e 'math.randomseed(8000)
for i=1,10 do io.write(math.random(100)," ") end print()'
# expected: 53 18 65 22 97 86 12 57 83 60
```

Seeding is `setseed(n1=seed, n2=0)`: state = `[seed, 0xff, 0, 0]`, then 16
discarded `nextrand` calls. Port it as `js/lua/lmathlib.js`, mirroring the C.

### Original options, for the record

Two ways to do it.

**Option A — hand-port each `.lua` file's effect into JS.** Faster to a first
quest screen. But it is 131 files of translated data, and if the 5.1 target
touches any level script, every one of those translations is a Phase 2 diff line.

**Option B — write a small Lua interpreter in JS and ship `dat/*.lua` as
embedded data.** Much more work up front. But a 5.1 change to a level script then
becomes a *data* change with a near-zero `js/**` diff, and the interpreter itself
never changes.

**Chosen: Option B**, on the strength of the Phase 2 formula (`parity / diff`)
and the scoping numbers above.

- [x] Enumerate every Lua construct used across `dat/*.lua`
- [x] Enumerate every C function registered into Lua by `src/sp_lev.c`,
      `src/nhlua.c`, `src/nhlobj.c`, `src/nhlsel.c`
- [x] Estimate interpreter scope from those two lists
- [x] Record the decision and its rationale in this file

**Sandbox constraint that forces a design detail either way:** the judge runs our
code with `--allow-fs-read` limited to our fork's tree, and
`nethack-c/upstream/` is a git submodule that may not be checked out in the
judge's environment. So the `.lua` sources must be **embedded into `js/` as
generated modules** by a `tools/` script, not read from disk at runtime.

---

## M9a — the Lua core (blocks M4, do it inside the M2-M5 block)

The minimum needed for an ordinary level to generate with the right RNG stream.

- [ ] The scoping step above (enumerate constructs and bindings) — do this first
      regardless of which option wins, because it sizes everything else
- [ ] The interpreter, or the hand-port, for just the scripts ordinary level
      generation touches: `nhcore.lua`, `nhlib.lua`, `themerms.lua`, and
      `dungeon.lua`
- [ ] `nh.rn2` wired to the Lua PRNG context, logging in the recorder's format
- [ ] The `sp_lev.c` entry points ordinary generation uses. Measured call
      volume across the corpus, in order: `create_room` (32,170),
      `get_location` (26,830), `dig_corridor` (23,570), `maze1xy` (5,900),
      `lspo_replace_terrain` (4,597), `check_room` (1,169), `build_room` (891),
      `find_montype` (713)
- [ ] `flip_level_rnd` — the 5.0 mirrored-level feature, and it fires on
      ordinary levels (128 calls in the corpus), so it cannot be deferred

**Verify:** the Lua-context call count for a short session matches C's exactly.
Every session should show at least 210 such calls; if ours shows zero, the Lua
layer is not running at all and M4 cannot be finished.

## M9b — special levels and quests (original position, after M6)

### 9.1 The Lua layer (assuming Option B)

- [ ] Lexer, parser, and evaluator for the Lua subset the scripts use
- [ ] `js/nhlua.js`, `js/nhlobj.js`, `js/nhlsel.js`, `js/selvar.js` — the binding
      layer, one to one with the C
- [ ] The Lua PRNG context wired to its own stream and logging in the format
      `docs/API.md` specifies
- [ ] `tools/gen-lua-data.mjs` emitting `dat/*.lua` as embedded JS modules

**Verify:** a script that runs every `dat/*.lua` file through the interpreter
without error, before any level is built with it.

### 9.2 The level builder

- [ ] `src/sp_lev.c`: map parsing, `create_room`, `create_monster`,
      `create_object`, `create_trap`, region and door placement, `des.*` API
- [ ] **5.0:** special levels can generate mirrored/flipped. This is a coordinate
      transform applied at build time and it changes everything downstream —
      port it early, not as a fixup
- [ ] `src/mkmaze.c` maze generation, used by Sokoban, Gehennom, and the Quest

### 9.3 Quests

- [ ] `src/quest.c` quest state machine
- [ ] `src/questpgr.c` quest text substitution — this is message-line output and
      therefore directly scored
- [ ] Role-specific quest data from `dat/<Role>-*.lua` (five files per role)

Sessions: `seed0373-barbarian-quest-tour` (124 steps),
`seed0367-priest-quest-tour` (324 steps).

### 9.4 Named special levels

Port in the order `coverage-map.md` says the sessions reach them. Likely order:
Oracle, Minetown (**5.0:** 1-in-7 chance of Orcish Town with no shops and no
priest), Sokoban, Big Room, then deeper ones.

`seed0360-wizard-world-tour` (833 steps) and `seed4500-knight-coverage` (1,814
steps) are the broad tests.

---

## Done when

- The two quest-tour sessions pass end to end
- Every special level a public session reaches builds with a matching RNG stream
  and a matching first frame
- The Lua PRNG stream matches C call for call
- No `.lua` file is read from disk at runtime

## Risk note

This is the milestone most likely to be underestimated. If M9 threatens to stall
the project, park it after 9.1's scoping step and take M10 first — the subsystem
sweeps score more points per hour. But do not skip the scoping step: knowing the
size of the Lua problem changes how the rest of the schedule should be spent.
