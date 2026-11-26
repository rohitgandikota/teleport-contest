# Vault visibility and inventory accessory actions

C vault.c704-707 computes a restored wall's visibility mode before drawing it.
Calling the existing helper repairs 18 boundaries in the unmapped-wall case.
Mapped-wall and intact-wall controls retain every original output hash.

C iactions.c queues IA_WEAR_OBJ for an inventory accessory's P action. That
action invokes dowear, whose no-hands check precedes object selection. Direct
P still invokes doputon and can wear the same amulet without hands. The single
argument correction preserves that C behavior and both human/direct controls.

The combined runtime passes all seven original C cases: 1,484 styled boundaries
and cursors, 34,817 ordered random calls and six animation frames. Both reports
are byte-identical to their isolated candidate reports. Fresh ordinary gates
preserve all original assertions, observed/plain/deferred equality and 25
negative stream hashes. The wall report changes only its classification text.

All 932 maintained recordings pass, with 936,312 screens/cursors, 20,436,640
random calls and 33,185 frames. The NFS run uses two CPU workers, default
45-second limits and no retries. Twelve focused checks and 46 strict workers
also pass. The parent verification pins all 1,223 tested files and 44 installed
payloads. No held-out gain or whole-port completeness is inferred.

The first parent native entry used the wrong preflight import path. It failed
before game imports. The original log and receipt are retained here; the
corrected entry changes no assertion or runtime code. The wall recording's
missing root source field is separately documented in its exact attribution
evidence. Its original bytes are preserved.

Run the portable checks from the repository root:

```sh
node --max-old-space-size=512 tools/wallify-vault-wall-mode-input-gate.mjs
node --max-old-space-size=512 tools/itemactions-accessory-input-gate.mjs
```

Both commands accept one optional new report path and otherwise write nothing.
