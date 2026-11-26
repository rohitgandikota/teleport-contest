# Preserved portable bookkeeping failure

The first portable attempt exited1 after2.919s. Its preflight and102 live
checks completed, then the first complete negative-row comparison rejected
live cleanup fields `mh: undefined` and `mhmax: undefined`. The sealed source
and candidate reports use JSON serialization, which omits those fields before
comparison. The original error, draft gate, lock, manifest, contract and run
receipt are retained under promotion-attempt1. The first default-mode run
changed none of416 fingerprinted entries. It was not a successful portable
handoff, and its failure is not erased.

The correction applies the same persisted JSON boundary as candidate336.
It independently asserts that both cleanup fields are actually undefined,
then compares every other live row value against the persisted row. Only
those two undefined fields can disappear. An unexpected missing, changed or
non-JSON value anywhere else fails that comparison. Every original gameplay
predicate still runs on the live snapshots before this bookkeeping step.

The same-version complete negative-row comparisons use the persisted rows;
all five output hashes remain unchanged and are compared directly. Legacy
100/102 accounting still evaluates the original two blind-look predicates
and retains their exact failure messages. No input, runtime, gameplay
assertion, original source/candidate report or recorded C stream is changed.

The final portable validation is a separate bounded packaging check after
this correction, not a second source/candidate experiment or C recording.
