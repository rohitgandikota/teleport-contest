# Menu mappings and early output

Baseline: fixed9a92, 280 modules. The original source24 and prerequisite36 remain immutable. Their five plus eight tuples, all expectations and seven negative controls are linked unchanged. Parent confirmed the eight new C predicates and the installed recorder defect. Candidate work is now authorized in this packet only.

## Runtime scope

| Owner | Source contract and bounded change |
| --- | --- |
| `options.js` | Port `default_menu_cmd_info` for all 13 names, `check_misc_menu_command`, the shared setting branch, `illegal_menu_cmd_key`, `add_menu_cmd_alias`, `get_menu_cmd_key` and `map_menu_cmd`. BINDINGS recognizes exact case-sensitive names before the existing extended-command fallback. OPTIONS checks its complete name with C ASCII matching and calls the same append owner. Preserve the current byte arguments, right-to-left list order and configuration-error collection. Help uses the first reverse mapping and `visctrl`. |
| `gstate.js` | Initialize `mapped_menu_cmds`, `mapped_menu_op` and `n_menu_mapped` per process/game. Ordered strings preserve duplicate entries and first-match lookup. No Map overwrite or recursive remapping. |
| `const.js` | Add only the two missing `MENU_SHIFT_RIGHT/LEFT` constants from wintype.h:155-156. The existing `MAX_MENU_MAPPED_CMDS=32` is reused. |
| `tty/wintty.js` | Extend accepted input with configured aliases. Preserve explicit current-page selectors and PICK_ONE group precedence before mapping once, then reuse existing count/action/repaint branches. Reset the base cursor with per-process window reset, so early output does not inherit another game. Reuse `tty_raw_print` and the actual base writer. No recorder raw-active state is introduced. |
| `plselect.js` | Replace the two private input loops with small adapters to existing `tty_select_menu`. PICK_ONE cancellation returns ROLE_NONE, empty selection ROLE_RANDOM, otherwise the first identifier except a leading preselected ROLE_RANDOM yields the second. PICK_ANY returns null only on cancellation. Existing role/race/gender/alignment/filter callers and confirmation keep their return decoding and destruction order. |
| `jsmain.js` | Move existing display attachment immediately before synchronous `parseNethackrc`. Keep capture-hook installation, game-window initialization, clearing and first input in their current order. Browser, runSegment and deferred input already provide this display. Subsequent symbol/map customization has no level yet and does not draw a map. |
| `display.js` | After existing message-location/truncation processing, before the first await, route nonempty pre-window `pline` through existing synchronous `tty_raw_print`, clear `last_msg`, and return. Thus alias overflow emits during parser execution, without a detached continuation, queued notice, MSGTYPE lookup, history or input wait. The initialized-window branch is unchanged. |

The 13 table entries include two pan mappings. Standard upstream TTY `default_menu_cmds` and `process_menu_window` have no pan cases, and `wc2_supported("menu_shift")` is false. Store and map those entries faithfully; do not invent standard-menu pan behavior. Mouse and special-key families, other window ports, configuration filenames, general raw-output control-byte handling and the existing raw `wait_synch/getret` gap are outside this patch. No reached menu producer invokes the append helper after window initialization: BINDINGS comes from config dispatch, and these 13 options are configuration-only in the actual option-menu producer.

## Early output and error reporting

C `add_menu_cmd_alias` at options.c:8080 calls `pline("out of menu map space.")` at attempt 33 and leaves all 32 entries intact. `vpline` at pline.c:237 sends it to `raw_print` before the windows exist. It does not increment the configuration-error count or wait for a key. Later `tty_init_nhwindows` clears the base screen. This permits the diagnostic to disappear before the first recorded boundary, but it must first be emitted synchronously.

Keep `config_erradd`, `config_error_add`, `parseNethackrc` error-state lifetime and interactive error flushing unchanged. Illegal menu keys use their C messages through that existing collection owner. Unrelated invalid-option controls must retain their error lists and lack of eager raw output. Constructed live-GameDisplay controls will check the diagnostic grid immediately after parse returns and again after microtasks, then its erasure by the actual initialization owner. Normal/deferred ordinary runs verify no added input boundary.

## Fixed evidence and verification

1. Lock source controls before runtime edits. Use real parser, global state, GameDisplay and shared TTY owners. Cover the 13 names, illegal classes, byte keys, ordered duplicates/reverse lookup, right-to-left order, nonrecursive mapping, reset, capacity, explicit/group/count precedence and early output. No mocks, selectors, test-only runtime exports or fixture changes.
2. Reuse the original five and prerequisite eight ordinary assertion bodies. Require all 13, observer/plain/deferred equality in all five streams, and the original 35 hashes for seven negatives. Preserve every failed invocation.
3. Compare all five original C cases and all eight prerequisite C cases without changing raw bytes. Expected native outcome is 5/5 and 7/8. The overflow case must retain its five recorded stale cursors, and the comparison must still exit 1 for that defect even if all other streams match.
4. Keep compact reports, an exact seven-file patch, source/caller pins and a read-only scope verifier. Parent owns current composition, any maintained-corpus partition and publication.

## Recorder attribution, separate from runtime

The immutable prerequisite raw SHA256 is `1d8d92ff6ed2ee557c6c256a31918201a3177a5ba57dfc70458956ccc5aa346c`. Segment 6 boundaries 0 through 4 all record `[0,1,1]`. Parent disassembly SHA256 `bc33c0e1538747abebd79c8a712c70895da9f3a40945277240360c01c949d7f6` verifies the installed binary uses the early raw cursor while raw-active remains set. Screen clearing leaves that state intact; reset is only at teardown. Parent also verified canonical patch006 at `6ee30e6f9b381f86e4ba2a0077337642a1560f68` has the same startup behavior. No recorder change is planned. The recipe's semantic predicates contain no cursor expectation. Full comparison will expose the defect; JS will keep its actual menu cursor.
