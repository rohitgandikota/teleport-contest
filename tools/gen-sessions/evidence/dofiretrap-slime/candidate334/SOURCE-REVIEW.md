# Reviewed consequence and caller contract

Read complete upstream `src/trap.c:4233-4325 dofiretrap` and the fixed JS owner
at `trap.js:386-469`. C calls `burn_away_slime` after either the uninjured
message or `losehp`, before armor damage, item destruction and floor effects.
The call is unconditional at that point, including resistant and zero-damage
outcomes. JS has the same reached damage/cleanup boundary but omits this call.
Its timeout import already exists at line58, used by other trap owners.

Read complete C `timeout.c:448-454 burn_away_slime` and JS `timeout.js:351-355`.
Both check the slime property and call `make_slimed(0, cure message)`. Read
complete C `potion.c:195-219 make_slimed` and JS `potion.js:2586-2606`. The
setter changes the timer, reports the transition, and clears the delayed
killer and late slime appearance when the property is gone. The JS helper
awaits the message, so its caller must await completion before further fire
effects and input. No helper return value is guessed or used.

Read complete C `wizcmds.c:949-1096 wiz_intrinsic` and JS `wizcmds.js:512-703`.
The real counted menu selection `100c` reaches `make_slimed` without consuming
a turn. The source15 observer confirms timer100 before the action. No probe
sets gameplay state. The timed debug producer does not establish a non-null
slime delayed-killer node or late-countdown appearance.

Read C `sit.c:400-503` and JS `sit.js:459-563`, including all preceding entry
conditions and the reached `dotrap(trap, VIASITTING)` call. The actual source
family has an empty floor, a fire trap, no live monsters, the requested form,
worn fumbling gloves, sight and no underwater state. The hero fire dispatcher
in `trapeffect_fire_trap` reveals the trap, awaits `dofiretrap(null)` and
returns. The earlier maintained cleanup/fire producer proof stays linked in
source15 rather than being duplicated. The remaining sit branches are outside
this edit and this family's reach.

The parent C raw fixes the two positive branch predictions before this edit.
Original JS misses cure feedback and leaves timers98/99. Four selected
negative cases have exact native reports: healthy iron/minotaur fire and
slimed iron/minotaur look. Source pins retain the complete C file hashes.

Known adjacent differences in the complete fire owner, including the omitted
underwater early return, chest floor handling and human HP-floor behavior,
remain out of scope. This patch supplies the missing consequence at the C
boundary without changing any of those branches or the existing helpers.
