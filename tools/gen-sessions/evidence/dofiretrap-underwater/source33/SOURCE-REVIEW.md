# Underwater fire-trap source contract

Fixed graph: dofiretrap-slime-parent-composed,280modules, runtime SHA
2b74bb698d3975fbae845838ab47bd9bf18154a5c1c088a73fbb31b04298b2a2.
All280 hashes were checked before designing this family. No runtime candidate.

Read the complete C trap.c:4233-4325 dofiretrap and fixed JS387-470. C draws
d(2,4) before its liquid test. With a null box and Underwater, it prints the
steamy-bubbles message. Fire resistance produces the uninjured message;
otherwise losehp receives rnd(3), boiling water, KILLED_BY. It then returns.
There is no flame message, fire shield, monster maximum shrink, armor/item or
floor burning, or burn_away_slime call in that arm. JS omits the liquid arm
and takes the normal fire path, including the newly verified slime cleanup.
The box-not-carried pool-coordinate arm is distinct and unclaimed here.

Read complete C dotrap2996-3065 and JS1833-1948, floor_trigger/check_in_air,
the FIRE_TRAP selector entry, and complete C/JS trapeffect_fire_trap. The hero
dispatcher marks the trap seen and invokes dofiretrap(null). Sitting passes
VIASITTING. An unseen trap does not take the already-seen random-escape test.
Neither chosen form levitates or flies. No fumbling gloves are necessary.

Read dosit entry through trap dispatch in C sit.c400-503 and JS459-563, plus
complete can_reach_floor in C engrave.c187-214 and JS pickup.js147-173. The
pool-before-trap shortcut applies only when not Underwater. With Underwater,
no floor object and a trap, sitting reaches dotrap before muddy-bottom text.
The observer must establish the actual condition, not infer it from POOL.

Read complete C wizterrainwish3554-3917 and both JS wish helpers2847-3198,
complete C maketrap456-603 and JS mklev.js510-658. A NEW trap on pool terrain
is rejected. The family therefore wishes an unseen fire trap on dry room
floor, then wishes a pool over it. Pool replacement leaves that trap intact.
The existing-trap maketrap arm is not needed for this route.

Pool wish itself runs water_damage_chain on floor objects and switch_terrain;
it does not directly call pooleffects in this branch. Read complete C/JS
switch_terrain, set_uinwater, pooleffects and drown, and the actual allmain
stationary caller (C428, JS1030). A real wait consumes time and reaches
pooleffects(false), which calls drown and sets u.uinwater for safe forms.
This is the same ordinary water-elemental producer used by maintained
underwater-decor. The six inputs all include the wait before timed slime.

Water elemental is naturally breathless, amphibious and swimming, without
fire resistance. Its NOEYES form is blind even on dry floor. Iron golem is
breathless and naturally fire resistant, without swimming. Its initial entry
into water causes the source-owned rust damage/max reduction in drown. Those
effects are measured before the tested fire action and are not attributed to
dofiretrap. Later stationary pool checks skip drown for an already-submerged
breathless hero. The retained monster-table definitions, actual property
readers and setup snapshots establish the two forms. No resistant debug-menu
selection or guessed equipment property is used.

The cleanup prefix and seed/RC/date come unchanged from the sealed slime
family. The actual genocide scroll is consumed and the hero moves onto its
known empty room square. The maintained producer proof is linked, not copied
as a corpus or replaced by state injection. Every setup must independently
show no living monsters, no floor objects, empty inventory, the intended
form/resistance, a fire trap, HP and real Underwater. The new family does not
assume those conditions merely because the earlier family established them.

The real #wizintrinsic100c producer is reused from source15. Complete C/JS
wiz_intrinsic and make_slimed/burn_away_slime were read for that sealed audit
and their pinned source is unchanged. It runs after water entry, so timer100
is required immediately before sit/look. C underwater fire retains that timer
apart from ordinary elapsed turns; dry fire cures it. Look leaves it100.

Primary branch assertions use source-owned message prefixes, not guessed
surface article text. Trap-local C RNG is d(2,4), then rnd(3) only without
resistance. The passive report retains action calls and tests that prefix;
it does not relabel later world-turn calls as trap-local or remove them.
Native comparison and any stronger all-call attribution belong to the parent.

Limits: empty inventory/floor establishes no object interception and observes
no object changes, but does not exercise damage to carried items. Chest and
uncarried-box coordinates, human HP floor, lava, drowning rescue/death, low HP,
late slime appearance and delayed killers are unclaimed. Any setup/assertion
failure from the one locked batch stays intact, with no tuning or retry.

For the blind water-elemental producer, read complete C/JS feel_newsym and
feel_location plus the _map_location/map_location trap arm. Touch mapping
does not mark an unseen fire trap seen: that arm requires tseen already set.
The separate visible trapped-monster reveal covers bear traps/pits/webs, not
fire. The observer still requires unseen fire immediately before action.
JS d/rnd log spellings were read; the source prefix checks use their actual
raw entries and retain every later call unchanged.
