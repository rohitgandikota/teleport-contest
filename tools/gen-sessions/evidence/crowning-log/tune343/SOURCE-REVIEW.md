# One missing achievement call

Complete C pleased at src/pray.c:1071-1383 and fixed0829 JS pleased were read before candidate334. The second castle-tune hint occurs only when no drawbridge has been opened, Gehennom has not been entered, and uheard_tune is already1. C prints the tune, increments uheard_tune and calls record_achievement(ACH_TUNE) at1240 before breaking. The JS caller has the increment and break but omits the achievement call. This follow-up adds that one call and imports the existing helper and constant.

Read complete C src/insight.c:2407-2472 record_achievement and JS counterpart. It validates the index, suppresses duplicate absolute indexes, records a new index in uachieved, then suppresses final-disclosure logs or appends the correct table event. The C and JS tables both map ACH_TUNE=31 to LL_MINORAC=4096 and "learned castle drawbridge's tune". The existing exported ACH_TUNE in js/const.js and record_achievement in js/insight.js need no change. Calling livelog_printf directly would omit achievement state and duplicate suppression, so use the existing owner.

The fixed raw7caf6570 shows the exact event at case2 boundary373 row22 with turn29. Prior candidate334 lacks it in stored last.logs, while its crown and gift entries have the correct turn44/text/flags. The missing event accounts for the remaining page373/374 native differences. Lock the independent tune event predicate and its body before editing, then evaluate those stored logs without gameplay. All42 crown and three quest predicates remain byte-identical.

The parent explicitly authorized only the import/import/call follow-up. Banishment, other prayer conduct logging and unobserved crown branches remain outside this scope. No new C input, recording or raw modification is needed.
