# Local floor order tests

These tools test independent `fobj` and `nexthere` order against the pinned C
sources and the actual runtime. Build the ordinary recorder first so its C
sources are available. No production exports or alternate runtime modules
are required.

Run from the repository root:

```sh
node tools/nexthere-order-state-gate.mjs
node tools/nexthere-order-native-gate.mjs --js
node tools/nexthere-order-native-gate.mjs --native native-original tools/gen-sessions/generated/nexthere-native-floor-control.session.json
node tools/nexthere-order-native-gate.mjs --native stone-flesh-restore tools/gen-sessions/generated/nexthere-stone-flesh-restore.session.json
node --test tools/zap-pile-settlement-state-gate.mjs
```

The state gate compiles nine complete C function bodies with `clang`, in a
temporary directory removed on success or failure. It emits the hashes of those
bodies. The package stores neither a binary nor generated expected chain states.
It uses the repository's existing `node:module` loader registration convention.
The loader calls `nextLoad` for the actual source, adds three private exports
(`strip_objs`, `fhito_loc`, `objects_at`), and adds an observation point after
`look_here` selects its pile. That observation stops the state test before UI
input. The ordinary-input test needs no loader and only observes the existing
`__step_snapshot` hook.

The oracle extracts `extract_nobj`, `extract_nexthere`, `place_object`,
`remove_object`, `recreate_pile_at`, `replace_object`, and `splitobj` from
`nethack-c/recorder/src/mkobj.c`, `find_lev_obj` from `restore.c`, and `bhitpile`
from `zap.c`. It checks both chains after every action. The required
representation controls include these final states, with numbers identifying
objects rather than types:

| History | Global order | Local order |
| --- | --- | --- |
| Place rock 3, then dagger 2 | 2, 3 | 2, 3 |
| Place boulder 1, then dagger 2, replace 1 with rock 3 | 2, 3 | 3, 2 |
| Place rock 1, then dagger 2, replace 1 with boulder 3 | 2, 3 | 2, 3 |
| Rebuild the second history through `find_lev_obj` | 2, 3 | 2, 3 |

The last two controls prevent unconditional boulder sorting and preservation of
live local links across an actual C restore. Other histories cover split,
extraction, reuse, other squares, explicit recreation, mutation during beam
iteration and hiding-under direction rules. JS checks cover actual readers,
raw codec aliases, `dosave0`/`dorecover`, bones JSON and rebuild, flip re-keying,
container and migration transfers, and deleted/Lua extraction. The saved-level
check invokes the codec and rebuild directly; it does not drive stairs.

The gate passes 992 checks against the integrated runtime: 711
intermediate states from 68 C histories, 272 reader/codec/link checks, one actual
save/restore check and eight consumer checks. Direct source mutations rejected
local head reinsertion on replacement (59 failed
checks), preservation of local links on restore (26), global boulder sorting
(129), and a missing split link (an explicit lost-object error). The old flat
representation fails the initial independent-head assertion. These controls
modified materialized cache files and restored their hashes; no replacement
module loader was used. The gates read the current repository source through
ordinary relative imports, with only the private-export/observation loader
described above.

The C oracle checks chain behavior only. Its stubs exclude visibility blocking,
shops and billing, object identity RNG, real weights, timers and light splitting,
statue activation, polymorph spawning and `fill_pit`. It does not prove those
effects or all floor consumers. The separate settlement gate verifies the real
`fill_pit` call using four native input histories: boulder over pit, boulder over
hole, rock over pit and boulder on ordinary floor. It checks object and trap
state before and after the zap, complete RNG slices and boundary cursors.

The native case manifest records the retained original file's SHA-256, references
all four unchanged input segments, and identifies its segment 3 step 47 list.
The native gate checks that file and the ordered lines; it does not score a JS replay.
Do not re-record the original control. `nexthere-order-native-original-input.json`
is input provenance, kept outside the active recipe directory. The promoted
`nexthere-native-floor-control.session.json` retains the original raw hash:
`6a677e461d490c76af5e732ae30d06733f5a4082c98f773fb349c6f355f4fd56`.

The `gen-sessions/recipes/nexthere-stone-flesh-restore.json` recipe and its generated
session contain 68 native boundaries and 3,138 recorded RNG calls. They
contain all three expected ordered lists below. The native gate verifies input
identity, recipe assertions and ordered lines against both the raw and promoted
recordings. This is native route/output evidence, not a cross-runtime RNG score.
The case uses seed 2219 and a pauper, nudist wizard. Wish for a boulder, wish for a dagger, drop inventory
letter `b`, and look. Use `#wizcast`, menu search `stone to flesh`, and `>` to
cast down. Look again and save with `Sy`. The second segment supplies exactly
` n: `: acknowledge welcome, decline keeping the save, look, acknowledge the
list. The two segments contain 62 and 4 keys.

| Checkpoint | Visible local list | Global projection at the hero |
| --- | --- | --- |
| Segment 0 step 31 | boulder, dagger | dagger, boulder |
| Segment 0 step 59 | enormous meatball, dagger | dagger, enormous meatball |
| Segment 1 step 3 | dagger, enormous meatball | dagger, enormous meatball |

The visible lists in this table are verified in native C. The global projections
and object identities are observed in JS and supported by the extracted C chain
oracle. The JS input test confirms the same two identities after restore and
unchanged order of all 26 global floor objects. Its recipe uses existing branch
text and cell assertions. The native gate also checks complete ordered item lines.
The input check rejects an omitted restore rebuild. It does not reject generic
replacement-at-head, because this particular replacement occurs at the local
head; the C chain histories cover that distinction.

The source proof is `spell.c:787` (`dowizcast`), `wintty.c:1745` (menu search),
`zap.c:1993-2016` (stone-to-flesh material/resistance and boulder conversion),
`zap.c:1903` (the actual replacement), `mkobj.c:665-674` (both chain slots),
`zap.c:2487-2498` (restack only if a boulder remains below a non-boulder),
`invent.c:4299` (visible local traversal), and `restore.c:71-106,1166-1168`
(rebuild from the saved global chain). No boulder survives this conversion, so
the pre-save local order persists until restore.

The raw stone-to-flesh recording has SHA-256
`5de29363f8a2bb57c3b05e8125f47b19b4eaac546bb507c6fe24897d8bc06b5c`.
The generated file, including recipe metadata, has SHA-256
`489a28b0ff9c1f9313a9f850650c2226265e264d7ab4ca5a30a6d9fa6c55e9c2`.
Both are recorded in the native case manifest. The original control's strict
raw-hash check remains unchanged; the stone-to-flesh check permits metadata
updates while requiring identical inputs and the asserted output.

Ordinary stone objects can resist this spell with a 2 percent check; this seed
succeeds in both C and JS. This case tests save/restore, not a native level-return
or bones history. Corpus regression results are recorded separately in
`docs/plan/STATUS.md`.
