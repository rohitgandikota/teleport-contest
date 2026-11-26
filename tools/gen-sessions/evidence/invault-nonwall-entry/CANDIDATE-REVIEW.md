# Exact owner change

The immutable source43 contains the complete C/JS invault review and forty pinned source ranges. The candidate changes only existing finish_guard_corridor and one display import. C vault.c590-618 and xy_set_wall_state3276-3326 were reread before editing. No timer or other vault owner is changed.

The reconstruction order is identical to C:

| Condition | Result |
| --- | --- |
| x=lowx-1, y=lowy-1 | TLCORNER |
| x=hix+1, y=lowy-1 | TRCORNER |
| x=lowx-1, y=hiy+1 | BLCORNER |
| x=hix+1, y=hiy+1 | BRCORNER |
| y=lowy-1 or hiy+1 | HWALL |
| x=lowx-1 or hix+1 | VWALL |

As in C, no matching condition retains the incoming type. The nonwall arm temporarily installs that type, clears wall_info and invokes the existing synchronous xy_set_wall_state. An already-wall entry bypasses the calculation. Both paths save wall_info as fakecorr.flags before the doorway is opened. C aliases these fields; JS keeps wall_info and generic flags separate. Reading loc.flags after the calculation would retain the original defect. The intact-wall negative also gains the canonical saved flag value without changing any output.

Door conversion clears generic flags and doormask. The inactive wall_info field remains available to the existing restoration readers, matching the fixed map representation already used for intact walls. This patch does not change those readers or globally alias the fields. Legacy fakecorr.doormask remains for their existing compatibility contract; it is not used as the saved wall flag. If another operation replaces that doorway and overwrites the typed wall field before restoration, the broader reader issue remains separate. These four inputs do not exercise that path.

The snapshot precedes doorway conversion and unblock_point. fcend and warncnt now follow unblocking, as in C. All new operations are synchronous; no caller await change is needed. No new export, helper abstraction, injected state or RNG operation is introduced.

# Evidence and limits

The original four tuples and all28 assertion bodies are unchanged. Candidate controls pass28/28 versus25/28. The three original source failures are preserved in source43 and linked here. Fresh passive observation, plain replay and deferred/held-EOF replay agree on all five output streams. All15 negative hashes are unchanged.

The parent C recording passes exact SHA/source:c/version5, all five input-field values/presence, every key, integrity and all four original primary assertions. Bounded JS comparison passes4/4 on the candidate versus3/4 on fixed ac8b. It checks597 styled boundaries/cursors,20703 core random calls and slices, and21 frame styles/cursors. All three complete negative report rows are unchanged. The positive repairs37 screen boundaries,39 glyph cells, one final cursor and27 extra random calls caused by the incorrect extra movement turn. Its first screen difference was step147 at terminal24,6: C wall versus JS doorway. No original C was executed by this worker.

Only the right vertical-wall branch has new ordinary/native reach. The corner and horizontal classification arms were ported and source-reviewed completely; they are not claimed as new ordinary or native coverage. Ice-timer cleanup remains excluded. Wallify is Leibniz's separate work, and the two gd_move engraving calls belong to parent. This is not a claim of complete invault, fakecorr-reader or vault-module parity.

Apply the two scoped patch hunks when composing. Do not replace a newer main vault.js wholesale from this fixed ac8b snapshot. Preserve parent's door-engraving change. If wallify adds the same xy_set_wall_state import, keep one shared import. Parent owns current composition, main/Git/NFS and broad tests.
