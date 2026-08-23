# gen-sessions — generate our own ground-truth sessions

Drive the recorder-patched C NetHack to produce new `.session.json`
files in the exact format the judge consumes. This gives the port an
unlimited **private test set** for features the 44 public sessions
never exercise. Everything here runs against the same recorder build
and driver that bit-exactly reproduces the public corpus, so a
generated session is trustworthy ground truth by construction.

**These sessions are supplements for debugging coverage. They do not
belong in `sessions/` and are not part of the scored corpus.**

## Prerequisites

Build the recorder once (clang, make, bison, flex):

```bash
git submodule update --init nethack-c/upstream
bash nethack-c/build-recorder.sh
```

That produces `nethack-c/recorder/install/games/lib/nethackdir/nethack`
plus data files and a working `sysconf` (see `docs/plan/NOTES.md`,
"The recorder" — the sysconf step and `WIZARDS=*` are load-bearing).

## Generate

```bash
node tools/gen-sessions/record.mjs --all                     # every recipe
node tools/gen-sessions/record.mjs recipes/fountain-quaff.json
```

Output lands in `tools/gen-sessions/generated/<name>.session.json`.
The driver wraps `scripts/record-session.mjs` (the same one
`scripts/verify-rerecord.mjs` uses): it spawns the patched binary with
`NETHACK_SEED` / `NETHACK_FIXED_DATETIME`, feeds keys one at a time
against the OSC 7777 sync markers, collects the per-key RNG log delta,
screen, and cursor, and writes clean v5 JSON.

A recipe names only the inputs:

```json
{
  "name": "fountain-quaff",
  "description": "what this covers",
  "segments": [
    { "seed": 6002, "datetime": "20000110090000",
      "nethackrc": "OPTIONS=...\n", "moves": "..." }
  ]
}
```

`moves` is the raw key string, one char per key, exactly as in
`sessions/*.session.json` (JSON escapes: `\r` Enter, `\u001b` ESC,
`\u0004` ^D kick, `\u0017` ^W wish, `\u0006` ^F map, `\u0007` ^G
create monster, `\u0018` ^X attributes). Multi-segment
recipes work; state carries between segments through the install dir,
which is how the save/restore pair restores its save file.

## Inspect

```bash
node tools/gen-sessions/render.mjs generated/<name>.session.json msgs   # key + message per step
node tools/gen-sessions/render.mjs generated/<name>.session.json 27     # full screen of step 27
node tools/gen-sessions/render.mjs generated/<name>.session.json last
```

Decodes the recorded ANSI (SGR, `\x1b[NC` runs, DEC line-drawing) into
plain 24x80 text with the cursor marked.

## Verification (why these are trustworthy)

All checks performed 2026-08-23 against the recorder built by
`build-recorder.sh` (binary of Jul 24):

1. **Public-corpus acceptance.** `sessions/seed0077-rogue-chargen`
   re-recorded from only its recipe fields (seed/datetime/nethackrc/
   moves, steps stripped) reproduces the canonical file exactly:
   33/33 steps, 3,242 RNG entries, every screen, cursor and key
   byte-identical, zero normalization needed (the pinned
   `SOURCE_DATE_EPOCH` even makes the build-date banner match).
   `node scripts/verify-rerecord.mjs` remains the whole-corpus
   version of this check (44/44 pass per `docs/plan/NOTES.md`).
2. **Determinism.** Every recipe here was recorded twice; all 11
   output files are byte-identical between runs.
3. **Judge-format compatibility.** The generated files load and score
   through the frozen `frozen/ps_test_runner.mjs` unmodified
   (`SESSION_REPLAY_TIMEOUT_MS=120000 node frozen/ps_test_runner.mjs
   tools/gen-sessions/generated/<name>.session.json`).

One knowing difference from canonical files: the recorder driver does
not emit the per-step `depth` field. Nothing consumes it — the frozen
loader and runner never read `depth` (`verify-rerecord.mjs` ignores it
too), so generated sessions are drop-in equivalent.

## The starter batch

Eleven sessions, seeds 6001-6013 and 6500/6501, all distinct from the
public corpus. Playmode is normal except where wizard mode is the
setup tool (wishes, ^G create monster). Coverage per the recipe
`description` fields; summary:

| session | mode | keys | covers |
|---|---|---|---|
| ranger-chargen | normal | 90 | full chargen menus (role/race/gender/align), bow fire + fireassist, quiver pickup, floor-food multi-turn eat, count-prefix search |
| barb-chargen | normal | 96 | chaotic-only chargen path, arrow trap, pickup menu multi-select, locked door kicked to pieces, rotten food confusion |
| fountain-quaff | normal | 85 | five fountain quaff effects incl. monster detection browse + fountain dry-up, #dip (rust + gem), dip refusal |
| kick-monster | debug | 78 | ^G creates, monster kicks (incl. 3-kick bugbear + level up), object kicks, pet-attack confirm, empty-space kick |
| scroll-reading | debug | 109 | ^W wish getlin strings, blessed identify chain, controlled teleport w/ getpos cursor, blank scroll |
| armor-wear-remove | debug | 111 | 5-turn plate donning under attack, ring-finger prompt, auto-remove, multi-turn take-off, floor armor worn |
| wand-striking-door | debug | 68 | striking zaps crash two doors open (adjacent + through-room ray), failed close, unknown potion quaff |
| engrave-elbereth | debug | 63 | dust Elbereth + degradation on read/walk, wand-of-fire burn engraving, engrave-identifies-wand, graffiti |
| monk-martial-arts | normal | 103 | martial arts, monk door kick, magic trap blind+deaf, blind floor-feel, unseen-attacker fight, rest cure |
| pray-low-hp | debug | 74 | sickness to HP 4, #pray autocomplete, Force-gods prompt, god anger x2, lightning + disintegration, Die? refusals |
| save-restore-pair | normal | 14+19 | S-save ("Be seeing you..."), restore under new seed/datetime, new-moon warning, two segments |

Port score snapshot at generation time (commit f01bf3a), for
orientation — these numbers are what makes the set useful, each FAIL
is an unported area the public corpus never reached:

```
armor-wear-remove   RNG  503/3762  screens  0/112   (wish machinery absent)
barb-chargen        RNG 2615/4591  screens 27/97
engrave-elbereth    RNG 3266/3508  screens 35/64
fountain-quaff      RNG 2523/3290  screens 27/86
kick-monster        RNG  642/3617  screens  0/79    (^G / kick absent)
monk-martial-arts   RNG 2631/3871  screens 30/104
pray-low-hp         RNG 2873/3436  screens 28/75
ranger-chargen      RNG 3006/5033  screens 27/91
save-restore-pair   RNG 3242/3242  screens 28/35    (RNG perfect; save/restore screens differ)
scroll-reading      RNG  322/2785  screens  0/110   (wish machinery absent)
wand-striking-door  RNG 3137/3612  screens 34/69
```

## Authoring new recipes — what the iteration taught

- **One char = one key = one step.** A session records
  `moves.length + 1` steps; fewer means the game ended early (death,
  save) — the driver prints a warning, which for a deliberate death
  session is expected.
- **`--More--` eats every key except space (and ESC).** Multi-message
  turns (pet fights, occupations) silently swallow queued commands.
  Space dismisses exactly one `--More--`; a stray space in the main
  loop records "Unknown command ' '" (harmless, real C behavior —
  the canonical corpus has swallowed keys too). ESC clears the whole
  message queue in one key but also cancels a pending getlin — do not
  use it right before typed input you want kept.
- **Iterate by extension.** Same seed + rc + key prefix always replays
  identically, so build a session by appending a probe batch, rendering
  the tail (`render.mjs ... msgs`), and adjusting. Recording is
  sub-second.
- **Debug-twin recon does not work.** A `playmode:debug` twin of a
  normal-mode seed generates a different map and different attributes
  (wizard mode changes early draws), so you cannot scout a normal
  game's level with `^F` in a debug copy. Scout by walking, in the
  session itself.
- **Count prefixes** (`10s`) work with default bindings and are the
  cheapest way to burn turns (monster movement draws) per key.
- **Useful wizard-mode setup keys:** `^W` wish (getlin), `^G` create
  monster (getlin), `^F` map, `^T` / teleport scroll → getpos cursor
  (hjkl + `.`), and at HP 0 the `Die? [yn]` prompt — answering `n`
  survives with full heal, something no public session exercises.
- The tty pipeline maps `\r` to `\n` on send (tmux ICRNL parity);
  write Enter as `\r` in recipes like the canonical sessions do.

## Cautions

- Generated sessions are **private test data**. Keep them out of
  `sessions/` and out of the scorer's corpus; the judge overlays its
  own canonical set, and rule 1 of `CLAUDE.md` (never overfit) applies
  to any fixed corpus, this one included.
- Re-record after any recorder rebuild before trusting old outputs:
  `node scripts/verify-rerecord.mjs seed0077` is the quick canary.
