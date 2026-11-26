# Autoquiver equipment fields

Verified source finding on the fixed cf8d280 graph: C hold_another_object tests the actual quiver, primary weapon and alternate weapon. JS tests game.uquiver, game.uwep and game.uswapwep. The real setters write game.u.uquiver, game.u.uwep and game.u.uswapwep. resetGame creates no top-level aliases, and a followed search of the full linked graph found no writers or accessors for those aliases. Other unrelated readers are separate leads, not part of this audit.

## Complete selected owners read

| Contract | C source | Fixed JS source |
| --- | --- | --- |
| Receive, merge, carry/drop, autoquiver, feedback | invent.c1208-1307 hold_another_object | invent.js2728-2818 |
| Primary, alternate and quiver slot writes | wield.c100-135 setuwep;276-289 setuqwep/setuswapwep; worn.c14-146 table, recalc_telepat_range, setworn | wield.js354-393,506-515; worn.js64-219 |
| Wield and swap commands, their immediate selection callbacks | wield.c138-273 cant_wield_corpse, empty_handed, ready_weapon;294-500 ready_ok, wield_ok, finish_splitting, dowield, doswapweapon | wield.js395-680 and ready_ok at70 |
| Ordinary object selection | invent.c1752-2091 getobj | invent.js1607-1950 selection helpers, getobj, silly_thing |
| Wish command and delivery | wizcmds.c32-46 wiz_wish; zap.c6314-6423 makewish | wizcmds.js98-109; zap.js1969-2081 |
| Wish count, BUC, name and object production | objnam.c3933-5404 readobjnam and init/preparse/parse_charges/postparse1/2/3;3243-3337 wishymatch;3455-3528 rnd_otyp_by_namedesc;3037-3163 makesingular | objnam.js1884-2843 helpers;3208-3761 readobjnam;1586-1662 wishymatch;1736-1802 rnd_otyp_by_namedesc;3866-3945 makesingular |
| Inventory letters and insertion | invent.c694-732 assigninvlet;1022-1047 addinv_core2;1056-1184 addinv_core0/addinv/addinv_nomerge | invent.js456-684 assigninvlet, addinv helpers |
| RC booleans and application | options.c489-701 parseoptions;5192-5452 optfn_boolean; optlist.h autoquiver and pauper declarations | options.js204-892 parseoptions;978-1100 parseNethackrc;1635-1664 boolean value/store helpers; jsmain.js startup application |
| Inventory feedback/entry | invent.c2875-2954 prinv/xprname;2964-3009 dispinv_with_action/ddoinv;3428-3455 display_inventory | invent.js2546-2602 xprname/prinv;3010-3052 dispinv_with_action/ddoinv;1525-1542 display_inventory |

Supporting source read without claiming whole-file closure: include/obj.h235-249 complete ammunition/missile macros; objects.h arrow, dart, shuriken and bow declarations; cmd.c key table and corresponding JS extcmd_data/execute_extcmd dispatch; u_init.c1300 pauper early return and JS corresponding ini_inv guard; objnam.c1560-1646 and JS1449-1504 complete reached weapon/swap/quiver suffix clauses. The unrelated full inventory menu sorter and every other readobjnam leaf are not audited by this small equipment task.

## Producer and consumer chain

RC OPTIONS=autoquiver stores flags.autoquiver. The distinct negated option stores false. Pauper suppresses starting objects; the first wish therefore receives inventory letter a and the next distinct type b. This is a source prediction to verify in the passive batch, not assumed observational success.

Ctrl-W dispatches wiz_wish. It disables verbose wish prompts temporarily, awaits makewish, and restores verbose. makewish reads the actual keyboard string, calls readobjnam and passes the real object to hold_another_object before its subsequent wish RNG. The wizard count path preserves the requested three or five mergeable missiles. The uncursed prefix clears blessing and curse. Bow, arrow, dart and shuriken resolve through the ordinary object-name parser. Their random enchantment is intentionally unspecified.

The command w then a selects the first bow through getobj. Human Valkyrie can wield it, the wish is uncursed, and there is no starting shield. ready_weapon installs it through setuwep/setworn. The x command uses doswapweapon to move it into the alternate slot and empty the primary slot. Before the last wish, the passive snapshot must prove the actual producer slots and inventory IDs.

hold_another_object adds or merges the received object and handles failure/drop before autoquiver. For these light, distinct, non-artifact objects the intended reached path has a carried unworn new item. is_missile accepts dart/shuriken skills, not arrow. ammo_and_launcher accepts an arrow only when a current or alternate bow exists. setuqwep calls setworn(W_QUIVER), which clears the previous object's quiver mask and writes the new canonical slot. Thus the wrong empty-quiver read can replace the first darts with shuriken; the wrong launcher reads prevent arrow selection.

The three predicted failures are independent of name rendering: two lost opportunities to fill an empty quiver and one replacement of an occupied quiver. The controls keep autoquiver disabled, lack a matching launcher, or receive the first missile without a launcher. All three should already behave like C.

The suffix reader uses the object's actual worn mask. Bow ammo prints "(in quiver)". Darts and shuriken print "(at the ready)". A bow in the alternate slot prints "(alternate weapon; not wielded)". Shuriken can have the unidentified description "throwing stars", so the state contract uses its actual type and does not guess its displayed base name. Inventory predicates use decoded rows, never raw ANSI substring positions.

## Observation and limits

The exact six parent draft tuples are retained. Six Escape acknowledgements are producer input, not a truncation or observer filter. The batch must expose setup failures if those keys fail to complete a wish, wield or swap. Snapshots observe inventory identity, quantity, worn masks, canonical equipment, option state and survival. They never call gameplay helpers or alter game state. Plain and delayed-input runs independently compare screens, cursors, calls, slices and frames. Delayed EOF must remain pending with unchanged outputs until explicitly stopped by the harness.

No C has been executed for this family. No baseline result or source prediction is an original-C confirmation. A future runtime change is not authorized yet. The possible later scope is only the three equipment reads inside hold_another_object, after parent C confirms the locked inputs.

The broader wish parser has independent limitations, including DEBUG wish-history behavior. This packet does not claim the installed C DEBUG branch is compiled out. The direct unprefixed Ctrl-W routes do not request that menu. Artifact touch, encumbrance rejection, fumbling, thrown-item pickup and unrelated stale top-level equipment readers are outside this bounded family.
