# Sealed marker-color source prerequisite

Manifest SHA256:1cc6a6b15a85d3b48aae3bf65b4b260d3eb775708297bf9e81b5f0ea297f42ff.
Members:334. Fixed280 baseline is immutable fruit/text334.
Candidate map:b72982ce01ec0a50b990c19b9e3005567e44d8e091b8ba2bb122784d907a3381.
Handoff:fb03abb87ef7eeb5a1489a227a0079e90e6e3e242047280f4bf8ac9607ab605f.
Only candidate/js/tty/wintty.js changes, one color argument in set_item_state.

Source12/12 versus6/12. All18 JS-to-JS accounting cases pass with exactly two
marker cell color changes. Other four streams are unchanged in every case.
The legacy ASCII screen expectation explicitly FAILS; its hash remains fixed.
Other34/35 negative hashes remain exact. The first accounting schema failure
is preserved and the v2 DEC-state assertion is explicit.

Parent native on old334 remains16/18. New candidate native18 is pending.
Parent owns composition, native comparison and broader verification. No C
rerecording, main/Git/native/NFS/public/full work was performed by this worker.
The separate fruit-text-promotion remains unsealed and paused.
