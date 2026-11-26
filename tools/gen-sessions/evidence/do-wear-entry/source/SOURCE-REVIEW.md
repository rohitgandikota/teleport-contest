# Direct wear and put-on entry contract

This is a source audit on fixed c425, with no runtime candidate. C is the local upstream 16ff59115315917b93185d026aeefea06db9b0f4 source. The linked 280-module graph is the parent menu/status composition. The independently queued inventory-action P correction is not imported.

## Confirmed entry differences

Complete C do_wear.c2432-2471 and JS do_wear.js2624-2642 were read. Both C entry points require all eleven slots for their early full-equipment message: suit, shirt, cloak, helmet, shield, gloves, boots, both rings, amulet and eyewear. W first rejects verysmall/nohands, then prints `You are already wearing a full complement of armor.` P has no such form guard and prints its fingers/amulet/eyewear message. Fixed JS omits both full-equipment checks. Seven armor slots alone or four accessory slots alone do not satisfy either C condition.

C's P message calls fingers_or_gloves(FALSE), which uses makeplural(body_part(FINGER)) even when gloves are worn. Complete fingers_or_gloves and body_part/mbodypart were read. A human therefore has ring-fingers. LENSES selects `some lenses`; any other eyewear selects `a blindfold`. The locked full case uses ordinary lenses, so it does not require a blindness transition or the towel wording quirk.

Both C entries return ECMD_CANCEL when getobj returns null. Both JS entries return ECMD_OK. This is not merely a number difference: complete getobj, its object classifier, display_pickinv, rhack/reset_cmd_vars, do_repeat and queue consumers establish a specific keyboard consequence. rhack saves the wear/puton command identity before dispatch. CANCEL clears both command queues; OK without time preserves the repeat queue. Direct Escape in JS getobj already clears CQ_REPEAT, but its inventory-menu cancellation branch returns null without that extra clearing. Thus W/P, then ?, Escape, Ctrl-A should report no command available in C and reopen getobj in this JS baseline. That prediction is locked separately from the full-equipment cases and still needs observation/native confirmation.

The internal ring-hand selection Escape is different: accessory_or_armor_on itself returns ECMD_OK in C and JS. Existing tests correctly cover that branch. It must not be changed as part of an entry repair.

## Immediate owner and producer review

Complete shared accessory_or_armor_on (C2209-2428, JS1854-2021), canwearobj (C2030-2207, JS1689-1823), equip_ok and wear_ok/puton_ok (C3404-3476, JS cmd1020-1074), getobj (C invent1752-2105, JS1722-1930 plus its preceding classification helper), and display_pickinv (C3057-3414, JS1376-1516) were read. Already worn items are inaccessible. Accessories are downplayed for W and armor is downplayed for P. With every carried item worn, fixed getobj reaches `You don't have anything else to wear/put on.` With one suitable unworn item it still prompts, including the downplayed opposite-category case.

Complete setworn and its slot table, retouch_object, remove_worn_item, touch_artifact, artifact_light, dragon_armor_handling, all seven armor-on callbacks, Ring_on, Amulet_on, Blindf_on, on_msg, nomul and unmul were read in both sources. The selected mundane armor takes no special property arm. Armor sets its slot before the delay and completes its callback through unmul. The shirt is put on before suit and cloak. Both rings are uncursed +0, the amulet is reflection, and ordinary lenses do not change blindness. Newly wished accessories have no worn mask, so remove_worn_item returns before removal effects. Human form and no artifact avoid silver/artifact rejection. These are reviewed branches, not a claim that every transitive armor/property owner is closed.

The actual setup is ordinary debug keyboard input: pauper/nudist startup, eleven Ctrl-W wishes, direct W/P selection and a real left-hand answer. Complete wiz_wish and makewish were read. The named object definitions and delays were checked in include/objects.h and objects_data.js. Existing accessory-wear-owner recipes use the same seed 99812, startup options and wish/settling sequence. The probe will verify actual object types, slots, uncursed status and completed dressing. It does not inject inventory, slots, monster form, command queues or return values. This review does not certify the complete readobjnam owner; a failed wish/setup must remain an observed prerequisite failure.

## Callers and existing coverage

C's command table binds W to dowear and P to doputon. IA_WEAR_OBJ queues dowear. JS's direct command dispatch agrees; its inventory-action P queues doputon in this baseline, the parent's separate accepted correction. New cases use only direct W/P, so they do not depend on that queued-action fix. Searches of the fixed graph found no direct gameplay calls beyond those entry identities.

The maintained accessory-wear-owner state gate directly exercises the shared helper, including ring-hand cancellation and occupied amulet. Its ten ordinary cases, the armor-wear-remove recipe and four eyewear-lifecycle cases do not assert the all-eleven-slot messages. The command-repeat state gate checks queue identity, rebinding, invalid commands and prefixes. Its default-command-repeat recording covers direct getobj Escape and inventory repetition, but not W/P inventory-menu Escape. Existing coverage was inspected, not rerun.

## Locked observational scope

Six original tuples are locked before any JS execution: full eleven slots, helmet omitted, amulet omitted, W menu cancellation/repeat, P menu cancellation/repeat, and direct Escape/repeat for both entries. The two missing-slot cases retain all eleven objects but omit exactly one wear command. The cancellation cases use two unworn armor items so ? opens a real multi-item menu. Original source predictions and every key are retained even if setup or a prediction fails.

One worker, 512 MB and 55 seconds, may observe this family on c425. Read-only boundary snapshots establish reach; plain and deferred delivery checks compare all five output streams. No C recording, native parity claim or candidate is authorized here. Parent prerequisites after observation are independent review, unchanged-input C recording if desired, and an explicit candidate assignment.

After that single observation, complete C update_topl/redotoplin/topl_putsym/putsyms and their JS update_topl/paint_topline counterparts were read to derive primary C metadata. The full P sentence has81characters. C replaces the space at offset73 with newline and displays `lenses.` on row1, followed by its More handling. The original observational contiguous-string predicate is therefore a separate known layout premise failure. It stays fixed along with all original results. The primary recipe checks every visible letter at boundary478 on the two source-derived rows. This metadata addition is not a runtime change, a rerecording, or a claim that the old predicate will pass a future faithful candidate.
