# M12 — Generalization hardening

**Goal:** score as well on the 44 held-out sessions as on the 44 public ones.

**This milestone runs continuously from M6 onward.** It is not a phase at the end.
Schedule a hardening pass after every two or three milestones.

**The premise:** a faithful port scores comparably on both pools. A port that
absorbed public-session detail scores well locally and falls off a cliff on the
held-out set. Half the available points, and the entire Phase 2 qualification,
sit on the side we cannot measure.

---

## September source-guided continuation

The bones branch follow-up adds ten native game segments and twelve
constructed state groups. All seven deliberate faults fail state assertions;
four survive native output. See [bones-links-audit.md](bones-links-audit.md).
The earlier [bones audit](bones-audit.md) retains its distinct gaps.

The full regression passes 605/605 fixtures, matching 781,705 screens/cursors
and 14,592,028 RNG calls. C execution adds eight outcomes and no entered
records, reaching 57,372/108,268 and 4,412/5,491. getlev's own coverage stays
86/120 despite the new cross-seed case exposing a wrong destination. Coverage
alone cannot establish state correctness across different game layouts.

The full port remains the active goal. The 21 existing public animation
mismatches and known fixed-date fuzz difference remain explicit. A preserved
seed-40 Minetown candidate has a separate map shift before loading bones and
is the next investigation. Native portal repair, restore ordering, object
disposal, shop damage and broader lifecycle controls remain open.

## 12.1 The overfit audit

Run this as a checklist over `js/` after every milestone.

- [ ] `grep -rn "seed" js/` — no seed value appears anywhere
- [ ] `grep -rniE "seed[0-9]{4}|session" js/` — no session name appears anywhere
- [ ] No table of RNG values, screens, or expected outputs
- [ ] No branch conditioned on the number of steps, the datetime, or the role in
      a way the C does not have
- [ ] No constant that was tuned until a local session passed — every constant
      traces to a specific line in the C
- [ ] `js/fastforward.js` does not exist

Anything found here is deleted, not adjusted.

## 12.2 The reverse test — sessions we record ourselves

This is the only direct measurement of generalization available to us, and it is
the highest-value tool in the project after `tools/diverge.mjs`.

The recorder at `nethack-c/recorder/` produces ground truth for **any** key
sequence, at any seed, with any rc file. So we can manufacture our own held-out
set.

- [ ] Build `tools/record-batch.mjs`: given a list of (seed, datetime, rc, keys)
      recipes, record them all into `sessions-private/` (gitignored, so it never
      pollutes the public corpus or the scored set)
- [ ] Generate recipes that deliberately go where the public sessions do not:
      seeds outside the public set, every role and race combination, deeper
      levels, longer games, unusual rc options, key sequences that exercise
      rarely used commands
- [ ] Score against `sessions-private/` alongside `sessions/`
- [ ] **The headline number to watch is the gap.** If private scores badly while
      public scores well, we have overfit and the audit in 12.1 missed it

Practical recipe sources: random walks over the command set, seeded replays of
the public sessions' key sequences at *different* seeds (same inputs, different
dungeon — an excellent generalization probe), and hand-written scripts targeting
one subsystem each.

- [ ] Add `sessions-private/` to `.gitignore`

## 12.3 Coverage measurement

- [ ] From the C caller annotations across all recorded sessions (public and
      private), compute which C source files we have *never* seen executed
- [ ] Those files are the blind spots the held-out set will find. Rank them by
      size and by how central they are, and feed the top entries back into M10
- [ ] Re-run after each hardening pass

## 12.4 Robustness

The held-out set will reach states the public set never does. The port must
degrade honestly rather than crash: a thrown exception marks the whole session
errored and forfeits every remaining step in it.

- [ ] No unhandled exception on any private session
- [ ] Unimplemented paths fail loudly in development and are *absent* rather than
      faked in the shipped code
- [ ] Session wall-clock stays well under the judge's 900-second limit
- [ ] `bash frozen/play.sh` stays under 1 ms per move

## 12.5 Phase 2 readiness

The Phase 1 freeze tag is the Phase 2 diff baseline, so the state of the code at
the deadline sets the Phase 2 ceiling. Before the Nov 29, 2026 deadline:

- [ ] Every file in `js/` maps to a C file, and the mapping is documented
- [ ] Every function carries its `// src/<file>.c:<line> <name>()` provenance
- [ ] No dead code, no orphaned helper, no abandoned experiment
- [ ] Data tables are *generated* by `tools/` scripts, so 5.1 regenerates them
      instead of requiring hand edits
- [ ] `dat/*.lua` is embedded data, not translated logic (see M9 decision D1)
- [ ] A short `docs/ARCHITECTURE.md` explaining the one-to-one mapping, so a 5.1
      retarget can be driven straight off a C diff
- [ ] Write the method writeup (the Best Method award is judged separately from
      the parity ranking, and the leaderboard spotlights writeups throughout)

## 12.6 Escalation watch

`docs/PHASES.md` says harder held-out sessions may be added over the summer:
deeper dungeon levels, more subsystems, more multi-segment save/restore chains,
rarer monsters and items. Public sessions are not changed by escalation.

- [ ] Bias private recording toward exactly those four axes
- [ ] Depth in particular: the public corpus is early-game heavy. Record private
      sessions that descend well past where any public session goes

---

## Done when

This milestone never closes before the deadline. Its health check is one number:
the gap between our public score and our private score. Keep it near zero.
