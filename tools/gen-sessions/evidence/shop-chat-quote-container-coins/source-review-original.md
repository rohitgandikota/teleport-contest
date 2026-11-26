# Shop quote container and coin branches

This is a source-only ordinary-input audit on fixed `9dbbff6acd0f9bf314062fc27ca6ae962b4dae207b95ece2a1efcd4b1b204f30`, 280 runtime files. No defect is presumed. The six routes below are predictions locked before their first replay. Native reach, output, RNG order and cursor parity remain for the parent to establish.

## Reviewed owners and immediate contracts

`source-ranges.json` pins 56 reviewed ranges. `prior-ranges-revalidated.json` pins 41 earlier reads rechecked against this graph and the same C sources. Whole owners are identified separately from selected branches. Both ledgers contain file and exact range hashes; neither copies source trees.

The complete C quote owners are `shk.c:5386-5503`, with fixed JS counterparts at `shk.js:4876-4972`. `shop_object` skips leading coins and accepts an otherwise eligible object with `no_charge` set. `price_quote` skips coins inside the remaining floor chain. A free top-level container starts with zero cost, then adds `contained_cost`. A positive contents total uses the contents-only prefix. A zero total clears that prefix and gives the no-charge response. Multiple non-coin rows use a menu. A single contents-only quote ends with a period and does not call `shk_embellish`.

Complete C `contained_cost`, `shk.c:2995-3042`, and JS `shk.js:4358-4400` walk through enclosing containers to the top object. `OBJ_FREE` is treated as floor during pickup billing. Floor contents are charged when their own `no_charge` is clear and the spot is not the shop's free spot. Inventory uses unpaid status or `!unpaid_only`. Coins are skipped, nested contents recurse, and buying uses `get_cost * get_pricing_units`. The sell-price branch instead tests saleability, unpaid status, ball class, eaten food and spent candles. The family observes only plain, whole, non-artifact objects in one floor sack away from the free spot.

Complete pricing, sale and ownership reads include C `shk.c:2809-3100,3148-3193,3309-3365,3451-3620,3661-3713,3877-4194`, and corresponding fixed JS ranges in the ledgers. `sellobj` first returns a whole unpaid non-container item to stock by removing its bill entry, even when `SELL_DONTSELL` is active. Refusing the empty sack's sale makes that sack `no_charge`. `in_container` selects `SELL_DONTSELL` for an owned floor sack. Thus a returned unpaid pick-axe remains chargeable stock inside that sack, while the hero's apples become no-charge contents. `donate_gold` updates shop credit but leaves the dropped gold on the floor. Billing observations use `billct` and only the live `bill_p` prefix.

Complete pickup and loot reads cover C `pickup.c:672-910,1570-1973,2024-2346,2558-2723,2957-3226,3397-3477` and the corresponding fixed JS ranges. The single-item auto-selection branch was read at `pickup.c:1025-1082`; the entire general object menu is not claimed reviewed. `pick_obj` removes the floor item, bills it, then calls `addinv`. `in_container` frees inventory before selling, emits the put-in message, attaches the item to its real parent, updates weight and status. The `s` choice uses `getobj` to stash one selected item. A successful stash learns the contents. Attempting removal from an unknown empty sack learns that it is empty and can consume a turn. No actual out-container transfer is needed by this family.

Complete drop, placement and inventory reads include C `do.c:29-43,714-843`, `mkobj.c:2305-2366,2676-2695`, `invent.c:961-1155,1356-1409`, and their JS counterparts. Floor placement precedes sale. Non-boulder placement prepends to the floor chain, so dropping gold above the natural pick-axe makes a leading-coin pile; dropping refused-sale apples afterward puts coins between two quoted objects. `add_to_container` sets the actual parent and contained location. `freeinv` preserves unpaid status until the sale contract removes the bill. The public wish prefix and inventory insertion path are reused from the maintained recipes pinned in `setup-provenance.json`.

Complete C `xname/xname_flags`, `objnam.c:575-1029`, and `doname_base/doname`, `1223-1757`, plus fixed JS `objnam.js:354-622,1250-1522`, were read. Complete `count_contents`, C `invent.c:3620-3651` and JS `741-765`, counts the two-apple stack as one item. A known empty sack gains the empty prefix; a known nonempty sack names its item count. Object naming can change knowledge, so the observer never calls naming or pricing owners. Empty and gold wish parser branches are explicitly selected reads, not a claim of full parser coverage.

Complete C `sounds.c:1257-1409` and JS `sounds.js:202-311` put the shop branch after speech guards and before the direction prompt. A successful quote returns time. A coins-only pile is not eligible for that branch, so cancelling the direction prompt returns without time. Complete location and capacity helpers and the relevant type declarations are also pinned.

## Locked keyboard family

Every case starts with the exact 31-key maintained seed6903 prefix, which previously reaches a natural shop pick-axe at `[75,10]`. This is a prefix reuse, not a seed search. Fresh passive observations must establish the shopkeeper, natural object identity, price prerequisites and floor ownership again. The five input fields, their presence and every key byte are in `input-lock.json`.

| Route | Real producer | Source prediction |
| --- | --- | --- |
| contents-only | Wish an empty sack, pick up the natural unpaid pick-axe, wish apples, drop the sack and refuse its sale, stash the pick-axe into it | Owned sack, chargeable pick-axe contents, no live bill, contents-only quote at 67 zorkmids |
| owned-contents-control | Same setup, stash the hero's two apples instead | Owned sack and owned contents, pick-axe still held unpaid, no-charge quote without contents-only prefix |
| empty-owned-control | Same setup, request removal from the empty sack | Known empty owned sack, pick-axe still held unpaid, empty no-charge quote |
| leading-coins | Wish and drop 100 gold above the natural pick-axe | Credit100, gold remains floor head, single pick-axe quote skips it |
| interleaved-coins | Same gold drop, then wish two apples, drop them and refuse sale | Floor apples, gold, pick-axe; a two-row quote menu omits the gold |
| coins-only-control | Pick up the natural pick-axe, then wish and drop 100 gold | Only coins on floor, credit100 and one live bill; direction prompt then cancellation, no quote or time |

The pick-axe's base cost is 50. The observed prerequisite must have charisma8 through10, known ordinary stock and no surcharge, producing C's rounded quote67. No object, price, species, map or RNG state is injected. Input slot predictions and prompt acknowledgements are part of the proposal and may fail; any such failure remains evidence rather than being repaired after the run.

All routes are sober. The contents-only, free and menu quote paths use no quote-owner core RNG. A normal turn can still draw after the quote. The single priced leading-coin path starts with `shk_embellish`'s `rn2(3)` and may then use `rn2(5)`. The menu is observed while waiting, before a turn advances. The coins-only cancellation should have no chat core calls. These are source predictions, not native results. Hallucinated currency argument ordering is outside this family.

## One locked observation

`tools/probe.mjs` locks 32 checks for each of six cases before gameplay. It first verifies the fixed graph, old seals, proposal, recipe, input lock and assertion file. Its passive observer reads actual owner state and side-effect-free predicates. It does not call `shop_keeper` because that helper can rile the keeper, and it does not call naming, price, quote, billing or RNG-producing helpers. Object IDs, parent links, floor links, knowledge, live bills, gold and credit are observed directly.

Each case runs once with observation, once plain and once with deferred keyboard input in one sequential512MB worker. All five output channels must agree, all keys must be consumed, and the final pending read must stay stable. Only compact state, selected message lines, hashes and a short RNG prefix are retained. The three proposed negatives retain all15 output hashes even if a producer fails. The report keeps every original predicate and first unmet condition.

Before locking, static driver review corrected the inherited destructured `game` reference to a module namespace for the deferred loop. `resetGame()` replaces the object at `jsmain.js:111` and `gstate.js:8-23`. The obsolete assignment to the stale object's display was removed; `run._pendingDisplay` already supplies the display to the public game wrapper. No gameplay had run before this correction. The inherited deferred-input mechanism otherwise stays the same.

## Open contracts and exclusions

JS `sellobj` lacks C's shopkeeper-rousing and robbed-shop handling. This family requires an awake, able, peaceful and unrobbed keeper. It does not close those branches. JS `addtobill` duplicates some billing decisions; whole billing closure is not claimed.

C `addinv_core0` calls `picked_container` for nonempty containers. The fixed JS inventory insertion path does not make that call. No nonempty container is picked up in this family, so that is a separate source lead without an ordinary witness here. The empty-wish C branch uses `delete_contents`; JS assigns an empty contents list. This family cannot establish a disposal consequence from that difference.

Nested containers, contained coins, artifacts, globs, ball and chain, partially eaten food, spent candles, free-spot pricing, inventory `unpaid_only`, filled-container pickup, bag explosions, locked/trapped containers and other loot menu transfers remain unobserved. Full transitive naming, parser, merger, inventory and shop subsystems are not claimed complete. A successful JS producer is source reach only; it does not establish C parity or a runtime defect.
