# Chest fire floor guard

Complete C dofiretrap4233-4314 and fixed JS trap.js387-458 were read before
editing. C saves see_it, computes fire damage, handles resistance or form,
burns slime, damages carried items and calls ignite_items(invent), then
short-circuits the floor burn with !box. The candidate adds that one guard
before the existing awaited burn_floor_objects call. It changes no other
condition, statement, import, name or ordering.

Complete C/JS burn_floor_objects (zap.c4598-4658 / zap.js4469-4520) consumes
eligible paper and then calls ignite_items for the floor chain even when
its destruction count is zero. ignite_items (trap.c7161-7172 / JS377-384)
passes each unlit, unused item to catch_lit. Complete catch_lit
(apply.c1577-1625 / JS1667-1701) checks ignitability, actual object location,
fuel, lamp/candelabrum restrictions and cursed-lamp randomness. A fueled
uncursed oil lamp reaches feedback and begin_burn without that random draw.
This explains why the original chest-floor case changed output and lamp
state while its RNG was already exact.

Complete chest_trap was read (C6294-6499 / JS461-570), including fire outcomes
9 through12. Actual use_container trap entry (pickup.c2972-3020 /
pickup.js2264-2292) passes the non-null object for both held and floor
containers. Opening the retained held chest reaches the same dofiretrap
owner, with a real starting oil lamp dropped under the hero. The unchanged
negative1 instead drops the chest, leaving the lamp carried; that earlier
inventory ignition must continue. Negative2 only looks and keeps the trap.
The source probe's 27 checks and all snapshot/assertion bodies are unchanged.

The primary recipe differs from the original only by the parent-approved
coverage token replacement, made before C recording. The absent name field
on negative1 stays absent in original, primary, raw and every replay.
Mandatory preflight validates that derivation, recording provenance, exact
raw bytes, C/version5, root metadata, all five fields and their presence,
every key, integrity and three primary branches before gameplay imports.

The single bounded batch passes27/27,6/6 neutrality and native3/3 versus2/3
before. The original positive had one glyph/style boundary difference of23
cells at step46; its cursor stream, RNG and frames already matched. Do not
claim an independent RNG or cursor repair. Both full negative ordinary and
native rows, including ten ordinary stream hashes, remain unchanged.

## Retained floor burning

The unchanged fire-trap-floor-objects-state-gate runs six real floor-fire
cases, including paper consumption, protected books/scrolls and human
damage. The unchanged fire-light-source-ignition-state-gate runs eleven
cases, including floor oil, carried lamps, cursed lamps, light radii and
burn timers. Both pass on this candidate in the same bounded worker.

## Limits

The entry-time see_it versus later Blind reads remain distinct and untested.
The parent's underwater return and human-HP-floor work are absent from this
fixed60f base and are not included. C's own comment about not burning box
contents is preserved as C behavior, not repaired. Complete chest_trap
reading also shows unrelated location, explosion/billing and other outcome
differences; this family does not close them. No runtime/helper mocks,
private exports, new native recording, main/Git/NFS or broad replay occurred.
