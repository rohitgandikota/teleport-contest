# Doorway engraving cleanup

C `gd_move` opens a door in two arms of its carving loop. It first checks whether
the square beyond the proposed door has room terrain. If the directional attempts
fail, it also accepts room terrain on the proposed door square itself. Both arms
call `del_engr_at(ex, ey)` before continuing. The published JS omitted both calls.
The patch adds those two calls in the same positions, using the existing import.

The pinned source is `16ff59115315917b93185d026aeefea06db9b0f4`.
The complete `gd_move` owner and its dispatch/cleanup contracts were reviewed in
the preceding restored-entry audit. This review reread the carving and movement
section at vault.c1070-1201, both deletion sites, and the corresponding JS body.
It also read `del_engr_at`, `del_engr`, `engr_at` and the engraving readout contract.
Deletion removes the existing engraving from the level list. It does not draw
random numbers or redraw the square by itself. A surviving engraving can later
add readout messages and erosion draws, so the omission affects future output.

Both positive inputs use keyboard commands to create terrain, write in the dust,
return to the vault and follow its guard. The first leaves a wall at (26,5) and a
throne at (27,5). The second leaves a throne at (26,5) and a wall at (27,5).
Before carving, both retain the actual engraving at (27,5). Following the guard
opens the door at (26,5). C deletes the engraving beyond it in either case.
The second input later restores room terrain and looks at that square so its
previously concealed engraving also has an observable terminal consequence.
No helper call, map edit or fabricated object supplies these states.

The three controls carve stone, stop before the carving move, and follow the
existing unengraved wall route. Every case compares passive observation with
plain replay and deferred input. The original 25 assertions improve from 23 to
25, and all three negative rows and fifteen output hashes stay unchanged.
The input values and key sequences were locked before the candidate. C recorded
them once; all five primary branch assertions passed without adjustment.
Native comparison improves from 3/5 to 5/5, repairing six screen boundaries and
both positive random streams. All three negative native reports remain equal.

This checkpoint covers the two engraving deletions. It does not close vault
wall restoration, entrance reconstruction or the later stuck-destination name.
