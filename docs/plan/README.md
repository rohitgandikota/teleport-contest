# Port plan — index and status board

**Read [STATUS.md](STATUS.md) first.** It carries the live handoff state: what is
in progress, what is half-finished, where the plan has already been corrected,
and the exact next action. This file is the map; STATUS.md is the "you are here".

Then read the one milestone file you are working on. Do not read the others.

Ground rules are in `/CLAUDE.md`. Read that first if you have not.

---

## Current focus, 2026-11-23

Continue the faithful port with readable C-aligned code and prompt verified
pushes. The latest official snapshot checked, November 23 at 20:18 UTC, has
23,595 of 24,531 combined screens, 7th agentic and 11th overall. Our scoring
run at 19:33 UTC predates the latest checkpoint. Public remains 44/44;
that snapshot has 936 unmatched held-out
screens. Local verification does not establish a newer held-out score.

The latest verification passes 702/702 fixtures: 810,582 boundary
screens/cursors, 16,217,844 scored RNG positions and 30,712 animation frames.
Both shards finish without failures or timeouts under the standard 45-second
worker limit. All 279 runtime hashes stayed fixed throughout.
The earlier potion changes also pass strict full-stream and per-input RNG
checks on 117 fixtures, all 39,942 boundaries and 1,718,440 calls. The complete
strict 677-fixture audit and all 213 animation-bearing fixtures passed at the
preceding floor checkpoint. Current-corpus parity is not completeness.

Floor objects retain independent global and per-square order. Placement,
splitting, replacement, extraction, restacking, level flips and restore follow
C's chain contracts. Nine extracted C functions support 992 state checks.
New native cases also cover blindness-potion discovery and hidden
hallucination expiry. The latter repair restores timeout limits and mimicry
cleanup; 76 hallucination/blindness state controls pass.

Mines/Sokoban prize acquisition now also passes three native cases and 29
state controls, with all 142 selected regressions exact. Invocation-object
achievements pass five native cases, 23 state controls and 155 selected
regressions. Corpse ice timers now follow placement, extraction and full
restore ordering, passing five new native segments and 19 state controls.
Two repaired test gates also pass all 458 replay segments and 145 constructed
groups, with their 204 assertions unchanged. Sink drops now match 45 native
cases, 2,892 screens/cursors and 124,743 RNG calls. All 50 sink state controls
and 14 color controls pass; colors now respect hallucination resistance.
Full-save timer order now also matches three native egg segments and passes
29 state controls plus 127 selected regressions. The maintained corpus has
684 fixtures at that checkpoint. The ice repair adds one fixture,
with 305 exact native boundaries and 57 passing state controls. The complete
685-fixture regression passes all 804,428 screens/cursors, 15,971,119 scored
RNG positions and 30,572 animations. Artifact hallucination resistance and
ESP refresh order now also match five new native cases. All 89 artifact/color
controls pass. Four more native sink cases bring the complete corpus to
687 fixtures, with 805,116 exact screens/cursors, 15,995,620 scored RNG positions
and 30,573 animations. Floor and container placement now also preserve held
effects and billing order in nine new native cases and 39 state controls.
The complete 689-fixture corpus matches all 805,930 screens/cursors,
16,027,277 scored RNG positions and 30,597 animations. Four timer consumers
now use the numeric melt identifier. Their three native cases, 14 state
controls and all 80 selected regressions pass, including every public fixture.
Four weapon-enchantment corrections now pass seven new native cases and
eight source controls. Raised drawbridge predicates now match three native
Castle cases and 40 source controls. Invoked-artifact loss now preserves
property removal, cooldown and completion order. Nine native cases, 65 new
state controls and 128 retained controls pass. Object naming now follows C's
restrictions, canonical spelling, scuff retry and safe prompts. Thirteen native
cases and 20 state controls pass. The native C coverage union reaches all
18/18 direct do_oname outcomes. Six more status decisions now use C's active
predicates; nine native cases and ten state controls pass. Vampire selection,
hiding vision and protected mimic creation now pass eight native cases and
74 source controls. This checkpoint also shares the existing special-item
helper and removes an obsolete function-history comment. Next: stun
duration/lifetime, complete restore ownership/phases and hideunder feedback. The
Linux/NFS branch collector is pushed
and passes signal canaries plus exact save/restore, artifact and natural-exit
pilots. The Linux census at e4504071 now covers all 678 original inputs:
603 canonical matches and 75 independently recorded ordinary Linux controls.
Adding sixteen newer raw inputs and two independent Linux controls, 110
native segments in total, gives a validated union entering 4,506/5,492
functions and observing 58,710/107,260 direct C branch outcomes.
All 696 credited input hashes, eleven build manifests and branch layouts were
checked before merging. Original platform/output rejections
remain rejected; no output was normalized. The two new sink fixtures separately
match Linux C exactly; their validated union covers all 94/94 direct dosinkring
outcomes in 49 cases. The teleport and polymorph helpers still have measured
gaps. Large
profiles and recordings remain on NFS. See [STATUS.md](STATUS.md) for evidence
and next actions. Historical milestone rows below are not a current audit.

## Previous focus, 2026-09-06

The active goal is the complete faithful C/Lua port, with byte-identical output
and persistent gameplay state. Continue source review, measured C branches,
independent oracles, implementation and regression checks until that goal is
met. Current corpus success is not the stopping criterion.

The latest pass fixes Minetown region classification and adds C's short shop
annotations. Twenty-five native games cover seven town variants and four flip
orientations. All 44 public and 562 supplemental fixtures pass, matching
786,130 screens/cursors and 14,728,376 RNG calls. The C union reaches
57,389/108,268 direct outcomes and 4,412/5,491 entered records. The state gate
checks 25 native replays, 50 C stair positions and 39 constructed groups.
All six deliberate faults fail state assertions; four survive native output.
The assertion ledger passes 3,802/3,802 cases.

See [STATUS.md](STATUS.md) for the current action,
[minetown-map-audit.md](minetown-map-audit.md) for this source review and
[gameplay-gap-audit.md](gameplay-gap-audit.md) for measurement limits.
The September 6 leaderboard snapshot reports 81.48% held-out screens and
rank 1 among agentic entries. Its score predates today's pushes; the local
suite does not establish a newer held-out score. The user explicitly
authorized prompt pushes of every verified commit. The full-port goal
continues through remaining map bounds, region creation, flip state,
restore, inventory, spell, monster and Lua paths.

## Previous focus, 2026-09-03

Continue from pushed checkpoint `a80b4d7`. The protected starting baseline is
`85203f6` on `codex/last-working-heldout-7959-2026-09-03`. The latest published
score is 11,405 public plus 8,498 held-out screens, with 44 plus 16 passing
sessions. The live measurements and failures are in
[contest-dashboard.md](contest-dashboard.md). The judge run predates
`97bcf38`, `1c20413`, `5593394`, and `a80b4d7`, so their hidden effect is still
unknown.

Work is in M12 differential hardening across the already ported subsystems.
Prioritize a reproduced runtime error or first C divergence, add a C oracle or
source-state check, then run public, supplemental, hang, fresh-seed, and fuzz
checks before committing. The first two resumed checkpoints are pushed as
`f61f728` and `4b4f5de`.

Checkpoint `6a0b6c7` adds a parser-based source audit, eliminates
all 40 binding and literal-import findings across 268 non-frozen modules, and
uses a new C action recording plus a source-state gate to cover behavior found
during that audit. Public remains **44/44** and byte-identical. Supplemental is
**338/346**, **82,191/82,617 screens**, **4,299,996/4,314,636 RNG**, with zero
runtime errors. The separate fuzz corpus remains **76/102 fully passing** and
**94/102 RNG-perfect**, with no changed session. Coverage is **99/106
categories**, seven partial, and **807/807 declared branch cases**. No newer
held-out result has been published. Its clean-commit dashboard is current.
Checkpoint `7e6587e` then fixes the C switch-to-JavaScript loop control error in
polymorphed hug attacks. Checkpoint `97bcf38` adds C's command-table validation
for the `m` prefix. Checkpoint `1c20413` ports C's throw release guards, and
`5593394` ports C's active-tool predicate plus attached-leash naming.
Checkpoint `a80b4d7` ports C's successful non-time command cleanup, making one
additional fuzz game fully byte-identical. The supplemental corpus is now
**343/350**, **82,568/82,991 screens**, and **4,339,347/4,353,959 RNG**. Fuzz
is **79/102 fully passing**, **97/102 RNG-perfect**, and **13,439/14,262
screens**. Public, hang, fresh-seed, source-audit, and frozen-file gates are
green. Declared coverage is **99/106 categories**, seven partial, and
**823/823 explicit branch cases**. Next, re-rank the remaining fuzz failures
from their earliest C/JS state divergence. The saved goal is active. See
STATUS.md for exact evidence and caveats.

## Historical milestone checklist, July 2026

Update this table at the end of every working session, before compacting or
handing off. `Local` is the public-session screen score from `bash frozen/score.sh`.

| # | Milestone | File | Status | Notes |
|---|---|---|---|---|
| M0 | Strategy and architecture decisions | [00-strategy.md](00-strategy.md) | done | — |
| M1 | Verification loop and dev tooling | [01-verification-loop.md](01-verification-loop.md) | **done** | plus `tools/diverge.mjs`, `undefined-refs`, `dup-defs`, `generalize` |
| M2 | Options, rc parsing, chargen | [02-options-and-chargen.md](02-options-and-chargen.md) | mostly done | `optfn_playmode` landed; `flags.safe_dog` default found missing |
| M9a | Lua core (blocks M4) | [09-lua-and-special-levels.md](09-lua-and-special-levels.md) | partial | des-coder room stack, `cvt_to_relcoord`, `des.object` montype |
| M3 | tty windowport (the screen) | [03-tty-windowport.md](03-tty-windowport.md) | partial | topl, getline, menu footer; **menu subsystem still absent** |
| M4 | Level generation | [04-level-generation.md](04-level-generation.md) | partial | rooms, corridors, niches, vault, traps; **whole special-room subsystem absent** |
| M5 | Display, vision, status lines | [05-display-and-status.md](05-display-and-status.md) | partial | glyphs incl. corpse/statue colour; `canspotmon` family absent |
| M6 | Move loop and core commands | [06-moveloop-and-commands.md](06-moveloop-and-commands.md) | partial | domove, doopen, getdir, getobj, quiver, throw; **no `m_at` check in domove** |
| M7 | Monsters, pets, combat | [07-monsters-and-combat.md](07-monsters-and-combat.md) | partial | mfndpos, dochug, dog_move/goal/eat; **all of uhitm.c absent** |
| M8 | Objects, inventory, menus | [08-objects-and-inventory.md](08-objects-and-inventory.md) | partial | mkobj, splitobj, weight, invent basics |
| M9b | Special levels and quests | [09-lua-and-special-levels.md](09-lua-and-special-levels.md) | not started | — |
| M10 | Subsystem sweeps | [10-subsystem-sweeps.md](10-subsystem-sweeps.md) | ongoing | spells reachable from `Z`; per-spell dispatch absent |
| M11 | Save, restore, multi-segment, bones | [11-save-restore.md](11-save-restore.md) | not started | `getbones` blocks 4 sessions |
| M12 | Generalization hardening | [12-generalization-hardening.md](12-generalization-hardening.md) | ongoing | 40 non-session seeds run clean every commit |

The milestone numbering is nominal now. Work is driven by the first-mismatch
aggregate (see STATUS.md), not by walking M2 to M12 in order, because the
sessions diverge wherever they diverge.

**Historical snapshot, 2026-07-26:**

| | |
|---|---|
| Sessions passed | 1 / 44 |
| Screens matched | **492 / 11,405 (4.3%)** |
| RNG positions matched | 136,523 / 792,838 (17.2%) |

`js/fastforward.js` is gone from the passing path: `seed8000-tourist-starter`
passes on ported code. Treat the RNG number as advisory only -- it counts
positional matches, so it can rise while a real divergence sits upstream, and
it can fall on a change that is provably correct against the C. The
first-mismatch aggregate in STATUS.md is the honest progress signal.

**Historical baseline, 2026-07-24, untouched skeleton:** 0/44 sessions,
0/11,405 screens, 25,429/792,838 RNG -- and that RNG credit was fake, coming
from `js/fastforward.js` replaying a recorded list while frame 0 rendered
blank.

Reproduce with `node tools/scoreboard.mjs`; history in
[score-history.tsv](score-history.tsv).

**Milestone at that historical snapshot:** M2, then M9a.

---

## Reference documents

| File | What it is |
|---|---|
| [00-strategy.md](00-strategy.md) | How scoring actually works, what wins, why the architecture is what it is. Read once. |
| [game-domain-primer.md](game-domain-primer.md) | What NetHack is, the command set, the subsystem-to-C-file map, and **what changed in 5.0 versus 3.6**. Read once, before your first milestone. |
| [full-game-coverage-spec.md](full-game-coverage-spec.md) | Complete game-element, mechanic, contest-rule, source-audit, and supplemental-test coverage contract. |
| [porting-protocol.md](porting-protocol.md) | The repeatable per-function recipe. Read before your first port, then keep it open. |
| [coverage-map.md](coverage-map.md) | Which public session exercises which subsystem. Produced by M1. |

Contest docs (upstream, do not edit): `docs/API.md`, `docs/PHASES.md`,
`nethack-c/README.md`, `/README.md`.

---

## Dependency order

Milestones are ordered because each unblocks the next, not by preference.

```
M1 verification loop                      done
     │
M2 options + chargen ──────────────┐   (every session starts here)
     │                             │
M9a Lua core ──────────────────────┤   (blocks M4 — see below)
     │                             │
M3 tty windowport ─────────────────┤   (every screen goes through here)
     │                             │
M4 level generation                │
     │                             │
M5 display + vision + status ──────┘   → first full session pass, fastforward.js deleted
     │
M6 move loop + commands
     │
     ├── M7 monsters and combat
     ├── M8 objects and inventory
     ├── M9b special levels and quests
     └── M10 subsystem sweeps
     │
M11 save / restore / multi-segment
     │
M12 generalization hardening   (runs continuously from M6 onward)
```

M2 through M5, plus M9a, are one indivisible block in practice: nothing scores
until all of them are real, because screen 0 of every session requires chargen, a
generated level, a vision calculation, and a windowport to draw it. Expect the
score to sit at zero through that block and then jump.

**Why M9a sits in that block.** It was originally scheduled after M6, on the
assumption that Lua only builds *special* levels. Measurement says otherwise:
`src/sp_lev.c` executes in 44 of 44 public sessions, and every session makes
Lua-context PRNG calls (minimum 210, tagged `@ nh.rn2()`). In NetHack 5.0
ordinary level generation runs through the Lua machinery, largely via themed
rooms. See [coverage-map.md](coverage-map.md) for the numbers.

---

## How to pick up work cold

1. Read `/CLAUDE.md`.
2. Read this file. Find the current milestone.
3. If this is your first milestone, read `game-domain-primer.md` — in particular
   its 5.0-versus-3.6 section, because your pretrained knowledge of NetHack is
   3.6 knowledge and a lot of it is now wrong.
4. Read that one milestone file. Find the first unchecked item.
5. Read `porting-protocol.md`.
6. Work the item. Verify. Tick it. Commit. Update the status board.

Do not read ahead into later milestones. Do not survey the C tree "to get
oriented" — the milestone file already names the exact C functions in scope.
