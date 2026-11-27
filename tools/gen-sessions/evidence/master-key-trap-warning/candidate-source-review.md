# Owner and contract review

The complete C owners are `artifact.c:2708-2749` (`count_surround_traps`) and `artifact.c:2753-2770` (`mkot_trap_warn`). The existing JS has neither owner. The patch keeps those C names and places them immediately before the existing `is_magic_key` owner. It leaves magic-key role and beatitude rules unchanged. Trap warning depends only on the wielded artifact identity and bare hands.

The count walks x first, then y, including the hero's square. It skips invalid squares and any currently displayed trap glyph before checking the real trap chain. A real floor trap takes precedence over a trapped door, which takes precedence over the first trapped container in the square's object chain. Each square contributes at most one. Inventory containers are not counted. `glyph_at` and `glyph_is_trap` read the display representation, so discovered traps covered by another glyph still count. The patch uses the established `t_at`, `IS_DOOR`, `D_TRAPPED`, `Is_container` and `GameMap.objectAt` contracts. `objectAt` followed by `nexthere` is the C per-square chain, not the global floor-object list.

The seven heat strings, saturation at index six, punctuation threshold above three, count-change guard and equipment reset match C. `pline_The` is asynchronous in JS. The patch awaits it before assigning the remembered count, and the world-turn caller awaits the owner before `dosounds`. This preserves the C suspension and message ordering. The call is after Searching, Warning and the existing were-change hook, inside the actual world-turn block. It is not added to each keyboard input.

The counter is `instance_globals_m.mkot_trap_warn_count` at `include/decl.h:586`, initialized to zero by `decl.c:495` and `gm = g_init_m` at line 1097. Complete `savegamestate` at `save.c:265-332` does not serialize it. Its C reference census contains only the declaration, initializer and artifact owner reads/writes. JS `resetGame` is called by each `NethackGame._start`, before fresh startup or recovery. The initializer therefore belongs there. JS `gamestate_encode` otherwise serializes every root game field; `restgamestate` also deletes/replaces fields unless they are in `SAVE_SKIP_KEYS`. Adding the counter to that existing skip set is a necessary fourth file change. It preserves the freshly initialized value on recovery without adding a new persistence mechanism.

`reviewed-ranges.json` pins the owner, caller and direct helper ranges and their whole source files. The exact proposed patch and before/after hashes were locked before application. No helper body was rewritten, and the private counter helper is not exported.

# Evidence and attribution

The first 17-member source packet is retained at `../master-key-trap-warning-source-audit`: 51/60 checks passed, but no producer was valid because the trap wish was attempted on the initial stairs. It is a failed setup, not evidence of native behavior. The separately named 15-member corrected source packet moved through actual input onto ROOM terrain, preserved its new lock and obtained five valid setups. Its 56/60 result contains exactly four expected positive warning/count failures.

The parent recorded the corrected five inputs once. The original raw is linked unchanged, SHA256 `9aebbf28da07abbf5308056ee809f4a06a06d8462a4e11c6084db218abe0dfb7`. The parent baseline is 3/5 exact; only the two positive warning messages differ. Baseline RNG, cursors and frames already agree. The candidate comparison is 5/5 exact across 1301 styled boundaries/cursors, 12524 calls and ordered slices, and zero frames. This packet ran no C recording.

The original passive source probe is unchanged from its first game import through EOF. Only its initial pin/preflight prefix is relocated. This deliberately preserves its legacy `baseline-observation.json` name and `runtimeCandidate:false` summary bookkeeping; `checks.json` identifies the actual candidate context. All 35 producer, 15 source and 10 neutrality checks pass. The three whole negative ordinary rows and three whole native rows equal the recorded baseline rows, including all 15 ordinary output hashes.

One sequential 512 MiB batch completed in 6.372 seconds. It also passed the unchanged maintained ordinary monster magic-key gate (8/8) and artifact touch/alignment gate (7/7, observer neutral). The post-batch report reader initially expected TAP labels while Node emitted spec labels. `report-format-diagnostic.json` preserves this formatting error; the original successful logs were read with the correct labels. No gameplay was rerun and no assertion body changed.

# Coverage limits

The ordinary positives cover one hidden floor trap and one discovered floor trap covered by the hero glyph. Negatives cover gloves, an unwielded artifact and an ordinary key. Repeated turns suppress duplicate feedback, and each fresh game starts with zero observed count.

The five inputs do not exercise displayed trap-glyph exclusion, trapped doors, trapped containers, multiple qualifying locations, higher heat levels, saturation, cooling, midgame weapon/glove reset, or actual save/recovery. These C arms are implemented from source but are not claimed as ordinary or native coverage here. The parent's broader source family remains independent. No blanket closure of the artifact, display or save subsystems is claimed.
