# Verified source gap and ordinary reach

C clear_fcorr restores both the saved terrain type and its saved flags at vault.c89-90. In C, wall_info is a macro alias for the five-bit flags member. Fixed19946 JS clear_fcorr restores loc.flags and a legacy saved doormask, but does not restore loc.wall_info. The intact entry usually retains its original inactive wall_info, masking the omission. A real keyboard terrain wish can change that field while the guard still owns the entry.

The locked positive uses ordinary debug-mode commands, not injected state. It enters a naturally generated vault, wishes for a digging wand and cursed tin whistle, summons the guard, answers the name prompt, drops its gold and follows two steps to25,5. The guard has saved fakecorr[0]={ftyp:VWALL,flags:2} and moved to27,5. Ctrl-W requesting undiggable iron bars at the hero's position then changes the entry's wall_info to8. This is the complete existing wizterrainwish/set_wallprop_from_str producer, C objnam.c3538-3917 and JS objnam.js2873-3206. C explicitly supports this debug terrain wish. No non-debug gameplay mutation is established by this packet.

The hero teleports away, waits for cleanup, returns to24,5 and zaps the digging wand east. C source predicts that restoration removes the temporary nondiggable bit by assigning saved flags2. Its may_dig then permits zap_dig to open the wall. Current JS retains wall_info8 and refuses digging. The last east movement remains at24,5 rather than reaching25,5. This is fresh JS reach plus a C source prediction, not native parity evidence.

| Locked positive step | Fresh JS observation | C contract |
| --- | --- | --- |
|118|Entry opens; fakecorr[0] stores VWALL and flags2.|Save flags before door conversion.|
|126|Hero25,5; guard27,5; three saved corridor cells.|Entry stays in the active queue.|
|148|Actual terrain wish makes IRONBARS, wall_info8; saved flags remain2.|Terrain wish clears flags, then sets W_NONDIGGABLE8.|
|170|clear_fcorr restores VWALL and generic flags2; wall_info remains8.|Restored flags also replace wall_info with2.|
|176|Guard is gone after restored-entry cleanup.|No later guard operation should preserve the temporary bit.|
|206|Wand charge spent, wall stays intact.|may_dig permits digging because saved2 lacks bit8.|
|211|Hero remains24,5.|After successful digging, east movement reaches25,5.|

# Complete storage and restoration contracts

The reference census finds the gameplay fakecorr record writers in invault and gd_move, and its restoration assignments in clear_fcorr and gd_move. The full owners, allocation/declaration contracts, immediate caller branches and selected producer/readers are pinned in review/source-coverage.json. Caller slices are labelled as slices; this does not claim full audits of every large caller module.

| Owner or contract | Verified ordering and boundary |
| --- | --- |
|newegd/free_egd, MM_EGD allocation|C zeroes the record; JS initializes an egd object. Neither invents a saved wall value.|
|invault and finish_guard_corridor|Entry ftyp/flags are saved before conversion to an empty doorway. Fixed19946 already reconstructs a nonwall entry and saves wall_info correctly. No producer repair is proposed.|
|gd_move subsequent corridor cells|C saves the old type but takes flags after conversion to CORR/DOOR. This can intentionally save zero. Do not replace that ordering with an original-terrain snapshot. JS also saves a legacy doormask member absent from C.|
|clear_fcorr|Checks level, hero/visibility/ball/monster blockers, restores type then flags, removes traps from stone/walls, blacks out stone, removes engraving, maps and recalculates blocking before advancing fcbeg. The typed wall assignment is missing before those readers.|
|gd_move warning restoration|The seventh-warning arm likewise restores generic flags and legacy doormask without wall_info. Its C typed-field contract is the same, but no new ordinary witness for that arm is claimed.|
|gd_move gold departure|C has another direct entry restore. JS's earlier omitted gold-departure behavior is a separate existing limit; these inputs drop gold and do not reach it.|
|restfakecorr/grddead/parkguard/paygd|The same saved queue can outlive the visible guard. Deletion follows successful restoration; blocked cleanup keeps ownership. No cleanup-policy or lifecycle change is proposed.|
|wallify_vault|An active fakecorr coordinate is excluded. After clear_fcorr restores an ordinary wall with no debris, wallify skips it again. Wallify therefore neither owns nor repairs this saved-flag restoration.|
|flip_vault_guard and save pointer normalization|The flip changes coordinates only. fakecorr pointer normalization is empty. No new save/load or migration gameplay coverage is claimed.|

The ordinary path keeps warncnt1 and no carried gold. At step170, fcbeg advances from0 to2 while the guard still occupies27,5. This identifies ordinary clear_fcorr restoration, rather than the warning, gold-departure or wallify arms. The following turn reaches the already-published restored-entry confusion branch.

JS makeLocation stores flags, wall_info and doormask independently. C rm.h213-222 aliases these and other terrain fields. The selected wish producer deliberately clears the typed fields and then sets nondiggable8. It is a valid producer, not a malformed constructed state. C and JS may_dig both read wall_info, so the retained high bit has a direct gameplay consumer. xy_set_wall_state computes low wall-mode bits while preserving high bits; recomputing a wall mode at restoration would not implement C's saved-flags assignment.

# Controls and limits

Four final tuples preserve all five fields and759 keys,763 boundaries. The no-mutation negative leaves inactive wall_info2 unchanged and digs successfully. The outside-entry negative creates nondiggable bars at24,5 only after cleanup; it leaves saved entry25,5 unchanged and also digs successfully. The before-cleanup negative stops with the guard active, bars present and no restoration or wand use. These are actual keyboard runs, not constructed map controls.

All three negative output rows retain their15 hashes. Fresh passive observation, plain replay and deferred/exhausted replay match in all four cases. The27 source controls pass25/27, with exactly the positive's wall_info and digging assertions failing. The four primary screen assertions pass3/4 on baseline JS: the positive ends with a wall at terminal24,6 where C predicts the hero. Screen coordinates use x-1,y+1, as in the previously verified C tty contract. Native C recording and comparison remain pending parent.

The first keyboard proposal already reached the target. Proposal01 and its compact trace remain unchanged; proposal02 adds the paired negatives. Incidental search/console formatting failures are retained separately in review/inspection-failures.json. No failed gameplay proposal has been discarded.

The direct wall_info writer census also finds generation, drawbridge, shop repair, map display and other terrain producers. Those references are retained as leads, not whole-module audits. The selected terrain wish is sufficient for this bounded ordinary witness. No native claim, global alias rewrite, candidate or runtime patch is included. The warning arm, other saved terrain types, corners, timers, non-debug mutation paths and wider restoration semantics remain explicit limits. After parent C confirms the locked witness, a separate candidate can address the saved wall-field assignment in the existing restoration owner; source and current packet must remain fixed.
