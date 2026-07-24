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

### 1.3 Screen differ

Build `tools/screendiff.mjs`. For a session and a step index, decode both frames
with `frozen/screen-decode.mjs` and print a 24x80 cell-level diff: expected
character/colour/attr vs ours, only for cells that differ, plus a side-by-side
render of both frames.

- [ ] Cell-level diff list (row, col, expected, got)
- [ ] Side-by-side visual render for eyeballing
- [ ] `--first` flag to jump to the first mismatching step of the session

**Verify:** run against a deliberately corrupted frame; it reports exactly the
corrupted cells.

### 1.4 Scoreboard snapshot

Build `tools/scoreboard.mjs`: run `frozen/score.sh`, parse its JSON, and write a
timestamped row to `docs/plan/score-history.tsv` (session, steps matched, steps
total, RNG matched, RNG total). Also print the delta against the previous row.

This is how we detect regressions across a long working session, and how the
status board gets its numbers.

- [ ] Appends a row per run
- [ ] Prints per-session deltas, flagging any regression loudly
- [ ] `--fast` mode that runs only the eight short sessions

**Verify:** two consecutive runs produce two rows and a zero delta.

### 1.5 Coverage map

Produce `docs/plan/coverage-map.md`: one row per public session with its step
count, segment count, role, and the subsystems its keystrokes exercise (derived
from the recorded key sequence and the C caller annotations in its RNG log — the
annotations name the C files C actually executed, which is a direct read of which
subsystems the session touches).

This is the document that tells later milestones which sessions to test against,
and it is the best available proxy for what the held-out set will exercise.

- [ ] Table generated by a script under `tools/`, not by hand
- [ ] Includes, per session, the distinct C source files appearing in its RNG log
- [ ] Aggregate section: which C files appear in the most sessions (this is the
      port priority order, measured rather than guessed)

**Verify:** the aggregate list's top entries are the files M2-M5 already plan to
port. If they are not, the plan order is wrong and should be revised.

### 1.6 Wire CI feedback

- [ ] Confirm `.github/workflows/score.yml` runs on push and reports the public
      score
- [ ] Confirm a push to `origin/main` is visible on the leaderboard within one
      cron cycle (two hours)

**Verify:** our fork appears at [mazesofmenace.ai](https://mazesofmenace.ai/leaderboard/).

---

## Done when

- Re-recording reproduces shipped sessions exactly
- `tools/diverge.mjs` names the next C function to port for any failing session
- `tools/screendiff.mjs` localises a screen mismatch to specific cells
- `docs/plan/coverage-map.md` exists and its measured priority order agrees with
  the milestone order (or the milestone order has been revised to match)
- Nothing was added to `js/`
