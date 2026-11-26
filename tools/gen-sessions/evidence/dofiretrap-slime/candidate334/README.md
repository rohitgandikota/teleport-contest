# Fire-trap slime cleanup candidate

Only `js/trap.js:dofiretrap` changes, adding one awaited call to the existing
`burn_away_slime` helper after damage and before armor/item burning. The
existing import stays unchanged. The other279 modules are links to the fixed
published fire baseline3eb. Main and all earlier packets are untouched.

The single512MB/55s batch passed in3.654s. All54 original checks pass
(24producer,18source,12neutrality), versus50/54 before. Both slimed fire
triggers now clear timer100 to0 and emit the C cure message. All six native
cases are exact, versus4/6:946 styled boundaries and cursors,16874 calls and
per-input slices,42 animation frames and their styles/cursors. No inputs or
assertions changed. The complete original observer/assertion loop is verbatim.

All20 negative hashes and four complete ordinary/native negative rows are
unchanged. This includes the earlier healthy fire family's10 hashes. The two
slimed look controls retain timer100. Original50/54 and native4/6 evidence
remain linked and pinned, together with the exact copied original probe.

`reports/preflight.json` records the mandatory checks performed before gameplay
imports: source15, all280 runtime hashes, exact C5 raw/source/root metadata,
all five input fields and presence, all940 keys, recording integrity and all
six primary predicates. The C raw is a link, not another corpus copy.
`PLAN.md`, `SOURCE-REVIEW.md` and `pre-edit-lock.json` fix the source contract,
limited reach and bookkeeping adaptation before the owner edit and run.

For parent review, use `scoped-runtime.patch`, `native-handoff.json`,
`reports/accounting.json` and `reports/candidate-native.json`. Apply the hunk
to the current owner; do not replace current main with this older graph.
The original worker has an exclusive start receipt and must not be replayed.

Read-only verification:

```sh
python3 .cache/restart-20261122/dofiretrap-slime-candidate/verify-candidate.py
```

Remaining prerequisites are parent composition/current-runtime verification
and parent publication checks. Portable promotion is not part of this task.
No new C recording is needed for the unchanged six inputs. This witness does
not close underwater/chest fire, the human HP floor, blindness, low monster
maximum, Unchanging, a late slime appearance or a non-null delayed killer.
