# One-owner marker color prerequisite, ready for parent native comparison

The candidate changes one expression in candidate/js/tty/wintty.js:
set_item_state paints with tty_color(item.color), preserving its existing
attribute and selection logic. C applies that color around the marker write.
The fixed baseline is the sealed334 fruit/text candidate, not current main.

The12 locked source controls pass12/12 versus6/12. They use real menu/rule/item
owners, cover '+', '-' and '#', color/attribute overrides and skipped overrides,
and verify every neighboring cell and item field. All six unaffected constructed
cases keep their full styled-grid hashes.

All18 original inputs complete the separate JS-to-JS accounting check:
194 boundaries,54,142 random calls, unchanged cursor/call/slice/frame streams,
unchanged observed gameplay states, and observer/plain/deferred equality with
live state bindings. Exactly two screen cells change: '+' at(43,3), byte-search
step13 and ASCII-negative step20, from color8 to color1. Attribute2, glyph and
decgfx0 are unchanged. The other16 cases retain all five output hashes. Full
outputs were compared in memory; no corpus output copies or masks were written.

The original ASCII screen hash remains97b6330d47819c7c56369ed2ac01c1c3ee4b9aea5fafe3ab1170820af02f92c5.
It explicitly FAILS against the repaired153770a877b930ad86698f931365697949761a3ab5312dfb797a21f6e2203cdb.
Its other four hashes remain exact. All other30 negative hashes remain exact,
so the accounting is34/35 unchanged, not a claim that the old negative passes.
source334 and all its original expectations/reports are untouched.

reports/accounting-v1-failure.json preserves the first accounting failure:
the frozen decoder includes decgfx while the parent's compact cell shape did
not. tools/accounting-v2.mjs adds an explicit unchanged-zero expectation for
that field, retaining all original cell values and every output stream check.
The runtime did not change for this schema correction.

Parent native on source334 remains16/18 versus6/18. Candidate native18 is still
pending and belongs to the parent. Reuse the same initial11 certified raw,
pickup2 raw and original fruit5 raw without rerecording or fixture changes.
The missing-source original initial raw and metadata-only certification proof
are linked unchanged. Parent owns composition with wrapped clearing and all
broader checks. fruit-text-promotion remains unsealed and paused.

Read PLAN.md for the complete owner/caller review and composition accounting.
The source review does not claim a generic cursor/color port. The current C
marker's transient tty_curs bookkeeping is not represented by the JS cell-only
helper; its existing caller input-boundary cursors are preserved and verified
unchanged. The complete darkgray-option behavior is outside this one-expression
repair. Source review also exposes an independent search-count lead: C routes
search through toggle_menu_curr(counting,count), while the JS search arm toggles
without those arguments. The18 recorded inputs do not establish that branch,
and this patch does not change it or claim ordinary closure for it.

Exact runtime and support paths are in manifest.json; handoff.json fixes the
candidate map, owner, patch, reports and prerequisites. The read-only verifier
is tools/verify-packet.py. The source/accounting producer scripts create reports
exclusively and must not overwrite sealed outputs. All execution used one bounded
JS worker, heap512/internal55s. No main/Git/C/native/NFS/public/full action was
performed by this worker.
