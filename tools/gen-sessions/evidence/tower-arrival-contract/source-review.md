# Tower arrival review

The pinned C source is 16ff59115315917b93185d026aeefea06db9b0f4.
The complete goto_level owner was reviewed at src/do.c:1479-2000 and its
JS counterpart at js/do.js:971-1595. C saves whether the hero is inside the
Wizard's Tower before leaving. Its random-arrival call passes that value as
bit 2 to u_on_rndspot, alongside bit 1 for upward travel. JS already saves
the equivalent value for the mysterious-force branch but omitted it from
the arrival call. The only runtime change restores that argument.

The complete direct helpers In_W_tower, On_W_tower_level, u_on_rndspot,
place_lregion and put_lregion_here were reviewed. Their existing implementation
already selects the destination tower interior when bit 2 is set and the
destination is a tower level. The existing switch_terrain call stays intact.
level_tele, dotele, scrolltele, tele_jump_ok and teleok were also reviewed,
with the actual fake and real Wizard tower Lua producers. Horizontal teleport
cannot cross the tower boundary, including in wizard mode.

The seven inputs therefore use actual gameplay. The inside cases enter through
the fake tower portal before teleporting between tower floors. They use a legal
xorn polymorph and flight to reach it. An earlier ghost proposal was rejected
because that monster is not a legal polymorph form. An early outside control
stopped at an object menu; its corrected input was locked before candidate work.
All ten proposals and their compact outcomes remain in the source packet.

The locked family contains three positive traces and four unaffected controls.
Upward travel reaches the middle and top tower floors. The round trip returns
downward after the repaired upward transition; it is not an independent
baseline down-only witness. Controls leave for the main dungeon, arrive from
outside the tower, cancel level selection, or stop after portal entry. The
ordinary observer verifies the actual dungeon level and In_W_tower state,
survival, entry route and the intermediate middle-floor stop. It also verifies
all twenty negative output hashes, observer neutrality and deferred input.

The original C recording was made once from the locked five input fields.
It has 971 keys, 978 styled boundaries and cursors, 91,400 random calls and
ordered slices, and zero animation frames. Baseline matches four of seven;
isolated and composed candidates match all seven. The first positive mismatch
is at boundary 148. For the middle floor, C calls rn2(28)=3 while baseline
calls rn2(79)=33, directly exposing the wrong placement rectangle. Both fixed
candidate reports are identical. The ordinary checks improve from 64/68 to
68/68 on both candidates. Inputs and expected outputs were never adjusted
after candidate testing.

The portable gate requires the exact recipe, input lock and original C raw
before loading the tested runtime. Missing and corrupt raw files and a variant
selector fail before runtime imports. Default invocation writes no files.
The initial preflight harness omitted the existing shared decoder dependency;
that setup error is retained separately and was corrected before these checks.

This closes the missing tower flag at the random-arrival call. It does not
close all goto_level branches. Separate gaps include the same-level guard,
lock/trap/polearm context reset, killed-genocided arrival processing, notice
ordering, in_out_region/fix_shop_damage, stair/ladder distinctions and the
invalid tower-boundary diagnostic. Neither a held-out gain nor complete
serialized terminal byte equivalence is inferred from this family.
