# CLAUDE.md — rules for every agent working in this repo

This fork is an entry in the **Teleport Coding Challenge**: port NetHack 5.0
(250k lines of C, plus Lua) to plain JavaScript so that its terminal output is
byte-identical to the C original.

Read `docs/plan/README.md` before doing anything. It says what is done, what is
next, and which milestone file to open.

---

## The four non-negotiables

**1. Never overfit to the public sessions.**
The 44 sessions in `sessions/` are a progress tracker, not the target. Half the
final score comes from 44 held-out sessions we will never see, and harder ones
may be added. Any code that keys off a specific seed, a specific session name, a
recorded screen, or a hardcoded RNG sequence is a bug, even when it raises the
local score. If a change makes `score.sh` go up but would not help an unseen
game, revert it.

**2. No sloppy code, no placeholders, no cheating.**
Every function is a faithful port of a real C function, including its bugs and
quirks. No stubs that return plausible values. No `// TODO: approximate`. No
special cases to make one session pass. If a subsystem is not ported yet, it is
absent and the milestone says so — it is never faked.

**3. Faithful and complete beats clever.**
We win by porting the game, not by out-guessing the scorer. When the C does
something strange, port the strange thing.

**3a. Never port from memory. NetHack 5.0 is not NetHack 3.6.**
5.0 shipped May 2026 and is the first major version bump since 1989. Your
pretrained knowledge of NetHack is 3.4/3.6 knowledge and a large amount of it is
now wrong — unicorn horns, mind flayer amnesia, Valkyrie starting gear, spell
levels, the whole death-drop table, and dozens more. Code written from that
memory looks right, reviews clean, and diverges on the first RNG draw. Read the C.
`docs/plan/game-domain-primer.md` has the known 5.0 delta list.

**4. Architecture is scored.**
Phase 2 divides parity by `git diff phase1-tag HEAD -- 'js/**'`. A port that
mirrors the C file-for-file and function-for-function absorbs the 5.1 change with
a small diff. A tangled one does not. See `docs/plan/00-strategy.md`.

---

## The architecture rule (this is the whole design)

**`js/<name>.js` mirrors `nethack-c/upstream/src/<name>.c`, one to one.**

- Same file name. `src/mon.c` → `js/mon.js`. Windowport files go to
  `js/tty/<name>.js` (`win/tty/wintty.c` → `js/tty/wintty.js`).
- Same function names as the C, verbatim: `mkroom`, `dosearch`, `getobj`. Do not
  rename to JS style. A grep for a C symbol must find its JS twin.
- Same order within the file as the C.
- Every ported function carries a one-line provenance comment:
  `// src/mklev.c:412 makeniches()`
- Constants live in `js/const.js` and are named exactly as in `include/*.h`.
- Do not invent abstractions, helpers, or "cleaner" designs that have no C
  counterpart. Any structure not present in the C is a line we will have to
  re-diff in Phase 2.

Where the C uses a global (`gm.mons`, `u.uhp`), use the module-scoped equivalent
already established in `js/gstate.js` — do not thread new parameters through
signatures, because that changes call sites the C never changes.

---

## Frozen files — never edit

`js/isaac64.js`, `js/terminal.js`, `js/storage.js`.

The judge overlays these from the canonical copy on every scoring run. Editing
them only fools the local score. If a local test only passes with one of these
modified, the port is wrong, not the frozen file.

## `js/fastforward.js` is a trap, not a feature

It replays a hardcoded RNG list for `seed8000` only. It cannot pass a held-out
session. Entries are deleted one at a time as the real C function that produced
them gets ported. **Never add an entry to it.** The file is gone by the end of
milestone M5.

---

## Context budget — how to read a 250k-line codebase

Reading the C tree carelessly is the fastest way to burn a context window and
produce nothing. Rules:

- **Never `Read` a whole C file.** `src/options.c` alone is 10,225 lines. Use
  `grep -n` to find the function, then `Read` with `offset`/`limit` around it.
- **Never `cat` a session JSON.** `sessions/` is 51 MB. Query it with a
  `node -e` one-liner that prints only what you need, or use
  `tools/session-viewer/`.
- **Never read `js/const.js` end to end** (2,920 lines). Grep for the constant.
- **Delegate breadth.** If a question needs sweeping many files, spawn an
  `Explore` subagent and take its summary. Do not read the files yourself.
- **One milestone per session.** Do not "just also fix" an adjacent subsystem.
- Before compacting or handing off, update the status board in
  `docs/plan/README.md` so the next agent starts cold and still knows where it is.

---

## The loop for every change

1. Pick the next unchecked item in the current milestone file under `docs/plan/`.
2. Port it following `docs/plan/porting-protocol.md`.
3. Verify: `bash frozen/score.sh` (or a single session for speed —
   `node frozen/ps_test_runner.mjs sessions/<name>.session.json`).
4. RNG must not regress. Screens must not regress. If either drops, fix or revert
   before moving on.
5. Tick the item, commit, push.

## Write down what you learn

`docs/plan/NOTES.md` holds everything discovered by doing the work that is not
obvious from the contest docs: how the scorer really behaves, traps in the
tooling, measured baselines. **Add to it whenever you learn something
non-obvious**, and edit the existing entry rather than appending a duplicate when
one already covers the ground. Read it before debugging anything that smells
like infrastructure — three separate "the recorder is non-deterministic"
failures turned out to be documented one-line fixes.

The same applies to the milestone files: tick items as you finish them, and when
a milestone's scope turns out to be wrong, correct the file rather than working
around it silently.

Score is not the only gate. A change that raises the score while violating rule 1
or 2 is rejected.

---

## Commits

- Plain `git`, existing identity, no `--author` overrides.
- Message describes the repository change only.
- Never mention an AI assistant, model name, or tool in commit messages, PR
  titles, or PR bodies. Never add `Co-Authored-By` or "generated with" trailers.
- Push to `origin` (`rohitgandikota/teleport-contest`). Pushing *is* the
  submission; the judge cron picks up `main` within two hours.
