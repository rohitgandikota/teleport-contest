# Gameplay gaps measured from C execution

The September 6 bones continuation reaches 57,364/108,268 direct C outcomes
and 4,412/5,491 entered records. It adds 91 native game segments, with all
19,423 screens/cursors, 395,506 RNG calls and 80 animations matching. All
sixteen deliberate faults fail state or native output checks. Six survive
native output, and one survives state checks. See [bones-audit.md](bones-audit.md)
for the exact gaps and combined 603/603 regression result. These measurements
do not establish full game coverage.

Verified on 2026-09-06. The fetched leaderboard snapshot was dated
2026-09-06T11:49:08.879Z; our fork was last scored at
2026-09-06T11:11:21.682Z. It reports 11,405/11,405 public screens, 44/44 public
sessions, 9,179/11,265 held-out screens (81.48%) and 20/44 held-out sessions.
The team ranks first among nine agentic entries. This score predates our
September 6 push at 14:48:35Z. The local supplemental suite's 100% must not be
reported as the judge's held-out score. Source:
[live leaderboard data](https://mazesofmenace.ai/leaderboard/data.json).

The previous coverage metrics did not establish game completeness. Recipe tags
count scenarios we chose to declare. RNG-site annotations observe only calls
that consume randomness. Neither measures all the deterministic decisions in
the original program. The local random-play corpus has also been repeatedly
used to fix defects, so its current pass rate is a regression result rather
than an independent estimate of unseen gameplay.

`tools/c-branch-coverage.mjs` adds a compiler-derived denominator. It builds a
separate instrumented copy of the recorder, replays C inputs, and credits a
profile only when the recording matches every existing key, RNG entry, screen,
cursor, and animation frame. The ordinary recorder and frozen files are not
modified. Clang's [continuous profiling](https://clang.llvm.org/docs/SourceBasedCodeCoverage.html)
preserves counters when the driver terminates the process at its last input.
The collector currently requires macOS and Xcode command-line tools.

The first scan selected 44 public and 414 supplemental recordings, including
the existing uncommitted leash fixture. Before the new corpse-wielding fixture:

| Measurement | Verified result |
|---|---:|
| Exact C re-recordings credited | 457/458 |
| Compiled C function records entered | 4,274/5,491 |
| Compiled C function records never entered | 1,217 |
| Direct C branch outcomes observed | 52,450/108,268 (48.44%) |

These counts cover compiled `src/` and `win/tty/` functions. They exclude Lua,
macro-internal conditions, and inactive build configurations. The full LLVM
export retains macro branch counters for inspection. Process startup and
recorder shutdown are included, as are unreachable guards and error paths.
This is a coverage denominator, not a percentage of gameplay implemented.
Even covering both outcomes separately does not establish correct interactions
between conditions or correct long-term state.

The rejected public recording is `seed2200-wizard-quaff-zap-read`, segment 0,
step 158. Its options-help screen contains the original recording machine's
home path. Re-recording with the ordinary, uninstrumented C binary produces
the same mismatch. Its profile was excluded without normalizing the screen.

The measurement led directly to a reproduced defect. C's
`wield.c:cant_wield_corpse()` had never executed in the credited corpus and
contains no RNG calls. Its JS counterpart still skipped stone resistance and
instant petrification. The new `wield-corpse-safety` recording exercises bare
hands, gloves, stone resistance, a harmless corpse, life saving, and flesh-golem
conversion. Each case inspects the resulting weapon slot. Before the fix it
matched 390/405 screens and 3,085/16,856 RNG entries; afterward it matches
405/405 screens and cursors and 16,856/16,856 RNG entries.

The new trace enters the missing function six times and adds 13 previously
unobserved direct C outcomes across the program. The union therefore reaches
4,275 function records and 52,463 direct outcomes. Its safety function reaches
3/4 direct outcomes. The remaining outcome is the non-corpse guard, which the
caller excludes before calling the function. Do not manufacture an impossible
game state merely to turn that denominator into 100%.

The inventory continuation now adds 50 asserted C scenarios, fixes the command,
named-stack, equipment and light-source divergences they exposed, and passes
all 44 public plus 418 supplemental fixtures. It adds 217 direct outcomes and
five entered functions to the union above, reaching 52,680 outcomes and 4,280
entered function records. Its source-derived state gate catches a candle light
leak which passed terminal parity; an isolated omitted-cleanup fault confirms
the check detects that defect. See [inventory-adjust-audit.md](inventory-adjust-audit.md)
for source coverage, remaining decisions, and the still-missing merger lifecycle.

The next 14 inventory and naming controls add 46 direct outcomes, bringing the
union to 52,726/108,268. All 44 public and 420 supplemental fixtures pass. The
new name state gate checks persisted names and temporary formatting changes;
the C terminal alone cannot expose the full stored name length. Unpaid merging
initially had six failing C probes. The completed eight-case follow-up ports
quoted-price matching and bill/object cleanup, adds 22 native outcomes, and
passes all 44 public plus 421 supplemental fixtures. The union now contains
52,748/108,268 outcomes and 4,282/5,491 entered function records. A second light
ownership state failure involved changing the retained object's price-based ID;
C stores a pointer while JS had retained the old numeric ID. That fix is checked
in both price-order directions. The full lifecycle review remains open.

The initial candidates below came from measured C execution. Their untested
behavior is a hypothesis about possible defects until a C/JS mismatch is
reproduced. The source locations refer to the recorder-patched C tree.

| Gameplay target | Baseline direct outcomes | Next C scenario |
|---|---:|---|
| `invent.c:doorganize_core` | 51/132 | Split, cancel, collect, merge named stacks, and bump an occupied slot |
| `invent.c:adjust_split` | 0/22 | Use the item-action split command and verify quantity conservation |
| `invent.c:display_used_invlets` | 0/24 | Select and cancel the used-letter menu during adjustment |
| `invent.c:freeinv_core` | 24/34 | Remove a timed figurine or luck source and observe later state |
| `trap.c:untrap`, `try_disarm` | 5/158, 0/68 | Disarm known traps with success, failure, equipment, and status controls |
| `potion.c:potion_dip` | 16/180 | Cross object type with potion type, blessing, curse, and dilution |
| `detect.c:gold_detect`, `food_detect` | 0/90, 0/88 | Detect carried, buried, contained, and absent targets |

Continue with compiler-guided C scenarios, then retain each reproduced failure
as a regression. Choose feasible, ordinary gameplay before cold diagnostics or
unreachable guards. Measure new branch outcomes and actual failures found;
recipe count alone should not set priorities.

Two additional methods would strengthen the oracle. First, compare small C/JS
state checkpoints after object transfers, equipment changes, death recovery,
and save/restore. Object identity, quantity, location, timers, bills, and
equipment slots can differ while the current terminal frame still agrees.
Second, use isolated mutation tests to check whether existing fixtures detect
deliberately reversed guards or omitted state updates. The inventory continuation
implements one focused state gate and fault injection. Full C/JS checkpoint
comparison and a general mutation system are still proposed work.

Keep future evaluation batches separate from development. Fix the generator,
choose fresh seeds and action/state combinations, score the entire batch
before inspecting its failures, and record the first-run result. After using
those failures to edit code, treat that batch as regression coverage and draw
a new evaluation batch. Include longer normal-mode sequences and persistence
transitions; the current public-input trigram model does not cover every
command or meaningful combination merely because it uses fresh seeds.

Reproduce the census with:

```bash
node tools/c-branch-coverage.mjs --build
node tools/c-branch-coverage.mjs --out .cache/c-coverage/fresh
```

Use a fresh output directory and one collector at a time. Rebuild after
changing the C reference. See `tools/gen-sessions/README.md` for scope and
failure behavior. Local audit artifacts are in
`.cache/c-coverage/baseline-20260905/` and
`.cache/c-coverage/wield-corpse-20260905/`: `summary.json` records selected
sessions and the binary hash, `functions.json` lists every missing outcome,
and `coverage.json` contains the LLVM export. The terminal comparison logs
are `.cache/c-coverage/wield-corpse-before-final.log` and
`.cache/c-coverage/wield-corpse-after.log`.

A clean rebuild followed by one accepted and one deliberately rejected replay
reproduces the same per-function coverage outcomes as the accepted replay
alone. The rejected output is retained for diagnosis and contributes no
profile. Binary hashes identify individual builds; they are not a claim of
byte-reproducible compiler output. Public verification passes 44/44,
supplemental verification passes 415/415, and the existing random-play corpus
remains 101/102 with its known datetime-screen mismatch. Public and new-fixture
hang checks, 80 fresh-seed startup checks, 14 tool tests, and the source audit
pass. The game fix's held-out effect has not been judged.
