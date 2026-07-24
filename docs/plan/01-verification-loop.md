# M1 — Verification loop and dev tooling

**Goal:** before porting a single game function, be able to answer "where exactly
did we diverge from C, and which C line caused it?" in under a minute.

**Why first:** the rest of the project is thousands of small ports, each verified
against a 250k-line reference. Without a sharp divergence-localisation tool, each
one costs an hour of guesswork. With it, most cost minutes. This milestone pays
for itself several times over before M2 ends.

**Scope note:** everything built here lives in `tools/` or `scripts/`, **not in
`js/`**, so none of it counts toward the Phase 2 diff. Keep it that way.

---

## Prerequisites (done 2026-07-24)

- [x] Category set to `agentic` in `.teleport/repo-metadata.json`
- [x] Submodule `nethack-c/upstream` initialised (NetHack 5.0.0_Release, 31 MB)
- [x] Recorder built at `nethack-c/recorder/src/nethack` and installed to
      `nethack-c/recorder/install/games/lib/nethackdir/`

Sanity check the recorder any time:

```bash
NETHACK_SEED=8000 NETHACK_FIXED_DATETIME=20260502143000 NETHACK_RNGLOG=/tmp/rng.log \
  nethack-c/recorder/install/games/lib/nethackdir/nethack
```

---

## Items

### 1.1 Confirm the recorder reproduces a shipped session bit-for-bit — DONE

- [x] Re-record `seed8000-tourist-starter` and diff against the shipped file
- [x] Run the whole corpus through `node scripts/verify-rerecord.mjs`

**Result: 44/44 pass.** The oracle is verified end to end, including the long
sessions, the debug-mode sessions, and every multi-segment session.

Three defects had to be fixed to get there; all are written up in
[NOTES.md](NOTES.md) under "The recorder". In short: `make install` never
creates the `sysconf` file the binary requires, the stock sysconf template
breaks on macOS and silently demotes debug-mode sessions to normal play, and an
abandoned in-progress game leaks its lock file into the next segment. Fixes live
in `nethack-c/build-recorder.sh` (step 6) and
`scripts/record-session.mjs` (`clearAbandonedGame`).

**If you ever see a re-record fail, re-read that NOTES.md section first.** All
three failures presented as "the recorder is non-deterministic", which is not
what any of them were.

### 1.2 Divergence localiser — DONE

`tools/diverge.mjs` is built and working. Given a session name, it runs our port,
compares the RNG log positionally, and prints a window around the first mismatch
**with the C `@ caller(file:line)` annotations intact**:

```
$ node tools/diverge.mjs seed0007-rogue-snake-swamp
RNG diverges at call 392 of 3706

  389  rn2(20)=13   @ makemon(makemon.c:1523)   ours rn2(20)=13   ok
  390  rn2(3)=1     @ makemon(makemon.c:1544)   ours rn2(3)=1     ok
  391  rn2(6)=4     @ m_initweap(makemon.c:412) ours rn2(6)=4     ok
  392  rn2(4)=2     @ m_initweap(makemon.c:431) ours rnd(6)=3     MISMATCH
  393  rn2(8)=0     @ m_initweap(makemon.c:437) ours —

Next C function to port: m_initweap (src/makemon.c:431)
```

The last line is the whole point: the tool names the next thing to port.

- [x] Reads one session file at a time, never the whole 51 MB corpus
- [x] Configurable window (`-w N`, default 8 either side)
- [x] Prints the C caller annotation for the first mismatch
- [x] Handles the "ours ran out of calls" and "ours has extra calls" cases
- [x] Works on multi-segment sessions, reporting `seg N, step M (key "x")`
- [x] `--all` mode: one summary line per session, for picking the next target
- [x] `--screens`: also reports the first screen miss and the exact
      `tools/screendiff.mjs` command to inspect it

**Verified** against the untouched skeleton on `seed8000-tourist-starter`: it
reports divergence at RNG call 3103 and names `m_move (src/monmove.c:1963)`.
Baseline numbers are in [NOTES.md](NOTES.md).

### 1.3 Screen differ — DONE

`tools/screendiff.mjs`. For a session and a step index, decodes both frames with
`frozen/screen-decode.mjs` — the same decoder and per-cell comparator the scorer
uses — and shows what differs.

- [x] Cell-level diff list: row, col, kind, expected vs got, with colour and
      attribute decoded into words
- [x] Stacked visual render of both grids, with a gutter marking the cursor row
      and every row that has differences
- [x] `--first` to jump to the first mismatching step
- [x] Mirrors the scorer's pre-decode normalisation (version banner, timestamps)
      so it never reports a difference the scorer forgives

Usage: `node tools/screendiff.mjs <session> <step|--first>`

### 1.4 Scoreboard snapshot — DONE

`tools/scoreboard.mjs` runs the scorer, records the result, and reports what
changed since the previous run.

- [x] Appends a row per run to `docs/plan/score-history.tsv`
- [x] Per-session screen and RNG deltas against the last snapshot
- [x] Regressions listed separately, loudly, and exit status 1
- [x] `--fast` (the eight short sessions), `--private` (M12 corpus), `--no-save`

### 1.5 Coverage map — DONE

`tools/coverage-map.mjs` generates [coverage-map.md](coverage-map.md) from the C
caller annotations in the recordings.

- [x] Generated by script, never hand-edited
- [x] Per session: role, segments, steps, calls, and its top five C files
- [x] Aggregate port priority: which C files the most sessions execute
- [x] Sections for role coverage and for the 13 debug-mode sessions

**This changed the plan.** The measured priority order put `src/sp_lev.c` in
44/44 sessions, and every session makes Lua-context PRNG calls. M9 was split, and
M9a is now a prerequisite of M4. See [NOTES.md](NOTES.md), "Lua is on the
critical path".

Regenerate after any change to the corpus, and run it over `sessions-private/`
in M12 to find blind spots.

### 1.6 Wire CI feedback

- [x] `.github/workflows/score.yml` runs on push to `main` and scores all 44
      public sessions. Note it overlays only two of the three frozen files —
      see [NOTES.md](NOTES.md).
- [ ] Confirm a push to `origin/main` is visible on the leaderboard within one
      cron cycle (two hours)

**Verify:** our fork appears at [mazesofmenace.ai](https://mazesofmenace.ai/leaderboard/).

---

## Done when

- [x] Re-recording reproduces shipped sessions exactly — 44/44
- [x] `tools/diverge.mjs` names the next C function to port for any failing
      session
- [x] `tools/screendiff.mjs` localises a screen mismatch to specific cells
- [x] `docs/plan/coverage-map.md` exists, and the milestone order has been
      revised to match what it measured
- [x] Nothing was added to `js/`

**Baseline recorded:** 0/11,405 screens, 25,429/792,838 RNG positions, 0/44
sessions passing.
