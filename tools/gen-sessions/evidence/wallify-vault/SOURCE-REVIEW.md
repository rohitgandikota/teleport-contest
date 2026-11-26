# Wallify retained-object redraw

Verified JS behavior: ordinary keyboard commands leave a food ration on a damaged vault boundary. When the guard restores that square, JS replaces the ration's remembered and displayed `%` with a horizontal wall. The ration remains on the floor. C source requires an object-first redraw at that point. No C replay or runtime candidate has been made.

## Fixed scope

The baseline is the parent's published309 composition, 280 runtime files, map SHA256 `309f0c98243645b1565e61979fd09d6cfade2c58588361151c3d7f113c3f553b`. Runtime and fixture directories are read-only links. This packet contains source review and keyboard diagnostics only. The sealed feel-cockatrice no-defect packet is unchanged.

The complete C owner is `vault.c:646–731`, corresponding to fixed JS `vault.js:241–311`. Complete direct callers `gd_move` and `gd_move_cleanup` were read, including all three call sites: C855/913/920 and JS410/540/548. The read and hash ledger is `source-ranges.json`. It distinguishes complete owners from the upstream movement dispatcher excerpts. No whole monster-movement subsystem closure is claimed.

The ordinary witness reaches the normal escort call at C913/JS540 after both hero and guard leave the vault. The target `(23,4)` is outside fake corridor `(25,5),(26,5),(27,5)`. It does not require the restored-entry branch at C1009, parent map `ac8bbeed420f20dae9b9b17f662c2b1eeb7f2573cdc509d9841b0ec58bf19a81`. That prerequisite was not used. Parent owns the separate door-opening `del_engr_at(ex,ey)` review. Sartre owns `invault` reconstruction. Neither is in this packet's proposed scope.

## Complete owner order

1. Iterate only the vault boundary, excluding active fake-corridor squares. Enter for a non-wall or a wall containing gold, rock or boulder.
2. For an occupant other than the guard, yelp first if tame, relocate with messages, and use limbo if relocation fails.
3. Move gold into the vault, preserving the two coordinate RNG draws and redraw/stack order.
4. Extract and free all rocks, then all boulders. Other objects deliberately remain embedded. Delete a trap with `deltrap`.
5. Choose the rectangle's wall type, clear wall information, recompute its wall mode, and delete engraving.
6. Save the visibility byte, temporarily set `IN_SIGHT | COULD_SEE`, call `newsym`, restore the byte, then block the point.
7. Emit incantation or distant chant, followed by gold-movement feedback and wall-restoration feedback as applicable.

JS preserves the basic loop, relocation, gold and message structure. Its relevant difference is `map_background(x,y,true)` at line294. This deliberately maps terrain and does not run the object-first `newsym` branch.

## Why C predicts a visible difference

`vault.c:680–681` explicitly leaves objects other than debris embedded. `vault.c:712–716` makes the square temporarily visible for `newsym`, then restores visibility before blocking it. The C `cansee` macro tests that byte directly (`include/vision.h:8–29`).

The complete `newsym` owner (`display.c:917–1099`) enters its visible arm and, for this unoccupied non-hero square, calls `_map_location(x,y,1)` at line1035. `_map_location` at lines448–478 maps a visible object before a trap, engraving or background. `covers_objects` (`include/display.h:218–222`) covers water and lava, not ordinary walls. `map_object` (`display.c:333–366`) retains and shows the object glyph. There is no hallucination, blindness, swallowing, underwater state, trap or occupant in this witness. Food was already identified and displayed before restoration.

The corresponding JS helpers already have the needed object-first path. The immediate display and visibility helpers were read in full. This is a missing owner call/order, not a proposed new display abstraction. A future minimal candidate can remain in `vault.js`'s restoration block and use existing public helpers. No such candidate is included here.

## Real keyboard reach

The starting proposal is the first maintained `guard-cleanup-prompt.json` segment, SHA256 `f9918a947a5cc009eb7985efb92042e78d8e896b41d1b05ecab072c839b652af`. It supplies a native-established vault/guard route, not a state fixture. All four new inputs are debug-mode keyboard play: level teleport, ordinary wishes, `#wizintrinsic` pass-walls, movement, drop, wait and guard dialogue. No map/state injection, helper mock, private export or RNG replacement is used.

At seed7303, level2, vault room8 has bounds `(23..24,5..6)`. The hero enters north boundary `(23,4)`, wishes a throne and then floor there, wishes/drops a food ration, returns to the vault, and follows the guard after dropping the gold. The full terrain-wish producer, intrinsic producer and drop owners were read. The existing doorway setup at `(27,4)` is outside the vault rectangle and is unchanged across proposals.

Positive evidence from fresh passive observation:

| Boundary | Hero | Target | Memory | Ration | Visibility | Guard |
| --- | --- | --- | --- | --- | --- | --- |
| 225 | 25,5 | ROOM | `%`, object | id121, floor, quantity1 | byte0, unseen | id123 at27,5, peaceful,49HP |
| 226 | 26,5 | HWALL | horizontal wall, cmap | same id121 and quantity | byte0, unseen | same guard and corridor |
| 227 | 26,5 | HWALL | horizontal wall, cmap | same id121 and quantity | byte0, unseen | parked after cleanup starts |

Boundary226 shows the incantation. Boundary227 shows wall-restoration feedback. Terminal cell column22,row5 displays `─`; C predicts `%`. Both serialized screen decoding and remembered glyph observations establish the difference. The object itself is unchanged.

## Locked controls and failures

`recipes/wallify-vault.json` preserves all five input fields, presence and every key from proposal04. The lock contains all bytes. Branch metadata states the C prediction explicitly and has not been natively validated.

| Case | Keys | Boundaries | C-derived predicate on JS |
| --- | ---: | ---: | --- |
| retained-food-north-wall | 227 | 228 | FAIL: wall instead of retained food |
| empty-north-wall | 210 | 211 | PASS: wall, no retained object |
| rock-north-wall | 220 | 221 | PASS: debris gone from floor, wall shown |
| intact-wall-food-negative | 219 | 220 | PASS: ineligible wall keeps food glyph |

All four pass reach, survival, observer-removal equality and deferred-input/held-EOF equality across screens, cursors, complete RNG calls, ordered slices and animation frames. Totals are880 boundaries,25465 calls,0 frames. Three negative cases retain all15 output hashes. This is a source-predicted display diagnostic, not native parity or a runtime before/after causal result.

Proposal01 reaches the existing guard cleanup without changing a vault boundary. Proposal02 tries `floor` directly on a wall. C and JS reject that wish; food alone does not make an intact wall eligible. That failure remains intact and supplies the fourth negative. Proposal03 uses the source-valid throne-to-floor sequence and reaches restoration. Proposal04 shortens only the ending keys and locks the four cases.

The first diagnostic run exposed a passive-observer assumption: an allocated guard can be observed before its `fakecorr` array is initialized. The next run exposed a test premise spanning the initial level1 square instead of only level2. Both failed reports are retained. The final tool observes the partial construction without mutating it and checks the intact-wall invariant on level2. No runtime or input change fixed these test errors. `ordinary-v3.json` retains the genuine positive failure and all four neutral comparisons.

## Other source gaps stay open

| Gap | Source contract | Evidence limit |
| --- | --- | --- |
| Missing tame-occupant yelp | C670–673, complete `yelp`, `rloc`, `m_into_limbo` read | No pet/occupant in locked inputs |
| Debris extracted but not freed | C682–688, complete extraction/`obfree`/`dealloc_obj` read | Rock disappearance from floor is covered; disposal, timers, billing and retained references are not proved equivalent |
| Trap array filtering bypasses `deltrap` | C690–691, complete `deltrap` and `clear_conjoined_pits` read | No trap here; reciprocal conjoined-pit bits remain an untested behavioral lead |
| Missing `xy_set_wall_state` | C704–706, complete wall-mode helpers read | JS resets mode1 to0; no separate native/display attribution from these cases |
| Gold and relocation branches | Complete immediate owners read | Inputs do not place boundary gold or occupants; transitive billing/migration closure is not claimed |

The positive object redraw does not depend on a wall-mode glyph distinction, object disposal, a trap, pet feedback or a new producer. These omissions must not be treated as closed by the four cases. No speculative field initialization, broad billing work or adjacent guard patch is proposed.

## Proposed next scope

Review the restoration block's C wall-state and temporary-visibility/newsym order in `vault.js`, retaining the existing helper implementations. Parent can record these exact four inputs before a separate minimal candidate. Native recording/comparison remains parent-owned and pending. Existing seals, main and all runtime files are unchanged.
