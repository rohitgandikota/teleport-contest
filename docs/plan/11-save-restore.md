# M11 — Save, restore, multi-segment, and bones

**Goal:** state survives across segments of a session exactly as C's does.

**Why it is separate:** 12 of the 44 public sessions are multi-segment (56
segments across 44 sessions), and one of them —
`seed0030-ten-diverse-deaths` — is ten segments and 1,953 steps, the largest
single session in the corpus. Multi-segment sessions are also explicitly named in
`docs/PHASES.md` as a target for the harder held-out sessions being added over the
summer, so this is generalization work, not just corpus work.

**C files in scope:** `src/save.c`, `src/restore.c`, `src/bones.c`,
`src/topten.c`, `src/end.c`, `src/files.c`, `src/sfstruct.c`, `src/sfbase.c`,
`src/sfprocs.h` consumers, `src/dungeon.c` (level save and restore on transit).

**Frozen dependency:** all persistence goes through `js/storage.js`, which is
frozen. Use its `vfsReadFile` / `vfsWriteFile` / `vfsDeleteFile` / `vfsListFiles`
API. The harness passes the same storage instance to every segment of a session
and a fresh one between sessions.

---

## Items

The bones pass adds 91 native game segments with complete terminal, cursor,
RNG and animation parity. It ports cemetery records, ghost/statue/undead
remains, object reset, fruits, shared room identity, timer/light/region and
engraving persistence, and the corresponding startup/travel call sites.
Native shared-storage checks and 89 constructed groups pass. All sixteen
deliberate faults are detected. See [bones-audit.md](bones-audit.md) for exact
source and coverage limits. The save/restore parents remain partial.

The branch follow-up repairs restored stairs and portals against the new
branch endpoints before timer/light relinking. Four native Mines return paths
and two Quest eligibility segments pass, with twelve constructed controls and
seven detected faults. Portal repair has constructed evidence only. See
[bones-links-audit.md](bones-links-audit.md).

### 11.1 Understand the segment contract first

From `docs/API.md`: `runSegment(input, prevGame)` is called once per segment. Each
call's `getScreens()`, `getRngLog()`, and `getCursors()` cover **only that
segment** — the harness concatenates. `prevGame` is the previous segment's return
value within a session. Persistent C-side state (save file, bones, record) lives
in `storage`; nothing else needs to cross the boundary.

- [ ] Write down, in this file, exactly what our port carries in `prevGame`
      versus what it round-trips through `storage`. Anything carried in memory
      that C would have written to a file is a bug waiting for the held-out set.

### 11.2 Save file format

- [x] September level-knowledge pass: saved VISITED flags, checkpoint behavior,
      annotation reminders, keep/delete choices, startup debug override and
      deferred explore confirmation. Ten new native save segments and shared
      storage checks pass. See [level-knowledge-audit.md](level-knowledge-audit.md).

We are not required to match C's save file bytes — only its behaviour. But the
save/restore cycle must reconstruct state exactly enough that the RNG stream and
screens after a restore match.

- [ ] Port `src/save.c` and `src/restore.c` structurally, so that what is saved
      and what is restored matches C field for field
- [x] Restore uses the new process's RNG seed. It reruns role initialization
      and Lua initialization, while saved quest genders overwrite the temporary
      draws. Native restore traces and both-gender state controls check this.
- [ ] Level files: NetHack saves each visited level separately and reloads on
      revisit. Port that, since it affects monster and object state on return

**Verify:** `seed0013-friday13-save-then-fullmoon-restore` (99 steps, 2 segments).
This session also changes the moon phase across the restore, so it checks that
M2's calendar handling is re-derived from the new segment's datetime rather than
carried over.

### 11.3 Death, tombstone, and the record file

- [ ] `src/end.c` `done`, `done2`, the death sequence and its prompts
- [ ] `src/rip.c` the tombstone screen — pure screen output, drawn once per death
- [ ] `src/topten.c` the scoreboard, written to and read from the VFS, and
      displayed after death

**Verify:** `seed0030-ten-diverse-deaths` — ten deaths in ten segments, each
ending in a tombstone and a topten listing that includes the previous deaths.
This session is worth 1,953 steps and is unusually sensitive: the topten file
accumulates across segments, so segment 7's screen depends on segments 1-6.

### 11.4 Bones

- [x] September bones pass: 29 native writes and 30 load boundaries verify
      cemetery identity, remains, inventory ownership, room and monster bindings,
      timer/light owners, fruits and file retention/deletion. Sixteen official
      recipes and exact C repeats pass. See [bones-audit.md](bones-audit.md).
- [ ] Finish native decline/replacement and multiple-death controls, object
      disposal, shop damage, worm tails, exclusions, stasis clocks, native
      portal controls and the remaining restore ordering differences.

- [ ] `src/bones.c`: saving a bones file on death, loading it in a later game,
      the ghost and the grave, and the "you feel like you have been here before"
      handling
- [ ] Bones files persist through the VFS across segments within a session

### 11.5 Chained new games

- [ ] `#quit` followed by a fresh game in the next segment
- [ ] A fresh chargen inside segment N with the RNG re-seeded per the segment's
      own `seed` input

**Verify:** `seed5006-tourist-stress-disaster` (249 steps, 2 segments) and
`seed5002-wizard-coverage-pair` (410 steps, 2 segments).

---

## Done when

- All 12 multi-segment public sessions pass end to end
- A save, a restore, a death with bones, and a chained new game each work
  without any state leaking through a channel other than `storage`
- Nothing in `js/` writes to the real filesystem
