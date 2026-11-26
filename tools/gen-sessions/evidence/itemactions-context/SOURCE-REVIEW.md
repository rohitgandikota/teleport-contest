# Source review

The C source pin is `16ff59115315917b93185d026aeefea06db9b0f4`.
The baseline is published `c6839cb352d66b3ef6737cb917a5b07708942c64`.
Only `js/cmd.js` changes. The other 279 runtime files remain fixed.

The review compared the complete item naming and reading classifiers,
`ia_addmenu`, `itemactions_pushkeys` and `itemactions` in `src/iactions.c`
with their current JS implementations in `cmd.js`. The JS implementation
stores the selector character as its action identifier. This loses the
distinction between two C actions that both use `a`.

For identified oil, C `itemactions` selects `IA_APPLY_OBJ`. Its queue calls
`doapply`, whose oil arm calls `light_cocktail`. Other potions select
`IA_DIP_OBJ`, which calls `dip_into`. The JS queue now uses the same oil-type
and discovery predicate as the menu producer. The complete C and JS
`light_cocktail` bodies were checked for this route. Its actual keyboard
producer lights an unknown potion directly, making its type known. One test
then selects the snuff action. Another snuffs it directly before selecting
the light action. No test sets game state directly.

C `itemactions` constructs the tin label as the tin description, the optional
wielded-opener phrase, then “and eat the contents.” JS had placed the optional
phrase last. The fix follows the same order. The negative cases distinguish
having no opener from carrying an opener without wielding it.

The initial reach probe, locked inputs, baseline failures and original ordinary
assertion body are retained. Every source-predicted C branch passed without
changing inputs or predicates. The native baseline has five exact cases; the
candidate has eight. All five complete negative reports and 25 ordinary
negative hashes are unchanged. Public gate assertions preserve the original
ordinary body; only imports, pinned input loading and optional output differ.

The review also observed that the accessory `P` action queues `dowear` in C
and `doputon` in JS. No observable difference was established here, so that
route remains open. The JS module placement and non-C helper names also remain
an architecture gap. This checkpoint does not claim complete inventory-action
or helper coverage.
