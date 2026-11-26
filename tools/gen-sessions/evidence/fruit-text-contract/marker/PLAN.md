# Menu selection marker color prerequisite

Baseline is the sealed334 fruit/text candidate,280 modules, map
21a22aa9c2adbb83a4c3ea93f7dbd89daf774a1d1b1bf541936870921e4a32ff.
No runtime from live main or the later wrapped composition is imported. This
packet is separate from both sealed fruit-text and its unsealed promotion.

Parent native proof is16/18 versus6/18. The only remaining candidate differences
are '+' at(43,3): byte-search step13 and ASCII-negative step20. Both are red/bold
in C and default-color/bold in JS. All other parent candidate output streams
match. The ASCII case already fails on dbb, so its old negative hashes are valid
evidence of an unaffected preexisting defect, not a C-correct oracle to rewrite.

## Complete source review and intended owner

Read complete C/JS set_item_state, process_menu_window/tty_select_menu,
toggle_menu_curr and all page/group selection helpers; menu producer wrappers,
get_menu_coloring, tty_add_menu/tty_end_menu; term_start_attr/end_attr,
term_start_color/end_color, capture attribute/color setters and tty_curs.
The actual search path passes the same live item that the menu producer stored.
The C marker owner applies item->attr and item->color before capture. JS applies
term_attr(item.attr) but hardcodes NO_COLOR. Color/attribute production and the
ASCII search repair in sealed334 are already correct for both recorded cases.

The proposed change is only set_item_state's cell color argument in
js/tty/wintty.js, using its existing tty_color(item.color) conversion. It applies
to '+', '-' and '#', and to search, explicit, count, group and bulk callers.
It does not repaint the full row or change selection, counts, matching or input.
Default/gray/default-darkgray colors use the existing color helper. A complete
darkgray-option or generic terminal color rewrite is outside this repair.

The C owner temporarily moves its cursor to the marker and advances it; the C
menu loop restores the footer before input. Current JS paints cells without
moving that physical cursor, and search explicitly restores the footer. Parent
native cursors already match. This color prerequisite preserves that existing
caller contract; it does not claim to port all transient tty_curs/window cursor
bookkeeping. No cursor mutation is added without an ordinary mismatch.

## Controls before patch

controls/marker-cases.json fixes12 constructed cases through real menu creation,
color-rule production and set_item_state. They cover all three marker characters,
red/green/cyan attributes, default/gray/default-darkgray, matching/nonmatching
menu color, disabled menu color and skip-menucolors. Verify unchanged neighbors,
item fields and unaffected cases, without mocks or new runtime exports.

The existing18 ordinary input tuples remain unchanged and are linked. Lock the
two expected C cell changes from source/native-finding.json before patching.
Use one bounded JS worker on baseline, then the isolated candidate. Compare full
outputs, not masked output, with observer/plain/deferred controls. Parent alone
performs the full18 C comparisons. No new recording or fixture edits are needed.

## Composition accounting

Keep source334 and all its reports/negative hashes immutable. The new accounting
must compare sealed334 against the one-owner prerequisite for all18 inputs.
Require exact calls, slices, cursors and frames for every case. Require exact
screens for16 cases. For the two named cases, enumerate every styled-cell change
and require exactly the documented marker cell/color change at its fixed step,
with character and attribute unchanged. No output is transformed or masked.

The old ASCII screen hash must remain in evidence and be reported as failing
against the repaired output. Its other four hashes must remain exact. Only that
single screen hash receives a separate C-backed composition receipt, after the
parent's native comparison. The other30 ASCII/control hashes remain exact.
Do not alter the original assertion, call the original negative passed, select
away its case or claim promotion ready before parent native18 verification.
